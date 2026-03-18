import { Phrase, PronunciationResult, ChatMessage } from '../types';

const callAiApi = async <T>(action: string, payload: unknown): Promise<T> => {
  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Request failed with ${response.status}`);
  }

  return response.json();
};

export const processConversationTurn = async (
  audioBase64: string,
  mimeType: string,
  history: ChatMessage[],
  transcription?: string
): Promise<{ isSilent: boolean; transcription: string; response: string; translation: string; feedback?: string; improvement?: string }> => {
  try {
    return await callAiApi('conversation', { audioBase64, mimeType, history, transcription });
  } catch (error) {
    return { isSilent: false, transcription: '(Error)', response: 'Connection error.', translation: 'Erro de conexão.' };
  }
};

export const validatePronunciation = async (
  audioBase64: string,
  mimeType: string,
  targetPhrase: string,
  transcription?: string
): Promise<PronunciationResult> => {
  try {
    return await callAiApi('pronunciation', { audioBase64, mimeType, targetPhrase, transcription });
  } catch (e) {
    return { isCorrect: false, score: 0, feedback: 'Erro ao processar áudio.' };
  }
};

export const generateSpeech = async (text: string): Promise<string | null> => {
  try {
    const data = await callAiApi<{ base64: string | null }>('speech', { text });
    return data.base64;
  } catch (e) {
    return null;
  }
};

export const generatePhrases = async (topic: string, difficulty: string, count: number = 5): Promise<Phrase[]> => {
  return callAiApi('generatePhrases', { topic, difficulty, count });
};

export const generateWords = async (category: string, _difficulty: string, count: number = 10): Promise<Phrase[]> => {
  return callAiApi('generateWords', { category, count });
};
