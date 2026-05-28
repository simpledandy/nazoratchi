import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { Telegraf } from "telegraf";
import * as admin from "firebase-admin";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
if (!admin.apps || !admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  console.warn("TELEGRAM_BOT_TOKEN is not set. Bot features will be disabled.");
}

const bot = BOT_TOKEN ? new Telegraf(BOT_TOKEN) : null;

// Bot Logic
if (bot) {
  // Middleware to delete system messages and commands
  bot.on("message", async (ctx, next) => {
    const msg = ctx.message as any;
    
    // Delete system messages (new member, left member)
    if (msg.new_chat_members || msg.left_chat_member || msg.new_chat_title || msg.new_chat_photo || msg.delete_chat_photo || msg.group_chat_created || msg.supergroup_chat_created || msg.channel_chat_created || msg.migrate_to_chat_id || msg.migrate_from_chat_id || msg.pinned_message) {
      try { await ctx.deleteMessage(); } catch (e) {}
    }

    // Delete commands after reading
    if (msg.text && msg.text.startsWith("/")) {
      try { await ctx.deleteMessage(); } catch (e) {}
    }

    // Check for external links from non-admins
    if (msg.text || msg.caption) {
      const text = msg.text || msg.caption;
      const hasLink = /https?:\/\/[^\s]+/.test(text) || /t\.me\//.test(text);
      
      if (hasLink) {
        const member = await ctx.getChatMember(ctx.from.id);
        const isAdmin = ["creator", "administrator"].includes(member.status);
        
        if (!isAdmin) {
          try {
            await ctx.deleteMessage();
            await ctx.reply(`Hurmatli ${ctx.from.first_name}, guruhda tashqi havolalar ulashish taqiqlangan!`, {
              reply_parameters: { message_id: ctx.message.message_id }
            });
          } catch (e) {}
        }
      }
    }

    return next();
  });

  // Track new members and invitations
  bot.on("new_chat_members", async (ctx) => {
    const inviterId = ctx.from.id.toString();
    const newMembers = (ctx.message as any).new_chat_members;

    if (newMembers && Array.isArray(newMembers)) {
      for (const member of newMembers) {
      const inviteeId = member.id.toString();
      
      // Save user info
      await db.collection("users").doc(inviteeId).set({
        telegramId: inviteeId,
        username: member.username || "",
        firstName: member.first_name,
        lastName: member.last_name || "",
        joinedAt: new Date().toISOString(),
        isBot: member.is_bot
      }, { merge: true });

      // Log invite if it's not the user joining themselves (though usually it's an invite in groups)
      if (inviterId !== inviteeId) {
        // Find active contest
        const activeContest = await db.collection("contests")
          .where("isActive", "==", true)
          .where("startDate", "<=", new Date().toISOString())
          .where("endDate", ">=", new Date().toISOString())
          .limit(1)
          .get();

        await db.collection("invites").add({
          inviterId,
          inviteeId,
          timestamp: new Date().toISOString(),
          contestId: activeContest.empty ? null : activeContest.docs[0].id
        });
      }
    }
  }
});

  // Track leaves
  bot.on("left_chat_member", async (ctx) => {
    const member = ctx.message.left_chat_member;
    await db.collection("leaves").add({
      telegramId: member.id.toString(),
      timestamp: new Date().toISOString()
    });
  });

  // #contest command
  bot.hears(/#contest/i, async (ctx) => {
    const activeContest = await db.collection("contests")
      .where("isActive", "==", true)
      .get();

    if (activeContest.empty) {
      return ctx.reply("Hozirda faol konkurs mavjud emas.");
    }

    const contest = activeContest.docs[0].data();
    const message = `
🌟 **Yangi Konkurs Boshlandi!** 🌟

📝 **Nomi:** ${contest.title}
📅 **Boshlanish:** ${new Date(contest.startDate).toLocaleDateString()}
🏁 **Tugash:** ${new Date(contest.endDate).toLocaleDateString()}

🎁 **Sovrinlar:**
${contest.prizes}

ℹ️ **Qatnashish sharti:**
Guruhga do'stlaringizni qo'shing va eng ko'p odam qo'shganlar orasida g'olib bo'ling!

Omad tilaymiz! 🚀
    `;

    if (contest.imageUrl) {
      await ctx.replyWithPhoto(contest.imageUrl, { caption: message, parse_mode: "Markdown" });
    } else {
      await ctx.reply(message, { parse_mode: "Markdown" });
    }
  });

  bot.launch();
  console.log("Telegram bot started");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/stats", async (req, res) => {
    try {
      const invites = await db.collection("invites").get();
      const leaves = await db.collection("leaves").get();
      const users = await db.collection("users").get();
      
      const inviteData = invites.docs.map(d => d.data());
      const leaveData = leaves.docs.map(d => d.data());
      
      res.json({
        totalInvites: invites.size,
        totalLeaves: leaves.size,
        totalMembers: users.size,
        invites: inviteData,
        leaves: leaveData
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.get("/api/leaderboard", async (req, res) => {
    try {
      const invites = await db.collection("invites").get();
      const counts: Record<string, number> = {};
      
      invites.forEach(doc => {
        const data = doc.data();
        counts[data.inviterId] = (counts[data.inviterId] || 0) + 1;
      });

      const leaderboard = await Promise.all(
        Object.entries(counts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(async ([id, count]) => {
            const userDoc = await db.collection("users").doc(id).get();
            const userData = userDoc.data();
            return {
              id,
              count,
              name: userData ? `${userData.firstName} ${userData.lastName || ""}` : "Noma'lum foydalanuvchi"
            };
          })
      );

      res.json(leaderboard);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  app.get("/api/users/:id/details", async (req, res) => {
    try {
      const userId = req.params.id;
      
      // Get the user's profile details
      const userDoc = await db.collection("users").doc(userId).get();
      const userData = userDoc.exists ? userDoc.data() : null;
      
      // Get invites made by this user
      const invitesSnapshot = await db.collection("invites")
        .where("inviterId", "==", userId)
        .get();
      
      const invitesData = invitesSnapshot.docs.map(doc => doc.data());
      // Sort in memory to avoid indexing issues in Firestore
      invitesData.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      
      // Fetch user names for each invitee
      const detailedInvites = await Promise.all(
        invitesData.map(async (invite) => {
          const inviteeDoc = await db.collection("users").doc(invite.inviteeId).get();
          const inviteeData = inviteeDoc.exists ? inviteeDoc.data() : null;
          return {
            ...invite,
            inviteeName: inviteeData ? `${inviteeData.firstName} ${inviteeData.lastName || ""}` : "Noma'lum foydalanuvchi",
            inviteeUsername: inviteeData ? inviteeData.username : "",
            inviteeJoinedAt: inviteeData ? inviteeData.joinedAt : ""
          };
        })
      );
      
      res.json({
        user: userData ? {
          telegramId: userData.telegramId,
          username: userData.username,
          firstName: userData.firstName,
          lastName: userData.lastName,
          joinedAt: userData.joinedAt,
          isBot: userData.isBot
        } : {
          telegramId: userId,
          firstName: "Noma'lum",
          lastName: "foydalanuvchi",
          joinedAt: null,
          isBot: false
        },
        invitations: detailedInvites
      });
    } catch (error) {
      console.error("Error fetching user details in server:", error);
      res.status(500).json({ error: "Failed to fetch user details" });
    }
  });

  app.post("/api/contests", async (req, res) => {
    try {
      const contest = req.body;
      const docRef = await db.collection("contests").add({
        ...contest,
        isActive: true,
        createdAt: new Date().toISOString()
      });
      res.json({ id: docRef.id });
    } catch (error) {
      res.status(500).json({ error: "Failed to create contest" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
