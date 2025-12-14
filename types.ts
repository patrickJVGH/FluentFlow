
export interface Phrase {
  id: string;
  english: string;
  portuguese: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category?: string;
}

export interface WordAnalysis {
  word: string;
  status: 'correct' | 'needs_improvement';
  phoneticIssue?: string;
}

export interface PronunciationResult {
  isCorrect: boolean;
  score: number; // 0-100
  feedback: string;
  words?: WordAnalysis[];
  intonation?: string;
}

export interface GameState {
  score: number;
  streak: number;
  currentLevel: number;
  phrasesCompleted: number;
  courseProgressIndex: number; // Track progress in the 1000 phrases list
}

export type UserRole = 'user' | 'admin' | 'guest';

export interface UserProfile {
  id: string;
  name: string;
  avatarColor: string; // Tailwind class like 'bg-blue-500'
  joinedDate: number;
  role: UserRole;
}

export const USER_RANKS = [
  { minScore: 0, title: "Novato", color: "text-gray-500" },
  { minScore: 500, title: "Explorador", color: "text-green-500" },
  { minScore: 1500, title: "Conversador", color: "text-blue-500" },
  { minScore: 3000, title: "Poliglota", color: "text-purple-500" },
  { minScore: 5000, title: "Mestre Fluente", color: "text-yellow-500" }
];

export enum AppStatus {
  IDLE = 'IDLE',
  LOADING_PHRASES = 'LOADING_PHRASES',
  READY = 'READY',
  RECORDING = 'RECORDING',
  PROCESSING_AUDIO = 'PROCESSING_AUDIO',
  FEEDBACK = 'FEEDBACK',
  ERROR = 'ERROR'
}

export type AppMode = 'course' | 'practice' | 'words' | 'conversation';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  translation?: string; // Portuguese translation
  feedback?: string; // Optional correction/feedback from the tutor
}

export const TOPICS = [
  "Introductions & Greetings",
  "Ordering Coffee",
  "Asking Directions",
  "At the Airport",
  "Hotel Check-in",
  "Shopping for Clothes",
  "Making Friends",
  "Job Interview",
  "Emergency Situations",
  "Casual Small Talk",
  "Phonetic Challenges (TH, R, L)",
  "Business Meetings",
  "Tech & Programming"
];
