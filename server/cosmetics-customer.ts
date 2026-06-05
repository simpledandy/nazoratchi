import { checkDatabase } from "./db.js";
import { isSupabaseConfigured, getDemoCustomers, addDemoCustomer } from "./cosmetics-store.js";

// ==========================================
// CUSTOMER SERVICES
// ==========================================

export async function getCustomers(chatId?: string) {
  if (isSupabaseConfigured()) {
    const dbClient = checkDatabase();
    let query = dbClient.from("sales_customers").select("*").order("name", { ascending: true });
    if (chatId) {
      query = query.eq("chat_id", chatId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } else {
    const demoCustomers = getDemoCustomers();
    return chatId ? demoCustomers.filter(c => c.chat_id === chatId) : demoCustomers;
  }
}

export async function createCustomer(body: {
  name: string;
  phone?: string;
  telegramId?: string | number;
  telegramUsername?: string;
  chatId?: string;
  notes?: string;
}) {
  const { name, phone, telegramId, telegramUsername, chatId, notes } = body;
  if (!name || !name.trim()) {
    throw new Error("Mijoz ismi kiritilishi shart!");
  }

  if (isSupabaseConfigured()) {
    const dbClient = checkDatabase();
    const { data, error } = await dbClient
      .from("sales_customers")
      .insert({
        name: name.trim(),
        phone: phone?.trim() || null,
        telegram_id: telegramId ? String(telegramId) : null,
        telegram_username: telegramUsername?.trim() || null,
        chat_id: chatId || null,
        notes: notes?.trim() || null,
        created_at: new Date().toISOString()
      })
      .select("*")
      .single();

    if (error) throw error;
    return data;
  } else {
    const newCust = {
      id: "cust-" + Date.now(),
      name: name.trim(),
      phone: phone?.trim() || "",
      telegram_username: telegramUsername?.trim() || "",
      telegram_id: telegramId ? String(telegramId) : "",
      chat_id: chatId || "",
      notes: notes?.trim() || "",
      created_at: new Date().toISOString()
    };
    addDemoCustomer(newCust);
    return newCust;
  }
}
