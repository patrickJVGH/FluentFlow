
import React, { Component, useState, useEffect, useRef, useCallback, ErrorInfo, ReactNode } from 'react';
import { AppStatus, GameState, Phrase, PronunciationResult, TOPICS, AppMode, UserProfile, USER_RANKS } from './types';
import { generatePhrases, validatePronunciation, generateSpeech, generateWords } from './services/geminiService';
import { getCoursePhrases, getRandomPhrases } from './phrases';
import { PhraseCard } from './components/PhraseCard';
import { AudioRecorder, AudioRecorderRef } from './components/AudioRecorder';
import { ScoreBoard } from './components/ScoreBoard';
import { Avatar3D } from './components/Avatar3D';
import { ProfileSetup } from './components/ProfileSetup';
import { LoginScreen } from './components/LoginScreen';
import { AdminDashboard } from './components/AdminDashboard';
import { BookOpen, RefreshCw, CheckCircle, XCircle, ArrowRight, Volume2, BarChart, Loader2, Zap, Settings, GraduationCap, Sparkles, Play, Music, Type as TypeIcon, Video, VideoOff, User, Crown, Edit2, LogOut, AlertTriangle, Save, Shuffle } from 'lucide-react';

const USERS_KEY = 'fluentflow_users';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // Fix TS error: Property 'props' does not exist on type 'ErrorBoundary'.
  declare props: ErrorBoundaryProps;

  state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="bg-white p-8 rounded-xl shadow-lg max-w-lg w-full border border-red-100">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Ops! Something went wrong.</h2>
            <p className="text-gray-600 mb-4">The application encountered an error. Please try refreshing the page.</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Refresh Application
            </button>
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
  
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  
  // Settings
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [disableHeadMotion, setDisableHeadMotion] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Audio State
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false);
  const [audioAnalyser, setAudioAnalyser] = useState<AnalyserNode | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  
  // Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const userAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioCacheRef = useRef<Map<string, AudioBuffer>>(new Map());
  const recorderRef = useRef<AudioRecorderRef>(null);
  
  const activeRequestIdRef = useRef<number>(0);

  // Dynamic Storage Key based on User ID
  const storageKey = `fluentflow_progress_${currentUser.id}`;

  // Load Game State
  const [gameState, setGameState] = useState<GameState>(() => {
    // Attempt to load ANY existing progress for this ID, even if guest, 
    // to support the conversion flow where we keep the ID.
    try {
      const saved = localStorage.getItem(storageKey);
      const defaultState = {
        score: 0,
        streak: 0,
        currentLevel: 1,
        phrasesCompleted: 0,
        courseProgressIndex: 0
      };
      
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...defaultState, ...parsed };
      }
      return defaultState;
    } catch (e) {
      console.error("Failed to load game state", e);
      return { score: 0, streak: 0, currentLevel: 1, phrasesCompleted: 0, courseProgressIndex: 0 };
    }
  });

  const [selectedTopic, setSelectedTopic] = useState<string>(TOPICS[0]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');

  // Save Game State Changes
  useEffect(() => {
    // We now SAVE progress even for guests temporarily, so if they convert, it's there.
    try {
      localStorage.setItem(storageKey, JSON.stringify(gameState));
    } catch (e) {
      console.error("Failed to save game state", e);
    }
  }, [gameState, storageKey]);

  useEffect(() => {
    audioCacheRef.current.clear();
  }, [selectedTopic, appMode]);

  const stopAllAudio = useCallback(() => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch(e) {}
      sourceNodeRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsAvatarSpeaking(false);
    setIsGeneratingAudio(false);

    if (userAudioRef.current) {
      userAudioRef.current.pause();
      userAudioRef.current.currentTime = 0;
    }
  }, []);

  const saveProfile = (data: Omit<UserProfile, 'id' | 'role'>) => {
    // Check if promoting from guest to user
    const newRole = currentUser.role === 'guest' ? 'user' : currentUser.role;
    
    // Create updated profile
    const updatedUser: UserProfile = { 
      ...currentUser, 
      ...data, 
      role: newRole 
    };

    onUpdateUser(updatedUser);
    setShowProfileSetup(false);
    setShowSettings(false);
  };

  const getRank = (score: number) => {
    return [...USER_RANKS].reverse().find(r => score >= r.minScore) || USER_RANKS[0];
  };

  const loadContent = useCallback(async () => {
    const requestId = Date.now();
    activeRequestIdRef.current = requestId;

    stopAllAudio();
    setStatus(AppStatus.LOADING_PHRASES);
    setResult(null);
    setUserAudioUrl(null);
    
    audioCacheRef.current.clear();

    try {
      if (appMode === 'course') {
        const coursePhrases = getCoursePhrases(gameState.courseProgressIndex, 5);
        
        if (activeRequestIdRef.current !== requestId) return;

        if (coursePhrases.length === 0) {
          setPhrases(getCoursePhrases(0, 5));
          alert("Parabéns! Você completou todas as frases disponíveis. Recomeçando do início.");
          setGameState(prev => ({ ...prev, courseProgressIndex: 0 }));
        } else {
          setPhrases(coursePhrases);
        }
        setCurrentPhraseIndex(0);
        setStatus(AppStatus.READY);

      } else if (appMode === 'practice') {
        const newPhrases = await generatePhrases(selectedTopic, selectedDifficulty, 5);
        if (activeRequestIdRef.current !== requestId) return;
        setPhrases(newPhrases);
        setCurrentPhraseIndex(0);
        setStatus(AppStatus.READY);

      } else if (appMode === 'words') {
        const newWords = await generateWords(selectedTopic, selectedDifficulty, 5);
        if (activeRequestIdRef.current !== requestId) return;
        setPhrases(newWords);
        setCurrentPhraseIndex(0);
        setStatus(AppStatus.READY);

      } else if (appMode === 'random') {
        // New Random Mode: Get 5 random phrases from the entire library
        const randomPhrases = getRandomPhrases(5);
        if (activeRequestIdRef.current !== requestId) return;
        setPhrases(randomPhrases);
        setCurrentPhraseIndex(0);
        setStatus(AppStatus.READY);
      }
    } catch (error) {
      if (activeRequestIdRef.current !== requestId) return;
      console.error(error);
      setStatus(AppStatus.ERROR);
    }
  }, [appMode, gameState.courseProgressIndex, selectedTopic, selectedDifficulty, stopAllAudio]);

  useEffect(() => {
    loadContent();
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(e => console.warn("Context already closed", e));
      }
      audioContextRef.current = null;
      stopAllAudio();
    };
  }, [loadContent, stopAllAudio]); 

  // --- SOUND EFFECTS LOGIC ---
  const playSFX = useCallback((type: 'correct' | 'incorrect' | 'streak') => {
    if (!sfxEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      const now = ctx.currentTime;
      if (type === 'correct') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(500, now);
        osc.frequency.exponentialRampToValueAtTime(1000, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'incorrect') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(100, now + 0.2);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'streak') {
        [523.25, 659.25, 783.99].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'sine';
          osc.frequency.value = freq;
          const startTime = now + (i * 0.1);
          gain.gain.setValueAtTime(0, startTime);
          gain.gain.linearRampToValueAtTime(0.1, startTime + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);
          osc.start(startTime);
          osc.stop(startTime + 0.4);
        });
      }
    } catch (e) { console.error("Error playing SFX", e); }
  }, [sfxEnabled]);

  const base64ToUint8Array = (base64String: string): Uint8Array => {
    const binaryString = window.atob(base64String);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const decodePCM = (data: Uint8Array, ctx: AudioContext, sampleRate: number = 24000): AudioBuffer => {
    const dataInt16 = new Int16Array(data.buffer);
    const numChannels = 1;
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  }

  const speakText = useCallback(async (text: string) => {
    if (isGeneratingAudio || !text) return; 
    stopAllAudio(); 
    setIsGeneratingAudio(true);
    setIsAvatarSpeaking(true);
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
    }
    const ctx = audioContextRef.current;
    const playAudioBuffer = async (buffer: AudioBuffer) => {
      try {
        if (ctx.state === 'suspended') await ctx.resume();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512; 
        analyser.smoothingTimeConstant = 0.5;
        setAudioAnalyser(analyser);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(analyser);
        analyser.connect(ctx.destination);
        sourceNodeRef.current = source;
        source.onended = () => { setIsAvatarSpeaking(false); setIsGeneratingAudio(false); };
        source.start(0);
      } catch (err) {
        console.error("Audio Playback Error:", err);
        setIsAvatarSpeaking(false);
        setIsGeneratingAudio(false);
      }
    };
    const playBrowserTTS = () => {
      try {
        if ('speechSynthesis' in window) {
           const utterance = new SpeechSynthesisUtterance(text);
           utterance.lang = 'en-US';
           utterance.rate = 0.9;
           utterance.onstart = () => { setAudioAnalyser(null); };
           const handleEnd = () => { setIsAvatarSpeaking(false); setIsGeneratingAudio(false); };
           utterance.onend = handleEnd;
           utterance.onerror = (e) => { console.error("Browser TTS error:", e); handleEnd(); };
           window.speechSynthesis.speak(utterance);
        } else { throw new Error("Browser does not support TTS"); }
      } catch (fallbackError) {
        console.error("All TTS methods failed", fallbackError);
        setIsAvatarSpeaking(false);
        setIsGeneratingAudio(false);
        alert("Não foi possível reproduzir o áudio.");
      }
    };
    if (audioCacheRef.current.has(text)) {
      await playAudioBuffer(audioCacheRef.current.get(text)!);
      return;
    }
    try {
      const timeoutPromise = new Promise<string | null>((_, reject) => {
        setTimeout(() => reject(new Error("Timeout")), 60000); 
      });
      const audioBase64 = await Promise.race([ generateSpeech(text), timeoutPromise ]);
      if (audioBase64) {
        const audioBytes = base64ToUint8Array(audioBase64);
        const audioBuffer = decodePCM(audioBytes, ctx);
        audioCacheRef.current.set(text, audioBuffer);
        await playAudioBuffer(audioBuffer);
      } else { playBrowserTTS(); }
    } catch (error) {
      console.warn("Gemini TTS timed out or failed, using browser fallback.", error);
      playBrowserTTS();
    }
  }, [isGeneratingAudio, stopAllAudio]);

  const playUserAudio = () => {
    stopAllAudio();
    if (userAudioUrl) {
      if (!userAudioRef.current) {
        userAudioRef.current = new Audio(userAudioUrl);
      } else {
        userAudioRef.current.src = userAudioUrl;
      }
      userAudioRef.current.play().catch(e => console.error("Error playing user audio", e));
    }
  };

  const nextPhrase = useCallback(() => {
    stopAllAudio();
    setResult(null);
    setUserAudioUrl(null);
    if (currentPhraseIndex < phrases.length - 1) {
      setCurrentPhraseIndex(prev => prev + 1);
      setStatus(AppStatus.READY);
    } else {
      if (appMode === 'course') {
        const newIndex = gameState.courseProgressIndex + phrases.length;
        setGameState(prev => ({ ...prev, courseProgressIndex: newIndex }));
      } else if (appMode === 'practice') {
        setGameState(prev => ({ ...prev, currentLevel: prev.currentLevel + 1 }));
        loadContent();
      } else if (appMode === 'words') {
        loadContent();
      } else if (appMode === 'random') {
        loadContent(); // Just fetch more random phrases
      }
    }
  }, [currentPhraseIndex, phrases.length, appMode, gameState.courseProgressIndex, loadContent, stopAllAudio]);

  const retryPhrase = () => {
    stopAllAudio();
    setResult(null);
    setUserAudioUrl(null);
    setStatus(AppStatus.READY);
  };

  const handleAudioRecorded = async (base64: string, mimeType: string, audioUrl: string) => {
    stopAllAudio();
    setStatus(AppStatus.PROCESSING_AUDIO);
    setUserAudioUrl(audioUrl);
    const currentPhrase = phrases[currentPhraseIndex];
    if (!currentPhrase) return;
    const validation = await validatePronunciation(base64, mimeType, currentPhrase.english, currentPhrase.difficulty);
    let finalIsCorrect = validation.isCorrect;
    if (appMode === 'words') {
        finalIsCorrect = validation.score >= 90;
        validation.isCorrect = finalIsCorrect;
        if (!finalIsCorrect && validation.score >= 70) {
             validation.feedback = `Quase lá! Mas para treino de palavras precisamos de 90%. Você atingiu ${validation.score}%. Tente novamente.`;
        }
    }
    setResult(validation);
    if (finalIsCorrect) {
      const newStreak = gameState.streak + 1;
      const isStreakMilestone = newStreak > 0 && newStreak % 3 === 0;
      if (isStreakMilestone) playSFX('streak'); else playSFX('correct');
      setGameState(prev => ({
        ...prev,
        score: prev.score + validation.score + (prev.streak * 5),
        streak: newStreak,
        phrasesCompleted: prev.phrasesCompleted + 1
      }));
    } else {
      playSFX('incorrect');
      setGameState(prev => ({ ...prev, streak: 0 }));
    }
    setStatus(AppStatus.FEEDBACK);
  };
  
  const resetProgress = () => {
    if (window.confirm("Isso irá resetar todo seu progresso e voltar ao início. Tem certeza?")) {
      const newState = { score: 0, streak: 0, currentLevel: 1, phrasesCompleted: 0, courseProgressIndex: 0 };
      setGameState(newState);
      if (currentUser.role !== 'guest') {
        localStorage.setItem(storageKey, JSON.stringify(newState));
      }
      window.location.reload();
    }
  };

  const currentRank = getRank(gameState.score);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center font-sans selection:bg-indigo-100 selection:text-indigo-900 md:p-4">
      {/* --- Main Mobile Container --- */}
      <div className="w-full max-w-[480px] bg-white md:rounded-[32px] md:shadow-2xl overflow-hidden min-h-screen md:min-h-[850px] md:max-h-[95vh] flex flex-col relative border-x border-gray-200/50">
      
      {/* --- PROFILE SETUP MODAL --- */}
      {showProfileSetup && (
        <ProfileSetup 
          initialProfile={currentUser} 
          onSave={saveProfile} 
          onCancel={() => setShowProfileSetup(false)} 
        />
      )}

      {/* GUEST BANNER */}
      {currentUser.role === 'guest' && (
        <div 
            onClick={() => setShowProfileSetup(true)}
            className="bg-orange-500 text-white text-center text-[11px] py-1.5 font-bold flex items-center justify-center gap-2 cursor-pointer hover:bg-orange-600 transition-colors z-20"
        >
           <AlertTriangle className="w-3 h-3" />
           Modo Visitante: Toque para Salvar Progresso
        </div>
      )}

      <header className="bg-white sticky top-0 z-10 border-b border-gray-100 pb-1">
        <div className="px-4 py-2">
          <div className="flex flex-col gap-3">
            
            {/* Top Row: Brand & Profile */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="bg-indigo-600 p-1.5 rounded-lg shadow-sm">
                  <BookOpen className="text-white w-4 h-4" />
                </div>
                <h1 className="text-lg font-extrabold tracking-tight text-gray-800">FluentFlow</h1>
              </div>

              <div 
                  className={`flex items-center gap-2 pl-2 pr-3 py-1 rounded-full border cursor-pointer transition-all ${
                    currentUser.role === 'guest' 
                        ? 'bg-orange-50 border-orange-200 hover:bg-orange-100' 
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                  onClick={() => setShowProfileSetup(true)}
                  title={currentUser.role === 'guest' ? "Converter para Perfil Permanente" : "Editar Perfil"}
                >
                  <div className={`w-8 h-8 rounded-full ${currentUser.avatarColor} flex items-center justify-center text-white text-xs font-bold shadow-sm ring-2 ring-white`}>
                     {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-gray-800 leading-tight max-w-[90px] truncate">{currentUser.name}</span>
                    <span className={`text-[10px] font-bold ${currentUser.role === 'guest' ? 'text-orange-500' : currentRank.color} uppercase tracking-wider flex items-center gap-1`}>
                      {currentUser.role === 'guest' ? <Save className="w-2 h-2"/> : <Crown className="w-2 h-2" />} 
                      {currentUser.role === 'guest' ? 'SALVAR' : currentRank.title}
                    </span>
                  </div>
                </div>
            </div>
            
            {/* Mode Switcher */}
            <div className="flex bg-gray-100 p-1 rounded-xl gap-1 overflow-x-auto no-scrollbar">
              <button onClick={() => setAppMode('course')} className={`flex-1 flex items-center justify-center px-2 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${appMode === 'course' ? 'bg-white text-indigo-700 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>
                <GraduationCap className="w-3 h-3 mr-1.5" /> Jornada
              </button>
              <button onClick={() => setAppMode('practice')} className={`flex-1 flex items-center justify-center px-2 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${appMode === 'practice' ? 'bg-white text-indigo-700 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>
                <Sparkles className="w-3 h-3 mr-1.5" /> IA
              </button>
               <button onClick={() => setAppMode('words')} className={`flex-1 flex items-center justify-center px-2 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${appMode === 'words' ? 'bg-white text-indigo-700 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>
                <TypeIcon className="w-3 h-3 mr-1.5" /> Palavras
              </button>
              <button onClick={() => setAppMode('random')} className={`flex-1 flex items-center justify-center px-2 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${appMode === 'random' ? 'bg-white text-indigo-700 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>
                <Shuffle className="w-3 h-3 mr-1.5" /> Mix
              </button>
            </div>

            {/* Config & Progress Bar Row */}
            <div className="flex items-center justify-between mt-1">
                {appMode === 'course' && (
                  <div className="flex items-center gap-2 text-xs font-bold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full border border-indigo-100">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
                    {gameState.courseProgressIndex} / 1000 XP
                  </div>
                )}
                
                {(appMode === 'practice' || appMode === 'words') && (
                     <div className="flex items-center gap-2">
                        <select value={selectedDifficulty} onChange={(e) => setSelectedDifficulty(e.target.value as any)} className="text-xs bg-gray-50 border border-gray-200 rounded-lg text-gray-700 font-bold py-1 px-2 focus:ring-0">
                            <option value="easy">Easy</option>
                            <option value="medium">Med</option>
                            <option value="hard">Hard</option>
                        </select>
                        <select value={selectedTopic} onChange={(e) => setSelectedTopic(e.target.value)} className="text-xs bg-gray-50 border border-gray-200 rounded-lg text-gray-700 font-medium py-1 px-2 focus:ring-0 max-w-[120px] truncate">
                            {TOPICS.map(topic => ( <option key={topic} value={topic}>{topic}</option> ))}
                        </select>
                    </div>
                )}
                
                {/* Visual indicator for Random Mode */}
                {appMode === 'random' && (
                   <div className="flex items-center gap-2 text-xs font-bold bg-purple-50 text-purple-700 px-3 py-1 rounded-full border border-purple-100">
                    <Shuffle className="w-3 h-3" />
                    <span>Modo Aleatório</span>
                  </div>
                )}

                <button 
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-1.5 rounded-lg transition-colors border ml-auto ${showSettings ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-gray-400 border-gray-100 hover:text-indigo-500'}`}
                >
                  <Settings className="w-4 h-4" />
                </button>
            </div>

              {showSettings && (
                <div className="absolute top-32 right-4 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 p-2 z-30 flex flex-col gap-1 animate-fade-in-up">
                  {currentUser.role !== 'guest' && (
                     <button onClick={() => { setShowProfileSetup(true); setShowSettings(false); }} className="flex items-center gap-2 text-xs text-gray-700 hover:bg-gray-50 p-2 rounded-lg transition-colors w-full text-left font-semibold">
                       <Edit2 className="w-3.5 h-3.5 text-gray-500" /> Editar Perfil
                     </button>
                  )}
                  <div className="flex items-center justify-between px-2 py-1.5 hover:bg-gray-50 rounded-lg">
                    <span className="text-xs font-semibold text-gray-600 flex items-center gap-2"> <Music className="w-3.5 h-3.5" /> Sons </span>
                    <button onClick={() => setSfxEnabled(!sfxEnabled)} className={`w-8 h-4 rounded-full transition-colors relative ${sfxEnabled ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                      <div className={`absolute top-0.5 left-0.5 bg-white w-3 h-3 rounded-full transition-transform ${sfxEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between px-2 py-1.5 hover:bg-gray-50 rounded-lg">
                    <span className="text-xs font-semibold text-gray-600 flex items-center gap-2"> {disableHeadMotion ? <VideoOff className="w-3.5 h-3.5"/> : <Video className="w-3.5 h-3.5"/>} Avatar 3D </span>
                    <button onClick={() => setDisableHeadMotion(!disableHeadMotion)} className={`w-8 h-4 rounded-full transition-colors relative ${!disableHeadMotion ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                      <div className={`absolute top-0.5 left-0.5 bg-white w-3 h-3 rounded-full transition-transform ${!disableHeadMotion ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <hr className="border-gray-100 my-1" />
                  <button onClick={resetProgress} className="text-[10px] text-red-500 hover:bg-red-50 p-2 rounded-lg text-left font-semibold">
                    Resetar Progresso
                  </button>
                  <button onClick={onLogout} className="flex items-center gap-2 text-xs text-gray-600 hover:bg-gray-100 p-2 rounded-lg transition-colors w-full text-left font-semibold">
                     <LogOut className="w-3.5 h-3.5 text-gray-400" /> Sair
                  </button>
                </div>
              )}
          </div>
      </header>

      <main className="flex-1 flex flex-col relative overflow-hidden bg-gray-50/50">
        
        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-28 custom-scrollbar">
            
            <ScoreBoard state={gameState} totalPhrases={appMode === 'course' ? 1000 : gameState.phrasesCompleted + 5} />

            {status === AppStatus.LOADING_PHRASES && (
            <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                <RefreshCw className="w-10 h-10 text-indigo-400 animate-spin mb-4" />
                <p className="text-sm text-gray-500 font-semibold">
                {appMode === 'course' ? 'Carregando Jornada...' : appMode === 'random' ? 'Embaralhando Frases...' : 'Criando Lição com IA...'}
                </p>
            </div>
            )}

            {status === AppStatus.ERROR && (
            <div className="text-center py-20">
                <p className="text-red-500 mb-4 text-sm font-semibold">Erro de conexão.</p>
                <button onClick={() => loadContent()} className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-bold shadow-lg">Tentar Novamente</button>
            </div>
            )}

            {status !== AppStatus.LOADING_PHRASES && status !== AppStatus.ERROR && phrases.length > 0 && (
            <div className="flex flex-col items-center w-full max-w-sm mx-auto">
                
                {/* 3D Avatar Compact */}
                <div className="w-32 h-32 md:w-40 md:h-40 relative -mt-4 mb-2 shrink-0">
                    <Avatar3D 
                        isSpeaking={isAvatarSpeaking} 
                        isRecording={status === AppStatus.RECORDING}
                        audioAnalyser={audioAnalyser}
                        disableHeadMotion={disableHeadMotion}
                    />
                    <div className="absolute -bottom-2 left-0 right-0 text-center">
                         {isGeneratingAudio ? (
                            <span className="inline-flex items-center gap-1.5 text-[10px] bg-white/90 backdrop-blur px-3 py-1 rounded-full text-indigo-600 font-bold shadow-sm border border-indigo-100"> 
                                <Loader2 className="w-3 h-3 animate-spin" /> Gerando áudio... 
                            </span>
                        ) : (
                            <div className="inline-flex items-center gap-1.5 text-[10px] bg-white/80 backdrop-blur px-3 py-1 rounded-full text-gray-500 font-bold shadow-sm border border-gray-100"> 
                                <Zap className="w-3 h-3 text-indigo-500" /> 
                                <span>Toque no mic</span> 
                            </div>
                        )}
                    </div>
                </div>

                <PhraseCard 
                    phrase={phrases[currentPhraseIndex]} 
                    onSpeak={() => speakText(phrases[currentPhraseIndex]?.english)}
                    isSpeaking={isAvatarSpeaking || isGeneratingAudio}
                />

                {status === AppStatus.FEEDBACK && result && (
                    <div className={`w-full mt-4 p-4 rounded-2xl border-2 animate-fade-in-up shadow-sm ${result.isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-start space-x-3 mb-3">
                        {result.isCorrect ? ( <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" /> ) : ( <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" /> )}
                        <div className="flex-1">
                        <h3 className={`font-extrabold text-base mb-1 ${result.isCorrect ? 'text-green-800' : 'text-red-800'}`}> {result.isCorrect ? 'Excelente!' : 'Tente Novamente'} </h3>
                        <p className="text-gray-700 text-sm mb-2 leading-relaxed font-medium">{result.feedback}</p>
                        <div className="flex gap-2 mt-2 items-center">
                            {userAudioUrl && (
                            <button onClick={playUserAudio} className="flex items-center gap-1.5 text-[10px] bg-white border border-gray-300 px-2 py-1 rounded-md hover:bg-gray-50 text-gray-700 font-bold uppercase tracking-wide shadow-sm"> <Play className="w-2.5 h-2.5" /> Ouvir Gravação </button>
                            )}
                            <div className="text-xs font-bold text-gray-400 ml-auto self-center uppercase tracking-wider"> Precisão: <span className={`text-base ml-1 ${result.score >= (appMode === 'words' ? 90 : 80) ? 'text-green-600' : 'text-yellow-600'}`}>{result.score}%</span> </div>
                        </div>
                        </div>
                    </div>
                    {result.words && result.words.length > 0 && (
                        <div className="mb-3">
                        <div className="flex flex-wrap gap-1.5 justify-start">
                            {result.words.map((w, i) => (
                            <div key={i} className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border ${w.status === 'correct' ? 'bg-white border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}> {w.word} </div>
                            ))}
                        </div>
                        </div>
                    )}
                    
                    <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-gray-200/50">
                        {result.isCorrect ? (
                        <button onClick={nextPhrase} className="w-full flex items-center justify-center space-x-2 bg-green-600 text-white px-4 py-3 rounded-xl hover:bg-green-700 transition-colors shadow-lg shadow-green-200/50 font-bold active:scale-95 border-b-4 border-green-800"> <span>Próxima</span> <ArrowRight className="w-4 h-4" /> </button>
                        ) : (
                        <button onClick={retryPhrase} className="w-full flex items-center justify-center space-x-2 bg-white text-red-600 border-2 border-red-100 px-4 py-3 rounded-xl hover:bg-red-50 transition-colors font-bold active:scale-95 shadow-sm"> <span>Tentar Novamente</span> <RefreshCw className="w-4 h-4" /> </button>
                        )}
                        <button onClick={() => speakText(phrases[currentPhraseIndex].english)} className="w-full flex items-center justify-center space-x-2 text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg transition-colors text-xs font-bold uppercase tracking-wider" disabled={isAvatarSpeaking || isGeneratingAudio}>
                        {isGeneratingAudio ? ( <Loader2 className="w-3 h-3 animate-spin" /> ) : ( <Volume2 className={`w-3 h-3 ${isAvatarSpeaking ? 'animate-pulse' : ''}`} /> )} <span>Ouvir Frase Original</span>
                        </button>
                    </div>
                    </div>
                )}
            </div>
            )}
        </div>

        {/* Fixed Bottom Recorder Area */}
        {status !== AppStatus.LOADING_PHRASES && status !== AppStatus.ERROR && phrases.length > 0 && status !== AppStatus.FEEDBACK && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent pt-12 pb-6 px-4 flex justify-center z-10 pointer-events-none">
                <div className="pointer-events-auto">
                     <AudioRecorder ref={recorderRef} onAudioRecorded={handleAudioRecorded} isProcessing={status === AppStatus.PROCESSING_AUDIO} disabled={status !== AppStatus.READY || isAvatarSpeaking || isGeneratingAudio} />
                </div>
            </div>
        )}

      </main>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>(() => {
    try {
      const saved = localStorage.getItem(USERS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);

  const handleLogin = (user: UserProfile) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  const handleUpdateUser = (updatedUser: UserProfile) => {
    setCurrentUser(updatedUser);
    
    setUsers(prevUsers => {
      // If the user was already in the list, update them
      if (prevUsers.some(u => u.id === updatedUser.id)) {
        const newUsers = prevUsers.map(u => u.id === updatedUser.id ? updatedUser : u);
        localStorage.setItem(USERS_KEY, JSON.stringify(newUsers));
        return newUsers;
      } 
      // If they weren't in the list (e.g. guest converting to user), add them
      else if (updatedUser.role !== 'guest') {
        const newUsers = [...prevUsers, updatedUser];
        localStorage.setItem(USERS_KEY, JSON.stringify(newUsers));
        return newUsers;
      }
      return prevUsers;
    });
  };

  const handleDeleteUser = (userId: string) => {
    const newUsers = users.filter(u => u.id !== userId);
    setUsers(newUsers);
    localStorage.setItem(USERS_KEY, JSON.stringify(newUsers));
    localStorage.removeItem(`fluentflow_progress_${userId}`);
  };

  const handleCreateProfileSave = (profileData: Omit<UserProfile, 'id' | 'role'>) => {
      const newUser: UserProfile = {
          id: `user_${Date.now()}`,
          role: 'user',
          ...profileData
      };
      const newUsers = [...users, newUser];
      setUsers(newUsers);
      localStorage.setItem(USERS_KEY, JSON.stringify(newUsers));
      setCurrentUser(newUser);
      setIsCreatingProfile(false);
  };

  if (isCreatingProfile) {
      return (
          <ProfileSetup 
            onSave={handleCreateProfileSave}
            onCancel={() => setIsCreatingProfile(false)}
            existingNames={users.map(u => u.name)}
          />
      );
  }

  if (!currentUser) {
    return (
      <LoginScreen 
        users={users} 
        onLogin={handleLogin} 
        onCreateNew={() => setIsCreatingProfile(true)}
      />
    );
  }

  if (currentUser.role === 'admin') {
      return (
          <AdminDashboard 
            users={users} 
            onDeleteUser={handleDeleteUser} 
            onLogout={handleLogout} 
          />
      );
  }

  return (
    <ErrorBoundary>
      <AppContent 
        currentUser={currentUser} 
        onLogout={handleLogout} 
        onUpdateUser={handleUpdateUser}
      />
    </ErrorBoundary>
  );
};

export default App;
