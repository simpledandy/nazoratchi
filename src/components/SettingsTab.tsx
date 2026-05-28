import React from "react";

export default function SettingsTab() {
  const handleSave = () => {
    alert("Sozlamalar muvaffaqiyatli saqlandi! (Prototype ko'rinishida)");
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 text-left">
      <header>
        <h2 className="text-3xl sm:text-4xl font-light tracking-tight mb-2">Sozlamalar</h2>
        <p className="text-[#5A5A40]/60 italic text-sm sm:text-base">Bot xabarlari va adminlarni boshqarish</p>
      </header>

      <div className="bg-white p-4 sm:p-8 rounded-[32px] border border-black/5 shadow-sm max-w-2xl text-left">
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
    </div>
  );
}
