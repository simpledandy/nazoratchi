import { checkDatabase } from "./db.js";
import { 
  isSupabaseConfigured, 
  computeOutstandingStatuses, 
  getDemoCustomers, 
  getDemoOrders, 
  getDemoPayments,
  addDemoPayment,
  setDemoPayments
} from "./cosmetics-store.js";

// ==========================================
// PAYMENT / TRANSACTIONS SERVICES
// ==========================================

export async function getPayments() {
  if (isSupabaseConfigured()) {
    const dbClient = checkDatabase();
    const { data: payments, error } = await dbClient
      .from("sales_payments")
      .select("*, sales_customers(*)")
      .order("payment_date", { ascending: false });

    if (error) throw error;

    return (payments || []).map(p => ({
      id: p.id,
      customerId: p.customer_id,
      customerName: p.sales_customers?.name || "Noma'lum Mijoz",
      orderId: p.order_id,
      amount: Number(p.amount),
      paymentDate: p.payment_date,
      paymentMethod: p.payment_method,
      notes: p.notes,
      createdAt: p.created_at
    }));
  } else {
    const demoPayments = getDemoPayments();
    const demoCustomers = getDemoCustomers();

    const formatted = demoPayments.map(p => {
      const custObj = demoCustomers.find(c => c.id === p.customer_id);
      return {
        id: p.id,
        customerId: p.customer_id,
        customerName: custObj ? custObj.name : "Noma'lum",
        orderId: p.order_id,
        amount: p.amount,
        paymentDate: p.payment_date,
        paymentMethod: p.payment_method,
        notes: p.notes,
        createdAt: p.created_at
      };
    });

    formatted.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
    return formatted;
  }
}

export async function createPayment(body: {
  customerId: string;
  orderId?: string | null;
  amount: number | string;
  paymentDate?: string;
  paymentMethod?: string;
  notes?: string;
}) {
  const { customerId, orderId, amount, paymentDate, paymentMethod, notes } = body;

  if (!customerId) {
    throw new Error("Mijoz tanlanishi shart!");
  }
  const payAmount = parseFloat(String(amount));
  if (!payAmount || payAmount <= 0) {
    throw new Error("To'lov summasi noldan katta bo'lishi shart!");
  }

  const parsedDate = paymentDate || new Date().toISOString();

  if (isSupabaseConfigured()) {
    const dbClient = checkDatabase();
    
    const { data: payData, error: payError } = await dbClient
      .from("sales_payments")
      .insert({
        customer_id: customerId,
        order_id: orderId || null,
        amount: payAmount,
        payment_date: parsedDate,
        payment_method: paymentMethod || "cash",
        notes: notes?.trim() || null,
        created_at: new Date().toISOString()
      })
      .select("*")
      .single();
    
    if (payError) throw payError;

    if (orderId) {
      const { data: order, error: oError } = await dbClient
        .from("sales_orders")
        .select("total_amount")
        .eq("id", orderId)
        .single();

      if (!oError && order) {
        const { data: orderPays, error: paysSumErr } = await dbClient
          .from("sales_payments")
          .select("amount")
          .eq("order_id", orderId);

        if (!paysSumErr && orderPays) {
          const paidSum = orderPays.reduce((sum, p) => sum + Number(p.amount), 0);
          let nextStatus = "unpaid";
          if (paidSum >= Number(order.total_amount)) {
            nextStatus = "paid";
          } else if (paidSum > 0) {
            nextStatus = "partially_paid";
          }

          await dbClient
            .from("sales_orders")
            .update({ status: nextStatus })
            .eq("id", orderId);
        }
      }
    }

    return { success: true, paymentId: payData.id };
  } else {
    const newPayId = "pay-" + Date.now();
    const newPay = {
      id: newPayId,
      customer_id: customerId,
      order_id: orderId || null,
      amount: payAmount,
      payment_date: parsedDate,
      payment_method: paymentMethod || "cash",
      notes: notes?.trim() || "",
      created_at: new Date().toISOString()
    };

    addDemoPayment(newPay);
    computeOutstandingStatuses(getDemoOrders(), getDemoPayments());

    return { success: true, paymentId: newPayId };
  }
}

export async function deletePayment(paymentId: string) {
  if (isSupabaseConfigured()) {
    const dbClient = checkDatabase();
    
    const { data: pData } = await dbClient
      .from("sales_payments")
      .select("order_id")
      .eq("id", paymentId)
      .single();

    const { error } = await dbClient
      .from("sales_payments")
      .delete()
      .eq("id", paymentId);
    
    if (error) throw error;

    if (pData && pData.order_id) {
      const { data: order } = await dbClient
        .from("sales_orders")
        .select("total_amount")
        .eq("id", pData.order_id)
        .single();

      if (order) {
        const { data: orderPays } = await dbClient
          .from("sales_payments")
          .select("amount")
          .eq("order_id", pData.order_id);

        const paidSum = (orderPays || []).reduce((sum, p) => sum + Number(p.amount), 0);
        let nextStatus = "unpaid";
        if (paidSum >= Number(order.total_amount)) {
          nextStatus = "paid";
        } else if (paidSum > 0) {
          nextStatus = "partially_paid";
        }

        await dbClient
          .from("sales_orders")
          .update({ status: nextStatus })
          .eq("id", pData.order_id);
      }
    }

    return { success: true };
  } else {
    const nextPayments = getDemoPayments().filter(p => p.id !== paymentId);
    setDemoPayments(nextPayments);
    computeOutstandingStatuses(getDemoOrders(), getDemoPayments());
    return { success: true };
  }
}
