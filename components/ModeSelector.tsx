
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
    description: 'Aprenda as 1000 estruturas mais usadas no inglês do dia a dia.',
    icon: <BookOpen className="w-6 h-6" />,
    color: 'bg-indigo-500',
    lightColor: 'bg-indigo-50',
    textColor: 'text-indigo-600'
  },
  {
    id: 'conversation' as AppMode,
    title: 'Conversação Livre',
    description: 'Converse naturalmente com a EVE e receba correções em tempo real.',
    icon: <MessageCircle className="w-6 h-6" />,
    color: 'bg-emerald-500',
    lightColor: 'bg-emerald-50',
    textColor: 'text-emerald-600'
  },
  {
    id: 'practice' as AppMode,
    title: 'Prática por Tópico',
    description: 'Treine situações específicas como aeroporto, compras ou trabalho.',
    icon: <Sparkles className="w-6 h-6" />,
    color: 'bg-amber-500',
    lightColor: 'bg-amber-50',
    textColor: 'text-amber-600'
  },
  {
    id: 'words' as AppMode,
    title: 'Desafio de Palavras',
    description: 'Foque na pronúncia de palavras isoladas e sons desafiadores.',
    icon: <Type className="w-6 h-6" />,
    color: 'bg-rose-500',
    lightColor: 'bg-rose-50',
    textColor: 'text-rose-600'
  }
];

export const ModeSelector: React.FC<ModeSelectorProps> = ({ onSelectMode, userName }) => {
  return (
    <div className="flex-1 flex flex-col p-6 animate-fade-in-up overflow-y-auto custom-scrollbar">
      <div className="mb-8">
        <h2 className="text-2xl font-black text-slate-800 tracking-tight">
          Olá, {userName}! 👋
        </h2>
        <p className="text-slate-400 font-medium">O que vamos praticar hoje?</p>
      </div>

      <div className="grid grid-cols-1 gap-4 pb-10">
        {MODES.map((mode) => (
          <button
            key={mode.id}
            onClick={() => onSelectMode(mode.id)}
            className="group relative flex items-center gap-5 p-5 bg-white rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-indigo-100 transition-all text-left active:scale-[0.98]"
          >
            <div className={`w-14 h-14 shrink-0 rounded-2xl ${mode.lightColor} ${mode.textColor} flex items-center justify-center transition-transform group-hover:scale-110`}>
              {mode.icon}
            </div>
            
            <div className="flex-1">
              <h3 className="font-bold text-slate-800 text-lg leading-tight">{mode.title}</h3>
              <p className="text-slate-400 text-xs mt-1 leading-relaxed">{mode.description}</p>
            </div>

            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
              <ChevronRight className="w-5 h-5" />
            </div>
          </button>
        ))}
      </div>
      
      <div className="mt-auto py-6 text-center">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Seu progresso é salvo automaticamente</p>
      </div>
    </div>
  );
};
