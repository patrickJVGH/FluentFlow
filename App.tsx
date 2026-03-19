
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppStatus, GameState, Phrase, PronunciationResult, TOPICS, AppMode, UserProfile, ChatMessage, HistoryEntry } from './types';
import {
  converseWithEve,
  requestEveSpeech,
  evaluatePronunciation,
  requestPracticePhrases,
  requestVocabularyWords,
  type EveDebugInfo,
} from './services/eveService';
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
import { BarChart, Loader2, Settings, AlertCircle, CheckCircle2, Home, Radio, Monitor, MonitorOff, ToggleLeft, ToggleRight } from 'lucide-react';

const USERS_KEY = 'fluentflow_users';
const LEVEL_XP_STEP = 100;

const createDefaultGameState = (): GameState => ({
  score: 0,
  streak: 0,
  currentLevel: 1,
  phrasesCompleted: 0,
  courseProgressIndex: 0,
  history: [],
});

const toLocalDateKey = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateKey = (dateKey: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
};

const normalizeHistoryDate = (value: unknown): string | null => {
  if (typeof value !== 'string' || !value.trim()) return null;

  const dateKey = value.trim();
  if (parseDateKey(dateKey)) return dateKey;

  const parsed = new Date(dateKey);
  if (Number.isNaN(parsed.getTime())) return null;
  return toLocalDateKey(parsed);
};

const normalizeHistory = (historyRaw: unknown): HistoryEntry[] => {
  if (!Array.isArray(historyRaw)) return [];

  const byDate = new Map<string, number>();
  for (const item of historyRaw) {
    const date = normalizeHistoryDate(item?.date);
    const score = Number(item?.score);
    if (!date || !Number.isFinite(score)) continue;
    byDate.set(date, Math.max(0, Math.round(score)));
  }

  return Array.from(byDate.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, score]) => ({ date, score }));
};

const diffInDays = (left: string, right: string): number => {
  const leftDate = parseDateKey(left);
  const rightDate = parseDateKey(right);
  if (!leftDate || !rightDate) return Number.POSITIVE_INFINITY;

  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((leftDate.getTime() - rightDate.getTime()) / msPerDay);
};

const upsertHistoryEntry = (history: HistoryEntry[], score: number, dateKey: string = toLocalDateKey()): HistoryEntry[] => {
  const normalized = normalizeHistory(history);
  const nextScore = Math.max(0, Math.round(score));
  const next = normalized.filter(entry => entry.date !== dateKey);
  next.push({ date: dateKey, score: nextScore });
  return next.sort((left, right) => left.date.localeCompare(right.date));
};

const calculateStreak = (history: HistoryEntry[], todayKey: string = toLocalDateKey()): number => {
  const normalized = normalizeHistory(history);
  if (!normalized.length) return 0;

  const latestDate = normalized[normalized.length - 1].date;
  const gapFromToday = diffInDays(todayKey, latestDate);
  if (gapFromToday > 1) return 0;

  let streak = 1;
  for (let index = normalized.length - 1; index > 0; index -= 1) {
    const current = normalized[index].date;
    const previous = normalized[index - 1].date;
    if (diffInDays(current, previous) === 1) streak += 1;
    else break;
  }
  return streak;
};

const calculateLevel = (score: number): number => Math.max(1, Math.floor(Math.max(0, score) / LEVEL_XP_STEP) + 1);

const normalizeGameState = (stateRaw: unknown): GameState => {
  const base = createDefaultGameState();
  const score = Number((stateRaw as GameState | null)?.score);
  const phrasesCompleted = Number((stateRaw as GameState | null)?.phrasesCompleted);
  const courseProgressIndex = Number((stateRaw as GameState | null)?.courseProgressIndex);
  const history = normalizeHistory((stateRaw as GameState | null)?.history);

  return {
    score: Number.isFinite(score) ? Math.max(0, Math.round(score)) : base.score,
    streak: calculateStreak(history),
    currentLevel: calculateLevel(Number.isFinite(score) ? score : base.score),
    phrasesCompleted: Number.isFinite(phrasesCompleted) ? Math.max(0, Math.round(phrasesCompleted)) : base.phrasesCompleted,
    courseProgressIndex: Number.isFinite(courseProgressIndex) ? Math.max(0, Math.round(courseProgressIndex)) : base.courseProgressIndex,
    history,
  };
};

const summarizeDebugMessage = (value?: string | null): string => {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length > 96 ? `${text.slice(0, 93)}...` : text;
};

const buildEveDebugLine = (debug: EveDebugInfo): string => {
  const parts = [
    `EVE ${debug.requestId}`,
    `STT:${debug.transcriptSource}/${debug.transcriptionModel || '-'}`,
    `CHAT:${debug.chatModel || '-'}`,
    `TTS:${debug.ttsModel || 'browser'}`,
    `W:${debug.warnings.length}`,
    `E:${debug.errors.length}`,
  ];

  const warningPreview = summarizeDebugMessage(debug.warnings[0]);
  const errorPreview = summarizeDebugMessage(debug.errors[0]);
  if (warningPreview) parts.push(`WARN:${warningPreview}`);
  if (errorPreview) parts.push(`ERR:${errorPreview}`);

  return parts.join(' | ');
};

const safeAreaShellStyle: React.CSSProperties = {
  boxSizing: 'border-box',
  paddingTop: 'env(safe-area-inset-top, 0px)',
  paddingRight: 'env(safe-area-inset-right, 0px)',
  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  paddingLeft: 'env(safe-area-inset-left, 0px)',
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
  
  const [showProfileSetup, setShowProfileSetup] = useState(currentUser.name === '' && currentUser.role !== 'guest');
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showTopicSelector, setShowTopicSelector] = useState(false);
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(
    typeof window !== 'undefined' ? window.innerHeight : 800
  );
  
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
  const [recorderDebugLine, setRecorderDebugLine] = useState('');

  const [gameState, setGameState] = useState<GameState>(() => {
    const defaultState = createDefaultGameState();
    try {
      const saved = localStorage.getItem(`fluentflow_progress_${currentUser.id}`);
      if (saved) return normalizeGameState(JSON.parse(saved));
    } catch (e) {}
    return defaultState;
  });

  useEffect(() => {
    const syncViewportHeight = () => setViewportHeight(window.innerHeight);
    syncViewportHeight();
    window.addEventListener('resize', syncViewportHeight);
    window.addEventListener('orientationchange', syncViewportHeight);
    return () => {
      window.removeEventListener('resize', syncViewportHeight);
      window.removeEventListener('orientationchange', syncViewportHeight);
    };
  }, []);

  const layoutDensity = viewportHeight >= 700 ? 'normal' : viewportHeight >= 560 ? 'compact' : 'ultra-compact';
  const avatarHeightClass =
    layoutDensity === 'normal'
      ? 'h-[180px] sm:h-[260px] md:h-[300px]'
      : layoutDensity === 'compact'
      ? 'h-[120px] sm:h-[170px] md:h-[210px]'
      : 'h-[64px] sm:h-[96px] md:h-[128px]';
  const topBlockClass =
    layoutDensity === 'normal' ? 'pt-4 pb-2' : layoutDensity === 'compact' ? 'pt-2.5 pb-1.5' : 'pt-1 pb-0';
  const bottomPanelClass =
    layoutDensity === 'normal'
      ? 'rounded-t-[32px] p-4 sm:p-6 pb-6'
      : layoutDensity === 'compact'
      ? 'rounded-t-[26px] p-3 sm:p-4 pb-4'
      : 'rounded-t-[18px] p-2 pb-2';
  const conversationMinHeightClass =
    layoutDensity === 'normal' ? 'min-h-[120px]' : layoutDensity === 'compact' ? 'min-h-[84px]' : 'min-h-[56px]';

  useEffect(() => {
    localStorage.setItem(`ff_avatar_pref_${currentUser.id}`, JSON.stringify(isAvatarEnabled));
  }, [isAvatarEnabled, currentUser.id]);

  useEffect(() => {
    try {
      localStorage.setItem(`fluentflow_progress_${currentUser.id}`, JSON.stringify(gameState));
    } catch (e) {}
  }, [gameState, currentUser.id]);

  const registerProgressActivity = useCallback(
    ({
      scoreDelta = 0,
      phraseDelta = 0,
      advanceCourse = false,
      dateKey = toLocalDateKey(),
    }: {
      scoreDelta?: number;
      phraseDelta?: number;
      advanceCourse?: boolean;
      dateKey?: string;
    }) => {
      setGameState(prev => {
        const nextScore = Math.max(0, prev.score + Math.round(scoreDelta));
        const nextPhrasesCompleted = Math.max(0, prev.phrasesCompleted + Math.round(phraseDelta));
        const nextCourseProgressIndex = advanceCourse ? prev.courseProgressIndex + 1 : prev.courseProgressIndex;
        const nextHistory = upsertHistoryEntry(prev.history, nextScore, dateKey);

        return {
          ...prev,
          score: nextScore,
          streak: calculateStreak(nextHistory, dateKey),
          currentLevel: calculateLevel(nextScore),
          phrasesCompleted: nextPhrasesCompleted,
          courseProgressIndex: nextCourseProgressIndex,
          history: nextHistory,
        };
      });
    },
    []
  );

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

  const speakWithBrowserTts = (text: string, currentId: number): Promise<boolean> => {
    if (!('speechSynthesis' in window)) return Promise.resolve(false);

    return new Promise(resolve => {
      try {
        const synth = window.speechSynthesis;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;

        const voices = synth.getVoices();
        const englishVoice =
          voices.find(v => /^en[-_]/i.test(v.lang || '')) ||
          voices.find(v => (v.lang || '').toLowerCase().startsWith('en'));
        if (englishVoice) utterance.voice = englishVoice;

        let settled = false;
        const finish = (ok: boolean) => {
          if (settled) return;
          settled = true;
          resolve(ok);
        };

        utterance.onend = () => {
          if (speechSafetyTimerRef.current !== null) {
            window.clearTimeout(speechSafetyTimerRef.current);
            speechSafetyTimerRef.current = null;
          }
          if (currentId === speechRequestIdRef.current) setIsAvatarSpeaking(false);
          finish(true);
        };

        utterance.onerror = () => {
          if (speechSafetyTimerRef.current !== null) {
            window.clearTimeout(speechSafetyTimerRef.current);
            speechSafetyTimerRef.current = null;
          }
          if (currentId === speechRequestIdRef.current) setIsAvatarSpeaking(false);
          finish(false);
        };

        speechSynthesisUtteranceRef.current = utterance;
        synth.cancel();
        synth.speak(utterance);

        // Some browsers fail silently; confirm speaking actually started.
        window.setTimeout(() => {
          if (!settled && !synth.speaking) {
            if (currentId === speechRequestIdRef.current) setIsAvatarSpeaking(false);
            finish(false);
          }
        }, 800);

        speechSafetyTimerRef.current = window.setTimeout(() => {
          if (currentId === speechRequestIdRef.current) setIsAvatarSpeaking(false);
        }, 20000);
      } catch {
        resolve(false);
      }
    });
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
      setEveDebugLine(buildEveDebugLine(debug));

      const played = speech.base64
        ? await playServerAudio(speech.base64, speech.mimeType, currentId)
        : false;

      if (!played) {
        const browserOk = await speakWithBrowserTts(text, currentId);
        if (!browserOk) setIsAvatarSpeaking(false);
      }
    } catch (e) {
      const browserOk = await speakWithBrowserTts(text, currentId);
      if (!browserOk) setIsAvatarSpeaking(false);
    }
  }, [playServerAudio, stopAllSpeech]);

  const loadData = useCallback(async (mode: AppMode, topicOverride?: string) => {
    setStatus(AppStatus.LOADING_PHRASES);
    setEveDebugLine('');
    setRecorderDebugLine('');
    stopAllSpeech();
    const fallbackCount = mode === 'words' ? 8 : 5;

    try {
      let loadedPhrases: Phrase[] = [];
      if (mode === 'course') {
        loadedPhrases = getCoursePhrases(gameState.courseProgressIndex, 5);
      } else if (mode === 'practice') {
        const topic = topicOverride || selectedTopic || TOPICS[0];
        loadedPhrases = await requestPracticePhrases(topic, 'medium', 5);
      } else if (mode === 'words') {
        loadedPhrases = await requestVocabularyWords('General', 8);
      } else if (mode === 'conversation') {
        setChatHistory([]); 
        const welcome = `Hello ${currentUser.name}! I'm EVE. How are you today?`;
        setChatHistory([{ role: 'model', text: welcome, translation: `Olá ${currentUser.name}! Eu sou a EVE. Como você está hoje?` }]);
        speakText(welcome);
      }
      if (mode !== 'conversation' && loadedPhrases.length === 0) {
        throw new Error(`No content returned for ${mode}`);
      }
      setPhrases(loadedPhrases);
      setCurrentPhraseIndex(0);
      setResult(null);
      setStatus(AppStatus.READY);
    } catch (e: any) {
      setEveDebugLine(`EVE load fallback | mode:${mode} | ${String(e?.message || e)}`);
      setPhrases(getRandomPhrases(fallbackCount));
      setCurrentPhraseIndex(0);
      setResult(null);
      setStatus(AppStatus.READY);
    }
  }, [gameState.courseProgressIndex, currentUser.name, selectedTopic, speakText, stopAllSpeech]);

  useEffect(() => {
    if (appMode) loadData(appMode);
    // Intentionally react only to mode transitions to avoid reloading phrases mid-session
    // when unrelated state (e.g. score/progress/chat length) changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appMode]);

  useEffect(() => {
    if (showHistory || showTopicSelector || showProfileSetup) {
      setShowSettings(false);
    }
  }, [showHistory, showTopicSelector, showProfileSetup]);

  const handleAudioRecorded = async (base64: string, mimeType: string, _audioUrl: string, browserTranscript?: string) => {
    if (!base64 && !browserTranscript) return;
    await ensureAudioContext();
    setStatus(AppStatus.PROCESSING_AUDIO);
    
    try {
      if (appMode === 'conversation') {
        const response = await converseWithEve(base64, mimeType, chatHistory, browserTranscript);
        setEveDebugLine(buildEveDebugLine(response.debug));

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
        registerProgressActivity({ scoreDelta: 10 });
        speakText(response.response);
        setStatus(AppStatus.READY);
      } else {
        const currentPhrase = phrases[currentPhraseIndex];
        if (!currentPhrase) {
          throw new Error(`No phrase loaded for mode ${appMode || 'unknown'}`);
        }

        const res = await evaluatePronunciation(base64, mimeType, currentPhrase.english, browserTranscript);
        setEveDebugLine(buildEveDebugLine(res.debug));
        setResult(res);
        registerProgressActivity({
          scoreDelta: res.isCorrect ? res.score : 0,
          phraseDelta: res.isCorrect ? 1 : 0,
          advanceCourse: Boolean(res.isCorrect && appMode === 'course'),
        });
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
    setRecorderDebugLine('');
    if (mode === 'practice') setShowTopicSelector(true);
    else setAppMode(mode);
    setShowSettings(false);
  };

  const handleOpenProfileSetup = () => {
    setShowSettings(false);
    setShowProfileSetup(true);
  };

  const handleOpenHistory = () => {
    setShowSettings(false);
    setShowHistory(true);
  };

  const handleToggleSettings = () => {
    if (showHistory || showTopicSelector || showProfileSetup) return;
    setShowSettings(prev => !prev);
  };

  return (
    <div className="flex flex-col h-[100dvh] min-h-[100dvh] bg-[#F8FAFC] overflow-hidden font-sans" style={safeAreaShellStyle}>
      <header className={`bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm flex items-center justify-between z-30 shrink-0 ${layoutDensity === 'ultra-compact' ? 'px-3 py-1.5' : 'px-3 sm:px-6 py-2 sm:py-2.5'}`}>
        <div className="flex items-center gap-2 sm:gap-3">
          <button 
            onClick={handleOpenProfileSetup}
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
            <button onClick={() => { setShowSettings(false); setAppMode(null); }} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
              <Home className="w-4 h-4" />
            </button>
          )}
          <button onClick={handleOpenHistory} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
            <BarChart className="w-4 h-4" />
          </button>
          <button onClick={handleToggleSettings} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0 relative max-w-2xl mx-auto w-full px-3 sm:px-6 overflow-hidden">
        {!appMode ? (
          <ModeSelector userName={currentUser.name || "Visitante"} onSelectMode={handleModeChange} />
        ) : (
          <>
            <div className={`shrink-0 ${topBlockClass}`}>
              <ScoreBoard state={gameState} totalPhrases={1000} />
              
              <div className={`transition-all duration-500 flex items-center justify-center ${isAvatarEnabled ? avatarHeightClass : 'h-8 sm:h-10'}`}>
                {isAvatarEnabled ? (
                  <Avatar3D isSpeaking={isAvatarSpeaking} isRecording={status === AppStatus.RECORDING} audioAnalyser={analyserForAvatar} />
                ) : (
                  <div className="bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm">
                    <Radio className={`w-4 h-4 ${isAvatarSpeaking ? 'text-indigo-500 animate-pulse' : 'text-slate-300'}`} />
                  </div>
                )}
              </div>
            </div>

            <div className={`flex-1 flex flex-col min-h-0 overflow-hidden relative z-10 ${layoutDensity === 'ultra-compact' ? 'pb-1' : 'pb-3 sm:pb-4'}`}>
              {appMode === 'conversation' ? (
                <div className={`flex-1 ${conversationMinHeightClass} overflow-y-auto space-y-3 custom-scrollbar pr-1`}>
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
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1">
                  <div className={`min-h-full flex flex-col justify-center ${layoutDensity === 'ultra-compact' ? 'py-1' : 'py-2'}`}>
                  {status === AppStatus.LOADING_PHRASES ? (
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-6 h-6 animate-spin text-indigo-300" />
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gerando frases...</p>
                    </div>
                  ) : status === AppStatus.FEEDBACK && result ? (
                    <div className="bg-white rounded-[32px] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)] border border-slate-100 flex flex-col items-center animate-fade-in-up">
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
                </div>
              )}
            </div>

            <div className={`bg-white ${bottomPanelClass} shadow-[0_-12px_30px_rgba(15,23,42,0.05)] z-30 shrink-0 border-t border-slate-100`}>
              <div className="flex flex-col items-center w-full max-w-md mx-auto">
                {layoutDensity !== 'ultra-compact' && (
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    {status === AppStatus.PROCESSING_AUDIO ? 'Processando...' : 'Toque no microfone para falar'}
                  </p>
                )}
                {layoutDensity !== 'ultra-compact' && eveDebugLine && (
                  <p className="text-[10px] text-slate-500 mb-2 text-center break-words w-full">
                    {eveDebugLine}
                  </p>
                )}
                {layoutDensity !== 'ultra-compact' && recorderDebugLine && (
                  <p className="text-[10px] text-slate-400 mb-2 text-center break-words w-full">
                    {recorderDebugLine}
                  </p>
                )}
                <AudioRecorder 
                  onAudioRecorded={handleAudioRecorded} 
                  isProcessing={status === AppStatus.PROCESSING_AUDIO} 
                  disabled={isAvatarSpeaking || status === AppStatus.LOADING_PHRASES} 
                  density={layoutDensity}
                  onRecorderLog={setRecorderDebugLine}
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
      {showProfileSetup && (
        <ProfileSetup
          initialProfile={currentUser}
          existingNames={existingUsers.filter(user => user.id !== currentUser.id).map(user => user.name.trim()).filter(Boolean)}
          onSave={(u) => { onUpdateUser({...currentUser, ...u}); setShowProfileSetup(false); }}
          onCancel={() => setShowProfileSetup(false)}
        />
      )}
      {showSettings && (
        <div className="absolute top-12 sm:top-14 right-3 sm:right-4 w-[min(14rem,calc(100vw-1.5rem))] sm:w-56 bg-white rounded-2xl shadow-2xl border p-2 z-40 animate-fade-in-up">
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
