import React, { useState, useEffect } from "react";
import { 
  TrendingUp, Users, FileText, ShoppingBag, UserPlus, DollarSign 
} from "lucide-react";
import productsData from "../products.json";
import { Customer, Order, Payment, BusinessMetrics, Product } from "../types";

import SalesAnalytics from "./sales/SalesAnalytics";
import SalesIntake from "./sales/SalesIntake";
import SalesCustomers from "./sales/SalesCustomers";
import SalesHistory from "./sales/SalesHistory";

interface SalesTabProps {
  selectedGroupId: string;
  groups: any[];
  showToast: (msg: string, type?: "success" | "error" | "warning" | "info") => void;
}

export default function SalesTab({ selectedGroupId, groups, showToast }: SalesTabProps) {
  // Product dataset loaded from static JSON configuration
  const productsList = productsData as Product[];

  // Sub-tabs state inside Sales Tracker
  const [activeSubTab, setActiveSubTab] = useState<"intake" | "customers" | "analytics" | "history" >("analytics");

  // Core loaded models
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [metrics, setMetrics] = useState<BusinessMetrics | null>(null);
  const [loading, setLoading] = useState(false);

  // Group chat members (used to recommend/autocomplete customer info)
  const [groupMembers, setGroupMembers] = useState<any[]>([]);

  // 1. New Customer form State & Modal flags
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: "",
    phone: "",
    telegramUsername: "",
    telegramId: "",
    chatId: selectedGroupId,
    notes: ""
  });

  // State shared back from intake module
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [saleCustomerSearch, setSaleCustomerSearch] = useState("");

  // 2. New Payment Form state
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

  // Record Transactions / Payments Modals Handler
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

  // Delete Triggers
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

  // Utilities
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

      {/* SUB-TABS MOUNTING POINTS */}
      {!loading && activeSubTab === "analytics" && (
        <SalesAnalytics 
          metrics={metrics}
          groups={groups}
          customers={customers}
          formattedAmount={formattedAmount}
          handleOpenAddPayment={handleOpenAddPayment}
        />
      )}

      {!loading && activeSubTab === "intake" && (
        <SalesIntake 
          selectedGroupId={selectedGroupId}
          groups={groups}
          customers={customers}
          setCustomers={setCustomers}
          groupMembers={groupMembers}
          productsList={productsList}
          showToast={showToast}
          fetchSalesData={fetchSalesData}
          setActiveSubTab={setActiveSubTab}
          setShowAddCustomerModal={setShowAddCustomerModal}
          selectedCustomerId={selectedCustomerId}
          setSelectedCustomerId={setSelectedCustomerId}
          saleCustomerSearch={saleCustomerSearch}
          setSaleCustomerSearch={setSaleCustomerSearch}
          formattedAmount={formattedAmount}
        />
      )}

      {!loading && activeSubTab === "customers" && (
        <SalesCustomers 
          customers={customers}
          orders={orders}
          payments={payments}
          setShowAddCustomerModal={setShowAddCustomerModal}
          handleOpenAddPayment={handleOpenAddPayment}
          formattedAmount={formattedAmount}
        />
      )}

      {!loading && activeSubTab === "history" && (
        <SalesHistory 
          orders={orders}
          payments={payments}
          customers={customers}
          formattedAmount={formattedAmount}
          getStatusBadge={getStatusBadge}
          handleOpenAddPayment={handleOpenAddPayment}
          handleDeleteOrder={handleDeleteOrder}
          handleDeletePayment={handleDeletePayment}
        />
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
