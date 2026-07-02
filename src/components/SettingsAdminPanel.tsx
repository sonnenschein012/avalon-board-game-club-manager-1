import React from 'react';
import { ShieldAlert, Plus, Loader2, Trash2 } from 'lucide-react';
import { Admin } from '../types';

interface SettingsAdminPanelProps {
  isMasterAdmin: boolean;
  admins: Admin[];
  loadingAdmins: boolean;
  newAdminEmail: string;
  setNewAdminEmail: (email: string) => void;
  addingAdmin: boolean;
  addAdmin: () => Promise<void>;
  removeAdmin: (email: string) => Promise<void>;
}

export default function SettingsAdminPanel({
  isMasterAdmin,
  admins,
  loadingAdmins,
  newAdminEmail,
  setNewAdminEmail,
  addingAdmin,
  addAdmin,
  removeAdmin
}: SettingsAdminPanelProps) {
  return (
    <div className="glass-panel p-6">
      <h2 className="text-lg font-bold text-navy mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
        <ShieldAlert size={18} className="text-gold" />
        관리자 (Admin) 권한 설정
      </h2>
      <div className="space-y-4">
        {isMasterAdmin && (
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="구글 이메일 주소 (예: user@gmail.com)" 
              className="flex-1 input-field bg-slate-50 border border-slate-200"
              value={newAdminEmail}
              onChange={e => setNewAdminEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addAdmin()}
            />
            <button 
              onClick={addAdmin}
              disabled={addingAdmin || !newAdminEmail}
              className="px-4 py-3 bg-navy text-white rounded-xl font-bold flex items-center gap-2 hover:bg-gold transition-colors disabled:opacity-50"
            >
              {addingAdmin ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              추가
            </button>
          </div>
        )}

        <div className="bg-slate-50 rounded-xl overflow-hidden border border-slate-100">
          {loadingAdmins ? (
            <div className="p-8 flex justify-center text-slate-400"><Loader2 className="animate-spin" /></div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-100 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500">이메일</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-slate-500">관리</th>
                </tr>
              </thead>
              <tbody>
                {admins.map(admin => (
                  <tr key={admin.id} className={`border-b border-slate-100 last:border-0 ${admin.role === 'master' ? 'bg-emerald-50/50' : 'hover:bg-white'} transition-colors`}>
                    <td className={`px-4 py-3 font-medium ${admin.role === 'master' ? 'text-emerald-700' : 'text-slate-700'}`}>
                      {admin.id}
                      {admin.role === 'master' && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full ml-2 font-bold tracking-widest">MASTER</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {admin.role === 'master' ? (
                        <span className="text-xs text-slate-400">변경 불가</span>
                      ) : (
                        isMasterAdmin && (
                          <button 
                            onClick={() => removeAdmin(admin.id)}
                            className="p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors border border-transparent hover:border-red-100"
                          >
                            <Trash2 size={16} />
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
