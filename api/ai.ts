import OpenAI from 'openai';
import { toFile } from 'openai/uploads';

type AnyObject = Record<string, any>;
type ChatHistoryItem = { role: 'user' | 'model'; text: string };

type EveDebugInfo = {
  requestId: string;
  transcriptSource: 'browser' | 'server' | 'none';
  transcriptionModel: string | null;
  chatModel: string | null;
  ttsModel: string | null;
  warnings: string[];
  errors: string[];
};

const envFlag = (value?: string): boolean => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

const normalizeText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const splitModels = (value?: string): string[] =>
  (value || '')
    .split(',')
    .map(model => model.trim())
    .filter(Boolean);

const uniqueModels = (values: Array<string | undefined | null>): string[] => {
  const normalized = values.map(value => (value || '').trim()).filter(Boolean);
  return Array.from(new Set(normalized));
};

const buildRequestId = (prefix: string = 'srv'): string =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const errorMessage = (error: any): string => String(error?.message || error || 'unknown_error');

const resolveIncomingRequestId = (req: any, payload?: AnyObject): string => {
  const headerId =
    normalizeText(req?.headers?.['x-eve-request-id']) ||
    normalizeText(req?.headers?.['X-EVE-Request-Id']);
  const bodyId = normalizeText(payload?.requestId);
  return bodyId || headerId || buildRequestId('srv');
};

const safeJsonParse = <T>(text: string, fallback: T): T => {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
};

const decodeAudio = (audioBase64: string): Buffer => Buffer.from(audioBase64, 'base64');

const extensionFromMimeType = (mimeTypeRaw: string): string => {
  const mimeType = mimeTypeRaw.toLowerCase();
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('ogg') || mimeType.includes('opus')) return 'ogg';
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
  if (mimeType.includes('wav')) return 'wav';
  if (mimeType.includes('flac')) return 'flac';
  if (mimeType.includes('mp4') || mimeType.includes('m4a') || mimeType.includes('aac')) return 'm4a';
  return 'webm';
};

const isModelAccessError = (error: any): boolean => {
  const message = errorMessage(error).toLowerCase();
  const status = Number(error?.status ?? error?.statusCode ?? error?.response?.status ?? 0);
  const code = String(error?.code || error?.error?.code || '').toLowerCase();
  return (
    status === 403 ||
    code === 'model_not_found' ||
    message.includes('does not have access to model') ||
    message.includes('model_not_found') ||
    (message.includes('403') && message.includes('access')) ||
    (message.includes('forbidden') && message.includes('model'))
  );
};

const isRetryableModelError = (error: any): boolean => {
  const message = errorMessage(error).toLowerCase();
  return (
    isModelAccessError(error) ||
    error?.status === 429 ||
    (typeof error?.status === 'number' && error.status >= 500) ||
    message.includes('timeout') ||
    message.includes('temporarily unavailable') ||
    message.includes('rate limit')
  );
};

const createDebug = (requestId: string): EveDebugInfo => ({
  requestId,
  transcriptSource: 'none',
  transcriptionModel: null,
  chatModel: null,
  ttsModel: null,
  warnings: [],
  errors: [],
});

const logEve = (requestId: string, stage: string, data?: AnyObject) => {
  const tag = `[api/eve][${requestId}] ${stage}`;
  if (data) console.log(tag, data);
  else console.log(tag);
};

const chatModels = uniqueModels([
  ...splitModels(process.env.OPENAI_CHAT_MODELS),
  process.env.OPENAI_CHAT_MODEL,
  'gpt-4.1-mini',
  'gpt-4.1-nano',
  'gpt-4o-mini',
]);

const transcriptionModels = uniqueModels([
  ...splitModels(process.env.OPENAI_STT_MODELS),
  process.env.OPENAI_TRANSCRIPTION_MODEL,
  'gpt-4o-mini-transcribe',
  'whisper-1',
]);

const ttsModels = uniqueModels([
  ...splitModels(process.env.OPENAI_TTS_MODELS),
  process.env.OPENAI_TTS_MODEL,
  'gpt-4o-mini-tts',
  'tts-1',
]);

const transcriptionLanguage = normalizeText(process.env.OPENAI_TRANSCRIPTION_LANGUAGE) || undefined;
const ttsVoice = normalizeText(process.env.OPENAI_TTS_VOICE) || 'alloy';
const disableServerTranscription = envFlag(process.env.DISABLE_SERVER_TRANSCRIPTION);
const disableServerTts = envFlag(process.env.DISABLE_SERVER_TTS);
const buildId = normalizeText(process.env.VERCEL_GIT_COMMIT_SHA).slice(0, 12) || 'local';
let ttsAccessUnavailableForRuntime = false;
let chatAccessUnavailableForRuntime = false;
let sttAccessUnavailableForRuntime = false;

const chatJsonWithFallback = async <T>(
  openai: OpenAI | null,
  systemPrompt: string,
  userPrompt: string,
  fallback: T,
  debug: EveDebugInfo
): Promise<T> => {
  if (chatAccessUnavailableForRuntime) {
    debug.warnings.push('server_chat_model_access_unavailable_runtime');
    return fallback;
  }

  if (!openai) {
    debug.warnings.push('chat_unavailable:OPENAI_API_KEY is not set for chat');
    return fallback;
  }

  if (!chatModels.length) {
    debug.warnings.push('chat_unavailable:No chat models configured');
    return fallback;
  }

  let lastError = '';
  let modelAccessDenied = false;
  for (const model of chatModels) {
    try {
      const completion = await openai.chat.completions.create({
        model,
        temperature: 0.25,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      });

      debug.chatModel = model;
      const content = completion.choices[0]?.message?.content || '';
      return safeJsonParse<T>(content, fallback);
    } catch (error: any) {
      const message = errorMessage(error);
      lastError = message;
      if (isModelAccessError(error)) modelAccessDenied = true;
      debug.warnings.push(`chat:${model}:${message}`);
      if (!isRetryableModelError(error)) break;
    }
  }

  if (lastError) {
    if (
      modelAccessDenied ||
      lastError.toLowerCase().includes('does not have access to model') ||
      lastError.toLowerCase().includes('model_not_found')
    ) {
      chatAccessUnavailableForRuntime = true;
      debug.warnings.push('server_chat_disabled_for_runtime_due_model_access');
    } else {
      debug.warnings.push(`chat_unavailable:${lastError}`);
    }
  }
  return fallback;
};

const resolveTranscript = async (
  openai: OpenAI | null,
  audioBase64Raw: unknown,
  mimeTypeRaw: unknown,
  browserTranscriptRaw: unknown,
  debug: EveDebugInfo
): Promise<string> => {
  const browserTranscript = normalizeText(browserTranscriptRaw);
  if (browserTranscript) {
    debug.transcriptSource = 'browser';
    return browserTranscript;
  }

  if (disableServerTranscription) {
    debug.warnings.push('server_transcription_disabled');
    return '';
  }

  if (sttAccessUnavailableForRuntime) {
    debug.warnings.push('server_stt_model_access_unavailable_runtime');
    return '';
  }

  const audioBase64 = normalizeText(audioBase64Raw);
  const mimeType = normalizeText(mimeTypeRaw);
  if (!audioBase64) {
    debug.warnings.push('no_audio_payload');
    return '';
  }

  if (!openai) {
    debug.warnings.push('stt_unavailable:OPENAI_API_KEY is not set for transcription');
    return '';
  }

  const ext = extensionFromMimeType(mimeType || 'audio/webm');
  const audioBuffer = decodeAudio(audioBase64);

  let lastError = '';
  let modelAccessDenied = false;
  for (const model of transcriptionModels) {
    try {
      const audioFile = await toFile(audioBuffer, `audio.${ext}`);
      const tx = await openai.audio.transcriptions.create({
        file: audioFile,
        model,
        ...(transcriptionLanguage ? { language: transcriptionLanguage } : {}),
      });

      const text = normalizeText(tx.text);
      if (!text) {
        debug.warnings.push(`stt:${model}:empty_transcript`);
        continue;
      }

      debug.transcriptSource = 'server';
      debug.transcriptionModel = model;
      return text;
    } catch (error: any) {
      const message = errorMessage(error);
      lastError = message;
      if (isModelAccessError(error)) modelAccessDenied = true;
      debug.warnings.push(`stt:${model}:${message}`);
      if (!isRetryableModelError(error)) break;
    }
  }

  if (lastError) {
    if (
      modelAccessDenied ||
      lastError.toLowerCase().includes('does not have access to model') ||
      lastError.toLowerCase().includes('model_not_found')
    ) {
      sttAccessUnavailableForRuntime = true;
      debug.warnings.push('server_stt_disabled_for_runtime_due_model_access');
    } else {
      debug.warnings.push(`stt_unavailable:${lastError}`);
    }
  }
  return '';
};

const synthesizeSpeech = async (
  openai: OpenAI | null,
  textRaw: unknown,
  debug: EveDebugInfo
): Promise<{ base64: string | null; mimeType: string | null }> => {
  const text = normalizeText(textRaw);
  if (!text) {
    debug.errors.push('empty_text_for_tts');
    return { base64: null, mimeType: null };
  }

  if (disableServerTts) {
    debug.warnings.push('server_tts_disabled');
    return { base64: null, mimeType: null };
  }

  if (ttsAccessUnavailableForRuntime) {
    debug.warnings.push('server_tts_model_access_unavailable_runtime');
    return { base64: null, mimeType: null };
  }

  if (!openai) {
    debug.errors.push('OPENAI_API_KEY is not set for speech');
    return { base64: null, mimeType: null };
  }

  let lastError = '';
  let modelAccessDenied = false;
  for (const model of ttsModels) {
    try {
      const speech = await openai.audio.speech.create({
        model,
        voice: ttsVoice,
        input: text,
        response_format: 'mp3',
      });

      const audioBuffer = Buffer.from(await speech.arrayBuffer());
      debug.ttsModel = model;
      return { base64: audioBuffer.toString('base64'), mimeType: 'audio/mpeg' };
    } catch (error: any) {
      const message = errorMessage(error);
      lastError = message;
      if (isModelAccessError(error)) modelAccessDenied = true;
      debug.warnings.push(`tts:${model}:${message}`);
      if (!isRetryableModelError(error)) break;
    }
  }

  if (lastError) {
    if (
      modelAccessDenied ||
      lastError.toLowerCase().includes('does not have access to model') ||
      lastError.toLowerCase().includes('model_not_found')
    ) {
      ttsAccessUnavailableForRuntime = true;
      debug.warnings.push('server_tts_disabled_for_runtime_due_model_access');
    } else {
      // Keep speech flow alive with browser TTS fallback instead of surfacing a hard error.
      debug.warnings.push(`server_tts_unavailable:${lastError}`);
    }
  }
  return { base64: null, mimeType: null };
};

const normalizeHistory = (historyRaw: unknown): ChatHistoryItem[] => {
  if (!Array.isArray(historyRaw)) return [];

  return historyRaw
    .map(item => {
      const role = item?.role === 'user' ? 'user' : item?.role === 'model' ? 'model' : null;
      const text = normalizeText(item?.text);
      if (!role || !text) return null;
      return { role, text };
    })
    .filter(Boolean) as ChatHistoryItem[];
};

const buildLocalTutorFallback = (transcription: string) => {
  const clean = normalizeText(transcription).replace(/\s+/g, ' ');
  const words = clean.split(' ').filter(Boolean);
  const shortInput = words.length < 4;
  const isGreeting = /\b(hi|hello|hey|good morning|good afternoon|good evening)\b/i.test(clean);
  const asksHowAreYou = /\bhow are you\b/i.test(clean);

  let response = `Nice try. You said: "${clean}". Can you add one more detail?`;
  let responsePortuguese = `Boa tentativa. Voce disse: "${clean}". Pode adicionar mais um detalhe?`;
  let feedback = 'Use complete sentences with subject, verb, and detail.';
  let improvement = 'Try: "I am practicing English because I want to speak with confidence."';

  if (isGreeting) {
    response = 'Hello! I am happy to practice with you. How was your day?';
    responsePortuguese = 'Ola! Estou feliz em praticar com voce. Como foi seu dia?';
    feedback = 'Great greeting. Ask a follow-up question to keep the conversation going.';
    improvement = 'Try: "Hi EVE, my day was good. I studied English for 20 minutes."';
  } else if (asksHowAreYou) {
    response = 'I am doing well, thank you. What did you do today?';
    responsePortuguese = 'Estou bem, obrigado. O que voce fez hoje?';
    feedback = 'Good question. Now answer your own question with one full sentence.';
    improvement = 'Try: "Today I worked, exercised, and studied English."';
  } else if (shortInput) {
    response = `I heard: "${clean}". Can you say the same idea with a longer sentence?`;
    responsePortuguese = `Eu ouvi: "${clean}". Pode dizer a mesma ideia com uma frase mais longa?`;
    feedback = 'Speak in longer phrases to improve fluency.';
    improvement = 'Try to use at least 6 words in your next answer.';
  }

  return { response, responsePortuguese, feedback, improvement };
};

const handleEveConversation = async (openai: OpenAI | null, payload: AnyObject = {}) => {
  const requestId = normalizeText(payload.requestId) || buildRequestId('eve');
  const debug = createDebug(requestId);
  const history = normalizeHistory(payload.history).slice(-8);

  logEve(requestId, 'conversation:start', {
    hasAudio: Boolean(normalizeText(payload.audioBase64)),
    hasBrowserTranscript: Boolean(normalizeText(payload.transcription)),
    historyItems: history.length,
  });

  const transcription = await resolveTranscript(
    openai,
    payload.audioBase64,
    payload.mimeType,
    payload.transcription,
    debug
  );

  if (!transcription) {
    if (debug.errors.length) {
      debug.warnings.push(...debug.errors.map(error => `conversation_nonfatal:${error}`));
      debug.errors = [];
    }
    logEve(requestId, 'conversation:no_transcript', { debug });
    return {
      requestId,
      isSilent: true,
      transcription: '',
      response: "I couldn't hear you clearly. Please try again.",
      translation: 'Nao consegui te ouvir com clareza. Tente novamente.',
      debug,
      error: undefined,
    };
  }

  const historyText = history
    .map(item => `${item.role === 'user' ? 'User' : 'EVE'}: ${item.text}`)
    .join('\n');

  const fallback = buildLocalTutorFallback(transcription);

  const result = await chatJsonWithFallback(
    openai,
    'You are EVE, an English tutor for Brazilian Portuguese speakers. Reply in English. Return only JSON with keys: response, responsePortuguese, feedback, improvement.',
    `Recent conversation:\n${historyText || '(empty)'}\n\nUser said:\n"${transcription}"\n\nRespond naturally, concise, and educational.`,
    fallback,
    debug
  );

  logEve(requestId, 'conversation:done', {
    buildId,
    transcriptSource: debug.transcriptSource,
    transcriptionModel: debug.transcriptionModel,
    chatModel: debug.chatModel,
    warnings: debug.warnings.length,
    errors: debug.errors.length,
    warningDetails: debug.warnings,
    errorDetails: debug.errors,
  });
  debug.warnings.forEach((warning, index) => {
    logEve(requestId, `conversation:warning:${index + 1}`, { warning });
  });
  debug.errors.forEach((error, index) => {
    logEve(requestId, `conversation:error:${index + 1}`, { error });
  });

  return {
    requestId,
    isSilent: false,
    transcription,
    response: normalizeText(result.response) || fallback.response,
    translation: normalizeText(result.responsePortuguese) || fallback.responsePortuguese,
    feedback: normalizeText(result.feedback) || fallback.feedback,
    improvement: normalizeText(result.improvement),
    debug,
    error: debug.errors.join(' | ') || undefined,
  };
};

const handleEveSpeech = async (openai: OpenAI | null, payload: AnyObject = {}) => {
  const requestId = normalizeText(payload.requestId) || buildRequestId('eve');
  const debug = createDebug(requestId);

  const text = normalizeText(payload.text);
  logEve(requestId, 'speech:start', { textLength: text.length });

  const speech = await synthesizeSpeech(openai, text, debug);

  // Speech action should always degrade gracefully to browser TTS on the client.
  // Convert server-side TTS failures into warnings to avoid blocking the UX.
  if (!speech.base64 && debug.errors.length) {
    debug.warnings.push(...debug.errors.map(error => `speech_nonfatal:${error}`));
    debug.errors = [];
  }

  logEve(requestId, 'speech:done', {
    buildId,
    ttsModel: debug.ttsModel,
    hasAudio: Boolean(speech.base64),
    warnings: debug.warnings.length,
    errors: debug.errors.length,
    warningDetails: debug.warnings,
    errorDetails: debug.errors,
  });
  debug.warnings.forEach((warning, index) => {
    logEve(requestId, `speech:warning:${index + 1}`, { warning });
  });
  debug.errors.forEach((error, index) => {
    logEve(requestId, `speech:error:${index + 1}`, { error });
  });

  return {
    requestId,
    base64: speech.base64,
    mimeType: speech.mimeType,
    debug,
    error: debug.errors.join(' | ') || undefined,
  };
};

const handlePronunciation = async (openai: OpenAI | null, payload: AnyObject = {}) => {
  const requestId = normalizeText(payload.requestId) || buildRequestId('pron');
  const debug = createDebug(requestId);
  const targetPhrase = normalizeText(payload.targetPhrase);

  const transcript = await resolveTranscript(
    openai,
    payload.audioBase64,
    payload.mimeType,
    payload.transcription,
    debug
  );

  if (!transcript) {
    return {
      transcript: '',
      isCorrect: false,
      score: 0,
      feedback: 'Nao consegui ouvir sua voz com clareza. Tente novamente.',
      words: [],
      debug,
    };
  }

  const fallback = {
    transcript,
    isCorrect: false,
    score: 0,
    feedback: 'Nao foi possivel avaliar a pronuncia agora.',
    words: [],
  };

  const result = await chatJsonWithFallback(
    openai,
    'You are a strict English pronunciation coach. Return only JSON with keys: transcript,isCorrect,score,feedback,words. words must be array of {word,status,phoneticIssue?}. status is correct or needs_improvement.',
    `Target phrase: "${targetPhrase}"\nSpoken transcript: "${transcript}"\nEvaluate pronunciation with objective feedback.`,
    fallback,
    debug
  );

  return {
    transcript: normalizeText(result.transcript) || transcript,
    isCorrect: Boolean(result.isCorrect),
    score: typeof result.score === 'number' ? Math.max(0, Math.min(100, result.score)) : 0,
    feedback: normalizeText(result.feedback) || fallback.feedback,
    words: Array.isArray(result.words) ? result.words : [],
    debug,
  };
};

const handleGeneratePhrases = async (openai: OpenAI | null, payload: AnyObject = {}) => {
  if (!openai) throw new Error('OPENAI_API_KEY is not set');

  const requestId = buildRequestId('phr');
  const debug = createDebug(requestId);

  const topic = normalizeText(payload.topic) || 'General';
  const difficulty = normalizeText(payload.difficulty) || 'medium';
  const count = Number(payload.count) > 0 ? Number(payload.count) : 5;

  const result = await chatJsonWithFallback<any[]>(
    openai,
    'Return only a JSON array. Each item must include english, portuguese, difficulty (easy|medium|hard), category.',
    `Generate ${count} English learning phrases about "${topic}" with "${difficulty}" difficulty.`,
    [],
    debug
  );

  return (Array.isArray(result) ? result : []).map((item: AnyObject, index: number) => ({
    id: `gen_${Date.now()}_${index}`,
    english: normalizeText(item.english),
    portuguese: normalizeText(item.portuguese),
    difficulty: ['easy', 'medium', 'hard'].includes(item.difficulty) ? item.difficulty : 'medium',
    category: normalizeText(item.category) || topic,
  }));
};

const handleGenerateWords = async (openai: OpenAI | null, payload: AnyObject = {}) => {
  if (!openai) throw new Error('OPENAI_API_KEY is not set');

  const requestId = buildRequestId('word');
  const debug = createDebug(requestId);

  const category = normalizeText(payload.category) || 'General';
  const count = Number(payload.count) > 0 ? Number(payload.count) : 10;

  const result = await chatJsonWithFallback<any[]>(
    openai,
    'Return only a JSON array. Each item must include english, portuguese, difficulty (easy|medium|hard), category.',
    `Generate ${count} common English words related to "${category}".`,
    [],
    debug
  );

  return (Array.isArray(result) ? result : []).map((item: AnyObject, index: number) => ({
    id: `word_${Date.now()}_${index}`,
    english: normalizeText(item.english),
    portuguese: normalizeText(item.portuguese),
    difficulty: ['easy', 'medium', 'hard'].includes(item.difficulty) ? item.difficulty : 'medium',
    category: normalizeText(item.category) || category,
  }));
};

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      buildId,
      hasOpenAIKey: Boolean(normalizeText(process.env.OPENAI_API_KEY)),
      chatModels,
      transcriptionModels,
      ttsModels,
      disableServerTranscription,
      disableServerTts,
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, payload } = req.body || {};
    const requestId = resolveIncomingRequestId(req, payload || {});
    res.setHeader('X-EVE-Request-Id', requestId);

    console.log('[api/ai] Incoming request', {
      buildId,
      method: req?.method,
      action,
      requestId,
    });

    const apiKey = normalizeText(process.env.OPENAI_API_KEY);
    const openai = apiKey ? new OpenAI({ apiKey }) : null;

    switch (action) {
      case 'eveConversation':
      case 'conversation': {
        const result = await handleEveConversation(openai, payload);
        return res.status(200).json(result);
      }

      case 'eveSpeech':
      case 'speech': {
        const result = await handleEveSpeech(openai, payload);
        return res.status(200).json(result);
      }

      case 'pronunciation': {
        const result = await handlePronunciation(openai, payload);
        return res.status(200).json(result);
      }

      case 'generatePhrases': {
        const result = await handleGeneratePhrases(openai, payload);
        return res.status(200).json(result);
      }

      case 'generateWords': {
        const result = await handleGenerateWords(openai, payload);
        return res.status(200).json(result);
      }

      default:
        console.warn('[api/ai] Invalid action', { action, requestId });
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error: any) {
    console.error('[api/ai] Request failed', {
      action: req?.body?.action,
      message: errorMessage(error),
      stack: error?.stack,
    });
    return res.status(500).json({ error: errorMessage(error) });
  }
}
