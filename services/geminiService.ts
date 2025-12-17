
import { GoogleGenAI, Type, Schema, Modality, GenerateContentResponse } from "@google/genai";
import { Phrase, PronunciationResult, ChatMessage } from "../types";
import { getRandomPhrases } from "../phrases";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const modelName = 'gemini-3-flash-preview';
const ttsModelName = 'gemini-2.5-flash-preview-tts';
const CACHE_PREFIX = 'fluentflow_cache_';

const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Timeout limit reached")), timeoutMs))
  ]);
};

// Caching strategy: return null if not in cache, avoid calling API if we can help it
const getCachedData = (key: string) => {
    try {
        const cached = localStorage.getItem(CACHE_PREFIX + key);
        if (cached) return JSON.parse(cached);
    } catch(e) {}
    return null;
};

const setCachedData = (key: string, data: any) => {
    try {
        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data));
    } catch(e) {}
};

export const generatePhrases = async (topic: string, difficulty: 'easy' | 'medium' | 'hard', count: number = 5): Promise<Phrase[]> => {
  const cacheKey = `p_${topic}_${difficulty}`;
  const cached = getCachedData(cacheKey);
  if (cached && cached.length >= count) return cached.slice(0, count);

  try {
    const response = await withTimeout(ai.models.generateContent({
      model: modelName,
      contents: `Generate ${count} English phrases for topic: "${topic}", difficulty: ${difficulty}. Output JSON with english, portuguese, difficulty fields.`,
      config: { responseMimeType: "application/json" },
    }), 15000);

    const data = JSON.parse(response.text || '{"phrases": []}');
    const phrases = (data.phrases || []).map((p: any, i: number) => ({ ...p, id: `gen-${Date.now()}-${i}` }));
    if (phrases.length > 0) setCachedData(cacheKey, phrases);
    return phrases.length > 0 ? phrases : getRandomPhrases(count);
  } catch (error) {
    return getRandomPhrases(count);
  }
};

export const generateWords = async (topic: string, difficulty: 'easy' | 'medium' | 'hard', count: number = 10): Promise<Phrase[]> => {
  const cacheKey = `w_${topic}_${difficulty}`;
  const cached = getCachedData(cacheKey);
  if (cached && cached.length >= count) return cached.slice(0, count);

  try {
    const response = await withTimeout(ai.models.generateContent({
      model: modelName,
      contents: `Generate ${count} difficult English words for: "${topic}". Output JSON with words: [{english, portuguese, difficulty, category}].`,
      config: { responseMimeType: "application/json" },
    }), 15000);

    const data = JSON.parse(response.text || '{"words": []}');
    const words = (data.words || []).map((w: any, i: number) => ({ ...w, id: `wrd-${Date.now()}-${i}` }));
    if (words.length > 0) setCachedData(cacheKey, words);
    return words.length > 0 ? words : getRandomPhrases(count);
  } catch (error) {
    return getRandomPhrases(count);
  }
};

export const processConversationTurn = async (audioBase64: string, mimeType: string, history: ChatMessage[]) => {
  try {
    const response = await withTimeout(ai.models.generateContent({
      model: modelName,
      contents: [{ text: "Analyze audio, transcribe it, and respond in English. Provide JSON: {transcription, response, responsePortuguese, feedback}" }, { inlineData: { mimeType, data: audioBase64 } }],
      config: { responseMimeType: "application/json" },
    }), 25000);
    const result = JSON.parse(response.text || '{}');
    return {
      transcription: result.transcription || "...",
      response: result.response || "Interesting. Tell me more.",
      translation: result.responsePortuguese || "Interessante. Conte-me mais.",
      feedback: result.feedback
    };
  } catch (error) {
    return { transcription: "...", response: "Could you repeat that?", translation: "Poderia repetir?", feedback: undefined };
  }
};

export const validatePronunciation = async (audioBase64: string, mimeType: string, target: string, diff: string): Promise<PronunciationResult> => {
  try {
    const response = await withTimeout(ai.models.generateContent({
      model: modelName,
      contents: [{ text: `Evaluate pronunciation of: "${target}". Output JSON: {transcript, isCorrect, score, feedback (PT-BR), words: [{word, status: 'correct'|'needs_improvement'}]}` }, { inlineData: { mimeType, data: audioBase64 } }],
      config: { responseMimeType: "application/json" },
    }), 20000);
    const res = JSON.parse(response.text || '{}');
    return { isCorrect: !!res.isCorrect, score: res.score || 0, feedback: res.feedback || "Tente novamente.", words: res.words, heardPhrase: res.transcript };
  } catch (error) {
    return { isCorrect: false, score: 0, feedback: "Erro de conexão. Tente novamente." };
  }
};

export const generateSpeech = async (text: string): Promise<string | null> => {
  try {
    const response = await withTimeout(ai.models.generateContent({
      model: ttsModelName,
      contents: [{ parts: [{ text: `Say: "${text}"` }] }],
      config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } } },
    }), 30000);
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (error) {
    return null;
  }
};
