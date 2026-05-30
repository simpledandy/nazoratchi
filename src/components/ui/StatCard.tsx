import React from "react";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  subValue: string;
  onClick?: () => void;
  active?: boolean;
}

export default function StatCard({ icon, label, value, subValue, onClick, active }: StatCardProps) {
  const isClickable = !!onClick;
  
  return (
    <div 
      onClick={onClick}
      className={`p-6 rounded-[32px] border transition-all duration-300 flex flex-col gap-4 text-left ${
        isClickable ? "cursor-pointer hover:shadow-md hover:translate-y-[-2px]" : ""
      } ${
        active 
          ? "bg-[#5A5A40] text-white border-[#5A5A40] shadow-md" 
          : "bg-white text-[#1a1a1a] border-black/5 shadow-sm"
      }`}
    >
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
        active ? "bg-white/10 text-white" : "bg-[#F5F5F0]"
      }`}>
        {icon}
      </div>
      <div>
        <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${
          active ? "text-white/60" : "text-[#5A5A40]/55"
        }`}>{label}</p>
        <p className="text-3xl font-bold">{value}</p>
        <p className={`text-xs font-medium mt-1 ${
          active ? "text-white/80" : "text-emerald-700"
        }`}>{subValue}</p>
      </div>
      
      {isClickable && (
        <div className={`text-[10px] font-bold mt-1 text-right transition-opacity ${
          active ? "text-white/90" : "text-[#5A5A40]/60 hover:text-black/80"
        }`}>
          {active ? "Ro'yxat ko'rinmoqda ↓" : "Batafsil ro'yxat ↗"}
        </div>
      )}
    </div>
  );
}
