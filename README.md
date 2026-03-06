# ✦ Scribe

An AI-powered choose-your-own-adventure story engine. Players configure their genre, tone, scope, and theme — then Claude generates a completely unique, branching narrative shaped by every choice they make.

## Features

- Fully AI-generated stories, unique every playthrough
- Rich literary prose with a typewriter reveal effect
- 10 genres, 8 tones, 5 story scopes
- Branching narrative with 3 choices per chapter
- Natural story endings after ~5–8 chapters
- Full story history shown as you progress
- Secure API proxy (your key never reaches the browser)

---

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Set your Anthropic API key

Create a `.env.local` file in the project root:

```
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Run locally

```bash
npm run dev
```

Visit `http://localhost:5173`

---

## Deploy to Vercel

### Option A — Vercel CLI

```bash
npm install -g vercel
vercel
```

Follow the prompts. When asked about settings, the defaults work fine.

### Option B — Vercel Dashboard

1. Push this project to a GitHub repository
2. Go to [vercel.com](https://vercel.com) → **Add New Project**
3. Import your GitHub repo
4. Vercel will auto-detect it as a Vite project

### Add your API key in Vercel

In your Vercel project dashboard:

**Settings → Environment Variables → Add**

| Name | Value |
|------|-------|
| `ANTHROPIC_API_KEY` | `sk-ant-your-key-here` |

Redeploy after adding the variable.

---

## Project Structure

```
scribe/
├── api/
│   └── claude.js          # Vercel Edge Function — secure API proxy
├── src/
│   ├── main.jsx            # React entry point
│   ├── App.jsx             # Main application
│   └── App.css             # All styles
├── public/
│   └── favicon.svg
├── index.html
├── vite.config.js
└── package.json
```

---

## Getting an Anthropic API Key

1. Sign up at [console.anthropic.com](https://console.anthropic.com)
2. Go to **API Keys** → **Create Key**
3. Copy the key and add it to your environment variables
