import { z } from 'zod';

export const createCaseSchema = z.object({
  scenario: z.string().trim().transform((s) => s.replace(/<[^>]*>/g, '').trim()).pipe(z.string().min(20).max(600)),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  tone: z.enum(['Realistic', 'Noir', 'Cozy', 'Thriller']).default('Noir')
});
export const accusationSchema = z.object({ suspectId: z.string().min(1), reasoning: z.string().max(500).optional().default(''), viewedEvidenceIds: z.array(z.string()).optional().default([]) });
export const blueprintSchema = z.object({
  title: z.string(), briefing: z.string(), setting: z.string(), suspects: z.array(z.object({ id: z.string(), name: z.string(), age: z.number(), role: z.string(), bio: z.string(), alibi: z.string() })).min(4).max(6),
  culprit: z.string(), motive: z.string(), method: z.string(), trueTimeline: z.array(z.object({ time: z.string(), event: z.string() })),
  evidencePlan: z.array(z.object({ id: z.string(), type: z.enum(['chat', 'image', 'cctv', 'note', 'document']), title: z.string(), purpose: z.string(), isKey: z.boolean(), isRedHerring: z.boolean(), involvedSuspectIds: z.array(z.string()), timestamp: z.string(), contentBrief: z.string() })).min(6).max(12),
  hints: z.array(z.string())
}).superRefine((value, ctx) => {
  if (!value.suspects.some((s) => s.id === value.culprit)) ctx.addIssue({ code: 'custom', message: 'Culprit must match a suspect id.' });
  if (new Set(value.suspects.map((s) => s.id)).size !== value.suspects.length) ctx.addIssue({ code: 'custom', message: 'Suspect ids must be unique.' });
  if (new Set(value.evidencePlan.map((e) => e.id)).size !== value.evidencePlan.length) ctx.addIssue({ code: 'custom', message: 'Evidence ids must be unique.' });
  if (value.evidencePlan.filter((e) => e.isKey).length < 2) ctx.addIssue({ code: 'custom', message: 'At least two key evidence items are required.' });
  for (const item of value.evidencePlan) {
    if (item.isKey && item.isRedHerring) ctx.addIssue({ code: 'custom', message: 'An evidence item cannot be both key and a red herring.' });
    for (const suspectId of item.involvedSuspectIds) if (!value.suspects.some((suspect) => suspect.id === suspectId)) ctx.addIssue({ code: 'custom', message: `Unknown suspect id on evidence ${item.id}.` });
  }
  for (const type of ['chat', 'image', 'cctv']) if (!value.evidencePlan.some((e) => e.type === type)) ctx.addIssue({ code: 'custom', message: `Missing required evidence type: ${type}` });
});
