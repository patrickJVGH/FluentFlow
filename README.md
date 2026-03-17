<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# FluentFlow

Aplicativo de prática de inglês com IA.

## Rodar localmente

**Pré-requisitos:** Node.js 18+

1. Instale dependências:
   `npm install`
2. Crie `.env.local` com:
   `OPENAI_API_KEY=...`
3. Rode:
   `npm run dev`

## Deploy na Vercel

Este projeto já está preparado para Vercel com frontend Vite + função serverless em `/api/ai`.

1. Conecte o repositório na Vercel (se já conectou, apenas redeploy).
2. Em **Project Settings → Environment Variables**, configure:
   - `OPENAI_API_KEY` (Preview e Production)
3. Deploy.

### Importante de segurança

A chave da OpenAI agora fica apenas no backend (Vercel Function), não no bundle do navegador.
