import { checkDatabase, ensureUserInDb } from "../db.js";

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
            if (ctx.chat && ctx.from) {
              const chatId = ctx.chat.id.toString();
              await ensureUserInDb(ctx.from.id, {
                username: ctx.from.username || "",
                firstName: ctx.from.first_name || "Guruh a'zosi",
                lastName: ctx.from.last_name || "",
                isBot: ctx.from.is_bot || false
              });

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

          // Fetch existing membership to track return status
          const { data: existingMembership } = await dbClient
            .from("memberships")
            .select("join_count, invited_by, invite_link, invite_link_name")
            .eq("id", `${chatId}_${inviteeId}`)
            .maybeSingle();

          const newJoinCount = existingMembership ? (existingMembership.join_count || 1) + 1 : 1;
          const finalInvitedBy = inviterId !== inviteeId ? inviterId : (existingMembership?.invited_by || null);

          // Ensure inviter user exists in users table to respect foreign keys
          if (finalInvitedBy && finalInvitedBy !== inviteeId) {
            await dbClient.from("users").upsert({
              telegram_id: finalInvitedBy,
              username: ctx.from.username || "",
              first_name: ctx.from.first_name || "Homi",
              last_name: ctx.from.last_name || "",
              is_bot: ctx.from.is_bot || false
            });
          }

          // Record group membership with new stats
          await dbClient.from("memberships").upsert({
            id: `${chatId}_${inviteeId}`,
            chat_id: chatId,
            telegram_id: inviteeId,
            username: member.username || "",
            first_name: member.first_name,
            last_name: member.last_name || "",
            joined_at: new Date().toISOString(),
            status: "active",
            left_at: null,
            invited_by: finalInvitedBy,
            invite_link: existingMembership?.invite_link || null,
            invite_link_name: existingMembership?.invite_link_name || null,
            join_count: newJoinCount
          });

          // Log invite if it's not the user joining themselves
          if (finalInvitedBy && finalInvitedBy !== inviteeId) {
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

            // Double check if invitation was already recorded
            const { data: existingInvite } = await dbClient
              .from("invites")
              .select("id")
              .eq("chat_id", chatId)
              .eq("inviter_id", finalInvitedBy)
              .eq("invitee_id", inviteeId)
              .maybeSingle();

            if (!existingInvite) {
              await dbClient.from("invites").insert({
                inviter_id: finalInvitedBy,
                invitee_id: inviteeId,
                chat_id: chatId,
                timestamp: new Date().toISOString(),
                contest_id: contestId ? contestId.toString() : null
              });
            }
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
      
      // Ensure user exists in users table first
      await ensureUserInDb(userId, {
        username: member.username || "",
        firstName: member.first_name || "Guruh a'zosi",
        lastName: member.last_name || "",
        isBot: member.is_bot || false
      });

      // Mark as left instead of deleting!
      await dbClient.from("memberships").update({
        status: "left",
        left_at: new Date().toISOString()
      }).eq("id", `${chatId}_${userId}`);
      
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

  // Track joins, returns, leaves, invitations, and invite links via modern chat_member status updates (robust for supergroups)
  bot.on("chat_member", async (ctx: any) => {
    try {
      const update = ctx.update.chat_member;
      if (!update) return;

      const chatId = update.chat.id.toString();
      const chatTitle = update.chat.title || "Guruh";
      const user = update.new_chat_member.user;
      const userId = user.id.toString();
      
      const oldStatus = update.old_chat_member.status;
      const newStatus = update.new_chat_member.status;

      const wasMember = ["creator", "administrator", "member", "restricted"].includes(oldStatus);
      const isNowMember = ["creator", "administrator", "member", "restricted"].includes(newStatus);
      const wasNotMember = !wasMember;
      const isNowLeft = ["left", "kicked"].includes(newStatus);

      const dbClient = checkDatabase();

      // 1. JOIN/RETURN TRANSITION
      if (wasNotMember && isNowMember) {
        // Save global user info
        await dbClient.from("users").upsert({
          telegram_id: userId,
          username: user.username || "",
          first_name: user.first_name,
          last_name: user.last_name || "",
          is_bot: user.is_bot,
          joined_at: new Date().toISOString()
        });

        // Determine invite source (who added who, or which invite link was used)
        let inviterId = null;
        let inviteLinkUrl = null;
        let inviteLinkName = null;

        if (update.invite_link) {
          inviteLinkUrl = update.invite_link.invite_link || null;
          inviteLinkName = update.invite_link.name || null;
          if (update.invite_link.creator) {
            inviterId = update.invite_link.creator.id.toString();
          }
        } else if (update.from && update.from.id.toString() !== userId) {
          inviterId = update.from.id.toString();
        }

        // Ensure the inviter also exists in our users table to respect foreign keys
        if (inviterId) {
          const inviterUser = (update.invite_link && update.invite_link.creator) ? update.invite_link.creator : update.from;
          await dbClient.from("users").upsert({
            telegram_id: inviterId,
            username: inviterUser.username || "",
            first_name: inviterUser.first_name || "Homi",
            last_name: inviterUser.last_name || "",
            is_bot: inviterUser.is_bot || false
          });
        }

        // Fetch existing membership to see if this is a repeat join (returning user)
        const { data: existingMembership } = await dbClient
          .from("memberships")
          .select("join_count, invited_by, invite_link, invite_link_name")
          .eq("id", `${chatId}_${userId}`)
          .maybeSingle();

        const newJoinCount = existingMembership ? (existingMembership.join_count || 1) + 1 : 1;

        // Preserve pre-existing referrer/link if not specified in current update
        const finalInvitedBy = inviterId || existingMembership?.invited_by || null;
        const finalInviteLink = inviteLinkUrl || existingMembership?.invite_link || null;
        const finalInviteLinkName = inviteLinkName || existingMembership?.invite_link_name || null;

        await dbClient.from("memberships").upsert({
          id: `${chatId}_${userId}`,
          chat_id: chatId,
          telegram_id: userId,
          username: user.username || "",
          first_name: user.first_name,
          last_name: user.last_name || "",
          joined_at: new Date().toISOString(),
          status: "active",
          left_at: null,
          invited_by: finalInvitedBy,
          invite_link: finalInviteLink,
          invite_link_name: finalInviteLinkName,
          join_count: newJoinCount
        });

        // Insert invitation ledger for contests if invited by someone other than themselves
        if (finalInvitedBy && finalInvitedBy !== userId) {
          const nowStr = new Date().toISOString();
          const { data: activeContest } = await dbClient
            .from("contests")
            .select("id")
            .eq("chat_id", chatId)
            .eq("is_active", true)
            .lte("start_date", nowStr)
            .gte("end_date", nowStr);

          const contestId = activeContest && activeContest.length > 0 ? activeContest[0].id : null;

          // Double check if this invitation has already been recorded
          const { data: existingInvite } = await dbClient
            .from("invites")
            .select("id")
            .eq("chat_id", chatId)
            .eq("inviter_id", finalInvitedBy)
            .eq("invitee_id", userId)
            .maybeSingle();

          if (!existingInvite) {
            await dbClient.from("invites").insert({
              inviter_id: finalInvitedBy,
              invitee_id: userId,
              chat_id: chatId,
              timestamp: new Date().toISOString(),
              contest_id: contestId ? contestId.toString() : null
            });
          }
        }

        console.log(`[ChatMember] Captured JOIN/RETURN for ${user.first_name} (${userId}) in ${chatId}. Return times: ${newJoinCount}`);
      }

      // 2. LEAVE TRANSITION
      if (wasMember && isNowLeft) {
        // Ensure user exists in users table first
        await ensureUserInDb(userId, {
          username: user.username || "",
          firstName: user.first_name || "Guruh a'zosi",
          lastName: user.last_name || "",
          isBot: user.is_bot || false
        });

        // Mark membership as left in DB instead of deleting it!
        await dbClient.from("memberships").update({
          status: "left",
          left_at: new Date().toISOString()
        }).eq("id", `${chatId}_${userId}`);

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
          console.log(`[ChatMember] Recorded LEAVE for ${user.first_name} (${userId}) in ${chatId}`);
        }
      }
    } catch (err) {
      console.error("Error on chat_member update handle:", err);
    }
  });
}
