import React, { useMemo } from "react";
import { Users, UserPlus, UserMinus, Calendar, Link as LinkIcon, Shield, Trash2, Eye } from "lucide-react";
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import { format, subDays } from "date-fns";
import { uz } from "date-fns/locale";
import { Stats } from "../types";
import StatCard from "./ui/StatCard";

interface DashboardTabProps {
  stats: Stats | null;
  links?: any[];
}

export default function DashboardTab({ stats, links = [] }: DashboardTabProps) {
  const chartData = useMemo(() => {
    if (!stats) return [];
    
    const days = 7;
    const data = [];
    for (let i = days; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, "yyyy-MM-dd");
      
      const invitesCount = (stats.invites || []).filter(inv => 
        inv.timestamp?.startsWith(dateStr)
      ).length;
      
      const leavesCount = (stats.leaves || []).filter(l => 
        l.timestamp?.startsWith(dateStr)
      ).length;

      data.push({
        name: format(date, "d-MMM", { locale: uz }),
        takliflar: invitesCount,
        chiqishlar: leavesCount
      });
    }
    return data;
  }, [stats]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div className="text-left">
          <h2 className="text-3xl sm:text-4xl font-light tracking-tight mb-2">Umumiy Statistika</h2>
          <p className="text-[#5A5A40]/60 italic text-sm sm:text-base">Guruhdagi barcha harakatlar tahlili</p>
        </div>
        <div className="flex gap-4 w-full sm:w-auto">
          <div className="bg-white px-4 py-2 rounded-xl border border-black/5 flex items-center gap-3 shadow-sm w-full sm:w-auto justify-center sm:justify-start">
            <Calendar size={18} className="text-[#5A5A40]" />
            <span className="text-sm font-medium">Oxirgi 7 kun</span>
          </div>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          icon={<Users className="text-blue-600" />} 
          label="Jami a'zolar" 
          value={stats?.totalMembers || 0} 
          subValue="Tizimda ro'yxatga olinganlar"
        />
        <StatCard 
          icon={<UserPlus className="text-emerald-600" />} 
          label="Jami takliflar" 
          value={stats?.totalInvites || 0} 
          subValue="Guruhga qo'shilganlar"
        />
        <StatCard 
          icon={<UserMinus className="text-rose-600" />} 
          label="Chiqib ketganlar" 
          value={stats?.totalLeaves || 0} 
          subValue="Bot qo'shilgandan keyin"
        />
      </div>

      {/* Chart */}
      <div className="bg-white p-4 sm:p-8 rounded-[32px] border border-black/5 shadow-sm text-left">
        <h3 className="text-xl font-medium mb-8">Faollik grafigi</h3>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorTaklif" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorChiqish" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#888'}} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#888'}} />
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Area type="monotone" dataKey="takliflar" stroke="#10b981" fillOpacity={1} fill="url(#colorTaklif)" strokeWidth={2} />
              <Area type="monotone" dataKey="chiqishlar" stroke="#f43f5e" fillOpacity={1} fill="url(#colorChiqish)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Link Logs / Moderation Section */}
      <div className="bg-white p-4 sm:p-8 rounded-[32px] border border-black/5 shadow-sm text-left">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h3 className="text-xl font-medium flex items-center gap-2">
              <LinkIcon size={20} className="text-[#5A5A40]" />
              Havolalar Audit Logi (Supabase)
            </h3>
            <p className="text-xs text-[#5A5A40]/70 italic mt-1">Bot tomonidan aniqlangan va boshqariladigan guruh havolalari logi</p>
          </div>
          <span className="text-xs font-mono bg-amber-50 text-amber-700 px-3 py-1 rounded-full font-bold border border-amber-100">
            Real-vaqtdgi nazorat
          </span>
        </div>

        {links.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 bg-[#F5F5F0]/30 rounded-2xl border border-dashed border-black/5">
            <Eye size={36} className="text-[#5A5A40]/40 mb-2 animate-pulse" />
            <p className="text-sm text-[#5A5A40]/70 italic">Hozircha guruhda hech qanday tashqi havola qayd etilmadi.</p>
            <p className="text-xs text-[#5A5A40]/50 mt-1">Guruhda link joylanganda, ushbu ro'yxatda avtomatik ko'rinadi.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans text-sm">
              <thead>
                <tr className="border-b border-black/5 text-[#5A5A40]/60 text-xs uppercase tracking-wider">
                  <th className="py-3 px-4 font-bold">Yuboruvchi</th>
                  <th className="py-3 px-4 font-bold">Xabar</th>
                  <th className="py-3 px-4 font-bold">Topilgan Havolalar</th>
                  <th className="py-3 px-4 font-bold text-center">Holati / Amal</th>
                  <th className="py-3 px-4 font-bold text-right">Sana</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {links.map((log: any) => (
                  <tr key={log.id} className="hover:bg-[#F5F5F0]/30 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-[#1a1a1a]">
                      <div className="font-semibold">{log.sender_name}</div>
                      {log.sender_username && (
                        <div className="text-xs text-[#5A5A40]/60">@{log.sender_username}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-[#5a5a5a] max-w-xs truncate" title={log.message_text}>
                      {log.message_text}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-mono text-blue-600 break-all select-all">
                      {log.extracted_link}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {log.is_deleted ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold leading-none bg-rose-50 text-rose-700 px-2.5 py-1.5 rounded-full border border-rose-100">
                          <Trash2 size={12} /> O'chirildi (Taqiqlangan)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold leading-none bg-emerald-50 text-emerald-700 px-2.5 py-1.5 rounded-full border border-emerald-100">
                          <Shield size={12} /> Ruxsat etildi (Admin)
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right text-xs text-[#5A5A40]/60">
                      {new Date(log.timestamp).toLocaleString("uz-UZ", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric"
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

