import { checkDatabase } from "../db.js";
import { checkAndRecordLeavesForGroup } from "./leaves.js";
import { generateVerificationCode } from "../auth-store.js";

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
}
