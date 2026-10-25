import mongoose from 'mongoose';

const EvidenceSchema = new mongoose.Schema({
  id: String,
  type: String,
  title: String,
  sourceLabel: String,
  timestamp: Date,
  suspectTags: [String],
  payload: mongoose.Schema.Types.Mixed,
  isKey: Boolean,
  isRedHerring: Boolean,
  purpose: String
}, { _id: false });

const CaseSchema = new mongoose.Schema({
  publicId: { type: String, unique: true, index: true }, sessionId: { type: String, index: true },
  lastActivityAt: { type: Date, default: Date.now },
  scenario: String, difficulty: String, tone: String,
  status: { type: String, default: 'queued', index: true }, progress: { stage: String, percent: Number }, errorMessage: String,
  title: String, briefing: String, setting: String,
  suspects: [{ id: String, name: String, age: Number, role: String, bio: String, alibi: String, portraitUrl: String, imageStatus: String }],
  evidence: [EvidenceSchema],
  solution: { culpritId: String, motive: String, method: String, trueTimeline: [{ time: String, event: String }], keyEvidenceIds: [String], redHerringIds: [String], explanation: String },
  hints: [{ text: String }], accusation: { suspectId: String, reasoning: String, correct: Boolean, score: Number, hintsUsed: Number, viewedEvidenceIds: [String], accusedAt: Date },
  hintsUsed: { type: Number, default: 0 }, generationMeta: mongoose.Schema.Types.Mixed, validationReport: mongoose.Schema.Types.Mixed
}, { timestamps: true });
CaseSchema.index({ sessionId: 1, createdAt: -1 });
CaseSchema.index({ lastActivityAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });
export const Case = mongoose.model('Case', CaseSchema);
