import { checkDatabase } from "../db.js";

export async function checkAndRecordLeavesForGroup(telegram: any, chatId: string): Promise<number> {
  let detectedLeavesCount = 0;
  try {
    const dbClient = checkDatabase();

    // Sanity check: Ensure we can actually access the chat before scanning.
    try {
      await telegram.getChat(chatId);
    } catch (chatError: any) {
      console.warn(`[Scanning Leaves] Aborting leaves check: bot cannot access chat ${chatId} (${chatError.message || chatError}). Preserving all existing memberships in DB.`);
      return 0;
    }

    // Retrieve all database-registered memberships for this chat
    const { data: dbMembers, error } = await dbClient
      .from("memberships")
      .select("telegram_id")
      .eq("chat_id", chatId);

    if (error || !dbMembers || dbMembers.length === 0) {
      return 0;
    }

    console.log(`[Scanning Leaves] Verifying ${dbMembers.length} memberships against live Telegram API for chat ${chatId}`);

    for (const member of dbMembers) {
      const userId = member.telegram_id;
      let hasLeft = false;

      try {
        const chatMember = await telegram.getChatMember(chatId, parseInt(userId));
        if (chatMember.status === "left" || chatMember.status === "kicked") {
          hasLeft = true;
        }
      } catch (err: any) {
        const msg = (err.message || "").toLowerCase();
        if (
          (msg.includes("user") || msg.includes("participant") || msg.includes("member")) &&
          msg.includes("not found")
        ) {
          hasLeft = true;
        } else {
          console.warn(`[Scanning Leaves] Non-conclusive individual query error for user ${userId} in chat ${chatId}:`, err.message);
        }
      }

      if (hasLeft) {
        // 1. Remove group membership in DB
        await dbClient.from("memberships").delete().eq("id", `${chatId}_${userId}`);

        // 2. Check if a leave log exists for this user in this group to prevent duplicate counting
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
          detectedLeavesCount++;
          console.log(`[Scanning Leaves] User ${userId} successfully recorded as LEFT for chat ${chatId}`);
        }
      }

      // Small rate limit protection delay
      await new Promise(resolve => setTimeout(resolve, 30));
    }
  } catch (err) {
    console.error("Error in checkAndRecordLeavesForGroup:", err);
  }
  return detectedLeavesCount;
}
