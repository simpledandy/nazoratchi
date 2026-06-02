import { Telegraf } from "telegraf";
import { supabase, checkDatabase } from "./db.js";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  console.warn("TELEGRAM_BOT_TOKEN is not set. Bot features will be disabled.");
}

export const bot = BOT_TOKEN ? new Telegraf(BOT_TOKEN) : null;

if (bot) {
  // Middleware to register groups and delete system messages/commands
  bot.on("message", async (ctx, next) => {
    const msg = ctx.message as any;
    
    // Register the group if message is in a group/supergroup/channel
    if (ctx.chat && (ctx.chat.type === "group" || ctx.chat.type === "supergroup" || (ctx.chat.type as any) === "channel")) {
      const chatId = ctx.chat.id.toString();
      const chatTitle = (ctx.chat as any).title || "Guruh nomi topilmadi";
      try {
        const dbClient = checkDatabase();
        await dbClient.from("groups").upsert({
          id: chatId,
          title: chatTitle,
          last_active_at: new Date().toISOString()
        });

        // Passive user discovery: upsert active sender into users and memberships
        if (ctx.from) {
          const userId = ctx.from.id.toString();
          await dbClient.from("users").upsert({
            telegram_id: userId,
            username: ctx.from.username || "",
            first_name: ctx.from.first_name,
            last_name: ctx.from.last_name || "",
            joined_at: new Date().toISOString(),
            is_bot: ctx.from.is_bot
          });

          await dbClient.from("memberships").upsert({
            id: `${chatId}_${userId}`,
            chat_id: chatId,
            telegram_id: userId,
            username: ctx.from.username || "",
            first_name: ctx.from.first_name,
            last_name: ctx.from.last_name || "",
            joined_at: new Date().toISOString()
          });
        }
      } catch (e: any) {
        console.error("Error storing details in passive discovery:", e.message);
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
          const linksMatched = text.match(/https?:\/\/[^\s]+/g) || text.match(/t\.me\/[^\s]+/g) || [];
          const extractedLink = linksMatched.join(", ") || text;

          let isAdmin = false;
          try {
            // Robust check via administrators list
            const adminsList = await ctx.getChatAdministrators();
            isAdmin = adminsList.some(a => a.user.id === ctx.from.id);
          } catch (err) {
            console.error("Failed to check chat member status:", err);
          }
          const isDeleted = !isAdmin;

          // Store links in Supabase
          try {
            const dbClient = checkDatabase();
            if (ctx.chat) {
              const chatId = ctx.chat.id.toString();
              await dbClient.from("link_logs").insert({
                chat_id: chatId,
                sender_id: ctx.from.id.toString(),
                sender_username: ctx.from.username || "",
                sender_name: `${ctx.from.first_name} ${ctx.from.last_name || ""}`.trim(),
                message_text: text,
                extracted_link: extractedLink,
                is_deleted: isDeleted,
                timestamp: new Date().toISOString()
              });
            }
          } catch (e: any) {
            console.error("Error storing link log in Supabase:", e.message);
          }
          
          if (!isAdmin) {
            await ctx.deleteMessage();
            await ctx.reply(`Hurmatli ${ctx.from.first_name}, guruhda tashqi havolalar ulashish taqiqlangan!`, {
              reply_parameters: { message_id: ctx.message.message_id }
            });
          }
        } catch (e) {
          console.error("Error checking link:", e);
        }
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
      const dbClient = checkDatabase();
      await dbClient.from("groups").upsert({
        id: chatId,
        title: chatTitle,
        last_active_at: new Date().toISOString()
      });
    } catch (e) {}

    if (newMembers && Array.isArray(newMembers)) {
      for (const member of newMembers) {
        const inviteeId = member.id.toString();
        
        try {
          const dbClient = checkDatabase();
          // Save global user info
          await dbClient.from("users").upsert({
            telegram_id: inviteeId,
            username: member.username || "",
            first_name: member.first_name,
            last_name: member.last_name || "",
            joined_at: new Date().toISOString(),
            is_bot: member.is_bot
          });

          // Record group membership
          await dbClient.from("memberships").upsert({
            id: `${chatId}_${inviteeId}`,
            chat_id: chatId,
            telegram_id: inviteeId,
            username: member.username || "",
            first_name: member.first_name,
            last_name: member.last_name || "",
            joined_at: new Date().toISOString()
          });

          // Log invite if it's not the user joining themselves
          if (inviterId !== inviteeId) {
            // Find active contest in this specific group
            const nowStr = new Date().toISOString();
            const { data: activeContest } = await dbClient
              .from("contests")
              .select("id")
              .eq("chat_id", chatId)
              .eq("is_active", true)
              .lte("start_date", nowStr)
              .gte("end_date", nowStr);

            const contestId = activeContest && activeContest.length > 0 ? activeContest[0].id : null;

            await dbClient.from("invites").insert({
              inviter_id: inviterId,
              invitee_id: inviteeId,
              chat_id: chatId,
              timestamp: new Date().toISOString(),
              contest_id: contestId ? contestId.toString() : null
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
      const dbClient = checkDatabase();
      // Remove group membership
      await dbClient.from("memberships").delete().eq("id", `${chatId}_${member.id}`);
      
      await dbClient.from("leaves").insert({
        telegram_id: member.id.toString(),
        chat_id: chatId,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error on left_chat_member handle:", err);
    }
  });

  // #contest command
  bot.hears(/#contest/i, async (ctx) => {
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
  bot.command("auth", async (ctx) => {
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
        isUserAdminOrCreator = admins.some(a => a.user.id === ctx.from?.id);
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
      const { generateVerificationCode } = await import("./auth-store.js");
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
  bot.command("sync", async (ctx) => {
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
        isUserAdminOrCreator = admins.some(a => a.user.id === ctx.from?.id);
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
          joined_at: new Date().toISOString()
        });

        importedCount++;
      }

      const replyMsg = await ctx.reply(
        `✅ <b>Birlashish (Sync) yakunlandi!</b>\n\n` +
        `📊 <b>Guruh a'zolari soni (Telegram API):</b> ${realMemberCount} ta\n` +
        `👤 <b>Ro'yxatdan o'tgan administratorlar:</b> ${importedCount} ta\n\n` +
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

  // Only launch polling if NOT running on Vercel
  const isVercel = process.env.VERCEL === "1" || process.env.NOW_DEPLOYMENT !== undefined;
  if (!isVercel) {
    bot.launch()
      .then(() => {
        console.log("Telegram bot started in POLLING mode (local development)");
      })
      .catch((err) => {
        console.error("Failed to start bot in polling mode:", err);
      });
  } else {
    console.log("Running in Vercel/Serverless environment. Polling disabled; waiting for webhook updates.");
  }
}
