
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppStatus, GameState, Phrase, PronunciationResult, TOPICS, AppMode, UserProfile, ChatMessage } from './types';
import { validatePronunciation, generatePhrases, generateWords } from './services/geminiService';
import { converseWithEve, requestEveSpeech } from './services/eveService';
import { getCoursePhrases, getRandomPhrases } from './phrases';
import { PhraseCard } from './components/PhraseCard';
import { AudioRecorder } from './components/AudioRecorder';
import { ScoreBoard } from './components/ScoreBoard';
import { Avatar3D } from './components/Avatar3D';
import { ProfileSetup } from './components/ProfileSetup';
import { LoginScreen } from './components/LoginScreen';
import { ProgressHistory } from './components/ProgressHistory';
import { ModeSelector } from './components/ModeSelector';
import { AdminDashboard } from './components/AdminDashboard';
import { TopicSelector } from './components/TopicSelector';
import { BarChart, Loader2, Settings, Volume2, AlertCircle, CheckCircle2, Home, User, Radio, Monitor, MonitorOff, ToggleLeft, ToggleRight, Sparkles } from 'lucide-react';

const USERS_KEY = 'fluentflow_users';

const AppContent: React.FC<{ currentUser: UserProfile; onLogout: () => void; onUpdateUser: (u: UserProfile) => void; existingUsers: UserProfile[] }> = ({ currentUser, onLogout, onUpdateUser, existingUsers }) => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [result, setResult] = useState<PronunciationResult | null>(null);
  const [appMode, setAppMode] = useState<AppMode | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [showProfileSetup, setShowProfileSetup] = useState(currentUser.name === '' && currentUser.role !== 'guest');
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showTopicSelector, setShowTopicSelector] = useState(false);
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false);
  
  const [isAvatarEnabled, setIsAvatarEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem(`ff_avatar_pref_${currentUser.id}`);
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const mediaSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const speechSynthesisUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speechRequestIdRef = useRef<number>(0);
  const speechSafetyTimerRef = useRef<number | null>(null);
  const [analyserForAvatar, setAnalyserForAvatar] = useState<AnalyserNode | null>(null);
  const [eveDebugLine, setEveDebugLine] = useState('');

  const [gameState, setGameState] = useState<GameState>(() => {
    const defaultState: GameState = { score: 0, streak: 0, currentLevel: 1, phrasesCompleted: 0, courseProgressIndex: 0, history: [] };
    try {
      const saved = localStorage.getItem(`fluentflow_progress_${currentUser.id}`);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return defaultState;
  });

  useEffect(() => {
    localStorage.setItem(`ff_avatar_pref_${currentUser.id}`, JSON.stringify(isAvatarEnabled));
  }, [isAvatarEnabled, currentUser.id]);

  useEffect(() => {
    try {
      localStorage.setItem(`fluentflow_progress_${currentUser.id}`, JSON.stringify(gameState));
    } catch (e) {}
  }, [gameState, currentUser.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, status]);

  useEffect(() => {
    const initAudio = async () => {
      try {
        if (audioContextRef.current) return;
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.85;
        analyser.connect(ctx.destination);
        audioContextRef.current = ctx;
        audioAnalyserRef.current = analyser;
        setAnalyserForAvatar(analyser);
      } catch (e) {
        console.error("Audio Context initialization failed:", e);
      }
    };
    initAudio();
    return () => { 
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close();
        } catch (e) {}
        audioContextRef.current = null;
      }
    };
  }, []);

  const ensureAudioContext = useCallback(async () => {
    if (audioContextRef.current?.state === 'suspended') {
      await audioContextRef.current.resume();
    }
  }, []);

  const stopAllSpeech = useCallback(() => {
    speechRequestIdRef.current++;

    if (speechSafetyTimerRef.current !== null) {
      window.clearTimeout(speechSafetyTimerRef.current);
      speechSafetyTimerRef.current = null;
    }

    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
      } catch (e) {}
      currentAudioRef.current.src = '';
      currentAudioRef.current = null;
    }

    if (mediaSourceRef.current) {
      try {
        mediaSourceRef.current.disconnect();
      } catch (e) {}
      mediaSourceRef.current = null;
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    speechSynthesisUtteranceRef.current = null;
    setIsAvatarSpeaking(false);
  }, []);

  const speakWithBrowserTts = (text: string, currentId: number): boolean => {
    if (!('speechSynthesis' in window)) return false;
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.onend = () => {
        if (speechSafetyTimerRef.current !== null) {
          window.clearTimeout(speechSafetyTimerRef.current);
          speechSafetyTimerRef.current = null;
        }
        if (currentId === speechRequestIdRef.current) setIsAvatarSpeaking(false);
      };
      utterance.onerror = () => {
        if (speechSafetyTimerRef.current !== null) {
          window.clearTimeout(speechSafetyTimerRef.current);
          speechSafetyTimerRef.current = null;
        }
        if (currentId === speechRequestIdRef.current) setIsAvatarSpeaking(false);
      };
      speechSynthesisUtteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
      speechSafetyTimerRef.current = window.setTimeout(() => {
        if (currentId === speechRequestIdRef.current) setIsAvatarSpeaking(false);
      }, 20000);
      return true;
    } catch {
      return false;
    }
  };

  const playServerAudio = useCallback(async (base64: string, mimeType: string | null, currentId: number): Promise<boolean> => {
    if (!base64) return false;

    const context = audioContextRef.current;
    const analyser = audioAnalyserRef.current;
    const resolvedMimeType = mimeType || 'audio/mpeg';

    const audio = new Audio(`data:${resolvedMimeType};base64,${base64}`);
    audio.preload = 'auto';
    currentAudioRef.current = audio;

    if (context && analyser) {
      try {
        const source = context.createMediaElementSource(audio);
        source.connect(analyser);
        mediaSourceRef.current = source;
      } catch (e) {
        console.warn('[EVE] Could not connect MediaElementSource', e);
      }
    }

    audio.onended = () => {
      if (speechSafetyTimerRef.current !== null) {
        window.clearTimeout(speechSafetyTimerRef.current);
        speechSafetyTimerRef.current = null;
      }
      if (mediaSourceRef.current) {
        try { mediaSourceRef.current.disconnect(); } catch (e) {}
        mediaSourceRef.current = null;
      }
      if (currentAudioRef.current === audio) currentAudioRef.current = null;
      if (currentId === speechRequestIdRef.current) setIsAvatarSpeaking(false);
    };

    audio.onerror = () => {
      if (speechSafetyTimerRef.current !== null) {
        window.clearTimeout(speechSafetyTimerRef.current);
        speechSafetyTimerRef.current = null;
      }
      if (mediaSourceRef.current) {
        try { mediaSourceRef.current.disconnect(); } catch (e) {}
        mediaSourceRef.current = null;
      }
      if (currentAudioRef.current === audio) currentAudioRef.current = null;
    };

    try {
      await ensureAudioContext();
      await audio.play();
      speechSafetyTimerRef.current = window.setTimeout(() => {
        if (currentId === speechRequestIdRef.current) setIsAvatarSpeaking(false);
      }, 20000);
      return true;
    } catch (error) {
      console.warn('[EVE] Audio playback failed', error);
      if (mediaSourceRef.current) {
        try { mediaSourceRef.current.disconnect(); } catch (e) {}
        mediaSourceRef.current = null;
      }
      if (currentAudioRef.current === audio) currentAudioRef.current = null;
      return false;
    }
  }, [ensureAudioContext]);

  const speakText = useCallback(async (text: string) => {
    if (!text) return;

    stopAllSpeech();
    const currentId = speechRequestIdRef.current;

    setIsAvatarSpeaking(true);
    try {
      const speech = await requestEveSpeech(text);
      if (currentId !== speechRequestIdRef.current) return;

      const debug = speech.debug;
      const firstError = debug.errors[0] ? ` | ERR:${debug.errors[0].slice(0, 80)}` : '';
      setEveDebugLine(
        `EVE ${debug.requestId} | TTS:${debug.ttsModel || 'browser'} | W:${debug.warnings.length} E:${debug.errors.length}${firstError}`
      );
      console.info('[EVE speech]', debug);

      const played = speech.base64
        ? await playServerAudio(speech.base64, speech.mimeType, currentId)
        : false;

      if (!played) {
        if (!speakWithBrowserTts(text, currentId)) {
          setIsAvatarSpeaking(false);
        }
      }
    } catch (e) {
      if (!speakWithBrowserTts(text, currentId)) {
        setIsAvatarSpeaking(false);
      }
    }
  }, [playServerAudio, stopAllSpeech]);

  const loadData = useCallback(async (mode: AppMode, topicOverride?: string) => {
    setStatus(AppStatus.LOADING_PHRASES);
    setEveDebugLine('');
    stopAllSpeech();

    try {
      let loadedPhrases: Phrase[] = [];
      if (mode === 'course') {
        loadedPhrases = getCoursePhrases(gameState.courseProgressIndex, 5);
      } else if (mode === 'practice') {
        const topic = topicOverride || selectedTopic || TOPICS[0];
        loadedPhrases = await generatePhrases(topic, 'medium', 5);
      } else if (mode === 'words') {
        loadedPhrases = await generateWords('General', 'medium', 8);
      } else if (mode === 'conversation') {
        setChatHistory([]); 
        const welcome = `Hello ${currentUser.name}! I'm EVE. How are you today?`;
        setChatHistory([{ role: 'model', text: welcome, translation: `Olá ${currentUser.name}! Eu sou a EVE. Como você está hoje?` }]);
        speakText(welcome);
      }
      setPhrases(loadedPhrases);
      setCurrentPhraseIndex(0);
      setResult(null);
      setStatus(AppStatus.READY);
    } catch (e) {
      setPhrases(getRandomPhrases(5));
      setStatus(AppStatus.READY);
    }
  }, [gameState.courseProgressIndex, currentUser.name, selectedTopic, speakText, stopAllSpeech]);

  useEffect(() => {
    if (appMode) loadData(appMode);
    // Intentionally react only to mode transitions to avoid reloading phrases mid-session
    // when unrelated state (e.g. score/progress/chat length) changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appMode]);

  const handleAudioRecorded = async (base64: string, mimeType: string, _audioUrl: string, browserTranscript?: string) => {
    if (!base64 && !browserTranscript) return;
    await ensureAudioContext();
    setStatus(AppStatus.PROCESSING_AUDIO);
    
    try {
      if (appMode === 'conversation') {
        const response = await converseWithEve(base64, mimeType, chatHistory, browserTranscript);
        const firstError = response.debug.errors[0] ? ` | ERR:${response.debug.errors[0].slice(0, 80)}` : '';
        setEveDebugLine(
          `EVE ${response.requestId} | STT:${response.debug.transcriptSource}/${response.debug.transcriptionModel || '-'} | CHAT:${response.debug.chatModel || '-'} | W:${response.debug.warnings.length} E:${response.debug.errors.length}${firstError}`
        );
        console.info('[EVE conversation]', response.debug);

        if (response.isSilent) {
          setChatHistory(prev => [
            ...prev,
            {
              role: 'model',
              text: response.response || "I couldn't hear you. Could you repeat that?",
              translation: response.translation || 'Nao consegui te ouvir. Pode repetir?'
            }
          ]);
          setStatus(AppStatus.READY);
          return;
        }
        const userTranscript = response.transcription || browserTranscript || '(No transcript)';
        setChatHistory(prev => [...prev, 
          { role: 'user', text: userTranscript },
          { role: 'model', text: response.response, translation: response.translation, feedback: response.feedback, improvement: response.improvement }
        ]);
        setGameState(prev => ({ ...prev, score: prev.score + 10 })); 
        speakText(response.response);
        setStatus(AppStatus.READY);
      } else {
        const res = await validatePronunciation(base64, mimeType, phrases[currentPhraseIndex].english, browserTranscript);
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
    } catch (e) {
      setEveDebugLine(`EVE error: ${String((e as any)?.message || e)}`);
      if (appMode === 'conversation') {
        setChatHistory(prev => [
          ...prev,
          {
            role: 'model',
            text: 'I am having a connection problem right now. Please try again.',
            translation: 'Estou com problema de conexao agora. Tente novamente.'
          }
        ]);
      }
      setStatus(AppStatus.READY);
    }
  };

  const handleModeChange = (mode: AppMode | null) => {
    stopAllSpeech();
    setEveDebugLine('');
    if (mode === 'practice') setShowTopicSelector(true);
    else setAppMode(mode);
    setShowSettings(false);
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-[#F8FAFC] overflow-hidden font-sans">
      <header className="bg-white/80 backdrop-blur-md border-b px-4 sm:px-6 py-2.5 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <button 
            onClick={() => setShowProfileSetup(true)}
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${currentUser.avatarColor} flex items-center justify-center text-white font-bold text-xs sm:text-sm shadow-inner active:scale-95 transition-all`}
          >
            {currentUser.name[0] || 'V'}
          </button>
          <div className="flex flex-col">
            <h1 className="text-xs sm:text-sm font-bold text-slate-800 leading-tight">FluentFlow</h1>
            <span className="text-[8px] sm:text-[9px] font-black text-indigo-500 uppercase tracking-widest truncate max-w-[100px]">
              {appMode || 'Escolha um Modo'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {appMode && (
            <button onClick={() => setAppMode(null)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
              <Home className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => setShowHistory(true)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
            <BarChart className="w-4 h-4" />
          </button>
          <button onClick={() => setShowSettings(!showSettings)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0 relative max-w-2xl mx-auto w-full px-4 sm:px-6 overflow-hidden">
        {!appMode ? (
          <ModeSelector userName={currentUser.name || "Visitante"} onSelectMode={handleModeChange} />
        ) : (
          <>
            <div className="shrink-0 pt-4 pb-2">
              <ScoreBoard state={gameState} totalPhrases={1000} />
              
              <div className={`transition-all duration-500 flex items-center justify-center ${isAvatarEnabled ? 'h-[180px] sm:h-[260px] md:h-[300px]' : 'h-10'}`}>
                {isAvatarEnabled ? (
                  <Avatar3D isSpeaking={isAvatarSpeaking} isRecording={status === AppStatus.RECORDING} audioAnalyser={analyserForAvatar} />
                ) : (
                  <div className="bg-white/40 backdrop-blur-sm px-4 py-2 rounded-2xl border border-white/60">
                    <Radio className={`w-4 h-4 ${isAvatarSpeaking ? 'text-indigo-500 animate-pulse' : 'text-slate-300'}`} />
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative z-10 pb-4">
              {appMode === 'conversation' ? (
                <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1">
                  {chatHistory.map((msg, i) => (
                    <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in-up`}>
                      <div className={`px-4 py-2.5 rounded-2xl max-w-[90%] text-sm shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-700 rounded-tl-none border border-slate-100'}`}>
                        {msg.text}
                      </div>
                      {msg.role === 'model' && msg.translation && (
                        <p className="mt-1 px-1 text-[10px] text-slate-400 italic">"{msg.translation}"</p>
                      )}
                    </div>
                  ))}
                  <div ref={messagesEndRef} className="h-2" />
                </div>
              ) : (
                <div className="flex-1 flex flex-col justify-center">
                  {status === AppStatus.LOADING_PHRASES ? (
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-6 h-6 animate-spin text-indigo-300" />
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gerando frases...</p>
                    </div>
                  ) : status === AppStatus.FEEDBACK && result ? (
                    <div className="bg-white rounded-[32px] p-6 shadow-xl border border-slate-50 flex flex-col items-center animate-fade-in-up">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${result.score > 40 ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'}`}>
                          {result.score > 40 ? <CheckCircle2 /> : <AlertCircle />}
                      </div>
                      <h2 className="text-2xl font-black text-slate-800">{result.score}%</h2>
                      <p className="text-center text-slate-500 text-xs mt-2 mb-6 leading-relaxed">{result.feedback}</p>
                      <button onClick={() => { setStatus(AppStatus.READY); setCurrentPhraseIndex(i => (i + 1) % phrases.length); setResult(null); }} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl text-sm shadow-lg hover:bg-indigo-700 transition-all active:scale-95">Próxima</button>
                    </div>
                  ) : phrases.length > 0 ? (
                    <PhraseCard 
                      phrase={phrases[currentPhraseIndex]} 
                      onSpeak={() => speakText(phrases[currentPhraseIndex].english)} 
                      isSpeaking={isAvatarSpeaking} 
                    />
                  ) : null}
                </div>
              )}
            </div>

            <div className="bg-white rounded-t-[32px] shadow-sm p-4 sm:p-6 pb-6 z-30 shrink-0 border-t border-slate-50">
              <div className="flex flex-col items-center max-w-xs mx-auto">
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2">
                  {status === AppStatus.PROCESSING_AUDIO ? 'Processando...' : 'Toque no microfone para falar'}
                </p>
                {appMode === 'conversation' && eveDebugLine && (
                  <p className="text-[10px] text-slate-400 mb-2 text-center break-all">
                    {eveDebugLine}
                  </p>
                )}
                <AudioRecorder 
                  onAudioRecorded={handleAudioRecorded} 
                  isProcessing={status === AppStatus.PROCESSING_AUDIO} 
                  disabled={isAvatarSpeaking || status === AppStatus.LOADING_PHRASES} 
                  onRecorderLog={(line) => setEveDebugLine(line)}
                  onRecordingStateChange={(recording) => {
                    setStatus(prev => {
                      if (recording) return AppStatus.RECORDING;
                      return prev === AppStatus.RECORDING ? AppStatus.READY : prev;
                    });
                  }}
                />
              </div>
            </div>
          </>
        )}
      </main>

      {showHistory && <ProgressHistory state={gameState} onClose={() => setShowHistory(false)} />}
      {showTopicSelector && <TopicSelector onSelect={(t) => { setSelectedTopic(t); setAppMode('practice'); setShowTopicSelector(false); }} onClose={() => setShowTopicSelector(false)} />}
      {showProfileSetup && <ProfileSetup initialProfile={currentUser} onSave={(u) => { onUpdateUser({...currentUser, ...u}); setShowProfileSetup(false); }} onCancel={() => setShowProfileSetup(false)} />}
      {showSettings && (
        <div className="absolute top-14 right-4 w-56 bg-white rounded-2xl shadow-2xl border p-2 z-50 animate-fade-in-up">
          <button onClick={() => setIsAvatarEnabled(!isAvatarEnabled)} className="w-full text-left p-3 rounded-xl text-sm font-semibold flex items-center justify-between text-slate-600 hover:bg-slate-50">
             <div className="flex items-center gap-3">
               {isAvatarEnabled ? <Monitor className="w-4 h-4 text-indigo-500" /> : <MonitorOff className="w-4 h-4 text-slate-300" />}
               <span>Avatar EVE</span>
             </div>
             {isAvatarEnabled ? <ToggleRight className="w-5 h-5 text-indigo-600" /> : <ToggleLeft className="w-5 h-5 text-slate-300" />}
          </button>
          <button onClick={onLogout} className="w-full text-left p-3 rounded-xl text-sm font-bold text-rose-500 mt-1 border-t pt-3">Sair da Conta</button>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>(() => {
    try {
      const saved = localStorage.getItem(USERS_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed.filter((u: UserProfile) => u.role !== 'admin') : [];
    } catch {
      return [];
    }
  });
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }, [users]);

  const handleLogin = (user: UserProfile) => {
    if (user.role !== 'admin') {
      setUsers(prev => prev.some(u => u.id === user.id) ? prev : [...prev, user]);
    }
    setCurrentUser(user);
  };

  const handleDeleteUser = (userId: string) => {
    setUsers(prev => prev.filter(u => u.id !== userId));
    localStorage.removeItem(`fluentflow_progress_${userId}`);
  };

  if (!currentUser) {
    return (
      <LoginScreen 
        users={users} 
        onLogin={handleLogin} 
        onCreateNew={() => setCurrentUser({ id: `u_${Date.now()}`, name: '', avatarColor: 'bg-indigo-500', joinedDate: Date.now(), role: 'user' })} 
      />
    );
  }

  if (currentUser.role === 'admin') {
    return <AdminDashboard users={users} onDeleteUser={handleDeleteUser} onLogout={() => setCurrentUser(null)} />;
  }

  return (
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
