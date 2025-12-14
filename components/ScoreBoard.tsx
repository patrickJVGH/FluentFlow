
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
    <div className="w-full max-w-[90%] mx-auto mb-4 flex items-center justify-between gap-4 py-2">
      
      {/* Score */}
      <div className="flex items-center gap-1.5 opacity-80">
        <Trophy className="w-3.5 h-3.5 text-yellow-500" />
        <span className="font-bold text-xs text-gray-600">{state.score}</span>
      </div>

      {/* Progress Bar */}
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div 
          className="h-full bg-indigo-500 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Streak */}
      <div className="flex items-center gap-1.5 opacity-80">
        <Flame className={`w-3.5 h-3.5 ${state.streak > 0 ? 'text-orange-500' : 'text-gray-300'}`} />
        <span className={`font-bold text-xs ${state.streak > 0 ? 'text-orange-600' : 'text-gray-300'}`}>
            {state.streak}
        </span>
      </div>
    </div>
  );
};
