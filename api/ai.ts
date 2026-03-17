import OpenAI from 'openai';
import { toFile } from 'openai/uploads';

const chatModel = 'gpt-4o-mini';
const transcriptionModel = 'gpt-4o-mini-transcribe';
const transcriptionFallbackModels = ['whisper-1'];
const ttsModel = process.env.OPENAI_TTS_MODEL?.trim() || 'gpt-4o-mini-tts';
const ttsFallbackModels = ['tts-1', 'tts-1-hd'];
const disableServerTranscription = process.env.DISABLE_SERVER_TRANSCRIPTION === '1';
const disableServerTts = process.env.DISABLE_SERVER_TTS === '1';
let transcriptionUnavailable = false;
let ttsUnavailable = false;

const decodeAudio = (audioBase64: string): Buffer => Buffer.from(audioBase64, 'base64');

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

const transcribeAudio = async (openai: OpenAI, audioBase64: string, mimeType: string): Promise<TranscriptionResult> => {
  if (disableServerTranscription || transcriptionUnavailable) {
    return { text: '', unavailable: true };
  }
  if (!audioBase64 || !mimeType || typeof audioBase64 !== 'string' || typeof mimeType !== 'string') {
    return { text: '', unavailable: false };
  }

  const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp4') ? 'm4a' : 'wav';
  const audioFile = await toFile(decodeAudio(audioBase64), `audio.${ext}`);
  const modelCandidates = [transcriptionModel, ...transcriptionFallbackModels.filter(model => model !== transcriptionModel)];

  let lastError: any = null;
  for (const model of modelCandidates) {
    try {
      const tx = await openai.audio.transcriptions.create({
        file: audioFile,
        model,
        language: 'en'
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
  const completion = await openai.chat.completions.create({
    model: chatModel,
    temperature: 0.2,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    response_format: { type: 'json_object' }
  });

  const content = completion.choices[0]?.message?.content || '';
  return safeJsonParse<T>(content, fallback);
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
      serverTranscriptionDisabled: disableServerTranscription,
      serverTtsDisabled: disableServerTts
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY is not set' });
  }
  const openai = new OpenAI({ apiKey });

  try {
    const { action, payload } = req.body || {};

    if (action === 'conversation') {
      const { audioBase64, mimeType, history } = payload || {};
      const transcriptionResult = await transcribeAudio(openai, audioBase64, mimeType);
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
        openai,
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
      const { audioBase64, mimeType, targetPhrase } = payload || {};
      const transcriptionResult = await transcribeAudio(openai, audioBase64, mimeType);
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
        openai,
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
        speech = await createSpeechWithFallback(openai, text);
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
        openai,
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
        openai,
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
