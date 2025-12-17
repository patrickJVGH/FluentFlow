
import React, { Component, useState, useEffect, useRef, useCallback, ErrorInfo, ReactNode } from 'react';
import { AppStatus, GameState, Phrase, PronunciationResult, TOPICS, AppMode, UserProfile, USER_RANKS, ChatMessage } from './types';
import { generatePhrases, validatePronunciation, generateSpeech, generateWords, processConversationTurn } from './services/geminiService';
import { getCoursePhrases, getRandomPhrases } from './phrases';
import { PhraseCard } from './components/PhraseCard';
import { AudioRecorder, AudioRecorderRef } from './components/AudioRecorder';
import { ScoreBoard } from './components/ScoreBoard';
import { Avatar3D } from './components/Avatar3D';
import { ProfileSetup } from './components/ProfileSetup';
import { LoginScreen } from './components/LoginScreen';
import { AdminDashboard } from './components/AdminDashboard';
import { ProgressHistory } from './components/ProgressHistory';
import { BookOpen, RefreshCw, CheckCircle, XCircle, ArrowRight, Volume2, BarChart, Loader2, Zap, Settings, GraduationCap, Sparkles, Play, Music, Type as TypeIcon, Video, VideoOff, User, Crown, Edit2, LogOut, AlertTriangle, Save, MessageCircle, X, Languages, TrendingUp, Square } from 'lucide-react';

const USERS_KEY = 'fluentflow_users';

// --- HELPER: PCM DECODER ---
const decodeRawPCM = (
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): AudioBuffer => {
  let safeData = data;
  if (data.byteLength % 2 !== 0) {
    safeData = new Uint8Array(data.byteLength + 1);
    safeData.set(data);
  }

  const dataInt16 = new Int16Array(safeData.buffer, safeData.byteOffset, safeData.byteLength / 2);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
};

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  declare props: ErrorBoundaryProps;
  state: ErrorBoundaryState = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error): ErrorBoundaryState { return { hasError: true, error }; }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) { console.error("ErrorBoundary", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="bg-white p-8 rounded-xl shadow-lg max-w-lg w-full border border-red-100">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Ops! Something went wrong.</h2>
            <button onClick={() => window.location.reload()} className="w-full bg-indigo-600 text-white py-2 rounded-lg">Refresh Application</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

interface AppContentProps {
  currentUser: UserProfile;
  onLogout: () => void;
  onUpdateUser: (updatedUser: UserProfile) => void;
}

const AppContent: React.FC<AppContentProps> = ({ currentUser, onLogout, onUpdateUser }) => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [result, setResult] = useState<PronunciationResult | null>(null);
  const [appMode, setAppMode] = useState<AppMode>('course');
  const [userAudioUrl, setUserAudioUrl] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [translationModalContent, setTranslationModalContent] = useState<string | null>(null);
  const [showProfileSetup, setShowProfileSetup] = useState(currentUser.name === '');
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [disableHeadMotion, setDisableHeadMotion] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false);
  const [audioAnalyser, setAudioAnalyser] = useState<AnalyserNode | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const userAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioCacheRef = useRef<Map<string, AudioBuffer>>(new Map());
  const recorderRef = useRef<AudioRecorderRef>(null);
  const speechRequestIdRef = useRef<number>(0);

  const [gameState, setGameState] = useState<GameState>(() => {
    const saved = localStorage.getItem(`fluentflow_progress_${currentUser.id}`);
    return saved ? JSON.parse(saved) : { score: 0, streak: 0, currentLevel: 1, phrasesCompleted: 0, courseProgressIndex: 0, history: [] };
  });

  useEffect(() => { localStorage.setItem(`fluentflow_progress_${currentUser.id}`, JSON.stringify(gameState)); }, [gameState, currentUser.id]);

  useEffect(() => {
    const initAudio = async () => {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            audioContextRef.current = ctx;
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            setAudioAnalyser(analyser);
        } catch (e) { console.error("Audio Init Failed", e); }
    };
    initAudio();
    return () => { audioContextRef.current?.close(); };
  }, []);

  const stopAudio = useCallback(() => {
    speechRequestIdRef.current += 1;
    if (sourceNodeRef.current) {
        try { sourceNodeRef.current.stop(); sourceNodeRef.current.disconnect(); } catch (e) {}
        sourceNodeRef.current = null;
    }
    setIsAvatarSpeaking(false);
    setIsGeneratingAudio(false);
  }, []);

  const speakText = async (text: string) => {
    stopAudio();
    if (audioContextRef.current?.state === 'suspended') await audioContextRef.current.resume();
    if (!audioContextRef.current) return;
    const currentRequestId = speechRequestIdRef.current;
    setIsAvatarSpeaking(true);
    setIsGeneratingAudio(true);
    try {
        let audioBuffer = audioCacheRef.current.get(text);
        if (!audioBuffer) {
            const base64Audio = await generateSpeech(text);
            if (currentRequestId !== speechRequestIdRef.current) return;
            if (!base64Audio) throw new Error("TTS failed");
            const binaryString = window.atob(base64Audio);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
            audioBuffer = decodeRawPCM(bytes, audioContextRef.current);
            audioCacheRef.current.set(text, audioBuffer);
        }
        if (currentRequestId !== speechRequestIdRef.current) return;
        setIsGeneratingAudio(false);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioAnalyser || audioContextRef.current.destination);
        if (audioAnalyser) audioAnalyser.connect(audioContextRef.current.destination);
        source.onended = () => { if (currentRequestId === speechRequestIdRef.current) setIsAvatarSpeaking(false); };
        sourceNodeRef.current = source;
        source.start(0);
    } catch (error) {
        console.error("Playback error", error);
        if (currentRequestId === speechRequestIdRef.current) { setIsAvatarSpeaking(false); setIsGeneratingAudio(false); }
    }
  };

  const loadPhrases = useCallback(async (mode: AppMode, reset: boolean = true) => {
    stopAudio();
    // Optimization: Don't show loading spinner for local data modes
    const isLocalMode = mode === 'course';
    if (!isLocalMode) setStatus(AppStatus.LOADING_PHRASES);

    try {
        let newPhrases: Phrase[] = [];
        if (mode === 'course') {
            const startIndex = reset ? 0 : gameState.courseProgressIndex;
            newPhrases = getCoursePhrases(startIndex, 10);
        } else if (mode === 'practice') {
            newPhrases = await generatePhrases(TOPICS[Math.floor(Math.random() * TOPICS.length)], 'medium', 5);
        } else if (mode === 'words') {
            newPhrases = await generateWords('Common Challenges', 'hard', 10);
        } else if (mode === 'conversation') {
            setPhrases([]);
            setChatHistory([{ role: 'model', text: "Hello! I'm your English tutor. What would you like to talk about today?" }]);
            setTimeout(() => speakText("Hello! I'm your English tutor. What would you like to talk about today?"), 300);
            setStatus(AppStatus.READY);
            return;
        }
        setPhrases(newPhrases);
        setCurrentPhraseIndex(0);
        setStatus(AppStatus.READY);
    } catch (error) {
        console.error("Load Phrases Error", error);
        // Fallback to local data to avoid eternal loop
        setPhrases(getRandomPhrases(5));
        setStatus(AppStatus.READY);
    }
  }, [gameState.courseProgressIndex, stopAudio]);

  useEffect(() => { loadPhrases(appMode); }, [appMode]);

  const handleAudioRecorded = async (base64: string, mimeType: string, url: string) => {
    stopAudio();
    setStatus(AppStatus.PROCESSING_AUDIO);
    setUserAudioUrl(url);
    if (appMode === 'conversation') {
        setChatHistory(prev => [...prev, { role: 'user', text: "..." }]);
        const response = await processConversationTurn(base64, mimeType, chatHistory);
        setChatHistory(prev => {
            const next = [...prev];
            next[next.length - 1] = { role: 'user', text: response.transcription };
            return [...next, { role: 'model', text: response.response, translation: response.translation, feedback: response.feedback }];
        });
        setStatus(AppStatus.READY);
        speakText(response.response);
    } else {
        const currentPhrase = phrases[currentPhraseIndex];
        const result = await validatePronunciation(base64, mimeType, currentPhrase.english, currentPhrase.difficulty);
        setResult(result);
        setStatus(AppStatus.FEEDBACK);
        if (result.isCorrect) {
            setGameState(prev => {
                const today = new Date().toISOString().split('T')[0];
                const newHistory = [...prev.history];
                const todayEntryIndex = newHistory.findIndex(h => h.date === today);
                if (todayEntryIndex >= 0) newHistory[todayEntryIndex].score += result.score;
                else newHistory.push({ date: today, score: result.score });
                return { ...prev, score: prev.score + result.score, phrasesCompleted: prev.phrasesCompleted + 1, courseProgressIndex: appMode === 'course' ? prev.courseProgressIndex + 1 : prev.courseProgressIndex, history: newHistory, streak: prev.streak || 1 };
            });
        }
    }
  };

  const handleNext = () => {
    stopAudio();
    setResult(null);
    setUserAudioUrl(null);
    if (currentPhraseIndex < phrases.length - 1) {
      setCurrentPhraseIndex(prev => prev + 1);
      setStatus(AppStatus.READY);
    } else {
      loadPhrases(appMode, false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden font-sans">
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0 z-20">
         <div className="flex items-center gap-3">
             <button onClick={() => setShowProfileSetup(true)} className="group relative">
                 <div className={`w-9 h-9 rounded-full ${currentUser.avatarColor} flex items-center justify-center text-white font-bold shadow-sm`}>{currentUser.name.charAt(0).toUpperCase()}</div>
             </button>
             <div className="flex flex-col">
                 <h1 className="text-sm font-bold text-gray-800 leading-tight">FluentFlow</h1>
                 <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-bold uppercase">{appMode === 'course' ? 'Jornada' : appMode}</span>
             </div>
         </div>
         <div className="flex items-center gap-2">
             <button onClick={() => setShowHistory(true)} className="p-2 rounded-full text-gray-400 hover:text-indigo-600 transition-colors"><BarChart className="w-5 h-5" /></button>
             <button onClick={() => setShowSettings(!showSettings)} className="p-2 rounded-full text-gray-400 hover:text-indigo-600 transition-colors"><Settings className="w-5 h-5" /></button>
             {showSettings && (
                <div className="absolute right-4 top-16 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50 animate-fade-in-up">
                    {['course', 'conversation', 'practice', 'words'].map(mode => (
                        <button key={mode} onClick={() => { setAppMode(mode as AppMode); setShowSettings(false); }} className={`w-full text-left px-4 py-2.5 text-sm font-medium ${appMode === mode ? 'text-indigo-600 bg-indigo-50' : 'text-gray-600'}`}>{mode.charAt(0).toUpperCase() + mode.slice(1)}</button>
                    ))}
                    <button onClick={onLogout} className="w-full text-left px-4 py-2 text-sm text-red-500 border-t mt-2">Sair</button>
                </div>
             )}
         </div>
      </header>

      <main className="flex-1 flex flex-col relative overflow-y-auto overflow-x-hidden max-w-lg mx-auto w-full">
         <div className="pt-2 px-4 shrink-0"><ScoreBoard state={gameState} totalPhrases={1000} /></div>
         <div className="shrink-0 relative h-[16vh] min-h-[110px]">
             <Avatar3D isSpeaking={isAvatarSpeaking} isRecording={status === AppStatus.RECORDING || status === AppStatus.PROCESSING_AUDIO} audioAnalyser={audioAnalyser} disableHeadMotion={disableHeadMotion} />
             {appMode === 'conversation' && (
                 <div className="absolute inset-x-4 bottom-4 top-4 flex flex-col justify-end pointer-events-none">
                     <div ref={chatContainerRef} className="overflow-y-auto space-y-3 p-4 pointer-events-auto max-h-[100%] custom-scrollbar pb-8 mask-gradient-top">
                         {chatHistory.map((msg, idx) => (
                             <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in-up`}>
                                 <div className={`px-4 py-3 rounded-2xl max-w-[85%] shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'}`}>
                                     <p className="text-sm">{msg.text}</p>
                                 </div>
                             </div>
                         ))}
                     </div>
                 </div>
             )}
         </div>

         <div className="bg-white rounded-t-[32px] shadow-2xl p-5 pb-8 relative z-10 flex-1 flex flex-col justify-start">
            {status === AppStatus.LOADING_PHRASES ? (
                <div className="h-48 flex flex-col items-center justify-center text-gray-400 gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                    <p className="text-xs font-bold uppercase">Carregando...</p>
                </div>
            ) : appMode === 'conversation' ? (
                <div className="flex flex-col items-center gap-4 mt-4">
                     <AudioRecorder ref={recorderRef} onAudioRecorded={handleAudioRecorded} isProcessing={status === AppStatus.PROCESSING_AUDIO} disabled={isAvatarSpeaking || status === AppStatus.PROCESSING_AUDIO} />
                </div>
            ) : status === AppStatus.FEEDBACK && result ? (
                <div className="flex flex-col items-center animate-fade-in-up w-full">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 ${result.isCorrect ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {result.isCorrect ? <CheckCircle className="w-7 h-7" /> : <XCircle className="w-7 h-7" />}
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 mb-1">{result.score}%</h2>
                    <p className="text-center text-gray-600 mb-4 px-4 text-sm leading-relaxed">{result.feedback}</p>
                    <div className="flex gap-3 w-full mt-auto">
                        <button onClick={() => { setResult(null); setStatus(AppStatus.READY); stopAudio(); }} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl text-sm">Tentar Novamente</button>
                        <button onClick={handleNext} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl text-sm shadow-md">Próxima</button>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-4 animate-fade-in-up w-full">
                    {phrases.length > 0 && <PhraseCard phrase={phrases[currentPhraseIndex]} onSpeak={() => isAvatarSpeaking ? stopAudio() : speakText(phrases[currentPhraseIndex].english)} isSpeaking={isAvatarSpeaking} />}
                    <div className="flex justify-center mt-2"><AudioRecorder ref={recorderRef} onAudioRecorded={handleAudioRecorded} isProcessing={status === AppStatus.PROCESSING_AUDIO} disabled={isAvatarSpeaking} /></div>
                </div>
            )}
         </div>
      </main>
      <audio ref={userAudioRef} className="hidden" />
      {showProfileSetup && <ProfileSetup initialProfile={currentUser} onSave={(d) => { onUpdateUser({ ...currentUser, ...d }); setShowProfileSetup(false); }} onCancel={() => setShowProfileSetup(false)} />}
      {showHistory && <ProgressHistory state={gameState} onClose={() => setShowHistory(false)} />}
    </div>
  );
};

const App: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>(() => {
    try { const saved = localStorage.getItem(USERS_KEY); return saved ? JSON.parse(saved) : []; } catch (e) { return []; }
  });
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  useEffect(() => { localStorage.setItem(USERS_KEY, JSON.stringify(users)); }, [users]);

  return (
    <ErrorBoundary>
      {!currentUser ? (
        <LoginScreen users={users} onLogin={setCurrentUser} onCreateNew={() => setCurrentUser({ id: `user_${Date.now()}`, name: '', avatarColor: 'bg-indigo-500', joinedDate: Date.now(), role: 'user' })} />
      ) : (
        <AppContent currentUser={currentUser} onLogout={() => setCurrentUser(null)} onUpdateUser={(u) => { setUsers(prev => prev.some(e => e.id === u.id) ? prev.map(e => e.id === u.id ? u : e) : [...prev, u]); setCurrentUser(u); }} />
      )}
    </ErrorBoundary>
  );
};

export default App;
