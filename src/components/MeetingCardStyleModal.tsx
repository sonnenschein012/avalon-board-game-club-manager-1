import React from 'react';
import { X } from 'lucide-react';
import { motion } from 'motion/react';
import { SessionGroup } from '../types';

interface MeetingCardStyleModalProps {
  editingCardId: string;
  setEditingCardId: (id: string | null) => void;
  editingGroupId: string | null;
  setEditingGroupId: (id: string | null) => void;
  editingGroupName: string;
  setEditingGroupName: (n: string) => void;
  handleUpdateGroupName: (id: string) => void;
  dailyPlanning: {groups: SessionGroup[]};
  colors: string[];
  cardStyles: Record<string, {bgColor: string}>;
  setCardStyles: React.Dispatch<React.SetStateAction<Record<string, {bgColor: string}>>>;
}

export default function MeetingCardStyleModal({
  editingCardId,
  setEditingCardId,
  editingGroupId,
  setEditingGroupId,
  editingGroupName,
  setEditingGroupName,
  handleUpdateGroupName,
  dailyPlanning,
  colors,
  cardStyles,
  setCardStyles
}: MeetingCardStyleModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/20 backdrop-blur-sm p-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-3xl p-6 shadow-2xl w-full max-w-sm">
            <div className="flex justify-between items-center mb-6">
               <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">스타일 커스텀</h3>
               <button onClick={() => { if (editingGroupId === editingCardId && editingCardId) handleUpdateGroupName(editingCardId); setEditingCardId(null); }} className="p-1 text-slate-400 hover:text-slate-800 transition-colors"><X size={16} /></button>
            </div>
            <div className="space-y-6">
               <div>
                 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">타이틀</label>
                 <input 
                   value={(editingGroupId === editingCardId && editingCardId) ? editingGroupName : (dailyPlanning?.groups.find(g => g.id === editingCardId)?.name || '')} 
                   onChange={e => {
                       if (editingGroupId !== editingCardId) {
                           setEditingGroupId(editingCardId);
                       }
                       setEditingGroupName(e.target.value);
                   }}
                   onBlur={() => {
                       if (editingGroupId === editingCardId && editingCardId) {
                           handleUpdateGroupName(editingCardId);
                       }
                   }}
                   onKeyDown={(e) => {
                       if (e.key === 'Enter' && editingGroupId === editingCardId && editingCardId) {
                           handleUpdateGroupName(editingCardId);
                       }
                   }}
                   className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-navy transition-shadow"
                   placeholder="조 이름 (ex: 버건디방)"
                 />
               </div>
               <div>
                 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">카드 색상</label>
                 <div className="flex flex-wrap gap-3">
                   {colors.map(c => (
                      <button 
                        key={c} 
                        onClick={() => { if(editingCardId) setCardStyles(prev => ({ ...prev, [editingCardId]: { bgColor: c } })) }}
                        className={`w-8 h-8 rounded-full border shadow-sm transition-transform hover:scale-110 ${editingCardId && cardStyles[editingCardId]?.bgColor === c ? 'ring-2 ring-offset-2 ring-navy' : 'border-slate-200'}`} 
                        style={{ backgroundColor: c }} 
                      />
                   ))}
                 </div>
               </div>
            </div>
        </motion.div>
    </div>
  );
}
