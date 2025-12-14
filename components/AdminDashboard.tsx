
import React from 'react';
import { UserProfile, GameState } from '../types';
import { Trash2, LogOut, Shield, Users } from 'lucide-react';

interface AdminDashboardProps {
  users: UserProfile[];
  onDeleteUser: (userId: string) => void;
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ users, onDeleteUser, onLogout }) => {
  const getUserStats = (userId: string): GameState | null => {
    try {
      const data = localStorage.getItem(`fluentflow_progress_${userId}`);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="flex justify-between items-center mb-8 bg-white px-6 py-4 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg shadow-md shadow-indigo-200">
                <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">Painel Admin</h1>
                <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">Gestão de Usuários</p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="flex items-center gap-2 text-gray-500 hover:text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg transition-all font-semibold text-xs border border-gray-200 hover:border-red-100"
          >
            <LogOut className="w-3.5 h-3.5" /> Sair
          </button>
        </header>

        {/* Content */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-50 flex items-center gap-3">
            <Users className="w-4 h-4 text-gray-400" />
            <h2 className="font-bold text-gray-800 text-sm uppercase tracking-wide">Usuários Cadastrados <span className="text-gray-400 ml-1">({users.length})</span></h2>
          </div>
          
          {users.length === 0 ? (
            <div className="p-16 text-center text-gray-400 flex flex-col items-center">
                <Users className="w-10 h-10 mb-3 opacity-20" />
                <p className="font-medium text-sm">Nenhum usuário encontrado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Perfil</th>
                    <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Desde</th>
                    <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Progresso</th>
                    <th className="py-4 px-6 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map(user => {
                    const stats = getUserStats(user.id);
                    return (
                      <tr key={user.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full ${user.avatarColor} flex items-center justify-center text-white font-bold text-sm shadow-sm`}>
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <span className="block font-bold text-gray-900 text-sm">{user.name}</span>
                                <span className="text-[10px] text-gray-400 font-medium bg-gray-100 px-1.5 py-0.5 rounded uppercase">{user.role}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-xs font-medium text-gray-500">
                          {new Date(user.joinedDate).toLocaleDateString()}
                        </td>
                        <td className="py-4 px-6">
                           {stats ? (
                               <div className="flex flex-col gap-1">
                                   <div className="flex items-center gap-2">
                                     <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">Lvl {stats.currentLevel}</span>
                                   </div>
                                   <span className="text-[10px] text-gray-400 font-medium">{stats.score} XP</span>
                               </div>
                           ) : (
                               <span className="text-[10px] text-gray-300 font-medium italic">--</span>
                           )}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button 
                            onClick={() => {
                                if(window.confirm(`Tem certeza que deseja deletar ${user.name}?`)) {
                                    onDeleteUser(user.id);
                                }
                            }}
                            className="text-gray-300 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                            title="Deletar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
