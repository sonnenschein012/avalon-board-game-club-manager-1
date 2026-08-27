import React, { useState } from 'react';
import { History, Plus, FileUp, Loader2 } from 'lucide-react';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import MemberProfileModal from './MemberProfileModal';
import PageHeader from './PageHeader';
import { useSessionsLogic } from '../hooks/useSessionsLogic';
import SessionFormModal from './SessionFormModal';
import SessionList from './SessionList';
import GroupGamesEditModal from './GroupGamesEditModal';
import { StoredSessionGroup, Session } from '../types';

interface SessionsPageProps {
  draftSession?: { name: string, date: string, groups: StoredSessionGroup[] } | null;
  onClearDraft?: () => void;
  isAdminModeActive?: boolean;
}

export default function SessionsPage({ draftSession, onClearDraft, isAdminModeActive = false }: SessionsPageProps) {
  const [editingGroupInfo, setEditingGroupInfo] = useState<{ session: Session, group: StoredSessionGroup } | null>(null);

  const {
    members, games,
    isAdding,
    editingSessionId,
    sessionName, setSessionName,
    sessionDate, setSessionDate,
    groups, setGroups,
    unassignedIds,
    viewingMember, setViewingMember,
    itemToDelete, setItemToDelete,
    selectedSemester, setSelectedSemester,
    isImporting,
    availableSemesters,
    filteredSessions,
    handleCSVUpload,
    handleAddNew,
    handleCreateGroup,
    updateGroupName,
    assignToGroup,
    removeFromGroup,
    toggleGameInGroup,
    onDragEnd,
    handleSave,
    handleEdit,
    handleDelete,
    handleClose,
    sessionSaving,
    sessionDeleting,
  } = useSessionsLogic(draftSession, onClearDraft);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader 
        title="세션 기록 및 관리" 
        subtitle="Operations / Team-based Logging" 
        icon={History}
        actions={
          <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full md:w-auto justify-end">
            <select 
              value={selectedSemester} 
              onChange={e => setSelectedSemester(e.target.value)}
              className="bg-white border text-xs md:text-sm border-slate-100 rounded-xl px-2 py-2 md:px-4 md:py-2.5 font-bold focus:outline-none shadow-sm text-slate-600 focus:ring-2 focus:ring-navy/20 cursor-pointer"
            >
              {availableSemesters.map(s => <option key={s} value={s}>{s === '전체' ? '전체 학기' : `${s} 학기`}</option>)}
            </select>
            {isAdminModeActive && (
              <label className="flex items-center gap-1 md:gap-2 px-3 py-2 md:px-5 md:py-2.5 bg-slate-50 text-navy hover:text-gold rounded-xl hover:bg-indigo-100 transition-all shadow-sm text-xs font-bold cursor-pointer border border-slate-100 whitespace-nowrap">
                {isImporting ? <Loader2 size={16} className="animate-spin shrink-0" /> : <FileUp size={16} className="shrink-0" />} 
                <span className="hidden sm:inline">{isImporting ? '처리 중...' : '파일 업로드'}</span>
                <span className="sm:hidden">업로드</span>
                <input type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} disabled={isImporting} />
              </label>
            )}
            <button 
              onClick={handleAddNew}
              className="flex items-center gap-1 md:gap-2 px-3 py-2 md:px-5 md:py-2.5 bg-navy hover:bg-gold text-white rounded-xl transition-all shadow-lg text-xs font-bold whitespace-nowrap"
            >
              <Plus size={16} className="shrink-0" /> <span className="hidden sm:inline">신규 세션 생성</span><span className="sm:hidden">신규 생성</span>
            </button>
          </div>
        }
      />

      <SessionFormModal
        modalControl={{
          isAdding,
          editingSessionId,
          handleClose,
          handleSave,
          saving: sessionSaving,
        }}
        sessionData={{
          sessionName,
          setSessionName,
          sessionDate: sessionDate ?? '',
          setSessionDate
        }}
        coreData={{
          members,
          games,
          groups,
          setGroups,
          unassignedIds
        }}
        groupActions={{
          assignToGroup,
          updateGroupName,
          toggleGameInGroup,
          removeFromGroup,
          handleCreateGroup
        }}
        dndHandlers={{
          onDragEnd
        }}
      />

      <SessionList
        filteredSessions={filteredSessions}
        members={members}
        games={games}
        handleEdit={handleEdit}
        setItemToDelete={setItemToDelete}
        setViewingMember={setViewingMember}
        handleEditGroup={(session, group) => setEditingGroupInfo({ session, group })}
      />

      {editingGroupInfo && (
        <GroupGamesEditModal
          session={editingGroupInfo.session}
          group={editingGroupInfo.group}
          games={games}
          onClose={() => setEditingGroupInfo(null)}
        />
      )}

      <ConfirmDeleteModal
        isOpen={!!itemToDelete}
        title="세션 기록 삭제"
        message={`'${itemToDelete?.name}' 세션 기록을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`}
        onConfirm={handleDelete}
        onCancel={() => setItemToDelete(null)}
        busy={sessionDeleting}
      />

      <MemberProfileModal 
        member={viewingMember} 
        onClose={() => setViewingMember(null)}
        games={games}
        members={members}
      />
    </div>
  );
}
