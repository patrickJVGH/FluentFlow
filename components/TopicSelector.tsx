import React, { useState } from 'react';
import { TOPICS } from '../types';
import { Search, X, ChevronRight, Sparkles } from 'lucide-react';

interface TopicSelectorProps {
  onSelect: (topic: string) => void;
  onClose: () => void;
}

const safeAreaOverlayStyle: React.CSSProperties = {
  boxSizing: 'border-box',
  paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)',
  paddingRight: 'calc(env(safe-area-inset-right, 0px) + 0.75rem)',
  paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)',
  paddingLeft: 'calc(env(safe-area-inset-left, 0px) + 0.75rem)',
};

export const TopicSelector: React.FC<TopicSelectorProps> = ({ onSelect, onClose }) => {
  const [search, setSearch] = useState('');

  const filteredTopics = TOPICS.filter(t =>
    t.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-3 sm:p-4 animate-fade-in-up" style={safeAreaOverlayStyle}>
      <div className="bg-white w-full max-w-md rounded-[28px] sm:rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]">
        <div className="px-5 sm:px-8 pt-5 sm:pt-8 pb-3 sm:pb-4 flex items-center justify-between gap-3 shrink-0">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">Escolha um Topico</h2>
            <p className="text-slate-400 text-xs sm:text-sm font-medium">O que voce quer praticar agora?</p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition-colors">
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        <div className="px-5 sm:px-8 mb-3 sm:mb-4 shrink-0">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
            <input
              type="text"
              placeholder="Buscar topico..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-11 pr-4 text-base sm:text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4 sm:pb-8 custom-scrollbar">
          <div className="grid grid-cols-1 gap-2">
            {filteredTopics.map((topic, i) => (
              <button
                key={i}
                onClick={() => onSelect(topic)}
                className="group flex items-center justify-between p-4 bg-white hover:bg-indigo-50/50 rounded-2xl transition-all border border-transparent hover:border-indigo-100"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-all">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <span className="font-bold text-slate-700 text-sm text-left">{topic}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-transform group-hover:translate-x-1" />
              </button>
            ))}

            {filteredTopics.length === 0 && (
              <div className="py-10 text-center">
                <p className="text-slate-400 text-sm font-medium">Nenhum topico encontrado.</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-50 px-5 sm:px-8 py-3 sm:py-4 text-center shrink-0">
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
            A IA ira gerar frases personalizadas para voce
          </p>
        </div>
      </div>
    </div>
  );
};
