
import React, { useState } from 'react';
import { UserProfile } from '../types';
import { User, Check, X } from 'lucide-react';

interface ProfileSetupProps {
  initialProfile?: UserProfile | null;
  onSave: (profile: Omit<UserProfile, 'id' | 'role'>) => void;
  onCancel?: () => void;
  existingNames?: string[];
}

const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-blue-500', 'bg-purple-500', 'bg-pink-500', 
  'bg-red-500', 'bg-orange-500', 'bg-green-500', 'bg-teal-500'
];

export const ProfileSetup: React.FC<ProfileSetupProps> = ({ initialProfile, onSave, onCancel, existingNames = [] }) => {
  const [name, setName] = useState(initialProfile?.role === 'guest' ? '' : (initialProfile?.name || ''));
  const [selectedColor, setSelectedColor] = useState(initialProfile?.avatarColor || AVATAR_COLORS[0]);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    
    if (!trimmedName) {
      setError('Por favor, digite seu nome.');
      return;
    }

    const isGuestPromoting = initialProfile?.role === 'guest';
    const nameChanged = initialProfile?.name !== trimmedName;

    if ((!initialProfile || nameChanged) && existingNames.includes(trimmedName) && !isGuestPromoting) {
        setError('Este nome já está em uso.');
        return;
    }

    onSave({
      name: trimmedName,
      avatarColor: selectedColor,
      joinedDate: initialProfile?.joinedDate || Date.now()
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 animate-fade-in-up font-sans">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden transform transition-all">
        
        {/* Simple Header */}
        <div className="bg-white px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">
              {initialProfile?.role === 'guest' ? 'Salvar Progresso' : initialProfile ? 'Editar Perfil' : 'Novo Perfil'}
            </h2>
            {onCancel && (
                <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-50 transition-colors">
                    <X className="w-5 h-5" />
                </button>
            )}
        </div>
        
        <div className="p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            
            {/* Main Focus: Name Input */}
            <div className="space-y-2 text-center">
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(''); }}
                placeholder="Seu nome"
                className="w-full px-4 py-4 rounded-xl bg-gray-50 border border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all outline-none text-gray-900 font-bold text-xl placeholder-gray-300 text-center"
                maxLength={12}
                autoFocus
              />
              {error && <p className="text-red-500 text-xs font-bold">{error}</p>}
            </div>

            {/* Secondary: Avatar Selection */}
            <div className="flex flex-col items-center gap-3 py-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Escolha uma cor</span>
                <div className="flex flex-wrap gap-3 justify-center">
                    {AVATAR_COLORS.map(color => (
                    <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedColor(color)}
                        className={`w-8 h-8 rounded-full ${color} transition-all hover:scale-110 flex items-center justify-center ring-2 ring-offset-2 ${selectedColor === color ? 'ring-gray-300 scale-110' : 'ring-transparent'}`}
                    >
                        {selectedColor === color && <Check className="w-4 h-4 text-white" />}
                    </button>
                    ))}
                </div>
            </div>

            {/* Action */}
            <button
              type="submit"
              className="w-full py-3.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 active:scale-95 text-sm"
            >
              {initialProfile?.role === 'guest' ? 'Criar Conta' : 'Salvar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
