import React, { useState, useEffect } from "react";
import { ChevronRight, Calendar, Copy, Check, Filter, Trophy, Sparkles } from "lucide-react";
import { LeaderboardItem } from "../types";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, subDays } from "date-fns";

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

interface LeaderboardTabProps {
  leaderboard: LeaderboardItem[];
  fetchUserDetails: (id: string) => void;
  selectedGroupId?: string;
  contests?: any[];
}

export default function LeaderboardTab({ 
  leaderboard: initialLeaderboard, 
  fetchUserDetails,
  selectedGroupId,
  contests = []
}: LeaderboardTabProps) {
  const [items, setItems] = useState<LeaderboardItem[]>(initialLeaderboard);
  const [filterType, setFilterType] = useState<"all" | "7d" | "30d" | "contest" | "custom">("all");
  const [customDate, setCustomDate] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  // Find active contest if any
  const activeContest = contests.find(c => c.isActive || c.is_active);

  useEffect(() => {
    setItems(initialLeaderboard);
  }, [initialLeaderboard]);

  const loadLeaderboardWithDate = async (sinceStr: string) => {
    try {
      setLoading(true);
      const queryParam = selectedGroupId ? `?chatId=${selectedGroupId}` : "";
      const sinceParam = sinceStr ? `&since=${encodeURIComponent(sinceStr)}` : "";
      const url = `/api/leaderboard${queryParam ? queryParam + sinceParam : (sinceParam ? `?${sinceParam.slice(1)}` : "")}`;

      const res = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          "X-Verified-Chats": localStorage.getItem("verified_chat_ids") || ""
        }
      });

      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (e) {
      console.error("Failed to load filtered leaderboard:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (type: "all" | "7d" | "30d" | "contest" | "custom") => {
    setFilterType(type);
    if (type === "all") {
      setItems(initialLeaderboard);
    } else if (type === "7d") {
      const d = format(subDays(new Date(), 7), "yyyy-MM-dd");
      loadLeaderboardWithDate(d);
    } else if (type === "30d") {
      const d = format(subDays(new Date(), 30), "yyyy-MM-dd");
      loadLeaderboardWithDate(d);
    } else if (type === "contest" && activeContest) {
      const d = activeContest.startDate || activeContest.start_date;
      loadLeaderboardWithDate(d);
    }
  };

  const handleCustomDateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customDate) {
      loadLeaderboardWithDate(customDate);
    }
  };

  // Get date string to show in Telegram command suggestion
  const getSuggestedCommand = () => {
    if (filterType === "7d") return "/leaderboard 7d";
    if (filterType === "30d") return "/leaderboard 30d";
    if (filterType === "custom" && customDate) return `/leaderboard ${customDate}`;
    if (filterType === "contest" && activeContest) {
      const d = activeContest.startDate || activeContest.start_date;
      const formatted = d ? format(new Date(d), "yyyy-MM-dd") : "";
      return formatted ? `/leaderboard ${formatted}` : "/leaderboard";
    }
    return "/leaderboard";
  };

  const handleCopyCommand = () => {
    const cmd = getSuggestedCommand();
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 text-left">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl sm:text-4xl font-light tracking-tight mb-2">Reyting Jadvali</h2>
          <p className="text-[#5A5A40]/60 italic text-sm sm:text-base">
            Guruhga a'zo taklif qilgan faol foydalanuvchilar reytingi
          </p>
        </div>

        {/* Telegram Command Badge with One-Click Copy */}
        <div className="bg-[#F5F5F0] border border-black/5 p-2.5 px-3.5 rounded-2xl flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Trophy size={14} className="text-[#5A5A40]" />
            <span className="text-[#5A5A40]/70">Telegram buyrug'i:</span>
            <code className="font-mono font-bold text-[#1a1a1a] bg-white px-2 py-0.5 rounded-md border border-black/5">
              {getSuggestedCommand()}
            </code>
          </div>
          <button
            onClick={handleCopyCommand}
            className="flex items-center gap-1 font-bold text-[#5A5A40] hover:text-black transition-colors cursor-pointer bg-white px-2 py-1 rounded-md border border-black/5 shadow-2xs"
            title="Nusxa olish"
          >
            {copiedCmd ? (
              <>
                <Check size={12} className="text-emerald-600" />
                <span className="text-emerald-600">Nusxalandi</span>
              </>
            ) : (
              <>
                <Copy size={12} />
                <span>Nusxa</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Filter Bar: Select time range / set date */}
      <div className="bg-white p-4 rounded-2xl border border-black/5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-[#5A5A40] mr-1">
            <Filter size={14} />
            <span>Davr:</span>
          </div>

          <button
            onClick={() => handleFilterChange("all")}
            className={cn(
              "px-3 py-1.5 rounded-xl font-medium transition-colors cursor-pointer",
              filterType === "all"
                ? "bg-[#5A5A40] text-white font-bold"
                : "bg-[#F5F5F0] text-[#5A5A40] hover:bg-black/5"
            )}
          >
            Barcha vaqt
          </button>

          {activeContest && (
            <button
              onClick={() => handleFilterChange("contest")}
              className={cn(
                "px-3 py-1.5 rounded-xl font-medium transition-colors cursor-pointer flex items-center gap-1",
                filterType === "contest"
                  ? "bg-[#5A5A40] text-white font-bold"
                  : "bg-amber-50 text-amber-900 border border-amber-200/60 hover:bg-amber-100/70"
              )}
            >
              <Sparkles size={12} className="text-amber-600" />
              <span>Faol konkursdan beri</span>
            </button>
          )}

          <button
            onClick={() => handleFilterChange("7d")}
            className={cn(
              "px-3 py-1.5 rounded-xl font-medium transition-colors cursor-pointer",
              filterType === "7d"
                ? "bg-[#5A5A40] text-white font-bold"
                : "bg-[#F5F5F0] text-[#5A5A40] hover:bg-black/5"
            )}
          >
            Oxirgi 7 kun
          </button>

          <button
            onClick={() => handleFilterChange("30d")}
            className={cn(
              "px-3 py-1.5 rounded-xl font-medium transition-colors cursor-pointer",
              filterType === "30d"
                ? "bg-[#5A5A40] text-white font-bold"
                : "bg-[#F5F5F0] text-[#5A5A40] hover:bg-black/5"
            )}
          >
            Oxirgi 30 kun
          </button>
        </div>

        {/* Custom date input */}
        <form onSubmit={handleCustomDateSubmit} className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 bg-[#F5F5F0] px-3 py-1.5 rounded-xl border border-black/5">
            <Calendar size={13} className="text-[#5A5A40]" />
            <input
              type="date"
              value={customDate}
              onChange={(e) => {
                setCustomDate(e.target.value);
                setFilterType("custom");
              }}
              max={format(new Date(), "yyyy-MM-dd")}
              className="bg-transparent border-none text-xs text-[#1a1a1a] focus:outline-none cursor-pointer"
            />
          </div>
          <button
            type="submit"
            disabled={!customDate || loading}
            className="px-3 py-1.5 bg-[#5A5A40] text-white font-bold rounded-xl hover:bg-[#404030] disabled:opacity-50 transition-colors cursor-pointer"
          >
            Qo'llash
          </button>
        </form>
      </div>

      {/* Leaderboard Table Container */}
      <div className="bg-white rounded-[32px] border border-black/5 shadow-xs overflow-hidden text-left">
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
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-8 py-12 text-center text-sm text-[#5A5A40]/60">
                    Reyting yuklanmoqda...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-8 py-12 text-center text-sm text-[#5A5A40]/60">
                    Tanlangan sana oralig'ida hech qanday taklif qayd etilmagan.
                  </td>
                </tr>
              ) : (
                items.map((item, index) => (
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
                        {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1}
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

