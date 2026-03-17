import OpenAI from 'openai';
import { toFile } from 'openai/uploads';

const chatModel = 'gpt-4o-mini';
const transcriptionModel = 'gpt-4o-mini-transcribe';
const ttsModel = 'gpt-4o-mini-tts';

const decodeAudio = (audioBase64: string): Buffer => Buffer.from(audioBase64, 'base64');

const safeJsonParse = <T>(text: string, fallback: T): T => {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
};

const transcribeAudio = async (openai: OpenAI, audioBase64: string, mimeType: string): Promise<string> => {
  const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp4') ? 'm4a' : 'wav';
  const audioFile = await toFile(decodeAudio(audioBase64), `audio.${ext}`);
  const tx = await openai.audio.transcriptions.create({
    file: audioFile,
    model: transcriptionModel,
    language: 'en'
  });
  return (tx.text || '').trim();
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

export default async function handler(req: any, res: any) {
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
      const transcription = await transcribeAudio(openai, audioBase64, mimeType);

      if (!transcription) {
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
      const transcript = await transcribeAudio(openai, audioBase64, mimeType);

      if (!transcript) {
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
      const speech = await openai.audio.speech.create({
        model: ttsModel,
        voice: 'alloy',
        input: text,
        response_format: 'pcm'
      });

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
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
}
