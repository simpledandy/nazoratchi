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
          status: "active",
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

    } catch (err: any) {
      console.error("Sync error:", err);
      try {
        await ctx.reply(`Xatolik yuz berdi: ${err.message}`);
      } catch (e) {}
    }
  });

  // /leaderboard and /top command: Shows who invited how many members since a set date
  const handleLeaderboard = async (ctx: any) => {
    try {
      if (!ctx.chat || (ctx.chat.type !== "group" && ctx.chat.type !== "supergroup")) {
        return ctx.reply("Ushbu buyruqni faqat guruhlarda ishlatish mumkin.");
      }

      const chatId = ctx.chat.id.toString();
      const chatTitle = (ctx.chat as any).title || "Guruh";

      // Extract argument after /leaderboard or #leaderboard
      const rawText = (ctx.message?.text || "").trim();
      let dateArg = ctx.payload ? String(ctx.payload).trim() : "";
      if (!dateArg && rawText) {
        // e.g. "/leaderboard 2026-09-01" or "#leaderboard 01.09.2026"
        const parts = rawText.split(/\s+/);
        if (parts.length > 1) {
          dateArg = parts.slice(1).join(" ").trim();
        }
      }

      const dbClient = checkDatabase();
      let sinceDate: Date | null = null;
      let dateLabel = "";
      let contestNotice = "";

      if (dateArg) {
        const parsed = parseSinceDate(dateArg);
        if (parsed.error || !parsed.date) {
          return ctx.reply(
            `⚠️ <b>Noto'g'ri sana formati!</b>\n\n` +
            `Iltimos, sanani quyidagi formatlardan birida kiriting:\n` +
            `• <code>/leaderboard 2026-09-01</code> (yil-oy-kun)\n` +
            `• <code>/leaderboard 01.09.2026</code> (kun.oy.yil)\n` +
            `• <code>/leaderboard 7d</code> (oxirgi 7 kun)\n` +
            `• <code>/leaderboard 30d</code> (oxirgi 30 kun)\n\n` +
            `<i>Yoki shunchaki <code>/leaderboard</code> deb yozsangiz, faol konkurs sanasidan hisoblanadi.</i>`,
            { parse_mode: "HTML" }
          );
        }
        if (parsed.date.getTime() > Date.now()) {
          return ctx.reply(
            `⚠️ Kiritilgan sana kelajakda (${parsed.date.toLocaleDateString("uz-UZ")}). Iltimos, o'tgan yoki bugungi sanani kiriting.`
          );
        }
        sinceDate = parsed.date;
        dateLabel = parsed.label || sinceDate.toLocaleDateString("uz-UZ");
      } else {
        // No date argument passed: check if there is an active contest for this group
        const { data: activeContests } = await dbClient
          .from("contests")
          .select("title, start_date")
          .eq("chat_id", chatId)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1);

        if (activeContests && activeContests.length > 0) {
          const contest = activeContests[0];
          sinceDate = new Date(contest.start_date);
          dateLabel = sinceDate.toLocaleDateString("uz-UZ");
          contestNotice = `🎯 <b>Faol konkurs:</b> ${contest.title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}\n`;
        } else {
          dateLabel = "Barcha vaqt bo'yicha";
        }
      }

      // Query invites recorded for this group
      let invitesQuery = dbClient
        .from("invites")
        .select("inviter_id, invitee_id, timestamp")
        .eq("chat_id", chatId);

      if (sinceDate) {
        invitesQuery = invitesQuery.gte("timestamp", sinceDate.toISOString());
      }

      const { data: invites, error: invitesErr } = await invitesQuery;
      if (invitesErr) throw invitesErr;

      const escapedTitle = chatTitle.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

      if (!invites || invites.length === 0) {
        return ctx.reply(
          `🏆 <b>Takliflar Reytingi (Leaderboard)</b>\n` +
          `👥 <b>Guruh:</b> <i>${escapedTitle}</i>\n` +
          (contestNotice ? `${contestNotice}` : "") +
          `📅 <b>Ko'rilayotgan davr:</b> ${sinceDate ? `${dateLabel} dan boshlab` : dateLabel}\n\n` +
          `Hozircha ushbu muddat oralig'ida guruhga hech kim a'zo taklif qilmagan.\n\n` +
          `Do'stlaringizni taklif qiling va reytingda 1-o'rinni egallang! 🚀\n\n` +
          `ℹ️ <i>Boshqa sanadan boshlab ko'rish uchun:</i>\n` +
          `<code>/leaderboard YYYY-MM-DD</code> (masalan: <code>/leaderboard 2026-09-01</code> yoki <code>/leaderboard 7d</code>)`,
          { parse_mode: "HTML" }
        );
      }

      // Tally invitations per inviter
      const counts: Record<string, number> = {};
      const inviterInviteesMap: Record<string, string[]> = {};

      for (const inv of invites) {
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

      // Fetch user profile details
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

      // Check current active status of invited members
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

      const medalIcons = ["🥇", "🥈", "🥉"];
      const lines = sortedEntries.map(([id, totalCount], index) => {
        const u = userMap[id] || { name: "Noma'lum foydalanuvchi", username: "" };
        const escapedName = u.name.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const userTag = u.username ? ` (@${u.username})` : "";
        const rankIcon = index < 3 ? medalIcons[index] : `${index + 1}.`;
        
        const invitees = inviterInviteesMap[id] || [];
        const activeCount = invitees.filter(invId => activeInviteesSet.has(invId)).length;
        const retentionText = activeCount < totalCount ? ` <i>(${activeCount} ta faol)</i>` : "";

        return `${rankIcon} <b>${escapedName}</b>${userTag} — <b>${totalCount}</b> ta taklif${retentionText}`;
      });

      const totalInvitesInPeriod = invites.length;
      const totalUniqueInviters = Object.keys(counts).length;

      const responseMessage = 
        `🏆 <b>Takliflar Reytingi (Leaderboard)</b>\n` +
        `👥 <b>Guruh:</b> <i>${escapedTitle}</i>\n` +
        (contestNotice ? `${contestNotice}` : "") +
        `📅 <b>Sana:</b> ${sinceDate ? `${dateLabel} dan boshlab` : "Barcha vaqt bo'yicha"}\n` +
        `📊 <b>Jami takliflar:</b> ${totalInvitesInPeriod} ta (${totalUniqueInviters} ta faol ishtirokchi)\n` +
        `────────────────────\n\n` +
        lines.join("\n") +
        `\n\n────────────────────\n` +
        `ℹ️ <i>Boshqa sanadan boshlab ko'rish:</i>\n` +
        `<code>/leaderboard YYYY-MM-DD</code> (masalan: <code>/leaderboard 2026-09-01</code> yoki <code>/leaderboard 7d</code>)`;

      await ctx.reply(responseMessage, { parse_mode: "HTML" });
    } catch (err: any) {
      console.error("Leaderboard command error:", err);
      try {
        await ctx.reply(`Xatolik yuz berdi: ${err.message}`);
      } catch (e) {}
    }
  };

  // Register leaderboard command across multiple intuitive aliases
  bot.command("leaderboard", handleLeaderboard);
  bot.command("top", handleLeaderboard);
  bot.command("reyting", handleLeaderboard);
  bot.hears(/^#?(leaderboard|reyting|top)(\s+.*)?$/i, handleLeaderboard);
}
