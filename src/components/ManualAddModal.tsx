import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';

interface ManualAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: { name: string; studentIdPrefix: string; drink: string; afterparty: boolean; request: string }) => Promise<void>;
  isAdding: boolean;
}

export default function ManualAddModal({ isOpen, onClose, onAdd, isAdding }: ManualAddModalProps) {
  const [name, setName] = useState('');
  const [studentIdPrefix, setStudentIdPrefix] = useState('');
  const [drink, setDrink] = useState('');
  const [afterparty, setAfterparty] = useState(false);
  const [request, setRequest] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAdd({ name, studentIdPrefix, drink, afterparty, request });
    setName('');
    setStudentIdPrefix('');
    setDrink('');
    setAfterparty(false);
    setRequest('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b flex justify-between items-center bg-navy text-white">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Plus size={16} className="text-gold" />
            명단 추가
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-full transition">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">이름</label>
            <input 
              type="text"
              className="w-full text-sm font-bold text-navy border-b-2 border-slate-200 focus:border-gold outline-none p-2 bg-transparent"
              placeholder="홍길동"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">학번 (옵션, 예: 25)</label>
            <input 
              type="text"
              className="w-full text-sm font-bold text-navy border-b-2 border-slate-200 focus:border-gold outline-none p-2 bg-transparent"
              placeholder="학번 앞의 2자리 (예: 25)"
              value={studentIdPrefix}
              onChange={(e) => setStudentIdPrefix(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">음료 (선택)</label>
            <input 
              type="text"
              className="w-full text-sm font-bold text-navy border-b-2 border-slate-200 focus:border-gold outline-none p-2 bg-transparent"
              placeholder="음료명 입력"
              value={drink}
              onChange={(e) => setDrink(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="flex items-center gap-2 cursor-pointer p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <input
                type="checkbox"
                className="accent-gold w-4 h-4"
                checked={afterparty}
                onChange={(e) => setAfterparty(e.target.checked)}
              />
              <span className="text-sm font-bold text-navy">뒷풀이 참석</span>
            </label>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">희망사항 (선택)</label>
            <input 
              type="text"
              className="w-full text-sm font-bold text-navy border-b-2 border-slate-200 focus:border-gold outline-none p-2 bg-transparent"
              placeholder="예: 홍길동과 같은 조"
              value={request}
              onChange={(e) => setRequest(e.target.value)}
            />
          </div>
          <div className="pt-4">
            <button 
              type="submit" 
              disabled={isAdding || !name}
              className="w-full bg-navy text-white font-bold py-2.5 rounded-xl hover:bg-slate-800 disabled:opacity-50 transition"
            >
              {isAdding ? '추가 중...' : '추가하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
