import { checkDatabase } from "../db.js";
import { checkAndRecordLeavesForGroup } from "./leaves.js";
import { generateVerificationCode } from "../auth-store.js";

/**
 * Flexible date parser for leaderboard commands:
 * Supports:
 * - Relative: "7d", "30d", "14d", "1d"
 * - DD.MM.YYYY, DD-MM-YYYY, DD/MM/YYYY (with optional HH:mm)
 * - YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD (with optional HH:mm)
 * - ISO string / standard Date parseable strings
 */
function parseSinceDate(input?: string): { date: Date | null; label?: string; error?: string } {
  if (!input || !input.trim()) return { date: null };
  const str = input.trim();

  // 1. Relative e.g. "7d", "30d", "14d", "1d"
  const relMatch = str.match(/^(\d+)\s*d(ays?)?$/i);
  if (relMatch) {
    const days = parseInt(relMatch[1], 10);
    if (days > 0 && days <= 730) {
      const d = new Date();
      d.setDate(d.getDate() - days);
      d.setHours(0, 0, 0, 0);
      return { date: d, label: `Oxirgi ${days} kun (${d.toLocaleDateString("uz-UZ")})` };
    }
  }

  // 2. DD.MM.YYYY or DD-MM-YYYY or DD/MM/YYYY (with optional HH:mm)
  const dmyMatch = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const hours = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const minutes = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const d = new Date(year, month, day, hours, minutes, 0, 0);
    if (!isNaN(d.getTime())) {
      return { date: d, label: d.toLocaleDateString("uz-UZ") };
    }
  }

  // 3. YYYY-MM-DD or YYYY.MM.DD or YYYY/MM/DD (with optional HH:mm)
  const ymdMatch = str.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const hours = ymdMatch[4] ? parseInt(ymdMatch[4], 10) : 0;
    const minutes = ymdMatch[5] ? parseInt(ymdMatch[5], 10) : 0;
    const d = new Date(year, month, day, hours, minutes, 0, 0);
    if (!isNaN(d.getTime())) {
      return { date: d, label: d.toLocaleDateString("uz-UZ") };
    }
  }

  // 4. Try standard JS Date constructor
  const generic = new Date(str);
  if (!isNaN(generic.getTime())) {
    return { date: generic, label: generic.toLocaleDateString("uz-UZ") };
  }

  return { date: null, error: "Noto'g'ri sana formati" };
}

export function registerBotCommands(bot: any) {
  // #contest command
  bot.hears(/#contest/i, async (ctx: any) => {
    const chatId = ctx.chat?.id?.toString();
    if (!chatId) return;
    try {
      const dbClient = checkDatabase();
      const { data: activeContest } = await dbClient
        .from("contests")
        .select("*")
        .eq("chat_id", chatId)
        .eq("is_active", true)
        .limit(1);

      if (!activeContest || activeContest.length === 0) {
        return ctx.reply("Bu guruhda hozirda faol konkurs mavjud emas.");
      }

      const contest = activeContest[0];
      const escapedTitle = (contest.title || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const escapedPrizes = (contest.prizes || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      
      const message = `🌟 <b>Yangi Konkurs Boshlandi!</b> 🌟\n\n` +
                      `📝 <b>Nomi:</b> ${escapedTitle}\n` +
                      `📅 <b>Boshlanish:</b> ${new Date(contest.start_date).toLocaleDateString()}\n` +
                      `🏁 <b>Tugash:</b> ${new Date(contest.end_date).toLocaleDateString()}\n\n` +
                      `🎁 <b>Sovrinlar:</b>\n${escapedPrizes}\n\n` +
                      `ℹ️ <b>Qatnashish sharti:</b>\n` +
                      `Guruhga do'stlaringizni qo'shing va eng ko'p odam qo'shganlar orasida g'olib bo'ling!\n\n` +
                      `Omad tilaymiz! 🚀`;

      if (contest.image_url) {
        try {
          await ctx.replyWithPhoto(contest.image_url, { caption: message, parse_mode: "HTML" });
        } catch (e) {
          await ctx.reply(message, { parse_mode: "HTML" });
        }
      } else {
        await ctx.reply(message, { parse_mode: "HTML" });
      }
    } catch (err) {
      console.error("Error showing active contest command:", err);
    }
  });

  // /auth command to generate dynamic 6-digit admin verification codes
  bot.command("auth", async (ctx: any) => {
    try {
      if (!ctx.chat || (ctx.chat.type !== "group" && ctx.chat.type !== "supergroup")) {
        return ctx.reply("Ushbu buyruqni faqat guruhlarda ishlatish mumkin.");
      }

      const chatId = ctx.chat.id.toString();
      const chatTitle = (ctx.chat as any).title || "Guruh";

      if (!ctx.from) {
        return ctx.reply("Foydalanuvchi ma'lumotlarini aniqlab bo'lmadi.");
      }

      // Robust admin check using ctx.getChatAdministrators()
      let isUserAdminOrCreator = false;
      try {
        const admins = await ctx.getChatAdministrators();
        isUserAdminOrCreator = admins.some((a: any) => a.user.id === ctx.from?.id);
      } catch (adminErr) {
        console.error("Failed to query admins in /auth:", adminErr);
        return ctx.reply(
          `⚠️ <b>Xatolik:</b> Guruh administratorlari ro'yxatini olib bo'lmadi.\n\n` +
          `Iltimos, bot guruhda administrator ekanligini va "Xabarlarni o'chirish" ruxsati borligini tekshiring!`,
          { parse_mode: "HTML" }
        );
      }

      if (!isUserAdminOrCreator) {
        return ctx.reply("Ushbu buyruq faqat guruh adminlari yoki egasi uchun ruxsat etilgan!");
      }

      // Generate verification code
      const code = await generateVerificationCode(chatId, chatTitle, ctx.from.id.toString());

      // Ensure calling admin is marked with administrator status in memberships
      try {
        const dbClient = checkDatabase();
        await dbClient.from("memberships").upsert({
          id: `${chatId}_${ctx.from.id}`,
          chat_id: chatId,
          telegram_id: ctx.from.id.toString(),
          username: ctx.from.username || "",
          first_name: ctx.from.first_name || "Admin",
          last_name: ctx.from.last_name || "",
          joined_at: new Date().toISOString(),
          status: "administrator",
          left_at: null
        });
      } catch (e: any) {
        console.warn("Could not upsert admin status in /auth:", e.message);
      }

      const escapedTitle = chatTitle.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const escapedName = (ctx.from.first_name || "Admin").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

      try {
        await ctx.telegram.sendMessage(
          ctx.from.id,
          `🗝 <b>Guruh:</b> <i>${escapedTitle}</i>\n` +
          `🔐 <b>Tasdiqlash kodi:</b> <code>${code}</code>\n\n` +
          `Ushbu kodni nusxalab, monitoring boshqaruv paneliga kiriting. Kod 10 daqiqa davomida faoldir.`,
          { parse_mode: "HTML" }
        );

        const replyMsg = await ctx.reply(
          `Psst, <b>${escapedName}</b>! 🔑 Kirish kodi sizga shaxsiy xabar (DM) orqali yuborildi. Iltimos, shaxsiy chatingizni tekshiring.`,
          { parse_mode: "HTML" }
        );
        setTimeout(async () => {
          try { await ctx.telegram.deleteMessage(chatId, replyMsg.message_id); } catch(e) {}
        }, 15000);
      } catch (err) {
        // If DM fails (user hasn't started the bot in DM)
        const replyMsg = await ctx.reply(
          `⚠️ <b>${escapedName}</b>, sizga shaxsiy xabar yuborib bo'lmadi.\n\n` +
          `Men sizga to'g'ridan-to'g'ri kod yuborishim uchun avval shaxsiy chatda botimizga kirib, <b>boshlash (/start)</b> tugmasini bosing!\n\n` +
          `Sizning vaqtinchalik kirish kodingiz (Xavfsizlik uchun bu xabar 30 soniyadan so'ng o'chiriladi):\n` +
          `➡️ <code>${code}</code>`,
          { parse_mode: "HTML" }
        );

        setTimeout(async () => {
          try { await ctx.telegram.deleteMessage(chatId, replyMsg.message_id); } catch(e) {}
        }, 30000);
      }

      // Delete the trigger message from the group to keep chat tidy
      try { await ctx.deleteMessage(); } catch(e) {}

    } catch (err: any) {
      console.error("Auth command error:", err);
      try {
        await ctx.reply(`Xatolik yuz berdi: ${err.message}`);
      } catch (e) {}
    }
  });

  // /sync command to bootstrap admins & get real-time statistics
  bot.command("sync", async (ctx: any) => {
    try {
      if (!ctx.chat || (ctx.chat.type !== "group" && ctx.chat.type !== "supergroup")) {
        return ctx.reply("Ushbu buyruqni faqat guruhlarda ishlatish mumkin.");
      }

      const chatId = ctx.chat.id.toString();
      const chatTitle = (ctx.chat as any).title || "Guruh";
      const dbClient = checkDatabase();
      
      if (!ctx.from) {
        return ctx.reply("Foydalanuvchi ma'lumotlarini aniqlab bo'lmadi.");
      }

      // Robust admin or creator check using ctx.getChatAdministrators()
      let isUserAdminOrCreator = false;
      let admins: any[] = [];
      try {
        admins = await ctx.getChatAdministrators();
        isUserAdminOrCreator = admins.some((a: any) => a.user.id === ctx.from?.id);
      } catch (adminErr) {
        console.error("Failed to query admins in /sync:", adminErr);
        return ctx.reply(
          `⚠️ <b>Xatolik:</b> Guruh administratorlari ro'yxatini olib bo'lmadi.\n\n` +
          `Iltimos, bot guruhda administrator ekanligini tekshiring!`,
          { parse_mode: "HTML" }
        );
      }
      
      if (!isUserAdminOrCreator) {
        return ctx.reply("Ushbu buyruq faqat guruh adminlari yoki egasi uchun ruxsat etilgan!");
      }

      // Fetch Telegram real-time member count
      const realMemberCount = await ctx.telegram.getChatMembersCount(chatId);
      await dbClient.from("groups").upsert({
        id: chatId,
        title: chatTitle,
        last_active_at: new Date().toISOString()
      });

      let importedCount = 0;
      for (const admin of admins) {
        const u = admin.user;
        const uid = u.id.toString();

        // Save global user info
        await dbClient.from("users").upsert({
          telegram_id: uid,
          username: u.username || "",
          first_name: u.first_name,
          last_name: u.last_name || "",
          joined_at: new Date().toISOString(),
          is_bot: u.is_bot
        });

        // Record group membership
        await dbClient.from("memberships").upsert({
          id: `${chatId}_${uid}`,
          chat_id: chatId,
          telegram_id: uid,
          username: u.username || "",
          first_name: u.first_name,
          last_name: u.last_name || "",
          joined_at: new Date().toISOString(),
          status: admin.status || "administrator",
          left_at: null
        });

        importedCount++;
      }

      // Run retroactive leave scan for group members
      const detectedLeavesCount = await checkAndRecordLeavesForGroup(ctx.telegram, chatId);

      const replyMsg = await ctx.reply(
        `✅ <b>Birlashish (Sync) yakunlandi!</b>\n\n` +
        `📊 <b>Guruh a'zolari soni (Telegram API):</b> ${realMemberCount} ta\n` +
        `👤 <b>Ro'yxatdan o'tgan administratorlar:</b> ${importedCount} ta\n` +
        `🏃‍♂️ <b>Yangi guruhni tark etganlar (Logga olingan):</b> ${detectedLeavesCount} ta\n\n` +
        `<i>Guruh a'zolari guruhda xabar yozishi bilan ular ham avtomatik ravishda bazaga kiritib boriladi.</i>`,
        { parse_mode: "HTML" }
      );
      
      // Auto-delete reply after 15 seconds to keep group clean
      setTimeout(async () => {
        try {
          await ctx.telegram.deleteMessage(chatId, replyMsg.message_id);
        } catch (e) {}
      }, 15000);

      // Delete the trigger message from the group to keep chat tidy
      try {
        await ctx.deleteMessage();
      } catch (e) {}

    } catch (err: any) {
      console.error("Sync error:", err);
      try {
        await ctx.reply(`Xatolik yuz berdi: ${err.message}`);
      } catch (e) {}
    }
  });

  // /leaderboard and /top command: Shows who invited how many members since a set date
  // Helper: Fetch leaderboard statistics for a specific chat ID and sinceDate
  async function fetchLeaderboardStats(dbClient: any, chatId: string, sinceDate: Date | null) {
    const { data: grpData } = await dbClient
      .from("groups")
      .select("title")
      .eq("id", chatId)
      .maybeSingle();

    const chatTitle = grpData?.title || "Guruh";

    let effectiveSince = sinceDate;
    let contestTitle = "";
    let dateLabel = sinceDate ? sinceDate.toLocaleDateString("uz-UZ") : "";

    if (!effectiveSince) {
      const { data: activeContests } = await dbClient
        .from("contests")
        .select("title, start_date")
        .eq("chat_id", chatId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1);

      if (activeContests && activeContests.length > 0) {
        effectiveSince = new Date(activeContests[0].start_date);
        contestTitle = activeContests[0].title;
        dateLabel = effectiveSince.toLocaleDateString("uz-UZ");
      } else {
        dateLabel = "Barcha vaqt bo'yicha";
      }
    }

    let invitesQuery = dbClient
      .from("invites")
      .select("inviter_id, invitee_id, timestamp")
      .eq("chat_id", chatId);

    if (effectiveSince) {
      invitesQuery = invitesQuery.gte("timestamp", effectiveSince.toISOString());
    }

    const { data: invites, error: invitesErr } = await invitesQuery;
    if (invitesErr) throw invitesErr;

    const counts: Record<string, number> = {};
    const inviterInviteesMap: Record<string, string[]> = {};

    for (const inv of (invites || [])) {
      if (!inv.inviter_id) continue;
      counts[inv.inviter_id] = (counts[inv.inviter_id] || 0) + 1;
      if (!inviterInviteesMap[inv.inviter_id]) {
        inviterInviteesMap[inv.inviter_id] = [];
      }
      inviterInviteesMap[inv.inviter_id].push(inv.invitee_id);
    }

    const sortedEntries = Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    const topUserIds = sortedEntries.map(([id]) => id);

    const userMap: Record<string, { name: string; username: string }> = {};
    if (topUserIds.length > 0) {
      const { data: usersData } = await dbClient
        .from("users")
        .select("telegram_id, first_name, last_name, username")
        .in("telegram_id", topUserIds);

      if (usersData) {
        for (const u of usersData) {
          userMap[u.telegram_id] = {
            name: `${u.first_name || ""} ${u.last_name || ""}`.trim() || "Foydalanuvchi",
            username: u.username || ""
          };
        }
      }
    }

    const allTopInvitees = topUserIds.flatMap(id => inviterInviteesMap[id] || []);
    const activeInviteesSet = new Set<string>();
    if (allTopInvitees.length > 0) {
      const { data: activeMems } = await dbClient
        .from("memberships")
        .select("telegram_id")
        .eq("chat_id", chatId)
        .in("telegram_id", allTopInvitees)
        .neq("status", "left");

      if (activeMems) {
        for (const m of activeMems) {
          activeInviteesSet.add(m.telegram_id);
        }
      }
    }

    return {
      chatTitle,
      sinceDate: effectiveSince,
      dateLabel,
      contestTitle,
      totalInvites: (invites || []).length,
      totalUniqueInviters: Object.keys(counts).length,
      sortedEntries,
      userMap,
      inviterInviteesMap,
      activeInviteesSet
    };
  }

  // Helper: Format a user name as a clickable link without username text
  function formatClickableUser(id: string, name: string, username?: string): string {
    const rawName = (name || "").trim() || "Foydalanuvchi";
    const escapedName = rawName.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const cleanUsername = username ? username.replace(/^@/, "").trim() : "";
    const userUrl = cleanUsername ? `https://t.me/${cleanUsername}` : `tg://user?id=${id}`;
    return `<a href="${userUrl}"><b>${escapedName}</b></a>`;
  }

  // Format clean leaderboard message for group chats (minimal headers, preserves call to action)
  function formatGroupLeaderboard(stats: any): string {
    const ctaLine = `\n\n💡 <i>Guruhga kontaktlaringizni qo'shing va reytingda yuqori o'ringa chiqing!</i>`;

    if (!stats.sortedEntries || stats.sortedEntries.length === 0) {
      return `🏆 <b>Takliflar Reytingi</b>\n\nHozircha ushbu muddat oralig'ida hech kim a'zo taklif qilmagan.${ctaLine}`;
    }

    const medalIcons = ["🥇", "🥈", "🥉"];
    const lines = stats.sortedEntries.map(([id, totalCount]: [string, number], index: number) => {
      const u = stats.userMap[id] || { name: "Noma'lum foydalanuvchi", username: "" };
      const clickableName = formatClickableUser(id, u.name, u.username);
      const rankIcon = index < 3 ? medalIcons[index] : `${index + 1}.`;

      const invitees = stats.inviterInviteesMap[id] || [];
      const activeCount = invitees.filter((invId: string) => stats.activeInviteesSet.has(invId)).length;
      const retentionText = activeCount < totalCount ? ` <i>(${activeCount} ta faol)</i>` : "";

      return `${rankIcon} ${clickableName} — <b>${totalCount}</b> ta taklif${retentionText}`;
    });

    return `🏆 <b>Takliflar Reytingi</b>\n\n${lines.join("\n")}${ctaLine}`;
  }

  // Format comprehensive leaderboard message for admin direct messages (DM)
  function formatDmLeaderboard(stats: any, chatId: string): string {
    const escapedTitle = (stats.chatTitle || "Guruh").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const contestNotice = stats.contestTitle 
      ? `🎯 <b>Faol konkurs:</b> ${stats.contestTitle.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}\n` 
      : "";

    let listContent = "";
    if (!stats.sortedEntries || stats.sortedEntries.length === 0) {
      listContent = "Hozircha ushbu muddat oralig'ida hech kim a'zo taklif qilmagan.";
    } else {
      const medalIcons = ["🥇", "🥈", "🥉"];
      const lines = stats.sortedEntries.map(([id, totalCount]: [string, number], index: number) => {
        const u = stats.userMap[id] || { name: "Noma'lum foydalanuvchi", username: "" };
        const clickableName = formatClickableUser(id, u.name, u.username);
        const rankIcon = index < 3 ? medalIcons[index] : `${index + 1}.`;

        const invitees = stats.inviterInviteesMap[id] || [];
        const activeCount = invitees.filter((invId: string) => stats.activeInviteesSet.has(invId)).length;
        const retentionText = activeCount < totalCount ? ` <i>(${activeCount} ta faol)</i>` : "";

        return `${rankIcon} ${clickableName} — <b>${totalCount}</b> ta taklif${retentionText}`;
      });
      listContent = lines.join("\n");
    }

    return (
      `🏆 <b>Takliflar Reytingi (Leaderboard)</b>\n` +
      `👥 <b>Guruh:</b> <i>${escapedTitle}</i>\n` +
      contestNotice +
      `📅 <b>Ko'rilayotgan davr:</b> ${stats.sinceDate ? `${stats.dateLabel} dan boshlab` : stats.dateLabel}\n` +
      `📊 <b>Jami takliflar:</b> ${stats.totalInvites} ta (${stats.totalUniqueInviters} ta faol ishtirokchi)\n` +
      `────────────────────\n\n` +
      listContent +
      `\n\n────────────────────\n` +
      `ℹ️ <i>Boshqa sanadan boshlab ko'rish uchun:</i>\n` +
      `<code>/leaderboard ${chatId} YYYY-MM-DD</code> (masalan: <code>/leaderboard ${chatId} 2026-09-01</code> yoki <code>/leaderboard ${chatId} 7d</code>)`
    );
  }

  function getDmLeaderboardKeyboard(chatId: string, currentPeriod = "all") {
    return {
      inline_keyboard: [
        [
          { text: currentPeriod === "all" ? "• Barcha vaqt •" : "Barcha vaqt", callback_data: `lb_per:${chatId}:all` },
          { text: currentPeriod === "7d" ? "• Oxirgi 7 kun •" : "Oxirgi 7 kun", callback_data: `lb_per:${chatId}:7d` },
          { text: currentPeriod === "30d" ? "• Oxirgi 30 kun •" : "Oxirgi 30 kun", callback_data: `lb_per:${chatId}:30d` },
        ],
        [
          { text: "🔄 Yangilash", callback_data: `lb_ref:${chatId}:${currentPeriod}` },
          { text: "🔙 Guruhlar ro'yxati", callback_data: "lb_list" },
        ]
      ]
    };
  }

  // Helper: Find all groups where user is administrator or creator
  async function getUserAdminGroups(telegram: any, dbClient: any, userId: string): Promise<{ id: string; title: string }[]> {
    const { data: dbGroups } = await dbClient.from("groups").select("id, title");
    if (!dbGroups || dbGroups.length === 0) return [];

    const adminGroups: { id: string; title: string }[] = [];

    const checks = await Promise.allSettled(
      dbGroups.map(async (g: any) => {
        try {
          const admins = await telegram.getChatAdministrators(g.id);
          const isAdmin = admins.some((a: any) => a.user?.id?.toString() === userId.toString());
          if (isAdmin) return g;
        } catch (e) {
          // Chat not accessible or bot removed
        }
        return null;
      })
    );

    for (const c of checks) {
      if (c.status === "fulfilled" && c.value) {
        adminGroups.push(c.value);
      }
    }

    // Fallback to database memberships if direct Telegram check returned empty
    if (adminGroups.length === 0) {
      const { data: dbAdmins } = await dbClient
        .from("memberships")
        .select("chat_id")
        .eq("telegram_id", userId)
        .in("status", ["administrator", "creator"]);

      if (dbAdmins && dbAdmins.length > 0) {
        const allowedChatIds = new Set(dbAdmins.map((m: any) => m.chat_id));
        for (const g of dbGroups) {
          if (allowedChatIds.has(g.id) && !adminGroups.some(ag => ag.id === g.id)) {
            adminGroups.push(g);
          }
        }
      }

      // Secondary fallback: check all active non-left memberships for this user
      if (adminGroups.length === 0) {
        const { data: anyMems } = await dbClient
          .from("memberships")
          .select("chat_id")
          .eq("telegram_id", userId)
          .neq("status", "left");

        if (anyMems && anyMems.length > 0) {
          const allowedChatIds = new Set(anyMems.map((m: any) => m.chat_id));
          for (const g of dbGroups) {
            if (allowedChatIds.has(g.id) && !adminGroups.some(ag => ag.id === g.id)) {
              adminGroups.push(g);
            }
          }
        }
      }
    }

    return adminGroups;
  }

  // Helper: Check if user is admin of a specific target chat
  async function isUserAdminOfChat(telegram: any, dbClient: any, chatId: string, userId: string): Promise<boolean> {
    try {
      const admins = await telegram.getChatAdministrators(chatId);
      if (admins.some((a: any) => a.user?.id?.toString() === userId.toString())) {
        return true;
      }
    } catch (e) {
      // Telegram getChatAdministrators may throw 400 Bad Request: chat not found
      // when the bot is not an admin, or privacy mode restricts query in DM
    }

    // Fallback 1: check explicit admin/creator status in database
    const { data: dbAdmin } = await dbClient
      .from("memberships")
      .select("id, status")
      .eq("chat_id", chatId)
      .eq("telegram_id", userId)
      .in("status", ["administrator", "creator"])
      .maybeSingle();

    if (dbAdmin) {
      return true;
    }

    // Fallback 2: check if user is recorded as an active member of this group
    const { data: dbMember } = await dbClient
      .from("memberships")
      .select("id, status")
      .eq("chat_id", chatId)
      .eq("telegram_id", userId)
      .neq("status", "left")
      .maybeSingle();

    return !!dbMember;
  }

  const handleLeaderboard = async (ctx: any) => {
    try {
      const isPrivate = ctx.chat?.type === "private";
      const isGroup = ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";
      const dbClient = checkDatabase();

      if (!isPrivate && !isGroup) {
        return ctx.reply("Ushbu buyruq faqat guruhlar yoki bot bilan shaxsiy yozishmada ishlaydi.");
      }

      const rawText = (ctx.message?.text || "").trim();
      const parts = rawText.split(/\s+/).slice(1); // tokens after command

      // ─────────────────────────────────────────────────────────────
      // CASE 1: GROUP CHAT EXECUTION
      // ─────────────────────────────────────────────────────────────
      if (isGroup) {
        // Automatically delete the user's command message from the group to keep the chat tidy and prevent members from seeing it
        try {
          await ctx.deleteMessage();
        } catch (e) {}

        const chatId = ctx.chat.id.toString();
        let dateArg = parts.join(" ").trim();

        let sinceDate: Date | null = null;
        if (dateArg) {
          const parsed = parseSinceDate(dateArg);
          if (parsed.error || !parsed.date) {
            return ctx.reply(
              `⚠️ <b>Noto'g'ri sana formati!</b>\n\n` +
              `Iltimos, sanani quyidagi formatda kiriting:\n` +
              `• <code>/leaderboard 2026-09-01</code> (yil-oy-kun)\n` +
              `• <code>/leaderboard 01.09.2026</code> (kun.oy.yil)\n` +
              `• <code>/leaderboard 7d</code> (oxirgi 7 kun)`,
              { parse_mode: "HTML" }
            );
          }
          if (parsed.date.getTime() > Date.now()) {
            return ctx.reply(`⚠️ Kiritilgan sana kelajakda. Iltimos, o'tgan yoki bugungi sanani kiriting.`);
          }
          sinceDate = parsed.date;
        }

        const stats = await fetchLeaderboardStats(dbClient, chatId, sinceDate);
        const groupMsg = formatGroupLeaderboard(stats);
        return await ctx.reply(groupMsg, { parse_mode: "HTML" });
      }

      // ─────────────────────────────────────────────────────────────
      // CASE 2: BOT DM (PRIVATE CHAT) - FOR ADMINS ONLY
      // ─────────────────────────────────────────────────────────────
      const userId = ctx.from?.id?.toString();
      if (!userId) {
        return ctx.reply("Foydalanuvchi ma'lumotlarini aniqlab bo'lmadi.");
      }

      // Check admin status
      const adminGroups = await getUserAdminGroups(ctx.telegram, dbClient, userId);
      if (adminGroups.length === 0) {
        return ctx.reply(
          `⚠️ <b>Ruxsat berilmadi</b>\n\n` +
          `Ushbu bo'lim faqat guruh administratorlari uchun mo'ljallangan.\n` +
          `Siz bot ulangan hech bir guruhda administrator sifatida aniqlanmadingiz.\n\n` +
          `<i>Agar siz guruhda admin bo'lsangiz, botni guruhga admin qiling va o'sha guruhda <code>/sync</code> buyrug'ini yuboring.</i>`,
          { parse_mode: "HTML" }
        );
      }

      // Check if admin passed a group ID or date in their command
      // e.g. "/leaderboard -1001234567890" or "/leaderboard -1001234567890 2026-09-01" or "/leaderboard 7d"
      let specifiedChatId: string | null = null;
      let dateArg: string | null = null;

      for (const part of parts) {
        if (/^-?\d{5,}$/.test(part) || adminGroups.some(g => g.id === part)) {
          specifiedChatId = part;
        } else {
          dateArg = dateArg ? `${dateArg} ${part}` : part;
        }
      }

      // If admin left out the group ID: send interactive buttons with their groups
      if (!specifiedChatId) {
        const keyboardButtons = adminGroups.map((g) => [
          {
            text: `👥 ${g.title || "Guruh"}`,
            callback_data: `lb_sel:${g.id}${dateArg ? `:${dateArg}` : ""}`
          }
        ]);

        return await ctx.reply(
          `👋 <b>Assalomu alaykum, hurmatli administrator!</b>\n\n` +
          `Qaysi guruhingiz bo'yicha takliflar reytingini (leaderboard) ko'rmoqchisiz? Quyidagi guruhlardan birini tanlang:\n\n` +
          `<i>💡 Shuningdek, to'g'ridan-to'g'ri guruh ID si bilan ham ko'rishingiz mumkin:</i>\n` +
          `<code>/leaderboard &lt;guruh_id&gt; [sana]</code>`,
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: keyboardButtons
            }
          }
        );
      }

      // If admin specified a group ID: verify they are an admin of that group
      const isAdminOfTarget = await isUserAdminOfChat(ctx.telegram, dbClient, specifiedChatId, userId);
      if (!isAdminOfTarget) {
        return ctx.reply(
          `⚠️ Siz <code>${specifiedChatId}</code> guruhida administrator emassiz yoki bunday guruh topilmadi.\n\n` +
          `Iltimos, faqat o'zingiz admin bo'lgan guruh ID sini kiriting yoki shunchaki <code>/leaderboard</code> deb yozib ro'yxatdan tanlang.`,
          { parse_mode: "HTML" }
        );
      }

      let sinceDate: Date | null = null;
      let periodKey = "all";
      if (dateArg) {
        const parsed = parseSinceDate(dateArg);
        if (parsed.error || !parsed.date) {
          return ctx.reply(
            `⚠️ <b>Noto'g'ri sana formati!</b>\n\n` +
            `Iltimos, sanani quyidagi formatlardan birida kiriting:\n` +
            `• <code>/leaderboard ${specifiedChatId} 2026-09-01</code>\n` +
            `• <code>/leaderboard ${specifiedChatId} 7d</code>`,
            { parse_mode: "HTML" }
          );
        }
        sinceDate = parsed.date;
        periodKey = dateArg;
      }

      const stats = await fetchLeaderboardStats(dbClient, specifiedChatId, sinceDate);
      const dmMsg = formatDmLeaderboard(stats, specifiedChatId);
      const keyboard = getDmLeaderboardKeyboard(specifiedChatId, periodKey);

      await ctx.reply(dmMsg, {
        parse_mode: "HTML",
        reply_markup: keyboard
      });

    } catch (err: any) {
      console.error("Leaderboard command error:", err);
      try {
        await ctx.reply(`Xatolik yuz berdi: ${err.message}`);
      } catch (e) {}
    }
  };

  // ─────────────────────────────────────────────────────────────
  // INTERACTIVE CALLBACK QUERIES FOR BOT DM
  // ─────────────────────────────────────────────────────────────

  // Admin selects group from buttons list
  bot.action(/^lb_sel:([^:]+)(?::(.*))?$/, async (ctx: any) => {
    const chatId = ctx.match?.[1];
    const dateArg = ctx.match?.[2] || "";
    const userId = ctx.from?.id?.toString();
    console.log(`[Bot Action lb_sel] Triggered by user ${userId} for chat ${chatId}`);

    try {
      await ctx.answerCbQuery().catch(() => {});
      if (!userId || !chatId) return;

      const dbClient = checkDatabase();
      const isAdmin = await isUserAdminOfChat(ctx.telegram, dbClient, chatId, userId);
      if (!isAdmin && ctx.chat?.type !== "private") {
        return ctx.reply("⚠️ Siz ushbu guruhda administrator emassiz.");
      }

      let sinceDate: Date | null = null;
      let periodKey = "all";
      if (dateArg) {
        const parsed = parseSinceDate(dateArg);
        if (parsed.date) {
          sinceDate = parsed.date;
          periodKey = dateArg;
        }
      }

      const stats = await fetchLeaderboardStats(dbClient, chatId, sinceDate);
      const msg = formatDmLeaderboard(stats, chatId);
      const keyboard = getDmLeaderboardKeyboard(chatId, periodKey);

      try {
        await ctx.editMessageText(msg, {
          parse_mode: "HTML",
          reply_markup: keyboard
        });
      } catch (editErr: any) {
        if (!editErr.message?.includes("message is not modified")) {
          console.warn("[lb_sel] editMessageText HTML failed, falling back to plain text:", editErr.message);
          const plainMsg = msg.replace(/<[^>]+>/g, "");
          await ctx.editMessageText(plainMsg, { reply_markup: keyboard }).catch(() => {});
        }
      }
    } catch (err: any) {
      console.error("[lb_sel] callback error:", err);
      await ctx.answerCbQuery("⚠️ Ma'lumotlarni yuklashda xatolik yuz berdi").catch(() => {});
    }
  });

  // Admin changes period (all, 7d, 30d)
  bot.action(/^lb_per:([^:]+):([^:]+)$/, async (ctx: any) => {
    const chatId = ctx.match?.[1];
    const period = ctx.match?.[2];
    const userId = ctx.from?.id?.toString();
    console.log(`[Bot Action lb_per] Triggered by user ${userId}: chat=${chatId}, period=${period}`);

    try {
      await ctx.answerCbQuery().catch(() => {});
      if (!userId || !chatId || !period) return;

      const dbClient = checkDatabase();
      let sinceDate: Date | null = null;
      if (period === "7d") {
        sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - 7);
        sinceDate.setHours(0, 0, 0, 0);
      } else if (period === "30d") {
        sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - 30);
        sinceDate.setHours(0, 0, 0, 0);
      }

      const stats = await fetchLeaderboardStats(dbClient, chatId, sinceDate);
      const msg = formatDmLeaderboard(stats, chatId);
      const keyboard = getDmLeaderboardKeyboard(chatId, period);

      try {
        await ctx.editMessageText(msg, {
          parse_mode: "HTML",
          reply_markup: keyboard
        });
      } catch (e: any) {
        if (!e.message?.includes("message is not modified")) {
          console.warn("[lb_per] editMessageText HTML failed, falling back to plain text:", e.message);
          const plainMsg = msg.replace(/<[^>]+>/g, "");
          await ctx.editMessageText(plainMsg, { reply_markup: keyboard }).catch(() => {});
        }
      }
    } catch (err: any) {
      console.error("[lb_per] callback error:", err);
      await ctx.answerCbQuery("⚠️ Xatolik yuz berdi").catch(() => {});
    }
  });

  // Admin clicks refresh
  bot.action(/^lb_ref:([^:]+):([^:]+)$/, async (ctx: any) => {
    const chatId = ctx.match?.[1];
    const period = ctx.match?.[2];
    const userId = ctx.from?.id?.toString();
    console.log(`[Bot Action lb_ref] Triggered by user ${userId}: chat=${chatId}, period=${period}`);

    try {
      await ctx.answerCbQuery("Reyting yangilandi! 🔄").catch(() => {});
      if (!userId || !chatId || !period) return;

      const dbClient = checkDatabase();
      let sinceDate: Date | null = null;
      if (period === "7d") {
        sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - 7);
        sinceDate.setHours(0, 0, 0, 0);
      } else if (period === "30d") {
        sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - 30);
        sinceDate.setHours(0, 0, 0, 0);
      }

      const stats = await fetchLeaderboardStats(dbClient, chatId, sinceDate);
      const msg = formatDmLeaderboard(stats, chatId);
      const keyboard = getDmLeaderboardKeyboard(chatId, period);

      try {
        await ctx.editMessageText(msg, {
          parse_mode: "HTML",
          reply_markup: keyboard
        });
      } catch (e: any) {
        if (!e.message?.includes("message is not modified")) {
          console.warn("[lb_ref] editMessageText HTML failed, falling back to plain text:", e.message);
          const plainMsg = msg.replace(/<[^>]+>/g, "");
          await ctx.editMessageText(plainMsg, { reply_markup: keyboard }).catch(() => {});
        }
      }
    } catch (err: any) {
      console.error("[lb_ref] callback error:", err);
      await ctx.answerCbQuery("⚠️ Xatolik yuz berdi").catch(() => {});
    }
  });

  // Admin clicks back to groups list
  bot.action("lb_list", async (ctx: any) => {
    const userId = ctx.from?.id?.toString();
    console.log(`[Bot Action lb_list] Triggered by user ${userId}`);

    try {
      await ctx.answerCbQuery().catch(() => {});
      if (!userId) return;

      const dbClient = checkDatabase();
      const adminGroups = await getUserAdminGroups(ctx.telegram, dbClient, userId);

      if (adminGroups.length === 0) {
        return ctx.editMessageText("⚠️ Siz bot ulangan hech qaysi guruhda administrator emassiz.").catch(() => {});
      }

      const keyboardButtons = adminGroups.map((g) => [
        {
          text: `👥 ${g.title || "Guruh"}`,
          callback_data: `lb_sel:${g.id}`
        }
      ]);

      try {
        await ctx.editMessageText(
          `👋 <b>Guruhni tanlang:</b>\n\n` +
          `Qaysi guruhingiz bo'yicha takliflar reytingini ko'rmoqchisiz?`,
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: keyboardButtons
            }
          }
        );
      } catch (e: any) {
        if (!e.message?.includes("message is not modified")) {
          await ctx.editMessageText(
            "Guruhni tanlang:\n\nQaysi guruhingiz bo'yicha takliflar reytingini ko'rmoqchisiz?",
            { reply_markup: { inline_keyboard: keyboardButtons } }
          ).catch(() => {});
        }
      }
    } catch (err: any) {
      console.error("[lb_list] callback error:", err);
      await ctx.answerCbQuery("⚠️ Xatolik yuz berdi").catch(() => {});
    }
  });

  // Register leaderboard commands
  bot.command("leaderboard", handleLeaderboard);
  bot.command("top", handleLeaderboard);
  bot.command("reyting", handleLeaderboard);
  bot.hears(/^#?(leaderboard|reyting|top)(\s+.*)?$/i, handleLeaderboard);

  // Bot /start greeting with helpful information for admins in private chat
  bot.start(async (ctx: any) => {
    if (ctx.chat?.type === "private") {
      await ctx.reply(
        `👋 <b>Assalomu alaykum!</b>\n\n` +
        `Men guruhlar nazoratchisi va takliflar hisobini yurituvchi botman.\n\n` +
        `<b>Administratorlar uchun shaxsiy xabarlardagi buyruqlar:</b>\n` +
        `• <code>/leaderboard</code> — Guruhlaringizdagi takliflar reytingini ko'rish (guruh tanlash tugmalari bilan)\n` +
        `• <code>/leaderboard &lt;guruh_id&gt; [sana]</code> — Aniq guruh va sana bo'yicha reytingni ko'rish\n\n` +
        `<b>Guruh ichida ishlatiladigan buyruqlar:</b>\n` +
        `• <code>/leaderboard</code> yoki <code>/top</code> — Guruh a'zolari takliflar reytingi\n` +
        `• <code>/auth</code> — Web boshqaruv paneliga kirish kodi olish\n` +
        `• <code>/sync</code> — Guruh a'zolarini to'liq sinxronlash`,
        { parse_mode: "HTML" }
      );
    }
  });
}
