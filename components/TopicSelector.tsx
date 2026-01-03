
import React, { useState } from 'react';
import { TOPICS } from '../types';
import { Search, X, ChevronRight, Sparkles } from 'lucide-react';

interface TopicSelectorProps {
  onSelect: (topic: string) => void;
  onClose: () => void;
}

export const TopicSelector: React.FC<TopicSelectorProps> = ({ onSelect, onClose }) => {
  const [search, setSearch] = useState('');

  const filteredTopics = TOPICS.filter(t => 
    t.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-fade-in-up">
      <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="px-8 pt-8 pb-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Escolha um Tópico</h2>
            <p className="text-slate-400 text-sm font-medium">O que você quer praticar agora?</p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Search */}
        <div className="px-8 mb-4 shrink-0">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Buscar tópico..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-11 pr-4 text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-6 pb-8 custom-scrollbar">
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
                  <span className="font-bold text-slate-700 text-sm">{topic}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-transform group-hover:translate-x-1" />
              </button>
            ))}
            
            {filteredTopics.length === 0 && (
              <div className="py-10 text-center">
                <p className="text-slate-400 text-sm font-medium">Nenhum tópico encontrado.</p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Info */}
        <div className="bg-slate-50 px-8 py-4 text-center shrink-0">
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
            A IA irá gerar frases personalizadas para você
          </p>
        </div>
      </div>
    </div>
  );
};
