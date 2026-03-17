
import React from 'react';
import { BookOpen, MessageCircle, Sparkles, Type, ChevronRight } from 'lucide-react';
import { AppMode } from '../types';

interface ModeSelectorProps {
  onSelectMode: (mode: AppMode) => void;
  userName: string;
}

const MODES = [
  {
    id: 'course' as AppMode,
    title: 'Jornada 1k Frases',
    description: 'Domine as 1000 estruturas mais essenciais.',
    icon: <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />,
    lightColor: 'bg-indigo-50',
    textColor: 'text-indigo-600'
  },
  {
    id: 'conversation' as AppMode,
    title: 'Conversação',
    description: 'Fale livremente com a EVE.',
    icon: <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6" />,
    lightColor: 'bg-emerald-50',
    textColor: 'text-emerald-600'
  },
  {
    id: 'practice' as AppMode,
    title: 'Tópicos',
    description: 'Pratique situações reais.',
    icon: <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />,
    lightColor: 'bg-amber-50',
    textColor: 'text-amber-600'
  },
  {
    id: 'words' as AppMode,
    title: 'Vocabulário',
    description: 'Foque em palavras isoladas.',
    icon: <Type className="w-5 h-5 sm:w-6 sm:h-6" />,
    lightColor: 'bg-rose-50',
    textColor: 'text-rose-600'
  }
];

export const ModeSelector: React.FC<ModeSelectorProps> = ({ onSelectMode, userName }) => {
  return (
    <div className="flex-1 flex flex-col py-6 animate-fade-in-up overflow-y-auto custom-scrollbar">
      <div className="mb-6 sm:mb-8">
        <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
          Olá, {userName}! 👋
        </h2>
        <p className="text-slate-400 text-sm font-medium">O que vamos praticar hoje?</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pb-8">
        {MODES.map((mode) => (
          <button
            key={mode.id}
            onClick={() => onSelectMode(mode.id)}
            className="flex flex-col p-4 sm:p-5 bg-white rounded-[24px] sm:rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-indigo-100/50 transition-all text-left active:scale-[0.97]"
          >
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl ${mode.lightColor} ${mode.textColor} flex items-center justify-center mb-3 sm:mb-4`}>
              {mode.icon}
            </div>
            
            <div className="flex-1">
              <h3 className="font-bold text-slate-800 text-sm sm:text-base leading-tight">{mode.title}</h3>
              <p className="text-slate-400 text-[10px] sm:text-xs mt-1 leading-relaxed">{mode.description}</p>
            </div>
          </button>
        ))}
      </div>
      
      <div className="mt-auto py-4 text-center">
        <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Seu progresso é salvo localmente</p>
      </div>
    </div>
  );
};
