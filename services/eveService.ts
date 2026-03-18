import { ChatMessage } from '../types';

export interface EveDebugInfo {
  requestId: string;
  transcriptSource: 'browser' | 'server' | 'none';
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

const createClientRequestId = () =>
  `cli_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const postAiAction = async <T>(action: string, payload: unknown, timeoutMs: number = 45000): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload }),
      signal: controller.signal,
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error((json as any)?.error || `Request failed with status ${response.status}`);
    }
    return json as T;
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

export const converseWithEve = async (
  audioBase64: string,
  mimeType: string,
  history: ChatMessage[],
  browserTranscript?: string
): Promise<EveConversationResponse> => {
  const requestId = createClientRequestId();

  try {
    return await postAiAction<EveConversationResponse>('eveConversation', {
      requestId,
      audioBase64,
      mimeType,
      history,
      transcription: browserTranscript,
    });
  } catch (error: any) {
    return {
      requestId,
      isSilent: false,
      transcription: browserTranscript?.trim() || '',
      response: 'Connection error. Please try again.',
      translation: 'Erro de conexao. Tente novamente.',
      debug: {
        ...defaultDebug(requestId),
        errors: [String(error?.message || error)],
      },
      error: String(error?.message || error),
    };
  }
};

export const requestEveSpeech = async (text: string): Promise<EveSpeechResponse> => {
  const requestId = createClientRequestId();

  try {
    return await postAiAction<EveSpeechResponse>('eveSpeech', {
      requestId,
      text,
    });
  } catch (error: any) {
    return {
      requestId,
      base64: null,
      mimeType: null,
      debug: {
        ...defaultDebug(requestId),
        errors: [String(error?.message || error)],
      },
      error: String(error?.message || error),
    };
  }
};
