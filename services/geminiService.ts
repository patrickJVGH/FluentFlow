
import { GoogleGenAI, Type, Schema, Modality, GenerateContentResponse } from "@google/genai";
import { Phrase, PronunciationResult, ChatMessage } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const modelName = 'gemini-2.5-flash';
const ttsModelName = 'gemini-2.5-flash-preview-tts';
const CACHE_PREFIX = 'fluentflow_cache_';

// --- PROMPTS ---

const CONVERSATION_SYSTEM_PROMPT = `
ROLE:
You are an advanced English conversation tutor specialized exclusively in teaching and developing spoken English as a second/foreign language (ESL/EFL). Your only function is to help the user communicate naturally, fluently, and confidently in English.

SCOPE LIMITATION:
Your scope is strictly limited to the English language.
You must not teach, analyze, or discuss any other language except when minimally required to clarify English usage.
All explanations, examples, and activities must ultimately serve the improvement of English proficiency.

PRIMARY OBJECTIVE:
Transform the user's passive knowledge of English into active communicative competence, enabling spontaneous, natural, and context-appropriate spoken English.

PEDAGOGICAL FRAMEWORK:
- Communicative Language Teaching (CLT)
- Task-Based Language Learning
- Interaction-driven learning
- Output-focused acquisition

CONVERSATION STRATEGY:
- Conduct interactions as realistic conversations.
- Encourage full, meaningful responses.
- Use open-ended questions and natural follow-ups.
- Maintain conversational flow over excessive correction.
- Prioritize speaking over theoretical explanation.

ERROR CORRECTION POLICY:
Apply selective and strategic correction.
Correct only when errors:
1. Obstruct communication
2. Are repeated (fossilized)
3. Sound unnatural or non-native-like

Correction methods:
- Implicit correction (recasts) as default
- Explicit correction only when necessary
- Brief, clear explanations focused on usage, not theory

Never:
- Correct every minor mistake
- Interrupt fluency unnecessarily
- Overload the learner with grammar rules

LINGUISTIC ANALYSIS (CONTINUOUS):
Continuously analyze:
- Syntax and sentence structure
- Lexical choice and collocations
- Verb tense and aspect
- Word order
- Register (formal vs informal)
- Literal translation from the learner’s L1

LEXICAL APPROACH:
- Prioritize high-frequency, functional vocabulary
- Teach collocations, chunks, and fixed expressions
- Avoid isolated vocabulary lists
- Always present vocabulary in context

NATURALNESS AND PRAGMATICS:
- Distinguish between grammatically correct and natural English
- Model how native speakers actually speak
- Adapt language to context: casual, professional, academic
- Emphasize clarity, tone, and intention

PRONUNCIATION AWARENESS:
Focus on intelligibility, not accent elimination.
Highlight:
- Word stress
- Sentence stress
- Rhythm and connected speech
Provide pronunciation guidance only when it affects understanding or naturalness.

ADAPTATION:
Dynamically adapt to the learner’s level:
- Vocabulary complexity
- Sentence length
- Speed of interaction
- Depth of correction

LANGUAGE USE POLICY:
- English must be the default language of interaction.
- Avoid using the learner’s native language unless strictly necessary to clarify English usage.
- Immediately return to English after clarification.

FEEDBACK STRUCTURE (WHEN USED):
- Corrected sentence
- Brief explanation
- More natural or idiomatic alternative

TONE AND ATTITUDE:
- Supportive, encouraging, and professional
- Treat errors as a natural part of learning
- Reinforce progress and confidence

OUTPUT PRIORITY:
- Make the learner speak more than the tutor
- Reduce hesitation through guided interaction
- Promote spontaneous sentence formation

FINAL OUTCOME:
The learner should be able to:
- Express ideas clearly in English
- Respond quickly without translating mentally
- Use natural, context-appropriate expressions
- Communicate confidently in real-life situations

OPERATION MODE:
Always guide the interaction toward active English conversation.
Avoid long theoretical explanations unless requested.
Keep English as the central and constant focus.
`;

// --- FALLBACK DATA ---
// Used when API fails or times out to ensure the app doesn't break.
const FALLBACK_PHRASES: Phrase[] = [
  { id: 'fb1', english: "Could you help me please?", portuguese: "Você poderia me ajudar, por favor?", difficulty: "easy", category: "Fallback" },
  { id: 'fb2', english: "I would like to order a coffee.", portuguese: "Eu gostaria de pedir um café.", difficulty: "easy", category: "Fallback" },
  { id: 'fb3', english: "What is the Wi-Fi password?", portuguese: "Qual é a senha do Wi-Fi?", difficulty: "medium", category: "Fallback" },
  { id: 'fb4', english: "How do I get to the train station?", portuguese: "Como chego à estação de trem?", difficulty: "medium", category: "Fallback" },
  { id: 'fb5', english: "It was nice meeting you.", portuguese: "Foi um prazer te conhecer.", difficulty: "medium", category: "Fallback" }
];

const FALLBACK_WORDS: Phrase[] = [
  { id: 'fbw1', english: "World", portuguese: "Mundo", difficulty: "hard", category: "R & L Sound" },
  { id: 'fbw2', english: "Though", portuguese: "Embora", difficulty: "medium", category: "TH Sound" },
  { id: 'fbw3', english: "Schedule", portuguese: "Cronograma", difficulty: "hard", category: "Clusters" },
  { id: 'fbw4', english: "Focus", portuguese: "Foco", difficulty: "easy", category: "Vowels" },
  { id: 'fbw5', english: "Algorithm", portuguese: "Algoritmo", difficulty: "hard", category: "Stress" }
];

// Helper to prevent infinite spinning
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Timeout limit reached")), timeoutMs))
  ]);
};

// Schema for Phrase Generation
const phraseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    phrases: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          english: { type: Type.STRING },
          portuguese: { type: Type.STRING },
          difficulty: { type: Type.STRING, enum: ['easy', 'medium', 'hard'] }
        },
        required: ['english', 'portuguese', 'difficulty']
      }
    }
  }
};

// Schema for Word Generation (New Mode)
const wordSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    words: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          english: { type: Type.STRING, description: "The single word to practice." },
          portuguese: { type: Type.STRING, description: "Translation." },
          difficulty: { type: Type.STRING, enum: ['easy', 'medium', 'hard'] },
          category: { type: Type.STRING, description: "The phonetic focus (e.g., 'TH Sound', 'R vs L', 'Long Vowels')." }
        },
        required: ['english', 'portuguese', 'difficulty', 'category']
      }
    }
  }
};

// Schema for Conversation Turn
const conversationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    transcription: { type: Type.STRING, description: "Transcription of what the user said." },
    response: { type: Type.STRING, description: "The tutor's conversational response in English." },
    responsePortuguese: { type: Type.STRING, description: "The Portuguese translation of the tutor's response." },
    feedback: { type: Type.STRING, description: "Optional corrections or phonetic advice in Portuguese, ONLY if necessary. Null if no error." }
  },
  required: ['transcription', 'response', 'responsePortuguese']
};

// Schema for Pronunciation Validation
const validationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    isCorrect: { type: Type.BOOLEAN, description: "True ONLY if pronunciation is clear and matches the target." },
    score: { type: Type.INTEGER, description: "Score from 0 to 100. 0 for silence/wrong words." },
    feedback: { type: Type.STRING, description: "Constructive feedback in Portuguese." },
    words: {
      type: Type.ARRAY,
      description: "Analysis of the word/phrase.",
      items: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          status: { type: Type.STRING, enum: ['correct', 'needs_improvement'] },
          phoneticIssue: { type: Type.STRING, description: "Specific phonetic advice in Portuguese." }
        },
        required: ['word', 'status']
      }
    },
    intonation: { type: Type.STRING, description: "Feedback on stress/intonation." }
  },
  required: ['isCorrect', 'score', 'feedback', 'words']
};

export const generatePhrases = async (topic: string, difficulty: 'easy' | 'medium' | 'hard', count: number = 12): Promise<Phrase[]> => {
  // 1. STRATEGY: Caching - Check local storage first
  const cacheKey = `${CACHE_PREFIX}phrases_${topic}_${difficulty}`;
  try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
              console.log("Using cached phrases for", topic);
              return parsed;
          }
      }
  } catch (e) { console.warn("Cache read error", e); }

  try {
    const difficultyGuide = {
      easy: "CEFR Level A1-A2. Simple sentences, high frequency words.",
      medium: "CEFR Level B1-B2. Connected speech, moderate complexity.",
      hard: "CEFR Level C1-C2. Idioms, advanced grammar, fast speech."
    };

    // 2. STRATEGY: Batching - Increased count to 12
    const apiCall = ai.models.generateContent({
      model: modelName,
      contents: `Generate ${count} distinct, conversationally natural phrases for the topic: "${topic}".
      Target Level: ${difficulty.toUpperCase()}.
      
      Rules:
      1. ${difficultyGuide[difficulty]}
      2. Portuguese Translation: Natural Brazilian Portuguese (PT-BR).
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: phraseSchema,
        temperature: 0.75,
      },
    });

    const response = await withTimeout<GenerateContentResponse>(apiCall, 30000);
    const data = JSON.parse(response.text || '{"phrases": []}');
    
    if (!data.phrases || data.phrases.length === 0) {
      throw new Error("Empty phrases returned");
    }

    const phrases = data.phrases.map((p: any, index: number) => ({
      ...p,
      id: `${topic}-${difficulty}-${Date.now()}-${index}`
    }));

    // Save to Cache
    try {
        localStorage.setItem(cacheKey, JSON.stringify(phrases));
    } catch(e) { console.warn("Cache write error", e); }

    return phrases;
  } catch (error) {
    console.error("Error generating phrases (Using Fallback):", error);
    return FALLBACK_PHRASES.map((p, i) => ({
        ...p, 
        id: `fallback-${Date.now()}-${i}`,
        english: p.english + " (Offline Mode)"
    }));
  }
};

export const generateWords = async (topic: string, difficulty: 'easy' | 'medium' | 'hard', count: number = 12): Promise<Phrase[]> => {
  // 1. STRATEGY: Caching
  const cacheKey = `${CACHE_PREFIX}words_${topic}_${difficulty}`;
  try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
              console.log("Using cached words for", topic);
              return parsed;
          }
      }
  } catch (e) { console.warn("Cache read error", e); }

  try {
    const apiCall = ai.models.generateContent({
      model: modelName,
      contents: `Generate ${count} challenging individual English words for phonetic practice related to the context of: "${topic}".
      Target Difficulty: ${difficulty}.
      
      FOCUS:
      - Include words with difficult sounds for Portuguese speakers (e.g., TH, R, World, Girl, Beach/Bitch, Sheet/Shit distinction).
      - Category should be the specific sound being practiced (e.g., "TH Sound", "Short Vowels").
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: wordSchema,
        temperature: 0.7,
      },
    });

    const response = await withTimeout<GenerateContentResponse>(apiCall, 30000);
    const data = JSON.parse(response.text || '{"words": []}');
    
    if (!data.words || data.words.length === 0) {
        throw new Error("Empty words returned");
    }

    const words = data.words.map((w: any, index: number) => ({
      ...w,
      id: `word-${Date.now()}-${index}`
    }));

    // Save to Cache
    try {
        localStorage.setItem(cacheKey, JSON.stringify(words));
    } catch(e) { console.warn("Cache write error", e); }

    return words;
  } catch (error) {
    console.error("Error generating words (Using Fallback):", error);
    return FALLBACK_WORDS.map((w, i) => ({
        ...w, 
        id: `fallback-word-${Date.now()}-${i}`,
        english: w.english + " (Offline Mode)"
    }));
  }
};

export const processConversationTurn = async (
  audioBase64: string,
  mimeType: string,
  history: ChatMessage[]
): Promise<{ transcription: string; response: string; translation: string; feedback?: string }> => {
  try {
    // Construct the chat history in the format Gemini expects
    // We only send the last few turns to save context window and focus, or all if short.
    // For this implementation, we will send context text + the new audio input.
    
    // Create a context string from history
    const historyContext = history.map(h => `${h.role === 'user' ? 'Student' : 'Tutor'}: ${h.text}`).join('\n');

    const apiCall = ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          {
             text: `
             PREVIOUS CONVERSATION CONTEXT:
             ${historyContext}
             
             INSTRUCTION: 
             Analyze the following audio input from the student. 
             Transcribe what they said.
             Respond as the Tutor based on the System Instructions provided in the config.
             Provide a Portuguese translation for your response.
             Provide feedback ONLY if there is a significant error.
             `
          },
          {
            inlineData: {
              mimeType: mimeType,
              data: audioBase64
            }
          }
        ]
      },
      config: {
        systemInstruction: CONVERSATION_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: conversationSchema,
      },
    });

    const response = await withTimeout<GenerateContentResponse>(apiCall, 45000);
    const result = JSON.parse(response.text || '{}');
    
    return {
      transcription: result.transcription || "(Audio unclear)",
      response: result.response || "I didn't catch that. Could you repeat?",
      translation: result.responsePortuguese || "Não entendi, poderia repetir?",
      feedback: result.feedback || undefined
    };

  } catch (error) {
    console.error("Error processing conversation turn:", error);
    return {
      transcription: "(Connection Error)",
      response: "I'm having trouble connecting to the server. Please try again.",
      translation: "Erro de conexão com o servidor. Tente novamente.",
      feedback: undefined
    };
  }
};

export const validatePronunciation = async (
  audioBase64: string, 
  mimeType: string, 
  targetPhrase: string,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium'
): Promise<PronunciationResult> => {
  try {
    const roleConfig = {
      easy: "Act as a supportive and encouraging English teacher for beginners. Be lenient with minor accent errors, focusing on basic intelligibility. If it's understandable, give a good score (80+).",
      medium: "Act as a balanced English teacher. Expect clear pronunciation and good flow. Penalize obvious errors but accept slight accent variations. Standard scoring.",
      hard: "Act as a strict American Voice Coach. Demand near-native precision, perfect intonation, and stress patterns. Be very critical of any mispronunciation. High scores (90+) are reserved for perfect speech."
    };

    const apiCall = ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: audioBase64
            }
          },
          {
            text: `
            TARGET PHRASE: "${targetPhrase}"
            DIFFICULTY: ${difficulty.toUpperCase()}
            ROLE: ${roleConfig[difficulty]}

            CRITICAL VALIDATION STEPS:
            1. **SILENCE/NOISE CHECK**: Listen to the audio first. 
               - IF the audio is silent, mostly static, or contains only background noise -> RETURN score: 0, isCorrect: false, feedback: "Não identifiquei fala no áudio. Verifique seu microfone ou tente falar mais alto."
               - IF the user is speaking a completely different language or sentence -> RETURN score: 0, isCorrect: false.

            2. **PRONUNCIATION CHECK**: Only if the audio matches the target phrase (even poorly), proceed to evaluate pronunciation based on the difficulty level.

            SCORING GUIDE:
            - 0-30: Silence, noise, unrelated speech, or completely unintelligible.
            - 31-60: Poor pronunciation, many errors, hard to understand.
            - 61-89: Good, understandable, some minor accent issues (Passable for Easy/Medium).
            - 90-100: Excellent, native-like clarity.

            OUTPUT REQUIREMENTS:
            - Feedback Language: Portuguese (PT-BR).
            - JSON format matching the schema.
            `
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: validationSchema,
      },
    });

    // Increased timeout to 60s as audio processing is heavy
    const response = await withTimeout<GenerateContentResponse>(apiCall, 60000);

    const result = JSON.parse(response.text || '{}');
    return {
      isCorrect: result.isCorrect,
      score: result.score || 0,
      feedback: result.feedback || "Não foi possível analisar o áudio.",
      words: result.words || [],
      intonation: result.intonation
    };
  } catch (error) {
    console.error("Error validating audio:", error);
    return {
      isCorrect: false,
      score: 0,
      feedback: "Erro técnico ao processar o áudio (Tempo limite ou Falha na API). Tente novamente."
    };
  }
};

// Returns string (base64 audio) or null if generation fails/is empty
export const generateSpeech = async (text: string): Promise<string | null> => {
  try {
    const promptText = `Say: "${text}"`; 
    
    // Increased timeout to 60s for TTS generation to prevent "Timeout limit reached"
    const response = await withTimeout<GenerateContentResponse>(
        ai.models.generateContent({
            model: ttsModelName,
            contents: [{ parts: [{ text: promptText }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Zephyr' },
                },
                },
            },
        }), 
        60000
    );

    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!audioData) {
      console.warn("Gemini TTS returned no audio data.");
      return null;
    }
    return audioData;
  } catch (error) {
    console.error("Error calling Gemini TTS:", error);
    return null;
  }
};
