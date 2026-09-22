import React, { useState } from "react";
import { 
  Bot, 
  ShieldCheck, 
  RefreshCw, 
  Trophy, 
  AlertTriangle, 
  ChevronRight, 
  Copy, 
  Check,
  ExternalLink,
  Info,
  Key
} from "lucide-react";

interface InstructionSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  subtitle: string;
}

export default function InstructionsTab() {
  const [activeSection, setActiveSection] = useState<string>("get-started");
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const sections: InstructionSection[] = [
    {
      id: "get-started",
      title: "1. Botni ishga tushirish",
      icon: <Bot size={18} />,
      subtitle: "Botni guruhga qo'shish va guruhlarni aniqlash"
    },
    {
      id: "admin-auth",
      title: "2. Admin tasdiqlash",
      icon: <Key size={18} />,
      subtitle: "Tizimga kirish va guruhni boshqarish ruxsati"
    },
    {
      id: "admin-rights",
      title: "3. Adminlik huquqlari",
      icon: <ShieldCheck size={18} />,
      subtitle: "Nima uchun admin qilish kerak va u qanday ishlaydi"
    },
    {
      id: "sync",
      title: "4. Guruhni sinxronlash",
      icon: <RefreshCw size={18} />,
      subtitle: "/sync buyrug'ining ahamiyati va ma'lumotlar"
    },
    {
      id: "contests",
      title: "5. Konkurslar va Tanlovlar",
      icon: <Trophy size={18} />,
      subtitle: "Guruhda konkurs yaratish darsligi"
    },
    {
      id: "trouble",
      title: "6. Nosozliklarni tuzatish",
      icon: <AlertTriangle size={18} />,
      subtitle: "Muammolarni tahlil qilish va hal etish"
    }
  ];

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-left">
      <header className="border-b border-black/5 pb-4">
        <h2 className="text-3xl sm:text-4xl font-light tracking-tight mb-2">Foydalanish Yo'riqnomasi</h2>
        <p className="text-[#5A5A40]/60 italic text-sm sm:text-base">
          Tizimdan to'g'ri foydalanish, guruhlarni boshqarish va muammolarni bartaraf etish bo'yicha oddiy qo'llanma
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Navigation Sidebar inside Tab */}
        <div className="lg:col-span-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-[#5A5A40]/55 px-3 mb-2">Qo'llanma bo'limlari</p>
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex items-center justify-between ${
                activeSection === section.id
                  ? "bg-[#5A5A40] text-white border-[#5A5A40] shadow-md"
                  : "bg-white text-[#1a1a1a] border-black/5 hover:bg-[#F5F5F0]"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${
                  activeSection === section.id ? "bg-white/10 text-white" : "bg-[#F5F5F0] text-[#5A5A40]"
                }`}>
                  {section.icon}
                </div>
                <div>
                  <h4 className="font-bold text-sm">{section.title}</h4>
                  <p className={`text-xs mt-0.5 ${
                    activeSection === section.id ? "text-white/70" : "text-[#5A5A40]/60"
                  }`}>
                    {section.subtitle}
                  </p>
                </div>
              </div>
              <ChevronRight size={16} className={`opacity-60 ${activeSection === section.id ? "translate-x-0.5" : ""}`} />
            </button>
          ))}

          {/* Quick Telegram link inside navigation
          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-xs space-y-2 text-emerald-950 mt-4">
            <div className="flex items-center gap-2 font-bold text-emerald-800">
              <Info size={14} />
              <span>Yordam va qo'llab-quvvatlash</span>
            </div>
            <p className="text-emerald-800/80 leading-relaxed">
              Bot va tizim haqida qo'shimcha savollar bo'lsa, Telegram orqali biz bilan bevosita bog'lanishingiz mumkin.
            </p>
            <a
              href="https://t.me"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-bold text-[#5A5A40] hover:underline text-emerald-700"
            >
              Bizning Telegram guruhimiz <ExternalLink size={12} />
            </a>
          </div>
          */}
        </div>
        {/* Dynamic Detail Panel */}
        <div className="lg:col-span-8 bg-white p-6 sm:p-8 rounded-[32px] border border-black/5 shadow-xs min-h-[500px]">
          {activeSection === "get-started" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex items-center gap-3 border-b border-black/5 pb-4">
                <div className="w-10 h-10 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center">
                  <Bot size={22} />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Botni ishga tushirish va ulashtirish</h3>
                  <p className="text-xs text-[#5A5A40]/60">Noldan boshlab guruhni o'rnatish qo'llanmasi</p>
                </div>
              </div>

              <div className="space-y-4 text-sm leading-relaxed text-[#4a4a4a]">
                <p>
                  Guruh monitoringini boshlash juda oddiy. Quyidagi 3 ta bosqichni ketma-ket bajaring:
                </p>

                <div className="relative pl-6 border-l border-emerald-200 space-y-4">
                  <div className="space-y-1">
                    <span className="absolute left-0 top-1 -translate-x-1/2 w-4 h-4 bg-emerald-600 rounded-full text-white text-[10px] font-bold flex items-center justify-center">1</span>
                    <h5 className="font-bold text-[#1a1a1a]">Botni guruhga qo'shing</h5>
                    <p className="text-xs">
                      Telegramda botimizni qidirib toping, so'ngra sozlamalaridan <strong>"Guruhga qo'shish"</strong> (Add to group) tugmasini bosing va o'zingizning guruhingizni tanlang. (Yoki guruh ichidan "A'zo qo'shish" tugmasi orqali botni topib qo'shing).
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="absolute left-0 top-[82px] -translate-x-1/2 w-4 h-4 bg-emerald-600 rounded-full text-white text-[10px] font-bold flex items-center justify-center">2</span>
                    <h5 className="font-bold text-[#1a1a1a]">Guruhda faollik qiling</h5>
                    <p className="text-xs">
                      Bot qo'shilgandan keyin, guruhda istalgan bitta xabar yozing (masalan, <em>"Salom"</em> degandek). Bot o'sha zahoti ushbu guruhni ma'lumotlar bazasida ro'yxatdan o'tkazadi.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="absolute left-0 top-[168px] -translate-x-1/2 w-4 h-4 bg-emerald-600 rounded-full text-white text-[10px] font-bold flex items-center justify-center">3</span>
                    <h5 className="font-bold text-[#1a1a1a]">Ushbu paneldan guruhni tanlang</h5>
                    <p className="text-xs">
                      Guruh aniqlangandan so'ng, yuqoridagi <strong>"Faol Telegram Guruhlari"</strong> ro'yxatida guruhingiz nomi paydo bo'ladi. Uni tanlang va o'sha guruhga tegishli barcha statistikani (a'zolar o'zgarishi, taklif etilganlar) alohida kuzatishingiz mumkin.
                    </p>
                  </div>
                </div>

                <div className="bg-[#F5F5F0] p-4 rounded-2xl border border-black/5 mt-4 space-y-2">
                  <p className="text-xs font-bold text-[#5A5A40]">Eslatma:</p>
                  <p className="text-xs leading-relaxed text-[#5A5A40]/80">
                    Botimiz guruhlarga hech qachon keraksiz xabarlar yozmaydi yoki foydalanuvchilarni bezovta qilmaydi. U faqat belgilangan taqiqlar (masalan, reklama havolalari) va yangi a'zolar taklif qilinishini zimdan nazorat qiladi.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeSection === "admin-auth" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex items-center gap-3 border-b border-black/5 pb-4">
                <div className="w-10 h-10 bg-amber-50 text-amber-700 rounded-xl flex items-center justify-center font-sans font-bold">
                  <Key size={18} />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Adminlikni tasdiqlash va kirish (/auth)</h3>
                  <p className="text-xs text-[#5A5A40]/60">Panelga xavfsiz ulanish yo'riqnomasi</p>
                </div>
              </div>

              <div className="space-y-4 text-sm leading-relaxed text-[#4a4a4a]">
                <p>
                  Ushbu tizimning xavfsizligi guruh ma'lumotlarini ruxsatsiz shaxslardan himoyalashga mo'ljallangan. Panelga faqat guruhning rasmiy administratorlari kira oladi.
                </p>

                <h4 className="font-bold text-[#1a1a1a] mt-4 font-sans text-sm">Bosqichma-bosqich yo'riqnoma:</h4>
                <div className="relative pl-6 border-l border-amber-200 space-y-4">
                  <div className="space-y-1">
                    <span className="absolute left-0 top-1 -translate-x-1/2 w-4 h-4 bg-amber-600 rounded-full text-white text-[10px] font-bold flex items-center justify-center">1</span>
                    <h5 className="font-bold text-[#1a1a1a]">Guruhda /auth buyrug'ini yuboring</h5>
                    <p className="text-xs font-sans">
                      Siz admin bo'lgan va bot qo'shilgan Telegram guruhiga kiring va matn maydonida <strong>/auth</strong> buyrug'ini yuboring. Buyruq yuborilgach, bot uni guruhdagi shovqinni kamaytirish va xavfsizlik maqsadida darhol o'chirib yuboradi.
                    </p>
                  </div>

                  <div className="space-y-1 font-sans">
                    <span className="absolute left-0 top-[96px] -translate-x-1/2 w-4 h-4 bg-amber-600 rounded-full text-white text-[10px] font-bold flex items-center justify-center">2</span>
                    <h5 className="font-bold text-[#1a1a1a]">6 xonali tasdiqlash kodini oling</h5>
                    <p className="text-xs">
                      Bot sizga shaxsiy xabar (DM) orqali kodingizni yuboradi. Agar bot sizga shaxsiy xabar yubora olmasa, guruhda vaqtinchalik xabar yuborib, u xabarni 30 soniyadan so'ng o'chirib tashlaydi. Bot sizga shaxsiy yozishi uchun avval botning shaxsiy chatiga kirib <strong>"Start"</strong> buyrug'ini bosgan bo'lishingiz tavsiya etiladi.
                    </p>
                  </div>

                  <div className="space-y-1 font-sans">
                    <span className="absolute left-0 top-[204px] -translate-x-1/2 w-4 h-4 bg-amber-600 rounded-full text-white text-[10px] font-bold flex items-center justify-center">3</span>
                    <h5 className="font-bold text-[#1a1a1a]">Kodni monitoring paneliga kiriting</h5>
                    <p className="text-xs">
                      Olingan 6 xonali kodni saytdagi <strong>"Tasdiqlash kodi"</strong> maydoniga kiriting va "Tasdiqlash" tugmasini bosing. Kod kiritilgandan so'ng, tizim uning haqiqiyligini tekshiradi va u guruhni profilingizga biriktiradi.
                    </p>
                  </div>
                </div>

                <div className="bg-[#F5F5F0] p-4 rounded-2xl border border-black/5 mt-4 space-y-1">
                  <p className="text-xs font-bold text-[#5A5A40]">Muddati:</p>
                  <p className="text-xs leading-relaxed text-[#5A5A40]/80">
                    Sizga yuborilgan tasdiqlash kodi vaqtinchalik bo'lib, <strong>10 daqiqa</strong> davomida faol bo'ladi. Muddati o'tib ketgan bo'lsa, guruhda qaytadan <code className="text-emerald-800">/auth</code> buyrug'ini yuboring.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeSection === "admin-rights" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex items-center gap-3 border-b border-black/5 pb-4">
                <div className="w-10 h-10 bg-blue-50 text-blue-700 rounded-xl flex items-center justify-center">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Adminlik Huquqlarini Berish</h3>
                  <p className="text-xs text-[#5A5A40]/60">Nima uchun va qanday ruxsatlar kerak?</p>
                </div>
              </div>

              <div className="space-y-4 text-sm leading-relaxed text-[#4a4a4a]">
                <p>
                  Tizim to'kis runs-to-runs ishlashi va guruh tartib-intizomini saqlash uchun botga guruhda <strong>Administrator (Admin)</strong> maqomini berish talab etiladi.
                </p>

                <h4 className="font-bold text-[#1a1a1a] mt-4">Bot nima uchun admin bo'lishi kerak?</h4>
                
                <ul className="list-disc pl-5 space-y-2 text-xs">
                  <li>
                    <strong>Xabarlarni o'chirish huquqi (Delete messages)</strong>: Guruhda begona yoki ruxsat etilmagan foydalanuvchilar reklama havolalarini (linklarni) ulashganda, bot ularni darhol o'chirib yuborishi va guruh tozaligini saqlashi uchun ushbu ruxsat zarur.
                  </li>
                  <li>
                    <strong>Tizim xabarlarini tozalash</strong>: <em>"Kimdir guruhga qo'shildi"</em> yoki <em>"Kimdir guruhdan chiqdi"</em> degan vizual "shovqin" xabarlarni guruhdan avtomatik yo'qotib, suhbatni chiroyli saqlash uchun.
                  </li>
                  <li>
                    <strong>G'oliblarni aniqlash va nazorat</strong>: Konkursda do'stlarini guruhga a'zo qilgan ishtirokchilarni to'g'ri sanash va a'zolar o'zgarishini aniq boshqarish uchun.
                  </li>
                </ul>

                <div className="bg-amber-50 text-amber-900 border border-amber-100 p-4 rounded-2xl text-xs space-y-1">
                  <p className="font-bold">Muhim xavfsizlik kafolati:</p>
                  <p className="text-amber-800/80 leading-relaxed">
                    Botimiz guruh egasining ruxsatisiz boshqalarni admin qila olmaydi, guruh sozlamalarini o'zboshimchalik bilan o'zgartirmaydi yoki a'zolarni asossiz haydamaydi. U faqat tartib va takliflarni hisoblaydi!
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeSection === "sync" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex items-center gap-3 border-b border-black/5 pb-4">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-700 rounded-xl flex items-center justify-center">
                  <RefreshCw size={22} className="animate-spin" style={{ animationDuration: '6s' }} />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Guruhni sinxronlash (/sync)</h3>
                  <p className="text-xs text-[#5A5A40]/60">Ma'lumotlar bazasini guruh bilan doimiy moslashtirish</p>
                </div>
              </div>

              <div className="space-y-4 text-sm leading-relaxed text-[#4a4a4a]">
                <p>
                  Sinxronizatsiya (Sync) - bu guruh a'zolari va administratorlar ro'yxatini real vaqt rejimida ushbu boshqaruv paneli bilan tenglashtirish va moslashtirish usulidir.
                </p>

                <h4 className="font-bold text-[#1a1a1a] mt-4">Sinxronlashni qanday amalga oshirish kerak?</h4>
                
                <p className="text-xs">
                  Guruh egasi yoki uning adminlaridan biri Telegram guruhida oddiygina quyidagi matnli xabarni yozsa kifoya:
                </p>

                <div className="flex items-center justify-between bg-[#F5F5F0] p-4 rounded-2xl border border-black/5">
                  <code className="text-sm font-mono font-bold text-[#5A5A40]">/sync</code>
                  <button
                    onClick={() => handleCopy("/sync", "sync")}
                    className="flex items-center gap-1.5 text-xs text-[#5A5A40] font-bold hover:text-black cursor-pointer bg-white px-3 py-1.5 rounded-lg shadow-2xs"
                  >
                    {copiedText === "sync" ? (
                      <>
                        <Check size={14} className="text-emerald-600" />
                        <span>Nusxa olindi!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span>Nusxa olish</span>
                      </>
                    )}
                  </button>
                </div>

                <h4 className="font-bold text-[#1a1a1a] mt-4">Sinxronlash nima beradi?</h4>
                <ul className="list-disc pl-5 space-y-2 text-xs">
                  <li>
                    <strong>Haqiqiy a'zolar soni</strong>: Telegram guruhidgai a'zolar sonini aniq hisoblab, boshqaruv panelidagi "Jami a'zolar" kartasini soniyali yangilaydi.
                  </li>
                  <li>
                    <strong>Administratorlarni kiritish</strong>: Guruhdagi rasmiy adminlarni bot o'z bazasiga kiritadi. Shundan so'ng, adminlar guruhda link yoki havolalar yozishganda, ularning xabarlari taqiqlanmaydi va o'chirilmaydi.
                  </li>
                  <li>
                    <strong>A'zolar integratsiyasi</strong>: Guruhingizdagi mavjud aktiv a'zolarni bazaga avtomatik ro'yxatlab borish imkonini yaratadi.
                  </li>
                </ul>

                <p className="text-xs text-[#5A5A40]/70 italic mt-2">
                  * Sinxronlash muvaffaqiyatli yakunlangach, bot guruhda hisobot beradi va guruhni toza tutish uchun o'sha hisobot xabarini 15 soniyadan so'ng avtomatik o'chirib tashlaydi.
                </p>
              </div>
            </div>
          )}

          {activeSection === "contests" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex items-center gap-3 border-b border-black/5 pb-4">
                <div className="w-10 h-10 bg-amber-50 text-amber-700 rounded-xl flex items-center justify-center">
                  <Trophy size={22} />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Konkurslar va Tanlovlar o'tkazish</h3>
                  <p className="text-xs text-[#5A5A40]/60">Takliflar poygasini boshqarish va guruhni kengaytirish</p>
                </div>
              </div>

              <div className="space-y-4 text-sm leading-relaxed text-[#4a4a4a]">
                <p>
                  Guruhga ko'proq a'zo jalb qilish, ularni rag'batlantirish uchun <strong>Konkurslar (Tanlovlar)</strong> o'tkazish ajoyib usul hisoblanadi.
                </p>

                <h4 className="font-bold text-[#1a1a1a] mt-4">Konkursni boshlash bosqichlari:</h4>
                <ol className="list-decimal pl-5 space-y-2 text-xs">
                  <li>
                    Boshqaruv panelida chap tomondagi <strong>"Konkurslar" (Tanlovlar)</strong> ruyxatiga o'ting.
                  </li>
                  <li>
                    <strong>Yangi konkurs</strong> formasi orqali o'zingiz xohlagan guruhni tanlang, konkurs sarlavhasi, boshlanish/tugash sanasini hamda taklif qilinayotgan ajoyib sovg'alarni kiriting.
                  </li>
                  <li>
                    <strong>"Konkursni boshlash"</strong> tugmasini bosing. Bo'ldi! Tizim guruh uchun faol konkursni sozlaydi va taklif qiluvchilar reytingini faqat shu konkurs davrasi uchun alohida boshqaradi.
                  </li>
                </ol>

                <h4 className="font-bold text-[#1a1a1a] mt-4">Guruh a'zolari konkurs haqida qanday bilishadi?</h4>
                <p className="text-xs">
                  Guruh a'zolari istalgan paytda guruh ichida quyidagi buyruqni (heshtegni) yuborishsa, bot ularga joriy faol konkurs nomini, muddati va mukofotlarini chiroyli matn hamda rasm (agar kiritgan bo'lsangiz) ko'rinishida yuboradi:
                </p>

                <div className="flex items-center justify-between bg-[#F5F5F0] p-4 rounded-2xl border border-black/5">
                  <code className="text-sm font-mono font-bold text-[#5A5A40]">#contest</code>
                  <button
                    onClick={() => handleCopy("#contest", "contest")}
                    className="flex items-center gap-1.5 text-xs text-[#5A5A40] font-bold hover:text-black cursor-pointer bg-white px-3 py-1.5 rounded-lg shadow-2xs"
                  >
                    {copiedText === "contest" ? (
                      <>
                        <Check size={14} className="text-emerald-600" />
                        <span>Nusxa olindi!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span>Nusxa olish</span>
                      </>
                    )}
                  </button>
                </div>

                <h4 className="font-bold text-[#1a1a1a] mt-6">Kim qancha odam taklif qilganini tekshirish (/leaderboard):</h4>
                <p className="text-xs">
                  Guruh a'zolari va adminlar guruhda istalgan vaqtda kim qancha odam qo'shganini va reytingning eng kuchli 10 taligini ko'rishlari mumkin. Sanani ham ko'rsatish imkoniyati mavjud:
                </p>

                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-[#F5F5F0] p-4 rounded-2xl border border-black/5">
                    <div>
                      <code className="text-sm font-mono font-bold text-[#5A5A40]">/leaderboard</code>
                      <p className="text-[11px] text-[#5A5A40]/70 mt-0.5">Faol konkurs boshlanganidan beri (yoki barcha vaqt)</p>
                    </div>
                    <button
                      onClick={() => handleCopy("/leaderboard", "lb-def")}
                      className="flex items-center gap-1.5 text-xs text-[#5A5A40] font-bold hover:text-black cursor-pointer bg-white px-3 py-1.5 rounded-lg shadow-2xs"
                    >
                      {copiedText === "lb-def" ? (
                        <>
                          <Check size={14} className="text-emerald-600" />
                          <span>Nusxa olindi!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          <span>Nusxa olish</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-between bg-[#F5F5F0] p-4 rounded-2xl border border-black/5">
                    <div>
                      <code className="text-sm font-mono font-bold text-[#5A5A40]">/leaderboard 2026-09-01</code>
                      <p className="text-[11px] text-[#5A5A40]/70 mt-0.5">Belgilangan sanadan (yil-oy-kun yoki kun.oy.yil) boshlab</p>
                    </div>
                    <button
                      onClick={() => handleCopy("/leaderboard 2026-09-01", "lb-date")}
                      className="flex items-center gap-1.5 text-xs text-[#5A5A40] font-bold hover:text-black cursor-pointer bg-white px-3 py-1.5 rounded-lg shadow-2xs"
                    >
                      {copiedText === "lb-date" ? (
                        <>
                          <Check size={14} className="text-emerald-600" />
                          <span>Nusxa olindi!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          <span>Nusxa olish</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-between bg-[#F5F5F0] p-4 rounded-2xl border border-black/5">
                    <div>
                      <code className="text-sm font-mono font-bold text-[#5A5A40]">/leaderboard 7d</code>
                      <p className="text-[11px] text-[#5A5A40]/70 mt-0.5">Oxirgi 7 kunlik (yoki <code>30d</code>) natijalar</p>
                    </div>
                    <button
                      onClick={() => handleCopy("/leaderboard 7d", "lb-7d")}
                      className="flex items-center gap-1.5 text-xs text-[#5A5A40] font-bold hover:text-black cursor-pointer bg-white px-3 py-1.5 rounded-lg shadow-2xs"
                    >
                      {copiedText === "lb-7d" ? (
                        <>
                          <Check size={14} className="text-emerald-600" />
                          <span>Nusxa olindi!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          <span>Nusxa olish</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === "trouble" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex items-center gap-3 border-b border-black/5 pb-4">
                <div className="w-10 h-10 bg-rose-50 text-rose-700 rounded-xl flex items-center justify-center">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Nosozliklarni aniqlash va bartaraf etish</h3>
                  <p className="text-xs text-[#5A5A40]/60">Sodda muammolarni bevosita o'zingiz hal qiling</p>
                </div>
              </div>

              <div className="space-y-5 text-sm leading-relaxed text-[#4a4a4a]">
                <p>
                  Agar bot ishlamayotgandek tuyulsa, guruh monitoringi to'xtab qolsa yoki statusingizda xatolik ko'rinsa, quyidagi holatlardan birini tekshirib ko'ring:
                </p>

                <div className="space-y-4 text-xs">
                  <div className="bg-[#F5F5F0] p-4 rounded-2xl border border-black/5 space-y-1">
                    <h5 className="font-bold text-[#1a1a1a] flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                      1. "Baza sozlanmagan (Supabase ulanmagan)" statusi
                    </h5>
                    <p className="text-[#5A5A40]/80">
                      <strong>Sababi:</strong> Supabase ma'lumotlar bazasi loyihaga bog'lanmagan. 
                      <br />
                      <strong>Yechim:</strong> Boshqaruv sozlamalaridan <code>SUPABASE_URL</code> va <code>SUPABASE_ANON_KEY</code> o'zgaruvchilarini kiritib, tizimni bexato o'rnating. Loyiha faqat real bazada ishlaydi.
                    </p>
                  </div>

                  <div className="bg-[#F5F5F0] p-4 rounded-2xl border border-black/5 space-y-1">
                    <h5 className="font-bold text-[#1a1a1a] flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      2. "Bot token moduli yo'q / Bot ishga tushmagan" statusi
                    </h5>
                    <p className="text-[#5A5A40]/80">
                      <strong>Sababi:</strong> Telegram botining maxsus tokeni (API key) kiritilmagan yoki noto'g'ri kiritilgan.
                      <br />
                      <strong>Yechim:</strong> <code>TELEGRAM_BOT_TOKEN</code> atrof-muhit o'zgaruvchisiga o'z botingiz kalitini (BotFather'dan beriladigan kod) kiritganingizni tekshirib chiqing.
                    </p>
                  </div>

                  <div className="bg-[#F5F5F0] p-4 rounded-2xl border border-black/5 space-y-1">
                    <h5 className="font-bold text-[#1a1a1a] flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      3. Reklama havolalari o'chirilmayapti
                    </h5>
                    <p className="text-[#5A5A40]/80">
                      <strong>Sababi:</strong> Bot guruhda administrator qilinmagan yoki "Xabarlarni o'chirish" ruxsati berilmagan.
                      <br />
                      <strong>Yechim:</strong> Guruh sozlamalarini ochib, botimiz profiliga kiring va uni guruhda Admin qilib belgilang.
                    </p>
                  </div>

                  <div className="bg-[#F5F5F0] p-4 rounded-2xl border border-black/5 space-y-1">
                    <h5 className="font-bold text-[#1a1a1a] flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#5a5a40]"></span>
                      4. Umumiy guruhlar ro'yxatida hech narsa ko'rinmayapti
                    </h5>
                    <p className="text-[#5A5A40]/80">
                      <strong>Sababi:</strong> Bot qo'shilganidan so'ng hali birorta ham xabar yuborilgani yo'q. Simpatiyani faollashtirish zarur.
                      <br />
                      <strong>Yechim:</strong> Guruhda bitta xabar yozing yoki biron buyruq yuboring. Shundan so'ng veb-saytni shunchaki yangilasangiz, guruhingiz ruyxatga kiradi.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
