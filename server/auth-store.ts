import { supabase } from "./db.js";

export interface VerificationCode {
  code: string;
  chatId: string;
  chatTitle: string;
  userId: string;
  expiresAt: number;
}

// In-memory store for local/dev fallback
const codes = new Map<string, VerificationCode>();

export async function generateVerificationCode(chatId: string, chatTitle: string, userId: string): Promise<string> {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const now = Date.now();

  // Local state sync
  codes.set(code, {
    code,
    chatId,
    chatTitle,
    userId,
    expiresAt: now + 10 * 60 * 1000
  });

  // DB persistent backup (immune to Vercel stateless cold-starts & multi-instance routing)
  if (supabase) {
    try {
      // First clean up expired entries we made in DB to keep database tidy
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      await supabase
        .from("link_logs")
        .delete()
        .eq("sender_username", "AUTH_CODE")
        .lt("timestamp", tenMinutesAgo);

      // Save new verification code
      await supabase.from("link_logs").insert({
        chat_id: chatId,
        sender_id: userId,
        sender_username: "AUTH_CODE",
        sender_name: chatTitle,
        message_text: code,
        extracted_link: "AUTH_SESSION",
        is_deleted: true,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to back up verification code in DB:", err);
    }
  }

  return code;
}

export async function verifyCode(code: string): Promise<VerificationCode | null> {
  const now = Date.now();

  // 1. Try local/in-memory first
  const memoryInfo = codes.get(code);
  if (memoryInfo) {
    codes.delete(code);
    if (memoryInfo.expiresAt >= now) {
      // Clean up backup in db asynchronously
      if (supabase) {
        try {
          await supabase.from("link_logs").delete().eq("sender_username", "AUTH_CODE").eq("message_text", code);
        } catch (e) {}
      }
      return memoryInfo;
    }
  }

  // 2. Fallback to Supabase Database (for distributed/serverless systems on Vercel)
  if (supabase) {
    try {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from("link_logs")
        .select("*")
        .eq("sender_username", "AUTH_CODE")
        .eq("message_text", code)
        .gte("timestamp", tenMinutesAgo)
        .order("timestamp", { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const record = data[0];
        
        // Single-use: delete immediately
        await supabase
          .from("link_logs")
          .delete()
          .eq("sender_username", "AUTH_CODE")
          .eq("message_text", code);

        return {
          code,
          chatId: record.chat_id,
          chatTitle: record.sender_name || "Guruh",
          userId: record.sender_id || "",
          expiresAt: new Date(record.timestamp).getTime() + 10 * 60 * 1000
        };
      }
    } catch (err) {
      console.error("Failed to query verification code from DB fallback:", err);
    }
  }

  return null;
}
