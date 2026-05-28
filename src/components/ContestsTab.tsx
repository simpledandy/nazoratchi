import React from "react";
import { Plus, Trophy } from "lucide-react";

interface ContestFormState {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  prizes: string;
  imageUrl: string;
}

interface ContestsTabProps {
  contestForm: ContestFormState;
  setContestForm: React.Dispatch<React.SetStateAction<ContestFormState>>;
  handleCreateContest: (e: React.FormEvent) => Promise<void>;
}

export default function ContestsTab({ contestForm, setContestForm, handleCreateContest }: ContestsTabProps) {
  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 text-left">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl sm:text-4xl font-light tracking-tight mb-2">Konkurslar</h2>
          <p className="text-[#5A5A40]/60 italic text-sm sm:text-base">Yangi konkurslar yaratish va boshqarish</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-4 sm:p-8 rounded-[32px] border border-black/5 shadow-sm text-left">
          <h3 className="text-xl font-medium mb-6 flex items-center gap-2">
            <Plus size={20} className="text-[#5A5A40]" />
            Yangi konkurs
          </h3>
          <form onSubmit={handleCreateContest} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-[#5A5A40] mb-2">Konkurs nomi</label>
              <input 
                type="text" 
                className="w-full bg-[#F5F5F0] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#5A5A40]/20"
                value={contestForm.title}
                onChange={e => setContestForm({...contestForm, title: e.target.value})}
                required
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
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-[#5A5A40] mb-2">Tugash sanasi</label>
                <input 
                  type="date" 
                  className="w-full bg-[#F5F5F0] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#5A5A40]/20"
                  value={contestForm.endDate}
                  onChange={e => setContestForm({...contestForm, endDate: e.target.value})}
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-[#5A5A40] mb-2">Sovrinlar (har bir qatorda bittadan)</label>
              <textarea 
                rows={4}
                className="w-full bg-[#F5F5F0] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#5A5A40]/20"
                value={contestForm.prizes}
                onChange={e => setContestForm({...contestForm, prizes: e.target.value})}
                required
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
              className="w-full bg-[#5A5A40] text-white font-bold py-4 rounded-xl hover:bg-[#4A4A30] transition-colors shadow-lg shadow-[#5A5A40]/20 cursor-pointer"
            >
              Konkursni boshlash
            </button>
          </form>
        </div>

        <div className="space-y-6 text-left">
          <h3 className="text-xl font-medium px-4">Faol konkurslar</h3>
          <div className="bg-[#5A5A40] text-white p-6 sm:p-8 rounded-[32px] relative overflow-hidden">
            <div className="relative z-10">
              <span className="bg-white/20 text-white text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full mb-4 inline-block">
                Hozirda faol
              </span>
              <h4 className="text-2xl font-bold mb-2">Bahorgi Takliflar</h4>
              <p className="text-white/70 text-sm mb-6">Eng ko'p odam qo'shgan 3 ta foydalanuvchi qimmatbaho sovg'alar bilan taqdirlanadi.</p>
              <div className="flex items-center gap-4">
                <div className="bg-white/10 p-3 rounded-2xl">
                  <Trophy size={24} />
                </div>
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-widest">Asosiy sovrin</p>
                  <p className="font-bold">iPhone 15 Pro Max</p>
                </div>
              </div>
            </div>
            <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/5 rounded-full blur-3xl"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
