import React from "react";
import { Plus, Trophy, Calendar } from "lucide-react";

interface ContestFormState {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  prizes: string;
  imageUrl: string;
  chatId: string;
}

interface ContestsTabProps {
  contestForm: ContestFormState;
  setContestForm: React.Dispatch<React.SetStateAction<ContestFormState>>;
  handleCreateContest: (e: React.FormEvent) => Promise<void>;
  groups: any[];
  contests: any[];
}

export default function ContestsTab({ 
  contestForm, 
  setContestForm, 
  handleCreateContest, 
  groups = [], 
  contests = [] 
}: ContestsTabProps) {
  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 text-left">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl sm:text-4xl font-light tracking-tight mb-2">Konkurslar</h2>
          <p className="text-[#5A5A40]/60 italic text-sm sm:text-base">Guruhlar uchun alohida yoki umumiy konkurslar yaratish va boshqarish</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-4 sm:p-8 rounded-[32px] border border-black/5 shadow-sm text-left">
          <h3 className="text-xl font-medium mb-6 flex items-center gap-2">
            <Plus size={20} className="text-[#5A5A40]" />
            Yangi konkurs
          </h3>
          <form onSubmit={handleCreateContest} noValidate className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-[#5A5A40] mb-2">Guruhni tanlang</label>
              <select
                className="w-full bg-[#F5F5F0] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#5A5A40]/20 text-[#5A5A40] cursor-pointer"
                value={contestForm.chatId}
                onChange={e => setContestForm({...contestForm, chatId: e.target.value})}
              >
                <option value="">-- Tanlang --</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title || g.id}
                  </option>
                ))}
              </select>
              {groups.length === 0 && (
                <p className="text-rose-500 text-xs mt-1">Bot birorta ham guruhga qo'shilmaganligi sababli konkurs yaratib bo'lmaydi.</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-[#5A5A40] mb-2">Konkurs nomi</label>
              <input 
                type="text" 
                className="w-full bg-[#F5F5F0] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#5A5A40]/20"
                value={contestForm.title}
                onChange={e => setContestForm({...contestForm, title: e.target.value})}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-[#5A5A40] mb-2">Boshlanish sanasi</label>
                <input 
                  type="date" 
                  className="w-full bg-[#F5F5F0] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#5A5A40]/20"
                  value={contestForm.startDate}
                  onChange={e => setContestForm({...contestForm, startDate: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-[#5A5A40] mb-2">Tugash sanasi</label>
                <input 
                  type="date" 
                  className="w-full bg-[#F5F5F0] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#5A5A40]/20"
                  value={contestForm.endDate}
                  onChange={e => setContestForm({...contestForm, endDate: e.target.value})}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-[#5A5A40] mb-2">Sovrinlar (barchasi bitta matnda)</label>
              <textarea 
                rows={3}
                className="w-full bg-[#F5F5F0] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#5A5A40]/20"
                value={contestForm.prizes}
                onChange={e => setContestForm({...contestForm, prizes: e.target.value})}
                placeholder="Masalan:&#10;1-o'rin: iPhone 15&#10;2-o'rin: Airpods Pro"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-[#5A5A40] mb-2">Rasm URL (ixtiyoriy)</label>
              <input 
                type="url" 
                className="w-full bg-[#F5F5F0] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#5A5A40]/20"
                value={contestForm.imageUrl}
                onChange={e => setContestForm({...contestForm, imageUrl: e.target.value})}
              />
            </div>
            <button 
              type="submit"
              disabled={groups.length === 0}
              className="w-full bg-[#5A5A40] disabled:opacity-50 text-white font-bold py-4 rounded-xl hover:bg-[#4A4A30] transition-colors shadow-lg shadow-[#5A5A40]/20 cursor-pointer"
            >
              Konkursni boshlash
            </button>
          </form>
        </div>

        <div className="space-y-6 text-left">
          <h3 className="text-xl font-medium px-4">Faol konkurslar</h3>
          
          {contests.length === 0 ? (
            <div className="bg-white p-8 rounded-[32px] border border-black/5 shadow-sm text-center text-[#5A5A40]/60 italic font-sans text-sm">
              Hozirda tanlangan guruh yoki barcha guruhlar uchun faol konkurs yuklanmagan. Yangi konkursni chap tomondagi forma orqali boshlang!
            </div>
          ) : (
            contests.map((contest, index) => {
              const matchedGroup = groups.find(g => g.id === contest.chatId);
              return (
                <div key={contest.id || index} className="bg-[#5A5A40] text-white p-6 sm:p-8 rounded-[32px] relative overflow-hidden shadow-md">
                  <div className="relative z-10">
                    <div className="flex justify-between items-start gap-2 mb-4">
                      <span className="bg-white/20 text-white text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full">
                        {contest.isActive ? "Hozirda faol" : "Nofaol"}
                      </span>
                      {matchedGroup && (
                        <span className="text-xs bg-black/20 text-white/90 font-sans px-3 py-1 rounded-full font-semibold">
                          Guruh: {matchedGroup.title}
                        </span>
                      )}
                    </div>
                    
                    <h4 className="text-2xl font-bold mb-2">{contest.title}</h4>
                    <p className="text-white/80 text-sm mb-4 font-sans">{contest.description || "Do'stlarni taklif qilish va sovg'alarni yutish vaqti!"}</p>
                    
                    <div className="space-y-3 mt-4 border-t border-white/10 pt-4 font-sans text-sm">
                      <div className="flex items-center gap-2 text-white/90">
                        <Calendar size={16} className="text-amber-300" />
                        <span>Muddati: {contest.startDate} dan {contest.endDate} gacha</span>
                      </div>
                      <div className="flex items-start gap-3 mt-2 bg-white/10 p-3 rounded-2xl">
                        <Trophy size={20} className="text-amber-300 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-white/50 uppercase tracking-widest font-bold">Sovrinlar</p>
                          <p className="font-bold whitespace-pre-line">{contest.prizes}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/5 rounded-full blur-3xl"></div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
