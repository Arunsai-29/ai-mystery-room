import { z } from 'zod';

const participant = z.object({ name: z.string().max(80), suspectId: z.string().nullable() }).strip();
const message = z.object({ sender: z.string().max(80), text: z.string().max(2000), sentAt: z.string(), status: z.enum(['read', 'delivered']), replyTo: z.string().nullable().optional() }).strip();
const imagePath = z.string().refine((value) => value === '' || value.startsWith('/uploads/'), 'Image URLs must point to local generated assets.').optional().default('');
export const evidencePayloadSchemas = {
  chat: z.object({ chatName: z.string().max(120), isGroup: z.boolean(), participants: z.array(participant).min(1).max(12), messages: z.array(message).min(12).max(30) }).strip(),
  image: z.object({ imageUrl: imagePath, caption: z.string().max(400), description: z.string().max(1200).optional().default(''), metadata: z.object({ takenAt: z.string(), location: z.string().max(160), device: z.string().max(100) }).strip(), imageStatus: z.enum(['ok', 'fallback']).optional().default('fallback') }).strip(),
  cctv: z.object({ cameraName: z.string().max(100), location: z.string().max(160), frames: z.array(z.object({ imageUrl: imagePath, timestamp: z.string().regex(/^\d{2}:\d{2}:\d{2}$/), description: z.string().max(500) }).strip()).min(3).max(6) }).strip(),
  note: z.object({ format: z.enum(['note', 'receipt', 'email', 'log']), body: z.string().max(8000) }).strip(),
  document: z.object({ format: z.enum(['note', 'receipt', 'email', 'log']), body: z.string().max(8000) }).strip()
};

export function validateEvidencePayload(type, value) { return evidencePayloadSchemas[type].parse(value); }

export function toPlayerEvidencePayload(type, value = {}) {
  const parsed = evidencePayloadSchemas[type]?.safeParse(value);
  if (parsed?.success) return parsed.data;
  if (type === 'chat') return { chatName: String(value.chatName || 'Recovered conversation'), isGroup: Boolean(value.isGroup), participants: [], messages: [] };
  if (type === 'image') return { imageUrl: '', caption: String(value.caption || ''), description: String(value.description || ''), metadata: { takenAt: '', location: '', device: '' }, imageStatus: 'fallback' };
  if (type === 'cctv') return { cameraName: String(value.cameraName || 'Security camera'), location: String(value.location || ''), frames: [] };
  return { format: ['note', 'receipt', 'email', 'log'].includes(value.format) ? value.format : 'document', body: String(value.body || '') };
}
