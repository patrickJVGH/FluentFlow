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
import { BookOpen, RefreshCw, CheckCircle, XCircle, ArrowRight, Volume2, BarChart, Loader2, Zap, Settings, GraduationCap, Sparkles, Play, Music, Type as TypeIcon, Video, VideoOff, User, Crown, Edit2, LogOut, AlertTriangle, Save, MessageCircle, X, Languages } from 'lucide-react';

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
  
  // Chat State
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [translationModalContent, setTranslationModalContent] = useState<string | null>(null);
  
  // Initialize profile setup true if name is empty (new user)
  const [showProfileSetup, setShowProfileSetup] = useState(currentUser.name === '');
  
  // Settings
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [disableHeadMotion, setDisableHeadMotion] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Settings Menu Refs for Click Outside detection
  const settingsRef = useRef<HTMLDivElement>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);

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
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null); // To prevent GC of TTS object
  
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

  // Handle click outside settings menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        showSettings &&
        settingsRef.current &&
        !settingsRef.current.contains(event.target as Node) &&
        settingsBtnRef.current &&
        !settingsBtnRef.current.contains(event.target as Node)
      ) {
        setShowSettings(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSettings]);

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

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (appMode === 'conversation' && chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory, appMode]);

  const stopAllAudio = useCallback(() => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch(e) {}
      sourceNodeRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (utteranceRef.current) {
        utteranceRef.current = null;
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
        // Now fetches 12 phrases (cached) instead of 5
        const newPhrases = await generatePhrases(selectedTopic, selectedDifficulty, 12);
        if (activeRequestIdRef.current !== requestId) return;
        setPhrases(newPhrases);
        setCurrentPhraseIndex(0);
        setStatus(AppStatus.READY);

      } else if (appMode === 'words') {
        // Now fetches 12 words (cached) instead of 5
        const newWords = await generateWords(selectedTopic, selectedDifficulty, 12);
        if (activeRequestIdRef.current !== requestId) return;
        setPhrases(newWords);
        setCurrentPhraseIndex(0);
        setStatus(AppStatus.READY);

      } else if (appMode === 'conversation') {
        // Initialize Conversation Mode
        if (chatHistory.length === 0) {
             setChatHistory([
                 { 
                     role: 'model', 
                     text: "Hello! I'm your English conversation tutor. What would you like to talk about today?",
                     translation: "Olá! Sou seu tutor de conversação em inglês. Sobre o que você gostaria de conversar hoje?"
                 }
             ]);
        }
        setStatus(AppStatus.READY);
      }
    } catch (error) {
      if (activeRequestIdRef.current !== requestId) return;
      console.error(error);
      setStatus(AppStatus.ERROR);
    }
  }, [appMode, gameState.courseProgressIndex, selectedTopic, selectedDifficulty, stopAllAudio, chatHistory.length]);

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
      // Clean up SFX context after playing
      setTimeout(() => {
        if (ctx.state !== 'closed') ctx.close();
      }, 1000);
    } catch (e) { console.error("Error playing SFX", e); }
  }, [sfxEnabled]);

  const speakText = useCallback(async (text: string) => {
    if (isGeneratingAudio || !text) return; 
    stopAllAudio(); 
    
    // 3. STRATEGY: Native TTS Only (Save API Cost)
    try {
      if ('speechSynthesis' in window) {
          setIsAvatarSpeaking(true);
          const utterance = new SpeechSynthesisUtterance(text);
          utteranceRef.current = utterance; // Keep reference to prevent garbage collection
          
          utterance.lang = 'en-US';
          utterance.rate = 0.9;
          
          utterance.onstart = () => { setAudioAnalyser(null); }; 
          
          const handleEnd = () => { 
              setIsAvatarSpeaking(false); 
              setIsGeneratingAudio(false); 
              utteranceRef.current = null;
          };
          
          utterance.onend = handleEnd;
          
          utterance.onerror = (e) => { 
             // Ignore interruption errors (when user clicks quickly)
             if (e.error === 'interrupted' || e.error === 'canceled') {
                 setIsAvatarSpeaking(false);
                 return;
             }
             console.error("Browser TTS error:", e.error); 
             handleEnd(); 
          };
          
          window.speechSynthesis.speak(utterance);
      } else { 
          alert("Seu navegador não suporta áudio nativo.");
      }
    } catch (fallbackError) {
      console.error("TTS failed", fallbackError);
      setIsAvatarSpeaking(false);
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
      } else if (appMode === 'conversation') {
        // Not used in conversation mode
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

    // --- CONVERSATION MODE LOGIC ---
    if (appMode === 'conversation') {
        const turnResult = await processConversationTurn(base64, mimeType, chatHistory);
        
        // Add User's Turn
        const newHistory: ChatMessage[] = [
            ...chatHistory,
            { role: 'user', text: turnResult.transcription },
            { 
                role: 'model', 
                text: turnResult.response, 
                feedback: turnResult.feedback,
                translation: turnResult.translation 
            }
        ];
        
        setChatHistory(newHistory);
        setStatus(AppStatus.READY);
        
        // Play AI Response
        if (turnResult.response) {
            speakText(turnResult.response);
        }
        return;
    }

    // --- STANDARD MODES LOGIC (Course, Practice, Words) ---
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
      setChatHistory([]);
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

      {/* --- TRANSLATION POPUP MODAL --- */}
      {translationModalContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-fade-in-up">
            <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-xs relative flex flex-col gap-3 text-center">
                 <button onClick={() => setTranslationModalContent(null)} className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 bg-gray-50 p-1.5 rounded-full">
                     <X className="w-4 h-4" />
                 </button>
                 <div className="flex justify-center mb-1">
                     <div className="bg-indigo-100 p-2 rounded-full text-indigo-600">
                         <Languages className="w-6 h-6" />
                     </div>
                 </div>
                 <h3 className="font-bold text-gray-800">Tradução</h3>
                 <p className="text-gray-600 italic font-medium leading-relaxed">"{translationModalContent}"</p>
                 <button onClick={() => setTranslationModalContent(null)} className="mt-2 w-full py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm">Fechar</button>
            </div>
        </div>
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
              <button onClick={() => setAppMode('conversation')} className={`flex-1 flex items-center justify-center px-2 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${appMode === 'conversation' ? 'bg-white text-indigo-700 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>
                <MessageCircle className="w-3 h-3 mr-1.5" /> Conversar
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
                
                {/* Visual indicator for Conversation Mode */}
                {appMode === 'conversation' && (
                   <div className="flex items-center gap-2 text-xs font-bold bg-green-50 text-green-700 px-3 py-1 rounded-full border border-green-100">
                    <MessageCircle className="w-3 h-3" />
                    <span>Role Play</span>
                  </div>
                )}

                <button 
                  ref={settingsBtnRef}
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-1.5 rounded-lg transition-colors border ml-auto ${showSettings ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-gray-400 border-gray-100 hover:text-indigo-500'}`}
                >
                  <Settings className="w-4 h-4" />
                </button>
            </div>

              {showSettings && (
                <div ref={settingsRef} className="absolute top-32 right-4 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 p-2 z-30 flex flex-col gap-1 animate-fade-in-up">
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
        <div className="flex-1 overflow-y-auto px-4 pt-4 custom-scrollbar">
            
            <ScoreBoard state={gameState} totalPhrases={appMode === 'course' ? 1000 : gameState.phrasesCompleted + 5} />

            {status === AppStatus.LOADING_PHRASES && (
            <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                <RefreshCw className="w-10 h-10 text-indigo-400 animate-spin mb-4" />
                <p className="text-sm text-gray-500 font-semibold">
                {appMode === 'course' ? 'Carregando Jornada...' : appMode === 'conversation' ? 'Iniciando Conversa...' : 'Criando Lição com IA...'}
                </p>
            </div>
            )}

            {status === AppStatus.ERROR && (
            <div className="text-center py-20">
                <p className="text-red-500 mb-4 text-sm font-semibold">Erro de conexão.</p>
                <button onClick={() => loadContent()} className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-bold shadow-lg">Tentar Novamente</button>
            </div>
            )}

            {status !== AppStatus.LOADING_PHRASES && status !== AppStatus.ERROR && (
            <div className="flex flex-col items-center w-full max-w-sm mx-auto h-full relative">
                
                {/* 3D Avatar Area - Compact Landscape Container */}
                <div className="w-full h-32 relative mb-4 flex justify-center items-center z-0 shrink-0">
                     <div className="w-full h-full relative">
                        <Avatar3D 
                            isSpeaking={isAvatarSpeaking} 
                            isRecording={status === AppStatus.RECORDING}
                            audioAnalyser={audioAnalyser}
                            disableHeadMotion={disableHeadMotion}
                        />
                        <div className="absolute -bottom-1 left-0 right-0 text-center pointer-events-none z-10">
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
                </div>

                {/* --- CONTENT RENDER LOGIC --- */}
                
                {appMode === 'conversation' ? (
                   // --- CONVERSATION / CHAT VIEW ---
                   <div 
                      ref={chatContainerRef}
                      className="w-full flex-1 overflow-y-auto px-2 space-y-4 mb-4 pb-40" // pb-40 ensures button doesn't cover text
                   >
                       {chatHistory.map((msg, index) => (
                           <div key={index} className={`flex w-full flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                               <div className={`max-w-[85%] p-3.5 rounded-2xl shadow-sm border text-sm font-medium leading-relaxed relative group ${
                                   msg.role === 'user' 
                                   ? 'bg-indigo-600 text-white rounded-br-none border-indigo-600' 
                                   : 'bg-white text-gray-800 rounded-bl-none border-gray-100'
                               }`}>
                                   <p className="pr-2">{msg.text}</p>
                                   
                                   {/* Message Action Buttons */}
                                   <div className={`flex items-center gap-2 mt-2 pt-2 border-t ${msg.role === 'user' ? 'border-indigo-500/30' : 'border-gray-100'}`}>
                                       <button 
                                           onClick={() => speakText(msg.text)}
                                           className={`p-1 rounded-full hover:bg-black/10 transition-colors ${msg.role === 'user' ? 'text-indigo-100' : 'text-gray-400'}`}
                                           title="Ouvir"
                                       >
                                           <Volume2 className="w-3.5 h-3.5" />
                                       </button>
                                       {msg.role === 'model' && msg.translation && (
                                           <button 
                                               onClick={() => setTranslationModalContent(msg.translation || null)}
                                               className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-indigo-500 transition-colors"
                                               title="Traduzir"
                                           >
                                               <Languages className="w-3.5 h-3.5" />
                                           </button>
                                       )}
                                   </div>
                               </div>

                               {/* Tutor Feedback Block - Improved Visibility */}
                               {msg.feedback && (
                                   <div className="mt-2 max-w-[85%] bg-orange-50 border border-orange-100 p-3 rounded-xl rounded-tl-none shadow-sm animate-fade-in-up">
                                       <div className="flex items-start gap-2">
                                           <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                                           <p className="text-xs text-orange-800 font-semibold leading-relaxed">{msg.feedback}</p>
                                       </div>
                                   </div>
                               )}
                           </div>
                       ))}
                       {status === AppStatus.PROCESSING_AUDIO && (
                           <div className="flex w-full justify-start">
                               <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-none shadow-sm border border-gray-100 flex items-center gap-2">
                                   <div className="flex gap-1">
                                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                                   </div>
                               </div>
                           </div>
                       )}
                   </div>
                ) : (
                   // --- STANDARD CARD VIEW ---
                   phrases.length > 0 && (
                        <div className="w-full flex flex-col items-center pb-10">
                            <PhraseCard 
                                phrase={phrases[currentPhraseIndex]} 
                                onSpeak={() => speakText(phrases[currentPhraseIndex]?.english)}
                                isSpeaking={isAvatarSpeaking || isGeneratingAudio}
                            />
                            
                            {/* IN-FLOW RECORDER FOR CARD MODE - CLOSER TO CONTENT */}
                            {status !== AppStatus.FEEDBACK && (
                                <div className="mt-4 pointer-events-auto z-10">
                                    <AudioRecorder 
                                        ref={recorderRef} 
                                        onAudioRecorded={handleAudioRecorded} 
                                        isProcessing={status === AppStatus.PROCESSING_AUDIO} 
                                        disabled={status !== AppStatus.READY || isAvatarSpeaking || isGeneratingAudio} 
                                    />
                                </div>
                            )}
                        </div>
                   )
                )}

            </div>
            )}
        </div>

        {/* FEEDBACK POPUP MODAL (Only for standard modes) */}
        {status === AppStatus.FEEDBACK && result && appMode !== 'conversation' && (
           <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-fade-in-up">
              <div className={`bg-white p-5 rounded-3xl shadow-2xl w-full max-w-sm relative flex flex-col gap-3 border-4 ${result.isCorrect ? 'border-green-100' : 'border-red-100'}`}>
                 
                 {/* Close Button */}
                 <button 
                    onClick={result.isCorrect ? nextPhrase : retryPhrase}
                    className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 bg-gray-100 p-1 rounded-full hover:bg-gray-200 transition-colors"
                 >
                    <X className="w-5 h-5" />
                 </button>

                 <div className="flex items-start gap-3">
                     {result.isCorrect ? ( <CheckCircle className="w-8 h-8 text-green-500 flex-shrink-0" /> ) : ( <XCircle className="w-8 h-8 text-red-500 flex-shrink-0" /> )}
                     <div>
                        <h3 className={`font-extrabold text-xl ${result.isCorrect ? 'text-green-800' : 'text-red-800'}`}> {result.isCorrect ? 'Excelente!' : 'Ops!'} </h3>
                        <p className="text-gray-600 text-sm font-medium leading-relaxed mt-1">{result.feedback}</p>
                     </div>
                 </div>

                 {/* Accuracy & Audio Replay */}
                 <div className="flex items-center justify-between bg-gray-50 p-2 rounded-xl mt-1">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Precisão: <span className={`text-base ml-1 ${result.score >= 80 ? 'text-green-600' : 'text-yellow-600'}`}>{result.score}%</span></div>
                    {userAudioUrl && (
                       <button onClick={playUserAudio} className="flex items-center gap-1.5 text-[10px] bg-white border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-100 text-indigo-600 font-bold uppercase tracking-wide shadow-sm"> <Play className="w-3 h-3" /> Ouvir </button>
                    )}
                 </div>

                 {/* Word Analysis */}
                 {result.words && result.words.length > 0 && (
                     <div className="flex flex-wrap gap-1.5">
                         {result.words.map((w, i) => (
                         <span key={i} className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border ${w.status === 'correct' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}> {w.word} </span>
                         ))}
                     </div>
                 )}

                 {/* Actions */}
                 <div className="flex flex-col gap-2 mt-2">
                     {result.isCorrect ? (
                         <button onClick={nextPhrase} className="w-full flex items-center justify-center space-x-2 bg-green-600 text-white px-4 py-3.5 rounded-xl hover:bg-green-700 transition-colors shadow-lg shadow-green-200/50 font-bold active:scale-95 text-sm"> <span>Próxima Frase</span> <ArrowRight className="w-4 h-4" /> </button>
                     ) : (
                         <button onClick={retryPhrase} className="w-full flex items-center justify-center space-x-2 bg-red-500 text-white px-4 py-3.5 rounded-xl hover:bg-red-600 transition-colors shadow-lg shadow-red-200/50 font-bold active:scale-95 text-sm"> <span>Tentar Novamente</span> <RefreshCw className="w-4 h-4" /> </button>
                     )}
                     
                     <button onClick={() => speakText(phrases[currentPhraseIndex].english)} className="w-full text-indigo-500 hover:text-indigo-700 py-2 text-xs font-bold uppercase tracking-wider transition-colors" disabled={isAvatarSpeaking || isGeneratingAudio}>
                        {isGeneratingAudio ? 'Carregando...' : 'Ouvir Original Novamente'}
                     </button>
                 </div>
              </div>
           </div>
        )}

        {/* Fixed Bottom Recorder Area - ONLY FOR CONVERSATION NOW */}
        {status !== AppStatus.LOADING_PHRASES && status !== AppStatus.ERROR && appMode === 'conversation' && status !== AppStatus.FEEDBACK && (
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
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [view, setView] = useState<'login' | 'app' | 'admin'>('login');

  // Load users from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(USERS_KEY);
      if (stored) {
        setUsers(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load users", e);
    }
  }, []);

  const handleLogin = (user: UserProfile) => {
    setCurrentUser(user);
    setView(user.role === 'admin' ? 'admin' : 'app');
  };

  const handleCreateNew = () => {
    const newUser: UserProfile = {
      id: `user_${Date.now()}`,
      name: '',
      avatarColor: 'bg-indigo-500',
      joinedDate: Date.now(),
      role: 'user'
    };
    setCurrentUser(newUser);
    setView('app');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setView('login');
  };

  const handleUpdateUser = (updatedUser: UserProfile) => {
    setCurrentUser(updatedUser);
    
    // Update users list
    setUsers(prev => {
      // If user exists, update it
      if (prev.some(u => u.id === updatedUser.id)) {
        const newUsers = prev.map(u => u.id === updatedUser.id ? updatedUser : u);
        localStorage.setItem(USERS_KEY, JSON.stringify(newUsers));
        return newUsers;
      }
      // If it's a new user (and not guest/admin being persisted for first time)
      if (updatedUser.role === 'user') {
        const newUsers = [...prev, updatedUser];
        localStorage.setItem(USERS_KEY, JSON.stringify(newUsers));
        return newUsers;
      }
      return prev;
    });
  };

  const handleDeleteUser = (userId: string) => {
    setUsers(prev => {
      const newUsers = prev.filter(u => u.id !== userId);
      localStorage.setItem(USERS_KEY, JSON.stringify(newUsers));
      return newUsers;
    });
    localStorage.removeItem(`fluentflow_progress_${userId}`);
  };

  if (view === 'admin') {
    return (
      <ErrorBoundary>
        <AdminDashboard users={users} onDeleteUser={handleDeleteUser} onLogout={handleLogout} />
      </ErrorBoundary>
    );
  }

  if (!currentUser || view === 'login') {
    return (
      <ErrorBoundary>
        <LoginScreen users={users} onLogin={handleLogin} onCreateNew={handleCreateNew} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <AppContent 
        key={currentUser.id}
        currentUser={currentUser} 
        onLogout={handleLogout} 
        onUpdateUser={handleUpdateUser} 
      />
    </ErrorBoundary>
  );
};

export default App;