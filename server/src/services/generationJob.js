import { generateCase } from './caseGenerator.js';

export async function runGeneration(doc) {
  const startedAt = Date.now();
  try {
    await generateCase(doc, async (stage, percent) => {
      doc.status = stage;
      doc.progress = { stage, percent };
      doc.lastActivityAt = new Date();
      await doc.save();
      console.info(JSON.stringify({ event: 'generation_progress', caseId: doc.publicId, stage, percent, elapsedMs: Date.now() - startedAt }));
    });
  } catch (error) {
    doc.status = 'failed';
    doc.errorMessage = 'We could not finish this case. Please try again.';
    doc.progress = { stage: 'failed', percent: doc.progress?.percent || 0 };
    await doc.save().catch(() => {});
    console.error(JSON.stringify({ event: 'generation_failed', caseId: doc.publicId, elapsedMs: Date.now() - startedAt, message: error.message }));
  }
}
