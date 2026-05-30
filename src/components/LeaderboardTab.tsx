import React from "react";
import { ChevronRight } from "lucide-react";
import { LeaderboardItem } from "../types";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

interface LeaderboardTabProps {
  leaderboard: LeaderboardItem[];
  fetchUserDetails: (id: string) => void;
}

export default function LeaderboardTab({ leaderboard, fetchUserDetails }: LeaderboardTabProps) {
  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 text-left">
      <header>
        <h2 className="text-3xl sm:text-4xl font-light tracking-tight mb-2">Reyting Jadvali</h2>
        <p className="text-[#5A5A40]/60 italic text-sm sm:text-base">Eng ko'p taklif qilgan foydalanuvchilar</p>
      </header>

      <div className="bg-white rounded-[32px] border border-black/5 shadow-sm overflow-hidden text-left">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[500px]">
            <thead>
              <tr className="border-b border-black/5 bg-black/5">
                <th className="px-4 md:px-8 py-4 text-xs font-bold uppercase tracking-widest text-[#5A5A40]">O'rin</th>
                <th className="px-4 md:px-8 py-4 text-xs font-bold uppercase tracking-widest text-[#5A5A40]">Foydalanuvchi</th>
                <th className="px-4 md:px-8 py-4 text-xs font-bold uppercase tracking-widest text-[#5A5A40]">Takliflar soni</th>
                <th className="px-4 md:px-8 py-4 text-xs font-bold uppercase tracking-widest text-[#5A5A40]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {leaderboard.map((item, index) => (
                <tr 
                  key={item.id} 
                  onClick={() => fetchUserDetails(item.id)}
                  className="hover:bg-[#F5F5F0]/80 cursor-pointer transition-colors"
                  title="Tafsilotlarni ko'rish uchun bosing"
                >
                  <td className="px-4 md:px-8 py-4 md:py-6">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
                      index === 0 ? "bg-yellow-100 text-yellow-700" : 
                      index === 1 ? "bg-slate-100 text-slate-700" :
                      index === 2 ? "bg-orange-100 text-orange-700" : "bg-gray-50 text-gray-400"
                    )}>
                      {index + 1}
                    </div>
                  </td>
                  <td className="px-4 md:px-8 py-4 md:py-6 font-medium">{item.name}</td>
                  <td className="px-4 md:px-8 py-4 md:py-6">
                    <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-sm font-bold">
                      {item.count} ta
                    </span>
                  </td>
                  <td className="px-4 md:px-8 py-4 md:py-6 text-right">
                    <button className="text-[#5A5A40] hover:text-black transition-colors cursor-pointer">
                      <ChevronRight size={20} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
