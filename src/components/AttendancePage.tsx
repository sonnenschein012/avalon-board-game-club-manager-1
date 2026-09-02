import React from 'react';
import { FileUp, Trash2, ClipboardList, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import PageHeader from './PageHeader';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import CostEvaluationModal from './CostEvaluationModal';
import ManualAddModal from './ManualAddModal';
import UnassignedPool from './UnassignedPool';
import GroupsCanvas from './GroupsCanvas';
import { useAttendanceLogic } from '../hooks/useAttendanceLogic';

interface AttendancePageProps {
  onMoveToRecord?: () => void;
  isAdminModeActive?: boolean;
}

export default function AttendancePage({ onMoveToRecord, isAdminModeActive = false }: AttendancePageProps) {
  const {
    attendees,
    members,
    importing,
    activeRequestId,
    setActiveRequestId,
    sessionName,
    setSessionName,
    sessionDate,
    setSessionDate,
    groups,
    setGroups,
    isAutoMode,
    setIsAutoMode,
    isCostModalOpen,
    setIsCostModalOpen,
    editingGroupId,
    setEditingGroupId,
    editingGroupName,
    setEditingGroupName,
    isManualAddModalOpen,
    setIsManualAddModalOpen,
    isManualAdding,
    attendeeToDelete,
    setAttendeeToDelete,
    isDeleteModalOpen,
    setIsDeleteModalOpen,

    getMemberFromInfo,
    memberAttendanceCount,
    memberPairLastSession,
    memberPairRecentCounts,
    calculateGroupAverageAttendance,
    calculateGroupAverageStudentId,
    getReunionWarnings,
    unassignedAttendees,

    handleDeleteAttendee,
    handleQuickAddMember,
    handleManualAdd,
    handleFileUpload,
    clearRecords,
    handleCreateGroup,
    handleUpdateTargetSize,
    handleAutoAssign,
    exportSimulationData,

    removeFromGroup,
    handleDragStart,
    handleDragOver,
    handleDropToGroup,
    handleDropToUnassigned,
    handleMoveToRecord,
    attendanceSaving,
  } = useAttendanceLogic(onMoveToRecord ? { onMoveToRecord } : {});

  return (
    <div className="space-y-6">
      <PageHeader 
        title="일일 조 편성" 
        subtitle="Operations / Team Formation" 
        icon={ClipboardList}
        actions={
          <div className="flex flex-wrap gap-2 md:gap-3 w-full md:w-auto justify-end">
            <button 
              onClick={() => setIsAutoMode(!isAutoMode)}
              className={cn(
                "flex items-center gap-1 md:gap-2 px-3 py-2 md:px-5 md:py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg",
                isAutoMode 
                  ? "bg-orange-100 text-orange-600 border border-orange-200"
                  : "bg-white text-slate-600 border border-slate-100"
              )}
            >
              <ClipboardList size={16} className="shrink-0" /> <span className="hidden sm:inline">{isAutoMode ? '자동 편성 모드 종료' : '자동 조편성'}</span><span className="sm:hidden">{isAutoMode ? '종료' : '자동편성'}</span>
            </button>
            <label className="flex items-center gap-1 md:gap-2 px-3 py-2 md:px-5 md:py-2.5 bg-slate-50 text-navy hover:text-gold border border-slate-100 rounded-xl hover:bg-indigo-100 transition-all text-xs font-bold cursor-pointer">
              {importing ? <Loader2 size={16} className="animate-spin shrink-0" /> : <FileUp size={16} className="shrink-0" />} 
              <span className="hidden sm:inline">{importing ? '임포트 중...' : '파일 업로드'}</span>
              <span className="sm:hidden">업로드</span>
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" disabled={importing} />
            </label>
            <button 
              onClick={clearRecords}
              className="flex items-center gap-1 md:gap-2 px-3 py-2 md:px-5 md:py-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all text-xs font-bold rounded-xl border border-transparent hover:border-red-100"
            >
              <Trash2 size={16} className="shrink-0" /> <span className="hidden sm:inline">초기화</span><span className="sm:hidden">초기화</span>
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 min-h-[500px]">
        <UnassignedPool
          unassignedAttendees={unassignedAttendees}
          getMemberFromInfo={getMemberFromInfo}
          memberAttendanceCount={memberAttendanceCount}
          onManualAddOpen={() => setIsManualAddModalOpen(true)}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDropToUnassigned={handleDropToUnassigned}
          onQuickAddMember={handleQuickAddMember}
          onDeleteAttendee={(a) => {
            setAttendeeToDelete(a);
            setIsDeleteModalOpen(true);
          }}
        />

        <GroupsCanvas
          isAdminModeActive={isAdminModeActive}
          sessionName={sessionName}
          setSessionName={setSessionName}
          sessionDate={sessionDate ?? ''}
          setSessionDate={setSessionDate}
          groups={groups}
          setGroups={setGroups}
          isAutoMode={isAutoMode}
          onAutoAssign={handleAutoAssign}
          onCostModalOpen={() => setIsCostModalOpen(true)}
          onExportSimulation={exportSimulationData}
          onMoveToRecord={handleMoveToRecord}
          saving={attendanceSaving}
          editingGroupId={editingGroupId}
          setEditingGroupId={setEditingGroupId}
          editingGroupName={editingGroupName}
          setEditingGroupName={setEditingGroupName}
          onUpdateTargetSize={handleUpdateTargetSize}
          onCreateGroup={handleCreateGroup}
          onDragOver={handleDragOver}
          onDropToGroup={handleDropToGroup}
          onDragStart={handleDragStart}
          removeFromGroup={removeFromGroup}
          attendees={attendees}
          getMemberFromInfo={getMemberFromInfo}
          memberAttendanceCount={memberAttendanceCount}
          activeRequestId={activeRequestId}
          setActiveRequestId={setActiveRequestId}
          getReunionWarnings={getReunionWarnings}
          calculateGroupAverageStudentId={calculateGroupAverageStudentId}
          calculateGroupAverageAttendance={calculateGroupAverageAttendance}
        />
      </div>

      <ManualAddModal
        isOpen={isManualAddModalOpen}
        onClose={() => setIsManualAddModalOpen(false)}
        onAdd={handleManualAdd}
        isAdding={isManualAdding}
      />
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        title="조원 삭제"
        message={`${attendeeToDelete?.name}님을 출석 명단에서 삭제하시겠습니까?`}
        onConfirm={handleDeleteAttendee}
        onCancel={() => {
          setIsDeleteModalOpen(false);
          setAttendeeToDelete(null);
        }}
      />
      <CostEvaluationModal 
        isOpen={isCostModalOpen} 
        onClose={() => setIsCostModalOpen(false)} 
        groups={groups} 
        attendees={attendees} 
        members={members} 
        memberAttendanceCount={memberAttendanceCount} 
        memberPairRecentCounts={memberPairRecentCounts} 
        memberPairLastSession={memberPairLastSession}
      />
    </div>
  );
}
