const string = { type: 'STRING' };
const boolean = { type: 'BOOLEAN' };
const array = (items, minItems, maxItems) => ({ type: 'ARRAY', items, ...(minItems ? { minItems: String(minItems) } : {}), ...(maxItems ? { maxItems: String(maxItems) } : {}) });
const object = (properties, required = Object.keys(properties)) => ({ type: 'OBJECT', properties, required, propertyOrdering: required });

const suspect = object({ id: string, name: string, age: { type: 'INTEGER' }, role: string, bio: string, alibi: string });
const timelineItem = object({ time: string, event: string });
const evidencePlanItem = object({
  id: string, type: { type: 'STRING', enum: ['chat', 'image', 'cctv', 'note', 'document'] }, title: string, purpose: string,
  isKey: boolean, isRedHerring: boolean, involvedSuspectIds: array(string), timestamp: string, contentBrief: string
});
export const blueprintModelSchema = object({
  title: string, briefing: string, setting: string, suspects: array(suspect, 4, 6), culprit: string, motive: string, method: string,
  trueTimeline: array(timelineItem, 1), evidencePlan: array(evidencePlanItem, 6, 12), hints: array(string, 0, 2)
});

const participant = object({ name: string, suspectId: { anyOf: [string, { type: 'NULL' }] } });
const message = object({ sender: string, text: string, sentAt: string, status: { type: 'STRING', enum: ['read', 'delivered'] }, replyTo: { anyOf: [string, { type: 'NULL' }] } });
const metadata = object({ takenAt: string, location: string, device: string });
const frame = object({ imageUrl: string, timestamp: string, description: string });
const documentFormat = { type: 'STRING', enum: ['note', 'receipt', 'email', 'log'] };
export const evidenceModelSchemas = {
  chat: object({ chatName: string, isGroup: boolean, participants: array(participant, 1, 12), messages: array(message, 12, 30) }),
  image: object({ imageUrl: string, caption: string, description: string, metadata, imageStatus: { type: 'STRING', enum: ['ok', 'fallback'] } }),
  cctv: object({ cameraName: string, location: string, frames: array(frame, 3, 6) }),
  note: object({ format: documentFormat, body: string }),
  document: object({ format: documentFormat, body: string })
};
export const solvabilityModelSchema = object({ culpritId: string, evidenceIds: array(string, 2) });
