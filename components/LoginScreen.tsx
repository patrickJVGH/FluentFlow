
import React, { useState } from 'react';
import { UserProfile } from '../types';
import { Logo } from './Logo';
import { User, Plus, Shield, UserX, ChevronRight, LogIn } from 'lucide-react';

interface LoginScreenProps {
  users: UserProfile[];
  onLogin: (user: UserProfile) => void;
  onCreateNew: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ users, onLogin, onCreateNew }) => {
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [error, setError] = useState('');

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminUser === 'ADMIN' && adminPass === '123456') {
      onLogin({ id: 'admin', name: 'Administrador', avatarColor: 'bg-slate-800', joinedDate: Date.now(), role: 'admin' });
    } else { setError('Credenciais inválidas'); }
  };

  const handleGuestLogin = () => {
    // Creating a persistent guest profile
    onLogin({ 
      id: `guest_${Date.now()}`, 
      name: `Visitante`, 
      avatarColor: 'bg-slate-400', 
      joinedDate: Date.now(), 
      role: 'guest' 
    });
  };

  if (showAdminLogin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl p-8 border border-slate-100 animate-fade-in-up">
          <div className="flex flex-col items-center mb-8">
            <Logo size={48} className="mb-4" />
            <h2 className="text-xl font-black text-slate-800">Acesso Admin</h2>
          </div>
          <form onSubmit={handleAdminSubmit} className="space-y-4">
            <input type="text" value={adminUser} onChange={e => setAdminUser(e.target.value)} className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-semibold text-sm" placeholder="Usuário" />
            <input type="password" value={adminPass} onChange={e => setAdminPass(e.target.value)} className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-semibold text-sm" placeholder="Senha" />
            {error && <p className="text-rose-500 text-[10px] font-bold text-center uppercase tracking-widest">{error}</p>}
            <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100">Entrar</button>
            <button type="button" onClick={() => setShowAdminLogin(false)} className="w-full text-slate-400 text-xs font-bold hover:text-slate-600 py-2">Voltar</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-[400px] bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col animate-fade-in-up">
        
        <div className="bg-white px-8 pt-12 pb-12 text-center">
          <Logo size={64} className="mx-auto mb-6" />
          <h1 className="text-2xl font-black text-slate-800 tracking-tight mb-2">FluentFlow</h1>
          <p className="text-slate-400 text-sm font-medium leading-relaxed">Desenvolva sua fluidez conversando<br/>com nossa inteligência artificial.</p>
        </div>

        <div className="px-8 pb-12 space-y-4">
          <button onClick={onCreateNew} className="w-full bg-indigo-600 text-white p-5 rounded-3xl shadow-xl shadow-indigo-100 flex items-center justify-between group transition-all hover:bg-indigo-700">
             <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center"><Plus className="w-5 h-5" /></div>
                <span className="font-bold text-lg">Criar Perfil</span>
             </div>
             <ChevronRight className="w-5 h-5 opacity-50" />
          </button>

          <div className="pt-6">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-4 ml-1">Perfis Salvos</p>
            <div className="space-y-3 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
              {users.length === 0 ? (
                <div className="py-8 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-100">
                   <p className="text-xs font-bold text-slate-300">Nenhum perfil ainda</p>
                </div>
              ) : (
                users.map(user => (
                  <button key={user.id} onClick={() => onLogin(user)} className="w-full bg-slate-50/60 p-4 rounded-2xl flex items-center gap-4 hover:bg-slate-100 transition-colors group">
                    <div className={`w-10 h-10 rounded-2xl ${user.avatarColor} flex items-center justify-center text-white font-black text-xs shadow-sm`}>{user.name ? user.name.charAt(0).toUpperCase() : 'V'}</div>
                    <span className="font-bold text-slate-600 flex-1 text-left">{user.name || 'Visitante'}</span>
                    <LogIn className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-all" />
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="pt-8 flex flex-col gap-4">
            <button onClick={handleGuestLogin} className="w-full flex items-center justify-center gap-2 text-slate-400 font-bold py-2 hover:text-indigo-600 transition-colors text-sm">
              <span>Continuar como Visitante</span>
            </button>
            <button onClick={() => setShowAdminLogin(true)} className="flex items-center justify-center gap-2 text-[10px] text-slate-300 hover:text-slate-500 font-black uppercase tracking-widest">
              <Shield className="w-3 h-3" /> Admin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
