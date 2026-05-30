import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { Telegraf } from "telegraf";
import { initializeApp, getApps } from "firebase/app";
import { 
  getFirestore as clientGetFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  deleteDoc, 
  query, 
  where,
  QueryConstraint
} from "firebase/firestore";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load firebase config
let firebaseConfig: any = null;
try {
  const configPath = path.join(__dirname, "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
  }
} catch (e) {
  console.error("Failed to load firebase-applet-config.json:", e);
}

// Compatibility layer to swap Node.js Admin SDK API with Web SDK authenticated by API key
class DocumentReferenceCompat {
  constructor(private firestore: any, private path: string, private docId: string) {}

  async set(data: any, options?: { merge?: boolean }) {
    const docRef = doc(this.firestore, this.path, this.docId);
    return setDoc(docRef, data, options || {});
  }

  async get() {
    const docRef = doc(this.firestore, this.path, this.docId);
    const snap = await getDoc(docRef);
    return {
      exists: snap.exists(),
      id: snap.id,
      data: () => snap.data()
    };
  }

  async delete() {
    const docRef = doc(this.firestore, this.path, this.docId);
    return deleteDoc(docRef);
  }
}

class CollectionReferenceCompat {
  private constraints: QueryConstraint[] = [];

  constructor(private firestore: any, private path: string) {}

  where(field: string, op: any, value: any) {
    const next = new CollectionReferenceCompat(this.firestore, this.path);
    next.constraints = [...this.constraints, where(field, op, value)];
    return next;
  }

  doc(id: string) {
    return new DocumentReferenceCompat(this.firestore, this.path, id);
  }

  async add(data: any) {
    const colRef = collection(this.firestore, this.path);
    const docRef = await addDoc(colRef, data);
    return { id: docRef.id };
  }

  async get() {
    const colRef = collection(this.firestore, this.path);
    const q = this.constraints.length > 0 ? query(colRef, ...this.constraints) : colRef;
    const snap = await getDocs(q);
    
    const docs = snap.docs.map(snapDoc => ({
      id: snapDoc.id,
      exists: snapDoc.exists(),
      data: () => snapDoc.data()
    }));

    return {
      empty: snap.empty,
      size: snap.size,
      docs
    };
  }
}

class FirestoreCompat {
  constructor(private firestore: any) {}

  collection(path: string) {
    return new CollectionReferenceCompat(this.firestore, path);
  }
}

// Initialize Firebase Web SDK instead of Admin SDK to resolve authorization issues in AI Studio preview
let firebaseApp;
if (!getApps().length) {
  firebaseApp = initializeApp(firebaseConfig);
} else {
  firebaseApp = getApps()[0];
}

const rawDb = clientGetFirestore(firebaseApp, firebaseConfig?.firestoreDatabaseId);
const db = new FirestoreCompat(rawDb);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  console.warn("TELEGRAM_BOT_TOKEN is not set. Bot features will be disabled.");
}

const bot = BOT_TOKEN ? new Telegraf(BOT_TOKEN) : null;

// Bot Logic
if (bot) {
  // Middleware to register groups and delete system messages/commands
  bot.on("message", async (ctx, next) => {
    const msg = ctx.message as any;
    
    // Register the group if message is in a group/supergroup/channel
    if (ctx.chat && (ctx.chat.type === "group" || ctx.chat.type === "supergroup" || (ctx.chat.type as any) === "channel")) {
      const chatId = ctx.chat.id.toString();
      const chatTitle = (ctx.chat as any).title || "Guruh nomi topilmadi";
      try {
        await db.collection("groups").doc(chatId).set({
          id: chatId,
          title: chatTitle,
          lastActiveAt: new Date().toISOString()
        }, { merge: true });
      } catch (e) {
        console.error("Error storing group:", e);
      }
    }
    
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
        try {
          const member = await ctx.getChatMember(ctx.from.id);
          const isAdmin = ["creator", "administrator"].includes(member.status);
          
          if (!isAdmin) {
            await ctx.deleteMessage();
            await ctx.reply(`Hurmatli ${ctx.from.first_name}, guruhda tashqi havolalar ulashish taqiqlangan!`, {
              reply_parameters: { message_id: ctx.message.message_id }
            });
          }
        } catch (e) {}
      }
    }

    return next();
  });

  // Track new members and invitations
  bot.on("new_chat_members", async (ctx) => {
    const inviterId = ctx.from.id.toString();
    const newMembers = (ctx.message as any).new_chat_members;
    const chatId = ctx.chat.id.toString();
    const chatTitle = (ctx.chat as any).title || "Guruh";

    // Register active group
    try {
      await db.collection("groups").doc(chatId).set({
        id: chatId,
        title: chatTitle,
        lastActiveAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {}

    if (newMembers && Array.isArray(newMembers)) {
      for (const member of newMembers) {
        const inviteeId = member.id.toString();
        
        try {
          // Save global user info
          await db.collection("users").doc(inviteeId).set({
            telegramId: inviteeId,
            username: member.username || "",
            firstName: member.first_name,
            lastName: member.last_name || "",
            joinedAt: new Date().toISOString(),
            isBot: member.is_bot
          }, { merge: true });

          // Record group membership
          await db.collection("memberships").doc(`${chatId}_${inviteeId}`).set({
            chatId,
            telegramId: inviteeId,
            username: member.username || "",
            firstName: member.first_name,
            lastName: member.last_name || "",
            joinedAt: new Date().toISOString()
          }, { merge: true });

          // Log invite if it's not the user joining themselves
          if (inviterId !== inviteeId) {
            // Find active contest in this specific group
            const activeContest = await db.collection("contests")
              .where("chatId", "==", chatId)
              .where("isActive", "==", true)
              .get();

            let contestId = null;
            if (!activeContest.empty) {
              // Get the contest closest/matching dates
              const nowStr = new Date().toISOString();
              const matching = activeContest.docs.find(doc => {
                const data = doc.data();
                return data.startDate <= nowStr && data.endDate >= nowStr;
              });
              if (matching) contestId = matching.id;
            }

            await db.collection("invites").add({
              inviterId,
              inviteeId,
              chatId,
              timestamp: new Date().toISOString(),
              contestId
            });
          }
        } catch (err) {
          console.error("Error on new_chat_member handle:", err);
        }
      }
    }
  });

  // Track leaves
  bot.on("left_chat_member", async (ctx) => {
    const member = ctx.message.left_chat_member;
    const chatId = ctx.chat.id.toString();
    
    try {
      // Remove group membership
      await db.collection("memberships").doc(`${chatId}_${member.id}`).delete();
      
      await db.collection("leaves").add({
        telegramId: member.id.toString(),
        chatId,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error on left_chat_member handle:", err);
    }
  });

  // #contest command
  bot.hears(/#contest/i, async (ctx) => {
    const chatId = ctx.chat.id.toString();
    const activeContest = await db.collection("contests")
      .where("chatId", "==", chatId)
      .where("isActive", "==", true)
      .get();

    if (activeContest.empty) {
      return ctx.reply("Bu guruhda hozirda faol konkurs mavjud emas.");
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
  app.get("/api/groups", async (req, res) => {
    try {
      const groups = await db.collection("groups").get();
      const groupsData = groups.docs.map(doc => doc.data());
      res.json(groupsData);
    } catch (error) {
      console.error("Error getting groups:", error);
      res.status(500).json({ error: "Failed to fetch groups" });
    }
  });

  app.get("/api/stats", async (req, res) => {
    try {
      const { chatId } = req.query;
      
      let invitesQuery: any = db.collection("invites");
      let leavesQuery: any = db.collection("leaves");
      let membershipsQuery: any = db.collection("memberships");
      
      if (chatId) {
        invitesQuery = invitesQuery.where("chatId", "==", chatId);
        leavesQuery = leavesQuery.where("chatId", "==", chatId);
        membershipsQuery = membershipsQuery.where("chatId", "==", chatId);
      }

      const [invites, leaves, memberships] = await Promise.all([
        invitesQuery.get(),
        leavesQuery.get(),
        membershipsQuery.get()
      ]);
      
      const inviteData = invites.docs.map((d: any) => d.data());
      const leaveData = leaves.docs.map((d: any) => d.data());
      
      let totalMembersCount = 0;
      if (chatId) {
        totalMembersCount = memberships.size;
      } else {
        const users = await db.collection("users").get();
        totalMembersCount = users.size;
      }
      
      res.json({
        totalInvites: invites.size,
        totalLeaves: leaves.size,
        totalMembers: totalMembersCount,
        invites: inviteData,
        leaves: leaveData
      });
    } catch (error) {
      console.error("Error getting stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.get("/api/leaderboard", async (req, res) => {
    try {
      const { chatId } = req.query;
      
      let invitesQuery: any = db.collection("invites");
      if (chatId) {
        invitesQuery = invitesQuery.where("chatId", "==", chatId);
      }

      const invites = await invitesQuery.get();
      const counts: Record<string, number> = {};
      
      invites.forEach((doc: any) => {
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
      console.error("Error getting leaderboard:", error);
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  app.get("/api/users/:id/details", async (req, res) => {
    try {
      const userId = req.params.id;
      const { chatId } = req.query;
      
      // Get the user's profile details
      const userDoc = await db.collection("users").doc(userId).get();
      const userData = userDoc.exists ? userDoc.data() : null;
      
      // Get invites made by this user (optionally in this specific group)
      let invitesQuery: any = db.collection("invites").where("inviterId", "==", userId);
      if (chatId) {
        invitesQuery = invitesQuery.where("chatId", "==", chatId);
      }
      const invitesSnapshot = await invitesQuery.get();
      
      const invitesData = invitesSnapshot.docs.map((doc: any) => doc.data());
      // Sort in memory to avoid indexing issues in Firestore
      invitesData.sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp));
      
      // Fetch user names for each invitee
      const detailedInvites = await Promise.all(
        invitesData.map(async (invite: any) => {
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
      console.error("Error setting up contest:", error);
      res.status(500).json({ error: "Failed to create contest" });
    }
  });

  app.get("/api/contests", async (req, res) => {
    try {
      const { chatId } = req.query;
      let contestsQuery: any = db.collection("contests");
      if (chatId) {
        contestsQuery = contestsQuery.where("chatId", "==", chatId);
      }
      const contestsSnapshot = await contestsQuery.get();
      const contestsList = contestsSnapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      }));
      res.json(contestsList);
    } catch (error) {
      console.error("Error setting up context:", error);
      res.status(500).json({ error: "Failed to fetch contests" });
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
