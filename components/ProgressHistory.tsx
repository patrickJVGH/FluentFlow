
import React, { useMemo } from 'react';
import { GameState, USER_RANKS } from '../types';
import { X, TrendingUp, Trophy, Flame, Calendar, Star } from 'lucide-react';

interface ProgressHistoryProps {
  state: GameState;
  onClose: () => void;
}

export const ProgressHistory: React.FC<ProgressHistoryProps> = ({ state, onClose }) => {
  
  // Prepare Data for Chart
  const chartData = useMemo(() => {
    // Ensure we have at least some data points for the graph
    let data = state.history || [];
    
    // Limit to last 7 entries for cleaner UI
    if (data.length > 7) {
      data = data.slice(data.length - 7);
    }

    // If no history yet, fake a starting point
    if (data.length === 0) {
        return [{ date: 'Hoje', score: state.score }];
    }
    
    return data;
  }, [state.history, state.score]);

  // Calculate Chart Dimensions
  const CHART_HEIGHT = 150;
  const CHART_WIDTH = 300;
  const padding = 20;

  const maxScore = Math.max(...chartData.map(d => d.score), 100);
  const minScore = Math.min(...chartData.map(d => d.score), 0);
  
  // Helper to generate path
  const generatePath = () => {
    if (chartData.length < 2) return "";

    const points = chartData.map((d, i) => {
      const x = (i / (chartData.length - 1)) * (CHART_WIDTH - padding * 2) + padding;
      const y = CHART_HEIGHT - ((d.score - minScore) / (maxScore - minScore || 1)) * (CHART_HEIGHT - padding * 2) - padding;
      return `${x},${y}`;
    });

    return `M ${points.join(' L ')}`;
  };

  const getRank = (score: number) => {
    return [...USER_RANKS].reverse().find(r => score >= r.minScore) || USER_RANKS[0];
  };

  const currentRank = getRank(state.score);
  const nextRank = USER_RANKS.find(r => r.minScore > state.score);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-fade-in-up">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-indigo-600 px-6 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
             <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                <TrendingUp className="text-white w-6 h-6" />
             </div>
             <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Seu Progresso</h2>
                <p className="text-indigo-200 text-xs font-medium uppercase tracking-wider">Estatísticas & Evolução</p>
             </div>
          </div>
          <button onClick={onClose} className="bg-white/10 hover:bg-white/20 p-2 rounded-full text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 custom-scrollbar">
            
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 flex flex-col items-center justify-center text-center">
                    <Flame className="w-8 h-8 text-orange-500 mb-2" />
                    <span className="text-2xl font-black text-gray-800">{state.streak}</span>
                    <span className="text-xs font-bold text-orange-600 uppercase tracking-widest">Dias Seguidos</span>
                </div>
                <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-100 flex flex-col items-center justify-center text-center">
                    <Trophy className="w-8 h-8 text-yellow-500 mb-2" />
                    <span className="text-2xl font-black text-gray-800">{state.score}</span>
                    <span className="text-xs font-bold text-yellow-600 uppercase tracking-widest">XP Total</span>
                </div>
            </div>

            {/* Chart Section */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-indigo-500" />
                        Últimos Dias
                    </h3>
                </div>
                
                <div className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-4 h-48 relative flex items-center justify-center">
                    {chartData.length < 2 ? (
                         <div className="text-center text-gray-400">
                             <p className="text-sm font-medium">Continue praticando para ver seu gráfico!</p>
                             <div className="mt-4 flex items-center justify-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                <span className="text-xs font-bold text-indigo-600">{state.score} XP Hoje</span>
                             </div>
                         </div>
                    ) : (
                        <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full h-full overflow-visible">
                            {/* Grid Lines */}
                            <line x1="0" y1={CHART_HEIGHT} x2={CHART_WIDTH} y2={CHART_HEIGHT} stroke="#e5e7eb" strokeWidth="1" />
                            <line x1="0" y1="0" x2={CHART_WIDTH} y2="0" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4 4" />
                            
                            {/* The Path */}
                            <path d={generatePath()} fill="none" stroke="#4f46e5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                            
                            {/* Gradient Fill under line (optional simple implementation) */}
                            <path d={`${generatePath()} L ${CHART_WIDTH - 20},${CHART_HEIGHT} L 20,${CHART_HEIGHT} Z`} fill="url(#gradient)" opacity="0.2" />
                            <defs>
                                <linearGradient id="gradient" x1="0" x2="0" y1="0" y2="1">
                                    <stop offset="0%" stopColor="#4f46e5" />
                                    <stop offset="100%" stopColor="#ffffff" />
                                </linearGradient>
                            </defs>

                            {/* Dots */}
                            {chartData.map((d, i) => {
                                const x = (i / (chartData.length - 1)) * (CHART_WIDTH - padding * 2) + padding;
                                const y = CHART_HEIGHT - ((d.score - minScore) / (maxScore - minScore || 1)) * (CHART_HEIGHT - padding * 2) - padding;
                                return (
                                    <g key={i}>
                                        <circle cx={x} cy={y} r="4" fill="white" stroke="#4f46e5" strokeWidth="2" />
                                        {/* Tooltip-ish text */}
                                        <text x={x} y={y - 10} textAnchor="middle" fontSize="10" fill="#6b7280" fontWeight="bold">
                                            {d.score}
                                        </text>
                                        <text x={x} y={CHART_HEIGHT + 15} textAnchor="middle" fontSize="10" fill="#9ca3af">
                                            {new Date(d.date).getDate()}/{new Date(d.date).getMonth()+1}
                                        </text>
                                    </g>
                                );
                            })}
                        </svg>
                    )}
                </div>
            </div>

            {/* Rank Progress */}
            <div className="bg-indigo-50/50 rounded-2xl p-5 border border-indigo-50">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-indigo-800 uppercase tracking-widest">Próximo Nível</span>
                    <span className={`text-xs font-bold ${currentRank.color}`}>{currentRank.title}</span>
                </div>
                
                {nextRank ? (
                    <>
                         <div className="w-full h-2 bg-indigo-200 rounded-full mb-2 overflow-hidden">
                            <div 
                                className="h-full bg-indigo-600 rounded-full transition-all duration-1000" 
                                style={{ width: `${Math.min(((state.score - currentRank.minScore) / (nextRank.minScore - currentRank.minScore)) * 100, 100)}%` }}
                            ></div>
                        </div>
                        <p className="text-xs text-indigo-500 font-medium text-right">
                            Faltam {nextRank.minScore - state.score} XP para <span className="font-bold">{nextRank.title}</span>
                        </p>
                    </>
                ) : (
                    <div className="text-center py-2">
                         <div className="flex items-center justify-center gap-2 text-yellow-500 mb-1">
                            <Star className="w-5 h-5 fill-current" />
                            <Star className="w-6 h-6 fill-current" />
                            <Star className="w-5 h-5 fill-current" />
                         </div>
                         <p className="text-sm font-bold text-indigo-900">Nível Máximo Alcançado!</p>
                    </div>
                )}
            </div>

            {/* Journey Status */}
            <div className="mt-8">
                 <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide mb-4 flex items-center gap-2">
                    <Star className="w-4 h-4 text-indigo-500" />
                    Marcos da Jornada
                </h3>
                <div className="space-y-4 relative pl-4 border-l-2 border-gray-100">
                     <div className="relative">
                         <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-green-500 ring-4 ring-white"></div>
                         <p className="text-sm font-bold text-gray-800">Frases Completadas</p>
                         <p className="text-xs text-gray-500">{state.phrasesCompleted} frases dominadas</p>
                     </div>
                     <div className="relative">
                         <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-indigo-500 ring-4 ring-white"></div>
                         <p className="text-sm font-bold text-gray-800">Nível Atual</p>
                         <p className="text-xs text-gray-500">Módulo {state.currentLevel} em andamento</p>
                     </div>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};
