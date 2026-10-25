AI Mystery Room – Product & Technical Specification
Version: 1.0  |  Status: Source of truth for implementation  |  Audience: Codex (AI coding agent) and human reviewers
Rule for the implementing agent: This document is the single source of truth. If code and spec disagree, the spec wins. If the spec is silent or ambiguous, choose the simplest option consistent with this document, record the decision in docs/DECISIONS.md, and continue. Do not add features not listed here. Build in the order given in Section 17.
1. Project Overview
AI Mystery Room is a web app where a user types a short scenario or story seed (e.g. "A jewelry theft at a wedding reception"). The backend uses Google Gemini to invent a complete fictional investigation: a cast of suspects, a hidden culprit, a timeline, and a set of evidence (WhatsApp chats, images, CCTV footage, and more). The user reviews the evidence like a detective, then accuses one suspect. The app reveals whether they were right and explains the full solution.
All people, places, events and evidence are fictional and AI-generated.
1.1 Goals
• Turn any short scenario into a solvable, engaging mystery in under ~90 seconds.
• Evidence must feel real: chat screens that look like WhatsApp, photos, CCTV-style frames with timestamps.
• The mystery must be fairly solvable: the culprit can be deduced from the evidence alone.
• The culprit identity must never leak to the browser before the user submits an accusation.
1.2 Non-Goals (v1)
• No multiplayer, no real-time collaboration.
• No payments, no social features, no leaderboards.
• No native mobile app (responsive web only).
• No real video generation requirement (see 6.4 for the CCTV approach).
• No user-uploaded evidence.
2. Tech Stack
Layer
Choice
Database
MongoDB (Atlas or local) via Mongoose
Backend
Node.js 20+, Express 4, JavaScript (ESM)
Frontend
React 18 + Vite, React Router v6, Tailwind CSS
State / data fetching
TanStack Query (React Query)
AI
Google Gemini via @google/genai SDK
Validation
Zod (backend request + AI output validation)
Auth
Guest sessions in v1 (see 9); JWT-ready structure
Testing
Vitest (frontend), Jest + Supertest (backend)
Image storage
MongoDB GridFS or local /uploads folder in dev; S3-compatible via env switch is optional
Monorepo layout:
ai-mystery-room/
  client/            # React + Vite
    src/
      pages/         # Home, Generating, CaseRoom, Result, NotFound
      components/    # EvidenceBoard, WhatsAppChat, ImageEvidence, CctvPlayer,
                     # SuspectCard, AccuseModal, NotesPanel, Loader
      api/           # axios client + query hooks
      lib/
  server/
    src/
      config/        # env.js, db.js, gemini.js
      models/        # Case.js, Session.js
      routes/        # cases.routes.js, health.routes.js
      controllers/
      services/      # caseGenerator.js, evidenceGenerator.js, imageGenerator.js,
                     # validator.js, scoring.js
      prompts/       # blueprint.prompt.js, chat.prompt.js, image.prompt.js, ...
      schemas/       # zod schemas
      middleware/    # errorHandler, rateLimit, requestId
      utils/
  docs/DECISIONS.md
  .env.example
  README.md
3. Core User Flow
1. Home page: user enters a scenario (20–600 chars), picks difficulty (Easy / Medium / Hard) and optionally a tone (Realistic, Noir, Cozy, Thriller). Clicks Create Mystery.
2. Generating page: shows staged progress ("Inventing suspects…", "Writing chat logs…", "Developing photos…", "Reviewing CCTV…"). Frontend polls case status every 2 seconds.
3. Case Room: the briefing, suspect profiles and evidence board are shown. User opens evidence, takes notes, and may pin items.
4. Accuse: user selects one suspect, optionally writes a short reasoning (max 500 chars), confirms.
5. Result page: shows correct/incorrect, the true culprit, motive, method, a step-by-step solution explaining which evidence proves guilt, and which evidence was a red herring. Option to Play again or Create a new mystery.
A user gets one accusation per case in v1 (no retries) to keep the verdict meaningful.
4. Functional Requirements
4.1 Case Creation
• FR-1 The system accepts scenario text, difficulty, tone and creates a Case with status queued.
• FR-2 Generation runs asynchronously; the create endpoint returns immediately with caseId.
• FR-3 Status transitions: queued → generating_blueprint → generating_evidence → generating_images → validating → ready or failed.
• FR-4 If any stage fails after retries, status becomes failed with a user-safe errorMessage, and the UI offers Try again.
4.2 Case Content (what every generated case must contain)
• Title, one-paragraph briefing (setting, victim/incident, time window).
• 4 to 6 suspects (Easy: 4, Medium: 5, Hard: 6). Each has name, age, role/relationship, short bio, alibi claim, and a portrait image.
• Exactly 1 culprit.
• 6 to 12 evidence items (Easy: 6, Medium: 9, Hard: 12) with a mix of types (see Section 6). At minimum: 1 chat log, 1 image, 1 CCTV item.
• A hidden solution: culprit id, motive, method, timeline of true events, the list of key evidence ids that prove guilt (min 2), and a list of red herring evidence ids.
4.3 Investigation
• FR-5 Evidence is viewable one item at a time in a detail panel and as cards on a board.
• FR-6 Users can keep private notes (stored in the session and persisted to the server) and pin evidence items.
• FR-7 Users can filter evidence by type and by suspect mentioned.
• FR-8 Each evidence item shows: title, type, source label (e.g. "Group chat – Wedding Planners"), timestamp, and tagged suspects (tags are mentions, not guilt indicators).
4.4 Accusation & Verdict
• FR-9 POST /accuse accepts suspectId and optional reasoning. The server compares with the hidden culprit.
• FR-10 The server returns the verdict and only then the full solution. Before accusation, no endpoint may return solution or any field revealing the culprit.
• FR-11 A score (0–100) is computed (see Section 12).
• FR-12 After accusation the case is locked (status: solved or failed_accusation).
4.5 Hint System (optional, ship after core)
• Up to 2 hints per case; each hint is pre-generated at blueprint time and nudges toward a key evidence item without naming the culprit. Using hints reduces score by 10 each.
5. AI Generation Pipeline (Gemini)
Generation is a multi-stage pipeline in services/caseGenerator.js. Each stage uses structured JSON output (Gemini responseMimeType: "application/json" with a responseSchema), and the result is re-validated with Zod. On validation failure, retry up to 2 times, feeding the validation error back into the prompt.
5.1 Models (configurable via env)
• GEMINI_TEXT_MODEL – default gemini-2.5-flash (blueprint, chats, validation).
• GEMINI_IMAGE_MODEL – default gemini-2.5-flash-image (portraits, photos, CCTV frames).
• Model names must never be hardcoded outside config/gemini.js.
• The API key lives only on the server (GEMINI_API_KEY). It must never reach the client.
5.2 Stage 1 – Blueprint
Input: scenario, difficulty, tone. Output (JSON): title, briefing, setting, suspects[], culprit (suspect id), motive, method, trueTimeline[], evidencePlan[] (each: id, type, title, purpose, isKey boolean, isRedHerring boolean, involvedSuspectIds, timestamp, a content brief), hints[].
Blueprint rules enforced in the prompt AND by the validator:
1. Exactly one culprit; every other suspect has a plausible motive or opportunity but at least one clue that exonerates them.
2. The culprit must be provable by at least 2 independent key evidence items that, combined, point to only them (e.g. chat admission-by-implication + CCTV timing contradicting their alibi).
3. Evidence must never state the culprit outright ("I did it"). Guilt is inferred.
4. Include red herrings proportional to difficulty (Easy 1, Medium 2–3, Hard 3–4).
5. All timestamps must be consistent with trueTimeline.
6. Names, brands, and places are fictional. No real public figures, no real phone numbers, emails, or addresses.
7. Content must be PG-13: no graphic violence, sexual content, hate, or self-harm detail. Crime types are limited to theft, fraud, sabotage, disappearance (non-violent), cheating/forgery, and similar. If the scenario requests disallowed content, the blueprint stage returns a rejected result with a reason and the case is marked failed with a friendly message.
5.3 Stage 2 – Evidence Content
For each item in evidencePlan, generate the final content according to its type (Section 6). Chat logs are generated in a single call per chat thread. Independent items may be generated in parallel with a concurrency limit of 3.
5.4 Stage 3 – Image Generation
• Portraits for each suspect, photo evidence, and CCTV frames are generated with the Gemini image model using prompts built from the blueprint.
• Style constraints in every image prompt: photorealistic, no text overlays except where specified, no recognizable real people, no logos of real brands.
• Images are stored (see 2) and referenced by URL. Generate with concurrency limit 2; retry once on failure.
• Fallback: if an image fails twice, mark that item imageStatus: "fallback" and render a styled placeholder with the item's text description, so the case remains playable.
5.5 Stage 4 – Solvability Validation
A second Gemini call receives the full player-visible case (no solution) and must independently answer: "Who is the culprit and which evidence ids prove it?" The result is compared with the hidden solution:
• If the model's culprit equals the true culprit → ready.
• If not, or if key evidence is not cited → regenerate the offending evidence (once), then re-validate. If still failing → failed and log validationReport.
5.6 Cost & Safety Controls
• Max 1 active generation per session; rate limit of 5 case creations per hour per IP/session.
• Request timeout for each Gemini call: 60s. Total generation budget: 5 minutes.
• Log token usage per case in case.generationMeta.
• Gemini safety settings must stay at default or stricter.
6. Evidence Types
All evidence shares a base shape and has a type-specific payload.
6.1 Base Evidence Shape
{
  "id": "ev_03",
  "type": "chat | image | cctv | note | document",
  "title": "string",
  "sourceLabel": "string",
  "timestamp": "ISO-8601 string (fictional date)",
  "suspectTags": ["sus_01"],
  "payload": { }
}
isKey, isRedHerring, and purpose are server-only fields and must be stripped from all player-facing responses.
6.2 chat – WhatsApp-style messages
Payload:
{
  "chatName": "string",
  "isGroup": true,
  "participants": [{ "name": "string", "suspectId": "sus_01 | null" }],
  "messages": [
    { "sender": "string", "text": "string", "sentAt": "ISO-8601", "status": "read | delivered", "replyTo": null }
  ]
}
• 12–30 messages per thread, realistic voice, slang and typos appropriate to each character, occasional emojis.
• Rendered by the frontend WhatsAppChat component as a phone-style chat UI (green outgoing bubbles, grey incoming, timestamps, date dividers, double ticks). The AI produces data, not images, for chats. Use a neutral, original design inspired by chat apps and do not use WhatsApp logos or branding.
6.3 image – Photos
Payload: { "imageUrl": "string", "caption": "string", "metadata": { "takenAt": "ISO", "location": "string", "device": "string" }, "imageStatus": "ok | fallback" }
• Metadata is shown in an "EXIF-style" info drawer and may contain clues (time, location).
6.4 cctv – Camera recordings
Generating true video is expensive and unreliable, so v1 simulates a recording using a frame sequence:
• Payload: { "cameraName": "string", "location": "string", "frames": [{ "imageUrl": "string", "timestamp": "HH:MM:SS", "description": "string" }] } with 3–6 frames.
• CctvPlayer renders frames as a scrubbable timeline with a burned-in timestamp overlay (drawn by the frontend in CSS, not generated by the AI), a grain/scanline filter, and play/pause that advances frames every 2 seconds.
• Frame prompts must specify: fixed camera angle, grainy low-resolution look, high wide-angle viewpoint, consistent location across frames.
• Optional later (feature flag ENABLE_VEO=false): real video clips via Gemini's video model. Not part of v1 acceptance.
6.5 note / document
• Payload: { "format": "note | receipt | email | log", "body": "markdown string" } (e.g. a receipt, a door-access log, a handwritten-style note, an email). Rendered as styled cards.
7. Data Models (Mongoose)
7.1 Case
{
  _id: ObjectId,
  publicId: String,            // nanoid(10), used in URLs
  sessionId: String,           // owner guest session
  scenario: String,
  difficulty: 'easy' | 'medium' | 'hard',
  tone: String,
  status: 'queued' | 'generating_blueprint' | 'generating_evidence' |
          'generating_images' | 'validating' | 'ready' | 'solved' |
          'failed_accusation' | 'failed',
  progress: { stage: String, percent: Number },
  errorMessage: String,
  title: String,
  briefing: String,
  setting: String,
  suspects: [{
    id: String, name: String, age: Number, role: String,
    bio: String, alibi: String, portraitUrl: String, imageStatus: String
  }],
  evidence: [{
    id: String, type: String, title: String, sourceLabel: String,
    timestamp: Date, suspectTags: [String], payload: Mixed,
    isKey: Boolean, isRedHerring: Boolean, purpose: String   // SERVER-ONLY
  }],
  solution: {                                                  // SERVER-ONLY
    culpritId: String, motive: String, method: String,
    trueTimeline: [{ time: String, event: String }],
    keyEvidenceIds: [String], redHerringIds: [String],
    explanation: String
  },
  hints: [{ text: String }],                                   // revealed one at a time
  accusation: {
    suspectId: String, reasoning: String, correct: Boolean,
    score: Number, hintsUsed: Number, accusedAt: Date
  },
  generationMeta: { models: Mixed, tokens: Mixed, durationMs: Number, retries: Number },
  validationReport: Mixed,
  createdAt, updatedAt
}
Indexes: publicId (unique), sessionId + createdAt.
7.2 Session
{ sessionId: String (uuid), createdAt: Date, lastSeenAt: Date,
  notes: [{ caseId: String, text: String, updatedAt: Date }],
  pins: [{ caseId: String, evidenceIds: [String] }] }
TTL index: sessions and their cases expire after 30 days of inactivity.
8. REST API
Base path: /api/v1. All responses use { "ok": true, "data": ... } or { "ok": false, "error": { "code": "STRING", "message": "string" } }.
Method
Path
Purpose
GET
/health
Liveness check
POST
/session
Create/restore guest session (sets httpOnly cookie mr_sid)
POST
/cases
Create case. Body: { scenario, difficulty, tone? } → 202 { caseId }
GET
/cases/:id/status
{ status, progress, errorMessage? } for polling
GET
/cases/:id
Player-safe case (only when status is ready/solved/failed_accusation)
GET
/cases
List the session's cases (title, status, createdAt)
PUT
/cases/:id/notes
Save notes { text }
PUT
/cases/:id/pins
Save pinned evidence ids
POST
/cases/:id/hint
Reveal next hint (optional feature)
POST
/cases/:id/accuse
Body { suspectId, reasoning? } → verdict + full solution
POST
/cases/:id/retry
Retry generation for a failed case
DELETE
/cases/:id
Delete a case
Request validation rules: scenario 20–600 chars, trimmed, HTML stripped; difficulty in enum; reasoning max 500 chars; suspectId must exist in the case.
Authorization: a session can only read/modify cases where case.sessionId === req.session.id; otherwise return 404 (not 403).
Player-safe serializer (toPlayerCase) must explicitly whitelist fields and omit: solution, evidence[].isKey, evidence[].isRedHerring, evidence[].purpose, validationReport, generationMeta. This is covered by an automated test (Section 14).
9. Authentication & Sessions (v1)
• Guest session: server issues a UUID in an httpOnly, SameSite=Lax, Secure (in prod) cookie.
• No sign-up in v1. Code should isolate session logic in middleware/session.js so JWT/email login can be added later without changing controllers.
10. Frontend Specification
10.1 Routes
Route
Page
/
Home: scenario form + "Your cases" list
/case/:id/generating
Progress screen (polls status; auto-redirects to /case/:id when ready)
/case/:id
Case Room
/case/:id/result
Verdict and solution
*
Not found
10.2 Case Room Layout
• Desktop: three columns – left: briefing + suspects list; centre: evidence viewer; right: notes + pinned items + Accuse button.
• Mobile: tabbed layout (Briefing | Suspects | Evidence | Notes).
• Components: SuspectCard (portrait, name, role, alibi), EvidenceBoard (grid of cards with type icon), WhatsAppChat, ImageEvidence (zoom + metadata drawer), CctvPlayer, DocumentCard, NotesPanel (debounced autosave, 800ms), AccuseModal (select suspect, reasoning, confirmation checkbox "I understand I only get one accusation").
10.3 UX Requirements
• Dark detective theme (deep navy/charcoal, amber accent). Accessible contrast (WCAG AA).
• Loading skeletons for every async region; friendly error states with retry.
• The Generating page shows a rotating set of staged messages mapped to progress.stage.
• Result page includes a reveal animation (respects prefers-reduced-motion).
• Keyboard navigable evidence list; all images have alt text from caption/description.
• A visible disclaimer in the footer: "All cases are fictional and generated by AI."
11. Prompt Engineering Requirements
• All prompts live in server/src/prompts/ as functions returning strings, each with a header comment describing inputs and expected output.
• User scenario text is placed inside clearly delimited tags (<scenario>…</scenario>) and the system prompt instructs the model to treat it as data, not instructions (prompt-injection defence).
• Every prompt requiring JSON includes the schema and the instruction to return JSON only.
• Seed variety: include a random creativeSeed (e.g. a setting twist) in the blueprint prompt to avoid repetitive cases.
• Language: English only in v1.
12. Scoring
• Base: 100 if correct, 0 if incorrect.
• Deductions (correct only): −10 per hint used.
• Bonus (display only, not scored): "Evidence examined" count vs. key evidence viewed.
• Result page displays: verdict, score, culprit, motive, method, true timeline, key evidence (with explanation of why each matters), and red herrings (with explanation of why each misleads).
• The client tracks which evidence items were opened and sends viewedEvidenceIds with the accusation for the stats display.
13. Non-Functional Requirements
• Performance: non-AI API endpoints respond < 300ms p95. Case ready in < 120s p90 for Medium difficulty.
• Security: Helmet, CORS restricted to CLIENT_ORIGIN, rate limiting (express-rate-limit), input sanitisation, no stack traces in production responses, secrets only via environment variables, request body limit 50kb.
• Reliability: generation jobs survive a page refresh (state lives in the DB). On server restart, any case stuck in a generating_* state for > 10 minutes is marked failed by a startup sweep.
• Observability: structured JSON logging (pino) with a request id; log every generation stage with duration.
• Accessibility: WCAG AA.
• Privacy: no personal data collected beyond the guest session id; scenario text is stored only for the case.
14. Testing & Acceptance Criteria
14.1 Automated tests (must pass)
1. toPlayerCase never includes solution, isKey, isRedHerring, purpose.
2. GET /cases/:id for a case in generating state returns 409 CASE_NOT_READY.
3. POST /accuse with an invalid suspect id returns 400; a second accusation returns 409 ALREADY_ACCUSED.
4. Zod blueprint schema rejects: 0 or 2+ culprits, fewer than 2 key evidence items, missing evidence types.
5. Another session cannot read or accuse on a case it does not own (404).
6. Gemini calls are mocked in all tests; no test hits the real API.
7. Scoring function unit tests (correct, incorrect, hints).
14.2 Acceptance checklist (manual)
[ ] Entering a scenario produces a playable case with portraits, ≥1 chat, ≥1 image, ≥1 CCTV item.
[ ] Network inspector shows no culprit information before accusation.
[ ] Chat renders in a chat-app style UI with timestamps and date dividers.
[ ] CCTV player scrubs between frames with timestamp overlay.
[ ] Accusing the right and the wrong suspect both show correct verdicts and full explanation.
[ ] Refreshing during generation resumes the progress screen.
[ ] A failed generation shows a friendly error and a working Try again.
[ ] Works at 375px width and on desktop.
15. Environment Variables (.env.example)
NODE_ENV=development
PORT=5000
CLIENT_ORIGIN=http://localhost:5173
MONGODB_URI=mongodb://localhost:27017/ai-mystery-room
GEMINI_API_KEY=
GEMINI_TEXT_MODEL=gemini-2.5-flash
GEMINI_IMAGE_MODEL=gemini-2.5-flash-image
STORAGE_DRIVER=local            # local | gridfs
UPLOAD_DIR=./uploads
RATE_LIMIT_CASES_PER_HOUR=5
GENERATION_TIMEOUT_MS=300000
ENABLE_VEO=false
SESSION_COOKIE_NAME=mr_sid
Client: VITE_API_BASE_URL=http://localhost:5000/api/v1
16. Error Codes
VALIDATION_ERROR (400), NOT_FOUND (404), CASE_NOT_READY (409), ALREADY_ACCUSED (409), RATE_LIMITED (429), SCENARIO_REJECTED (422), GENERATION_FAILED (500), INTERNAL (500).
17. Build Order for Codex
Complete each milestone, run its tests, and commit before moving on.
1. M1 – Scaffolding: monorepo, lint/format, env loader with validation, Express app, Mongo connection, /health, React + Tailwind shell, routing.
2. M2 – Sessions & Models: session middleware, Case and Session models, error handler, request validation helpers.
3. M3 – Case API (with mock generator): all endpoints in Section 8 working against a hard-coded sample case; player-safe serializer + tests; accuse + scoring.
4. M4 – Frontend core: Home form, Generating page (polling), Case Room, Accuse flow, Result page — using the mock case.
5. M5 – Evidence UI: WhatsAppChat, ImageEvidence, CctvPlayer, DocumentCard, notes/pins autosave.
6. M6 – Gemini integration: blueprint stage with schema + Zod + retries; evidence content stage; replace mock generator.
7. M7 – Images: portrait/photo/CCTV image generation, storage, fallbacks, concurrency limits.
8. M8 – Validation stage & hardening: solvability check, rate limiting, startup sweep, logging, security middleware.
9. M9 – Polish: hints (optional), animations, accessibility pass, README with setup and run instructions.
18. Out-of-Scope Backlog (do not build now)
Real video generation, user accounts, shareable public cases, multiplayer, leaderboards, multiple languages, audio evidence (voice notes), difficulty auto-tuning, case export to PDF.
19. Definition of Done
All Section 14 automated tests pass; the manual checklist is complete; README.md explains setup, env vars, and how to run client and server; no secrets committed; docs/DECISIONS.md lists every assumption made during implementation.
20. UI Design System & Visual Specification
This section extends and overrides Section 10 wherever they differ. It defines the look, feel, motion and per-screen layout. Implement the design tokens first (M1), then build every component to match this section.
20.1 Design Concept
"The Case File Room" – a dark, atmospheric detective office. The player sits at a desk under a warm lamp, surrounded by case folders, polaroids, a corkboard, a phone and a CCTV monitor. Every evidence type has its own physical-feeling container so the site feels like a game, not a dashboard.
Design principles
1. Atmosphere first: dark backgrounds, warm amber light, subtle film grain and vignette.
2. Evidence looks real: chats look like a phone, CCTV looks like a monitor, photos look like polaroids, documents look like paper.
3. One focal point per screen: the case/evidence being examined is always the brightest element.
4. Delight through motion, but always respect prefers-reduced-motion.
5. Mobile-first: every screen must be fully usable at 375px.
6. Original artwork only: no real brand logos, no WhatsApp logo or exact trade dress; use original green-bubble chat styling.
20.2 Design Tokens
Define as CSS variables in client/src/styles/tokens.css and map into tailwind.config.js.
Token
Value
Use
--bg-base
#0B0F1A
Page background
--bg-surface
#121826
Cards, panels
--bg-elevated
#1A2236
Modals, hovered cards
--border-subtle
#263049
Dividers, card borders
--text-primary
#EAE6DD
Body text (warm off-white)
--text-muted
#8E98AE
Secondary text
--accent-amber
#F5B544
Primary buttons, highlights, lamp glow
--accent-amber-dark
#C48A1E
Button hover/pressed
--accent-red
#E5484D
Red string, danger, "Accuse"
--accent-teal
#2DD4BF
Success, correct verdict, "evidence viewed"
--paper
#F1E9D6
Documents, polaroid frames, notes
--paper-ink
#2B2418
Text on paper
--chat-out
#0F5D4B
Outgoing chat bubble
--chat-in
#1F2937
Incoming chat bubble
--cctv-green
#7CFF9B
CCTV overlay text
Typography (load via Google Fonts with font-display: swap; always include fallbacks)
• Headings / case titles: Special Elite (typewriter) → fallback Courier New, monospace
• UI / body: Inter → fallback system-ui, sans-serif
• CCTV timestamps and logs: JetBrains Mono → fallback ui-monospace
• Handwritten notes and sticky labels: Caveat → fallback cursive
• Scale: 12 / 14 / 16 / 18 / 24 / 32 / 48 px; body line-height 1.6; headings 1.2.
Spacing & shape: 4px base grid (4, 8, 12, 16, 24, 32, 48, 64). Radius: cards 16px, buttons 12px, chips 999px, phone frame 36px, polaroid 4px.
Elevation & effects
• Card shadow: 0 8px 24px rgba(0,0,0,.45); hover lifts 4px with amber glow 0 0 0 1px rgba(245,181,68,.35), 0 12px 32px rgba(245,181,68,.12).
• Global overlay: a fixed, pointer-events-none film grain (SVG noise at 6% opacity) and a radial vignette on body::after.
• A soft amber lamp glow (radial gradient) behind the main heading on Home and behind the evidence viewer in the Case Room.
20.3 Motion Spec
Interaction
Animation
Duration
Page transition
Fade + 12px upward slide
250ms ease-out
Card hover
Lift + glow
150ms
Evidence card open
Card "flips" into the viewer using a shared-layout animation (Framer Motion layoutId)
350ms
New chat message (on open)
Messages appear sequentially with a typing indicator (…) between senders, 400–900ms stagger; a Skip button shows all instantly
variable
Suspect select in Accuse modal
Selected card scales to 1.03 with amber ring
150ms
Verdict reveal
Spotlight sweep, then the culprit's portrait is stamped GUILTY (rotated −8°, red, with thud scale animation)
1.2s
Correct verdict
Teal confetti of small paper pieces (canvas, max 80 particles)
1.5s
Wrong verdict
Screen briefly flickers, portrait of the accused gets a NOT GUILTY stamp, true culprit is revealed with a slow zoom
1.2s
Use Framer Motion. All animation must be disabled or reduced to simple fades when prefers-reduced-motion: reduce.
20.4 Global Layout & Navigation
• Top bar (sticky, 64px, translucent with backdrop blur): logo (magnifier icon + "AI Mystery Room" in Special Elite) at left; links New Case and My Cases; a case-progress chip at right inside the Case Room ("3 / 9 evidence viewed").
• Footer: disclaimer "All cases are fictional and generated by AI." and a small credits line.
• Icons: lucide-react only. Evidence type icons: chat → MessageSquare, image → Image, cctv → Cctv, note/document → FileText, suspect → User, accuse → Gavel, hint → Lightbulb, pin → Pin.
20.5 Screen-by-Screen Design
A. Home Page (/)
+--------------------------------------------------------------+
|  🔍 AI Mystery Room                    New Case | My Cases     |
+--------------------------------------------------------------+
|                                                              |
|         [ lamp glow ]                                        |
|     SOLVE A MYSTERY THAT DOESN'T EXIST... YET                |
|     Describe a scenario. We build the case. You find the     |
|     culprit.                                                 |
|                                                              |
|   +------------------------------------------------------+   |
|   |  Your scenario                                       |   |
|   |  [ A jewelry theft at a wedding reception...      ]  |   |
|   |  0 / 600                                             |   |
|   |  Difficulty:  (Easy) (Medium*) (Hard)                |   |
|   |  Tone: [Realistic][Noir][Cozy][Thriller]             |   |
|   |  Try an idea: [Missing cake] [Hacked lab] [Art heist]|   |
|   |                       [ 🔎 Create Mystery ]          |   |
|   +------------------------------------------------------+   |
|                                                              |
|   How it works:  1 Describe -> 2 Investigate -> 3 Accuse     |
|                                                              |
|   Your recent cases  [folder card] [folder card] [folder]    |
+--------------------------------------------------------------+
• Hero: large typewriter heading with a typing animation that cycles example scenarios; background has slow-moving dust particles and the lamp glow.
• Form card is a glass-style panel (bg-surface at 80% with blur and amber top border).
• Difficulty is a segmented control with icons (1, 2, 3 magnifiers) and a tooltip describing suspects/evidence counts.
• Tone options are chips that toggle (single-select). Example-idea chips fill the textarea on click.
• Primary button: amber gradient, magnifier icon, loading spinner when submitting, disabled until scenario ≥ 20 chars.
• "How it works" is a 3-step row with icons and connecting dotted line (stacked vertically on mobile).
• Recent cases are rendered as manila folder cards (tab on top-left showing difficulty, title in typewriter font, status badge: Generating / Ready / Solved ✓ / Failed, created date). Empty state: an empty folder illustration with text "No cases yet – start your first investigation."
B. Generating Page (/case/:id/generating)
+------------------------------------------------+
|        [ animated detective desk scene ]       |
|   "Interrogating the suspects..."              |
|   [=====>------------------]  42%              |
|   ✓ Blueprint   ✓ Suspects   ● Chat logs       |
|   ○ Photos   ○ CCTV   ○ Final checks          |
|   Tip: Not everything suspicious is guilty.    |
+------------------------------------------------+
• Full-screen dark scene with a pulsing magnifying glass sweeping across a blurred silhouette board.
• Rotating status copy mapped to progress.stage (change every 4s with a fade):
    ◦ generating_blueprint → "Dreaming up the crime…"
    ◦ generating_evidence → "Writing chat logs and notes…"
    ◦ generating_images → "Developing photographs…" / "Pulling CCTV footage…"
    ◦ validating → "Making sure it can be solved…"
• A stepper checklist with animated ticks; a progress bar with amber fill and moving shimmer.
• Rotating detective tips below (e.g. "Check timestamps against alibis").
• On failure: red-tinted card with the message, Try again and Back home buttons.
• On ready: a short "CASE FILE OPENED" stamp animation, then auto-navigate.
C. Case Room (/case/:id) – the main experience
Desktop (≥1024px):
+---------------+--------------------------------+-------------+
| BRIEFING      |  EVIDENCE VIEWER               | NOTEBOOK    |
| Title         |  (phone / monitor / photo /    | [textarea   |
| Setting       |   paper depending on type)     |  on yellow  |
|               |                                |  paper]     |
| SUSPECTS      |  -- Evidence board (grid) --   | PINNED      |
| [dossier]     |  [card][card][card][card]      | [chip][chip]|
| [dossier]     |  filters: All|Chat|Photo|CCTV  | [ACCUSE]    |
+---------------+--------------------------------+-------------+
• Three-column grid 320px / 1fr / 340px, each column scrolls independently; header stays fixed.
• Briefing panel: case title in typewriter font with a red "CONFIDENTIAL" rubber-stamp, setting text, and a collapsible "Case summary".
• Suspect dossiers (left): vertical list of cards styled as clipped dossier pages — portrait with paper-clip graphic, name, role chip, short bio (2 lines, expandable), and an Alibi box with a quote-style left border. Clicking a suspect opens a full-profile drawer and highlights all evidence tagged with them. A small "Suspect" toggle chip lets the player mark "Suspicious / Cleared" (cosmetic, saved in notes) with colored ring (amber / teal).
• Evidence board (centre bottom): grid of evidence cards (3 per row desktop, 2 tablet, 1 mobile). Each card shows type icon, title, source label, timestamp, tagged suspect avatars, and a "NEW" ribbon until opened; after opening it shows a teal check. A toggle switches between Grid and Corkboard view.
• Corkboard view: cork texture background; cards are rotated randomly (±3°), held by pins; players can drag cards and draw red string between two cards by clicking pin → pin (stored in session state; purely for the player's own reasoning). Provide a Reset board button.
• Filters: chips for type and a suspect dropdown; search box filters by title/source text.
• Notebook (right): yellow-paper textarea in Caveat font with ruled lines, autosave indicator ("Saved ✓"), and a list of pinned evidence chips that open on click.
• Accuse button: fixed at the bottom of the right column, red with gavel icon; pulses subtly once the player has opened at least 60% of the evidence.
• Hint button (if enabled): lightbulb icon with remaining count; reveals hint in a toast-style card.
Mobile (<768px): bottom tab bar with 4 tabs — Briefing, Suspects, Evidence, Notes — and a floating Accuse action button above it. Evidence viewer opens as a full-screen sheet that slides up from the bottom with a swipe-down-to-close handle.
D. Result Page (/case/:id/result)
+--------------------------------------------------------------+
|              [ spotlight on portrait ]                       |
|                  ██ GUILTY ██                               |
|                   Rhea Malhotra                              |
|                 You solved it! Score 100                     |
|--------------------------------------------------------------|
|  THE MOTIVE | THE METHOD                                     |
|--------------------------------------------------------------|
|  What really happened  (vertical timeline)                   |
|    18:02 --o  ...                                            |
|    18:40 --o  ...                                            |
|--------------------------------------------------------------|
|  The proof  [key evidence cards with "Why it matters"]       |
|  Red herrings [cards with "Why it misleads"]                 |
|--------------------------------------------------------------|
|  Your reasoning: "..."        Stats: 8/9 viewed, 0 hints     |
|  [ Play again ]  [ New mystery ]  [ Share result image ]     |
+--------------------------------------------------------------+
• Staged reveal: spotlight → stamp → name → score count-up (0 → 100 over 1s).
• Timeline is a vertical line with amber nodes; the clue evidence is linked inline (clicking opens a read-only modal of the evidence).
• Key evidence cards have a teal border and "Smoking gun" label; red-herring cards have a dashed red border and a "Misleading" label.
• Share result image: generate a client-side canvas image (title, verdict, score) with a Download button (no server storage).
• Wrong verdict uses a red-tinted palette and the line "Not quite — here's what you missed."
20.6 Evidence Component Designs
WhatsAppChat (phone mockup)
• A device frame (rounded 36px, 8px dark bezel, notch) centred in the viewer with a soft shadow, max width 380px.
• Header bar (dark green) with back arrow, round avatar, chat name, participant count, and decorative call/menu icons.
• Wallpaper: dark doodle pattern (original SVG pattern at 6% opacity).
• Bubbles: outgoing right-aligned (--chat-out), incoming left-aligned (--chat-in), tail on the first bubble of a sequence, sender name above incoming messages in group chats using a stable color per sender (hash → 8-color palette), time bottom-right, double tick icon (blue when read).
• Date divider chips ("Yesterday", "12 March"), a "Messages are end-to-end encrypted" style system bubble at top (original wording), and support for deleted message ("This message was deleted") and replies (quoted block with colored left bar).
• Highlight tool: long-press / click on a message to highlight it yellow and add it to the notebook as a quote.
• Typing sequence on first open (see 20.3) with a Skip link.
ImageEvidence (polaroid / photo viewer)
• Image displayed inside a white polaroid frame with a handwritten caption (Caveat) beneath, slightly rotated (−2°), taped at the top with a translucent tape graphic.
• Controls: zoom in/out, fullscreen, magnifier lens (circular 2.5× zoom following the cursor/finger), and an "Info" button opening an EXIF-style drawer (time, location, device).
• Skeleton shimmer while loading; fallback placeholder shows a torn-paper card with the textual description.
CctvPlayer (monitor)
• Monitor frame (thick bezel, small power LED, "CAM 03" label). Image gets a green-tinted, high-contrast, slightly desaturated filter, scanlines (repeating linear gradient), noise flicker, and rounded CRT-style corners.
• Overlays in JetBrains Mono, --cctv-green: top-left camera name and location, top-right blinking red ● REC, bottom-left timestamp (2024-03-12 18:42:07, updates per frame), bottom-right frame counter.
• Controls: play/pause, previous/next frame, scrubber with frame thumbnails, speed (1×/0.5×), Take snapshot (pins the current frame to the notebook).
• Crossfade between frames (300ms) plus a brief glitch effect on frame change.
DocumentCard (paper)
• Paper texture (--paper) with subtle fold line, --paper-ink text, drop shadow, slight rotation. Variants: receipt (thin, monospace, dashed dividers, barcode), email (header block with From/To/Subject/Date), log (table with monospace rows), note (lined paper, handwritten font).
• Text selection allowed, with a Highlight toolbar (yellow/pink) that persists in session state.
SuspectCard / dossier
• Portrait with a paper-clip graphic, a small stamped badge showing status (Unmarked, Suspicious, Cleared), name, role, age, and the alibi quote block. Hover reveals "View profile".
• Profile drawer (right side on desktop, bottom sheet on mobile): large portrait, full bio, alibi, list of evidence mentioning them (clickable), and a "Relationship to others" mini-diagram showing connections with other suspects as a small node graph (data from suspectTags co-occurrence).
20.7 Accuse Flow Design
1. Click Accuse → full-screen modal with dimmed background and the title "Who did it?".
2. Suspects shown as large selectable portrait cards in a row (horizontal scroll on mobile). Selected card: amber ring + checkmark badge.
3. Textarea "Explain your reasoning (optional)" with character counter (500).
4. Checkbox: "I understand I only get one accusation." The Confirm accusation button stays disabled until a suspect is selected and the box is checked.
5. After confirmation: a 2-second "Reviewing your accusation…" dramatic screen, then navigate to Result.
6. The modal is keyboard accessible: focus trapped, Esc closes, arrow keys switch suspects.
20.8 System States
• Loading: skeletons shaped like the final components (card skeletons, phone skeleton, polaroid skeleton) with a slow amber shimmer.
• Empty: illustrated empty states (empty folder, empty notebook, no evidence matching filters with a Clear filters button).
• Error: toast notifications (top-right desktop, top-center mobile) with red accent; full-page error with a broken-magnifier illustration and Retry.
• Offline: banner at top "You're offline — your notes will sync when you're back." (notes are kept in memory and retried).
• 404: "Case not found" with a folder marked MISSING and a link home.
• Toasts: "Note saved", "Evidence pinned", "Hint revealed", "Link copied".
20.9 Responsive Breakpoints
Breakpoint
Layout
<640px
Single column, bottom tab bar, evidence viewer as full-screen sheet, accuse as floating button
640–1023px
Two columns (evidence + notebook drawer toggle), suspects in a horizontal carousel
≥1024px
Three-column Case Room
≥1536px
Content max-width 1440px, centred
Touch targets ≥ 44×44px. Hover-only interactions must have a tap equivalent.
20.10 Accessibility Details for the UI
• All text/background pairs meet WCAG AA (verify --text-muted on --bg-surface ≥ 4.5:1).
• Visible focus ring: 2px amber outline with 2px offset on every interactive element.
• Texture/CRT effects must never reduce text legibility; provide a "Simple mode" toggle in the top bar that disables grain, scanlines, tilt, and heavy animation.
• Chat bubbles, CCTV frames and timeline nodes expose text equivalents via aria-label and a visually hidden transcript.
• Modals use role="dialog", aria-modal, focus trap and return focus on close.
20.11 Sound (optional, off by default)
A mute-by-default Sound toggle in the top bar enabling subtle effects: paper rustle (evidence open), keyboard click (typing), stamp thud (verdict). Use small royalty-free/own-generated audio files in client/public/audio/, lazy-loaded, never autoplay before user interaction.
20.12 Additional Frontend Dependencies
framer-motion, lucide-react, clsx, react-hot-toast (or sonner), canvas-confetti (small, or custom canvas), @use-gesture/react (drag on corkboard and sheet swipe). Fonts: Special Elite, Inter, JetBrains Mono, Caveat.
20.13 Design Acceptance Checklist
[ ] Design tokens exist in one file and are used everywhere (no hard-coded hex values in components).
[ ] Home, Generating, Case Room and Result match the layouts in 20.5 on desktop and at 375px.
[ ] Chat looks like a phone chat with bubbles, ticks, date dividers and a typing sequence.
[ ] CCTV shows scanlines, REC indicator and a changing timestamp overlay.
[ ] Photos render as polaroids with a magnifier lens and an info drawer.
[ ] Documents render in four paper variants (receipt, email, log, note).
[ ] Corkboard view supports dragging cards and drawing red strings.
[ ] Verdict reveal sequence plays (stamp, count-up, confetti for correct) and is replaced by simple fades under reduced motion.
[ ] Simple mode toggle removes heavy effects and persists in localStorage.
[ ] Lighthouse accessibility score ≥ 90 on Home and Case Room.
21. Premium Visual Polish Layer ("Wow-Factor" Spec)
Overrides Section 20 wherever they conflict. Goal: anyone who opens the site should think "this looks beautiful and professional" within 3 seconds, and want to screenshot it. The quality bar is a polished, award-style product site, not a student project and not a default Tailwind template. Take inspiration from the craft level of modern products (smooth motion, depth, glass, glow, generous whitespace) but copy no one's branding or layout.
21.1 Quality Bar & Anti-Patterns
Must have: consistent spacing on the 4/8px grid, one clear focal point per screen, rich depth (layers, blur, glow), smooth 60fps motion, real hover / focus / active / disabled states on every control, and beautiful empty, loading and error states.
Must avoid:
• Plain white boxes with default borders and default blue buttons.
• Flat, single-color backgrounds with no depth.
• Purple-to-blue "generic AI app" gradients.
• Emoji used as icons (use lucide-react).
• Walls of text, cramped padding, more than 3 font sizes in one card.
• Animations that block interaction or run longer than 600ms (except the verdict reveal).
21.2 Visual Language: "Cinematic Noir + Glass"
A moody film-noir world (deep blue-black, warm amber light, red accents) with modern glass UI panels floating above it. Think detective movie title sequence meets premium app.
Extra tokens (add to tokens.css)
:root {
  --grad-hero: radial-gradient(1200px 600px at 50% -10%, rgba(245,181,68,.22), transparent 60%),
               radial-gradient(900px 500px at 90% 20%, rgba(229,72,77,.12), transparent 60%),
               radial-gradient(800px 500px at 0% 40%, rgba(45,212,191,.08), transparent 60%);
  --glass-bg: rgba(18, 24, 38, .55);
  --glass-border: rgba(255, 255, 255, .08);
  --glass-highlight: inset 0 1px 0 rgba(255,255,255,.08);
  --glow-amber: 0 0 40px rgba(245,181,68,.25);
  --text-gradient: linear-gradient(180deg, #FFFFFF 0%, #EAE6DD 40%, #B8A98A 100%);
}
Glass panel recipe (used for every card, modal, top bar and sidebar)
.glass {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-highlight), 0 20px 50px rgba(0,0,0,.45);
  backdrop-filter: blur(16px) saturate(140%);
  border-radius: 20px;
}
Animated glow border (primary CTA, active evidence card, selected suspect)
.glow-border { position: relative; border-radius: 16px; }
.glow-border::before {
  content: ''; position: absolute; inset: -1px; border-radius: inherit; padding: 1px;
  background: conic-gradient(from var(--angle), transparent 0 70%, #F5B544 85%, transparent 100%);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude;
  animation: spin 4s linear infinite;
}
@property --angle { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
@keyframes spin { to { --angle: 360deg; } }
Cursor spotlight (desktop only): a radial amber gradient follows the mouse behind cards and the hero; implement by updating --mx / --my CSS variables on pointermove (throttled with requestAnimationFrame) and using radial-gradient(400px at var(--mx) var(--my), rgba(245,181,68,.14), transparent 70%) as an overlay on .glass cards on hover.
Background layers (back to front): base color → animated gradient mesh (--grad-hero, drifting slowly over 30s) → faint city-skyline or blinds-shadow image at 8% opacity → floating dust particles (max 40, canvas or tsparticles-slim) → film grain → vignette.
21.3 Typography Upgrade
• Display / hero headings: Fraunces (high-contrast serif, weights 600–800) for an elegant cinematic look; fallback Georgia, serif.
• UI / body: Inter (or Geist) at weights 400 / 500 / 600.
• Stamps, labels, CCTV, logs: JetBrains Mono. Special Elite is now used only for rubber stamps and case-file labels. Caveat only for handwritten notes.
• Fluid sizes: hero clamp(2.5rem, 6vw, 5rem) with letter-spacing: -0.03em, section titles clamp(1.75rem, 3.5vw, 3rem), body 16–18px.
• Hero and section headings use gradient text (--text-gradient with background-clip: text) and an amber highlighted keyword (e.g. mystery) with a subtle underline glow.
21.4 Landing Page as a Scroll Story (/)
The Home page becomes a full marketing-quality landing page with the scenario form as the hero's centrepiece. Sections, in order:
1. Hero (100vh). Gradient mesh + particles. Headline, word-by-word reveal (staggered 60ms): "Every story hides a culprit. Can you find them?" Sub-copy. The scenario input is a large glass card with a glowing border; the Create Mystery button has a shimmer sweep and a magnetic hover (moves up to 8px toward the cursor). On the right/behind, floating evidence cards (a phone chat, a polaroid, a CCTV frame, a dossier) drift with parallax (different depths and speeds, gentle 6s float loop) and tilt toward the cursor.
2. Scenario marquee. An infinitely scrolling, two-row marquee of example scenario chips ("A missing cake at a birthday", "A hacked school server", …), pausing on hover; clicking fills the hero input and scrolls up.
3. How it works (sticky scroll). Three steps pinned on the left (Describe → Investigate → Accuse); on the right a mockup animates per step as the user scrolls (typing a prompt → evidence cards flying in → stamp landing on a suspect).
4. Evidence showcase (bento grid). An asymmetric grid of glass tiles with live mini-demos: auto-typing WhatsApp-style chat, scanning CCTV frame, developing polaroid, flipping dossier, corkboard with red strings. Each tile has a short caption and lifts on hover.
5. Difficulty cards. Three tall glass cards (Rookie, Detective, Mastermind) with suspect and evidence counts, a difficulty meter and a glow on hover; clicking selects the difficulty and scrolls to the form.
6. Sample case preview. A looping, auto-playing 12-second animation of a pre-made sample case (pure frontend, no API call).
7. FAQ (accordion, smooth height animation) and a final CTA band with the amber glow.
8. Footer with disclaimer, links and a subtle skyline silhouette.
Hero wireframe
+------------------------------------------------------------------+
| 🔍 AI Mystery Room                        Cases   [Create]  (glass) |
|                                                                  |
|  Every story hides a                      [floating polaroid]    |
|  culprit. Can you                  [floating phone chat]         |
|  find them?                              [floating CCTV frame]   |
|  Sub-copy sentence here.                                         |
|  +------------------------------------------+  [dossier card]    |
|  | Describe your scenario...                |                    |
|  | (Easy)(Medium)(Hard)  [Noir][Cozy][...]  |                    |
|  |                    [ Create Mystery → ]  |  <- glow border    |
|  +------------------------------------------+                    |
|        ↓ scroll                                                  |
+------------------------------------------------------------------+
21.5 Interaction & Motion Layer
• Smooth scrolling on landing page with lenis (disabled in Case Room and under reduced motion).
• 3D tilt cards: evidence cards, difficulty cards and suspect dossiers tilt up to 8° toward the pointer with a moving glare highlight; reset smoothly on leave. Disabled on touch devices.
• Magnetic buttons for primary CTAs; ripple on click; press state scales to 0.97.
• Scroll-triggered reveals: every section fades up 24px with a 80ms stagger between children (whileInView, once).
• Count-up numbers and animated progress rings for score and evidence-viewed stats.
• Shared-element transitions: an evidence card expands into the viewer (layoutId), and the viewer closes back into the card.
• Command palette (Ctrl/Cmd + K, built with cmdk): jump to any evidence, suspect, or action (Accuse, Toggle corkboard, Simple mode). Show a small "⌘K" hint chip in the top bar.
• Custom cursor (desktop Case Room only): a soft amber ring that turns into a magnifier icon over images and CCTV frames.
• Skeletons and shimmer everywhere; no spinner-only loading.
• Micro-interactions: button icons nudge on hover, toggles spring, chips pop when selected, toast slides with a progress bar, notes "Saved" tick draws itself.
21.6 Case Room Polish
• Ambient lighting by evidence type: when an evidence item is open, the viewer's backdrop glow changes color — chat: soft green, CCTV: cold green-cyan, photo: warm amber, document: paper cream, key moments: none (never hint at importance). Transition 600ms.
• Blurred backdrop: behind the viewer, show the current image (photo, CCTV frame, portrait) blurred (40px) and darkened for depth.
• Layered depth: left and right columns are glass panels at different elevations; the centre viewer is the brightest and has a gentle floating shadow.
• Suspect confidence meters: next to each suspect, the player can drag a thin slider (0–100) for how suspicious; shown as a glowing arc on the portrait. Saved with notes; purely personal and never sent to the grader.
• Evidence timeline strip: a horizontal glass timeline at the top of the evidence board showing all evidence timestamps as dots; hovering shows the title; clicking opens it. Helps players cross-check alibis.
• Animated connections: when two items are linked on the corkboard, the red string draws itself (stroke-dashoffset animation, 500ms) with a small physics sag (quadratic curve).
• Top bar becomes a floating glass pill (centered, 12px from top) that shrinks on scroll.
21.7 Generating Screen — Cinematic
• Full-viewport scene: dark city skyline silhouette, rain streaks (CSS, 30 lines) and a slowly swinging desk-lamp light cone.
• Center: a glass "case file" that assembles itself — pieces (portraits, chat bubbles, photo frames, CCTV frame) fly in with spring physics as each stage completes, so the player watches the case being built.
• Typewriter log below (monospace) showing stage messages ("> Suspect profiles complete").
• Progress is an amber arc ring around the file, with percentage in the center.
21.8 Result Page — Cinematic
• Black screen → single spotlight cone fades in → portrait emerges from the dark → stamp slams (screen shake 8px for 150ms, dust burst) → name and score count-up.
• Timeline styled like film credits / storyboard frames: each event is a wide card with its evidence thumbnail and a connecting amber line that draws itself on scroll.
• Shareable poster card: a canvas-generated 1080×1350 "CASE CLOSED" movie-poster style image (title in Fraunces, portrait, verdict stamp, score, site name). Includes Download and Copy buttons.
21.9 Imagery & Illustration
• Hero and section art are generated once at build time (not at runtime) and committed to client/public/art/ as AVIF/WebP with a PNG fallback. Prompts to use with the Gemini image model:
    1. "Cinematic film noir detective office at night, rain on the window, warm amber desk lamp, scattered case files and polaroids, volumetric light, shallow depth of field, dark navy and amber palette, no text, no real people" (hero background).
    2. "Moody city skyline silhouette at night with rain, minimal, dark blue gradient, wide 21:9, no text" (generating screen and footer).
    3. "Close-up of a detective corkboard with photos and red string, dark moody lighting, bokeh, no readable text" (bento tile).
• Create a small illustration set in SVG (empty folder, broken magnifier, torn paper, rubber stamps: GUILTY, NOT GUILTY, CONFIDENTIAL, CASE CLOSED). Use consistent 1.5px stroke style and the amber / red / paper palette.
• All imagery uses loading="lazy", explicit width/height (no layout shift) and a blurred low-res placeholder.
21.10 Performance & Quality Guardrails
• Animate only transform and opacity; avoid animating filter or layout properties on large areas.
• Limit backdrop-filter to ≤ 6 simultaneous elements; fall back to a solid --bg-surface at 92% opacity when unsupported.
• Lazy-load heavy effects (particles, confetti, lenis) with dynamic import().
• Auto-enable Simple mode when prefers-reduced-motion is set or navigator.hardwareConcurrency <= 4 (user can override).
• Targets: Lighthouse Performance ≥ 85 and Accessibility ≥ 90 on Home; CLS < 0.05; interactions respond < 100ms; animations hold 60fps on a mid-range laptop.
• Keep text contrast AA even over glass and gradients (add a darker scrim behind text when needed).
21.11 Additional Dependencies
framer-motion, lenis, cmdk, react-intersection-observer, tsparticles-slim (or custom canvas), canvas-confetti, @use-gesture/react, clsx, sonner. Fonts: Fraunces, Inter, JetBrains Mono, Special Elite, Caveat.
21.12 Design Review Gate (required before each milestone is marked done)
Codex must produce screenshots (Playwright) of every changed screen at 375px, 768px and 1440px and verify:
[ ] Spacing is consistent (no cramped or uneven padding); everything aligns to the grid.
[ ] One clear focal point and a clear visual hierarchy on each screen.
[ ] Glass, glow and gradients are used with restraint (nothing looks muddy or neon-overloaded).
[ ] Every interactive element has visible hover, focus, active and disabled states.
[ ] Empty, loading and error states are designed, not default.
[ ] No layout shift when images or fonts load.
[ ] Animations are smooth and reduce correctly in Simple mode.
[ ] The landing page works as a standalone, shareable first impression.
21.13 Build Order Update
Insert after M1 in Section 17:
• M1b – Visual foundation: tokens, fonts, global background layers, glass/glow utilities, top bar, footer, and the full landing page (hero + all sections) with static content.
• Apply the 21.6–21.8 polish while building M4, M5 and M9.
• Phase 2 (after core works): command palette, custom cursor, confidence meters, poster generator, sample-case preview animation, sound.
Tip: if time is limited, the biggest visual payoff comes from this order of priority: (1) background layers + glass + glow, (2) hero with floating evidence cards, (3) phone/CCTV/polaroid evidence components, (4) the cinematic verdict reveal.