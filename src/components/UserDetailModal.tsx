import React from "react";
import { X } from "lucide-react";
import { format } from "date-fns";
import { uz } from "date-fns/locale";

interface UserDetailModalProps {
  selectedUserId: string;
  userDetailData: any;
  loadingUserDetails: boolean;
  onClose: () => void;
}

export default function UserDetailModal({
  selectedUserId,
  userDetailData,
  loadingUserDetails,
  onClose
}: UserDetailModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-[32px] border border-black/10 shadow-2xl w-full max-w-2xl overflow-hidden max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200 text-left">
        {/* Modal Header */}
        <div className="p-6 bg-[#F5F5F0] border-b border-black/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#5A5A40] rounded-xl flex items-center justify-center text-white font-bold text-lg">
              {userDetailData?.user?.firstName?.charAt(0) || "U"}
            </div>
            <div>
              <h3 className="text-xl font-bold tracking-tight">
                {userDetailData?.user ? `${userDetailData.user.firstName} ${userDetailData.user.lastName || ""}` : "Yuklanmoqda..."}
              </h3>
              <p className="text-xs text-[#5A5A40]/60 italic">
                {userDetailData?.user?.username ? `@${userDetailData.user.username}` : `Telegram ID: ${selectedUserId}`}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-black/5 flex items-center justify-center text-[#5A5A40] transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loadingUserDetails ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#5A5A40]"></div>
              <p className="text-sm text-[#5A5A40]/60">Tafsilotlar yuklanmoqda...</p>
            </div>
          ) : (
            <>
              {/* User Stats Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#F5F5F0] p-4 rounded-2xl border border-black/5 flex flex-col justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#5A5A40]/60">Guruhga qo'shilgan sana</span>
                  <span className="text-sm font-medium mt-1">
                    {userDetailData?.user?.joinedAt 
                      ? format(new Date(userDetailData.user.joinedAt), "d-MMMM, yyyy HH:mm", { locale: uz })
                      : "Guruh tashkil etilgandan oldin qo'shilgan"}
                  </span>
                </div>
                <div className="bg-[#F5F5F0] p-4 rounded-2xl border border-black/5 flex flex-col justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#5A5A40]/60">Taklif etilganlar soni</span>
                  <span className="text-2xl font-bold text-emerald-700 mt-1">
                    {userDetailData?.invitations?.length || 0} ta a'zo
                  </span>
                </div>
              </div>

              {/* Invitation List */}
              <div>
                <h4 className="text-sm font-bold uppercase tracking-widest text-[#5A5A40]/60 mb-3">Taklif etgan a'zolari ro'yxati</h4>
                {!userDetailData?.invitations || userDetailData.invitations.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-black/10 rounded-2xl text-[#5A5A40]/50 italic text-sm">
                    Hozircha hech kim taklif qilinmagan.
                  </div>
                ) : (
                  <div className="border border-black/5 rounded-2xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm font-sans min-w-[500px]">
                        <thead>
                          <tr className="bg-[#F5F5F0] text-xs font-bold uppercase tracking-wider text-[#5A5A40]/70 border-b border-black/5">
                            <th className="px-4 py-3">Ismi/Guruh a'zosi</th>
                            <th className="px-4 py-3">Username</th>
                            <th className="px-4 py-3 text-right">Qo'shilgan sana</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5">
                          {userDetailData.invitations.map((invite: any, index: number) => (
                            <tr key={index} className="hover:bg-[#F5F5F0]/30 transition-colors">
                              <td className="px-4 py-3 font-medium">
                                {invite.inviteeName}
                              </td>
                              <td className="px-4 py-3 text-[#5A5A40]/70">
                                {invite.inviteeUsername ? `@${invite.inviteeUsername}` : "-"}
                              </td>
                              <td className="px-4 py-3 text-right text-xs text-[#5A5A40]/60">
                                {invite.timestamp ? format(new Date(invite.timestamp), "d-MMM, HH:mm", { locale: uz }) : "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#F5F5F0] border-t border-t-black/5 text-right">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-black text-white hover:bg-black/80 font-bold rounded-xl transition-colors text-sm cursor-pointer"
          >
            Yopish
          </button>
        </div>
      </div>
    </div>
  );
}
