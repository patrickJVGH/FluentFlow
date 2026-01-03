
import React, { useState } from 'react';
import { Phrase } from '../types';
import { Eye, EyeOff, Volume2, BookMarked, Square } from 'lucide-react';

interface PhraseCardProps {
  phrase: Phrase;
  onSpeak: () => void;
  isSpeaking: boolean;
}

export const PhraseCard: React.FC<PhraseCardProps> = ({ phrase, onSpeak, isSpeaking }) => {
  const [showTranslation, setShowTranslation] = useState(false);

  return (
    <div className="w-full bg-white rounded-[40px] p-8 flex flex-col items-center relative transition-all animate-fade-in-up border border-slate-50 shadow-sm">
      
      <div className="w-full flex items-center justify-between mb-8">
        <span className={`px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest ${
          phrase.difficulty === 'easy' ? 'bg-emerald-50 text-emerald-600' : 
          phrase.difficulty === 'medium' ? 'bg-amber-50 text-amber-600' : 
          'bg-rose-50 text-rose-600'
        }`}>
          {phrase.difficulty}
        </span>
        {phrase.category && (
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
            <BookMarked className="w-3.5 h-3.5" /> {phrase.category}
          </span>
        )}
      </div>

      <div className="w-full text-center mb-10 min-h-[100px] flex items-center justify-center gap-4 group">
        <h2 className="text-3xl md:text-4xl font-extrabold text-slate-800 leading-tight tracking-tight">
          {phrase.english}
        </h2>
        <button 
          onClick={(e) => { 
            e.preventDefault();
            e.stopPropagation(); 
            onSpeak(); 
          }}
          className={`p-3 rounded-full transition-all shrink-0 ${isSpeaking ? 'bg-rose-100 text-rose-500 animate-pulse' : 'bg-slate-50 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50'}`}
          title="Ouvir Pronúncia"
        >
          <Volume2 className="w-6 h-6" />
        </button>
      </div>

      <div className="flex flex-col items-center gap-6 w-full">
        <button 
          onClick={(e) => { e.preventDefault(); onSpeak(); }} 
          className={`flex items-center gap-3 px-10 py-4.5 rounded-[24px] transition-all font-bold text-sm tracking-tight active:scale-95 ${
            isSpeaking ? 'bg-rose-50 text-rose-500 shadow-rose-100' : 'bg-indigo-50 text-indigo-600 shadow-indigo-100'
          } shadow-xl`}
        >
          {isSpeaking ? <Square className="w-4 h-4 fill-current" /> : <Volume2 className="w-4 h-4" />}
          {isSpeaking ? 'Parar Áudio' : 'Ouvir Pronúncia'}
        </button>

        <div className="w-full pt-8 border-t border-slate-50/80 flex flex-col items-center">
            {showTranslation && (
                <div className="mb-4 animate-fade-in-up px-4">
                    <p className="text-xl text-slate-400 font-medium italic text-center leading-relaxed">
                        "{phrase.portuguese}"
                    </p>
                </div>
            )}
            <button onClick={() => setShowTranslation(!showTranslation)} className="text-[10px] font-black text-slate-300 hover:text-indigo-400 uppercase tracking-widest transition-colors flex items-center gap-2">
              {showTranslation ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showTranslation ? 'Ocultar' : 'Ver Tradução'}
            </button>
        </div>
      </div>
    </div>
  );
};
