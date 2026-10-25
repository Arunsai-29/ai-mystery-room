# AI Mystery Room

Create and investigate fictional cases generated from a short scenario. The app uses a guest session, keeps each case's solution on the server, and reveals it only after the player makes an accusation.

## Requirements

- Node.js 20 or later
- MongoDB (local or Atlas)
- A Google Gemini API key for AI generation (without one, the API creates a playable sample case)

## Setup

1. Copy `.env.example` to `.env` and set `MONGODB_URI`, `GEMINI_API_KEY`, and `CLIENT_ORIGIN` as needed.
2. Install dependencies with `npm install`.
3. Start both applications with `npm run dev`.
4. Open `http://localhost:5173`.

The server listens on port 5000 by default. The client uses `VITE_API_BASE_URL` to reach `/api/v1`. Set `GEMINI_API_KEY` only in the server environment. Image generation is disabled by default; cases use descriptive photo and CCTV fallbacks without making image API calls. Set `ENABLE_IMAGE_GENERATION=true` in the server environment to enable Gemini image generation when your project has image quota.

## Scripts

- `npm run dev` starts the client and server.
- `npm run build` builds the client.
- `npm start` starts the server.

Case generation jobs are persisted in MongoDB. A case can be retried from its failure screen. See [docs/DECISIONS.md](docs/DECISIONS.md) for implementation decisions and current boundaries.

## Deploy on Vercel and Render

The frontend deploys to Vercel and the API deploys to Render. `vercel.json` builds the Vite client, proxies `/api/v1` and `/uploads` to the Render API, and routes browser paths back to the React app. `render.yaml` defines the API service.

1. Import this GitHub repository into Vercel, leaving the project root at the repository root. Deploy once to get the production Vercel URL.
2. Create a Render Blueprint from this repository. Set `MONGODB_URI`, `GEMINI_API_KEY`, and `CLIENT_ORIGIN` in Render; `CLIENT_ORIGIN` is the Vercel production origin (for example, `https://your-app.vercel.app`). Keep credentials in the host dashboard, not in Git.
3. Render should assign `https://ai-mystery-room-api.onrender.com`. If it assigns a different hostname, update both Render destinations in `vercel.json` and push the change to GitHub so Vercel redeploys.
4. Allow the Render service to connect to your hosted MongoDB cluster. Image generation remains disabled.

Render's free web services sleep after 15 minutes without traffic and may take about a minute to wake up. Their local filesystem is ephemeral, so this setup is intended for a demo; MongoDB holds persistent case data.
