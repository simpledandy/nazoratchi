import React from "react";
import { Trash2 } from "lucide-react";
import { Order, Payment, Customer } from "../../types";

interface SalesHistoryProps {
  orders: Order[];
  payments: Payment[];
  customers: Customer[];
  formattedAmount: (num: number) => string;
  getStatusBadge: (status: string) => React.ReactNode;
  handleOpenAddPayment: (cust: Customer, targetOrderId?: string, prefillAmount?: number) => void;
  handleDeleteOrder: (id: string) => void;
  handleDeletePayment: (id: string) => void;
}

export default function SalesHistory({
  orders,
  payments,
  customers,
  formattedAmount,
  getStatusBadge,
  handleOpenAddPayment,
  handleDeleteOrder,
  handleDeletePayment
}: SalesHistoryProps) {
  return (
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
  );
}
