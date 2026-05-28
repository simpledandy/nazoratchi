import React, { useMemo } from "react";
import { Users, UserPlus, UserMinus, Calendar } from "lucide-react";
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
}

export default function DashboardTab({ stats }: DashboardTabProps) {
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
      <header className="flex justify-between items-end">
        <div className="text-left">
          <h2 className="text-4xl font-light tracking-tight mb-2">Umumiy Statistika</h2>
          <p className="text-[#5A5A40]/60 italic">Guruhdagi barcha harakatlar tahlili</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-white px-4 py-2 rounded-xl border border-black/5 flex items-center gap-3 shadow-sm">
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
          subValue="+12% o'sish"
        />
        <StatCard 
          icon={<UserPlus className="text-emerald-600" />} 
          label="Jami takliflar" 
          value={stats?.totalInvites || 0} 
          subValue="Barcha vaqt"
        />
        <StatCard 
          icon={<UserMinus className="text-rose-600" />} 
          label="Chiqib ketganlar" 
          value={stats?.totalLeaves || 0} 
          subValue="Barcha vaqt"
        />
      </div>

      {/* Chart */}
      <div className="bg-white p-8 rounded-[32px] border border-black/5 shadow-sm text-left">
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
    </div>
  );
}
