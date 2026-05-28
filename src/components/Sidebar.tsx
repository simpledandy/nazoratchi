import React from "react";
import { BarChart3, Trophy, Calendar, Settings as SettingsIcon, AlertCircle, X } from "lucide-react";
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
}

export default function Sidebar({ activeTab, setActiveTab, isOpen, onClose }: SidebarProps) {
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
            label="Dashboard"
          />
          <NavItem 
            active={activeTab === "leaderboard"} 
            onClick={() => handleTabClick("leaderboard")}
            icon={<Trophy size={20} />}
            label="Leaderboard"
          />
          <NavItem 
            active={activeTab === "contests"} 
            onClick={() => handleTabClick("contests")}
            icon={<Calendar size={20} />}
            label="Konkurslar"
          />
          <NavItem 
            active={activeTab === "settings"} 
            onClick={() => handleTabClick("settings")}
            icon={<SettingsIcon size={20} />}
            label="Sozlamalar"
          />
        </nav>

        <div className="mt-auto p-4 bg-[#F5F5F0] rounded-2xl border border-black/5 text-left">
          <div className="flex items-center gap-2 text-xs text-[#5A5A40] font-medium uppercase tracking-wider mb-1">
            <AlertCircle size={14} />
            Status
          </div>
          <p className="text-sm font-medium">Bot faol holatda</p>
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
