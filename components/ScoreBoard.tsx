
import React from 'react';
import { GameState } from '../types';
import { Trophy, Flame } from 'lucide-react';

interface ScoreBoardProps {
  state: GameState;
  totalPhrases: number;
}

export const ScoreBoard: React.FC<ScoreBoardProps> = ({ state, totalPhrases }) => {
  const progress = totalPhrases > 0 ? (state.phrasesCompleted / totalPhrases) * 100 : 0;

  return (
    <div className="w-full flex items-center gap-4 bg-white px-3 py-2 rounded-2xl border border-slate-200 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      <div className="flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-100 shadow-sm">
        <Trophy className="w-3.5 h-3.5 text-amber-400" />
        <span className="font-black text-xs text-slate-700">{state.score}</span>
      </div>

      <div className="flex-1 h-2.5 bg-slate-200 rounded-full overflow-hidden">
        <div 
          className="h-full bg-indigo-500 rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(79,70,229,0.3)]"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center gap-2 bg-orange-50 px-3 py-1.5 rounded-xl border border-orange-100 shadow-sm">
        <Flame className={`w-3.5 h-3.5 ${state.streak > 0 ? 'text-orange-500' : 'text-slate-300'}`} />
        <span className={`font-black text-xs ${state.streak > 0 ? 'text-slate-700' : 'text-slate-400'}`}>
            {state.streak}
        </span>
      </div>
    </div>
  );
};
