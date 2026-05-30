import React from "react";
import { LogOut, ShieldCheck } from "lucide-react";

interface SettingsTabProps {
  verifiedChatIds: string[];
  setVerifiedChatIds: (list: string[]) => void;
  groups: any[];
  showToast: (message: string, type?: "success" | "error" | "warning" | "info") => void;
}

export default function SettingsTab({ verifiedChatIds, setVerifiedChatIds, groups, showToast }: SettingsTabProps) {
  const handleSave = () => {
    showToast("Sozlamalar muvaffaqiyatli saqlandi! (Eski sozlamalar yangilandi)", "success");
  };

  const handleLogoutGroup = (chatId: string) => {
    const updated = verifiedChatIds.filter(id => id !== chatId);
    if (updated.length === 0) {
      localStorage.removeItem("verified_chat_ids");
    } else {
      localStorage.setItem("verified_chat_ids", updated.join(","));
    }
    setVerifiedChatIds(updated);
    showToast("Guruh muvaffaqiyatli o'chirildi!", "info");
  };

  const handleLogoutAll = () => {
    localStorage.removeItem("verified_chat_ids");
    setVerifiedChatIds([]);
    showToast("Barcha guruhlar tizimidan chiqildi!", "warning");
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 text-left">
      <header>
        <h2 className="text-3xl sm:text-4xl font-light tracking-tight mb-2">Sozlamalar</h2>
        <p className="text-[#5A5A40]/60 italic text-sm sm:text-base">Bot xabarlari, ulanishlar va kirish seanslari boshqaruvi</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Main Settings Card */}
        <div className="bg-white p-6 sm:p-8 rounded-[32px] border border-black/5 shadow-sm text-left">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            ⚙️ Bot xabar sozlamalari
          </h3>
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-[#5A5A40] mb-2">Xush kelibsiz xabari</label>
              <textarea 
                rows={3}
                className="w-full bg-[#F5F5F0] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#5A5A40]/20"
                defaultValue="Assalomu alaykum, guruhimizga xush kelibsiz!"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-[#5A5A40] mb-2">Ogohlantirish xabari (Linklar uchun)</label>
              <textarea 
                rows={3}
                className="w-full bg-[#F5F5F0] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#5A5A40]/20"
                defaultValue="Guruhda linklar ulashish taqiqlangan!"
              />
            </div>
            <div className="pt-4">
              <button 
                onClick={handleSave}
                className="bg-black text-white px-8 py-3 rounded-xl font-bold hover:bg-black/80 transition-colors cursor-pointer"
              >
                Saqlash
              </button>
            </div>
          </div>
        </div>

        {/* Security & Access Management */}
        <div className="bg-white p-6 sm:p-8 rounded-[32px] border border-black/5 shadow-sm text-left font-sans space-y-6">
          <div>
            <h3 className="text-lg font-serif font-bold text-gray-900 flex items-center gap-2">
              <ShieldCheck className="text-[#5A5A40]" /> Xavfsizlik va Seanslar
            </h3>
            <p className="text-xs text-[#5A5A40]/70 mt-1">Siz ulashtirgan faol guruhlar va kirish ruxsatnomalari ro'yxati</p>
          </div>

          <div className="space-y-3">
            {verifiedChatIds.length === 0 ? (
              <p className="text-xs text-gray-500 italic py-4">Barcha seanslar yuklanmagan yoki o'chirilgan.</p>
            ) : (
              verifiedChatIds.map(chatId => {
                const matchedGroup = groups.find(g => g.id === chatId);
                const title = matchedGroup?.title || `Guruh (ID: ${chatId})`;
                return (
                  <div key={chatId} className="flex items-center justify-between p-3 bg-[#F5F5F0] rounded-xl border border-black/5 text-xs">
                    <div>
                      <p className="font-bold text-gray-900">{title}</p>
                      <p className="text-[10px] text-gray-500 font-mono mt-0.5">{chatId}</p>
                    </div>
                    <button
                      onClick={() => handleLogoutGroup(chatId)}
                      className="text-red-600 hover:bg-red-50 p-2 rounded-lg cursor-pointer font-bold text-[11px]"
                      title="Ushbu guruhdan chiqish"
                    >
                      O'chirish
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {verifiedChatIds.length > 0 && (
            <div className="border-t border-black/5 pt-4">
              <button
                onClick={handleLogoutAll}
                className="w-full bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold py-3 px-4 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <LogOut size={14} />
                Barcha seanslarni tozalash (Chiqish)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
