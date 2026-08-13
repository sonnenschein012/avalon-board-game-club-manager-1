import React from 'react';
import { Gamepad2, Hash, Edit2, Trash2 } from 'lucide-react';
import { Game } from '../types';

interface GameListProps {
  filteredGames: Game[];
  getPlayCount: (game: Game) => number;
  setEditingId: (id: string | null) => void;
  setFormData: React.Dispatch<React.SetStateAction<{ title: string, minPlayers: number, maxPlayers: number, bestMinPlayers: number, bestMaxPlayers: number, complexity: number, memo: string, genres: string[] }>>;
  setIsAdding: (val: boolean) => void;
  setItemToDelete: (val: { id: string, title: string }) => void;
}

export default function GameList({
  filteredGames,
  getPlayCount,
  setEditingId,
  setFormData,
  setIsAdding,
  setItemToDelete
}: GameListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {filteredGames.map(game => (
        <div key={game.id} className="glass-panel p-5 hover:border-gold transition-all group relative overflow-hidden border border-slate-100">
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
              onClick={() => { setEditingId(game.id); setFormData({ title: game.title || '', minPlayers: game.minPlayers || 2, maxPlayers: game.maxPlayers || 4, bestMinPlayers: game.bestMinPlayers || game.minPlayers || 2, bestMaxPlayers: game.bestMaxPlayers || game.maxPlayers || 4, complexity: game.complexity || 1.0, memo: game.memo || '', genres: game.genres || [] }); setIsAdding(true); }}
              className="p-1.5 bg-slate-50 border border-transparent rounded-lg text-slate-400 hover:bg-slate-100 hover:text-gold transition-colors"
            ><Edit2 size={14} /></button>
            <button onClick={() => setItemToDelete({ id: game.id, title: game.title })} className="p-1.5 bg-slate-50 border border-transparent rounded-lg text-slate-400 hover:bg-slate-100 hover:text-crimson transition-colors"><Trash2 size={14} /></button>
          </div>
        </div>
      ))}
      {filteredGames.length === 0 && (
        <div className="col-span-full h-40 flex items-center justify-center text-slate-300 font-bold uppercase tracking-widest text-xs">
          해당하는 게임이 없습니다.
        </div>
      )}
    </div>
  );
}
