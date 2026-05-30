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
