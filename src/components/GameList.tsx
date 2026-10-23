import React, { useEffect, useId, useRef } from 'react';
import { Gamepad2, Hash, Edit2, Trash2 } from 'lucide-react';
import { Game } from '../types';

interface GameListProps {
  filteredGames: Game[];
  getPlayCount: (game: Game) => number;
  onEdit: (game: Game) => void;
  setItemToDelete: (val: { id: string, title: string }) => void;
  editingId?: string | null;
  renderEditForm?: (game: Game) => React.ReactNode;
}

export default function GameList({
  filteredGames,
  getPlayCount,
  onEdit,
  setItemToDelete,
  editingId = null,
  renderEditForm,
}: GameListProps) {
  const editorId = useId();
  const editorRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (editingId) editorRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [editingId]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {filteredGames.map((game, index) => (
        <React.Fragment key={game.id}>
        <div style={{ order: index * 2 }} className={`glass-panel p-5 hover:border-gold transition-all group relative overflow-hidden border ${editingId === game.id ? 'border-navy/40 ring-1 ring-navy/10' : 'border-slate-100'}`}>
          <div className="absolute -right-4 -top-4 w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Gamepad2 size={24} className="text-navy opacity-20" />
          </div>
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-black text-slate-800 uppercase tracking-tighter text-lg pr-2 leading-tight">{game.title}</h3>
            {getPlayCount(game) > 0 && (
              <div className="flex items-center gap-1 bg-amber-50 text-amber-600 px-2 py-1 rounded-md self-start shrink-0 border border-amber-100">
                <Hash size={10} strokeWidth={3} />
                <span className="text-[10px] font-black">{getPlayCount(game)}회 플레이</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-2 gap-4 border-t border-slate-50 pt-4 items-end">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">가능</p>
              <p className="text-xs font-black text-slate-700">{game.minPlayers === game.maxPlayers ? game.minPlayers : `${game.minPlayers}-${game.maxPlayers}`}명</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">적정</p>
              <p className="text-xs font-black text-emerald-600">{game.bestMinPlayers === game.bestMaxPlayers ? game.bestMinPlayers : `${game.bestMinPlayers}-${game.bestMaxPlayers}`}명</p>
            </div>
            <div className="col-span-2 pb-0.5">
              <p className="text-[10px] font-bold text-slate-400 uppercase">난이도</p>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-slate-500 rounded-full" 
                    style={{ width: `${((game.complexity ?? 0) / 5) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-black text-navy w-6 text-right">{Number(game.complexity).toFixed(1)}</span>
              </div>
            </div>
          </div>
          {game.memo && <p className="mt-4 text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-lg leading-tight">"{game.memo}"</p>}
          {game.genres && game.genres.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-4">
              {game.genres.map(genre => (
                <span key={genre} className="px-2 py-0.5 bg-slate-50 text-navy rounded-full text-[9px] font-black tracking-wider border border-slate-100">
                  {genre}
                </span>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-3 mt-4">
            <button 
              type="button"
              aria-label={`${game.title} 수정`}
              aria-expanded={editingId === game.id}
              aria-controls={editingId === game.id ? editorId : undefined}
              onClick={() => onEdit(game)}
              className="p-1.5 bg-slate-50 border border-transparent rounded-lg text-slate-400 hover:bg-slate-100 hover:text-gold transition-colors"
            ><Edit2 size={14} /></button>
            <button onClick={() => setItemToDelete({ id: game.id, title: game.title })} className="p-1.5 bg-slate-50 border border-transparent rounded-lg text-slate-400 hover:bg-slate-100 hover:text-crimson transition-colors"><Trash2 size={14} /></button>
          </div>
        </div>
        {editingId === game.id && renderEditForm && (
          <section
            id={editorId}
            ref={editorRef}
            aria-label={`${game.title} 수정`}
            className="col-span-full min-w-0 [order:var(--edit-order)] md:[order:var(--edit-order-md)] lg:[order:var(--edit-order-lg)]"
            // Keep the editor below the selected row at the grid's 1/2/4-column breakpoints.
            style={{
              '--edit-order': index * 2 + 1,
              '--edit-order-md': (Math.floor(index / 2) * 2 + 1) * 2 + 1,
              '--edit-order-lg': (Math.floor(index / 4) * 4 + 3) * 2 + 1,
            } as React.CSSProperties}
          >
            <h4 className="mb-2 text-sm font-semibold text-navy">{game.title} 수정</h4>
            {renderEditForm(game)}
          </section>
        )}
        </React.Fragment>
      ))}
      {filteredGames.length === 0 && (
        <div className="col-span-full h-40 flex items-center justify-center text-slate-300 font-bold uppercase tracking-widest text-xs">
          해당하는 게임이 없습니다.
        </div>
      )}
    </div>
  );
}
