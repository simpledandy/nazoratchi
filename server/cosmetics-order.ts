import { checkDatabase } from "./db.js";
import { 
  isSupabaseConfigured, 
  computeOutstandingStatuses, 
  getDemoCustomers, 
  getDemoOrders, 
  getDemoOrderItems, 
  getDemoPayments,
  addDemoOrder,
  addDemoOrderItem,
  setDemoOrders,
  setDemoOrderItems,
  setDemoPayments
} from "./cosmetics-store.js";

// ==========================================
// SALES ORDERS SERVICES
// ==========================================

export async function getOrders(chatId?: string) {
  if (isSupabaseConfigured()) {
    const dbClient = checkDatabase();
    let query = dbClient.from("sales_orders").select("*, sales_customers(*)");
    if (chatId) {
      query = query.eq("chat_id", chatId);
    }
    const { data: orders, error: oError } = await query.order("sale_date", { ascending: false });
    if (oError) throw oError;

    const orderIds = (orders || []).map(o => o.id);
    let itemsData: any[] = [];
    let paymentsData: any[] = [];

    if (orderIds.length > 0) {
      const { data: items, error: iError } = await dbClient
        .from("sales_order_items")
        .select("*")
        .in("order_id", orderIds);
      if (iError) throw iError;
      itemsData = items || [];

      const { data: payments, error: pError } = await dbClient
        .from("sales_payments")
        .select("*")
        .in("order_id", orderIds);
      if (pError) throw pError;
      paymentsData = payments || [];
    }

    return (orders || []).map(o => {
      const oItems = itemsData.filter(i => i.order_id === o.id);
      const oPayments = paymentsData.filter(p => p.order_id === o.id);
      const paidAmount = oPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      return {
        id: o.id,
        customerId: o.customer_id,
        customerName: o.sales_customers?.name || "Noma'lum Mijoz",
        customerPhone: o.sales_customers?.phone || "",
        chatId: o.chat_id,
        saleDate: o.sale_date,
        totalAmount: Number(o.total_amount),
        totalPoints: Number(o.total_points),
        status: o.status,
        notes: o.notes,
        items: oItems.map(i => ({
          id: i.id,
          productCode: i.product_code,
          productName: i.product_name,
          quantity: i.quantity,
          unitPrice: Number(i.unit_price),
          points: Number(i.points || 0)
        })),
        paidAmount,
        outstandingBalance: Math.max(0, Number(o.total_amount) - paidAmount)
      };
    });
  } else {
    const demoOrders = getDemoOrders();
    const demoPayments = getDemoPayments();
    const demoCustomers = getDemoCustomers();
    const demoOrderItems = getDemoOrderItems();

    computeOutstandingStatuses(demoOrders, demoPayments);
    const ordersToMap = chatId ? demoOrders.filter(o => o.chat_id === chatId) : demoOrders;

    const formatted = ordersToMap.map(o => {
      const custObj = demoCustomers.find(c => c.id === o.customer_id);
      const oItems = demoOrderItems.filter(i => i.order_id === o.id);
      const oPayments = demoPayments.filter(p => p.order_id === o.id);
      const paidAmount = oPayments.reduce((sum, p) => sum + p.amount, 0);

      return {
        id: o.id,
        customerId: o.customer_id,
        customerName: custObj ? custObj.name : "Noma'lum Mijoz",
        customerPhone: custObj ? custObj.phone : "",
        chatId: o.chat_id,
        saleDate: o.sale_date,
        totalAmount: o.total_amount,
        totalPoints: o.total_points,
        status: o.status,
        notes: o.notes,
        items: oItems.map(i => ({
          id: i.id,
          productCode: i.product_code,
          productName: i.product_name,
          quantity: i.quantity,
          unitPrice: i.unit_price,
          points: i.points
        })),
        paidAmount,
        outstandingBalance: Math.max(0, o.total_amount - paidAmount)
      };
    });

    formatted.sort((a, b) => b.saleDate.localeCompare(a.saleDate));
    return formatted;
  }
}

export async function createOrder(body: {
  customerId: string;
  chatId?: string;
  saleDate?: string;
  notes?: string;
  items: any[];
}) {
  const { customerId, chatId, saleDate, notes, items } = body;

  if (!customerId) {
    throw new Error("Mijoz tanlanishi shart!");
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error("Kamida bitta mahsulot qo'shilishi shart!");
  }

  let totalAmount = 0;
  let totalPoints = 0;
  const finalItems = items.map((item: any) => {
    const q = parseInt(item.quantity) || 1;
    const price = parseFloat(item.unitPrice) || 0;
    const pts = parseFloat(item.points) || 0;
    totalAmount += q * price;
    totalPoints += q * pts;
    return {
      product_code: item.productCode || "",
      product_name: item.productName || "Noma'lum Mahsulot",
      quantity: q,
      unit_price: price,
      points: pts
    };
  });

  const parsedSaleDate = saleDate || new Date().toISOString();

  if (isSupabaseConfigured()) {
    const dbClient = checkDatabase();
    
    const { data: orderData, error: orderError } = await dbClient
      .from("sales_orders")
      .insert({
        customer_id: customerId,
        chat_id: chatId || null,
        sale_date: parsedSaleDate,
        total_amount: totalAmount,
        total_points: totalPoints,
        status: "unpaid",
        notes: notes?.trim() || null,
        created_at: new Date().toISOString()
      })
      .select("*")
      .single();

    if (orderError) throw orderError;

    const itemsToInsert = finalItems.map(item => ({
      order_id: orderData.id,
      product_code: item.product_code,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      points: item.points
    }));

    const { error: itemsError } = await dbClient
      .from("sales_order_items")
      .insert(itemsToInsert);

    if (itemsError) throw itemsError;

    return { success: true, orderId: orderData.id, amount: totalAmount };
  } else {
    const newOrderId = "ord-" + Date.now();
    const newOrder = {
      id: newOrderId,
      customer_id: customerId,
      chat_id: chatId || "",
      sale_date: parsedSaleDate,
      total_amount: totalAmount,
      total_points: totalPoints,
      status: "unpaid",
      notes: notes?.trim() || "",
      created_at: new Date().toISOString()
    };

    addDemoOrder(newOrder);

    finalItems.forEach((item, index) => {
      addDemoOrderItem({
        id: `item-${newOrderId}-${index}`,
        order_id: newOrderId,
        product_code: item.product_code,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        points: item.points
      });
    });

    return { success: true, orderId: newOrderId, amount: totalAmount };
  }
}

export async function deleteOrder(orderId: string) {
  if (isSupabaseConfigured()) {
    const dbClient = checkDatabase();
    const { error } = await dbClient
      .from("sales_orders")
      .delete()
      .eq("id", orderId);
    if (error) throw error;
    return { success: true };
  } else {
    const nextOrders = getDemoOrders().filter(o => o.id !== orderId);
    const nextItems = getDemoOrderItems().filter(i => i.order_id !== orderId);
    const nextPayments = getDemoPayments().filter(p => p.order_id !== orderId);
    
    setDemoOrders(nextOrders);
    setDemoOrderItems(nextItems);
    setDemoPayments(nextPayments);
    return { success: true };
  }
}
