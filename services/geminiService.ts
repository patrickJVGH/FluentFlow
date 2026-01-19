
import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import { Phrase, PronunciationResult, ChatMessage } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const modelName = 'gemini-3-flash-preview';
const ttsModelName = 'gemini-2.5-flash-preview-tts';

const CONVERSATION_SYSTEM_PROMPT = `
ROLE: You are EVE, a sympathetic and expert English tutor. 
OBJECTIVE: Engage in natural conversation while providing high-quality pedagogical feedback.

CRITICAL RULE FOR SILENCE:
- If the audio contains NO SPEECH, only silence, or only background noise:
  - You MUST set "isSilent": true.
  - Set "transcription": "".
  - Set "response": "I couldn't hear you. Could you repeat that?".

FOR VALID USER INPUT:
1. Transcribe exactly what the user said in "transcription".
2. Set "isSilent": false.
3. Provide a conversational response in English in "response".
4. Provide a Portuguese translation in "responsePortuguese".
5. ANALYZE THE USER'S ENGLISH:
   - Identify grammar errors or unnatural phrasing.
   - Suggest a more "native-like" way in "improvement".
   - Give a brief tip in Portuguese in "feedback".
`;

const PRONUNCIATION_SYSTEM_PROMPT = `
ROLE: You are a strict English Pronunciation Coach.
OBJECTIVE: Compare the user's audio input with the target phrase.
CRITICAL: If it is silent or unintelligible, score must be 0 and isCorrect false.
`;

const conversationSchema = {
  type: Type.OBJECT,
  properties: {
    isSilent: { type: Type.BOOLEAN, description: "True if no speech was detected in the audio" },
    transcription: { type: Type.STRING },
    response: { type: Type.STRING },
    responsePortuguese: { type: Type.STRING },
    feedback: { type: Type.STRING },
    improvement: { type: Type.STRING }
  },
  required: ['isSilent', 'transcription', 'response', 'responsePortuguese']
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
): Promise<{ isSilent: boolean; transcription: string; response: string; translation: string; feedback?: string; improvement?: string }> => {
  try {
    const historyContext = history.slice(-5).map(h => `${h.role === 'user' ? 'User' : 'EVE'}: ${h.text}`).join('\n');
    const apiCall = ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          { text: `CONTEXT:\n${historyContext}\n\nUSER AUDIO INPUT IS BELOW. If you hear nothing, set isSilent to true.` },
          { inlineData: { mimeType, data: audioBase64 } }
        ]
      },
      config: {
        systemInstruction: CONVERSATION_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: conversationSchema,
        temperature: 0.1 // Lower temperature for more accuracy
      },
    });
    const response = await withTimeout<GenerateContentResponse>(apiCall, 45000);
    const result = JSON.parse(response.text || '{}');
    return {
      isSilent: !!result.isSilent,
      transcription: result.transcription || "",
      response: result.response || "I couldn't hear you clearly.",
      translation: result.responsePortuguese || "Não consegui te ouvir claramente.",
      feedback: result.feedback,
      improvement: result.improvement
    };
  } catch (error) {
    return { isSilent: false, transcription: "(Error)", response: "Connection error.", translation: "Erro de conexão." };
  }
};

export const validatePronunciation = async (audioBase64: string, mimeType: string, targetPhrase: string): Promise<PronunciationResult> => {
  try {
    const apiCall = ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          { inlineData: { mimeType, data: audioBase64 } },
          { text: `Target phrase: "${targetPhrase}". Be extremely strict about silence.` }
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
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (e) { return null; }
};

export const generatePhrases = async (topic: string, difficulty: string, count: number = 5): Promise<Phrase[]> => {
  const response = await ai.models.generateContent({
    model: modelName,
    contents: `Generate ${count} English phrases about ${topic} with ${difficulty} difficulty.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: phraseGenerationSchema,
    }
  });
  const data = JSON.parse(response.text || '[]');
  return data.map((p: any, i: number) => ({ ...p, id: `gen_${Date.now()}_${i}` }));
};

export const generateWords = async (category: string, difficulty: string, count: number = 10): Promise<Phrase[]> => {
  const response = await ai.models.generateContent({
    model: modelName,
    contents: `Generate ${count} common English words related to ${category}.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: phraseGenerationSchema,
    }
  });
  const data = JSON.parse(response.text || '[]');
  return data.map((p: any, i: number) => ({ ...p, id: `word_${Date.now()}_${i}` }));
};
