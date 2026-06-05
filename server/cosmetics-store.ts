import { checkDatabase } from "./db.js";

// ==========================================
// IN-MEMORY FALLBACK STORE FOR DEMO MODE
// ==========================================
let demoCustomers: any[] = [
  { id: "cust-1", name: "Dilnoza Aliyeva", phone: "+998 90 123 45 67", telegram_username: "dilnoza_la", telegram_id: "12345", chat_id: "", notes: "VIP Doimiy mijoz, Namlantiruvchi krem yoqtiradi.", created_at: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString() },
  { id: "cust-2", name: "Kamola Umarova", phone: "+998 94 987 65 43", telegram_username: "kamola_u", telegram_id: "", chat_id: "", notes: "Ikra va vitamin zardoblari buyurtmachisi.", created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString() },
  { id: "cust-3", name: "Shahnoza Karitova", phone: "+998 93 456 11 22", telegram_username: "shahnozu", telegram_id: "782910", chat_id: "", notes: "Telegram guruhidan kelgan mijoz.", created_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString() }
];

let demoOrders: any[] = [
  {
    id: "ord-1",
    customer_id: "cust-1",
    chat_id: "",
    sale_date: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
    total_amount: 185000,
    total_points: 13.2,
    status: "partially_paid",
    notes: "Alohida chegirma bilan kelishildi.",
    created_at: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString()
  },
  {
    id: "ord-2",
    customer_id: "cust-2",
    chat_id: "",
    sale_date: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
    total_amount: 125000,
    total_points: 9.0,
    status: "paid",
    notes: "Yetkazib berish vaqtida uchrashildi.",
    created_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString()
  },
  {
    id: "ord-3",
    customer_id: "cust-3",
    chat_id: "",
    sale_date: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
    total_amount: 320000,
    total_points: 24.0,
    status: "unpaid",
    notes: "Oylik olganda to'lashini aytdi.",
    created_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString()
  }
];

let demoOrderItems: any[] = [
  { id: "item-1", order_id: "ord-1", product_code: "1033", product_name: "Vitamin C Serum", quantity: 1, unit_price: 185000, points: 13.2 },
  { id: "item-2", order_id: "ord-2", product_code: "1034", product_name: "Snail extract cream", quantity: 1, unit_price: 125000, points: 9.0 },
  { id: "item-3", order_id: "ord-3", product_code: "1110", product_name: "Hyaluronic Acid essence", quantity: 1, unit_price: 150000, points: 12.0 },
  { id: "item-4", order_id: "ord-3", product_code: "1110", product_name: "Hyaluronic Acid essence", quantity: 1, unit_price: 170000, points: 12.0 }
];

let demoPayments: any[] = [
  { id: "pay-1", customer_id: "cust-1", order_id: "ord-1", amount: 100000, payment_date: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(), payment_method: "click", notes: "Karta orqali birinchi bo'nak to'lovi.", created_at: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString() },
  { id: "pay-2", customer_id: "cust-2", order_id: "ord-2", amount: 125000, payment_date: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(), payment_method: "cash", notes: "Naqd pul bilan to'liq yopildi.", created_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString() }
];

export function isSupabaseConfigured(): boolean {
  return !!process.env.SUPABASE_URL && !!process.env.SUPABASE_ANON_KEY;
}

// Reusable function to dynamically resolve a customer's total sales, payments and outstanding debt
export function computeOutstandingStatuses(orders: any[], payments: any[]) {
  orders.forEach(order => {
    const orderPays = payments.filter(p => p.order_id === order.id);
    const paidSum = orderPays.reduce((acc, p) => acc + p.amount, 0);
    if (paidSum >= order.total_amount) {
      order.status = "paid";
    } else if (paidSum > 0) {
      order.status = "partially_paid";
    } else {
      order.status = "unpaid";
    }
  });
}

// Getters and Mutators for Demo State
export function getDemoCustomers() {
  return demoCustomers;
}

export function addDemoCustomer(customer: any) {
  demoCustomers.push(customer);
}

export function getDemoOrders() {
  return demoOrders;
}

export function addDemoOrder(order: any) {
  demoOrders.push(order);
}

export function setDemoOrders(newOrders: any[]) {
  demoOrders = newOrders;
}

export function getDemoOrderItems() {
  return demoOrderItems;
}

export function addDemoOrderItem(item: any) {
  demoOrderItems.push(item);
}

export function setDemoOrderItems(newItemList: any[]) {
  demoOrderItems = newItemList;
}

export function getDemoPayments() {
  return demoPayments;
}

export function addDemoPayment(payment: any) {
  demoPayments.push(payment);
}

export function setDemoPayments(newPayments: any[]) {
  demoPayments = newPayments;
}
