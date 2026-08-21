import React from 'react';
import { Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ArchiveFormulaModalProps {
  formulaModal: 'w5' | 'w6' | 'w7' | null;
  setFormulaModal: (m: 'w5' | 'w6' | 'w7' | null) => void;
}

export default function ArchiveFormulaModal({ formulaModal, setFormulaModal }: ArchiveFormulaModalProps) {
  return (
    <AnimatePresence>
      {formulaModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm"
          onClick={() => setFormulaModal(null)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-xl text-navy flex items-center gap-2">
                <Info className="text-blue-500" size={24} />
                {formulaModal === 'w5' && '신입 유입 및 정착 지수 (보정 시)'}
                {formulaModal === 'w6' && '모임 고착화 지수'}
                {formulaModal === 'w7' && '경험 독점 지수'}
              </h3>
              <button 
                onClick={() => setFormulaModal(null)} 
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors absolute top-4 right-4"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 md:p-8 space-y-8 bg-white min-h-0">
              {formulaModal === 'w5' && (
                <>
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest">연산 공식</h4>
                    <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 flex items-center justify-center">
                      <code className="text-lg md:text-xl font-mono text-blue-600 font-bold whitespace-nowrap overflow-x-auto custom-scrollbar pb-2">
                        정규화 지수 = (n_t / A_t) / (N_new / N_active)
                      </code>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest">변수 정의</h4>
                    <ul className="space-y-3 font-mono text-sm md:text-base text-slate-700 bg-slate-50 p-6 rounded-xl border border-slate-100">
                      <li className="flex flex-col md:flex-row md:items-start gap-1 md:gap-4"><span className="text-blue-500 font-bold min-w-[80px]">n_t:</span> <span>당일 출석한 신입 멤버 수</span></li>
                      <li className="flex flex-col md:flex-row md:items-start gap-1 md:gap-4"><span className="text-blue-500 font-bold min-w-[80px]">A_t:</span> <span>당일 총 출석 인원</span></li>
                      <li className="flex flex-col md:flex-row md:items-start gap-1 md:gap-4"><span className="text-blue-500 font-bold min-w-[80px]">N_new:</span> <span>해당 학기 활동 중인 신입 멤버 총원</span></li>
                      <li className="flex flex-col md:flex-row md:items-start gap-1 md:gap-4"><span className="text-blue-500 font-bold min-w-[80px]">N_active:</span> <span>해당 학기 활동 중인 전체 멤버 총원</span></li>
                    </ul>
                  </div>
                </>
              )}
              {formulaModal === 'w6' && (
                <>
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest">연산 공식</h4>
                    <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 flex items-center justify-center">
                      <code className="text-base md:text-lg font-mono text-rose-500 font-bold whitespace-nowrap overflow-x-auto custom-scrollbar pb-2">
                        Stagnation_t = (1 / A_t) * Σ [ ln(x_&#123;i,t&#125; + 1) / ln(S_t + 1) ]
                      </code>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest">변수 정의</h4>
                    <ul className="space-y-3 font-mono text-sm md:text-base text-slate-700 bg-slate-50 p-6 rounded-xl border border-slate-100">
                      <li className="flex flex-col md:flex-row md:items-start gap-1 md:gap-4"><span className="text-rose-500 font-bold min-w-[80px]">A_t:</span> <span>당일 총 참석 인원</span></li>
                      <li className="flex flex-col md:flex-row md:items-start gap-1 md:gap-4"><span className="text-rose-500 font-bold min-w-[80px]">x_&#123;i,t&#125;:</span> <span>당일 기준 멤버 i의 누적 출석 횟수</span></li>
                      <li className="flex flex-col md:flex-row md:items-start gap-1 md:gap-4"><span className="text-rose-500 font-bold min-w-[80px]">S_t:</span> <span>당일(t)까지 열린 총 정기 모임 누적 횟수</span></li>
                    </ul>
                  </div>
                </>
              )}
              {formulaModal === 'w7' && (
                <>
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest">연산 공식</h4>
                    <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 flex items-center justify-center">
                      <code className="text-lg md:text-xl font-mono text-purple-500 font-bold whitespace-nowrap overflow-x-auto custom-scrollbar pb-2">
                        MMI(g) = (1 / n_g²) * (1 - n_g / N) * ln(T_g + 1)
                      </code>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest">변수 정의</h4>
                    <ul className="space-y-3 font-mono text-sm md:text-base text-slate-700 bg-slate-50 p-6 rounded-xl border border-slate-100">
                      <li className="flex flex-col md:flex-row md:items-start gap-1 md:gap-4"><span className="text-purple-500 font-bold min-w-[50px]">n_g:</span> <span>해당 게임(g)을 1회 이상 경험한 고유 인원수</span></li>
                      <li className="flex flex-col md:flex-row md:items-start gap-1 md:gap-4"><span className="text-purple-500 font-bold min-w-[50px]">N:</span> <span>선택 기간에 1회 이상 참석한 고유 인원수</span></li>
                      <li className="flex flex-col md:flex-row md:items-start gap-1 md:gap-4"><span className="text-purple-500 font-bold min-w-[50px]">T_g:</span> <span>해당 게임의 총 참여 좌석 수 (연인원)</span></li>
                    </ul>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
