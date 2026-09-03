import React from 'react';
import { LayoutDashboard, Download, Send, Settings2 } from 'lucide-react';
import { motion } from 'motion/react';
import { Member, Attendee } from '../types';
import type { DailyPlanning } from '../domain/attendance/dailyPlanning';
import { cn } from '../lib/utils';
import DiamondSvg from './icons/DiamondSvg';
import RookSvg from './icons/RookSvg';

interface MeetingCanvasTabProps {
  activeTab: 'notice' | 'drink';
  isFullscreen: boolean;
  setIsFullscreen: (f: boolean) => void;
  viewContainerRef: React.RefObject<HTMLDivElement | null>;
  captureRef: React.RefObject<HTMLDivElement | null>;
  boardScale: number;
  boardHeight: number;
  customTitle: string | null;
  setCustomTitle: (t: string) => void;
  selectedDate: string;
  guides: {x: number | null, y: number | null};
  setGuides: (g: {x: number | null, y: number | null}) => void;
  dailyPlanning: Pick<DailyPlanning, 'groups'>;
  cardStyles: Record<string, {bgColor: string}>;
  colors: string[];
  members: Member[];
  getAttendeeFromMember: (m: Member) => Attendee | undefined;
  cardPositions: Record<string, {x: number, y: number}>;
  setCardPositions: React.Dispatch<React.SetStateAction<Record<string, {x: number, y: number}>>>;
  setEditingCardId: (id: string | null) => void;
  handleGridAlign: () => void;
  handleCopyDrinkOrder: () => void;
  handleCapture: () => void;
}

export default function MeetingCanvasTab({
  activeTab,
  isFullscreen,
  setIsFullscreen,
  viewContainerRef,
  captureRef,
  boardScale,
  boardHeight,
  customTitle,
  setCustomTitle,
  selectedDate,
  guides,
  setGuides,
  dailyPlanning,
  cardStyles,
  colors,
  members,
  getAttendeeFromMember,
  cardPositions,
  setCardPositions,
  setEditingCardId,
  handleGridAlign,
  handleCopyDrinkOrder,
  handleCapture
}: MeetingCanvasTabProps) {
  return (
    <div className="bg-white rounded-[2rem] p-8 shadow-sm flex flex-col items-center">
      <div className="w-full flex justify-end mb-4 gap-4">
         <button onClick={handleGridAlign} className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold shadow hover:bg-slate-200 transition-colors">
            <LayoutDashboard size={16} /> 그리드 정렬
         </button>
         {activeTab === 'drink' && (
            <button onClick={handleCopyDrinkOrder} className="flex items-center gap-2 bg-slate-800 text-slate-100 px-4 py-2 rounded-lg text-sm font-bold shadow hover:bg-slate-700 transition-colors">
              <Send size={16} /> 사장님께 주문 내역 보내기
            </button>
         )}
         <button onClick={handleCapture} className="flex items-center gap-2 bg-navy text-white px-4 py-2 rounded-lg text-sm font-bold shadow hover:bg-gold transition-colors">
            <Download size={16} /> {activeTab === 'notice' ? '공지 이미지 추출' : '음료 리스트 이미지 추출'}
         </button>
      </div>
      <div 
        onDoubleClick={() => setIsFullscreen(!isFullscreen)}
        className={
          isFullscreen 
            ? "fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 md:p-8 cursor-zoom-out overflow-y-auto" 
            : "p-2 sm:p-4 rounded-[2.5rem] border-2 border-dashed border-navy/40 bg-slate-50 w-full max-w-4xl relative cursor-zoom-in group/capture"
        }
      >
        {!isFullscreen && (
          <div className="absolute -top-3 left-8 bg-slate-50 px-2 text-xs font-bold text-navy/60 uppercase tracking-widest group-hover/capture:text-navy transition-colors">
            Capture Area
          </div>
        )}
        <div 
          ref={viewContainerRef as React.RefObject<HTMLDivElement>}
          className={isFullscreen ? "w-full max-w-[100vw] overflow-auto cursor-default min-h-[90vh] flex items-start justify-start md:justify-center" : "w-full overflow-hidden relative cursor-zoom-in"}
        >
          <div className={cn("transition-transform origin-top-left", isFullscreen ? "scale-[0.6] sm:scale-75 md:scale-100" : "")} style={{ 
            width: 1600, 
            height: boardHeight, 
            transform: isFullscreen ? undefined : `scale(${boardScale})`, 
            transformOrigin: 'top left',
            flexShrink: 0
          }}>
            <div 
              ref={captureRef as React.RefObject<HTMLDivElement>}
              className="relative w-[1600px] bg-[#000000] overflow-hidden rounded-[2rem] shadow-sm"
              style={{ height: boardHeight }}
            >
             <div className="absolute top-10 left-0 right-0 z-10 pointer-events-auto flex justify-center">
               <input
                 value={customTitle !== null ? customTitle : (activeTab === 'drink' ? `${selectedDate.replace(/-/g, '.')} 음료 주문 리스트` : `${selectedDate.replace(/-/g, '.')} 아발론 조 명단`)}
                 onChange={(e) => setCustomTitle(e.target.value)}
                 className="text-[32px] font-black text-white tracking-widest break-keep bg-transparent border-none outline-none text-center min-w-[800px]"
                 style={{ textShadow: '0 4px 10px rgba(0,0,0,0.5)' }}
               />
             </div>
             
             {/* Left Branding Zone */}
             <div className="absolute left-6 bottom-0 w-48 pointer-events-none z-0 opacity-100 flex flex-col justify-end">
                <RookSvg className="w-full h-auto drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)] translate-y-[10%]" />
             </div>

             {/* Right Branding Zone */}
             <div className="absolute right-0 top-0 w-72 pointer-events-none z-0 opacity-100 translate-x-[15%] translate-y-[-15%] rotate-[-20deg]">
                <DiamondSvg className="w-full h-auto drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]" />
             </div>
             
             <div className="absolute inset-0 pointer-events-none border-[200px] border-transparent" />
         
         {guides.x !== null && <div className="absolute top-0 bottom-0 border-l-2 border-dashed border-red-400 z-40 pointer-events-none" style={{ left: guides.x }} />}
         {guides.y !== null && <div className="absolute left-0 right-0 border-t-2 border-dashed border-red-400 z-40 pointer-events-none" style={{ top: guides.y }} />}

         {dailyPlanning.groups.map((group, idx) => {
            const cStyle = cardStyles[group.id] || { bgColor: colors[idx % colors.length] };
            const groupMembers = Array.from(new Set(group.memberIds)).map(id => members.find(m => m.id === id)).filter(Boolean) as Member[];
            
            return (
               <motion.div
                 id={`card-${group.id}`}
                 key={group.id}
                 drag
                 dragMomentum={false}
                 animate={{ x: cardPositions[group.id]?.x ?? 50, y: cardPositions[group.id]?.y ?? 50 }}
                 onDrag={(e, info) => {
                   const currentX = (cardPositions[group.id]?.x || 0) + info.offset.x;
                   const currentY = (cardPositions[group.id]?.y || 0) + info.offset.y;
                   let matchX: number | null = null;
                   let matchY: number | null = null;
                   Object.entries(cardPositions).forEach(([id, pos]: [string, {x: number, y: number}]) => {
                     if (id === group.id) return;
                     if (Math.abs(pos.x - currentX) < 15) matchX = pos.x;
                     if (Math.abs(pos.y - currentY) < 15) matchY = pos.y;
                   });
                   setGuides({ x: matchX, y: matchY });
                 }}
                 onDragEnd={(e, info) => {
                   const currentX = cardPositions[group.id]?.x || 0;
                   const currentY = cardPositions[group.id]?.y || 0;
                   
                   let nextX = guides.x !== null ? guides.x : Math.round((currentX + info.offset.x) / 20) * 20;
                   let nextY = guides.y !== null ? guides.y : Math.round((currentY + info.offset.y) / 20) * 20;
                   
                   setGuides({ x: null, y: null });

                   setCardPositions((prev: Record<string, {x: number, y: number}>) => {
                     const cardEl = document.getElementById(`card-${group.id}`);
                     const h1 = cardEl ? cardEl.offsetHeight : 200;

                     const overlapping = Object.entries(prev).some(([id, pos]: [string, {x: number, y: number}]) => {
                       if (id === group.id) return false;
                       const targetEl = document.getElementById(`card-${id}`);
                       const h2 = targetEl ? targetEl.offsetHeight : 200;
                       
                       // Check AABB collision with 45px margin
                       return (
                         Math.abs(pos.x - nextX) < 340 + 20 && 
                         nextY < pos.y + h2 + 20 &&
                         nextY + h1 + 20 > pos.y
                       );
                     });
                     
                     if (overlapping) {
                       nextX = currentX;
                       nextY = currentY;
                     }

                     return { ...prev, [group.id]: { x: nextX, y: nextY } };
                   });
                 }}
                  whileDrag={{ scale: 1.05, zIndex: 50, cursor: 'grabbing' }}
                 onDoubleClick={(e) => { e.stopPropagation(); setEditingCardId(group.id); }}
                 className="absolute cursor-grab p-6 rounded-[40px] border border-white/20 w-[340px] flex flex-col items-center text-center gap-4 shadow-[0_8px_30px_rgba(0,0,0,0.3)] group"
                 style={{ backgroundColor: cStyle.bgColor }}
               >
                  <button 
                    className="hide-on-capture absolute top-4 right-4 text-white hover:text-white/80 transition-colors bg-black/20 rounded-full p-2 shadow-sm backdrop-blur-sm"
                    onClick={(e) => { e.stopPropagation(); setEditingCardId(group.id); }}
                    title="카드 옵션"
                  >
                    <Settings2 size={20} />
                  </button>
               
                  <h3 className="text-[32px] font-black text-white tracking-tight leading-tight mt-6" style={{ textShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>{group.name || `TEAM ${idx + 1}`}</h3>
                  <div className="w-16 h-1 bg-white/50 rounded-full my-4" />
                  <ul className={`w-full px-2 ${groupMembers?.length >= 6 ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-4'}`}>
                     {groupMembers?.map((m, i) => {
                       const a = getAttendeeFromMember(m);
                       const displayText = activeTab === 'drink' ? (a?.drink || '미선택') : m.name;
                       return (
                         <li key={m.id || i} className="text-[26px] font-bold text-white flex items-center justify-center tracking-wide text-center" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                           {displayText}
                         </li>
                       );
                     })}
                  </ul>
               </motion.div>
            )
         })}
               </div>
            </div>
          </div>
        </div>
      </div>
  );
}
