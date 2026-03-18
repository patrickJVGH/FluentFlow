
import React, { useState } from 'react';
import { Phrase } from '../types';
import { Eye, Volume2, BookMarked } from 'lucide-react';

interface PhraseCardProps {
  phrase: Phrase;
  onSpeak: () => void;
  isSpeaking: boolean;
}

export const PhraseCard: React.FC<PhraseCardProps> = ({ phrase, onSpeak, isSpeaking }) => {
  const [showTranslation, setShowTranslation] = useState(false);
  const englishText = phrase.english?.trim() || 'Phrase unavailable right now.';
  const portugueseText = phrase.portuguese?.trim() || 'Traducao indisponivel.';
  const hasPhraseText = Boolean(phrase.english?.trim());

  return (
    <div className="w-full bg-white rounded-[28px] sm:rounded-[40px] p-5 sm:p-8 flex flex-col items-center relative transition-all animate-fade-in-up border border-slate-100 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
      
      <div className="w-full flex items-center justify-between mb-4 sm:mb-8">
        <span className={`px-2.5 py-1 rounded-xl text-[8px] sm:text-[10px] font-black uppercase tracking-widest ${
          phrase.difficulty === 'easy' ? 'bg-emerald-50 text-emerald-600' : 
          phrase.difficulty === 'medium' ? 'bg-amber-50 text-amber-600' : 
          'bg-rose-50 text-rose-600'
        }`}>
          {phrase.difficulty}
        </span>
        <span className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
          <BookMarked className="w-3 h-3" /> {phrase.category || 'Geral'}
        </span>
      </div>

      <div className="w-full text-center mb-6 sm:mb-10 min-h-[60px] sm:min-h-[100px] flex items-center justify-center gap-3">
        <h2 className="text-lg sm:text-2xl md:text-3xl font-extrabold text-slate-800 leading-tight tracking-tight px-2">
          {englishText}
        </h2>
        <button 
          onClick={(e) => { e.stopPropagation(); onSpeak(); }}
          className={`p-2 sm:p-3 rounded-full shrink-0 transition-all border ${isSpeaking ? 'bg-rose-50 text-rose-500 border-rose-100 animate-pulse' : 'bg-slate-50 text-slate-500 border-slate-200 hover:text-indigo-500 hover:bg-indigo-50 hover:border-indigo-100'}`}
        >
          <Volume2 className="w-4 h-4 sm:w-6 sm:h-6" />
        </button>
      </div>

      {!hasPhraseText && (
        <p className="w-full -mt-3 mb-5 text-center text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
          A frase desta etapa veio vazia. O app exibiu um fallback para evitar tela em branco.
        </p>
      )}

      <div className="flex flex-col items-center gap-3 sm:gap-6 w-full">
        <button 
          onClick={onSpeak} 
          className={`w-full sm:w-auto px-8 py-3.5 rounded-2xl sm:rounded-[24px] font-bold text-xs sm:text-sm active:scale-95 transition-all shadow-lg ${
            isSpeaking ? 'bg-rose-50 text-rose-500' : 'bg-indigo-50 text-indigo-600 shadow-indigo-100'
          }`}
        >
          {isSpeaking ? 'Ouvindo...' : 'Ouvir Guia'}
        </button>

        <div className="w-full pt-4 sm:pt-8 border-t border-slate-50 flex flex-col items-center min-h-[60px] justify-center">
            {showTranslation ? (
                <div className="animate-fade-in-up text-center">
                    <p className="text-sm sm:text-lg text-slate-500 font-medium italic">
                        "{portugueseText}"
                    </p>
                    <button onClick={() => setShowTranslation(false)} className="text-[8px] font-black text-slate-400 uppercase mt-2">Ocultar</button>
                </div>
            ) : (
                <button 
                  onClick={() => setShowTranslation(true)} 
                  className="text-[9px] font-black text-slate-500 hover:text-indigo-500 uppercase tracking-widest flex items-center gap-2"
                >
                  <Eye className="w-3.5 h-3.5" /> Ver Tradução
                </button>
            )}
        </div>
      </div>
    </div>
  );
};
