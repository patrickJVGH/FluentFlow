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
   - `OPENAI_CHAT_MODEL=...` (opcional, ex.: `gpt-4.1-mini`)
   - `OPENAI_CHAT_FALLBACK_MODELS=gpt-4.1-mini,gpt-4.1-nano` (opcional)
   - `DISABLE_SERVER_TTS=1` (opcional, recomendado para modo sem custo de voz)
   - `DISABLE_SERVER_TRANSCRIPTION=1` (opcional, se nao tiver acesso a STT)
3. Rode:
   `npm run dev`

## Deploy na Vercel

Este projeto ja esta preparado para Vercel com frontend Vite + funcao serverless em `/api/ai`.

1. Conecte o repositorio na Vercel (se ja conectou, apenas redeploy).
2. Em **Project Settings -> Environment Variables**, configure:
   - `OPENAI_API_KEY` (Preview e Production)
   - `OPENAI_CHAT_MODEL` (opcional, modelo de chat permitido no projeto)
   - `OPENAI_CHAT_FALLBACK_MODELS` (opcional, lista separada por virgula para fallback)
   - `DISABLE_SERVER_TTS` (`1`/`true` para desativar TTS no servidor)
   - `DISABLE_SERVER_TRANSCRIPTION` (`1`/`true` para desativar STT no servidor)
   - `OPENAI_TTS_MODEL` (opcional, ex.: `tts-1`)
3. Deploy.

### Importante de seguranca

A chave da OpenAI fica apenas no backend (Vercel Function), nao no bundle do navegador.
