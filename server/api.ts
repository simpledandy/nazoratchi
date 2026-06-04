import { Router } from "express";
import { checkDatabase } from "./db.js";
import { bot } from "./bot.js";

const router = Router();

// Helper to extract verified chat IDs list from headers
function getVerifiedChats(req: any): string[] {
  const verifiedHeader = req.headers["x-verified-chats"] as string;
  if (!verifiedHeader) return [];
  return verifiedHeader.split(",").filter(Boolean);
}

// API Routes

// Verification endpoint for 6-digit codes
router.post("/auth/verify", async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ valid: false, error: "Tasdiqlash kodi kiritilmagan!" });
    }
    
    const { verifyCode } = await import("./auth-store.js");
    const verified = await verifyCode(code);
    
    if (!verified) {
      return res.status(400).json({ valid: false, error: "Xato yoki muddati o'tgan kod kiritildi!" });
    }
    
    res.json({
      valid: true,
      chatId: verified.chatId,
      chatTitle: verified.chatTitle
    });
  } catch (error: any) {
    console.error("Auth verify error:", error);
    res.status(500).json({ valid: false, error: error.message || "Tizim xatoligi yuz berdi" });
  }
});

router.get("/config-status", (req, res) => {
  const supabaseConfigured = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_ANON_KEY;
  const telegramTokenConfigured = !!process.env.TELEGRAM_BOT_TOKEN;
  const botInitialized = bot !== null;
  
  let statusText = "Bot faol holatda";
  let statusCode = "SUCCESS";
  
  if (!supabaseConfigured && !telegramTokenConfigured) {
    statusText = "Bot va Baza sozlanmagan (Demo rejim)";
    statusCode = "DEMO_ALL_MISSING";
  } else if (!supabaseConfigured) {
    statusText = "Baza sozlanmagan (Supabase ulanmagan)";
    statusCode = "SUPABASE_MISSING";
  } else if (!telegramTokenConfigured) {
    statusText = "Bot token moduli yo'q (Faqat baza faol)";
    statusCode = "TELEGRAM_MISSING";
  } else if (!botInitialized) {
    statusText = "Bot ishga tushmagan (Tokenni tekshiring)";
    statusCode = "BOT_ERROR";
  } else {
    statusText = "Bot faol holatda (Baza bog'langan)";
    statusCode = "ACTIVE";
  }

  res.json({
    supabaseConfigured,
    telegramTokenConfigured,
    botInitialized,
    statusText,
    statusCode
  });
});

router.get("/groups", async (req, res) => {
  try {
    const verifiedChatIds = getVerifiedChats(req);
    if (verifiedChatIds.length === 0) {
      // Return empty if not verified yet
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

    // Retrieve respective members (either via memberships of a group, or global users if no chatId)
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

    // Build unique set of involved User IDs to resolve all names in a single query
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

// Fetch link activity logs
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

// ==========================================
// COSMETICS SALES & TRANSACTIONS ENDPOINTS
// ==========================================

// In-Memory fallback store for DEMO MODE when Supabase is not configured
let demoCustomers: any[] = [
  { id: "cust-1", name: "Dilnoza Aliyeva", phone: "+998 90 123 45 67", telegram_username: "dilnoza_la", telegram_id: "12345", chat_id: "", notes: "VIP Doimiy mijoz, Namlantiruvchi krem yoqtiradi.", created_at: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString() },
  { id: "cust-2", name: "Kamola Umarova", phone: "+998 94 987 65 43", telegram_username: "kamola_u", telegram_id: "", chat_id: "", notes: "Ikra va vitamin zardoblari buyurtmachisi.", created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString() },
  { id: "cust-3", name: "Shahnoza Karitova", phone: "+998 93 456 11 22", telegram_username: "shahnozu", telegram_id: "782910", chat_id: "", notes: "Telegram guruhidan kelgan mijoz.", created_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString() }
];

let demoOrders: any[] = [
  {
    id: "ord-1",
    customer_id: "cust-1",
    chat_id: "",
    sale_date: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
    total_amount: 185000,
    total_points: 13.2,
    status: "partially_paid",
    notes: "Alohida chegirma bilan kelishildi.",
    created_at: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString()
  },
  {
    id: "ord-2",
    customer_id: "cust-2",
    chat_id: "",
    sale_date: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
    total_amount: 125000,
    total_points: 9.0,
    status: "paid",
    notes: "Yetkazib berish vaqtida uchrashildi.",
    created_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString()
  },
  {
    id: "ord-3",
    customer_id: "cust-3",
    chat_id: "",
    sale_date: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
    total_amount: 320000,
    total_points: 24.0,
    status: "unpaid",
    notes: "Oylik olganda to'lashini aytdi.",
    created_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString()
  }
];

let demoOrderItems: any[] = [
  { id: "item-1", order_id: "ord-1", product_code: "1033", product_name: "Vitamin C Serum", quantity: 1, unit_price: 185000, points: 13.2 },
  { id: "item-2", order_id: "ord-2", product_code: "1034", product_name: "Snail extract cream", quantity: 1, unit_price: 125000, points: 9.0 },
  { id: "item-3", order_id: "ord-3", product_code: "1110", product_name: "Hyaluronic Acid essence", quantity: 1, unit_price: 150000, points: 12.0 },
  { id: "item-4", order_id: "ord-3", product_code: "1110", product_name: "Hyaluronic Acid essence", quantity: 1, unit_price: 170000, points: 12.0 }
];

let demoPayments: any[] = [
  { id: "pay-1", customer_id: "cust-1", order_id: "ord-1", amount: 100000, payment_date: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(), payment_method: "click", notes: "Karta orqali birinchi bo'nak to'lovi.", created_at: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString() },
  { id: "pay-2", customer_id: "cust-2", order_id: "ord-2", amount: 125000, payment_date: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(), payment_method: "cash", notes: "Naqd pul bilan to'liq yopildi.", created_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString() }
];

// Reusable function to dynamically resolve a customer's total sales, payments and outstanding debt
function computeOutstandingStatuses(orders: any[], payments: any[]) {
  orders.forEach(order => {
    const orderPays = payments.filter(p => p.order_id === order.id);
    const paidSum = orderPays.reduce((acc, p) => acc + p.amount, 0);
    if (paidSum >= order.total_amount) {
      order.status = "paid";
    } else if (paidSum > 0) {
      order.status = "partially_paid";
    } else {
      order.status = "unpaid";
    }
  });
}

// 1. GET Customers List
router.get("/sales-customers", async (req, res) => {
  try {
    const { chatId } = req.query;
    const isSupabaseConfigured = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_ANON_KEY;

    if (isSupabaseConfigured) {
      const dbClient = checkDatabase();
      let query = dbClient.from("sales_customers").select("*").order("name", { ascending: true });
      if (chatId) {
        query = query.eq("chat_id", chatId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return res.json(data || []);
    } else {
      // Demo Filter by group chat if requested
      const list = chatId ? demoCustomers.filter(c => c.chat_id === chatId) : demoCustomers;
      return res.json(list);
    }
  } catch (error: any) {
    console.error("Error fetching sales customers:", error);
    res.status(500).json({ error: error.message || "Xatolik yuz berdi" });
  }
});

// 2. POST Add Customer
router.post("/sales-customers", async (req, res) => {
  try {
    const isSupabaseConfigured = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_ANON_KEY;
    const { name, phone, telegramId, telegramUsername, chatId, notes } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Mijoz ismi kiritilishi shart!" });
    }

    if (isSupabaseConfigured) {
      const dbClient = checkDatabase();
      const { data, error } = await dbClient
        .from("sales_customers")
        .insert({
          name: name.trim(),
          phone: phone?.trim() || null,
          telegram_id: telegramId || null,
          telegram_username: telegramUsername?.trim() || null,
          chat_id: chatId || null,
          notes: notes?.trim() || null,
          created_at: new Date().toISOString()
        })
        .select("*")
        .single();

      if (error) throw error;
      return res.json(data);
    } else {
      // Demo store insert
      const newCust = {
        id: "cust-" + Date.now(),
        name: name.trim(),
        phone: phone?.trim() || "",
        telegram_username: telegramUsername?.trim() || "",
        telegram_id: telegramId || "",
        chat_id: chatId || "",
        notes: notes?.trim() || "",
        created_at: new Date().toISOString()
      };
      demoCustomers.push(newCust);
      return res.json(newCust);
    }
  } catch (error: any) {
    console.error("Error creating sales customer:", error);
    res.status(500).json({ error: error.message || "Xatolik yuz berdi" });
  }
});

// 3. GET Sales Orders List (including their items & customer info)
router.get("/sales-orders", async (req, res) => {
  try {
    const { chatId } = req.query;
    const isSupabaseConfigured = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_ANON_KEY;

    if (isSupabaseConfigured) {
      const dbClient = checkDatabase();
      // Fetch orders
      let query = dbClient.from("sales_orders").select("*, sales_customers(*)");
      if (chatId) {
        query = query.eq("chat_id", chatId);
      }
      const { data: orders, error: oError } = await query.order("sale_date", { ascending: false });
      if (oError) throw oError;

      // For each order, fetch items and payments
      const orderIds = (orders || []).map(o => o.id);
      let itemsData: any[] = [];
      let paymentsData: any[] = [];

      if (orderIds.length > 0) {
        const { data: items, error: iError } = await dbClient
          .from("sales_order_items")
          .select("*")
          .in("order_id", orderIds);
        if (iError) throw iError;
        itemsData = items || [];

        const { data: payments, error: pError } = await dbClient
          .from("sales_payments")
          .select("*")
          .in("order_id", orderIds);
        if (pError) throw pError;
        paymentsData = payments || [];
      }

      const formattedOrders = (orders || []).map(o => {
        const oItems = itemsData.filter(i => i.order_id === o.id);
        const oPayments = paymentsData.filter(p => p.order_id === o.id);
        const paidAmount = oPayments.reduce((sum, p) => sum + Number(p.amount), 0);
        return {
          id: o.id,
          customerId: o.customer_id,
          customerName: o.sales_customers?.name || "Noma'lum Mijoz",
          customerPhone: o.sales_customers?.phone || "",
          chatId: o.chat_id,
          saleDate: o.sale_date,
          totalAmount: Number(o.total_amount),
          totalPoints: Number(o.total_points),
          status: o.status,
          notes: o.notes,
          items: oItems.map(i => ({
            id: i.id,
            productCode: i.product_code,
            productName: i.product_name,
            quantity: i.quantity,
            unitPrice: Number(i.unit_price),
            points: Number(i.points || 0)
          })),
          paidAmount,
          outstandingBalance: Math.max(0, Number(o.total_amount) - paidAmount)
        };
      });

      return res.json(formattedOrders);
    } else {
      // Demo list construction
      computeOutstandingStatuses(demoOrders, demoPayments);
      const ordersToMap = chatId ? demoOrders.filter(o => o.chat_id === chatId) : demoOrders;

      const formatted = ordersToMap.map(o => {
        const custObj = demoCustomers.find(c => c.id === o.customer_id);
        const oItems = demoOrderItems.filter(i => i.order_id === o.id);
        const oPayments = demoPayments.filter(p => p.order_id === o.id);
        const paidAmount = oPayments.reduce((sum, p) => sum + p.amount, 0);

        return {
          id: o.id,
          customerId: o.customer_id,
          customerName: custObj ? custObj.name : "Noma'lum Mijoz",
          customerPhone: custObj ? custObj.phone : "",
          chatId: o.chat_id,
          saleDate: o.sale_date,
          totalAmount: o.total_amount,
          totalPoints: o.total_points,
          status: o.status,
          notes: o.notes,
          items: oItems,
          paidAmount,
          outstandingBalance: Math.max(0, o.total_amount - paidAmount)
        };
      });

      // Sort by date desc
      formatted.sort((a, b) => b.saleDate.localeCompare(a.saleDate));
      return res.json(formatted);
    }
  } catch (error: any) {
    console.error("Error fetching sales orders:", error);
    res.status(500).json({ error: error.message || "Xatolik yuz berdi" });
  }
});

// 4. POST Create Sales Order with multiple items
router.post("/sales-orders", async (req, res) => {
  try {
    const isSupabaseConfigured = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_ANON_KEY;
    const { customerId, chatId, saleDate, notes, items } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: "Mijoz tanlanishi shart!" });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Kamida bitta mahsulot qo'shilishi shart!" });
    }

    // Calculate dynamic order aggregates
    let totalAmount = 0;
    let totalPoints = 0;
    const finalItems = items.map((item: any) => {
      const q = parseInt(item.quantity) || 1;
      const price = parseFloat(item.unitPrice) || 0;
      const pts = parseFloat(item.points) || 0;
      totalAmount += q * price;
      totalPoints += q * pts;
      return {
        product_code: item.productCode || "",
        product_name: item.productName || "Noma'lum Mahsulot",
        quantity: q,
        unit_price: price,
        points: pts
      };
    });

    const parsedSaleDate = saleDate || new Date().toISOString();

    if (isSupabaseConfigured) {
      const dbClient = checkDatabase();
      
      // Keep it robust: write order
      const { data: orderData, error: orderError } = await dbClient
        .from("sales_orders")
        .insert({
          customer_id: customerId,
          chat_id: chatId || null,
          sale_date: parsedSaleDate,
          total_amount: totalAmount,
          total_points: totalPoints,
          status: "unpaid",
          notes: notes?.trim() || null,
          created_at: new Date().toISOString()
        })
        .select("*")
        .single();

      if (orderError) throw orderError;

      // Add order items
      const itemsToInsert = finalItems.map(item => ({
        order_id: orderData.id,
        product_code: item.product_code,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        points: item.points
      }));

      const { error: itemsError } = await dbClient
        .from("sales_order_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      return res.json({ success: true, orderId: orderData.id, amount: totalAmount });
    } else {
      // Demo mode insertion
      const newOrderId = "ord-" + Date.now();
      const newOrder = {
        id: newOrderId,
        customer_id: customerId,
        chat_id: chatId || "",
        sale_date: parsedSaleDate,
        total_amount: totalAmount,
        total_points: totalPoints,
        status: "unpaid",
        notes: notes?.trim() || "",
        created_at: new Date().toISOString()
      };

      demoOrders.push(newOrder);

      finalItems.forEach((item, index) => {
        demoOrderItems.push({
          id: `item-${newOrderId}-${index}`,
          order_id: newOrderId,
          product_code: item.product_code,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          points: item.points
        });
      });

      return res.json({ success: true, orderId: newOrderId, amount: totalAmount });
    }
  } catch (error: any) {
    console.error("Error creating sales order:", error);
    res.status(500).json({ error: error.message || "Buyurtma shakllantirishda xatolik" });
  }
});

// 5. GET Payments/Transactions List
router.get("/sales-payments", async (req, res) => {
  try {
    const { chatId } = req.query;
    const isSupabaseConfigured = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_ANON_KEY;

    if (isSupabaseConfigured) {
      const dbClient = checkDatabase();
      // Fetch payments
      const { data: payments, error } = await dbClient
        .from("sales_payments")
        .select("*, sales_customers(*)")
        .order("payment_date", { ascending: false });

      if (error) throw error;

      const formatted = (payments || []).map(p => ({
        id: p.id,
        customerId: p.customer_id,
        customerName: p.sales_customers?.name || "Noma'lum Mijoz",
        orderId: p.order_id,
        amount: Number(p.amount),
        paymentDate: p.payment_date,
        paymentMethod: p.payment_method,
        notes: p.notes,
        createdAt: p.created_at
      }));

      return res.json(formatted);
    } else {
      // Demo Mode
      const formatted = demoPayments.map(p => {
        const custObj = demoCustomers.find(c => c.id === p.customer_id);
        return {
          id: p.id,
          customerId: p.customer_id,
          customerName: custObj ? custObj.name : "Noma'lum",
          orderId: p.order_id,
          amount: p.amount,
          paymentDate: p.payment_date,
          paymentMethod: p.payment_method,
          notes: p.notes,
          createdAt: p.created_at
        };
      });

      formatted.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
      return res.json(formatted);
    }
  } catch (error: any) {
    console.error("Error fetching payments:", error);
    res.status(500).json({ error: error.message || "To'lovlarni yuklab bo'lmadi" });
  }
});

// 6. POST Enter New Payment/Transaction
router.post("/sales-payments", async (req, res) => {
  try {
    const isSupabaseConfigured = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_ANON_KEY;
    const { customerId, orderId, amount, paymentDate, paymentMethod, notes } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: "Mijoz tanlanishi shart!" });
    }
    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: "To'lov summasi noldan katta bo'lishi shart!" });
    }

    const payAmount = parseFloat(amount);
    const parsedDate = paymentDate || new Date().toISOString();

    if (isSupabaseConfigured) {
      const dbClient = checkDatabase();
      
      // Store payment
      const { data: payData, error: payError } = await dbClient
        .from("sales_payments")
        .insert({
          customer_id: customerId,
          order_id: orderId || null,
          amount: payAmount,
          payment_date: parsedDate,
          payment_method: paymentMethod || "cash",
          notes: notes?.trim() || null,
          created_at: new Date().toISOString()
        })
        .select("*")
        .single();
      
      if (payError) throw payError;

      // recalculate Order payment status to mark paid/partially paid
      if (orderId) {
        // Fetch order details
        const { data: order, error: oError } = await dbClient
          .from("sales_orders")
          .select("total_amount")
          .eq("id", orderId)
          .single();

        if (!oError && order) {
          // Fetch sum of all payments for this order
          const { data: orderPays, error: paysSumErr } = await dbClient
            .from("sales_payments")
            .select("amount")
            .eq("order_id", orderId);

          if (!paysSumErr && orderPays) {
            const paidSum = orderPays.reduce((sum, p) => sum + Number(p.amount), 0);
            let nextStatus = "unpaid";
            if (paidSum >= Number(order.total_amount)) {
              nextStatus = "paid";
            } else if (paidSum > 0) {
              nextStatus = "partially_paid";
            }

            await dbClient
              .from("sales_orders")
              .update({ status: nextStatus })
              .eq("id", orderId);
          }
        }
      }

      return res.json({ success: true, paymentId: payData.id });
    } else {
      // Demo Mode
      const newPayId = "pay-" + Date.now();
      const newPay = {
        id: newPayId,
        customer_id: customerId,
        order_id: orderId || null,
        amount: payAmount,
        payment_date: parsedDate,
        payment_method: paymentMethod || "cash",
        notes: notes?.trim() || "",
        created_at: new Date().toISOString()
      };

      demoPayments.push(newPay);
      computeOutstandingStatuses(demoOrders, demoPayments);

      return res.json({ success: true, paymentId: newPayId });
    }
  } catch (error: any) {
    console.error("Error creating payment:", error);
    res.status(500).json({ error: error.message || "To'lovni kiritishda xatolik yuz berdi" });
  }
});

// 7. GET Business Metrics and Optimization Calculations
router.get("/business-metrics", async (req, res) => {
  try {
    const { chatId } = req.query;
    const isSupabaseConfigured = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_ANON_KEY;

    let ordersList: any[] = [];
    let paymentsList: any[] = [];
    let customersList: any[] = [];
    let itemsList: any[] = [];

    if (isSupabaseConfigured) {
      const dbClient = checkDatabase();
      // Fetch customer dataset
      const { data: custs } = await dbClient.from("sales_customers").select("*");
      customersList = custs || [];

      // Fetch sales order datasets
      const { data: ords } = chatId 
        ? await dbClient.from("sales_orders").select("*").eq("chat_id", chatId)
        : await dbClient.from("sales_orders").select("*");
      ordersList = ords || [];

      const oIds = ordersList.map(o => o.id);
      
      if (ordersList.length > 0) {
        const { data: parts } = await dbClient.from("sales_order_items").select("*").in("order_id", oIds);
        itemsList = parts || [];

        const { data: pays } = await dbClient.from("sales_payments").select("*").in("order_id", oIds);
        paymentsList = pays || [];
      }
    } else {
      // Demo fallback structures
      customersList = demoCustomers;
      ordersList = chatId ? demoOrders.filter(o => o.chat_id === chatId) : demoOrders;
      const oIds = ordersList.map(o => o.id);
      itemsList = demoOrderItems.filter(i => oIds.includes(i.order_id));
      paymentsList = demoPayments.filter(p => p.order_id && oIds.includes(p.order_id));
    }

    // 1. Calculate General Aggregates
    const totalSalesRevenue = ordersList.reduce((acc, o) => acc + Number(o.total_amount), 0);
    const totalPointsGenerated = ordersList.reduce((acc, o) => acc + Number(o.total_points || 0), 0);
    const totalCollectedPayments = paymentsList.reduce((acc, p) => acc + Number(p.amount), 0);
    const totalOutstandingDebt = Math.max(0, totalSalesRevenue - totalCollectedPayments);

    // 2. Best-Selling Products Metric (Business Optimization Calculation)
    // Counts code frequency & revenues generated
    const productAggregates: Record<string, { name: string; qty: number; revenue: number; points: number }> = {};
    itemsList.forEach(item => {
      const code = item.product_code;
      const qty = Number(item.quantity);
      const rev = qty * Number(item.unit_price);
      const pts = qty * Number(item.points || 0);

      if (!productAggregates[code]) {
        productAggregates[code] = {
          name: item.product_name,
          qty: 0,
          revenue: 0,
          points: 0
        };
      }
      productAggregates[code].qty += qty;
      productAggregates[code].revenue += rev;
      productAggregates[code].points += pts;
    });

    const bestSellers = Object.entries(productAggregates)
      .map(([code, data]) => ({
        code,
        name: data.name,
        quantitySold: data.qty,
        revenue: data.revenue,
        points: data.points
      }))
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 10);

    // 3. Best Spenders Metric (Top customers who buy cosmetics)
    const customerAggregates: Record<string, { name: string; totalBought: number; totalPaid: number; debtorSince: string }> = {};
    
    // Seed with names
    customersList.forEach(c => {
      customerAggregates[c.id] = { name: c.name, totalBought: 0, totalPaid: 0, debtorSince: c.created_at };
    });

    ordersList.forEach(order => {
      if (customerAggregates[order.customer_id]) {
        customerAggregates[order.customer_id].totalBought += Number(order.total_amount);
      } else {
        customerAggregates[order.customer_id] = { name: "Noma'lum Mijoz", totalBought: Number(order.total_amount), totalPaid: 0, debtorSince: order.sale_date };
      }
    });

    paymentsList.forEach(pay => {
      if (customerAggregates[pay.customer_id]) {
        customerAggregates[pay.customer_id].totalPaid += Number(pay.amount);
      }
    });

    const customerPerformance = Object.entries(customerAggregates)
      .map(([id, info]) => {
        const balance = Math.max(0, info.totalBought - info.totalPaid);
        return {
          customerId: id,
          customerName: info.name,
          totalOrdersAmount: info.totalBought,
          totalPaidAmount: info.totalPaid,
          outstandingDebt: balance,
          debtorSince: info.debtorSince
        };
      })
      .sort((a, b) => b.totalOrdersAmount - a.totalOrdersAmount)
      .slice(0, 10);

    // Filter list of outstanding debtors specifically
    const topDebtors = customerPerformance
      .filter(c => c.outstandingDebt > 0)
      .sort((a, b) => b.outstandingDebt - a.outstandingDebt);

    // 4. Group Chat Channel Performance Optimization
    // Check which group chat generated the most sales
    const groupSales: Record<string, number> = {};
    ordersList.forEach(order => {
      const gId = order.chat_id || "direct_sales";
      groupSales[gId] = (groupSales[gId] || 0) + Number(order.total_amount);
    });

    const channelPerformance = Object.entries(groupSales).map(([gId, rev]) => ({
      channelId: gId,
      channelName: gId === "direct_sales" ? "To'g'ridan-to'g'ri (Guruhsiz)" : "Telegram Guruh / " + gId,
      revenueGenerated: rev
    })).sort((a, b) => b.revenueGenerated - a.revenueGenerated);

    return res.json({
      summary: {
        totalSalesRevenue,
        totalCollectedPayments,
        totalOutstandingDebt,
        totalPointsGenerated,
        activeCustomersCount: customersList.length,
        totalOrdersCount: ordersList.length
      },
      bestSellers,
      customerPerformance,
      topDebtors,
      channelPerformance
    });
  } catch (error: any) {
    console.error("Error computing business optimization metrics:", error);
    res.status(500).json({ error: error.message || "Metrics calculation failed" });
  }
});

// 8. DELETE Sales Order
router.delete("/sales-orders/:id", async (req, res) => {
  try {
    const orderId = req.params.id;
    const isSupabaseConfigured = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_ANON_KEY;

    if (isSupabaseConfigured) {
      const dbClient = checkDatabase();
      const { error } = await dbClient
        .from("sales_orders")
        .delete()
        .eq("id", orderId);
      if (error) throw error;
      return res.json({ success: true });
    } else {
      // Demo delete order
      demoOrders = demoOrders.filter(o => o.id !== orderId);
      demoOrderItems = demoOrderItems.filter(i => i.order_id !== orderId);
      demoPayments = demoPayments.filter(p => p.order_id !== orderId);
      return res.json({ success: true });
    }
  } catch (error: any) {
    console.error("Error deleting order:", error);
    res.status(500).json({ error: error.message || "Xatolik" });
  }
});

// 9. DELETE Payment/Transaction
router.delete("/sales-payments/:id", async (req, res) => {
  try {
    const paymentId = req.params.id;
    const isSupabaseConfigured = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_ANON_KEY;

    if (isSupabaseConfigured) {
      const dbClient = checkDatabase();
      
      // Get order_id before deleting
      const { data: pData } = await dbClient
        .from("sales_payments")
        .select("order_id")
        .eq("id", paymentId)
        .single();

      const { error } = await dbClient
        .from("sales_payments")
        .delete()
        .eq("id", paymentId);
      
      if (error) throw error;

      if (pData && pData.order_id) {
        // Recalculate order status
        const { data: order } = await dbClient
          .from("sales_orders")
          .select("total_amount")
          .eq("id", pData.order_id)
          .single();

        if (order) {
          const { data: orderPays } = await dbClient
            .from("sales_payments")
            .select("amount")
            .eq("order_id", pData.order_id);

          const paidSum = (orderPays || []).reduce((sum, p) => sum + Number(p.amount), 0);
          let nextStatus = "unpaid";
          if (paidSum >= Number(order.total_amount)) {
            nextStatus = "paid";
          } else if (paidSum > 0) {
            nextStatus = "partially_paid";
          }

          await dbClient
            .from("sales_orders")
            .update({ status: nextStatus })
            .eq("id", pData.order_id);
        }
      }

      return res.json({ success: true });
    } else {
      demoPayments = demoPayments.filter(p => p.id !== paymentId);
      computeOutstandingStatuses(demoOrders, demoPayments);
      return res.json({ success: true });
    }
  } catch (error: any) {
    console.error("Error deleting payment:", error);
    res.status(500).json({ error: error.message || "Xatolik" });
  }
});

export default router;
