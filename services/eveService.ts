import { ChatMessage, Phrase, PronunciationResult } from '../types';
import { estimateBase64Bytes, recordAiUsage } from './aiUsageTelemetry';

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

const totalTextLength = (values: Array<string | undefined | null>): number =>
  values.reduce((sum, value) => sum + String(value || '').trim().length, 0);

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
  const uploadedAudioBytes = estimateBase64Bytes(audioBase64);
  const historyTextChars = history.reduce((sum, item) => sum + String(item?.text || '').trim().length, 0);

  try {
    const raw = await postAiAction<any>('eveConversation', {
      requestId,
      audioBase64,
      mimeType,
      history,
    });

    const debug = ensureDebugShape(requestId, raw?.debug);
    const transcription = typeof raw?.transcription === 'string' ? raw.transcription : '';
    const response = typeof raw?.response === 'string' ? raw.response : "I couldn't hear you clearly. Please try again.";
    const translation = typeof raw?.translation === 'string' ? raw.translation : 'Nao consegui te ouvir com clareza. Tente novamente.';
    const isSilent = Boolean(raw?.isSilent);

    recordAiUsage('conversation', {
      calls: 1,
      successfulCalls: isSilent ? 0 : 1,
      failedCalls: isSilent ? 1 : 0,
      uploadedAudioBytes,
      requestTextChars: historyTextChars,
      responseTextChars: totalTextLength([
        transcription,
        response,
        translation,
        typeof raw?.feedback === 'string' ? raw.feedback : '',
        typeof raw?.improvement === 'string' ? raw.improvement : '',
      ]),
      warnings: debug.warnings.length,
      errors: debug.errors.length,
    });

    return {
      requestId: typeof raw?.requestId === 'string' ? raw.requestId : requestId,
      isSilent,
      transcription,
      response,
      translation,
      feedback: typeof raw?.feedback === 'string' ? raw.feedback : undefined,
      improvement: typeof raw?.improvement === 'string' ? raw.improvement : undefined,
      debug,
      error: typeof raw?.error === 'string' ? raw.error : undefined,
    };
  } catch (error: any) {
    recordAiUsage('conversation', {
      calls: 1,
      failedCalls: 1,
      uploadedAudioBytes,
      requestTextChars: historyTextChars,
      errors: 1,
    });

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
  const requestTextChars = text.trim().length;

  try {
    const raw = await postAiAction<any>('eveSpeech', {
      requestId,
      text,
    });

    const base64 = typeof raw?.base64 === 'string' ? raw.base64 : null;
    const debug = ensureDebugShape(requestId, raw?.debug);

    recordAiUsage('speech', {
      calls: 1,
      successfulCalls: base64 ? 1 : 0,
      failedCalls: base64 ? 0 : 1,
      requestTextChars,
      returnedAudioBytes: estimateBase64Bytes(base64 || ''),
      warnings: debug.warnings.length,
      errors: debug.errors.length,
    });

    return {
      requestId: typeof raw?.requestId === 'string' ? raw.requestId : requestId,
      base64,
      mimeType: typeof raw?.mimeType === 'string' ? raw.mimeType : null,
      debug,
      error: typeof raw?.error === 'string' ? raw.error : undefined,
    };
  } catch (error: any) {
    recordAiUsage('speech', {
      calls: 1,
      failedCalls: 1,
      requestTextChars,
      errors: 1,
    });

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
  const uploadedAudioBytes = estimateBase64Bytes(audioBase64);
  const requestTextChars = targetPhrase.trim().length;

  try {
    const raw = await postAiAction<any>('pronunciation', {
      requestId,
      audioBase64,
      mimeType,
      targetPhrase,
    });

    const debug = ensureDebugShape(requestId, raw?.debug);
    const transcript = typeof raw?.transcript === 'string' ? raw.transcript : '';
    const feedback =
      typeof raw?.feedback === 'string' && raw.feedback.trim()
        ? raw.feedback
        : 'Nao foi possivel avaliar a pronunciacao agora.';
    const usable = transcript.trim().length > 0;

    recordAiUsage('pronunciation', {
      calls: 1,
      successfulCalls: usable ? 1 : 0,
      failedCalls: usable ? 0 : 1,
      uploadedAudioBytes,
      requestTextChars,
      responseTextChars: totalTextLength([transcript, feedback]),
      warnings: debug.warnings.length,
      errors: debug.errors.length,
    });

    return {
      requestId: typeof raw?.requestId === 'string' ? raw.requestId : requestId,
      transcript,
      isCorrect: Boolean(raw?.isCorrect),
      score: typeof raw?.score === 'number' ? Math.max(0, Math.min(100, raw.score)) : 0,
      feedback,
      words: Array.isArray(raw?.words) ? raw.words : [],
      debug,
      error: typeof raw?.error === 'string' ? raw.error : undefined,
    };
  } catch (error: any) {
    recordAiUsage('pronunciation', {
      calls: 1,
      failedCalls: 1,
      uploadedAudioBytes,
      requestTextChars,
      errors: 1,
    });

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
  const requestTextChars = totalTextLength([topic, difficulty, String(count)]);

  try {
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

    recordAiUsage('generatePhrases', {
      calls: 1,
      successfulCalls: 1,
      requestTextChars,
      responseTextChars: phrases.reduce((sum, phrase) => sum + phrase.english.length + phrase.portuguese.length, 0),
      itemsReturned: phrases.length,
    });

    return phrases;
  } catch (error) {
    recordAiUsage('generatePhrases', {
      calls: 1,
      failedCalls: 1,
      requestTextChars,
      errors: 1,
    });
    throw error;
  }
};

export const requestVocabularyWords = async (
  category: string,
  count: number = 10
): Promise<Phrase[]> => {
  const requestId = createClientRequestId();
  const requestTextChars = totalTextLength([category, String(count)]);

  try {
    const raw = await postAiAction<any>('generateWords', {
      requestId,
      category,
      count,
    });
    const phrases = normalizePhraseList(raw, category);
    if (!phrases.length) {
      throw new Error('No words returned from generateWords');
    }

    recordAiUsage('generateWords', {
      calls: 1,
      successfulCalls: 1,
      requestTextChars,
      responseTextChars: phrases.reduce((sum, phrase) => sum + phrase.english.length + phrase.portuguese.length, 0),
      itemsReturned: phrases.length,
    });

    return phrases;
  } catch (error) {
    recordAiUsage('generateWords', {
      calls: 1,
      failedCalls: 1,
      requestTextChars,
      errors: 1,
    });
    throw error;
  }
};
