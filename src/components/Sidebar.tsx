import React from "react";
import { BarChart3, Trophy, Calendar, Settings as SettingsIcon, AlertCircle, X, BookOpen } from "lucide-react";
import { TabType } from "../types";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  isOpen: boolean;
  onClose: () => void;
  configStatus?: {
    supabaseConfigured: boolean;
    telegramTokenConfigured: boolean;
    botInitialized: boolean;
    statusText: string;
    statusCode: string;
  };
}

export default function Sidebar({ activeTab, setActiveTab, isOpen, onClose, configStatus }: SidebarProps) {
  const handleTabClick = (tab: TabType) => {
    setActiveTab(tab);
    onClose(); // Auto-close on mobile
  };

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 md:hidden" 
          onClick={onClose}
        />
      )}

      {/* Sidebar container */}
      <div className={cn(
        "fixed left-0 top-0 h-full w-64 bg-white border-r border-black/5 p-6 flex flex-col gap-8 shadow-sm transition-transform duration-300 z-50 md:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Header inside sidebar */}
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#5A5A40] rounded-xl flex items-center justify-center text-white">
              <BarChart3 size={24} />
            </div>
            <h1 className="font-bold text-xl tracking-tight text-left">Nazoratchi</h1>
          </div>
          
          {/* Close button for mobile */}
          <button 
            onClick={onClose}
            className="p-2 -mr-2 rounded-lg hover:bg-[#F5F5F0] text-[#5A5A40] md:hidden cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex flex-col gap-2">
          <NavItem 
            active={activeTab === "dashboard"} 
            onClick={() => handleTabClick("dashboard")}
            icon={<BarChart3 size={20} />}
            label="Tahlil va Monitoring"
          />
          <NavItem 
            active={activeTab === "leaderboard"} 
            onClick={() => handleTabClick("leaderboard")}
            icon={<Trophy size={20} />}
            label="A'zolar Reytingi"
          />
          <NavItem 
            active={activeTab === "contests"} 
            onClick={() => handleTabClick("contests")}
            icon={<Calendar size={20} />}
            label="Guruh Tanlovlari"
          />
          <NavItem 
            active={activeTab === "instructions"} 
            onClick={() => handleTabClick("instructions")}
            icon={<BookOpen size={20} />}
            label="Yo'riqnoma"
          />
          <NavItem 
            active={activeTab === "settings"} 
            onClick={() => handleTabClick("settings")}
            icon={<SettingsIcon size={20} />}
            label="Sozlamalar"
          />
        </nav>

        <div className={cn(
          "mt-auto p-4 rounded-2xl border text-left transition-all",
          configStatus?.statusCode === "ACTIVE" 
            ? "bg-emerald-50/70 border-emerald-500/15 text-emerald-950" 
            : configStatus?.statusCode === "TELEGRAM_MISSING" || configStatus?.statusCode === "DEMO_ALL_MISSING"
            ? "bg-amber-50/70 border-amber-500/15 text-amber-950"
            : configStatus?.statusCode === "LOADING"
            ? "bg-slate-50 border-black/5 text-slate-800 animate-pulse"
            : "bg-rose-50/70 border-rose-500/15 text-rose-950"
        )}>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-1">
            <span className={cn(
              "w-2 h-2 rounded-full",
              configStatus?.statusCode === "ACTIVE" ? "bg-emerald-500 animate-pulse" :
              configStatus?.statusCode === "TELEGRAM_MISSING" || configStatus?.statusCode === "DEMO_ALL_MISSING" ? "bg-amber-500" :
              configStatus?.statusCode === "LOADING" ? "bg-slate-400" : "bg-rose-500"
            )} />
            Tizim Statusi
          </div>
          <p className="text-xs font-semibold leading-relaxed">
            {configStatus?.statusText || "Bot faol holatda"}
          </p>
          {configStatus?.statusCode !== "ACTIVE" && configStatus?.statusCode !== "LOADING" && (
            <p 
              className="text-[10px] mt-1.5 font-bold underline cursor-pointer hover:opacity-80 inline-block transition-opacity text-[#5A5A40]" 
              onClick={() => handleTabClick("instructions")}
            >
              Muammolarni aniqlash ↗
            </p>
          )}
        </div>
      </div>
    </>
  );
}

interface NavItemProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function NavItem({ active, onClick, icon, label }: NavItemProps) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer w-full text-left",
        active 
          ? "bg-[#5A5A40] text-white shadow-lg shadow-[#5A5A40]/20" 
          : "text-[#5A5A40] hover:bg-[#F5F5F0]"
      )}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );
}
