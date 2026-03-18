<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# FluentFlow

Aplicativo de pratica de ingles com IA.

## Rodar localmente

**Pre-requisitos:** Node.js 18+

1. Instale dependencias:
   `npm install`
2. Crie `.env.local` com:
   - `OPENAI_API_KEY=...`
   - `OPENAI_CHAT_MODELS=gpt-4.1-mini,gpt-4.1-nano` (opcional)
   - `OPENAI_CHAT_MODEL=gpt-4.1-mini` (opcional, prioridade mais alta)
   - `OPENAI_STT_MODELS=gpt-4o-mini-transcribe,whisper-1` (opcional)
   - `OPENAI_TTS_MODELS=gpt-4o-mini-tts,tts-1` (opcional)
   - `OPENAI_TTS_VOICE=alloy` (opcional)
   - `DISABLE_SERVER_TTS=1` (opcional, recomendado para modo sem custo de voz)
   - `DISABLE_SERVER_TRANSCRIPTION=1` (opcional, se nao tiver acesso a STT)
3. Rode:
   `npm run dev`

## Deploy na Vercel

Este projeto ja esta preparado para Vercel com frontend Vite + funcao serverless em `/api/ai`.

1. Conecte o repositorio na Vercel (se ja conectou, apenas redeploy).
2. Em **Project Settings -> Environment Variables**, configure:
   - `OPENAI_API_KEY` (Preview e Production)
   - `OPENAI_CHAT_MODELS` (opcional, lista de fallback separada por virgula)
   - `OPENAI_CHAT_MODEL` (opcional, modelo principal)
   - `OPENAI_STT_MODELS` (opcional, fallback de transcricao)
   - `OPENAI_TTS_MODELS` (opcional, fallback de voz)
   - `OPENAI_TTS_VOICE` (opcional)
   - `DISABLE_SERVER_TTS` (`1`/`true` para desativar TTS no servidor)
   - `DISABLE_SERVER_TRANSCRIPTION` (`1`/`true` para desativar STT no servidor)
3. Deploy.

### Importante de seguranca

A chave da OpenAI fica apenas no backend (Vercel Function), nao no bundle do navegador.
