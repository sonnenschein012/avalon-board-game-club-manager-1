import React from 'react';
import { Dices, Plus, Trash2, Loader2, FileUp } from 'lucide-react';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import PageHeader from './PageHeader';
import { useGamesLogic } from '../hooks/useGamesLogic';
import GameFilters from './GameFilters';
import GameForm from './GameForm';
import GameList from './GameList';

interface GamesPageProps {
  isAdminModeActive?: boolean;
}

export default function GamesPage({ isAdminModeActive = false }: GamesPageProps) {
  const {
    filteredGames,
    isAdding, setIsAdding,
    editingId,
    formData, setFormData,
    importing,
    itemToDelete, setItemToDelete,
    searchTerm, setSearchTerm,
    genreFilter, setGenreFilter,
    difficultyFilter, setDifficultyFilter,
    playerCount, setPlayerCount,
    playerCountType, setPlayerCountType,
    sortOrder, setSortOrder,
    isDeleteAllModalOpen, setIsDeleteAllModalOpen,
    getPlayCount,
    handleFileUpload,
    handleSubmit,
    handleDelete,
    handleDeleteAll,
    startAdding,
    startEditing,
    gameSaving,
    gameDeleting,
    gamesDeletingAll,
  } = useGamesLogic();

  return (
    <div className="space-y-6">
      <PageHeader 
        title="게임 라이브러리" 
        subtitle="Database / Games Catalog" 
        icon={Dices}
        stats={{ label: "총 게임 수", value: filteredGames.length }}
        actions={
          <div className="flex flex-wrap gap-2 md:gap-3 w-full md:w-auto justify-end">
            {isAdminModeActive && (
              <label className="flex items-center gap-2 px-3 py-2 md:px-5 md:py-2.5 bg-slate-50 text-navy hover:text-gold rounded-xl hover:bg-indigo-100 transition-all shadow-sm text-xs font-bold cursor-pointer border border-slate-100">
                {importing ? <Loader2 size={16} className="animate-spin shrink-0" /> : <FileUp size={16} className="shrink-0" />} 
                <span className="hidden sm:inline">{importing ? '임포트 중...' : '파일 업로드'}</span>
                <span className="sm:hidden">업로드</span>
                <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} disabled={importing} />
              </label>
            )}
            {isAdminModeActive && (
              <button 
                onClick={() => setIsDeleteAllModalOpen(true)}
                className="flex items-center gap-1 px-3 py-2 md:px-5 md:py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-all shadow-sm text-xs font-bold border border-red-100"
              >
                <Trash2 size={16} className="shrink-0" /> <span className="hidden sm:inline">전체 삭제</span><span className="sm:hidden">삭제</span>
              </button>
            )}
            <button 
              onClick={startAdding}
              className="flex items-center gap-2 px-3 py-2 md:px-5 md:py-2.5 bg-navy hover:bg-gold text-white rounded-xl transition-all shadow-lg text-xs font-bold"
            >
              <Plus size={16} className="shrink-0" /> <span className="hidden sm:inline">게임 추가</span><span className="sm:hidden">추가</span>
            </button>
          </div>
        }
      />

      <GameFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        genreFilter={genreFilter}
        setGenreFilter={setGenreFilter}
        difficultyFilter={difficultyFilter}
        setDifficultyFilter={setDifficultyFilter}
        playerCountType={playerCountType}
        setPlayerCountType={setPlayerCountType}
        playerCount={playerCount}
        setPlayerCount={setPlayerCount}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
      />

      <GameForm
        formData={formData}
        setFormData={setFormData}
        handleSubmit={handleSubmit}
        isAdding={isAdding}
        setIsAdding={setIsAdding}
        editingId={editingId}
        saving={gameSaving}
      />

      <GameList
        filteredGames={filteredGames}
        getPlayCount={getPlayCount}
        onEdit={startEditing}
        setItemToDelete={setItemToDelete}
      />
      
      <ConfirmDeleteModal 
        isOpen={!!itemToDelete}
        title="게임 삭제"
        message={`'${itemToDelete?.title}' 게임을 삭제하시겠습니까?`}
        onConfirm={handleDelete}
        onCancel={() => setItemToDelete(null)}
        busy={gameDeleting}
      />

      <ConfirmDeleteModal 
        isOpen={isDeleteAllModalOpen}
        title="전체 게임 삭제"
        message="정말 모든 게임을 삭제하시겠습니까?"
        onConfirm={handleDeleteAll}
        onCancel={() => setIsDeleteAllModalOpen(false)}
        busy={gamesDeletingAll}
        busyLabel="전체 삭제 중…"
      />
    </div>
  );
}
