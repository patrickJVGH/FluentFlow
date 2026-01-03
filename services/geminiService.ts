

import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import { Phrase, PronunciationResult, ChatMessage } from "../types";

// Always use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const modelName = 'gemini-3-flash-preview';
const ttsModelName = 'gemini-2.5-flash-preview-tts';

const CONVERSATION_SYSTEM_PROMPT = `
ROLE: You are EVE, a sympathetic and expert English tutor. 
OBJECTIVE: Engage in natural conversation while providing high-quality pedagogical feedback.

FOR EVERY USER INPUT:
1. Transcribe exactly what the user said.
2. Provide a conversational response in English (friendly, concise).
3. Provide a Portuguese translation of your response.
4. ANALYZE THE USER'S ENGLISH:
   - Identify grammar errors, unnatural phrasing, or vocabulary improvements.
   - Suggest a more "native-like" way to say what they intended.
   - Give a brief tip in Portuguese about their specific mistake.
`;

const PRONUNCIATION_SYSTEM_PROMPT = `
ROLE: You are a strict English Pronunciation Coach.
OBJECTIVE: Compare the user's audio input with the target phrase.

CRITICAL RULES:
1. ZERO TOLERANCE FOR SILENCE: If the audio is silent, only noise, or just a cough/breath, YOU MUST return isCorrect: false, score: 0, and feedback: "Não ouvi sua voz. Por favor, fale mais alto ou verifique seu microfone."
2. NO HALLUCINATION: Do not try to "guess" words. If it's not recognizable English matching the target, score is 0.
3. SCORING: 
   - 90-100: Very clear.
   - 70-89: Good, minor issues.
   - 40-69: Understandable but heavy errors.
   - 0-39: Incorrect or Unintelligible.
4. FEEDBACK: Give a short, helpful tip in Portuguese.
`;

// Define schemas as plain objects to avoid unsupported type imports
const conversationSchema = {
  type: Type.OBJECT,
  properties: {
    transcription: { type: Type.STRING },
    response: { type: Type.STRING },
    responsePortuguese: { type: Type.STRING },
    feedback: { type: Type.STRING },
    improvement: { type: Type.STRING }
  },
  required: ['transcription', 'response', 'responsePortuguese']
};

const validationSchema = {
  type: Type.OBJECT,
  properties: {
    transcript: { type: Type.STRING },
    isCorrect: { type: Type.BOOLEAN },
    score: { type: Type.INTEGER },
    feedback: { type: Type.STRING },
    words: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          status: { type: Type.STRING, enum: ['correct', 'needs_improvement', 'missing'] },
          phoneticIssue: { type: Type.STRING }
        },
        required: ['word', 'status']
      }
    }
  },
  required: ['transcript', 'isCorrect', 'score', 'feedback', 'words']
};

const phraseGenerationSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      english: { type: Type.STRING },
      portuguese: { type: Type.STRING },
      difficulty: { type: Type.STRING, enum: ['easy', 'medium', 'hard'] },
      category: { type: Type.STRING }
    },
    required: ['english', 'portuguese', 'difficulty']
  }
};

const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeoutMs))
  ]);
};

export const processConversationTurn = async (
  audioBase64: string,
  mimeType: string,
  history: ChatMessage[]
): Promise<{ transcription: string; response: string; translation: string; feedback?: string; improvement?: string }> => {
  try {
    const historyContext = history.slice(-5).map(h => `${h.role === 'user' ? 'User' : 'EVE'}: ${h.text}`).join('\n');
    // Ensure contents uses the parts structure inside a Content object
    const apiCall = ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          { text: `CONTEXT:\n${historyContext}\n\nUSER AUDIO INPUT IS BELOW.` },
          { inlineData: { mimeType, data: audioBase64 } }
        ]
      },
      config: {
        systemInstruction: CONVERSATION_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: conversationSchema,
        temperature: 0.7
      },
    });
    const response = await withTimeout<GenerateContentResponse>(apiCall, 45000);
    // Use .text property directly
    const result = JSON.parse(response.text || '{}');
    return {
      transcription: result.transcription || "...",
      response: result.response || "I didn't hear you clearly.",
      translation: result.responsePortuguese || "Não ouvi bem.",
      feedback: result.feedback,
      improvement: result.improvement
    };
  } catch (error) {
    return { transcription: "(Error)", response: "Connection error.", translation: "Erro de conexão." };
  }
};

export const validatePronunciation = async (audioBase64: string, mimeType: string, targetPhrase: string): Promise<PronunciationResult> => {
  try {
    // Ensure contents uses the parts structure inside a Content object
    const apiCall = ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          { inlineData: { mimeType, data: audioBase64 } },
          { text: `Target phrase: "${targetPhrase}". Be extremely strict about silence and noise.` }
        ]
      },
      config: {
        systemInstruction: PRONUNCIATION_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: validationSchema,
        temperature: 0, 
      },
    });
    const response = await withTimeout<GenerateContentResponse>(apiCall, 30000);
    // Use .text property directly
    return JSON.parse(response.text || '{}');
  } catch (e) {
    return { isCorrect: false, score: 0, feedback: "Erro ao processar áudio." };
  }
};

export const generateSpeech = async (text: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: ttsModelName,
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
      },
    });
    // Correct access to audio data in candidates
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (e) { return null; }
};

export const generatePhrases = async (topic: string, difficulty: string, count: number = 5): Promise<Phrase[]> => {
  const response = await ai.models.generateContent({
    model: modelName,
    contents: `Generate ${count} English phrases about ${topic} with ${difficulty} difficulty. Include Portuguese translations.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: phraseGenerationSchema,
    }
  });
  // Use .text property directly
  const data = JSON.parse(response.text || '[]');
  return data.map((p: any, i: number) => ({ ...p, id: `gen_${Date.now()}_${i}` }));
};

export const generateWords = async (category: string, difficulty: string, count: number = 10): Promise<Phrase[]> => {
  const response = await ai.models.generateContent({
    model: modelName,
    contents: `Generate ${count} common English words related to ${category} that are usually hard to pronounce. Include translations.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: phraseGenerationSchema,
    }
  });
  // Use .text property directly
  const data = JSON.parse(response.text || '[]');
  return data.map((p: any, i: number) => ({ ...p, id: `word_${Date.now()}_${i}` }));
};