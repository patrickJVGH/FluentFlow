
import React, { useState } from 'react';
import { UserProfile } from '../types';
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
      const adminProfile: UserProfile = {
        id: 'admin',
        name: 'Administrador',
        avatarColor: 'bg-gray-800',
        joinedDate: Date.now(),
        role: 'admin'
      };
      onLogin(adminProfile);
    } else {
      setError('Credenciais inválidas');
    }
  };

  const handleGuestLogin = () => {
    const randomId = Math.floor(1000 + Math.random() * 9000);
    const guestProfile: UserProfile = {
      id: `guest_${Date.now()}`,
      name: `User${randomId}`,
      avatarColor: 'bg-gray-400',
      joinedDate: Date.now(),
      role: 'guest'
    };
    onLogin(guestProfile);
  };

  if (showAdminLogin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans">
        <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl p-6 border border-gray-100 animate-fade-in-up">
          <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
            <div className="bg-indigo-50 p-2 rounded-lg">
                <Shield className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
                <h2 className="text-lg font-bold text-gray-800">Acesso Admin</h2>
                <p className="text-xs text-gray-500">Área restrita</p>
            </div>
          </div>
          <form onSubmit={handleAdminSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Usuário</label>
              <input 
                type="text" 
                value={adminUser}
                onChange={e => setAdminUser(e.target.value)}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-sm"
                placeholder="Nome de usuário"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Senha</label>
              <input 
                type="password" 
                value={adminPass}
                onChange={e => setAdminPass(e.target.value)}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-sm"
                placeholder="Senha"
              />
            </div>
            {error && <p className="text-red-500 text-xs font-bold text-center bg-red-50 p-2 rounded-lg">{error}</p>}
            
            <div className="pt-2 space-y-2">
                <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 active:scale-95 transition-all shadow-md shadow-indigo-100 text-sm">
                Acessar Painel
                </button>
                <button 
                type="button" 
                onClick={() => setShowAdminLogin(false)}
                className="w-full text-gray-400 text-xs font-semibold hover:text-gray-600 transition-colors py-2"
                >
                Cancelar
                </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-[380px] bg-white rounded-[32px] shadow-2xl overflow-hidden min-h-[650px] flex flex-col relative animate-fade-in-up">
        
        {/* Header Section - Compact & Modern */}
        <div className="bg-indigo-600 px-6 pt-10 pb-16 text-center relative overflow-hidden">
          <div className="absolute top-[-20%] right-[-10%] w-40 h-40 bg-white opacity-5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-[-10%] left-[-10%] w-32 h-32 bg-indigo-400 opacity-10 rounded-full blur-2xl"></div>
          
          <div className="relative z-10 flex flex-col items-center">
             <div className="bg-white/10 p-2.5 rounded-xl mb-3 backdrop-blur-sm shadow-inner ring-1 ring-white/20">
                 <User className="text-white w-6 h-6" />
             </div>
             <h1 className="text-xl font-bold text-white tracking-tight">FluentFlow</h1>
             <p className="text-indigo-200 text-[10px] font-semibold tracking-wider mt-1 uppercase">Pratique Inglês Falando</p>
          </div>
        </div>

        {/* Content Section - Curved Overlap */}
        <div className="flex-1 flex flex-col px-6 -mt-8 relative z-20 bg-white rounded-t-[32px]">
            
            <div className="pt-8 pb-4">
              {/* Primary Action: Create Profile */}
              <button 
                  onClick={onCreateNew}
                  className="w-full bg-white p-4 rounded-2xl shadow-lg shadow-indigo-100 flex items-center gap-4 hover:shadow-xl hover:translate-y-[-2px] transition-all group border border-indigo-50 relative overflow-hidden mb-8"
              >
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-500"></div>
                  <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors text-indigo-600 shrink-0 shadow-sm">
                      <Plus className="w-6 h-6" />
                  </div>
                  <div className="flex-1 text-left">
                      <span className="block font-bold text-gray-800 text-lg group-hover:text-indigo-700 transition-colors">Novo Perfil</span>
                      <span className="text-xs text-gray-400 font-medium">Começar do zero</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-indigo-500 transition-colors" />
              </button>

              {/* Users List Label */}
              <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Perfis Salvos</span>
              </div>

              {/* Scrollable User List */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar" style={{ maxHeight: '280px' }}>
                  {users.length === 0 ? (
                      <div className="text-center py-8 px-4 text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/50">
                          <p className="font-medium text-xs">Nenhum perfil encontrado</p>
                      </div>
                  ) : (
                      users.map(user => (
                          <button
                              key={user.id}
                              onClick={() => onLogin(user)}
                              className="w-full bg-gray-50/50 p-3 rounded-xl flex items-center gap-3 hover:bg-white hover:shadow-md border border-transparent hover:border-gray-100 transition-all active:scale-[0.98] group"
                          >
                              <div className={`w-9 h-9 rounded-full ${user.avatarColor} flex items-center justify-center text-white font-bold text-xs shadow-sm ring-2 ring-white group-hover:scale-105 transition-transform`}>
                                  {user.name.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-semibold text-gray-600 flex-1 text-left truncate group-hover:text-gray-900 text-sm">{user.name}</span>
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity text-indigo-500">
                                  <LogIn className="w-4 h-4" />
                              </div>
                          </button>
                      ))
                  )}
              </div>
            </div>

            {/* Secondary Actions */}
            <div className="mt-auto pb-6 border-t border-gray-50 pt-4 flex flex-col gap-3">
                <button 
                    onClick={handleGuestLogin}
                    className="w-full flex items-center justify-center gap-2 text-gray-500 font-semibold py-3 rounded-xl border border-gray-200 hover:bg-gray-50 hover:text-indigo-600 hover:border-indigo-200 transition-all active:bg-gray-100 text-sm"
                >
                    <UserX className="w-4 h-4" />
                    <span>Entrar como Visitante</span>
                </button>

                <button 
                    onClick={() => setShowAdminLogin(true)}
                    className="w-full flex items-center justify-center gap-1.5 text-[10px] text-gray-300 hover:text-gray-500 transition-colors font-medium uppercase tracking-wide py-2"
                >
                    <Shield className="w-3 h-3" />
                    <span>Admin</span>
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};
