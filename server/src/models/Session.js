import mongoose from 'mongoose';

const SessionSchema = new mongoose.Schema({
  sessionId: { type: String, unique: true, index: true }, createdAt: { type: Date, default: Date.now }, lastSeenAt: { type: Date, default: Date.now },
  notes: [{ caseId: String, text: String, updatedAt: Date }], pins: [{ caseId: String, evidenceIds: [String] }]
});
SessionSchema.index({ lastSeenAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });
export const Session = mongoose.model('Session', SessionSchema);
