import React, { useState, useEffect } from "react";
import { format, subDays } from "date-fns";
import { Menu } from "lucide-react";
import { Stats, LeaderboardItem, TabType } from "./types";
import Sidebar from "./components/Sidebar";
import DashboardTab from "./components/DashboardTab";
import LeaderboardTab from "./components/LeaderboardTab";
import ContestsTab from "./components/ContestsTab";
import SettingsTab from "./components/SettingsTab";
import UserDetailModal from "./components/UserDetailModal";

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
        alert("Foydalanuvchi ma'lumotlarini yuklab bo'lmadi");
      }
    } catch (err) {
      console.error(err);
      alert("Xatolik yuz berdi");
    } finally {
      setLoadingUserDetails(false);
    }
  };

  const handleCreateContest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contestForm.chatId) {
      alert("Iltimos, guruhni tanlang!");
      return;
    }
    try {
      const res = await fetch("/api/contests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contestForm)
      });
      if (res.ok) {
        alert("Konkurs muvaffaqiyatli yaratildi!");
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
      }
    } catch (error) {
      alert("Xatolik yuz berdi");
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
      {/* Mobile Top Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-black/5 px-4 flex items-center justify-between shadow-xs z-30 md:hidden">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#5A5A40] rounded-lg flex items-center justify-center text-white">
            <Menu size={18} />
          </div>
          <span className="font-bold text-lg tracking-tight">Nazoratchi</span>
        </div>
        
        <button 
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg hover:bg-[#F5F5F0] text-[#5A5A40] cursor-pointer"
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
      />

      {/* Main Content */}
      <main className="ml-0 md:ml-64 p-4 sm:p-6 md:p-10 pt-20 md:pt-10 max-w-7xl mx-auto">
        {/* Helper & Debug Instructions Header */}
        <div className="mb-6 bg-emerald-50 text-emerald-900 border border-emerald-100 p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-start md:items-center justify-between text-left">
          <div className="space-y-1">
            <h4 className="font-bold text-sm">Bot ishlashini tekshirish (Qo'llanma)</h4>
            <p className="text-xs text-emerald-800/80">
              Botni guruhingizga qo'shing va uzoq vaqt ishlayotganini ko'rish uchun guruhda xabar yoki havolalar yozib tekshiring. Bot avtomatik ravishda yangi a'zolarni qayd etadi va dushman havolalarni tozalaydi!
            </p>
          </div>
          <a
            href="https://t.me/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs bg-emerald-600 text-white font-bold px-4 py-2 rounded-xl hover:bg-emerald-700 whitespace-nowrap"
          >
            Telegramga o'tish
          </a>
        </div>

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
          <div className="mb-8 bg-amber-50 text-amber-900 border border-amber-100 p-6 rounded-[24px] text-left">
            <h4 className="font-bold mb-2">Hali birorta guruh ro'yxatga olinmagan!</h4>
            <p className="text-sm text-amber-800/80 mb-4">
              Telegram boti hali guruhlarda faollikni ko'rmadi. Botni guruhga qo'shing va har qanday xabar yozing so'ngra sahifani yangilang. Shu orqali guruhlar ro'yxati avtomatik shakllanadi!
            </p>
          </div>
        )}

        {activeTab === "dashboard" && <DashboardTab stats={stats} links={links} />}
        
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
        
        {activeTab === "settings" && <SettingsTab />}
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
