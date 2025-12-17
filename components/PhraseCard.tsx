
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
    <div className="w-full bg-white rounded-[24px] shadow-lg shadow-gray-100 border border-gray-100 p-5 flex flex-col items-center relative transition-all">
      
      {/* Header Info - Discrete */}
      <div className="w-full flex items-center justify-between mb-4 opacity-80">
        <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
          phrase.difficulty === 'easy' ? 'bg-green-50 text-green-700' : 
          phrase.difficulty === 'medium' ? 'bg-yellow-50 text-yellow-700' : 
          'bg-red-50 text-red-700'
        }`}>
          {phrase.difficulty}
        </span>
        
        {phrase.category && (
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            <BookMarked className="w-3 h-3 text-gray-300" />
            {phrase.category}
          </span>
        )}
      </div>

      {/* Main Phrase - Hero */}
      <div className="w-full text-center mb-6 px-1">
        <h2 className="text-2xl md:text-3xl font-extrabold text-gray-800 leading-tight tracking-tight break-words">
          {phrase.english}
        </h2>
      </div>

      {/* Actions */}
      <div className="flex flex-col items-center gap-4 w-full">
        
        {/* Listen Button - Acts as STOP when speaking */}
        <button 
          onClick={onSpeak}
          // IMPORTANT: Removed disabled={isSpeaking} to allow stopping
          className={`
            group flex items-center gap-2 px-5 py-2.5 rounded-full transition-all duration-200 active:scale-95
            ${isSpeaking 
              ? 'bg-red-50 text-red-600 border border-red-200 shadow-md shadow-red-100 hover:bg-red-100' 
              : 'bg-white text-indigo-600 border border-indigo-100 hover:border-indigo-300 hover:bg-indigo-50'}
          `}
        >
          {isSpeaking ? (
             <Square className="w-4 h-4 fill-current" />
          ) : (
             <Volume2 className="w-4 h-4" />
          )}
          <span className="text-xs font-bold uppercase tracking-widest">{isSpeaking ? 'Parar Áudio' : 'Ouvir Frase'}</span>
        </button>

        {/* Translation Section - Clean Division */}
        <div className="w-full pt-4 border-t border-gray-50 flex flex-col items-center">
            {showTranslation && (
                <div className="mb-2 animate-fade-in-up">
                    <p className="text-base text-gray-600 font-medium italic text-center">
                        "{phrase.portuguese}"
                    </p>
                </div>
            )}
            
            <button
            onClick={() => setShowTranslation(!showTranslation)}
            className="flex items-center gap-1.5 text-[10px] font-bold text-gray-300 hover:text-indigo-500 transition-colors uppercase tracking-widest py-2"
            >
            {showTranslation ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            <span>{showTranslation ? 'Ocultar' : 'Ver Tradução'}</span>
            </button>
        </div>
      </div>
    </div>
  );
};
