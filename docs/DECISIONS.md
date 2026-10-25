# Implementation decisions

- Cases use a stable, fictional sample mystery whenever `GEMINI_API_KEY` is not configured. This keeps local setup playable without external credentials.
- Generated image assets use the local uploads directory. GridFS is not enabled; failed image calls leave the case playable with descriptive fallbacks.
- Guest session records and cases expire after 30 days of inactivity. The session cookie is HTTP-only and secure in production.
- Hints are implemented as a small, pre-generated list and limited to two per case.
- UI polish uses CSS transitions and native CSS rather than animation packages. Reduced-motion preferences are respected.
- The landing page includes the full section sequence and CSS evidence mockups. Its sample case preview is static, and advanced phase-two effects such as corkboard strings, command palette, cursor, confidence meters, poster export, and sound are not included.
