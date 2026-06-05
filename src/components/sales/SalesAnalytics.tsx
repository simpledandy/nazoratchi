import React from "react";
import { 
  TrendingUp, ShoppingBag, CheckCircle, TrendingDown, Award, 
  AlertTriangle 
} from "lucide-react";
import { BusinessMetrics, Customer } from "../../types";

interface SalesAnalyticsProps {
  metrics: BusinessMetrics | null;
  groups: any[];
  customers: Customer[];
  formattedAmount: (num: number) => string;
  handleOpenAddPayment: (cust: Customer, targetOrderId?: string, prefillAmount?: number) => void;
}

export default function SalesAnalytics({
  metrics,
  groups,
  customers,
  formattedAmount,
  handleOpenAddPayment
}: SalesAnalyticsProps) {
  return (
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
                const maxSold = Math.max(...metrics.bestSellers!.map(b => b.quantitySold), 1);
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
                const maxRev = Math.max(...metrics.channelPerformance!.map(c => c.revenueGenerated), 1);
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
  );
}
