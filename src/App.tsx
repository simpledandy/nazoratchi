import React, { useState, useEffect } from "react";
import { format, subDays } from "date-fns";
import { Menu } from "lucide-react";
import { Stats, LeaderboardItem, TabType } from "./types";
import Sidebar from "./components/Sidebar";
import DashboardTab from "./components/DashboardTab";
import LeaderboardTab from "./components/LeaderboardTab";
import ContestsTab from "./components/ContestsTab";
import SettingsTab from "./components/SettingsTab";
import InstructionsTab from "./components/InstructionsTab";
import UserDetailModal from "./components/UserDetailModal";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "warning" | "info";
}

export default function App() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [contests, setContests] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDetailData, setUserDetailData] = useState<any | null>(null);
  const [loadingUserDetails, setLoadingUserDetails] = useState(false);

  // Dynamic system/bot configuration status
  const [configStatus, setConfigStatus] = useState({
    supabaseConfigured: false,
    telegramTokenConfigured: false,
    botInitialized: false,
    statusText: "Yuklanmoqda...",
    statusCode: "LOADING"
  });

  // Custom Toast Notifications State
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: Toast["type"] = "success") => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    // Auto-remove toast after 4 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Contest form state
  const [contestForm, setContestForm] = useState({
    title: "",
    description: "",
    startDate: format(new Date(), "yyyy-MM-dd"),
    endDate: format(subDays(new Date(), -7), "yyyy-MM-dd"),
    prizes: "",
    imageUrl: "",
    chatId: ""
  });

  // Whenever selectedGroupId changes, update contestForm's default chatId
  useEffect(() => {
    setContestForm(prev => ({ ...prev, chatId: selectedGroupId }));
  }, [selectedGroupId]);

  useEffect(() => {
    fetchData(selectedGroupId);
  }, [selectedGroupId]);

  useEffect(() => {
    fetchConfigStatus();
  }, []);

  const fetchConfigStatus = async () => {
    try {
      const res = await fetch("/api/config-status");
      if (res.ok) {
        setConfigStatus(await res.json());
      }
    } catch (e) {
      console.error("Tizim statusini yuklashda xatolik:", e);
    }
  };

  const fetchData = async (groupId?: string) => {
    try {
      setLoading(true);
      const queryParam = groupId ? `?chatId=${groupId}` : "";
      const [statsRes, leaderboardRes, groupsRes, contestsRes, linksRes] = await Promise.all([
        fetch(`/api/stats${queryParam}`),
        fetch(`/api/leaderboard${queryParam}`),
        fetch("/api/groups"),
        fetch(`/api/contests${queryParam}`),
        fetch(`/api/links${queryParam}`)
      ]);
      
      if (statsRes.ok) setStats(await statsRes.json());
      if (leaderboardRes.ok) setLeaderboard(await leaderboardRes.json());
      if (groupsRes.ok) setGroups(await groupsRes.json());
      if (contestsRes.ok) setContests(await contestsRes.json());
      if (linksRes.ok) setLinks(await linksRes.json());
    } catch (error) {
      console.error("Ma'lumotlarni yuklashda xatolik:", error);
      showToast("Ma'lumotlarni yuklashda xatolik yuz berdi", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDetails = async (id: string) => {
    try {
      setLoadingUserDetails(true);
      setSelectedUserId(id);
      const queryParam = selectedGroupId ? `?chatId=${selectedGroupId}` : "";
      const res = await fetch(`/api/users/${id}/details${queryParam}`);
      if (res.ok) {
        setUserDetailData(await res.json());
      } else {
        showToast("Foydalanuvchi ma'lumotlarini yuklab bo'lmadi", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Xatolik yuz berdi", "error");
    } finally {
      setLoadingUserDetails(false);
    }
  };

  const handleCreateContest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contestForm.chatId) {
      showToast("Iltimos, avval guruhni tanlang!", "warning");
      return;
    }
    if (!contestForm.title.trim()) {
      showToast("Iltimos, konkurs nomini kiriting!", "warning");
      return;
    }
    if (!contestForm.startDate) {
      showToast("Iltimos, boshlanish sanasini tanlang!", "warning");
      return;
    }
    if (!contestForm.endDate) {
      showToast("Iltimos, tugash sanasini tanlang!", "warning");
      return;
    }
    if (new Date(contestForm.startDate) > new Date(contestForm.endDate)) {
      showToast("Tugash sanasi boshlanish sanasidan oldin bo'lishi mumkin emas!", "error");
      return;
    }
    if (!contestForm.prizes.trim()) {
      showToast("Iltimos, sovrinlar va sovg'alar tavsifini kiriting!", "warning");
      return;
    }
    try {
      const res = await fetch("/api/contests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contestForm)
      });
      if (res.ok) {
        showToast("Konkurs muvaffaqiyatli yaratildi va e'lon qilindi!", "success");
        setContestForm({
          title: "",
          description: "",
          startDate: format(new Date(), "yyyy-MM-dd"),
          endDate: format(subDays(new Date(), -7), "yyyy-MM-dd"),
          prizes: "",
          imageUrl: "",
          chatId: selectedGroupId
        });
        fetchData(selectedGroupId); // refresh
      } else {
        showToast("Konkurs yaratishda muammo yuz berdi", "error");
      }
    } catch (error) {
      showToast("Konkurs yaratib bo'lmadi", "error");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#5A5A40]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#1a1a1a] font-serif">
      {/* Toast notifications portal */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-2xl shadow-xl border flex items-center justify-between gap-3 animate-in slide-in-from-top-4 duration-300 font-sans ${
              toast.type === "success" ? "bg-emerald-50 border-emerald-100 text-emerald-900" :
              toast.type === "error" ? "bg-rose-50 border-rose-100 text-rose-900" :
              toast.type === "warning" ? "bg-amber-50 border-amber-100 text-amber-900" :
              "bg-indigo-50 border-indigo-100 text-indigo-900"
            }`}
          >
            <span className="text-xs font-semibold">{toast.message}</span>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="text-black/30 hover:text-black cursor-pointer text-xs p-1"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Mobile Top Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-black/5 px-4 flex items-center justify-between shadow-xs z-30 md:hidden">
        <div className="flex items-center gap-2 font-sans">
          <div className="w-8 h-8 bg-[#5A5A40] rounded-lg flex items-center justify-center text-white">
            <Menu size={18} />
          </div>
          <span className="font-bold text-lg tracking-tight">Nazoratchi</span>
        </div>
        
        <button 
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg hover:bg-[#F5F5F0] text-[#5A5A40] cursor-pointer animate-pulse"
        >
          <Menu size={22} />
        </button>
      </header>

      {/* Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        configStatus={configStatus}
      />

      {/* Main Content */}
      <main className="ml-0 md:ml-64 p-4 sm:p-6 md:p-10 pt-20 md:pt-10 max-w-7xl mx-auto">
        {/* Helper & Uzbek Quick Help Banner 
        <div className="mb-6 bg-emerald-50 text-emerald-950 border border-emerald-100 p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-start md:items-center justify-between text-left font-sans shadow-2xs">
          <div className="space-y-0.5">
            <h4 className="font-bold text-sm text-emerald-900">Guruh boshqaruvi va monitoringi faol</h4>
            <p className="text-xs text-emerald-800/80">
              Bot a'zolarni qayd qilish, taklif qilganlar reytingini sanash hamda taqiqlangan reklamalarni o'chirishga shay!
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button 
              onClick={() => setActiveTab("instructions")}
              className="text-xs bg-white text-[#5A5A40] border border-[#5A5A40]/10 font-bold px-3 py-1.5 rounded-xl hover:bg-[#F5F5F0] whitespace-nowrap"
            >
              Yo'riqnomani o'qish
            </button>
            <a
              href="https://t.me/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs bg-[#5A5A40] text-white font-bold px-4 py-1.5 rounded-xl hover:bg-[#4A4A30] whitespace-nowrap inline-flex items-center gap-1 shadow-xs"
            >
              Telegramga o'tish
            </a>
          </div>
        </div>
*/}
        {/* Global Group Select / Stats Filter */}
        <div className="mb-8 bg-white p-4 sm:p-6 rounded-[24px] border border-black/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-left">
          <div>
            <h3 className="text-base font-medium">Faol Telegram Guruhlari</h3>
            <p className="text-xs text-[#5A5A40]/70 italic mt-1">Ma'lumotlar tanlangan guruhga qarab alohida ko'rsatiladi</p>
          </div>
          <div className="w-full sm:w-72">
            <select 
              className="w-full bg-[#F5F5F0] border-none text-sm font-sans rounded-xl px-4 py-3 font-semibold focus:ring-2 focus:ring-[#5A5A40]/20 cursor-pointer text-[#5A5A40]"
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
            >
              <option value="">Barcha guruhlar (Birlashtirilgan)</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title || g.id}
                </option>
              ))}
            </select>
          </div>
        </div>

        {groups.length === 0 && (
          <div className="mb-8 bg-amber-50 text-amber-900 border border-amber-100 p-6 rounded-[24px] text-left font-sans leading-relaxed">
            <h4 className="font-bold mb-1.5">Hali birorta guruh ro'yxatga olinmagan!</h4>
            <p className="text-sm text-amber-800/80 mb-3">
              Telegram boti hali guruhlarda faollikni ko'rmadi. Botni guruhga qo'shib, guruhda istalgan xabar yozing so'ngra sahifani yangilang. Shu orqali guruhlar ro'yxati avtomatik shakllanadi!
            </p>
            <button 
              onClick={() => setActiveTab("instructions")}
              className="text-xs bg-[#5A5A40] text-white font-bold px-4 py-2 rounded-xl hover:bg-[#404030] cursor-pointer"
            >
              O'rnatish qo'llanmasi
            </button>
          </div>
        )}

        {/* Dynamic Nav Tabs render */}
        {activeTab === "dashboard" && (
          <DashboardTab 
            stats={stats} 
            links={links} 
            fetchUserDetails={fetchUserDetails} 
          />
        )}
        
        {activeTab === "leaderboard" && (
          <LeaderboardTab 
            leaderboard={leaderboard} 
            fetchUserDetails={fetchUserDetails} 
          />
        )}
        
        {activeTab === "contests" && (
          <ContestsTab 
            contestForm={contestForm} 
            setContestForm={setContestForm}
            handleCreateContest={handleCreateContest}
            groups={groups}
            contests={contests}
          />
        )}

        {activeTab === "instructions" && (
          <InstructionsTab />
        )}
        
        {activeTab === "settings" && (
          <SettingsTab showToast={showToast} />
        )}
      </main>

      {/* User Drill-down Modal */}
      {selectedUserId && (
        <UserDetailModal 
          selectedUserId={selectedUserId}
          userDetailData={userDetailData}
          loadingUserDetails={loadingUserDetails}
          onClose={() => {
            setSelectedUserId(null);
            setUserDetailData(null);
          }}
        />
      )}
    </div>
  );
}
