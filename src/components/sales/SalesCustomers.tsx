import React from "react";
import { Smartphone, HelpCircle } from "lucide-react";
import { Customer, Order, Payment } from "../../types";

interface SalesCustomersProps {
  customers: Customer[];
  orders: Order[];
  payments: Payment[];
  setShowAddCustomerModal: (show: boolean) => void;
  handleOpenAddPayment: (cust: Customer, targetOrderId?: string, prefillAmount?: number) => void;
  formattedAmount: (num: number) => string;
}

export default function SalesCustomers({
  customers,
  orders,
  payments,
  setShowAddCustomerModal,
  handleOpenAddPayment,
  formattedAmount
}: SalesCustomersProps) {
  return (
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
  );
}
