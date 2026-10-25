import { blueprintSchema } from '../schemas/case.js';
import { toPlayerEvidencePayload } from '../schemas/evidence.js';

export function validateBlueprint(value) { return blueprintSchema.parse(value); }
export function toPlayerCase(doc, extras = {}) {
  const c = doc.toObject ? doc.toObject() : doc;
  return {
    id: c.publicId, status: c.status, progress: c.progress, title: c.title, briefing: c.briefing, setting: c.setting,
    difficulty: c.difficulty, tone: c.tone, suspects: (c.suspects || []).map(({ id, name, age, role, bio, alibi, portraitUrl, imageStatus }) => ({ id, name, age, role, bio, alibi, portraitUrl, imageStatus })),
    evidence: (c.evidence || []).map(({ id, type, title, sourceLabel, timestamp, suspectTags, payload }) => ({ id, type, title, sourceLabel, timestamp, suspectTags, payload: toPlayerEvidencePayload(type, payload) })),
    notes: extras.notes || '', pins: extras.pins || [], hintsUsed: c.hintsUsed || 0,
    hintCount: Math.max(0, 2 - (c.hintsUsed || 0)), accusation: c.accusation ? { suspectId: c.accusation.suspectId, reasoning: c.accusation.reasoning, correct: c.accusation.correct, score: c.accusation.score, viewedEvidenceIds: c.accusation.viewedEvidenceIds } : null
  };
}
