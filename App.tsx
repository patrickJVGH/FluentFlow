
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppStatus, GameState, Phrase, PronunciationResult, TOPICS, AppMode, UserProfile, ChatMessage } from './types';
import { validatePronunciation, generateSpeech, processConversationTurn, generatePhrases, generateWords } from './services/geminiService';
import { getCoursePhrases, getRandomPhrases } from './phrases';
import { PhraseCard } from './components/PhraseCard';
import { AudioRecorder, AudioRecorderRef } from './components/AudioRecorder';
import { ScoreBoard } from './components/ScoreBoard';
import { Avatar3D } from './components/Avatar3D';
import { ProfileSetup } from './components/ProfileSetup';
import { LoginScreen } from './components/LoginScreen';
import { ProgressHistory } from './components/ProgressHistory';
import { ModeSelector } from './components/ModeSelector';
import { AdminDashboard } from './components/AdminDashboard';
import { TopicSelector } from './components/TopicSelector';
import { Logo } from './components/Logo';
// Fixed error: Added missing User import from lucide-react
import { BarChart, Loader2, Settings, Volume2, Sparkles, AlertCircle, CheckCircle2, BookOpen, MessageCircle, Type, Home, Edit3, User, Layers } from 'lucide-react';

const USERS_KEY = 'fluentflow_users';

const decodeRawPCM = (data: Uint8Array, ctx: AudioContext, sampleRate: number = 24000): AudioBuffer => {
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
  const buffer = ctx.createBuffer(1, dataInt16.length, sampleRate);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
  return buffer;
};

const AppContent: React.FC<{ currentUser: UserProfile; onLogout: () => void; onUpdateUser: (u: UserProfile) => void; existingUsers: UserProfile[] }> = ({ currentUser, onLogout, onUpdateUser, existingUsers }) => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [result, setResult] = useState<PronunciationResult | null>(null);
  const [appMode, setAppMode] = useState<AppMode | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Controls
  const [showProfileSetup, setShowProfileSetup] = useState(currentUser.name === '' && currentUser.role !== 'guest');
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showTopicSelector, setShowTopicSelector] = useState(false);
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioCacheRef = useRef<Map<string, AudioBuffer>>(new Map());
  const speechRequestIdRef = useRef<number>(0);
  const [analyserForAvatar, setAnalyserForAvatar] = useState<AnalyserNode | null>(null);

  const [gameState, setGameState] = useState<GameState>(() => {
    const saved = localStorage.getItem(`fluentflow_progress_${currentUser.id}`);
    if (saved) return JSON.parse(saved);
    return { score: 0, streak: 0, currentLevel: 1, phrasesCompleted: 0, courseProgressIndex: 0, history: [] };
  });

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const newHistory = [...gameState.history];
    const todayEntryIndex = newHistory.findIndex(h => h.date === today);

    if (todayEntryIndex >= 0) {
      newHistory[todayEntryIndex].score = gameState.score;
    } else {
      newHistory.push({ date: today, score: gameState.score });
    }

    const updatedState = { ...gameState, history: newHistory };
    localStorage.setItem(`fluentflow_progress_${currentUser.id}`, JSON.stringify(updatedState));
  }, [gameState.score, currentUser.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, status]);

  useEffect(() => {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.connect(ctx.destination);
    
    audioContextRef.current = ctx;
    audioAnalyserRef.current = analyser;
    setAnalyserForAvatar(analyser);

    return () => { ctx.close(); };
  }, []);

  const ensureAudioContext = async () => {
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      try { await audioContextRef.current.resume(); } catch (e) { console.error(e); }
    }
  };

  const speakText = async (text: string) => {
    await ensureAudioContext();
    const context = audioContextRef.current;
    const analyser = audioAnalyserRef.current;
    if (!context || !analyser) return;
    const currentId = ++speechRequestIdRef.current;
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch (e) {}
      sourceNodeRef.current = null;
    }
    setIsAvatarSpeaking(true);
    try {
      let buffer = audioCacheRef.current.get(text);
      if (!buffer) {
        const base64 = await generateSpeech(text);
        if (currentId !== speechRequestIdRef.current || !base64) {
          setIsAvatarSpeaking(false);
          return;
        }
        const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        buffer = decodeRawPCM(bytes, context);
        audioCacheRef.current.set(text, buffer);
      }
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(analyser);
      source.onended = () => { if (currentId === speechRequestIdRef.current) setIsAvatarSpeaking(false); };
      sourceNodeRef.current = source;
      source.start(0);
    } catch (e) { 
      console.error(e);
      setIsAvatarSpeaking(false); 
    }
  };

  useEffect(() => {
    let timer: number;
    if (status === AppStatus.READY && phrases.length > 0 && appMode !== 'conversation') {
      const currentPhrase = phrases[currentPhraseIndex];
      if (currentPhrase) {
        timer = window.setTimeout(() => speakText(currentPhrase.english), 500);
      }
    }
    return () => { if (timer) window.clearTimeout(timer); };
  }, [phrases, currentPhraseIndex, appMode, status]);

  const loadData = useCallback(async (mode: AppMode, topicOverride?: string) => {
    setStatus(AppStatus.LOADING_PHRASES);
    audioCacheRef.current.clear();
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch (e) {}
      sourceNodeRef.current = null;
    }

    try {
      let loadedPhrases: Phrase[] = [];
      if (mode === 'course') {
        loadedPhrases = getCoursePhrases(gameState.courseProgressIndex, 5);
      } else if (mode === 'practice') {
        const topic = topicOverride || selectedTopic || TOPICS[Math.floor(Math.random() * TOPICS.length)];
        loadedPhrases = await generatePhrases(topic, 'medium', 5);
      } else if (mode === 'words') {
        loadedPhrases = await generateWords('General', 'medium', 8);
      } else if (mode === 'conversation') {
        if (chatHistory.length === 0) {
          const welcome = `Hello ${currentUser.name}! I'm EVE. Ready to talk?`;
          setChatHistory([{ role: 'model', text: welcome, translation: `Olá ${currentUser.name}! Eu sou a EVE. Pronto para falar?` }]);
          speakText(welcome);
        }
      }
      setPhrases(loadedPhrases);
      setCurrentPhraseIndex(0);
      setResult(null);
      setStatus(AppStatus.READY);
    } catch (e) {
      const fallback = getRandomPhrases(5);
      setPhrases(fallback);
      setStatus(AppStatus.READY);
    }
  }, [gameState.courseProgressIndex, chatHistory.length, currentUser.name, selectedTopic]);

  useEffect(() => { 
    if (appMode) loadData(appMode); 
  }, [appMode, loadData]);

  const handleAudioRecorded = async (base64: string, mimeType: string) => {
    await ensureAudioContext();
    setStatus(AppStatus.PROCESSING_AUDIO);
    if (appMode === 'conversation') {
      const response = await processConversationTurn(base64, mimeType, chatHistory);
      setChatHistory(prev => [...prev, 
        { role: 'user', text: response.transcription },
        { role: 'model', text: response.response, translation: response.translation, feedback: response.feedback, improvement: response.improvement }
      ]);
      setGameState(prev => ({ ...prev, score: prev.score + 15 })); 
      speakText(response.response);
      setStatus(AppStatus.READY);
    } else {
      const res = await validatePronunciation(base64, mimeType, phrases[currentPhraseIndex].english);
      if (!(res.isCorrect && res.score > 40 && res.transcript && res.transcript.trim().length > 0)) {
        res.isCorrect = false; res.score = 0; res.feedback = "Não ouvi sua voz com clareza. Tente novamente!";
      }
      setResult(res);
      if (res.isCorrect) {
        setGameState(prev => ({ 
          ...prev, 
          score: prev.score + res.score, 
          phrasesCompleted: prev.phrasesCompleted + 1,
          courseProgressIndex: appMode === 'course' ? prev.courseProgressIndex + 1 : prev.courseProgressIndex
        }));
      }
      setStatus(AppStatus.FEEDBACK);
    }
  };

  const nextPhrase = () => {
    ensureAudioContext();
    const nextIdx = currentPhraseIndex + 1;
    if (nextIdx < phrases.length) {
      setCurrentPhraseIndex(nextIdx);
      setResult(null);
      setStatus(AppStatus.READY);
    } else {
      loadData(appMode!);
    }
  };

  const handleModeChange = (mode: AppMode | null) => {
    ensureAudioContext();
    if (mode === 'practice') {
      setShowTopicSelector(true);
    } else {
      setAppMode(mode);
      setSelectedTopic(null);
    }
    setShowSettings(false);
  };

  const handleTopicSelect = (topic: string) => {
    setSelectedTopic(topic);
    setAppMode('practice');
    setShowTopicSelector(false);
  };

  const handleProfileUpdate = (data: any) => {
    const newRole = (currentUser.role === 'guest' && data.name && data.name !== 'Visitante') ? 'user' : currentUser.role;
    onUpdateUser({ ...currentUser, ...data, role: newRole });
    setShowProfileSetup(false);
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC] overflow-hidden">
      <header className="bg-white/80 backdrop-blur-md border-b px-5 py-3 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => { ensureAudioContext(); setShowProfileSetup(true); }}
            className={`group relative w-10 h-10 rounded-xl ${currentUser.avatarColor} flex items-center justify-center text-white font-bold text-sm shadow-inner active:scale-95 transition-all hover:ring-4 hover:ring-indigo-50`}
            title="Configurações de Perfil"
          >
            {currentUser.name[0] || 'V'}
            <div className="absolute -bottom-1 -right-1 bg-white p-0.5 rounded-md shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
              <Edit3 className="w-2.5 h-2.5 text-indigo-600" />
            </div>
          </button>
          <div className="flex flex-col">
            <h1 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              FluentFlow
              <span className="text-[10px] text-slate-400 font-normal truncate max-w-[80px]">| {currentUser.name || 'Visitante'}</span>
            </h1>
            <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">
              {appMode ? (appMode === 'practice' && selectedTopic ? selectedTopic : appMode) : 'Escolha um Modo'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {appMode === 'practice' && (
            <button onClick={() => setShowTopicSelector(true)} className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors" title="Trocar Tópico">
              <Layers className="w-4 h-4" />
            </button>
          )}
          {appMode && (
            <button onClick={() => handleModeChange(null)} className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors" title="Voltar ao Início">
              <Home className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => { ensureAudioContext(); setShowHistory(true); }} className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors" title="Ver Progresso">
            <BarChart className="w-4 h-4" />
          </button>
          <button onClick={() => { ensureAudioContext(); setShowSettings(!showSettings); }} className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {showSettings && (
        <div className="absolute top-14 right-5 w-56 bg-white rounded-2xl shadow-2xl border p-2 z-50 animate-fade-in-up">
          <p className="px-3 py-2 text-[10px] font-black text-slate-300 uppercase tracking-widest">Opções</p>
          <button onClick={() => handleModeChange(null)} className="w-full text-left p-3 rounded-xl text-sm font-semibold flex items-center gap-3 text-slate-600 hover:bg-slate-50">
             <Home className="w-4 h-4" /> Início / Modos
          </button>
          <button onClick={() => { setShowProfileSetup(true); setShowSettings(false); }} className="w-full text-left p-3 rounded-xl text-sm font-semibold flex items-center gap-3 text-slate-600 hover:bg-slate-50">
             <User className="w-4 h-4" /> Editar Perfil
          </button>
          <button onClick={onLogout} className="w-full text-left p-3 rounded-xl text-sm font-bold text-rose-500 mt-2 border-t">Sair</button>
        </div>
      )}

      <main className="flex-1 flex flex-col min-h-0 relative max-w-lg mx-auto w-full">
        {!appMode ? (
          <ModeSelector userName={currentUser.name || "Visitante"} onSelectMode={handleModeChange} />
        ) : (
          <>
            <div className="shrink-0 p-4 pb-0 z-20">
              <ScoreBoard state={gameState} totalPhrases={1000} />
              <div className={`transition-all duration-500 relative ${appMode === 'conversation' ? 'h-[100px]' : 'h-[160px]'}`}>
                <Avatar3D isSpeaking={isAvatarSpeaking} isRecording={status === AppStatus.RECORDING} audioAnalyser={analyserForAvatar} />
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0 overflow-hidden px-4 py-2">
              {appMode === 'conversation' ? (
                <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-1 pb-4">
                  {chatHistory.map((msg, i) => (
                    <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in-up`}>
                      <div className={`group relative px-4 py-3 rounded-2xl max-w-[85%] text-sm shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-700 rounded-tl-none border border-slate-100'}`}>
                        {msg.text}
                        {msg.role === 'model' && (
                          <button onClick={() => speakText(msg.text)} className="absolute -right-8 top-1 p-1.5 text-slate-300 hover:text-indigo-500 transition-colors">
                            <Volume2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      {msg.role === 'model' && (
                        <div className="mt-2 space-y-2 w-[90%]">
                          <p className="text-[10px] text-slate-400 italic">"{msg.translation}"</p>
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              ) : (
                <div className="flex-1 flex flex-col justify-center">
                  {status === AppStatus.LOADING_PHRASES ? (
                    <div className="flex flex-col items-center justify-center gap-4 py-10">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Carregando {selectedTopic || ''}...</p>
                    </div>
                  ) : status === AppStatus.FEEDBACK && result ? (
                    <div className="bg-white rounded-[32px] p-6 shadow-xl border border-slate-50 flex flex-col items-center animate-fade-in-up">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${result.score > 50 ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'}`}>
                          {result.score > 50 ? <CheckCircle2 /> : <AlertCircle />}
                      </div>
                      <h2 className="text-2xl font-black text-slate-800">{result.score}%</h2>
                      <p className="text-center text-slate-500 text-xs mt-2 mb-6 leading-relaxed">{result.feedback}</p>
                      {result.transcript && <p className="text-[10px] text-slate-300 italic mb-4">Ouvi: "{result.transcript}"</p>}
                      <button onClick={nextPhrase} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl text-sm shadow-lg shadow-indigo-100">Continuar</button>
                    </div>
                  ) : (
                    phrases.length > 0 && (
                      <PhraseCard 
                        phrase={phrases[currentPhraseIndex]} 
                        onSpeak={() => speakText(phrases[currentPhraseIndex].english)} 
                        isSpeaking={isAvatarSpeaking} 
                      />
                    )
                  )}
                </div>
              )}
            </div>

            <div className="bg-white rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.02)] p-6 pb-10 z-30 shrink-0 border-t border-slate-50">
              <div className="flex flex-col items-center">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2">
                  {status === AppStatus.PROCESSING_AUDIO ? 'EVE está analisando...' : 'Toque para falar'}
                </p>
                <AudioRecorder 
                  onAudioRecorded={handleAudioRecorded} 
                  isProcessing={status === AppStatus.PROCESSING_AUDIO} 
                  disabled={isAvatarSpeaking || status === AppStatus.LOADING_PHRASES} 
                  ref={null} 
                />
              </div>
            </div>
          </>
        )}
      </main>

      {showHistory && <ProgressHistory state={gameState} onClose={() => setShowHistory(false)} />}
      {showTopicSelector && <TopicSelector onSelect={handleTopicSelect} onClose={() => setShowTopicSelector(false)} />}
      {showProfileSetup && (
        <ProfileSetup 
          initialProfile={currentUser} 
          onSave={handleProfileUpdate} 
          onCancel={() => setShowProfileSetup(false)} 
          existingNames={existingUsers.filter(u => u.id !== currentUser.id).map(u => u.name)}
        />
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>(() => {
    const saved = localStorage.getItem(USERS_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }, [users]);

  const handleLogin = (user: UserProfile) => {
    setUsers(prev => {
      if (prev.some(u => u.id === user.id)) return prev;
      return [...prev, user];
    });
    setCurrentUser(user);
  };

  const handleDeleteUser = (userId: string) => {
    setUsers(prev => prev.filter(u => u.id !== userId));
    localStorage.removeItem(`fluentflow_progress_${userId}`);
  };

  if (currentUser?.role === 'admin') {
    return <AdminDashboard users={users} onDeleteUser={handleDeleteUser} onLogout={() => setCurrentUser(null)} />;
  }

  return !currentUser ? (
    <LoginScreen 
      users={users} 
      onLogin={handleLogin} 
      onCreateNew={() => setCurrentUser({ id: `u_${Date.now()}`, name: '', avatarColor: 'bg-indigo-500', joinedDate: Date.now(), role: 'user' })} 
    />
  ) : (
    <AppContent 
      currentUser={currentUser} 
      onLogout={() => setCurrentUser(null)} 
      existingUsers={users}
      onUpdateUser={u => { 
        setUsers(prev => prev.some(x => x.id === u.id) ? prev.map(x => x.id === u.id ? u : x) : [...prev, u]); 
        setCurrentUser(u); 
      }} 
    />
  );
};

export default App;
