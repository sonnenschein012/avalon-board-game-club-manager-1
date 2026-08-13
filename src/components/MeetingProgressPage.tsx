import React from 'react';
import { FileQuestion, Calendar } from 'lucide-react';
import MemberProfileModal from './MemberProfileModal';
import { useMeetingProgressLogic } from '../hooks/useMeetingProgressLogic';
import MeetingDashboardTab from './MeetingDashboardTab';
import MeetingCanvasTab from './MeetingCanvasTab';
import MeetingCardStyleModal from './MeetingCardStyleModal';

export default function MeetingProgressPage({ onSidebarToggle }: { onSidebarToggle?: (collapsed: boolean) => void }) {
  const {
    selectedDate, setSelectedDate,
    customTitle, setCustomTitle,
    dailyPlanning,
    members, games,
    selectedMember, setSelectedMember,
    groupRecModes, setGroupRecModes,
    groupSearchedGameIds, setGroupSearchedGameIds,
    activeTab, setActiveTab,
    cardStyles, setCardStyles,
    editingCardId, setEditingCardId,
    cardPositions, setCardPositions,
    guides, setGuides,
    isFullscreen, setIsFullscreen,
    editingGroupId, setEditingGroupId,
    editingGroupName, setEditingGroupName,
    captureRef, viewContainerRef,
    boardScale, boardHeight,
    
    handleCapture,
    handleCopyDrinkOrder,
    handleGridAlign,
    handleUpdateGroupName,
    getAttendeeFromMember,
    memberPlayedGames,
    recommendGames,
    colors
  } = useMeetingProgressLogic(onSidebarToggle);

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 md:p-8 rounded-[2rem] shadow-sm gap-6">
        <div className="space-y-2">
          <p className="text-sm font-bold text-gold tracking-wider uppercase">Live Session Dashboard</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-800">
            {dailyPlanning ? dailyPlanning.name : '모임 진행 및 추천'}
          </h1>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex items-center bg-slate-50 rounded-xl overflow-hidden">
            <div className="pl-4 text-slate-400">
              <Calendar size={18} />
            </div>
            <input 
              type="date" 
              value={selectedDate} 
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-transparent text-slate-800 font-black px-4 py-3 outline-none border-none text-sm uppercase tracking-widest cursor-pointer w-full"
            />
          </div>
        </div>
      </div>

      {dailyPlanning && (
        <div className="flex gap-4 border-b border-slate-200 px-4 overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:hidden" style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`shrink-0 pb-4 px-2 font-bold text-sm uppercase tracking-widest transition-colors border-b-2 ${activeTab === 'dashboard' ? 'border-navy text-navy' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            라이브 대시보드
          </button>
          <button
            onClick={() => setActiveTab('notice')}
            className={`shrink-0 pb-4 px-2 font-bold text-sm uppercase tracking-widest transition-colors border-b-2 ${activeTab === 'notice' ? 'border-navy text-navy' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            공지 이미지 생성
          </button>
          <button
            onClick={() => setActiveTab('drink')}
            className={`shrink-0 pb-4 px-2 font-bold text-sm uppercase tracking-widest transition-colors border-b-2 ${activeTab === 'drink' ? 'border-navy text-navy' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            음료 주문 리스트
          </button>
        </div>
      )}

      {!dailyPlanning ? (
        <div className="flex flex-col items-center justify-center p-20 space-y-4 bg-white rounded-[2rem] shadow-sm">
          <FileQuestion size={48} className="text-slate-200" />
          <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">해당 날짜에 편성된 조가 없습니다</h2>
          <p className="text-sm text-slate-400">다른 날짜를 선택하거나 일일 조 편성 탭에서 모임을 시작해주세요.</p>
        </div>
      ) : activeTab === 'dashboard' ? (
        <MeetingDashboardTab
          dailyPlanning={dailyPlanning}
          members={members}
          games={games}
          editingGroupId={editingGroupId}
          editingGroupName={editingGroupName}
          setEditingGroupId={setEditingGroupId}
          setEditingGroupName={setEditingGroupName}
          handleUpdateGroupName={handleUpdateGroupName}
          getAttendeeFromMember={getAttendeeFromMember}
          setSelectedMember={setSelectedMember}
          groupSearchedGameIds={groupSearchedGameIds}
          setGroupSearchedGameIds={setGroupSearchedGameIds}
          memberPlayedGames={memberPlayedGames}
          groupRecModes={groupRecModes}
          setGroupRecModes={setGroupRecModes}
          recommendGames={recommendGames}
        />
      ) : (activeTab === 'notice' || activeTab === 'drink') ? (
        <MeetingCanvasTab
          activeTab={activeTab}
          isFullscreen={isFullscreen}
          setIsFullscreen={setIsFullscreen}
          viewContainerRef={viewContainerRef}
          captureRef={captureRef}
          boardScale={boardScale}
          boardHeight={boardHeight}
          customTitle={customTitle}
          setCustomTitle={setCustomTitle}
          selectedDate={selectedDate ?? ''}
          guides={guides}
          setGuides={setGuides}
          dailyPlanning={dailyPlanning}
          cardStyles={cardStyles}
          colors={colors}
          members={members}
          getAttendeeFromMember={getAttendeeFromMember}
          cardPositions={cardPositions}
          setCardPositions={setCardPositions}
          setEditingCardId={setEditingCardId}
          handleGridAlign={handleGridAlign}
          handleCopyDrinkOrder={handleCopyDrinkOrder}
          handleCapture={handleCapture}
        />
      ) : null}

      {editingCardId && dailyPlanning && (
        <MeetingCardStyleModal
          editingCardId={editingCardId}
          setEditingCardId={setEditingCardId}
          editingGroupId={editingGroupId}
          setEditingGroupId={setEditingGroupId}
          editingGroupName={editingGroupName}
          setEditingGroupName={setEditingGroupName}
          handleUpdateGroupName={handleUpdateGroupName}
          dailyPlanning={dailyPlanning}
          colors={colors}
          cardStyles={cardStyles}
          setCardStyles={setCardStyles}
        />
      )}

      <MemberProfileModal 
        member={selectedMember} 
        onClose={() => setSelectedMember(null)}
        games={games}
        members={members}
      />
    </div>
  );
}
