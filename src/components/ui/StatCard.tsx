import React from "react";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  subValue: string;
}

export default function StatCard({ icon, label, value, subValue }: StatCardProps) {
  return (
    <div className="bg-white p-6 rounded-[32px] border border-black/5 shadow-sm flex flex-col gap-4 text-left">
      <div className="w-12 h-12 bg-[#F5F5F0] rounded-2xl flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-[#5A5A40]/50 mb-1">{label}</p>
        <p className="text-3xl font-bold">{value}</p>
        <p className="text-xs text-emerald-600 font-medium mt-1">{subValue}</p>
      </div>
    </div>
  );
}
