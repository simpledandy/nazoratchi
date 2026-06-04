import React, { useState, useEffect } from "react";
import { format, subDays } from "date-fns";
import { Menu, Key, ShieldCheck, Plus, AlertCircle, LogOut } from "lucide-react";
import { Stats, LeaderboardItem, TabType } from "./types";
import Sidebar from "./components/Sidebar";
import DashboardTab from "./components/DashboardTab";
import LeaderboardTab from "./components/LeaderboardTab";
import ContestsTab from "./components/ContestsTab";
import SettingsTab from "./components/SettingsTab";
import InstructionsTab from "./components/InstructionsTab";
import UserDetailModal from "./components/UserDetailModal";
import SalesTab from "./components/SalesTab";

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

  // Authentication states
  const [verifiedChatIds, setVerifiedChatIds] = useState<string[]>(() => {
    const saved = localStorage.getItem("verified_chat_ids");
    return saved ? saved.split(",").filter(Boolean) : [];
  });
  const [authCodeInput, setAuthCodeInput] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);

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

  // Helper to retrieve custom header credentials matching backend constraints
  const getAuthHeaders = () => {
    return {
      "Content-Type": "application/json",
      "X-Verified-Chats": localStorage.getItem("verified_chat_ids") || ""
    };
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
    if (verifiedChatIds.length > 0) {
      fetchData(selectedGroupId);
    } else {
      setLoading(false);
    }
  }, [selectedGroupId, verifiedChatIds]);

  useEffect(() => {
    fetchConfigStatus();
    if (verifiedChatIds.length === 0) {
      setLoading(false);
    }
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
    if (verifiedChatIds.length === 0) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const queryParam = groupId ? `?chatId=${groupId}` : "";
      const headers = getAuthHeaders();

      const [statsRes, leaderboardRes, groupsRes, contestsRes, linksRes] = await Promise.all([
        fetch(`/api/stats${queryParam}`, { headers }),
        fetch(`/api/leaderboard${queryParam}`, { headers }),
        fetch("/api/groups", { headers }),
        fetch(`/api/contests${queryParam}`, { headers }),
        fetch(`/api/links${queryParam}`, { headers })
      ]);
      
      if (statsRes.ok) setStats(await statsRes.json());
      if (leaderboardRes.ok) setLeaderboard(await leaderboardRes.json());
      if (groupsRes.ok) {
        const groupsData = await groupsRes.json();
        setGroups(groupsData);
        // If there is no selected group, focus on the first ulashtirilgan one
        if (!selectedGroupId && groupsData.length > 0) {
          setSelectedGroupId(groupsData[0].id);
        }
      }
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
      const res = await fetch(`/api/users/${id}/details${queryParam}`, {
        headers: getAuthHeaders()
      });
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

  const handleVerifyCode = async (codeStr: string) => {
    if (!codeStr.trim() || codeStr.trim().length !== 6) {
      showToast("Iltimos, 6 xonali tasdiqlash kodini kiriting!", "warning");
      return;
    }
    
    try {
      setVerifying(true);
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeStr.trim() })
      });
      
      const data = await res.json();
      if (res.ok && data.valid) {
        const existing = localStorage.getItem("verified_chat_ids") || "";
        const list = existing ? existing.split(",").filter(Boolean) : [];
        
        if (!list.includes(data.chatId)) {
          list.push(data.chatId);
          localStorage.setItem("verified_chat_ids", list.join(","));
        }
        
        setVerifiedChatIds(list);
        setSelectedGroupId(data.chatId); // Focus ulashtirilgan guruhga
        showToast(`Guruh muvaffaqiyatli ulandi! 🎉\n${data.chatTitle}`, "success");
        setAuthCodeInput("");
        setIsAddGroupOpen(false);
      } else {
        showToast(data.error || "Kod noto'g'ri kiritildi yoki uning faollik muddati tugagan!", "error");
      }
    } catch (err) {
      console.error("Auth error:", err);
      showToast("Server bilan bog'lanishda xatolik yuz berdi!", "error");
    } finally {
      setVerifying(false);
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
        headers: getAuthHeaders(),
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
        fetchData(selectedGroupId);
      } else {
        const errData = await res.json();
        showToast(errData.error || "Konkurs yaratishda muammo yuz berdi", "error");
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

  // Purely visual first-time login gating if no groups are verified yet
  if (verifiedChatIds.length === 0) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center p-4 sm:p-6 text-left font-serif text-[#1a1a1a]">
        {/* Toast alerts inside login portal */}
        <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`p-4 rounded-2xl shadow-xl border flex items-center justify-between gap-3 animate-in slide-in-from-top-4 duration-300 font-sans ${
                toast.type === "success" ? "bg-emerald-50 border-emerald-100 text-emerald-900" :
                toast.type === "error" ? "bg-rose-50 border-rose-100 text-rose-900" :
                toast.type === "warning" ? "bg-amber-50 border-amber-100 text-amber-900" :
                "bg-[#F5F5F0] border-black/5 text-[#5A5A40]"
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

        <div className="w-full max-w-md bg-white p-6 sm:p-8 rounded-[32px] border border-black/5 shadow-2xl relative">
          <div className="flex flex-col items-center text-center gap-4 mb-6">
            <div className="w-14 h-14 bg-[#5A5A40] text-white rounded-2xl flex items-center justify-center shadow-lg shadow-[#5A5A40]/15">
              <Key size={28} />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-light tracking-tight text-gray-900 font-sans font-bold">Admin Tasdiqlash</h2>
              <p className="text-xs text-[#5A5A40]/75 mt-1 font-sans italic">
                Nazoratchi guruhni boshqarish paneliga kirish
              </p>
            </div>
          </div>

          <div className="space-y-4 font-sans border-b border-black/5 pb-6 mb-6 text-sm text-[#4a4a4a] leading-relaxed">
            <p className="font-bold text-center text-amber-900 bg-amber-50 rounded-xl py-2 px-3 border border-amber-100 text-xs flex items-center gap-1.5 justify-center">
              <AlertCircle size={14} className="shrink-0" /> Kirish faqat guruh adminlari uchun cheklangan!
            </p>
            <p className="text-xs">
              Ushbu panelga kirish va guruh ma'lumotlarini ko'rish uchun avval administratorlik huquqingizni tasdiqlashingiz kerak. Quyidagi oson amallarni bajaring:
            </p>
            <ol className="list-decimal pl-5 space-y-1.5 text-[11px] text-[#5a5a4a] leading-relaxed">
              <li>Siz admin bo'lgan Telegram guruhida <strong><code className="text-emerald-800">/auth</code></strong> buyrug'ini yuboring.</li>
              <li>Bot sizga xavfsiz kanallar orqali shaxsiy xabar (DM) ko'rinishida <strong>6 xonali maxsus kod</strong> yuboradi.</li>
              <li>O'sha kodni nusxalab, quyidagi maydonga kiriting.</li>
            </ol>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleVerifyCode(authCodeInput); }} className="space-y-4 font-sans">
            <div>
              <label className="block text-xs font-bold text-[#5A5A40]/80 uppercase tracking-widest mb-1.5 pl-1">
                Tasdiqlash Kodi
              </label>
              <input
                type="text"
                maxLength={6}
                placeholder="000 000"
                value={authCodeInput}
                onChange={(e) => setAuthCodeInput(e.target.value.replace(/\D/g, ""))}
                className="w-full bg-[#F5F5F0] border-none text-center font-mono text-xl tracking-[0.4em] rounded-2xl py-4 font-bold focus:ring-2 focus:ring-[#5A5A40]/20 text-[#5A5A40]"
              />
            </div>

            <button
              type="submit"
              disabled={verifying || authCodeInput.length !== 6}
              className="w-full bg-[#5A5A40] text-white font-bold py-4 rounded-2xl hover:bg-[#4a4a30] transition-colors shadow-lg shadow-[#5A5A40]/10 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 text-sm"
            >
              {verifying ? (
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
              ) : (
                "Tasdiqlash va Kirish"
              )}
            </button>
          </form>

          <p className="text-[10px] text-center text-[#5A5A40]/50 italic mt-4 font-sans leading-relaxed">
            * Brauzeringizga bir marta kirgandan keyin u guruh siz uchun saqlanib qolinadi va qayta to'polon qilinmaydi.
          </p>
        </div>
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
        configStatus={configStatus}
      />

      {/* Main Content */}
      <main className="ml-0 md:ml-64 p-4 sm:p-6 md:p-10 pt-20 md:pt-10 max-w-7xl mx-auto">
        {/* Global Group Select / Stats Filter */}
        <div className="mb-8 bg-white p-4 sm:p-6 rounded-[24px] border border-black/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-left">
          <div>
            <h3 className="text-base font-medium">Faol Telegram Guruhlari</h3>
            <p className="text-xs text-[#5A5A40]/70 italic mt-1">Ma'lumotlar ulashtirilgan guruhlaringizga qarab alohida ko'rsatiladi</p>
          </div>
          <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="w-full sm:w-64">
              <select 
                className="w-full bg-[#F5F5F0] border-none text-sm font-sans rounded-xl px-4 py-3 font-semibold focus:ring-2 focus:ring-[#5A5A40]/20 cursor-pointer text-[#5A5A40]"
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
              >
                {verifiedChatIds.length > 1 && (
                  <option value="">Barcha guruhlar (Birlashtirilgan)</option>
                )}
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title || g.id}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setIsAddGroupOpen(true)}
              className="bg-[#5A5A40]/10 hover:bg-[#5A5A40]/15 text-[#5A5A40] text-xs font-bold font-sans py-3 px-4 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 justify-center shrink-0"
            >
              Guruh qo'shish ➕
            </button>
          </div>
        </div>

        {groups.length === 0 && (
          <div className="mb-8 bg-amber-50 text-amber-900 border border-amber-100 p-6 rounded-[24px] text-left font-sans leading-relaxed">
            <h4 className="font-bold mb-1.5">Hali birorta guruh ro'yxatga olinmagan!</h4>
            <p className="text-sm text-amber-800/80 mb-3 font-sans">
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

        {activeTab === "sales" && (
          <SalesTab 
            selectedGroupId={selectedGroupId}
            groups={groups}
            showToast={showToast}
          />
        )}

        {activeTab === "instructions" && (
          <InstructionsTab />
        )}
        
        {activeTab === "settings" && (
          <SettingsTab 
            verifiedChatIds={verifiedChatIds}
            setVerifiedChatIds={setVerifiedChatIds}
            groups={groups}
            showToast={showToast} 
          />
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

      {/* Verify & Add Group Modal */}
      {isAddGroupOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white p-6 sm:p-8 rounded-[32px] border border-black/5 shadow-2x shadow-black/10 relative text-left">
            <button
              onClick={() => {
                setIsAddGroupOpen(false);
                setAuthCodeInput("");
              }}
              className="absolute top-4 right-4 text-[#5A5A40]/60 hover:text-[#5A5A40] text-xs p-2 cursor-pointer font-bold font-sans"
            >
              ✕
            </button>
            <div className="flex flex-col items-center text-center gap-4 mb-6">
              <div className="w-12 h-12 bg-[#5A5A40] text-white rounded-2xl flex items-center justify-center shadow-lg shadow-[#5A5A40]/15">
                <Key size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold font-sans text-gray-900">Yangi Guruh Ulash</h3>
                <p className="text-xs text-[#5A5A40]/75 italic mt-1 font-sans">
                  Siz admin bo'lgan yangi guruhni tizimga ulashtirish
                </p>
              </div>
            </div>

            <div className="space-y-4 font-sans border-b border-black/5 pb-5 mb-5 text-xs text-[#5a5a4a] leading-relaxed">
              <p>
                Boshqaruv paneliga yangi Telegram guruhini ulash uchun:
              </p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Siz admin bo'lgan yangi guruhda <strong><code>/auth</code></strong> yuboring.</li>
                <li>Bot sizga shaxsiy xabar orqali yuborgan <strong>6 xonali yangi kodni</strong> bu yerga kiriting.</li>
              </ol>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleVerifyCode(authCodeInput); }} className="space-y-4 font-sans">
              <div>
                <label className="block text-[10px] font-bold text-[#5A5A40]/80 uppercase tracking-widest mb-1 pl-1">
                  Tasdiqlash Kodi
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="000 000"
                  value={authCodeInput}
                  onChange={(e) => setAuthCodeInput(e.target.value.replace(/\D/g, ""))}
                  className="w-full bg-[#F5F5F0] border-none text-center font-mono text-lg tracking-[0.4em] rounded-xl py-3.5 font-bold focus:ring-2 focus:ring-[#5A5A40]/20 text-[#5A5A40]"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddGroupOpen(false);
                    setAuthCodeInput("");
                  }}
                  className="w-1/2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={verifying || authCodeInput.length !== 6}
                  className="w-1/2 bg-[#5A5A40] text-white font-bold py-3 rounded-xl text-xs transition-colors shadow-md hover:bg-[#4a4a30] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1"
                >
                  {verifying ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                  ) : (
                    "Tasdiqlash"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
