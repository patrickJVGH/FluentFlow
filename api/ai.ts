import OpenAI from 'openai';
import { toFile } from 'openai/uploads';

type AnyObject = Record<string, any>;
type ChatHistoryItem = { role: 'user' | 'model'; text: string };

type EveDebugInfo = {
  requestId: string;
  transcriptSource: 'server' | 'none';
  transcriptionModel: string | null;
  chatModel: string | null;
  ttsModel: string | null;
  warnings: string[];
  errors: string[];
};

type ModelAccessBackoff = {
  until: number;
  reason: string;
};

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
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
  const tag = `[api/eve][${apiVersion}][${requestId}] ${stage}`;
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
  'gpt-4o-transcribe',
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
const apiVersion = 'eve-api-2026-03-19-0150';
const modelAccessBackoffMs = Math.max(0, Number(process.env.OPENAI_MODEL_ACCESS_BACKOFF_MS || 15000));
const createModelAccessBackoff = (): ModelAccessBackoff => ({ until: 0, reason: '' });
const readModelAccessBackoff = (state: ModelAccessBackoff, label: string): string | null => {
  const remainingMs = state.until - Date.now();
  if (remainingMs <= 0) return null;
  const remainingSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
  return `${label}:${remainingSeconds}s:${state.reason || 'model_access_error'}`;
};
const startModelAccessBackoff = (state: ModelAccessBackoff, reason: string) => {
  if (!modelAccessBackoffMs) return;
  state.until = Date.now() + modelAccessBackoffMs;
  state.reason = reason;
};
const clearModelAccessBackoff = (state: ModelAccessBackoff) => {
  state.until = 0;
  state.reason = '';
};
const ttsAccessBackoff = createModelAccessBackoff();
const chatAccessBackoff = createModelAccessBackoff();
const sttAccessBackoff = createModelAccessBackoff();
const generationCacheTtlMs = Math.max(60_000, Number(process.env.OPENAI_GENERATION_CACHE_TTL_MS || 6 * 60 * 60 * 1000));
const generationCacheMaxEntries = Math.max(10, Number(process.env.OPENAI_GENERATION_CACHE_MAX_ENTRIES || 100));
const generationCache = new Map<string, CacheEntry<AnyObject[]>>();

const buildGenerationCacheKey = (
  kind: 'phrases' | 'words',
  values: Record<string, string | number>
): string => {
  const suffix = Object.entries(values)
    .map(([key, value]) => `${key}:${String(value).trim().toLowerCase()}`)
    .join('|');
  return `${kind}|${suffix}`;
};

const readCache = <T>(cache: Map<string, CacheEntry<T>>, key: string): T | null => {
  const cached = cache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return cached.value;
};

const writeCache = <T>(cache: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs: number, maxEntries: number) => {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });

  if (cache.size <= maxEntries) return;

  const oldestKey = cache.keys().next().value;
  if (oldestKey) cache.delete(oldestKey);
};

const chatJsonWithFallback = async <T>(
  openai: OpenAI | null,
  systemPrompt: string,
  userPrompt: string,
  fallback: T,
  debug: EveDebugInfo
): Promise<T> => {
  const backoffWarning = readModelAccessBackoff(chatAccessBackoff, 'server_chat_backoff_active');
  if (backoffWarning) {
    debug.warnings.push(backoffWarning);
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
      clearModelAccessBackoff(chatAccessBackoff);
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
      startModelAccessBackoff(chatAccessBackoff, lastError);
      debug.warnings.push(`server_chat_backoff_started:${Math.max(1, Math.ceil(modelAccessBackoffMs / 1000))}s`);
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
  debug: EveDebugInfo
): Promise<string> => {
  if (disableServerTranscription) {
    debug.warnings.push('server_transcription_disabled');
    return '';
  }

  const backoffWarning = readModelAccessBackoff(sttAccessBackoff, 'server_stt_backoff_active');
  if (backoffWarning) {
    debug.warnings.push(backoffWarning);
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
      clearModelAccessBackoff(sttAccessBackoff);
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
      startModelAccessBackoff(sttAccessBackoff, lastError);
      debug.warnings.push(`server_stt_backoff_started:${Math.max(1, Math.ceil(modelAccessBackoffMs / 1000))}s`);
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

  const backoffWarning = readModelAccessBackoff(ttsAccessBackoff, 'server_tts_backoff_active');
  if (backoffWarning) {
    debug.warnings.push(backoffWarning);
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
      clearModelAccessBackoff(ttsAccessBackoff);
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
      startModelAccessBackoff(ttsAccessBackoff, lastError);
      debug.warnings.push(`server_tts_backoff_started:${Math.max(1, Math.ceil(modelAccessBackoffMs / 1000))}s`);
    } else {
      // Keep speech flow non-fatal so the screen remains usable even without audio playback.
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

const normalizePronunciationText = (value: string): string =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const pronunciationTokens = (value: string): string[] =>
  normalizePronunciationText(value)
    .split(' ')
    .filter(Boolean);

const levenshteinDistance = (left: string, right: string): number => {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const rows = Array.from({ length: left.length + 1 }, (_, index) => [index]);
  for (let column = 0; column <= right.length; column += 1) {
    rows[0][column] = column;
  }

  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      const substitutionCost = left[row - 1] === right[column - 1] ? 0 : 1;
      rows[row][column] = Math.min(
        rows[row - 1][column] + 1,
        rows[row][column - 1] + 1,
        rows[row - 1][column - 1] + substitutionCost
      );
    }
  }

  return rows[left.length][right.length];
};

const wordSimilarity = (expected: string, heard: string): number => {
  if (!expected || !heard) return 0;
  if (expected === heard) return 1;

  const distance = levenshteinDistance(expected, heard);
  const maxLength = Math.max(expected.length, heard.length, 1);
  return Math.max(0, 1 - distance / maxLength);
};

const buildLocalPronunciationFallback = (targetPhrase: string, transcript: string) => {
  const normalizedTarget = normalizePronunciationText(targetPhrase);
  const normalizedTranscript = normalizePronunciationText(transcript);
  const targetWords = pronunciationTokens(targetPhrase);
  const spokenWords = pronunciationTokens(transcript);

  if (!targetWords.length) {
    return {
      transcript,
      isCorrect: false,
      score: 0,
      feedback: 'Nao encontrei uma frase-alvo valida para comparar.',
      words: [],
    };
  }

  const detailedWords = targetWords.map((word, index) => {
    const heard = spokenWords[index] || '';
    const similarity = wordSimilarity(word, heard);
    const status = similarity >= 0.72 ? 'correct' : 'needs_improvement';

    let phoneticIssue: string | undefined;
    if (status === 'needs_improvement') {
      if (!heard) phoneticIssue = 'Palavra nao detectada com clareza.';
      else if (similarity < 0.45) phoneticIssue = `Ouvi "${heard}" em vez de "${word}".`;
      else phoneticIssue = `Soou proximo de "${heard}".`;
    }

    return {
      word,
      status,
      phoneticIssue,
      similarity,
    };
  });

  const averageSimilarity =
    detailedWords.reduce((sum, item) => sum + item.similarity, 0) / Math.max(detailedWords.length, 1);
  const lengthPenalty =
    (Math.abs(spokenWords.length - targetWords.length) / Math.max(targetWords.length, 1)) * 0.2;
  const exactMatch = normalizedTarget && normalizedTarget === normalizedTranscript;
  const score = exactMatch
    ? 100
    : Math.max(0, Math.round((averageSimilarity - Math.min(lengthPenalty, 0.2)) * 100));
  const weakWords = detailedWords.filter(item => item.status === 'needs_improvement').map(item => item.word);
  const isCorrect = score >= 85 && weakWords.length === 0;

  let feedback = 'Boa tentativa. Continue praticando a frase completa.';
  if (score >= 95) feedback = 'Excelente. A frase ficou muito clara e natural.';
  else if (score >= 85) feedback = 'Muito bom. Ajuste pequenos detalhes para soar ainda mais natural.';
  else if (score >= 70) feedback = 'Bom caminho. Algumas palavras ainda precisam de mais clareza.';
  else if (score >= 50) feedback = 'A base esta certa, mas a pronuncia ainda precisa de repeticao guiada.';
  else feedback = 'A frase saiu distante do alvo. Repita mais devagar, palavra por palavra.';

  if (weakWords.length) {
    feedback = `${feedback} Foque em: ${weakWords.slice(0, 3).join(', ')}.`;
  }

  return {
    transcript,
    isCorrect,
    score,
    feedback,
    words: detailedWords.map(({ word, status, phoneticIssue }) => ({
      word,
      status,
      ...(phoneticIssue ? { phoneticIssue } : {}),
    })),
  };
};

const handleEveConversation = async (openai: OpenAI | null, payload: AnyObject = {}) => {
  const requestId = normalizeText(payload.requestId) || buildRequestId('eve');
  const debug = createDebug(requestId);
  const history = normalizeHistory(payload.history).slice(-8);

  logEve(requestId, 'conversation:start', {
    hasAudio: Boolean(normalizeText(payload.audioBase64)),
    historyItems: history.length,
  });

  const transcription = await resolveTranscript(openai, payload.audioBase64, payload.mimeType, debug);

  if (!transcription) {
    if (debug.errors.length) {
      debug.warnings.push(...debug.errors.map(error => `conversation_nonfatal:${error}`));
      debug.errors = [];
    }
    logEve(requestId, 'conversation:no_transcript', {
      transcriptSource: debug.transcriptSource,
      warnings: debug.warnings.length,
      errors: debug.errors.length,
      warningPreview: debug.warnings[0] || null,
      errorPreview: debug.errors[0] || null,
    });
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

  if (debug.errors.length) {
    debug.warnings.push(...debug.errors.map(error => `conversation_nonfatal:${error}`));
    debug.errors = [];
  }

  logEve(requestId, 'conversation:done', {
    apiVersion,
    buildId,
    transcriptSource: debug.transcriptSource,
    transcriptionModel: debug.transcriptionModel,
    chatModel: debug.chatModel,
    warnings: debug.warnings.length,
    errors: debug.errors.length,
    warningPreview: debug.warnings[0] || null,
    errorPreview: debug.errors[0] || null,
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
    error: undefined,
  };
};

const handleEveSpeech = async (openai: OpenAI | null, payload: AnyObject = {}) => {
  const requestId = normalizeText(payload.requestId) || buildRequestId('eve');
  const debug = createDebug(requestId);

  const text = normalizeText(payload.text);
  logEve(requestId, 'speech:start', { textLength: text.length });

  const speech = await synthesizeSpeech(openai, text, debug);

  // Keep TTS flow non-fatal: the screen can continue even if server audio fails.
  if (!speech.base64 && debug.errors.length) {
    debug.warnings.push(...debug.errors.map(error => `speech_nonfatal:${error}`));
    debug.errors = [];
  }

  logEve(requestId, 'speech:done', {
    apiVersion,
    buildId,
    ttsModel: debug.ttsModel,
    hasAudio: Boolean(speech.base64),
    warnings: debug.warnings.length,
    errors: debug.errors.length,
    warningPreview: debug.warnings[0] || null,
    errorPreview: debug.errors[0] || null,
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
  const hasAudio = Boolean(normalizeText(payload.audioBase64));

  logEve(requestId, 'pronunciation:start', {
    hasAudio,
    targetPhraseLength: targetPhrase.length,
  });

  const transcript = await resolveTranscript(openai, payload.audioBase64, payload.mimeType, debug);

  if (!transcript) {
    logEve(requestId, 'pronunciation:no_transcript', {
      debug: {
        requestId,
        transcriptSource: debug.transcriptSource,
        transcriptionModel: debug.transcriptionModel,
        chatModel: debug.chatModel,
        ttsModel: debug.ttsModel,
        warnings: debug.warnings,
        errors: debug.errors,
      },
    });
    return {
      transcript: '',
      isCorrect: false,
      score: 0,
      feedback: 'Nao consegui ouvir sua voz com clareza. Tente novamente.',
      words: [],
      debug,
    };
  }

  const fallback = buildLocalPronunciationFallback(targetPhrase, transcript);

  const result = await chatJsonWithFallback(
    openai,
    'You are a strict English pronunciation coach. Return only JSON with keys: transcript,isCorrect,score,feedback,words. words must be array of {word,status,phoneticIssue?}. status is correct or needs_improvement.',
    `Target phrase: "${targetPhrase}"\nSpoken transcript: "${transcript}"\nEvaluate pronunciation with objective feedback.`,
    fallback,
    debug
  );

  const response = {
    transcript: normalizeText(result.transcript) || transcript,
    isCorrect: Boolean(result.isCorrect),
    score: typeof result.score === 'number' ? Math.max(0, Math.min(100, result.score)) : 0,
    feedback: normalizeText(result.feedback) || fallback.feedback,
    words: Array.isArray(result.words) ? result.words : [],
    debug,
  };

  logEve(requestId, 'pronunciation:done', {
    transcriptSource: debug.transcriptSource,
    transcriptionModel: debug.transcriptionModel,
    chatModel: debug.chatModel,
    evaluationMode: debug.chatModel ? 'ai' : 'local',
    score: response.score,
    isCorrect: response.isCorrect,
    words: response.words.length,
    warnings: debug.warnings.length,
    errors: debug.errors.length,
    warningPreview: debug.warnings[0] || null,
  });

  return response;
};

const handleGeneratePhrases = async (openai: OpenAI | null, payload: AnyObject = {}) => {
  if (!openai) throw new Error('OPENAI_API_KEY is not set');

  const requestId = normalizeText(payload.requestId) || buildRequestId('phr');
  const debug = createDebug(requestId);

  const topic = normalizeText(payload.topic) || 'General';
  const difficulty = normalizeText(payload.difficulty) || 'medium';
  const count = Number(payload.count) > 0 ? Number(payload.count) : 5;

  logEve(requestId, 'phrases:start', {
    topic,
    difficulty,
    count,
  });

  const cacheKey = buildGenerationCacheKey('phrases', { topic, difficulty, count });
  const cached = readCache(generationCache, cacheKey);
  if (cached) {
    logEve(requestId, 'phrases:done', {
      topic,
      difficulty,
      returned: cached.length,
      chatModel: null,
      warnings: debug.warnings.length,
      errors: debug.errors.length,
      cacheHit: true,
    });
    return cached as AnyObject[];
  }

  const result = await chatJsonWithFallback<{ items?: AnyObject[] }>(
    openai,
    'Return only JSON object with key "items". items must be an array. Each item must include english, portuguese, difficulty (easy|medium|hard), category.',
    `Generate ${count} English learning phrases about "${topic}" with "${difficulty}" difficulty.`,
    { items: [] },
    debug
  );

  const phrases = (Array.isArray(result?.items) ? result.items : []).map((item: AnyObject, index: number) => ({
    id: `gen_${Date.now()}_${index}`,
    english: normalizeText(item.english),
    portuguese: normalizeText(item.portuguese),
    difficulty: ['easy', 'medium', 'hard'].includes(item.difficulty) ? item.difficulty : 'medium',
    category: normalizeText(item.category) || topic,
  })).filter(item => item.english && item.portuguese);

  if (phrases.length) {
    writeCache(generationCache, cacheKey, phrases, generationCacheTtlMs, generationCacheMaxEntries);
  }

  logEve(requestId, 'phrases:done', {
    topic,
    difficulty,
    returned: phrases.length,
    chatModel: debug.chatModel,
    warnings: debug.warnings.length,
    errors: debug.errors.length,
    cacheHit: false,
  });

  return phrases;
};

const handleGenerateWords = async (openai: OpenAI | null, payload: AnyObject = {}) => {
  if (!openai) throw new Error('OPENAI_API_KEY is not set');

  const requestId = normalizeText(payload.requestId) || buildRequestId('word');
  const debug = createDebug(requestId);

  const category = normalizeText(payload.category) || 'General';
  const count = Number(payload.count) > 0 ? Number(payload.count) : 10;

  logEve(requestId, 'words:start', {
    category,
    count,
  });

  const cacheKey = buildGenerationCacheKey('words', { category, count });
  const cached = readCache(generationCache, cacheKey);
  if (cached) {
    logEve(requestId, 'words:done', {
      category,
      returned: cached.length,
      chatModel: null,
      warnings: debug.warnings.length,
      errors: debug.errors.length,
      cacheHit: true,
    });
    return cached as AnyObject[];
  }

  const result = await chatJsonWithFallback<{ items?: AnyObject[] }>(
    openai,
    'Return only JSON object with key "items". items must be an array. Each item must include english, portuguese, difficulty (easy|medium|hard), category.',
    `Generate ${count} common English words related to "${category}".`,
    { items: [] },
    debug
  );

  const words = (Array.isArray(result?.items) ? result.items : []).map((item: AnyObject, index: number) => ({
    id: `word_${Date.now()}_${index}`,
    english: normalizeText(item.english),
    portuguese: normalizeText(item.portuguese),
    difficulty: ['easy', 'medium', 'hard'].includes(item.difficulty) ? item.difficulty : 'medium',
    category: normalizeText(item.category) || category,
  })).filter(item => item.english && item.portuguese);

  if (words.length) {
    writeCache(generationCache, cacheKey, words, generationCacheTtlMs, generationCacheMaxEntries);
  }

  logEve(requestId, 'words:done', {
    category,
    returned: words.length,
    chatModel: debug.chatModel,
    warnings: debug.warnings.length,
    errors: debug.errors.length,
    cacheHit: false,
  });

  return words;
};

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      apiVersion,
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

    console.log(`[api/ai][${apiVersion}] Incoming request`, {
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
