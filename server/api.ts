import { Router } from "express";
import { checkDatabase } from "./db.js";
import { bot } from "./bot.js";

const router = Router();

// API Routes
router.get("/groups", async (req, res) => {
  try {
    const dbClient = checkDatabase();
    const { data: groups, error } = await dbClient
      .from("groups")
      .select("*")
      .order("title", { ascending: true });
      
    if (error) throw error;
    res.json(groups || []);
  } catch (error: any) {
    console.error("Error getting groups:", error);
    res.status(500).json({ error: error.message || "Failed to fetch groups" });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const { chatId } = req.query;
    const dbClient = checkDatabase();
    
    let invitesCountQuery = dbClient.from("invites").select("*", { count: "exact", head: true });
    let leavesCountQuery = dbClient.from("leaves").select("*", { count: "exact", head: true });
    
    if (chatId) {
      invitesCountQuery = invitesCountQuery.eq("chat_id", chatId);
      leavesCountQuery = leavesCountQuery.eq("chat_id", chatId);
    }

    const [invitesCountRes, leavesCountRes] = await Promise.all([
      invitesCountQuery,
      leavesCountQuery
    ]);
    
    let totalMembersCount = 0;
    if (chatId) {
      if (bot) {
        try {
          // Get real-time exact member count from Telegram Bot API
          totalMembersCount = await bot.telegram.getChatMembersCount(chatId as string);
        } catch (botErr) {
          console.warn("Could not fetch member count from Telegram API, falling back to db:", botErr);
          const { count } = await dbClient
            .from("memberships")
            .select("*", { count: "exact", head: true })
            .eq("chat_id", chatId);
          totalMembersCount = count || 0;
        }
      } else {
        const { count } = await dbClient
          .from("memberships")
          .select("*", { count: "exact", head: true })
          .eq("chat_id", chatId);
        totalMembersCount = count || 0;
      }
    } else {
      const { count } = await dbClient
        .from("users")
        .select("*", { count: "exact", head: true });
      totalMembersCount = count || 0;
    }

    let invitesListQuery = dbClient.from("invites").select("*");
    let leavesListQuery = dbClient.from("leaves").select("*");
    if (chatId) {
      invitesListQuery = invitesListQuery.eq("chat_id", chatId);
      leavesListQuery = leavesListQuery.eq("chat_id", chatId);
    }
    const [invitesListRes, leavesListRes] = await Promise.all([invitesListQuery, leavesListQuery]);

    res.json({
      totalInvites: invitesCountRes.count || invitesListRes.data?.length || 0,
      totalLeaves: leavesCountRes.count || leavesListRes.data?.length || 0,
      totalMembers: totalMembersCount,
      invites: (invitesListRes.data || []).map((inv: any) => ({
        inviterId: inv.inviter_id,
        inviteeId: inv.invitee_id,
        chatId: inv.chat_id,
        timestamp: inv.timestamp,
        contestId: inv.contest_id
      })),
      leaves: (leavesListRes.data || []).map((l: any) => ({
        telegramId: l.telegram_id,
        chatId: l.chat_id,
        timestamp: l.timestamp
      }))
    });
  } catch (error: any) {
    console.error("Error getting stats:", error);
    res.status(500).json({ error: error.message || "Failed to fetch stats" });
  }
});

router.get("/leaderboard", async (req, res) => {
  try {
    const { chatId } = req.query;
    const dbClient = checkDatabase();
    
    let invitesQuery = dbClient.from("invites").select("inviter_id");
    if (chatId) {
      invitesQuery = invitesQuery.eq("chat_id", chatId);
    }

    const { data: invites, error } = await invitesQuery;
    if (error) throw error;

    const counts: Record<string, number> = {};
    if (invites) {
      invites.forEach((inv: any) => {
        counts[inv.inviter_id] = (counts[inv.inviter_id] || 0) + 1;
      });
    }

    const leaderboard = await Promise.all(
      Object.entries(counts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(async ([id, count]) => {
          const { data: userData } = await dbClient
            .from("users")
            .select("*")
            .eq("telegram_id", id)
            .single();
          return {
            id,
            count,
            name: userData ? `${userData.first_name} ${userData.last_name || ""}`.trim() : "Noma'lum foydalanuvchi"
          };
        })
    );

    res.json(leaderboard);
  } catch (error: any) {
    console.error("Error getting leaderboard:", error);
    res.status(500).json({ error: error.message || "Failed to fetch leaderboard" });
  }
});

router.get("/users/:id/details", async (req, res) => {
  try {
    const userId = req.params.id;
    const { chatId } = req.query;
    const dbClient = checkDatabase();
    
    const { data: userData } = await dbClient
      .from("users")
      .select("*")
      .eq("telegram_id", userId)
      .single();
    
    let invitesQuery = dbClient.from("invites").select("*").eq("inviter_id", userId);
    if (chatId) {
      invitesQuery = invitesQuery.eq("chat_id", chatId);
    }
    const { data: invites, error } = await invitesQuery;
    if (error) throw error;
    
    const detailedInvites = [];
    if (invites) {
      invites.sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp));
      for (const inv of invites) {
        const { data: inviteeData } = await dbClient
          .from("users")
          .select("*")
          .eq("telegram_id", inv.invitee_id)
          .single();
        detailedInvites.push({
          inviterId: inv.inviter_id,
          inviteeId: inv.invitee_id,
          chatId: inv.chat_id,
          timestamp: inv.timestamp,
          contestId: inv.contest_id,
          inviteeName: inviteeData ? `${inviteeData.first_name} ${inviteeData.last_name || ""}`.trim() : "Noma'lum foydalanuvchi",
          inviteeUsername: inviteeData ? inviteeData.username : "",
          inviteeJoinedAt: inviteeData ? inviteeData.joined_at : ""
        });
      }
    }
    
    res.json({
      user: userData ? {
        telegramId: userData.telegram_id,
        username: userData.username,
        firstName: userData.first_name,
        lastName: userData.last_name,
        joinedAt: userData.joined_at,
        isBot: userData.is_bot
      } : {
        telegramId: userId,
        firstName: "Noma'lum",
        lastName: "foydalanuvchi",
        joinedAt: null,
        isBot: false
      },
      invitations: detailedInvites
    });
  } catch (error: any) {
    console.error("Error fetching user details in server:", error);
    res.status(500).json({ error: error.message || "Failed to fetch user details" });
  }
});

router.post("/contests", async (req, res) => {
  try {
    const contest = req.body;
    const dbClient = checkDatabase();
    const { data, error } = await dbClient
      .from("contests")
      .insert({
        chat_id: contest.chatId,
        title: contest.title,
        description: contest.description,
        start_date: contest.startDate,
        end_date: contest.endDate,
        prizes: contest.prizes,
        image_url: contest.imageUrl,
        is_active: true,
        created_at: new Date().toISOString()
      })
      .select("id")
      .single();
      
    if (error) throw error;
    res.json({ id: data?.id });
  } catch (error: any) {
    console.error("Error setting up contest:", error);
    res.status(500).json({ error: error.message || "Failed to create contest" });
  }
});

router.get("/contests", async (req, res) => {
  try {
    const { chatId } = req.query;
    const dbClient = checkDatabase();
    let contestsQuery = dbClient.from("contests").select("*");
    if (chatId) {
      contestsQuery = contestsQuery.eq("chat_id", chatId);
    }
    const { data: contests, error } = await contestsQuery;
    if (error) throw error;
    
    res.json((contests || []).map((c: any) => ({
      id: c.id,
      chatId: c.chat_id,
      title: c.title,
      description: c.description,
      startDate: c.start_date,
      endDate: c.end_date,
      prizes: c.prizes,
      imageUrl: c.image_url,
      isActive: c.is_active,
      createdAt: c.created_at
    })));
  } catch (error: any) {
    console.error("Error fetching contests:", error);
    res.status(500).json({ error: error.message || "Failed to fetch contests" });
  }
});

// Fetch link activity logs
router.get("/links", async (req, res) => {
  try {
    const { chatId } = req.query;
    const dbClient = checkDatabase();
    let linkLogQuery = dbClient
      .from("link_logs")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(30);

    if (chatId) {
      linkLogQuery = linkLogQuery.eq("chat_id", chatId);
    }

    const { data: links, error } = await linkLogQuery;
    if (error) throw error;
    res.json(links || []);
  } catch (error: any) {
    console.error("Error fetching links:", error);
    res.status(500).json({ error: error.message || "Failed to fetch link logs" });
  }
});

export default router;
