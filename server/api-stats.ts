import { Router } from "express";
import { checkDatabase } from "./db.js";
import { bot, checkAndRecordLeavesForGroup } from "./bot.js";
import { getVerifiedChats } from "./utils.js";

const router = Router();

// Retrieve list of verified groups
router.get("/groups", async (req, res) => {
  try {
    const verifiedChatIds = getVerifiedChats(req);
    if (verifiedChatIds.length === 0) {
      return res.json([]);
    }

    const dbClient = checkDatabase();
    const { data: groups, error } = await dbClient
      .from("groups")
      .select("*")
      .in("id", verifiedChatIds)
      .order("title", { ascending: true });
      
    if (error) throw error;
    res.json(groups || []);
  } catch (error: any) {
    console.error("Error getting groups:", error);
    res.status(500).json({ error: error.message || "Failed to fetch groups" });
  }
});

// Retrieve aggregated invitational statistics
router.get("/stats", async (req, res) => {
  try {
    const { chatId } = req.query;
    const verifiedChatIds = getVerifiedChats(req);

    if (verifiedChatIds.length === 0) {
      return res.status(401).json({ error: "Siz hali guruh admini sifatida tizimga kirmagansiz!" });
    }

    if (chatId && !verifiedChatIds.includes(chatId as string)) {
      return res.status(403).json({ error: "Ushbu guruh ma'lumotlarini ko'rishga ruxsatingiz yo'q!" });
    }

    // Passive leaves calculation: Trigger background retroactive leaves sync
    if (chatId && bot && typeof checkAndRecordLeavesForGroup === "function") {
      checkAndRecordLeavesForGroup(bot.telegram, chatId as string).catch(err => {
        console.error("Background leaves check failed:", err);
      });
    }

    const dbClient = checkDatabase();
    
    let invitesCountQuery = dbClient.from("invites").select("*", { count: "exact", head: true });
    let leavesCountQuery = dbClient.from("leaves").select("*", { count: "exact", head: true });
    
    if (chatId) {
      invitesCountQuery = invitesCountQuery.eq("chat_id", chatId);
      leavesCountQuery = leavesCountQuery.eq("chat_id", chatId);
    } else {
      invitesCountQuery = invitesCountQuery.in("chat_id", verifiedChatIds);
      leavesCountQuery = leavesCountQuery.in("chat_id", verifiedChatIds);
    }

    const [invitesCountRes, leavesCountRes] = await Promise.all([
      invitesCountQuery,
      leavesCountQuery
    ]);
    
    let totalMembersCount = 0;
    if (chatId) {
      if (bot) {
        try {
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
        .from("memberships")
        .select("*", { count: "exact", head: true })
        .in("chat_id", verifiedChatIds);
      totalMembersCount = count || 0;
    }

    let invitesListQuery = dbClient.from("invites").select("*");
    let leavesListQuery = dbClient.from("leaves").select("*");
    if (chatId) {
      invitesListQuery = invitesListQuery.eq("chat_id", chatId);
      leavesListQuery = leavesListQuery.eq("chat_id", chatId);
    } else {
      invitesListQuery = invitesListQuery.in("chat_id", verifiedChatIds);
      leavesListQuery = leavesListQuery.in("chat_id", verifiedChatIds);
    }
    const [invitesListRes, leavesListRes] = await Promise.all([invitesListQuery, leavesListQuery]);

    let membersListRes;
    if (chatId) {
      membersListRes = await dbClient
        .from("memberships")
        .select("*")
        .eq("chat_id", chatId)
        .order("joined_at", { ascending: false });
    } else {
      membersListRes = await dbClient
        .from("memberships")
        .select("*")
        .in("chat_id", verifiedChatIds)
        .order("joined_at", { ascending: false });
    }

    const uniqueUserIds = new Set<string>();
    
    if (membersListRes.data) {
      membersListRes.data.forEach((m: any) => {
        if (m.telegram_id) uniqueUserIds.add(m.telegram_id);
      });
    }
    if (invitesListRes.data) {
      invitesListRes.data.forEach((inv: any) => {
        if (inv.inviter_id) uniqueUserIds.add(inv.inviter_id);
        if (inv.invitee_id) uniqueUserIds.add(inv.invitee_id);
      });
    }
    if (leavesListRes.data) {
      leavesListRes.data.forEach((l: any) => {
        if (l.telegram_id) uniqueUserIds.add(l.telegram_id);
      });
    }

    const userIdList = Array.from(uniqueUserIds);
    const userMap: Record<string, { first_name: string; last_name: string; username: string, joined_at: string }> = {};

    if (userIdList.length > 0) {
      const { data: usersData } = await dbClient
        .from("users")
        .select("telegram_id, username, first_name, last_name, joined_at")
        .in("telegram_id", userIdList);

      if (usersData) {
        usersData.forEach((u: any) => {
          userMap[u.telegram_id] = {
            first_name: u.first_name || "",
            last_name: u.last_name || "",
            username: u.username || "",
            joined_at: u.joined_at || ""
          };
        });
      }
    }

    const resInvites = (invitesListRes.data || []).map((inv: any) => {
      const inviter = userMap[inv.inviter_id];
      const invitee = userMap[inv.invitee_id];
      return {
        inviterId: inv.inviter_id,
        inviterName: inviter ? `${inviter.first_name} ${inviter.last_name}`.trim() : "Noma'lum foydalanuvchi",
        inviterUsername: inviter?.username || "",
        inviteeId: inv.invitee_id,
        inviteeName: invitee ? `${invitee.first_name} ${invitee.last_name}`.trim() : "Noma'lum foydalanuvchi",
        inviteeUsername: invitee?.username || "",
        chatId: inv.chat_id,
        timestamp: inv.timestamp,
        contestId: inv.contest_id
      };
    });

    const resLeaves = (leavesListRes.data || []).map((l: any) => {
      const leaver = userMap[l.telegram_id];
      return {
        telegramId: l.telegram_id,
        name: leaver ? `${leaver.first_name} ${leaver.last_name}`.trim() : "Noma'lum foydalanuvchi",
        username: leaver?.username || "",
        chatId: l.chat_id,
        timestamp: l.timestamp
      };
    });

    const resMembers = (membersListRes.data || []).map((m: any) => {
      const u = userMap[m.telegram_id];
      return {
        telegramId: m.telegram_id,
        username: m.username || u?.username || "",
        firstName: m.first_name || u?.first_name || "A'zo",
        lastName: m.last_name || u?.last_name || "",
        joinedAt: m.joined_at || u?.joined_at || ""
      };
    });

    res.json({
      totalInvites: invitesCountRes.count || invitesListRes.data?.length || 0,
      totalLeaves: leavesCountRes.count || leavesListRes.data?.length || 0,
      totalMembers: totalMembersCount,
      invites: resInvites,
      leaves: resLeaves,
      members: resMembers
    });
  } catch (error: any) {
    console.error("Error getting stats:", error);
    res.status(500).json({ error: error.message || "Failed to fetch stats" });
  }
});

// Retrieve top inviters leaderboard
router.get("/leaderboard", async (req, res) => {
  try {
    const { chatId } = req.query;
    const verifiedChatIds = getVerifiedChats(req);

    if (verifiedChatIds.length === 0) {
      return res.status(401).json({ error: "Siz hali guruh admini sifatida tizimga kirmagansiz!" });
    }

    if (chatId && !verifiedChatIds.includes(chatId as string)) {
      return res.status(403).json({ error: "Ushbu guruh ma'lumotlarini ko'rishga ruxsatingiz yo'q!" });
    }

    const dbClient = checkDatabase();
    
    let invitesQuery = dbClient.from("invites").select("inviter_id");
    if (chatId) {
      invitesQuery = invitesQuery.eq("chat_id", chatId);
    } else {
      invitesQuery = invitesQuery.in("chat_id", verifiedChatIds);
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

// Retrieve highly granular stats for a drilldown user
router.get("/users/:id/details", async (req, res) => {
  try {
    const userId = req.params.id;
    const { chatId } = req.query;
    const verifiedChatIds = getVerifiedChats(req);

    if (verifiedChatIds.length === 0) {
      return res.status(401).json({ error: "Siz hali guruh admini sifatida tizimga kirmagansiz!" });
    }

    if (chatId && !verifiedChatIds.includes(chatId as string)) {
      return res.status(403).json({ error: "Ushbu guruh ma'lumotlarini ko'rishga ruxsatingiz yo'q!" });
    }

    const dbClient = checkDatabase();
    
    const { data: userData } = await dbClient
      .from("users")
      .select("*")
      .eq("telegram_id", userId)
      .single();
    
    let invitesQuery = dbClient.from("invites").select("*").eq("inviter_id", userId);
    if (chatId) {
      invitesQuery = invitesQuery.eq("chat_id", chatId);
    } else {
      invitesQuery = invitesQuery.in("chat_id", verifiedChatIds);
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

// Create active team contest
router.post("/contests", async (req, res) => {
  try {
    const contest = req.body;
    const verifiedChatIds = getVerifiedChats(req);

    if (verifiedChatIds.length === 0) {
      return res.status(401).json({ error: "Siz hali guruh admini sifatida tizimga kirmagansiz!" });
    }

    if (!contest.chatId || !verifiedChatIds.includes(contest.chatId)) {
      return res.status(403).json({ error: "Ushbu guruhda konkurs yaratish ruxsati berilmagan!" });
    }

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

// Retrieve active/past contest setups
router.get("/contests", async (req, res) => {
  try {
    const { chatId } = req.query;
    const verifiedChatIds = getVerifiedChats(req);

    if (verifiedChatIds.length === 0) {
      return res.status(401).json({ error: "Siz hali guruh admini sifatida tizimga kirmagansiz!" });
    }

    if (chatId && !verifiedChatIds.includes(chatId as string)) {
      return res.status(403).json({ error: "Ushbu guruh konkurslarini ko'rishga ruxsatingiz yo'q!" });
    }

    const dbClient = checkDatabase();
    let contestsQuery = dbClient.from("contests").select("*");
    if (chatId) {
      contestsQuery = contestsQuery.eq("chat_id", chatId);
    } else {
      contestsQuery = contestsQuery.in("chat_id", verifiedChatIds);
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

// Fetch group chat suspicious external link logs
router.get("/links", async (req, res) => {
  try {
    const { chatId } = req.query;
    const verifiedChatIds = getVerifiedChats(req);

    if (verifiedChatIds.length === 0) {
      return res.status(401).json({ error: "Siz hali guruh admini sifatida tizimga kirmagansiz!" });
    }

    if (chatId && !verifiedChatIds.includes(chatId as string)) {
      return res.status(403).json({ error: "Ushbu guruh havolalarini ko'rishga ruxsatingiz yo'q!" });
    }

    const dbClient = checkDatabase();
    let linkLogQuery = dbClient
      .from("link_logs")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(30);

    if (chatId) {
      linkLogQuery = linkLogQuery.eq("chat_id", chatId);
    } else {
      linkLogQuery = linkLogQuery.in("chat_id", verifiedChatIds);
    }

    const { data: links, error } = await linkLogQuery;
    if (error) throw error;
    
    // Filter out internal system verification logs
    const filteredLinks = (links || []).filter((l: any) => l.sender_username !== "AUTH_CODE");
    res.json(filteredLinks);
  } catch (error: any) {
    console.error("Error fetching links:", error);
    res.status(500).json({ error: error.message || "Failed to fetch link logs" });
  }
});

export default router;
