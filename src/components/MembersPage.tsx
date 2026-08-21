import React from 'react';
import { Users, Plus, Upload } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import MemberProfileModal from './MemberProfileModal';
import PageHeader from './PageHeader';
import { useMembersLogic } from '../hooks/useMembersLogic';
import MemberFilters from './MemberFilters';
import MemberList from './MemberList';
import MemberForm from './MemberForm';

export default function MembersPage({ isAdminModeActive }: { isAdminModeActive?: boolean }) {
  const {
    members,
    games,
    isAdding, setIsAdding,
    editingId, setEditingId,
    viewingMember, setViewingMember,
    searchTerm, setSearchTerm,
    genderFilter, setGenderFilter,
    semesterFilter, setSemesterFilter,
    genreFilter, setGenreFilter,
    itemToDelete, setItemToDelete,
    currentTab, setCurrentTab,
    formData, setFormData,
    fileInputRef,
    handleFileUpload,
    handleSubmit,
    handleDelete,
    handleBulkDormant,
    handleBulkDormantSemesterChange,
    handleBulkRestoreActive,
    resetForm,
    filteredMembers,
    semesters,
    selectedDocs,
    setSelectedDocs,
  } = useMembersLogic();

  return (
    <div className="space-y-6">
      <PageHeader 
        title="동아리원 관리" 
        subtitle="Database / Members Registry" 
        icon={Users}
        stats={{
          label: currentTab === '활동' ? '활동 인원' : '휴면 인원',
          value: filteredMembers.length,
        }}
        actions={
          <div className="flex flex-wrap gap-2 md:gap-3 w-full md:w-auto justify-end">
            {isAdminModeActive && (
              <>
                <input 
                  type="file" 
                  accept=".csv" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  className="hidden" 
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 md:gap-2 px-3 py-2 md:px-5 md:py-2.5 bg-white text-navy hover:bg-slate-50 border border-slate-200 rounded-xl transition-all shadow-sm text-xs font-bold whitespace-nowrap"
                >
                  <Upload size={16} className="shrink-0" /> <span className="hidden sm:inline">일괄 추가</span><span className="sm:hidden">업로드</span>
                </button>
              </>
            )}
            <button 
              onClick={() => { setIsAdding(true); setEditingId(null); resetForm(); }}
              className="flex items-center gap-1 md:gap-2 px-3 py-2 md:px-5 md:py-2.5 bg-navy hover:bg-gold text-white rounded-xl transition-all shadow-lg text-xs font-bold whitespace-nowrap"
            >
              <Plus size={16} className="shrink-0" /> <span className="hidden sm:inline">멤버 추가</span><span className="sm:hidden">추가</span>
            </button>
          </div>
        }
      />

      <MemberFilters
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        genderFilter={genderFilter}
        setGenderFilter={setGenderFilter}
        semesterFilter={semesterFilter}
        setSemesterFilter={setSemesterFilter}
        semesters={semesters}
        genreFilter={genreFilter}
        setGenreFilter={setGenreFilter}
      />

      <AnimatePresence>
        {isAdding && !editingId && (
          <MemberForm
            formData={formData}
            setFormData={setFormData}
            handleSubmit={handleSubmit}
            setIsAdding={setIsAdding}
            resetForm={resetForm}
            editingId={editingId}
          />
        )}
      </AnimatePresence>

      <MemberList
        filteredMembers={filteredMembers}
        editingId={editingId}
        setEditingId={setEditingId}
        setViewingMember={setViewingMember}
        setItemToDelete={setItemToDelete}
        setFormData={setFormData}
        setIsAdding={setIsAdding}
        formData={formData}
        handleSubmit={handleSubmit}
        resetForm={resetForm}
        isAdminModeActive={isAdminModeActive || false}
        selectedDocs={selectedDocs}
        setSelectedDocs={setSelectedDocs}
        handleBulkDormant={handleBulkDormant}
        handleBulkDormantSemesterChange={handleBulkDormantSemesterChange}
        handleBulkRestoreActive={handleBulkRestoreActive}
        currentTab={currentTab}
      />

      <ConfirmDeleteModal 
        isOpen={!!itemToDelete}
        title="멤버 삭제"
        message={`'${itemToDelete?.name}' 멤버를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`}
        onConfirm={handleDelete}
        onCancel={() => setItemToDelete(null)}
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
