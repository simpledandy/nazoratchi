import { checkDatabase } from "../db.js";

export function registerBotMiddleware(bot: any) {
  // Middleware to register groups and delete system messages/commands
  bot.on("message", async (ctx: any, next: any) => {
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

    // Delete commands meant for our bot after reading
    if (msg.text && (msg.text.startsWith("/sync") || msg.text.startsWith("/auth"))) {
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
            isAdmin = adminsList.some((a: any) => a.user.id === ctx.from.id);
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
  bot.on("new_chat_members", async (ctx: any) => {
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

  // Track leaves via old API (legacy compatibility) with deduplication check
  bot.on("left_chat_member", async (ctx: any) => {
    const member = ctx.message.left_chat_member;
    const chatId = ctx.chat.id.toString();
    const userId = member.id.toString();
    
    try {
      const dbClient = checkDatabase();
      // Remove group membership
      await dbClient.from("memberships").delete().eq("id", `${chatId}_${userId}`);
      
      // Avoid double entry within a short timeframe
      const fifteenSecsAgo = new Date(Date.now() - 15000).toISOString();
      const { data: recLeaves } = await dbClient
        .from("leaves")
        .select("id")
        .eq("telegram_id", userId)
        .eq("chat_id", chatId)
        .gte("timestamp", fifteenSecsAgo);

      if (!recLeaves || recLeaves.length === 0) {
        await dbClient.from("leaves").insert({
          telegram_id: userId,
          chat_id: chatId,
          timestamp: new Date().toISOString()
        });
        console.log(`[LeftChatMember] Logged leave for user ${member.first_name} (${userId}) in group ${chatId}`);
      }
    } catch (err) {
      console.error("Error on left_chat_member handle:", err);
    }
  });

  // Track leaves via modern chat_member status updates (robust for supergroups)
  bot.on("chat_member", async (ctx: any) => {
    try {
      const update = ctx.update.chat_member;
      if (!update) return;

      const chatId = update.chat.id.toString();
      const user = update.new_chat_member.user;
      const userId = user.id.toString();
      
      const oldStatus = update.old_chat_member.status;
      const newStatus = update.new_chat_member.status;

      // Leaving transitions: from dynamic active membership states to left/kicked
      const wasMember = ["creator", "administrator", "member", "restricted"].includes(oldStatus);
      const isNowLeft = ["left", "kicked"].includes(newStatus);

      if (wasMember && isNowLeft) {
        const dbClient = checkDatabase();
        // Remove membership
        await dbClient.from("memberships").delete().eq("id", `${chatId}_${userId}`);

        // Avoid double entry within a short timeframe
        const fifteenSecsAgo = new Date(Date.now() - 15000).toISOString();
        const { data: recLeaves } = await dbClient
          .from("leaves")
          .select("id")
          .eq("telegram_id", userId)
          .eq("chat_id", chatId)
          .gte("timestamp", fifteenSecsAgo);

        if (!recLeaves || recLeaves.length === 0) {
          await dbClient.from("leaves").insert({
            telegram_id: userId,
            chat_id: chatId,
            timestamp: new Date().toISOString()
          });
          console.log(`[Real-time ChatMember] Logged leave for user ${user.first_name} (${userId}) in group ${chatId}`);
        }
      }
    } catch (err) {
      console.error("Error on chat_member update handle:", err);
    }
  });
}
