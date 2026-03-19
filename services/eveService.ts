import { ChatMessage, Phrase, PronunciationResult } from '../types';

export interface EveDebugInfo {
  requestId: string;
  transcriptSource: 'server' | 'none';
  transcriptionModel: string | null;
  chatModel: string | null;
  ttsModel: string | null;
  warnings: string[];
  errors: string[];
}

export interface EveConversationResponse {
  requestId: string;
  isSilent: boolean;
  transcription: string;
  response: string;
  translation: string;
  feedback?: string;
  improvement?: string;
  debug: EveDebugInfo;
  error?: string;
}

export interface EveSpeechResponse {
  requestId: string;
  base64: string | null;
  mimeType: string | null;
  debug: EveDebugInfo;
  error?: string;
}

export interface EvePronunciationResponse extends PronunciationResult {
  requestId: string;
  debug: EveDebugInfo;
  error?: string;
}

const createClientRequestId = () =>
  `cli_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const extractErrorMessage = (error: any): string => String(error?.message || error || 'Unknown error');

const ensureDebugShape = (requestId: string, debug: any): EveDebugInfo => ({
  requestId: typeof debug?.requestId === 'string' ? debug.requestId : requestId,
  transcriptSource: debug?.transcriptSource === 'server' ? 'server' : 'none',
  transcriptionModel: typeof debug?.transcriptionModel === 'string' ? debug.transcriptionModel : null,
  chatModel: typeof debug?.chatModel === 'string' ? debug.chatModel : null,
  ttsModel: typeof debug?.ttsModel === 'string' ? debug.ttsModel : null,
  warnings: Array.isArray(debug?.warnings) ? debug.warnings.map(String) : [],
  errors: Array.isArray(debug?.errors) ? debug.errors.map(String) : [],
});

const postAiAction = async <T>(
  action: string,
  payload: { requestId?: string } & Record<string, unknown>,
  timeoutMs: number = 45000
): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const endpoint = '/api/ai';
  const requestId = payload.requestId || createClientRequestId();

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-EVE-Request-Id': String(requestId),
      },
      body: JSON.stringify({ action, payload }),
      signal: controller.signal,
    });

    const contentType = response.headers.get('content-type') || '';
    const raw = await response.text();
    if (!contentType.includes('application/json')) {
      const snippet = raw.slice(0, 120).replace(/\s+/g, ' ').trim();
      throw new Error(`API returned non-JSON (${response.status}) from ${endpoint}: ${snippet || 'empty body'}`);
    }

    const json = raw ? JSON.parse(raw) : {};
    if (!response.ok) {
      throw new Error((json as any)?.error || `Request failed with status ${response.status}`);
    }
    return json as T;
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error(`API timeout (${timeoutMs}ms)`);
    }
    throw new Error(extractErrorMessage(error));
  } finally {
    clearTimeout(timeout);
  }
};

const defaultDebug = (requestId: string): EveDebugInfo => ({
  requestId,
  transcriptSource: 'none',
  transcriptionModel: null,
  chatModel: null,
  ttsModel: null,
  warnings: [],
  errors: [],
});

const normalizePhraseList = (items: unknown, fallbackCategory: string): Phrase[] => {
  if (!Array.isArray(items)) return [];

  return items
    .map((item: any, index) => ({
      id:
        typeof item?.id === 'string' && item.id.trim()
          ? item.id
          : `generated_${Date.now()}_${index}`,
      english: typeof item?.english === 'string' ? item.english.trim() : '',
      portuguese: typeof item?.portuguese === 'string' ? item.portuguese.trim() : '',
      difficulty:
        item?.difficulty === 'easy' || item?.difficulty === 'medium' || item?.difficulty === 'hard'
          ? item.difficulty
          : 'medium',
      category:
        typeof item?.category === 'string' && item.category.trim() ? item.category.trim() : fallbackCategory,
    }))
    .filter(item => item.english && item.portuguese);
};

export const converseWithEve = async (
  audioBase64: string,
  mimeType: string,
  history: ChatMessage[]
): Promise<EveConversationResponse> => {
  const requestId = createClientRequestId();

  try {
    const raw = await postAiAction<any>('eveConversation', {
      requestId,
      audioBase64,
      mimeType,
      history,
    });

    const debug = ensureDebugShape(requestId, raw?.debug);

    return {
      requestId: typeof raw?.requestId === 'string' ? raw.requestId : requestId,
      isSilent: Boolean(raw?.isSilent),
      transcription: typeof raw?.transcription === 'string' ? raw.transcription : '',
      response: typeof raw?.response === 'string' ? raw.response : "I couldn't hear you clearly. Please try again.",
      translation: typeof raw?.translation === 'string' ? raw.translation : 'Nao consegui te ouvir com clareza. Tente novamente.',
      feedback: typeof raw?.feedback === 'string' ? raw.feedback : undefined,
      improvement: typeof raw?.improvement === 'string' ? raw.improvement : undefined,
      debug,
      error: typeof raw?.error === 'string' ? raw.error : undefined,
    };
  } catch (error: any) {
    return {
      requestId,
      isSilent: false,
      transcription: '',
      response: 'Connection error. Please try again.',
      translation: 'Erro de conexao. Tente novamente.',
      debug: {
        ...defaultDebug(requestId),
        errors: [extractErrorMessage(error)],
      },
      error: extractErrorMessage(error),
    };
  }
};

export const requestEveSpeech = async (text: string): Promise<EveSpeechResponse> => {
  const requestId = createClientRequestId();

  try {
    const raw = await postAiAction<any>('eveSpeech', {
      requestId,
      text,
    });

    return {
      requestId: typeof raw?.requestId === 'string' ? raw.requestId : requestId,
      base64: typeof raw?.base64 === 'string' ? raw.base64 : null,
      mimeType: typeof raw?.mimeType === 'string' ? raw.mimeType : null,
      debug: ensureDebugShape(requestId, raw?.debug),
      error: typeof raw?.error === 'string' ? raw.error : undefined,
    };
  } catch (error: any) {
    return {
      requestId,
      base64: null,
      mimeType: null,
      debug: {
        ...defaultDebug(requestId),
        errors: [extractErrorMessage(error)],
      },
      error: extractErrorMessage(error),
    };
  }
};

export const evaluatePronunciation = async (
  audioBase64: string,
  mimeType: string,
  targetPhrase: string
): Promise<EvePronunciationResponse> => {
  const requestId = createClientRequestId();

  try {
    const raw = await postAiAction<any>('pronunciation', {
      requestId,
      audioBase64,
      mimeType,
      targetPhrase,
    });

    const debug = ensureDebugShape(requestId, raw?.debug);

    return {
      requestId: typeof raw?.requestId === 'string' ? raw.requestId : requestId,
      transcript: typeof raw?.transcript === 'string' ? raw.transcript : '',
      isCorrect: Boolean(raw?.isCorrect),
      score: typeof raw?.score === 'number' ? Math.max(0, Math.min(100, raw.score)) : 0,
      feedback:
        typeof raw?.feedback === 'string' && raw.feedback.trim()
          ? raw.feedback
          : 'Nao foi possivel avaliar a pronunciacao agora.',
      words: Array.isArray(raw?.words) ? raw.words : [],
      debug,
      error: typeof raw?.error === 'string' ? raw.error : undefined,
    };
  } catch (error: any) {
    return {
      requestId,
      transcript: '',
      isCorrect: false,
      score: 0,
      feedback: 'Erro ao processar audio.',
      words: [],
      debug: {
        ...defaultDebug(requestId),
        errors: [extractErrorMessage(error)],
      },
      error: extractErrorMessage(error),
    };
  }
};

export const requestPracticePhrases = async (
  topic: string,
  difficulty: string,
  count: number = 5
): Promise<Phrase[]> => {
  const requestId = createClientRequestId();
  const raw = await postAiAction<any>('generatePhrases', {
    requestId,
    topic,
    difficulty,
    count,
  });
  const phrases = normalizePhraseList(raw, topic);
  if (!phrases.length) {
    throw new Error('No phrases returned from generatePhrases');
  }
  return phrases;
};

export const requestVocabularyWords = async (
  category: string,
  count: number = 10
): Promise<Phrase[]> => {
  const requestId = createClientRequestId();
  const raw = await postAiAction<any>('generateWords', {
    requestId,
    category,
    count,
  });
  const phrases = normalizePhraseList(raw, category);
  if (!phrases.length) {
    throw new Error('No words returned from generateWords');
  }
  return phrases;
};
