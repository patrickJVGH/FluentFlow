
import React, { useState } from 'react';
import { Phrase } from '../types';
import { Eye, EyeOff, Volume2, BookMarked } from 'lucide-react';

interface PhraseCardProps {
  phrase: Phrase;
  onSpeak: () => void;
  isSpeaking: boolean;
}

export const PhraseCard: React.FC<PhraseCardProps> = ({ phrase, onSpeak, isSpeaking }) => {
  const [showTranslation, setShowTranslation] = useState(false);

  return (
    <div className="w-full bg-white rounded-[24px] shadow-lg shadow-gray-100 border border-gray-100 p-6 flex flex-col items-center relative transition-all">
      
      {/* Header Info - Discrete */}
      <div className="w-full flex items-center justify-between mb-8 opacity-80">
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
      <div className="w-full text-center mb-8 px-2">
        <h2 className="text-3xl md:text-4xl font-extrabold text-gray-800 leading-tight tracking-tight">
          {phrase.english}
        </h2>
      </div>

      {/* Actions */}
      <div className="flex flex-col items-center gap-6 w-full">
        
        {/* Listen Button */}
        <button 
          onClick={onSpeak}
          disabled={isSpeaking}
          className={`
            group flex items-center gap-2 px-5 py-2.5 rounded-full transition-all duration-200 active:scale-95
            ${isSpeaking 
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' 
              : 'bg-white text-indigo-600 border border-indigo-100 hover:border-indigo-300 hover:bg-indigo-50'}
          `}
        >
          <Volume2 className={`w-4 h-4 ${isSpeaking ? 'animate-pulse' : ''}`} />
          <span className="text-xs font-bold uppercase tracking-widest">{isSpeaking ? 'Ouvindo...' : 'Ouvir Frase'}</span>
        </button>

        {/* Translation Section - Clean Division */}
        <div className="w-full pt-6 border-t border-gray-50 flex flex-col items-center">
            {showTranslation && (
                <div className="mb-3 animate-fade-in-up">
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
