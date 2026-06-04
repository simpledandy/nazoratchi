import React, { useState, useEffect, useMemo } from "react";
import { 
  Plus, Search, Trash2, DollarSign, Award, TrendingUp, Users, 
  FileText, Filter, Calendar, Smartphone, CheckCircle, Clock, 
  AlertTriangle, ChevronDown, UserPlus, ArrowRight, TrendingDown,
  ShoppingBag, HelpCircle
} from "lucide-react";
import productsData from "../products.json";

interface SalesTabProps {
  selectedGroupId: string;
  groups: any[];
  showToast: (msg: string, type?: "success" | "error" | "warning" | "info") => void;
}

// Map types for clarity
interface Product {
  code: string;
  name: string;
  volume: string;
  price: number;
  discount_price: number;
  points: number;
  category: string;
}

interface Customer {
  id: string;
  name: string;
  phone?: string;
  telegram_username?: string;
  telegram_id?: string;
  chat_id?: string;
  notes?: string;
  created_at: string;
}

interface OrderItem {
  id?: string;
  productCode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  points: number;
}

interface Order {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  chatId?: string;
  saleDate: string;
  totalAmount: number;
  totalPoints: number;
  status: string; // paid, partially_paid, unpaid
  notes?: string;
  items: OrderItem[];
  paidAmount: number;
  outstandingBalance: number;
}

interface Payment {
  id: string;
  customerId: string;
  customerName: string;
  orderId?: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  notes?: string;
}

interface BusinessMetrics {
  summary: {
    totalSalesRevenue: number;
    totalCollectedPayments: number;
    totalOutstandingDebt: number;
    totalPointsGenerated: number;
    activeCustomersCount: number;
    totalOrdersCount: number;
  };
  bestSellers: Array<{
    code: string;
    name: string;
    quantitySold: number;
    revenue: number;
    points: number;
  }>;
  customerPerformance: Array<{
    customerId: string;
    customerName: string;
    totalOrdersAmount: number;
    totalPaidAmount: number;
    outstandingDebt: number;
    debtorSince: string;
  }>;
  topDebtors: Array<{
    customerId: string;
    customerName: string;
    totalOrdersAmount: number;
    totalPaidAmount: number;
    outstandingDebt: number;
    debtorSince: string;
  }>;
  channelPerformance: Array<{
    channelId: string;
    channelName: string;
    revenueGenerated: number;
  }>;
}

export default function SalesTab({ selectedGroupId, groups, showToast }: SalesTabProps) {
  // Product dataset loaded from static JSON configuration
  const productsList = productsData as Product[];

  // Sub-tabs state inside Sales Tracker
  const [activeSubTab, setActiveSubTab] = useState<"intake" | "customers" | "analytics" | "history">("analytics");

  // Core loaded models
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [metrics, setMetrics] = useState<BusinessMetrics | null>(null);
  const [loading, setLoading] = useState(false);

  // Group chat members (used to recommend/autocomplete customer info)
  const [groupMembers, setGroupMembers] = useState<any[]>([]);

  // -------------------------------------------------------------
  // FORMS STATE
  // -------------------------------------------------------------
  
  // 1. New Customer form
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: "",
    phone: "",
    telegramUsername: "",
    telegramId: "",
    chatId: selectedGroupId,
    notes: ""
  });

  // 2. New Sale Intake form state
  const [saleCustomerSearch, setSaleCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [saleNotes, setSaleNotes] = useState("");
  const [saleDate, setSaleDate] = useState(new Date().toISOString().substring(0, 10));
  const [saleItems, setSaleItems] = useState<Array<{
    productCode: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    points: number;
    searchQuery: string;
    showSuggestions: boolean;
  }>>([
    { productCode: "", productName: "", quantity: 1, unitPrice: 0, points: 0, searchQuery: "", showSuggestions: false }
  ]);

  // 3. New Payment Form state
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    customerId: "",
    customerName: "",
    orderId: "", // Target specific order, or general balance
    amount: "",
    paymentMethod: "click", // click, payme, cash, card, bank_transfer
    paymentDate: new Date().toISOString().substring(0, 10),
    notes: ""
  });

  // Load backend statistics & memberships to suggest Telegram handles
  useEffect(() => {
    fetchGroupMembers();
    fetchSalesData();
  }, [selectedGroupId]);

  const fetchGroupMembers = async () => {
    try {
      const queryParam = selectedGroupId ? `?chatId=${selectedGroupId}` : "";
      const savedChats = localStorage.getItem("verified_chat_ids") || "";
      const res = await fetch(`/api/stats${queryParam}`, {
        headers: { "X-Verified-Chats": savedChats }
      });
      if (res.ok) {
        const statsData = await res.json();
        setGroupMembers(statsData.members || []);
      }
    } catch (e) {
      console.warn("Could not retrieve group members for suggestions:", e);
    }
  };

  const fetchSalesData = async () => {
    try {
      setLoading(true);
      const queryParam = selectedGroupId ? `?chatId=${selectedGroupId}` : "";
      const savedChats = localStorage.getItem("verified_chat_ids") || "";
      const headers = { "X-Verified-Chats": savedChats };

      const [custRes, ordRes, payRes, metricsRes] = await Promise.all([
        fetch(`/api/sales-customers${queryParam}`, { headers }),
        fetch(`/api/sales-orders${queryParam}`, { headers }),
        fetch(`/api/sales-payments${queryParam}`, { headers }),
        fetch(`/api/business-metrics${queryParam}`, { headers })
      ]);

      if (custRes.ok) setCustomers(await custRes.json());
      if (ordRes.ok) setOrders(await ordRes.json());
      if (payRes.ok) setPayments(await payRes.json());
      if (metricsRes.ok) setMetrics(await metricsRes.json());

    } catch (error) {
      console.error("Sales data fetching failure:", error);
      showToast("Savdo ma'lumotlarini yuklashda xatolik!", "error");
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // CUSTOMER AUTO-COMPLETE RECOMMENDATION LOGIC
  // -------------------------------------------------------------
  
  // Suggest names from customers list that match text length
  const recommendedCustomers = useMemo(() => {
    if (!saleCustomerSearch.trim() || selectedCustomerId) return [];
    return customers.filter(c => 
      c.name.toLowerCase().includes(saleCustomerSearch.toLowerCase()) ||
      (c.phone && c.phone.includes(saleCustomerSearch)) ||
      (c.telegram_username && c.telegram_username.toLowerCase().includes(saleCustomerSearch.toLowerCase()))
    );
  }, [saleCustomerSearch, customers, selectedCustomerId]);

  // If search query is not matching any customer, allow quick profile creation helper
  const showQuickCreateButton = saleCustomerSearch.trim().length > 2 && recommendedCustomers.length === 0 && !selectedCustomerId;

  // Select customer handle
  const handleSelectCustomer = (cust: Customer) => {
    setSelectedCustomerId(cust.id);
    setSaleCustomerSearch(cust.name);
  };

  // Quick Customer Creation
  const handleQuickCreateCustomer = async () => {
    try {
      // Check if there is an existing Telegram membership matching current name to prefill details
      const matchedTelegramUser = groupMembers.find(m => 
        `${m.firstName} ${m.lastName || ""}`.trim().toLowerCase() === saleCustomerSearch.trim().toLowerCase() ||
        m.username?.toLowerCase() === saleCustomerSearch.trim().toLowerCase()
      );

      const savedChats = localStorage.getItem("verified_chat_ids") || "";
      const payload = {
        name: saleCustomerSearch.trim(),
        phone: "",
        telegramUsername: matchedTelegramUser?.username || "",
        telegramId: matchedTelegramUser?.telegramId || "",
        chatId: selectedGroupId || null,
        notes: "Muvaffaqiyatli tezkor yaratildi."
      };

      const res = await fetch("/api/sales-customers", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Verified-Chats": savedChats 
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const createdCustomer = await res.json();
        showToast(`Yangi mijoz yaratildi: ${createdCustomer.name} 🎉`, "success");
        setCustomers(prev => [...prev, createdCustomer]);
        setSelectedCustomerId(createdCustomer.id);
        setSaleCustomerSearch(createdCustomer.name);
      } else {
        const err = await res.json();
        showToast(err.error || "Mijoz yaratishda xato", "error");
      }
    } catch (e) {
      showToast("Tizimda xatolik", "error");
    }
  };

  // Detailed Modal Customer Creation
  const handleCreateCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerForm.name.trim()) {
      showToast("Mijoz ismi kiritilishi shart!", "warning");
      return;
    }

    try {
      const savedChats = localStorage.getItem("verified_chat_ids") || "";
      const res = await fetch("/api/sales-customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Verified-Chats": savedChats
        },
        body: JSON.stringify(newCustomerForm)
      });

      if (res.ok) {
        const created = await res.json();
        showToast("Yangi mijoz muvaffaqiyatli saqlandi!", "success");
        setCustomers(prev => [created, ...prev]);
        setShowAddCustomerModal(false);
        setNewCustomerForm({
          name: "",
          phone: "",
          telegramUsername: "",
          telegramId: "",
          chatId: selectedGroupId,
          notes: ""
        });
        
        // Auto select in intake if open
        setSelectedCustomerId(created.id);
        setSaleCustomerSearch(created.name);
      } else {
        const d = await res.json();
        showToast(d.error || "Mijoz qo'shib bo'lmadi", "error");
      }
    } catch (err) {
      showToast("Tizimda xatolik", "error");
    }
  };

  // -------------------------------------------------------------
  // PRODUCT ROW LINE ITEMS MANAGEMENT
  // -------------------------------------------------------------
  
  const handleAddProductRow = () => {
    setSaleItems(prev => [...prev, {
      productCode: "",
      productName: "",
      quantity: 1,
      unitPrice: 0,
      points: 0,
      searchQuery: "",
      showSuggestions: false
    }]);
  };

  const handleRemoveProductRow = (index: number) => {
    if (saleItems.length === 1) {
      showToast("Kamida bitta mahsulot bo'lishi lozim!", "warning");
      return;
    }
    setSaleItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleProductRowTextChange = (index: number, text: string) => {
    setSaleItems(prev => {
      const copy = [...prev];
      copy[index].searchQuery = text;
      copy[index].showSuggestions = text.trim().length > 0;
      // Reset details if they change the code
      copy[index].productCode = "";
      copy[index].productName = "";
      return copy;
    });
  };

  const handleSelectProductSuggestion = (rowIndex: number, prod: Product) => {
    setSaleItems(prev => {
      const copy = [...prev];
      copy[rowIndex].productCode = prod.code;
      copy[rowIndex].productName = prod.name;
      copy[rowIndex].unitPrice = prod.price || prod.discount_price || 0; // Default to full price as requested, editable for negotiation
      copy[rowIndex].points = prod.points;
      copy[rowIndex].searchQuery = `${prod.code} - ${prod.name}`;
      copy[rowIndex].showSuggestions = false;
      return copy;
    });
  };

  const handleProductRowNumericChange = (rowIndex: number, field: "quantity" | "unitPrice" | "points", val: number) => {
    setSaleItems(prev => {
      const copy = [...prev];
      copy[rowIndex] = {
        ...copy[rowIndex],
        [field]: val
      };
      return copy;
    });
  };

  // Calculate Running totals of form
  const computedInvoiceTotals = useMemo(() => {
    let orderAmount = 0;
    let orderPoints = 0;
    saleItems.forEach(item => {
      const q = item.quantity || 0;
      const u = item.unitPrice || 0;
      const pts = item.points || 0;
      orderAmount += q * u;
      orderPoints += q * pts;
    });
    return { orderAmount, orderPoints };
  }, [saleItems]);

  // Submit recorded sale transaction
  const handleSalesSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      showToast("Iltimos, avval mijozni tanlang yoki yarating!", "warning");
      return;
    }

    // Filter validated items
    const validatedItems = saleItems.filter(item => item.productCode && item.quantity > 0);
    if (validatedItems.length === 0) {
      showToast("Iltimos, kamida bitta to'g'ri mahsulotni tanlang!", "warning");
      return;
    }

    try {
      const savedChats = localStorage.getItem("verified_chat_ids") || "";
      const bodyPayload = {
        customerId: selectedCustomerId,
        chatId: selectedGroupId || null,
        saleDate: new Date(saleDate).toISOString(),
        notes: saleNotes,
        items: validatedItems.map(i => ({
          productCode: i.productCode,
          productName: i.productName,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          points: i.points
        }))
      };

      const res = await fetch("/api/sales-orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Verified-Chats": savedChats
        },
        body: JSON.stringify(bodyPayload)
      });

      if (res.ok) {
        showToast("Muvaffaqiyatli savdo qayd qilindi! 🛍️", "success");
        // Reset intake state
        setSaleCustomerSearch("");
        setSelectedCustomerId("");
        setSaleNotes("");
        setSaleItems([{ productCode: "", productName: "", quantity: 1, unitPrice: 0, points: 0, searchQuery: "", showSuggestions: false }]);
        fetchSalesData();
        setActiveSubTab("history"); // Redirect to history logs to see it
      } else {
        const errorData = await res.json();
        showToast(errorData.error || "Savdo qayd qilishda xatolik!", "error");
      }
    } catch (e) {
      showToast("Savdo saqlanmadi, tarmoq xatosi", "error");
    }
  };

  // -------------------------------------------------------------
  // RECORD TRANSACTIONS / PAYMENTS MODAL HANDLER
  // -------------------------------------------------------------
  
  const handleOpenAddPayment = (cust: Customer, targetOrderId?: string, prefillAmount?: number) => {
    setPaymentForm({
      customerId: cust.id,
      customerName: cust.name,
      orderId: targetOrderId || "",
      amount: prefillAmount ? prefillAmount.toString() : "",
      paymentMethod: "click",
      paymentDate: new Date().toISOString().substring(0, 10),
      notes: targetOrderId ? `Qisman buyurtma (${targetOrderId.substring(0,6)}) to'lash` : "Uchrashuv bo'yicha to'lov"
    });
    setShowAddPaymentModal(true);
  };

  const handlePostPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentForm.customerId) {
      showToast("Iltimos, mijozni tanlang!", "warning");
      return;
    }
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      showToast("Iltimos, to'g'ri to'lov miqdorini kiriting!", "warning");
      return;
    }

    try {
      const savedChats = localStorage.getItem("verified_chat_ids") || "";
      const res = await fetch("/api/sales-payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Verified-Chats": savedChats
        },
        body: JSON.stringify({
          customerId: paymentForm.customerId,
          orderId: paymentForm.orderId || null,
          amount: parseFloat(paymentForm.amount),
          paymentDate: new Date(paymentForm.paymentDate).toISOString(),
          paymentMethod: paymentForm.paymentMethod,
          notes: paymentForm.notes
        })
      });

      if (res.ok) {
        showToast("To'lov muvaffaqiyatli qabul qilindi! 💸", "success");
        setShowAddPaymentModal(false);
        fetchSalesData();
      } else {
        const err = await res.json();
        showToast(err.error || "To'lov saqlanmadi!", "error");
      }
    } catch (err) {
      showToast("Tizim xatoligi", "error");
    }
  };

  // -------------------------------------------------------------
  // DELETE TRIGGERS
  // -------------------------------------------------------------

  const handleDeleteOrder = async (id: string) => {
    if (!window.confirm("Buyurtmani butunlay o'chirib tashlamoqchimisiz? Ushbu buyurtmaga bog'langan to'lovlar ham o'zgaradi.")) return;
    try {
      const savedChats = localStorage.getItem("verified_chat_ids") || "";
      const res = await fetch(`/api/sales-orders/${id}`, {
        method: "DELETE",
        headers: { "X-Verified-Chats": savedChats }
      });
      if (res.ok) {
        showToast("Savdo hisobi o'chirildi", "success");
        fetchSalesData();
      } else {
        showToast("O'chirib bo'lmadi", "error");
      }
    } catch (e) {
      showToast("Xatolik", "error");
    }
  };

  const handleDeletePayment = async (id: string) => {
    if (!window.confirm("To'lov tranzaksiyasini butunlay bekor qilmoqchimisiz?")) return;
    try {
      const savedChats = localStorage.getItem("verified_chat_ids") || "";
      const res = await fetch(`/api/sales-payments/${id}`, {
        method: "DELETE",
        headers: { "X-Verified-Chats": savedChats }
      });
      if (res.ok) {
        showToast("Tranzaksiya o'chirib yuborildi!", "success");
        fetchSalesData();
      } else {
        showToast("O'chirish muvaffaqiyatsiz", "error");
      }
    } catch (e) {
      showToast("Xatolik", "error");
    }
  };

  // -------------------------------------------------------------
  // COMPUTED METRICS FORMATS
  // -------------------------------------------------------------

  const formattedAmount = (num: number) => {
    return num.toLocaleString("uz-UZ") + " UZS";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-100 font-sans">To'langan</span>;
      case "partially_paid":
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full border border-amber-100 font-sans">Qisman To'lov</span>;
      default:
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-rose-50 text-rose-700 px-2.5 py-1 rounded-full border border-rose-100 font-sans">To'lanmagan</span>;
    }
  };


  return (
    <div className="space-y-6">
      
      {/* Sales Inner Navigation Menu */}
      <div className="bg-white p-2 rounded-2xl border border-black/5 flex flex-wrap gap-1">
        <button
          onClick={() => setActiveSubTab("analytics")}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-sans text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === "analytics" ? "bg-[#5A5A40] text-white" : "text-[#5A5A40] hover:bg-[#F5F5F0]"
          }`}
        >
          <TrendingUp size={15} /> Biznes Tahlil & Optimizatsiya
        </button>
        <button
          onClick={() => setActiveSubTab("intake")}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-sans text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === "intake" ? "bg-[#5A5A40] text-white" : "text-[#5A5A40] hover:bg-[#F5F5F0]"
          }`}
        >
          <ShoppingBag size={15} /> Yangi Savdo Kiritish 🛍️
        </button>
        <button
          onClick={() => setActiveSubTab("customers")}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-sans text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === "customers" ? "bg-[#5A5A40] text-white" : "text-[#5A5A40] hover:bg-[#F5F5F0]"
          }`}
        >
          <Users size={15} /> Mijozlar & Balanslar
        </button>
        <button
          onClick={() => setActiveSubTab("history")}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-sans text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === "history" ? "bg-[#5A5A40] text-white" : "text-[#5A5A40] hover:bg-[#F5F5F0]"
          }`}
        >
          <FileText size={15} /> Hisobotlar Tarixi
        </button>
      </div>

      {loading && (
        <div className="p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#5A5A40] mx-auto mb-4"></div>
          <p className="text-xs text-[#5A5A40]/70 font-sans">Savdo ma'lumotlari hisoblanmoqda...</p>
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB 1: ANALYTICS & BUSINESS OPTIMIZATION
          ------------------------------------------------------------- */}
      {activeSubTab === "analytics" && !loading && (
        <div className="space-y-6 text-left">
          
          {/* KPI Dashboard Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-[24px] border border-black/5 relative overflow-hidden">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Umumiy Savdo Hajmi</span>
              <h2 className="text-xl sm:text-2xl font-bold font-sans text-gray-950 mt-1">
                {formattedAmount(metrics?.summary.totalSalesRevenue || 0)}
              </h2>
              <span className="text-[10px] text-[#5A5A40] bg-[#5A5A40]/5 px-2 py-0.5 rounded mt-2.5 inline-block font-sans">
                {metrics?.summary.totalOrdersCount || 0} ta buyurtmalar bo'yicha
              </span>
              <div className="absolute right-4 bottom-4 p-2.5 bg-[#5A5A40]/10 text-[#5A5A40] rounded-xl">
                <ShoppingBag size={20} />
              </div>
            </div>

            <div className="bg-white p-5 rounded-[24px] border border-black/5 relative overflow-hidden">
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider block mb-1">Qabul Qilingan To'lovlar</span>
              <h2 className="text-xl sm:text-2xl font-bold font-sans text-emerald-950 mt-1">
                {formattedAmount(metrics?.summary.totalCollectedPayments || 0)}
              </h2>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded mt-2.5 inline-block font-sans">
                Qasd qilingan tushumlar
              </span>
              <div className="absolute right-4 bottom-4 p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                <CheckCircle size={20} />
              </div>
            </div>

            <div className="bg-white p-5 rounded-[24px] border border-black/5 relative overflow-hidden">
              <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block mb-1">Qarzdorlik (Kutilayotgan Pul)</span>
              <h2 className="text-xl sm:text-2xl font-bold font-sans text-rose-950 mt-1 animate-pulse">
                {formattedAmount(metrics?.summary.totalOutstandingDebt || 0)}
              </h2>
              <span className="text-[10px] text-rose-700 bg-rose-50 px-2 py-0.5 rounded mt-2.5 inline-block font-sans font-bold">
                Mulk hisobidagi qarzlar
              </span>
              <div className="absolute right-4 bottom-4 p-2.5 bg-rose-50 text-rose-600 rounded-xl">
                <TrendingDown size={20} />
              </div>
            </div>

            <div className="bg-white p-5 rounded-[24px] border border-black/5 relative overflow-hidden">
              <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block mb-1">Jamg'arilgan Ballar (Балл)</span>
              <h2 className="text-xl sm:text-2xl font-bold font-sans text-indigo-950 mt-1">
                {(metrics?.summary.totalPointsGenerated || 0).toFixed(1)} ball
              </h2>
              <span className="text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded mt-2.5 inline-block font-sans">
                A'zolarning umumiy ballari
              </span>
              <div className="absolute right-4 bottom-4 p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                <Award size={20} />
              </div>
            </div>
          </div>

          {/* Business Channel Attribution and Bestsellers Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* 1. Best Selling Cosmetics (Marketing Optimization) */}
            <div className="bg-white p-5 sm:p-6 rounded-[28px] border border-black/5 space-y-4">
              <div>
                <h3 className="font-bold text-lg text-gray-900 leading-tight">Eng Ko'p Sotilgan Kosmetika</h3>
                <p className="text-xs text-[#5A5A40]/70 mt-1 font-sans">
                  Sotilgan jami hajmi va ballari bo'yicha top mahsulotlar (Biznes tahlil optimallashtirish)
                </p>
              </div>

              <div className="space-y-3.5">
                {metrics?.bestSellers && metrics.bestSellers.length > 0 ? (
                  metrics.bestSellers.map((prod, idx) => {
                    const maxSold = Math.max(...metrics.bestSellers.map(b => b.quantitySold), 1);
                    const percentage = Math.min(100, Math.round((prod.quantitySold / maxSold) * 100));
                    return (
                      <div key={prod.code} className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-sans font-bold text-gray-800">
                            {idx + 1}. <code className="bg-gray-100 text-gray-700 px-1 py-0.5 rounded text-[10px]">{prod.code}</code> - {prod.name.split("/")[0]}
                          </span>
                          <span className="text-gray-500 font-sans font-semibold">
                            {prod.quantitySold} dona / <span className="text-indigo-600 font-bold">+{prod.points.toFixed(1)} ball</span>
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-indigo-500 h-2.5 rounded-full" 
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs leading-relaxed text-gray-500 py-3 italic">Hozircha savdolar kiritilmagan.</p>
                )}
              </div>
            </div>

            {/* 2. Group Campaign Channel Optimization */}
            <div className="bg-white p-5 sm:p-6 rounded-[28px] border border-black/5 space-y-4">
              <div>
                <h3 className="font-bold text-lg text-gray-900 leading-tight">Telegram Guruhlar Samaradorligi</h3>
                <p className="text-xs text-[#5A5A40]/70 mt-1 font-sans">
                  Analitika: qaysi guruh chat a'zolari kosmetika sotib olishda eng faol etakchi ekanligini ko'rsatadi
                </p>
              </div>

              <div className="space-y-3.5">
                {metrics?.channelPerformance && metrics.channelPerformance.length > 0 ? (
                  metrics.channelPerformance.map((campaign, idx) => {
                    const maxRev = Math.max(...metrics.channelPerformance.map(c => c.revenueGenerated), 1);
                    const percentage = Math.round((campaign.revenueGenerated / maxRev) * 100);
                    
                    // Try to resolve human readable title of group
                    let title = campaign.channelName;
                    const foundGroup = groups.find(g => g.id === campaign.channelId);
                    if (foundGroup) {
                      title = foundGroup.title;
                    }

                    return (
                      <div key={campaign.channelId} className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-sans font-bold text-gray-800">
                            {idx + 1}. {title}
                          </span>
                          <span className="font-sans font-bold text-emerald-600">
                            {formattedAmount(campaign.revenueGenerated)}
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-2.5 rounded-full" 
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs leading-relaxed text-gray-500 py-3 italic">Konversiya bog'liqligi topilmadi.</p>
                )}
              </div>
            </div>
          </div>

          {/* Quick Debt Overdue Alerts & Top Spenders */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Debt alert panel */}
            <div className="bg-white p-5 sm:p-6 rounded-[28px] border border-black/5 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-lg text-gray-900 leading-tight flex items-center gap-2">
                    <AlertTriangle className="text-rose-500" size={20} /> Qarzdor Doimiy Mijozlar
                  </h3>
                  <p className="text-xs text-[#5A5A40]/70 mt-1 font-sans">
                    Moliyaviy nazorat: to'lovi yakunlanmagan kelishilgan savdolar ro'yxati
                  </p>
                </div>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {metrics?.topDebtors && metrics.topDebtors.length > 0 ? (
                  metrics.topDebtors.map((debtor) => (
                    <div key={debtor.customerId} className="flex justify-between items-center p-3.5 bg-rose-50/50 rounded-2xl border border-rose-100 text-xs">
                      <div className="space-y-1">
                        <p className="font-bold text-gray-900">{debtor.customerName}</p>
                        <p className="text-[10px] text-gray-500 font-sans italic">
                          Qo'shilgan tarixi: {new Date(debtor.debtorSince).toLocaleDateString("uz-UZ")}
                        </p>
                      </div>
                      <div className="text-right space-y-1.5">
                        <p className="font-sans font-bold text-rose-600">
                          {formattedAmount(debtor.outstandingDebt)}
                        </p>
                        <button
                          onClick={() => {
                            const c = customers.find(cust => cust.id === debtor.customerId);
                            if (c) handleOpenAddPayment(c, "", debtor.outstandingDebt);
                          }}
                          className="text-[10px] bg-[#5A5A40] text-white hover:bg-[#4a4a30] font-sans px-2.5 py-1 rounded-lg cursor-pointer font-bold"
                        >
                          To'lov kiritish
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-center text-gray-500 py-6 italic">Mukammal! Barcha qarzdorliklar to'liq yopilgan. ✨</p>
                )}
              </div>
            </div>

            {/* Spenders List */}
            <div className="bg-white p-5 sm:p-6 rounded-[28px] border border-black/5 space-y-4">
              <div>
                <h3 className="font-bold text-lg text-gray-900 leading-tight">Yulduz Mijozlar Reytingi</h3>
                <p className="text-xs text-[#5A5A40]/70 mt-1 font-sans">
                  Xaridlar summasi bo'yicha kosmetika do'koningiz eng sodiq mijozlari
                </p>
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {metrics?.customerPerformance && metrics.customerPerformance.length > 0 ? (
                  metrics.customerPerformance.map((perf, idx) => (
                    <div key={perf.customerId} className="flex justify-between items-center p-3 bg-[#F5F5F0]/50 rounded-2xl border border-black/5 text-xs">
                      <div>
                        <p className="font-bold text-gray-900">
                          {idx + 1}. {perf.customerName}
                        </p>
                        <p className="text-[10px] text-gray-500 shrink-0 font-sans mt-0.5">
                          Jami to'lagani: {formattedAmount(perf.totalPaidAmount)}
                        </p>
                      </div>
                      <span className="font-sans font-bold bg-[#5A5A40]/10 text-[#5A5A40] px-2.5 py-1 rounded-xl">
                        {formattedAmount(perf.totalOrdersAmount)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs leading-relaxed text-gray-500 py-3 italic">Hozircha mijozlar hisobi bo'sh.</p>
                )}
              </div>
            </div>

          </div>

        </div>
      )}


      {/* -------------------------------------------------------------
          TAB 2: SALES订单 INTAKE (Intelligent intake module for mobile)
          ------------------------------------------------------------- */}
      {activeSubTab === "intake" && (
        <form onSubmit={handleSalesSubmission} className="bg-white p-5 sm:p-8 rounded-[32px] border border-black/5 text-left space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-black/5 pb-4 gap-2">
            <div>
              <h3 className="font-bold text-xl text-gray-900">Mijoz Savdolarini Rasmiylashtirish</h3>
              <p className="text-xs text-[#5A5A40]/80 mt-1 font-sans">
                Maxsus kosmetika savdosini ro'yxatga olish, miqdor, ball, chegirmalari hisobi
              </p>
            </div>
            
            <button
              type="button"
              onClick={() => setShowAddCustomerModal(true)}
              className="bg-[#5A5A40] text-white hover:bg-[#4a4a30] text-xs font-bold font-sans px-4 py-2.5 rounded-xl cursor-pointer flex items-center gap-1 shrink-0"
            >
              <UserPlus size={14} /> Yangi mijoz profili
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Customer Search & Prefill suggestion panel */}
            <div className="relative space-y-2">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest pl-1">
                Sotib Oluvchi Mijoz <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
                <input
                  type="text"
                  placeholder="Mijoz ismini yoki telefonini qidiring..."
                  className="w-full bg-[#F5F5F0] border-none text-sm font-sans rounded-xl pl-10 pr-10 py-3.5 focus:ring-2 focus:ring-[#5A5A40]/20"
                  value={saleCustomerSearch}
                  onChange={(e) => {
                    setSaleCustomerSearch(e.target.value);
                    if (selectedCustomerId) {
                      setSelectedCustomerId(""); // If they edit, reset selected Customer ID to force choose/quick create
                    }
                  }}
                />
                
                {selectedCustomerId && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600 bg-emerald-50 text-[10px] font-bold px-2.5 py-1 rounded-full font-sans border border-emerald-100">
                    Mavjud mijoz
                  </span>
                )}
              </div>

              {/* Suggestions Dropdown */}
              {recommendedCustomers.length > 0 && (
                <div className="absolute z-40 left-0 right-0 top-full mt-1.5 bg-white border border-black/10 rounded-2xl shadow-xl max-h-[220px] overflow-y-auto overflow-x-hidden font-sans">
                  {recommendedCustomers.map(cust => (
                    <button
                      key={cust.id}
                      type="button"
                      onClick={() => handleSelectCustomer(cust)}
                      className="w-full text-left px-4 py-3 hover:bg-[#F5F5F0] border-b border-black/5 text-xs block transition-colors"
                    >
                      <div className="flex justify-between items-center font-bold text-gray-800">
                        <span>{cust.name}</span>
                        {cust.phone && <span className="text-gray-500 text-[11px] font-medium">{cust.phone}</span>}
                      </div>
                      {cust.telegram_username && (
                        <p className="text-[10px] text-[#5A5A40]/70 mt-0.5">Telegram: @{cust.telegram_username}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Quick Create Helper if no matching found */}
              {showQuickCreateButton && (
                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs text-amber-900 font-sans">
                  <span>
                    Mijoz topilmadi: <strong>"{saleCustomerSearch}"</strong>
                  </span>
                  <button
                    type="button"
                    onClick={handleQuickCreateCustomer}
                    className="bg-amber-600 text-white hover:bg-amber-700 font-bold px-3 py-1.5 rounded-lg shrink-0 text-[11px] cursor-pointer"
                  >
                    Quick-yozish (Profil ochish) ➕
                  </button>
                </div>
              )}
            </div>

            {/* Campaign Chat Group selector to attribute sales channel */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest pl-1">
                Kompaniya Guruh Kanali (Attribution)
              </label>
              <select
                className="w-full bg-[#F5F5F0] border-none text-sm font-sans rounded-xl p-3.5 cursor-pointer text-[#5A5A40]"
                value={selectedGroupId}
                onChange={(e) => {}}
                disabled
              >
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.title || g.id}</option>
                ))}
              </select>
              <p className="text-[10px] text-[#5A5A40]/70 italic font-sans pl-1">Automatik joriy boshqarilayotgan guruhga qayd qilinadi</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest pl-1">
                Harid Sanasi
              </label>
              <input
                type="date"
                className="w-full bg-[#F5F5F0] border-none text-sm font-sans rounded-xl p-3.5 focus:ring-2 focus:ring-[#5A5A40]/20"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest pl-1">
                Izohlar & Kelishilgan shartlar
              </label>
              <input
                type="text"
                placeholder="Chegirma, yetkazib berish, yoki to'lov muddati bo'yicha ma'lumotlar"
                className="w-full bg-[#F5F5F0] border-none text-sm font-sans rounded-xl p-3.1 focus:ring-2 focus:ring-[#5A5A40]/20"
                value={saleNotes}
                onChange={(e) => setSaleNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Line Items block */}
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-black/5 pb-2.5">
              <h4 className="font-bold text-sm tracking-tight text-gray-800">Sotilayotgan Kosmetika Mahsulotlari</h4>
              <button
                type="button"
                onClick={handleAddProductRow}
                className="text-white hover:bg-[#4a4a30] bg-[#5A5A40] text-xs font-sans font-bold py-2 px-3.5 rounded-xl cursor-pointer inline-flex items-center gap-1"
              >
                <Plus size={14} /> Mahsulot qo'shish
              </button>
            </div>

            <div className="space-y-4">
              {saleItems.map((row, index) => (
                <div 
                  key={index} 
                  className="bg-gray-50/50 p-4 rounded-2xl border border-black/5 flex flex-col gap-3 relative"
                >
                  <button
                    type="button"
                    onClick={() => handleRemoveProductRow(index)}
                    className="absolute top-4 right-4 text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50 cursor-pointer"
                    title="Satrni o'chirish"
                  >
                    <Trash2 size={16} />
                  </button>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pr-0 md:pr-8">
                    {/* Search query box autocomplete linking to products.json */}
                    <div className="md:col-span-6 space-y-1 relative text-left">
                      <span className="text-[10px] font-bold text-[#5A5A40]" style={{ textTransform: "uppercase" }}>LA'CORE Mahsulot nomi / kodi</span>
                      <input
                        type="text"
                        placeholder="Nomi yoki kodini kiriting (masalan: 1042)..."
                        className="w-full bg-white border border-black/10 text-xs font-sans rounded-lg p-2.5 focus:ring-2 focus:ring-[#5A5A40]/20"
                        value={row.searchQuery}
                        onChange={(e) => handleProductRowTextChange(index, e.target.value)}
                        onFocus={() => {
                          if (row.searchQuery.trim().length > 0 && !row.productCode) {
                            setSaleItems(prev => {
                              const copy = [...prev];
                              copy[index].showSuggestions = true;
                              return copy;
                            });
                          }
                        }}
                      />

                      {/* Code autocompleting dropdown */}
                      {row.showSuggestions && (
                        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-black/15 rounded-xl shadow-2xl max-h-[180px] overflow-y-auto font-sans">
                          {productsList.filter(p => 
                            p.code.includes(row.searchQuery) || 
                            p.name.toLowerCase().includes(row.searchQuery.toLowerCase())
                          ).slice(0, 15).map(prod => (
                            <button
                              key={prod.code}
                              type="button"
                              onClick={() => handleSelectProductSuggestion(index, prod)}
                              className="w-full text-left px-3 py-2.5 hover:bg-gray-100 text-[11px] block transition-colors border-b border-black/5"
                            >
                              <code className="bg-indigo-50 text-indigo-800 font-bold px-1.5 py-0.5 rounded mr-2 font-mono">{prod.code}</code>
                              <strong>{prod.name}</strong> - <span className="text-gray-500 font-medium">{prod.volume} / {prod.category}</span>
                            </button>
                          ))}
                          {productsList.filter(p => 
                            p.code.includes(row.searchQuery) || 
                            p.name.toLowerCase().includes(row.searchQuery.toLowerCase())
                          ).length === 0 && (
                            <p className="p-3 text-[11px] text-gray-400 italic">Mos mahsulot topilmadi.</p>
                          )}
                        </div>
                      )}

                      {row.productCode && (
                        <p className="text-[10px] text-emerald-700 font-sans font-bold flex items-center gap-1.5 mt-1.5 pl-0.5">
                          ✓ Tasdiqlandi: [<code className="font-mono font-black">{row.productCode}</code>] • {row.productName.split("/")[0]}
                        </p>
                      )}
                    </div>

                    {/* Quantity */}
                    <div className="md:col-span-2 space-y-1">
                      <span className="text-[10px] font-bold text-[#5A5A40]" style={{ textTransform: "uppercase" }}>Soni</span>
                      <input
                        type="number"
                        min={1}
                        className="w-full bg-white border border-black/10 text-xs font-sans rounded-lg p-2.5 focus:ring-2 focus:ring-[#5A5A40]/20 font-bold"
                        value={row.quantity}
                        onChange={(e) => handleProductRowNumericChange(index, "quantity", parseInt(e.target.value) || 1)}
                      />
                    </div>

                    {/* Price per unit */}
                    <div className="md:col-span-2 space-y-1">
                      <span className="text-[10px] font-bold text-[#5A5A40]" style={{ textTransform: "uppercase" }}>Sotish narxi</span>
                      <input
                        type="number"
                        min={0}
                        className="w-full bg-white border border-black/10 text-xs font-sans rounded-lg p-2.5 focus:ring-2 focus:ring-[#5A5A40]/20 font-sans font-bold text-emerald-700"
                        value={row.unitPrice}
                        onChange={(e) => handleProductRowNumericChange(index, "unitPrice", parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    {/* Points per unit */}
                    <div className="md:col-span-2 space-y-1">
                      <span className="text-[10px] font-bold text-[#5A5A40]" style={{ textTransform: "uppercase" }}>Baho (Ball)</span>
                      <input
                        type="number"
                        step="0.1"
                        min={0}
                        className="w-full bg-black/5 border border-black/10 text-xs font-sans rounded-lg p-2.5 font-bold text-indigo-700 cursor-not-allowed"
                        value={row.points}
                        disabled
                        readOnly
                      />
                    </div>

                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sub Totals calculations overlay */}
          <div className="bg-[#F5F5F0] p-5 sm:p-6 rounded-[24px] border border-black/5 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 text-xs font-sans">
            <div>
              <span className="text-gray-500 uppercase tracking-widest text-[9px] font-bold block mb-1">Xulosa hisob-kitob</span>
              <p className="text-sm font-semibold text-gray-800 leading-normal">
                Ushbu rasmiylashtirilayotgan savdo balansi quyidagicha yakunlanadi
              </p>
            </div>

            <div className="flex flex-wrap gap-4 justify-start sm:justify-end items-center">
              <div className="bg-white px-4 py-2.5 rounded-xl border border-black/5">
                <span className="text-[9px] text-[#5A5A40] block">Jami summa</span>
                <span className="font-bold text-sm text-emerald-700">{formattedAmount(computedInvoiceTotals.orderAmount)}</span>
              </div>
              <div className="bg-white px-4 py-2.5 rounded-xl border border-black/5">
                <span className="text-[9px] text-gray-500 block">Jami ball (loyalty)</span>
                <span className="font-bold text-sm text-indigo-700">+{computedInvoiceTotals.orderPoints.toFixed(1)} ball</span>
              </div>
            </div>
          </div>

          <div className="pt-3 flex justify-end">
            <button
              type="submit"
              className="bg-[#5A5A40] text-white hover:bg-[#4a4a30] text-sm font-bold font-sans px-8 py-4 rounded-2xl w-full sm:w-auto cursor-pointer shadow-lg shadow-[#5A5A40]/10 flex items-center justify-center gap-2"
            >
              Kompromiss kelishuv - Savdoni saqlash <ArrowRight size={16} />
            </button>
          </div>
        </form>
      )}


      {/* -------------------------------------------------------------
          TAB 3: CUSTOMERS & OUTSTANDING DEBTS LOGS
          ------------------------------------------------------------- */}
      {activeSubTab === "customers" && !loading && (
        <div className="space-y-4 text-left">
          <div className="bg-white p-5 rounded-[24px] border border-black/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-bold text-lg text-gray-900 leading-none">Faol Mijozlar Balanslari va Kontaktlari</h3>
              <p className="text-xs text-[#5A5A40]/70 mt-1.5 font-sans">
                Ushbu mijoz profillari joriy chat a'zolari yoki tashqi doimiy xaridorlardan kelib shakllangan
              </p>
            </div>
            
            <button
              onClick={() => setShowAddCustomerModal(true)}
              className="bg-[#5A5A40] text-white hover:bg-[#4a4a30] text-xs font-bold font-sans py-2.5 px-4 rounded-xl cursor-pointer"
            >
              ➕ Mijoz Profili Qo'shish
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customers.map(cust => {
              // Calculate specific balances for this customer
              const customerOrders = orders.filter(o => o.customerId === cust.id);
              const totalSpent = customerOrders.reduce((sum, o) => sum + o.totalAmount, 0);
              const totalPaid = payments.filter(p => p.customerId === cust.id).reduce((sum, p) => sum + p.amount, 0);
              const balance = Math.max(0, totalSpent - totalPaid);

              return (
                <div key={cust.id} className="bg-white p-5 rounded-[24px] border border-black/5 flex flex-col justify-between gap-4 relative overflow-hidden">
                  
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-gray-900 leading-tight pr-10">{cust.name}</h4>
                        {cust.notes && <p className="text-[10px] text-[#5A5A40]/70 italic mt-1 leading-relaxed pl-1">{cust.notes}</p>}
                      </div>
                      
                      <button
                        onClick={() => handleOpenAddPayment(cust, "", balance)}
                        className={`text-[10px] py-1 px-2.5 font-sans font-bold cursor-pointer rounded-lg shrink-0 transition-all ${
                          balance > 0 
                            ? "bg-rose-50 text-rose-700 border border-rose-100 hover:bg-rose-100" 
                            : "bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100"
                        }`}
                      >
                        {balance > 0 ? "To'lov kiritish" : "Balans nol"}
                      </button>
                    </div>

                    <div className="pt-2 font-sans space-y-1.5">
                      {cust.phone && (
                        <p className="text-[11px] text-gray-600 flex items-center gap-1.5">
                          <Smartphone size={13} className="text-gray-400" /> {cust.phone}
                        </p>
                      )}
                      {cust.telegram_username && (
                        <p className="text-[11px] text-gray-600 flex items-center gap-1.5">
                          <span className="text-[10px] bg-[#5A5A40]/10 text-[#5A5A40] px-1 rounded">TG</span> @{cust.telegram_username}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-black/5 flex justify-between items-center text-xs font-sans">
                    <div>
                      <span className="text-gray-400 text-[9px] block">Jami xarid</span>
                      <span className="font-bold text-gray-700">{formattedAmount(totalSpent)}</span>
                    </div>

                    <div className="text-right">
                      {balance > 0 ? (
                        <>
                          <span className="text-rose-500 text-[9px] font-bold block animate-pulse">Outstanding Qarz</span>
                          <span className="font-bold text-rose-600 text-sm">{formattedAmount(balance)}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-green-500 text-[9px] block font-bold">Holat</span>
                          <span className="text-green-600 text-[10px] font-extrabold bg-green-50 py-0.5 px-2 rounded-md">Yopilgan</span>
                        </>
                      )}
                    </div>
                  </div>

                </div>
              );
            })}

            {customers.length === 0 && (
              <div className="col-span-full bg-[#F5F5F0]/50 p-12 rounded-[28px] border border-black/5 text-center font-sans text-gray-500">
                <HelpCircle className="mx-auto mb-3 text-gray-400" size={32} />
                <p className="text-xs italic leading-normal">Ulashtirilgan mijozlar ro'yxati bo'sh. Savdo rasmiylashtirish jarayonida yangilari kiritiladi yoki yaratuvchi modulidan foydalaning.</p>
              </div>
            )}
          </div>
        </div>
      )}


      {/* -------------------------------------------------------------
          TAB 4: REPORTS HISTORY LOGS (ALL TRANSACTIONS ORDERS & PAYMENTS)
          ------------------------------------------------------------- */}
      {activeSubTab === "history" && !loading && (
        <div className="space-y-6 text-left">
          
          {/* Section 1: Orders and Negotiated Deals */}
          <div className="bg-white p-5 sm:p-6 rounded-[28px] border border-black/5 space-y-4">
            <h3 className="font-bold text-lg text-gray-900 leading-none">Sotuvlar shartnomalari tarixi</h3>
            
            <div className="overflow-x-auto min-w-full font-sans">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-black/5 text-[#5A5A40]/80 uppercase text-[9px] font-bold bg-[#F5F5F0]/50">
                    <th className="py-3 px-3">Sana</th>
                    <th className="py-3 px-3">Mijoz Ismi</th>
                    <th className="py-3 px-3">Mahsulotlar tarkibi</th>
                    <th className="py-3 px-3 text-right">Summa</th>
                    <th className="py-3 px-3 text-center">Olingan Ball</th>
                    <th className="py-3 px-3 text-center">To'lov Holati</th>
                    <th className="py-3 px-3 text-center">Amallar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {orders.map(order => (
                    <tr key={order.id} className="hover:bg-[#F5F5F0]/20 transition-colors">
                      <td className="py-3.5 px-3 font-semibold text-gray-600 font-mono">
                        {new Date(order.saleDate).toLocaleDateString("uz-UZ")}
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="font-bold text-gray-900">{order.customerName}</div>
                        {order.customerPhone && <div className="text-[10px] text-gray-500 mt-0.5">{order.customerPhone}</div>}
                      </td>
                      <td className="py-3.5 px-3 max-w-[250px]">
                        {order.items && order.items.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {order.items.map((it, idx) => (
                              <p key={idx} className="text-[10px] font-medium leading-normal text-gray-700">
                                • <code className="bg-gray-100 px-1 rounded font-mono text-[9px]">{it.productCode}</code> {it.productName.split("/")[0]} ({it.quantity} ta)
                              </p>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-400 italic">Mahsulotlar bo'sh</span>
                        )}
                        {order.notes && <p className="text-[9px] bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded mt-1 inline-block italic border border-amber-100">{order.notes}</p>}
                      </td>
                      <td className="py-3.5 px-3 font-bold text-emerald-800 text-right">
                        {formattedAmount(order.totalAmount)}
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-indigo-700">
                        +{order.totalPoints.toFixed(1)} ball
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <div className="flex gap-1.5 justify-center">
                          {order.status !== "paid" && (
                            <button
                              onClick={() => {
                                const c = customers.find(cust => cust.id === order.customerId);
                                if (c) handleOpenAddPayment(c, order.id, order.outstandingBalance);
                              }}
                              className="text-[10px] bg-emerald-500 text-white hover:bg-emerald-600 font-bold px-2 py-1 rounded cursor-pointer font-sans"
                            >
                              Yopish
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteOrder(order.id)}
                            className="bg-rose-50 text-rose-500 hover:bg-rose-100 p-1 rounded cursor-pointer"
                            title="O'chirish"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-400 italic font-sans text-xs">Savdo shartnomalari ro'yxati bo'sh.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Payments Logs */}
          <div className="bg-white p-5 sm:p-6 rounded-[28px] border border-black/5 space-y-4">
            <h3 className="font-bold text-lg text-gray-900 leading-none">Haqiqiy to'lov operatsiyalari (Transactions)</h3>
            
            <div className="overflow-x-auto min-w-full font-sans">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-black/5 text-[#5A5A40]/80 uppercase text-[9px] font-bold bg-[#F5F5F0]/50">
                    <th className="py-3 px-3">To'lov sanasi</th>
                    <th className="py-3 px-3">Mijoz Ismi</th>
                    <th className="py-3 px-3">To'lov Turi</th>
                    <th className="py-3 px-3 text-right">To'lov Miqdori</th>
                    <th className="py-3 px-3 text-left">Izohlar/Ma'lumot</th>
                    <th className="py-3 px-3 text-center">O'chirish</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {payments.map(pay => (
                    <tr key={pay.id} className="hover:bg-[#F5F5F0]/20 transition-colors">
                      <td className="py-3.5 px-3 font-semibold text-gray-600 font-mono">
                        {new Date(pay.paymentDate).toLocaleDateString("uz-UZ")}
                      </td>
                      <td className="py-3.5 px-3 font-bold text-gray-900">
                        {pay.customerName}
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="text-[10px] bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-black font-sans uppercase">
                          {pay.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 font-bold text-emerald-600 text-right">
                        {formattedAmount(pay.amount)}
                      </td>
                      <td className="py-3.5 px-3 text-gray-500 italic">
                        {pay.notes || "Yopiq shartnoma hisobidan"}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <button
                          onClick={() => handleDeletePayment(pay.id)}
                          className="bg-rose-50 text-rose-500 hover:bg-rose-100 p-1.5 rounded cursor-pointer inline-flex items-center"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {payments.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-400 italic font-sans text-xs">Mablag' qabul tranzaksiyalari kiritilmagan.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}


      {/* -------------------------------------------------------------
          MODAL WINDOW 1: ADD NEW FULL CUSTOMER PROFILE
          ------------------------------------------------------------- */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white p-6 sm:p-8 rounded-[32px] border border-black/5 shadow-2xl relative text-left">
            <button
              onClick={() => setShowAddCustomerModal(false)}
              className="absolute top-4 right-4 text-[#5A5A40]/60 hover:text-[#5A5A40] text-sm p-2 cursor-pointer font-bold font-sans"
            >
              ✕
            </button>

            <div className="flex flex-col items-center text-center gap-4 mb-6">
              <div className="w-12 h-12 bg-[#5A5A40] text-white rounded-2xl flex items-center justify-center shadow-lg shadow-[#5A5A40]/15">
                <UserPlus size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold font-sans text-gray-900">Mijoz Profili Yaratish</h3>
                <p className="text-xs text-[#5A5A40]/75 italic mt-1 font-sans">
                  Sotish jarayonlarida to'liq ismlarni va balance larni kuzatish uchun
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateCustomerSubmit} className="space-y-4 font-sans">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">Mijoz to'liq ismi *</label>
                <input
                  type="text"
                  required
                  placeholder="Masalan: Lola Karimova"
                  className="w-full bg-[#F5F5F0] border-none text-sm rounded-lg p-3 focus:ring-2 focus:ring-[#5A5A40]/20 font-semibold"
                  value={newCustomerForm.name}
                  onChange={(e) => setNewCustomerForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">Telefon raqami</label>
                <input
                  type="text"
                  placeholder="+998 -- --- -- --"
                  className="w-full bg-[#F5F5F0] border-none text-sm rounded-lg p-3 focus:ring-2 focus:ring-[#5A5A40]/20 font-bold"
                  value={newCustomerForm.phone}
                  onChange={(e) => setNewCustomerForm(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">Telegram Username</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">@</span>
                    <input
                      type="text"
                      placeholder="username"
                      className="w-full bg-[#F5F5F0] border-none text-sm rounded-lg py-3 pl-7 pr-3 focus:ring-2 focus:ring-[#5A5A40]/20"
                      value={newCustomerForm.telegramUsername}
                      onChange={(e) => setNewCustomerForm(prev => ({ ...prev, telegramUsername: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">Telegram user ID</label>
                  <input
                    type="text"
                    placeholder="123456"
                    className="w-full bg-[#F5F5F0] border-none text-sm rounded-lg p-3 focus:ring-2 focus:ring-[#5A5A40]/20"
                    value={newCustomerForm.telegramId}
                    onChange={(e) => setNewCustomerForm(prev => ({ ...prev, telegramId: e.target.value.replace(/\D/g, "") }))}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">Izohlar / Doimiy ma'lumotlar</label>
                <textarea
                  placeholder="Ushbu mijoz qaysi toifadagi kosmetika mahsulotlariga qiziqadi..."
                  className="w-full bg-[#F5F5F0] border-none text-sm rounded-lg p-3 focus:ring-2 focus:ring-[#5A5A40]/20 h-16 resize-none"
                  value={newCustomerForm.notes}
                  onChange={(e) => setNewCustomerForm(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="w-1/2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-[#5A5A40] text-white font-bold py-3 rounded-xl text-xs transition-colors shadow-md hover:bg-[#4a4a30] cursor-pointer"
                >
                  Mijozni saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* -------------------------------------------------------------
          MODAL WINDOW 2: ADD TRANSACTION PAYMENT
          ------------------------------------------------------------- */}
      {showAddPaymentModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white p-6 sm:p-8 rounded-[32px] border border-black/5 shadow-2xl relative text-left">
            <button
              onClick={() => setShowAddPaymentModal(false)}
              className="absolute top-4 right-4 text-[#5A5A40]/60 hover:text-[#5A5A40] text-sm p-2 cursor-pointer font-bold font-sans"
            >
              ✕
            </button>

            <div className="flex flex-col items-center text-center gap-4 mb-6">
              <div className="w-12 h-12 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/15">
                <DollarSign size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold font-sans text-gray-900">Mablag' qabul qilish</h3>
                <p className="text-xs text-[#5A5A40]/75 italic mt-1 font-sans">
                  Sotilgan kelishuvlar hisobidan to'lov qayd qilish
                </p>
              </div>
            </div>

            <form onSubmit={handlePostPaymentSubmit} className="space-y-4 font-sans">
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1 block">To'layotgan Mijoz</span>
                <p className="text-sm font-bold bg-[#F5F5F0] p-3 rounded-lg border border-black/5 text-gray-900">{paymentForm.customerName}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">To'lov summasi UZS *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    placeholder="UZS"
                    className="w-full bg-[#F5F5F0] border-none text-sm rounded-lg p-3 font-bold text-emerald-800 focus:ring-2 focus:ring-emerald-500/20"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">To'lov turi *</label>
                  <select
                    className="w-full bg-[#F5F5F0] border-none text-sm rounded-lg p-3 cursor-pointer text-[#5A5A40] font-sans font-bold"
                    value={paymentForm.paymentMethod}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                  >
                    <option value="click">CLICK / Payme</option>
                    <option value="cash">Naqd (CASH)</option>
                    <option value="bank_transfer">Bank O'tkazmasi</option>
                    <option value="card">Terminal / Plastik kash</option>
                    <option value="other">Boshqa terminal</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">Sana</label>
                <input
                  type="date"
                  className="w-full bg-[#F5F5F0] border-none text-sm rounded-lg p-3 font-bold text-gray-700"
                  value={paymentForm.paymentDate}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, paymentDate: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">Qayd / To'lov maqsadi</label>
                <input
                  type="text"
                  placeholder="Karta unikal raqami, yoki uchrashuv joyi"
                  className="w-full bg-[#F5F5F0] border-none text-sm rounded-lg p-3"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddPaymentModal(false)}
                  className="w-1/2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-emerald-500 text-white font-bold py-3 rounded-xl text-xs transition-colors shadow-md hover:bg-emerald-600 cursor-pointer"
                >
                  Kvitansiya saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
