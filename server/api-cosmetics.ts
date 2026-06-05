import { Router } from "express";
import { 
  getCustomers,
  createCustomer,
  getOrders,
  createOrder,
  deleteOrder,
  getPayments,
  createPayment,
  deletePayment,
  getBusinessMetrics
} from "./cosmetics-service.js";

const router = Router();

// ==========================================
// COSMETICS SALES & TRANSACTIONS ENDPOINTS
// ==========================================

// 1. GET Customers List
router.get("/sales-customers", async (req, res) => {
  try {
    const { chatId } = req.query;
    const data = await getCustomers(chatId as string);
    return res.json(data);
  } catch (error: any) {
    console.error("Error fetching sales customers:", error);
    res.status(500).json({ error: error.message || "Xatolik yuz berdi" });
  }
});

// 2. POST Add Customer
router.post("/sales-customers", async (req, res) => {
  try {
    const data = await createCustomer(req.body);
    return res.json(data);
  } catch (error: any) {
    console.error("Error creating sales customer:", error);
    res.status(500).json({ error: error.message || "Xatolik yuz berdi" });
  }
});

// 3. GET Sales Orders List
router.get("/sales-orders", async (req, res) => {
  try {
    const { chatId } = req.query;
    const data = await getOrders(chatId as string);
    return res.json(data);
  } catch (error: any) {
    console.error("Error fetching sales orders:", error);
    res.status(500).json({ error: error.message || "Xatolik yuz berdi" });
  }
});

// 4. POST Create Sales Order with multiple items
router.post("/sales-orders", async (req, res) => {
  try {
    const result = await createOrder(req.body);
    return res.json(result);
  } catch (error: any) {
    console.error("Error creating sales order:", error);
    res.status(500).json({ error: error.message || "Buyurtma shakllantirishda xatolik" });
  }
});

// 5. GET Payments/Transactions List
router.get("/sales-payments", async (req, res) => {
  try {
    const data = await getPayments();
    return res.json(data);
  } catch (error: any) {
    console.error("Error fetching payments:", error);
    res.status(500).json({ error: error.message || "To'lovlarni yuklab bo'lmadi" });
  }
});

// 6. POST Enter New Payment/Transaction
router.post("/sales-payments", async (req, res) => {
  try {
    const result = await createPayment(req.body);
    return res.json(result);
  } catch (error: any) {
    console.error("Error creating payment:", error);
    res.status(500).json({ error: error.message || "To'lovni kiritishda xatolik yuz berdi" });
  }
});

// 7. GET Business Metrics and Optimization Calculations
router.get("/business-metrics", async (req, res) => {
  try {
    const { chatId } = req.query;
    const metrics = await getBusinessMetrics(chatId as string);
    return res.json(metrics);
  } catch (error: any) {
    console.error("Error computing business optimization metrics:", error);
    res.status(500).json({ error: error.message || "Metrics calculation failed" });
  }
});

// 8. DELETE Sales Order
router.delete("/sales-orders/:id", async (req, res) => {
  try {
    const result = await deleteOrder(req.params.id);
    return res.json(result);
  } catch (error: any) {
    console.error("Error deleting order:", error);
    res.status(500).json({ error: error.message || "Xatolik" });
  }
});

// 9. DELETE Payment/Transaction
router.delete("/sales-payments/:id", async (req, res) => {
  try {
    const result = await deletePayment(req.params.id);
    return res.json(result);
  } catch (error: any) {
    console.error("Error deleting payment:", error);
    res.status(500).json({ error: error.message || "Xatolik" });
  }
});

export default router;
