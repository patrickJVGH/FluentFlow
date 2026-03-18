import OpenAI from 'openai';
import { toFile } from 'openai/uploads';

const envFlag = (value?: string): boolean => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

const splitModels = (value?: string): string[] =>
  (value || '')
    .split(',')
    .map(model => model.trim())
    .filter(Boolean);

const chatModel = process.env.OPENAI_CHAT_MODEL?.trim() || 'gpt-4o-mini';
const chatFallbackModels = (() => {
  const fromEnv = splitModels(process.env.OPENAI_CHAT_FALLBACK_MODELS);
  if (fromEnv.length > 0) return fromEnv;
  return ['gpt-4.1-mini', 'gpt-4.1-nano'];
})();
const transcriptionModel = 'gpt-4o-mini-transcribe';
const transcriptionFallbackModels = ['whisper-1'];
const transcriptionLanguage = process.env.OPENAI_TRANSCRIPTION_LANGUAGE?.trim() || '';
const ttsModel = process.env.OPENAI_TTS_MODEL?.trim() || 'gpt-4o-mini-tts';
const ttsFallbackModels = ['tts-1', 'tts-1-hd'];
const disableServerTranscription = envFlag(process.env.DISABLE_SERVER_TRANSCRIPTION);
const disableServerTts = envFlag(process.env.DISABLE_SERVER_TTS);
let chatUnavailable = false;
let transcriptionUnavailable = false;
let ttsUnavailable = false;

const decodeAudio = (audioBase64: string): Buffer => Buffer.from(audioBase64, 'base64');
const normalizeTranscript = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const safeJsonParse = <T>(text: string, fallback: T): T => {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
};

type TranscriptionResult = {
  text: string;
  unavailable: boolean;
};

const canFallbackChatModel = (error: any): boolean => {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.status === 403 ||
    message.includes('does not have access to model') ||
    message.includes('model_not_found')
  );
};

const isChatAccessError = (error: any): boolean => {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.status === 403 &&
    (message.includes('does not have access to model') || message.includes('model_not_found'))
  );
};

const canFallbackTranscriptionModel = (error: any): boolean => {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.status === 403 ||
    message.includes('does not have access to model') ||
    message.includes('model_not_found')
  );
};

const isTranscriptionAccessError = (error: any): boolean => {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.status === 403 &&
    (message.includes('does not have access to model') || message.includes('model_not_found'))
  );
};

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

const transcribeAudio = async (openai: OpenAI | null, audioBase64: string, mimeTypeRaw: string): Promise<TranscriptionResult> => {
  if (disableServerTranscription || transcriptionUnavailable) {
    return { text: '', unavailable: true };
  }
  if (!audioBase64 || typeof audioBase64 !== 'string') {
    return { text: '', unavailable: false };
  }
  if (!openai) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  const mimeType = typeof mimeTypeRaw === 'string' ? mimeTypeRaw : '';
  const ext = extensionFromMimeType(mimeType);
  const audioBuffer = decodeAudio(audioBase64);
  const modelCandidates = [transcriptionModel, ...transcriptionFallbackModels.filter(model => model !== transcriptionModel)];

  let lastError: any = null;
  for (const model of modelCandidates) {
    try {
      const audioFile = await toFile(audioBuffer, `audio.${ext}`);
      const tx = await openai.audio.transcriptions.create({
        file: audioFile,
        model,
        ...(transcriptionLanguage ? { language: transcriptionLanguage } : {})
      });
      return { text: (tx.text || '').trim(), unavailable: false };
    } catch (error: any) {
      lastError = error;
      if (!canFallbackTranscriptionModel(error) || model === modelCandidates[modelCandidates.length - 1]) {
        if (isTranscriptionAccessError(error)) {
          transcriptionUnavailable = true;
          console.warn('[api/ai] Disabling transcription for this runtime due to model access restrictions', {
            message: error?.message
          });
          return { text: '', unavailable: true };
        }
        throw error;
      }
      console.warn('[api/ai] Transcription model unavailable, trying fallback', {
        model,
        message: error?.message
      });
    }
  }

  if (isTranscriptionAccessError(lastError)) {
    transcriptionUnavailable = true;
    return { text: '', unavailable: true };
  }
  throw lastError;
};

const jsonFromChat = async <T>(openai: OpenAI, systemPrompt: string, userPrompt: string, fallback: T): Promise<T> => {
  if (chatUnavailable) {
    return fallback;
  }

  const modelCandidates = [chatModel, ...chatFallbackModels.filter(model => model !== chatModel)];
  let lastError: any = null;

  for (const model of modelCandidates) {
    try {
      const completion = await openai.chat.completions.create({
        model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' }
      });

      const content = completion.choices[0]?.message?.content || '';
      return safeJsonParse<T>(content, fallback);
    } catch (error: any) {
      lastError = error;
      if (!canFallbackChatModel(error) || model === modelCandidates[modelCandidates.length - 1]) {
        if (isChatAccessError(error)) {
          chatUnavailable = true;
          console.warn('[api/ai] Disabling chat completions for this runtime due to model access restrictions', {
            attemptedModels: modelCandidates,
            message: error?.message
          });
          return fallback;
        }
        throw error;
      }
      console.warn('[api/ai] Chat model unavailable, trying fallback', {
        model,
        message: error?.message
      });
    }
  }

  if (isChatAccessError(lastError)) {
    chatUnavailable = true;
    return fallback;
  }
  throw lastError;
};

const canFallbackTtsModel = (error: any): boolean => {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.status === 403 ||
    message.includes('does not have access to model') ||
    message.includes('model_not_found')
  );
};

const isTtsAccessError = (error: any): boolean => {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.status === 403 &&
    (message.includes('does not have access to model') || message.includes('model_not_found'))
  );
};

const createSpeechWithFallback = async (openai: OpenAI, text: string) => {
  const modelCandidates = [ttsModel, ...ttsFallbackModels.filter(model => model !== ttsModel)];

  let lastError: any = null;
  for (const model of modelCandidates) {
    try {
      return await openai.audio.speech.create({
        model,
        voice: 'alloy',
        input: text,
        response_format: 'pcm'
      });
    } catch (error: any) {
      lastError = error;
      if (!canFallbackTtsModel(error) || model === modelCandidates[modelCandidates.length - 1]) {
        throw error;
      }
      console.warn('[api/ai] TTS model unavailable, trying fallback', {
        model,
        message: error?.message
      });
    }
  }

  throw lastError;
};

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY?.trim()),
      chatModel,
      chatFallbackModels,
      chatUnavailable,
      serverTranscriptionDisabled: disableServerTranscription,
      serverTtsDisabled: disableServerTts
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, payload } = req.body || {};
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    const requiresOpenAI =
      action === 'conversation' ||
      action === 'pronunciation' ||
      action === 'generatePhrases' ||
      action === 'generateWords' ||
      (action === 'speech' && !disableServerTts && !ttsUnavailable);

    if (!apiKey && requiresOpenAI) {
      console.error('[api/ai] Missing OPENAI_API_KEY for action', { action });
      return res.status(500).json({ error: 'OPENAI_API_KEY is not set' });
    }

    const openai: OpenAI | null = apiKey ? new OpenAI({ apiKey }) : null;

    if (action === 'conversation') {
      const { audioBase64, mimeType, history, transcription: clientTranscriptionRaw } = payload || {};
      const clientTranscription = normalizeTranscript(clientTranscriptionRaw);
      const transcriptionResult = clientTranscription
        ? { text: clientTranscription, unavailable: false }
        : await transcribeAudio(openai, audioBase64, mimeType);
      const transcription = transcriptionResult.text;

      if (!transcription) {
        if (transcriptionResult.unavailable) {
          return res.status(200).json({
            isSilent: false,
            transcription: '',
            response: "Voice recognition is unavailable right now. You can continue with text-based practice.",
            translation: 'Reconhecimento de voz indisponível no momento. Você pode continuar com prática em texto.',
            feedback: 'STT indisponível neste projeto OpenAI.'
          });
        }
        return res.status(200).json({
          isSilent: true,
          transcription: '',
          response: "I couldn't hear you. Could you repeat that?",
          translation: 'Não consegui te ouvir. Pode repetir?'
        });
      }

      const historyText = (history || []).slice(-5).map((h: any) => `${h.role === 'user' ? 'User' : 'Tutor'}: ${h.text}`).join('\n');
      const out = await jsonFromChat(
        openai!,
        'You are EVE, an English tutor. Return valid JSON only with keys: response, responsePortuguese, feedback, improvement.',
        `Conversation history:\n${historyText}\n\nUser said: "${transcription}"\nRespond naturally in English and provide a PT-BR translation and brief feedback.`,
        {
          response: "I couldn't hear you clearly.",
          responsePortuguese: 'Não consegui te ouvir claramente.',
          feedback: 'Tente falar um pouco mais perto do microfone.',
          improvement: ''
        }
      );

      return res.status(200).json({
        isSilent: false,
        transcription,
        response: out.response || "I couldn't hear you clearly.",
        translation: out.responsePortuguese || 'Não consegui te ouvir claramente.',
        feedback: out.feedback,
        improvement: out.improvement
      });
    }

    if (action === 'pronunciation') {
      const { audioBase64, mimeType, targetPhrase, transcription: clientTranscriptionRaw } = payload || {};
      const clientTranscription = normalizeTranscript(clientTranscriptionRaw);
      const transcriptionResult = clientTranscription
        ? { text: clientTranscription, unavailable: false }
        : await transcribeAudio(openai, audioBase64, mimeType);
      const transcript = transcriptionResult.text;

      if (!transcript) {
        if (transcriptionResult.unavailable) {
          return res.status(200).json({
            transcript: '',
            isCorrect: false,
            score: 0,
            feedback: 'Reconhecimento de voz indisponível no servidor (sem acesso a modelo de transcrição).',
            words: []
          });
        }
        return res.status(200).json({
          transcript: '',
          isCorrect: false,
          score: 0,
          feedback: 'Não ouvi sua voz com clareza. Tente novamente!',
          words: []
        });
      }

      const result = await jsonFromChat(
        openai!,
        'You are a strict English pronunciation coach. Return JSON only with keys: transcript,isCorrect,score,feedback,words.',
        `Target phrase: "${targetPhrase}"\nUser transcript: "${transcript}"\nEvaluate if pronunciation is correct, assign score 0-100, and return words array with {word,status,phoneticIssue?}. status must be correct or needs_improvement.`,
        {
          transcript,
          isCorrect: false,
          score: 0,
          feedback: 'Erro ao avaliar pronúncia.',
          words: []
        }
      );

      return res.status(200).json({
        ...result,
        transcript: result.transcript || transcript,
        score: typeof result.score === 'number' ? Math.max(0, Math.min(100, result.score)) : 0,
        isCorrect: Boolean(result.isCorrect)
      });
    }

    if (action === 'speech') {
      const { text } = payload || {};
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Missing text for speech action' });
      }
      if (disableServerTts) {
        return res.status(200).json({ base64: null, ttsUnavailable: true });
      }
      if (ttsUnavailable) {
        return res.status(200).json({ base64: null, ttsUnavailable: true });
      }

      let speech: any;
      try {
        speech = await createSpeechWithFallback(openai!, text);
      } catch (error: any) {
        if (isTtsAccessError(error)) {
          ttsUnavailable = true;
          console.warn('[api/ai] Disabling TTS for this runtime due to model access restrictions', {
            message: error?.message
          });
          return res.status(200).json({ base64: null, ttsUnavailable: true });
        }
        throw error;
      }

      const audioBuffer = Buffer.from(await speech.arrayBuffer());
      return res.status(200).json({ base64: audioBuffer.toString('base64') });
    }

    if (action === 'generatePhrases') {
      const { topic, difficulty, count = 5 } = payload || {};
      const result = await jsonFromChat<any[]>(
        openai!,
        'Return JSON array only. Each item must have english, portuguese, difficulty (easy|medium|hard), category.',
        `Generate ${count} English learning phrases about "${topic}" with ${difficulty} difficulty.`,
        []
      );

      return res.status(200).json(
        (Array.isArray(result) ? result : []).map((p: any, i: number) => ({
          id: `gen_${Date.now()}_${i}`,
          english: p.english || '',
          portuguese: p.portuguese || '',
          difficulty: ['easy', 'medium', 'hard'].includes(p.difficulty) ? p.difficulty : 'medium',
          category: p.category || topic
        }))
      );
    }

    if (action === 'generateWords') {
      const { category, count = 10 } = payload || {};
      const result = await jsonFromChat<any[]>(
        openai!,
        'Return JSON array only. Each item must have english, portuguese, difficulty (easy|medium|hard), category.',
        `Generate ${count} common English words related to ${category}.`,
        []
      );

      return res.status(200).json(
        (Array.isArray(result) ? result : []).map((p: any, i: number) => ({
          id: `word_${Date.now()}_${i}`,
          english: p.english || '',
          portuguese: p.portuguese || '',
          difficulty: ['easy', 'medium', 'hard'].includes(p.difficulty) ? p.difficulty : 'medium',
          category: p.category || category
        }))
      );
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error: any) {
    const message = error?.message || 'Internal server error';
    console.error('[api/ai] Request failed', {
      action: req?.body?.action,
      message,
      stack: error?.stack
    });
    return res.status(500).json({ error: message });
  }
}
