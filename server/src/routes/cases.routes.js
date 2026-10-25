import { Router } from 'express';
import { nanoid } from 'nanoid';
import { Case } from '../models/Case.js';
import { Session } from '../models/Session.js';
import { createCaseSchema, accusationSchema } from '../schemas/case.js';
import { toPlayerCase } from '../services/validator.js';
import { runGeneration } from '../services/generationJob.js';
import { scoreAccusation } from '../services/scoring.js';
import { AppError } from '../middleware/errors.js';
import { env } from '../config/env.js';
import rateLimit from 'express-rate-limit';

export const casesRouter = Router();
const caseRateLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: env.RATE_LIMIT_CASES_PER_HOUR, keyGenerator: (req) => req.session.sessionId, standardHeaders: true, legacyHeaders: false, handler: (_req, res) => res.status(429).json({ ok: false, error: { code: 'RATE_LIMITED', message: 'Please wait before creating another case.' } }) });
const playerReady = new Set(['ready', 'solved', 'failed_accusation']);
const findOwned = async (req, id) => {
  const doc = await Case.findOne({ publicId: id, sessionId: req.session.sessionId });
  if (!doc) throw new AppError(404, 'NOT_FOUND', 'Case not found.');
  doc.lastActivityAt = new Date(); await doc.save();
  return doc;
};

casesRouter.post('/', caseRateLimit, async (req, res, next) => {
  try {
    if (await Case.exists({ sessionId: req.session.sessionId, status: { $in: ['queued', 'generating_blueprint', 'generating_evidence', 'generating_images', 'validating'] } })) throw new AppError(409, 'GENERATION_IN_PROGRESS', 'Please finish your active case before creating another.');
    const parsed = createCaseSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Check the scenario and try again.');
    const doc = await Case.create({ publicId: nanoid(10), sessionId: req.session.sessionId, ...parsed.data, status: 'queued', progress: { stage: 'queued', percent: 0 } });
    setImmediate(() => runGeneration(doc));
    res.status(202).json({ ok: true, data: { caseId: doc.publicId } });
  } catch (error) { next(error); }
});

casesRouter.get('/', async (req, res, next) => {
  try { const docs = await Case.find({ sessionId: req.session.sessionId }).sort({ createdAt: -1 }).select('publicId title difficulty status createdAt errorMessage'); res.json({ ok: true, data: docs.map((c) => ({ id: c.publicId, title: c.title || c.scenario, difficulty: c.difficulty, status: c.status, createdAt: c.createdAt, errorMessage: c.errorMessage })) }); } catch (e) { next(e); }
});
casesRouter.get('/:id/status', async (req, res, next) => {
  try { const c = await findOwned(req, req.params.id); res.json({ ok: true, data: { status: c.status, progress: c.progress, ...(c.errorMessage ? { errorMessage: c.errorMessage } : {}) } }); } catch (e) { next(e); }
});
casesRouter.get('/:id', async (req, res, next) => {
  try {
    const c = await findOwned(req, req.params.id);
    if (!playerReady.has(c.status)) throw new AppError(409, 'CASE_NOT_READY', 'This case is still being prepared.');
    const session = req.session;
    const note = session.notes.find((n) => n.caseId === c.publicId)?.text || '';
    const pins = session.pins.find((p) => p.caseId === c.publicId)?.evidenceIds || [];
    res.json({ ok: true, data: toPlayerCase(c, { notes: note, pins }) });
  } catch (e) { next(e); }
});
casesRouter.get('/:id/result', async (req, res, next) => {
  try {
    const c = await findOwned(req, req.params.id);
    if (!c.accusation || !['solved', 'failed_accusation'].includes(c.status)) throw new AppError(409, 'CASE_NOT_READY', 'The solution is revealed after an accusation.');
    const solution = { ...c.solution.toObject(), culprit: c.suspects.find((s) => s.id === c.solution.culpritId), keyEvidence: c.evidence.filter((e) => c.solution.keyEvidenceIds.includes(e.id)).map((e) => ({ id: e.id, title: e.title, explanation: e.purpose })), redHerrings: c.evidence.filter((e) => c.solution.redHerringIds.includes(e.id)).map((e) => ({ id: e.id, title: e.title, explanation: e.purpose })) };
    res.json({ ok: true, data: { case: toPlayerCase(c), verdict: { correct: c.accusation.correct, score: c.accusation.score, suspectId: c.accusation.suspectId, reasoning: c.accusation.reasoning, hintsUsed: c.accusation.hintsUsed, viewedCount: c.accusation.viewedEvidenceIds?.length || 0, totalEvidence: c.evidence.length }, solution } });
  } catch (e) { next(e); }
});
casesRouter.put('/:id/notes', async (req, res, next) => {
  try {
    const c = await findOwned(req, req.params.id); const text = typeof req.body?.text === 'string' ? req.body.text.slice(0, 10000) : null;
    if (text === null) throw new AppError(400, 'VALIDATION_ERROR', 'Notes must be text.');
    const row = req.session.notes.find((n) => n.caseId === c.publicId);
    if (row) { row.text = text; row.updatedAt = new Date(); } else req.session.notes.push({ caseId: c.publicId, text, updatedAt: new Date() });
    req.session.markModified('notes'); await req.session.save(); res.json({ ok: true, data: { saved: true } });
  } catch (e) { next(e); }
});
casesRouter.put('/:id/pins', async (req, res, next) => {
  try {
    const c = await findOwned(req, req.params.id); const ids = req.body?.evidenceIds;
    if (!Array.isArray(ids) || ids.some((id) => !c.evidence.some((e) => e.id === id))) throw new AppError(400, 'VALIDATION_ERROR', 'Choose evidence from this case.');
    const row = req.session.pins.find((p) => p.caseId === c.publicId);
    if (row) row.evidenceIds = [...new Set(ids)]; else req.session.pins.push({ caseId: c.publicId, evidenceIds: [...new Set(ids)] });
    req.session.markModified('pins'); await req.session.save(); res.json({ ok: true, data: { evidenceIds: ids } });
  } catch (e) { next(e); }
});
casesRouter.post('/:id/hint', async (req, res, next) => {
  try { const c = await findOwned(req, req.params.id); if (c.status !== 'ready') throw new AppError(409, 'CASE_NOT_READY', 'Hints are available while investigating.'); if (c.hintsUsed >= 2) throw new AppError(409, 'NO_HINTS_LEFT', 'You have used both hints.'); const hint = c.hints[c.hintsUsed]?.text; c.hintsUsed += 1; await c.save(); res.json({ ok: true, data: { hint, hintsUsed: c.hintsUsed, hintCount: 2 - c.hintsUsed } }); } catch (e) { next(e); }
});
casesRouter.post('/:id/accuse', async (req, res, next) => {
  try {
    const c = await findOwned(req, req.params.id); if (c.status !== 'ready') throw new AppError(c.accusation ? 409 : 409, c.accusation ? 'ALREADY_ACCUSED' : 'CASE_NOT_READY', c.accusation ? 'You have already made your accusation.' : 'This case is not ready for an accusation.');
    const parsed = accusationSchema.safeParse(req.body); if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Choose a suspect.');
    const { suspectId, reasoning, viewedEvidenceIds } = parsed.data;
    if (!c.suspects.some((s) => s.id === suspectId)) throw new AppError(400, 'VALIDATION_ERROR', 'That suspect is not part of this case.');
    const correct = suspectId === c.solution.culpritId; const score = scoreAccusation(correct, c.hintsUsed);
    c.accusation = { suspectId, reasoning, correct, score, hintsUsed: c.hintsUsed, viewedEvidenceIds: viewedEvidenceIds.filter((id) => c.evidence.some((e) => e.id === id)), accusedAt: new Date() };
    c.status = correct ? 'solved' : 'failed_accusation'; await c.save();
    const solution = { ...c.solution.toObject(), culprit: c.suspects.find((s) => s.id === c.solution.culpritId), keyEvidence: c.evidence.filter((e) => c.solution.keyEvidenceIds.includes(e.id)).map((e) => ({ id: e.id, title: e.title, explanation: e.purpose })), redHerrings: c.evidence.filter((e) => c.solution.redHerringIds.includes(e.id)).map((e) => ({ id: e.id, title: e.title, explanation: e.purpose })) };
    res.json({ ok: true, data: { verdict: { correct, score, suspectId, hintsUsed: c.hintsUsed, viewedCount: c.accusation.viewedEvidenceIds.length, totalEvidence: c.evidence.length }, solution } });
  } catch (e) { next(e); }
});
casesRouter.post('/:id/retry', async (req, res, next) => {
  try { const c = await findOwned(req, req.params.id); if (c.status !== 'failed') throw new AppError(409, 'CASE_NOT_READY', 'Only a failed case can be retried.'); c.status = 'queued'; c.progress = { stage: 'queued', percent: 0 }; c.errorMessage = ''; await c.save(); setImmediate(() => runGeneration(c)); res.status(202).json({ ok: true, data: { caseId: c.publicId } }); } catch (e) { next(e); }
});
casesRouter.delete('/:id', async (req, res, next) => {
  try { const c = await findOwned(req, req.params.id); await c.deleteOne(); req.session.notes = req.session.notes.filter((n) => n.caseId !== c.publicId); req.session.pins = req.session.pins.filter((p) => p.caseId !== c.publicId); await req.session.save(); res.json({ ok: true, data: { deleted: true } }); } catch (e) { next(e); }
});
