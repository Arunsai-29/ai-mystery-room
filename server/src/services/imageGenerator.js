import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gemini, models } from '../config/gemini.js';
import { env } from '../config/env.js';

const uploadPath = path.resolve(env.UPLOAD_DIR);
const imagePrompt = (description, identity = '') => `Create one photorealistic fictional evidence image. ${description}. ${identity} Cinematic noir lighting, realistic but non-graphic, no text, no watermark, no real person, no brand logo.`;
async function createImage(prompt, filename) {
  if (!gemini) return '';
  const response = await gemini.models.generateContent({ model: models.image, contents: prompt, config: { responseModalities: ['IMAGE', 'TEXT'] } });
  const image = response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData;
  if (!image?.data) throw new Error('Image model returned no image data.');
  await mkdir(uploadPath, { recursive: true });
  const extension = image.mimeType === 'image/jpeg' ? '.jpg' : image.mimeType === 'image/webp' ? '.webp' : '.png';
  const storedName = filename.replace(/\.[^.]+$/, extension);
  await writeFile(path.join(uploadPath, storedName), Buffer.from(image.data, 'base64'));
  return `/uploads/${storedName}`;
}
async function withRetry(prompt, filename, assetId) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      console.info(JSON.stringify({ event: 'image_generation_started', assetId, model: models.image, attempt }));
      const url = await createImage(prompt, filename);
      console.info(JSON.stringify({ event: 'image_generation_completed', assetId, model: models.image, attempt }));
      return url;
    } catch (error) {
      lastError = error;
      console.error(JSON.stringify({ event: 'image_generation_failed', assetId, model: models.image, attempt, message: String(error?.message || error).slice(0, 500) }));
    }
  }
  throw lastError;
}

export async function generateImages(doc, concurrency = 2) {
  if (!gemini || !env.ENABLE_IMAGE_GENERATION) {
    console.info(JSON.stringify({ event: 'image_generation_skipped', reason: !gemini ? 'gemini_api_key_missing' : 'disabled_by_config' }));
    return;
  }
  const tasks = [];
  for (const suspect of doc.suspects) tasks.push(async () => { suspect.portraitUrl = await withRetry(imagePrompt(`${suspect.age}-year-old fictional person, portrait for a detective dossier`, `Neutral expression, shoulders-up.`), `${doc.publicId}-${suspect.id}.png`, `${suspect.id}:portrait`); suspect.imageStatus = suspect.portraitUrl ? 'ok' : 'fallback'; });
  for (const item of doc.evidence) {
    if (item.type === 'image') tasks.push(async () => { item.payload.imageUrl = await withRetry(imagePrompt(item.payload.description || item.payload.caption || item.title), `${doc.publicId}-${item.id}.png`, `${item.id}:photo`); item.payload.imageStatus = item.payload.imageUrl ? 'ok' : 'fallback'; });
    if (item.type === 'cctv') for (let index = 0; index < (item.payload.frames || []).length; index++) tasks.push(async () => { const frame = item.payload.frames[index]; frame.imageUrl = await withRetry(imagePrompt(`Grainy low-resolution high wide-angle fixed security camera frame at ${item.payload.location}. Timestamp context ${frame.timestamp}. ${frame.description}. Keep camera angle and location consistent.`), `${doc.publicId}-${item.id}-${index + 1}.png`, `${item.id}:frame-${index + 1}`); });
  }
  let cursor = 0;
  async function worker() { while (cursor < tasks.length) { const task = tasks[cursor++]; try { await task(); } catch { /* Keep the playable text fallback; withRetry already logged the failure. */ } } }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
}
