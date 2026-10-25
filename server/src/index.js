import { app } from './app.js';
import { connectDb } from './config/db.js';
import { env } from './config/env.js';
import { Case } from './models/Case.js';
import { runGeneration } from './services/generationJob.js';

await connectDb();
await Case.updateMany({ status: { $in: ['queued', 'generating_blueprint', 'generating_evidence', 'generating_images', 'validating'] }, updatedAt: { $lt: new Date(Date.now() - 10 * 60 * 1000) } }, { $set: { status: 'failed', errorMessage: 'Generation was interrupted. Please try again.', 'progress.stage': 'failed' } });
const recoverable = await Case.find({ status: { $in: ['queued', 'generating_blueprint', 'generating_evidence', 'generating_images', 'validating'] } });
for (const doc of recoverable) setImmediate(() => runGeneration(doc));
app.listen(env.PORT, () => console.log(JSON.stringify({ event: 'server_started', port: env.PORT })));
