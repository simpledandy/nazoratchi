import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

export function checkDatabase() {
  if (!supabase) {
    throw new Error("SUPABASE_URL va SUPABASE_ANON_KEY atrof-muhit o'zgaruvchilari sozlanmagan! Iltimos, Supabase sozlamalarini kiriting.");
  }
  return supabase;
}

export async function ensureUserInDb(
  telegramId: string | number,
  fallback: { username?: string; firstName?: string; lastName?: string; isBot?: boolean } = {}
) {
  const tId = String(telegramId);
  if (!tId || tId === "undefined" || tId === "null" || tId === "") return;

  try {
    const dbClient = checkDatabase();
    
    // First, check if the user is already registered in the "users" table.
    const { data: existingUser, error: fetchError } = await dbClient
      .from("users")
      .select("telegram_id")
      .eq("telegram_id", tId)
      .maybeSingle();

    if (fetchError) {
      console.error(`[ensureUserInDb] Error searching for user ${tId}:`, fetchError.message);
    }

    if (!existingUser) {
      const username = fallback.username || "";
      const firstName = fallback.firstName?.trim() || "Guruh a'zosi";
      const lastName = fallback.lastName?.trim() || "";
      const isBot = fallback.isBot || false;

      const { error: insertError } = await dbClient.from("users").insert({
        telegram_id: tId,
        username,
        first_name: firstName,
        last_name: lastName,
        is_bot: isBot,
        joined_at: new Date().toISOString()
      });

      if (insertError) {
        // Try to do a silent upsert or log error
        console.error(`[ensureUserInDb] Error inserting missing user ${tId}:`, insertError.message);
      } else {
        console.log(`[Database] Automatically ensured user: inserted missing user ${tId} (${firstName})`);
      }
    }
  } catch (err: any) {
    console.error(`[ensureUserInDb] Unexpected outer error ensuring user ${tId}:`, err.message || err);
  }
}
