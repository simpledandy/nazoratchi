import { checkDatabase } from "./db.js";
import { 
  isSupabaseConfigured, 
  getDemoCustomers, 
  getDemoOrders, 
  getDemoOrderItems, 
  getDemoPayments 
} from "./cosmetics-store.js";

// ==========================================
// BUSINESS OPTIMIZATION METRICS
// ==========================================

export async function getBusinessMetrics(chatId?: string) {
  let ordersList: any[] = [];
  let paymentsList: any[] = [];
  let customersList: any[] = [];
  let itemsList: any[] = [];

  if (isSupabaseConfigured()) {
    const dbClient = checkDatabase();
    const { data: custs } = await dbClient.from("sales_customers").select("*");
    customersList = custs || [];

    const { data: ords } = chatId 
      ? await dbClient.from("sales_orders").select("*").eq("chat_id", chatId)
      : await dbClient.from("sales_orders").select("*");
    ordersList = ords || [];

    const oIds = ordersList.map(o => o.id);
    
    if (ordersList.length > 0) {
      const { data: parts } = await dbClient.from("sales_order_items").select("*").in("order_id", oIds);
      itemsList = parts || [];

      const { data: pays } = await dbClient.from("sales_payments").select("*").in("order_id", oIds);
      paymentsList = pays || [];
    }
  } else {
    customersList = getDemoCustomers();
    ordersList = chatId ? getDemoOrders().filter(o => o.chat_id === chatId) : getDemoOrders();
    const oIds = ordersList.map(o => o.id);
    itemsList = getDemoOrderItems().filter(i => oIds.includes(i.order_id));
    paymentsList = getDemoPayments().filter(p => p.order_id && oIds.includes(p.order_id));
  }

  const totalSalesRevenue = ordersList.reduce((acc, o) => acc + Number(o.total_amount), 0);
  const totalPointsGenerated = ordersList.reduce((acc, o) => acc + Number(o.total_points || 0), 0);
  const totalCollectedPayments = paymentsList.reduce((acc, p) => acc + Number(p.amount), 0);
  const totalOutstandingDebt = Math.max(0, totalSalesRevenue - totalCollectedPayments);

  // Best Sellers Calculation
  const productAggregates: Record<string, { name: string; qty: number; revenue: number; points: number }> = {};
  itemsList.forEach(item => {
    const code = item.product_code;
    const qty = Number(item.quantity);
    const rev = qty * Number(item.unit_price);
    const pts = qty * Number(item.points || 0);

    if (!productAggregates[code]) {
      productAggregates[code] = {
        name: item.product_name,
        qty: 0,
        revenue: 0,
        points: 0
      };
    }
    productAggregates[code].qty += qty;
    productAggregates[code].revenue += rev;
    productAggregates[code].points += pts;
  });

  const bestSellers = Object.entries(productAggregates)
    .map(([code, data]) => ({
      code,
      name: data.name,
      quantitySold: data.qty,
      revenue: data.revenue,
      points: data.points
    }))
    .sort((a, b) => b.quantitySold - a.quantitySold)
    .slice(0, 10);

  // Customer performance Calculation
  const customerAggregates: Record<string, { name: string; totalBought: number; totalPaid: number; debtorSince: string }> = {};
  
  customersList.forEach(c => {
    customerAggregates[c.id] = { name: c.name, totalBought: 0, totalPaid: 0, debtorSince: c.created_at };
  });

  ordersList.forEach(order => {
    if (customerAggregates[order.customer_id]) {
      customerAggregates[order.customer_id].totalBought += Number(order.total_amount);
    } else {
      customerAggregates[order.customer_id] = { name: "Noma'lum Mijoz", totalBought: Number(order.total_amount), totalPaid: 0, debtorSince: order.sale_date };
    }
  });

  paymentsList.forEach(pay => {
    if (customerAggregates[pay.customer_id]) {
      customerAggregates[pay.customer_id].totalPaid += Number(pay.amount);
    }
  });

  const customerPerformance = Object.entries(customerAggregates)
    .map(([id, info]) => {
      const balance = Math.max(0, info.totalBought - info.totalPaid);
      return {
        customerId: id,
        customerName: info.name,
        totalOrdersAmount: info.totalBought,
        totalPaidAmount: info.totalPaid,
        outstandingDebt: balance,
        debtorSince: info.debtorSince
      };
    })
    .sort((a, b) => b.totalOrdersAmount - a.totalOrdersAmount)
    .slice(0, 10);

  const topDebtors = customerPerformance
    .filter(c => c.outstandingDebt > 0)
    .sort((a, b) => b.outstandingDebt - a.outstandingDebt);

  // Channel Analysis
  const groupSales: Record<string, number> = {};
  ordersList.forEach(order => {
    const gId = order.chat_id || "direct_sales";
    groupSales[gId] = (groupSales[gId] || 0) + Number(order.total_amount);
  });

  const channelPerformance = Object.entries(groupSales).map(([gId, rev]) => ({
    channelId: gId,
    channelName: gId === "direct_sales" ? "To'g'ridan-to'g'ri (Guruhsiz)" : "Telegram Guruh / " + gId,
    revenueGenerated: rev
  })).sort((a, b) => b.revenueGenerated - a.revenueGenerated);

  return {
    summary: {
      totalSalesRevenue,
      totalCollectedPayments,
      totalOutstandingDebt,
      totalPointsGenerated,
      activeCustomersCount: customersList.length,
      totalOrdersCount: ordersList.length
    },
    bestSellers,
    customerPerformance,
    topDebtors,
    channelPerformance
  };
}
