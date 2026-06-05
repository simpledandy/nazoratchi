import React, { useState, useMemo } from "react";
import { Plus, Search, Trash2, ArrowRight, UserPlus } from "lucide-react";
import { Customer, Product } from "../../types";

interface SalesIntakeProps {
  selectedGroupId: string;
  groups: any[];
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  groupMembers: any[];
  productsList: Product[];
  showToast: (msg: string, type?: "success" | "error" | "warning" | "info") => void;
  fetchSalesData: () => void;
  setActiveSubTab: (tab: "intake" | "customers" | "analytics" | "history") => void;
  setShowAddCustomerModal: (show: boolean) => void;
  selectedCustomerId: string;
  setSelectedCustomerId: (id: string) => void;
  saleCustomerSearch: string;
  setSaleCustomerSearch: (val: string) => void;
  formattedAmount: (num: number) => string;
}

export default function SalesIntake({
  selectedGroupId,
  groups,
  customers,
  setCustomers,
  groupMembers,
  productsList,
  showToast,
  fetchSalesData,
  setActiveSubTab,
  setShowAddCustomerModal,
  selectedCustomerId,
  setSelectedCustomerId,
  saleCustomerSearch,
  setSaleCustomerSearch,
  formattedAmount
}: SalesIntakeProps) {
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

  return (
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
                  className="w-full text-left px-4 py-3 hover:bg-[#F5F5F0] border-b border-black/5 text-xs block transition-colors bg-white hover:text-black"
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
            className="w-full bg-[#F5F5F0] border-none text-sm font-sans rounded-xl p-3.5 cursor-not-allowed text-[#5A5A40]"
            value={selectedGroupId}
            onChange={() => {}}
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
            className="w-full bg-[#F5F5F0] border-none text-sm font-sans rounded-xl p-3.5 focus:ring-2 focus:ring-[#5A5A40]/20"
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
                          className="w-full text-left px-3 py-2.5 hover:bg-gray-100 text-[11px] block transition-colors border-b border-black/5 bg-white text-black"
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
  );
}
