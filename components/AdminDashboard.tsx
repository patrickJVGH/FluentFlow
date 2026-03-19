import React, { useEffect, useMemo, useState } from 'react';
import { UserProfile, GameState } from '../types';
import { Trash2, LogOut, Shield, Users, Activity, Bot, Mic, Sparkles, Type, Volume2 } from 'lucide-react';
import { AiUsageAction, AiUsageBucket, AiUsageTelemetry, readAiUsageTelemetry } from '../services/aiUsageTelemetry';

interface AdminDashboardProps {
  users: UserProfile[];
  onDeleteUser: (userId: string) => void;
  onLogout: () => void;
}

const safeAreaPageStyle: React.CSSProperties = {
  boxSizing: 'border-box',
  paddingTop: 'env(safe-area-inset-top, 0px)',
  paddingRight: 'env(safe-area-inset-right, 0px)',
  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  paddingLeft: 'env(safe-area-inset-left, 0px)',
};

const ESTIMATED_AUDIO_BYTES_PER_MINUTE = 240000;

const ACTION_META: Record<AiUsageAction, { label: string; icon: React.ReactNode }> = {
  conversation: { label: 'Conversa', icon: <Bot className="w-4 h-4 text-indigo-500" /> },
  pronunciation: { label: 'Pronuncia', icon: <Mic className="w-4 h-4 text-emerald-500" /> },
  speech: { label: 'TTS', icon: <Volume2 className="w-4 h-4 text-amber-500" /> },
  generatePhrases: { label: 'Frases', icon: <Sparkles className="w-4 h-4 text-fuchsia-500" /> },
  generateWords: { label: 'Palavras', icon: <Type className="w-4 h-4 text-rose-500" /> },
};

const formatBytes = (bytes: number): string => {
  if (bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const formatMinutes = (bytes: number): string => `${(bytes / ESTIMATED_AUDIO_BYTES_PER_MINUTE).toFixed(2)} min`;

const formatDateTime = (value: number | null): string => {
  if (!value) return '--';
  const date = new Date(value);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ users, onDeleteUser, onLogout }) => {
  const [aiUsage, setAiUsage] = useState<AiUsageTelemetry>(() => readAiUsageTelemetry());
  const getDisplayedLevel = (score: number) => Math.max(1, Math.floor(Math.max(0, score) / 100) + 1);

  useEffect(() => {
    const refresh = () => setAiUsage(readAiUsageTelemetry());
    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const getUserStats = (userId: string): GameState | null => {
    try {
      const data = localStorage.getItem(`fluentflow_progress_${userId}`);
      if (!data) return null;

      const parsed = JSON.parse(data);
      const score = Number(parsed?.score);
      if (!Number.isFinite(score)) return null;

      return {
        ...parsed,
        score: Math.max(0, Math.round(score)),
        currentLevel: getDisplayedLevel(score),
      };
    } catch {
      return null;
    }
  };

  const confirmDelete = (user: UserProfile) => {
    if (window.confirm(`Tem certeza que deseja deletar ${user.name}?`)) {
      onDeleteUser(user.id);
    }
  };

  const usageBuckets = useMemo(
    () => (Object.keys(ACTION_META) as AiUsageAction[]).map(action => aiUsage.buckets[action]),
    [aiUsage]
  );

  const usageTotals = useMemo(
    () =>
      usageBuckets.reduce(
        (acc, bucket) => ({
          calls: acc.calls + bucket.calls,
          successfulCalls: acc.successfulCalls + bucket.successfulCalls,
          failedCalls: acc.failedCalls + bucket.failedCalls,
          uploadedAudioBytes: acc.uploadedAudioBytes + bucket.uploadedAudioBytes,
          returnedAudioBytes: acc.returnedAudioBytes + bucket.returnedAudioBytes,
          requestTextChars: acc.requestTextChars + bucket.requestTextChars,
          responseTextChars: acc.responseTextChars + bucket.responseTextChars,
          itemsReturned: acc.itemsReturned + bucket.itemsReturned,
        }),
        {
          calls: 0,
          successfulCalls: 0,
          failedCalls: 0,
          uploadedAudioBytes: 0,
          returnedAudioBytes: 0,
          requestTextChars: 0,
          responseTextChars: 0,
          itemsReturned: 0,
        }
      ),
    [usageBuckets]
  );

  return (
    <div className="min-h-[100dvh] bg-gray-50 p-3 sm:p-6 font-sans overflow-y-auto" style={safeAreaPageStyle}>
      <div className="max-w-4xl mx-auto">
        <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-5 sm:mb-8 bg-white px-4 sm:px-6 py-4 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg shadow-md shadow-indigo-200">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">Painel Admin</h1>
              <p className="text-gray-400 text-[10px] sm:text-xs font-medium uppercase tracking-wide">Gestao de Usuarios</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full sm:w-auto flex items-center justify-center gap-2 text-gray-500 hover:text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg transition-all font-semibold text-xs border border-gray-200 hover:border-red-100"
          >
            <LogOut className="w-3.5 h-3.5" /> Sair
          </button>
        </header>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-50 flex items-center gap-3">
            <Users className="w-4 h-4 text-gray-400" />
            <h2 className="font-bold text-gray-800 text-xs sm:text-sm uppercase tracking-wide">
              Usuarios Cadastrados <span className="text-gray-400 ml-1">({users.length})</span>
            </h2>
          </div>

          {users.length === 0 ? (
            <div className="p-12 sm:p-16 text-center text-gray-400 flex flex-col items-center">
              <Users className="w-10 h-10 mb-3 opacity-20" />
              <p className="font-medium text-sm">Nenhum usuario encontrado.</p>
            </div>
          ) : (
            <>
              <div className="md:hidden divide-y divide-gray-100">
                {users.map(user => {
                  const stats = getUserStats(user.id);
                  return (
                    <div key={user.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-10 h-10 rounded-full ${user.avatarColor} flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0`}>
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 text-sm truncate">{user.name}</p>
                            <p className="text-[10px] text-gray-400 font-medium">{new Date(user.joinedDate).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => confirmDelete(user)}
                          className="text-red-500 p-2 rounded-lg bg-red-50 hover:bg-red-100 transition-colors shrink-0"
                          title="Deletar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-xs">
                        <span className="text-gray-500 uppercase tracking-wide">{user.role}</span>
                        {stats ? (
                          <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md">Lvl {stats.currentLevel} - {stats.score} XP</span>
                        ) : (
                          <span className="text-gray-300 italic">Sem progresso</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Perfil</th>
                      <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Desde</th>
                      <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Progresso</th>
                      <th className="py-4 px-6 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">Acao</th>
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
                          <td className="py-4 px-6 text-xs font-medium text-gray-500">{new Date(user.joinedDate).toLocaleDateString()}</td>
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
                              onClick={() => confirmDelete(user)}
                              className="text-gray-300 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
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
            </>
          )}
        </div>

        <section className="mt-5 sm:mt-8 bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-50 flex items-center gap-3">
            <Activity className="w-4 h-4 text-gray-400" />
            <div>
              <h2 className="font-bold text-gray-800 text-xs sm:text-sm uppercase tracking-wide">Debug IA Local</h2>
              <p className="text-[10px] text-gray-400 font-medium">Estimativa do navegador atual, nao faturamento oficial</p>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chamadas</p>
                <p className="mt-2 text-2xl font-black text-slate-800">{usageTotals.calls}</p>
                <p className="text-[11px] text-slate-500">{usageTotals.successfulCalls} ok / {usageTotals.failedCalls} falhas</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Audio enviado</p>
                <p className="mt-2 text-lg font-black text-slate-800">{formatMinutes(usageTotals.uploadedAudioBytes)}</p>
                <p className="text-[11px] text-slate-500">{formatBytes(usageTotals.uploadedAudioBytes)}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Audio retornado</p>
                <p className="mt-2 text-lg font-black text-slate-800">{formatBytes(usageTotals.returnedAudioBytes)}</p>
                <p className="text-[11px] text-slate-500">TTS server-side</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Texto processado</p>
                <p className="mt-2 text-lg font-black text-slate-800">{usageTotals.requestTextChars + usageTotals.responseTextChars}</p>
                <p className="text-[11px] text-slate-500">{usageTotals.itemsReturned} itens gerados</p>
              </div>
            </div>

            <div className="space-y-3">
              {usageBuckets.map((bucket: AiUsageBucket) => {
                const meta = ACTION_META[bucket.action];
                return (
                  <div key={bucket.action} className="rounded-2xl border border-gray-100 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                          {meta.icon}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-gray-900">{meta.label}</p>
                          <p className="text-[10px] text-gray-400">Atualizado: {formatDateTime(bucket.lastAt)}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-black text-slate-800">{bucket.calls}</p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide">chamadas</p>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sucesso</p>
                        <p className="mt-1 font-bold text-emerald-600">{bucket.successfulCalls}</p>
                        <p className="text-[10px] text-slate-400">{bucket.failedCalls} falhas</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Entrada</p>
                        <p className="mt-1 font-bold text-slate-700">{bucket.requestTextChars} chars</p>
                        <p className="text-[10px] text-slate-400">{formatMinutes(bucket.uploadedAudioBytes)} audio</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saida</p>
                        <p className="mt-1 font-bold text-slate-700">{bucket.responseTextChars} chars</p>
                        <p className="text-[10px] text-slate-400">{formatBytes(bucket.returnedAudioBytes)} audio</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Debug</p>
                        <p className="mt-1 font-bold text-slate-700">{bucket.itemsReturned} itens</p>
                        <p className="text-[10px] text-slate-400">{bucket.warnings} warn / {bucket.errors} err</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
