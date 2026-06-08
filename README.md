# Yiseen

极简现代心理能量美学测算网站。前端使用 React/Vite，登录与数据使用 Firebase Auth/Firestore，测算 API 使用 DeepSeek/OpenAI-compatible Chat Completions。

## Local Run

1. Install dependencies:
   `npm install && npm install --prefix functions`
2. Create `.env.local` from `.env.example`.
3. Fill the server-side key:
   `OPENAI_API_KEY=your_deepseek_or_openai_compatible_key`
4. Run locally:
   `npm run dev`

## Firebase Production

The production Firebase project is configured in `.firebaserc` as `versatile-radius-vlkqp`.

Before the first deploy on a new machine:

1. Log in:
   `npx firebase-tools login`
2. Store the AI key from `.env.local` as a Firebase Functions secret:
   `npm run deploy:secret`
3. Deploy frontend, API, and Firestore rules:
   `npm run deploy`

Production API is deployed as Firebase Functions (`api`) and Firebase Hosting rewrites `/api/**` to that function.
