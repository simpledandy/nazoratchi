import React, { useState, useEffect } from "react";
import { format, subDays } from "date-fns";
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
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");

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
    imageUrl: ""
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, leaderboardRes] = await Promise.all([
        fetch("/api/stats"),
        fetch("/api/leaderboard")
      ]);
      
      if (statsRes.ok) setStats(await statsRes.json());
      if (leaderboardRes.ok) setLeaderboard(await leaderboardRes.json());
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
      const res = await fetch(`/api/users/${id}/details`);
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
          imageUrl: ""
        });
        fetchData(); // refresh
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
      {/* Sidebar */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content */}
      <main className="ml-64 p-10 max-w-7xl mx-auto">
        {activeTab === "dashboard" && <DashboardTab stats={stats} />}
        
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
