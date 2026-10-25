/** Inputs: evidence plan item and cast. Output: JSON payload for the requested evidence type. */
export function evidencePrompt({ item, suspects, feedback = '' }) {
  const schemas = {
    chat: '{"chatName":"string","isGroup":true,"participants":[{"name":"string","suspectId":"string|null"}],"messages":[{"sender":"string","text":"string","sentAt":"ISO-8601","status":"read|delivered","replyTo":"string|null"}]}',
    image: '{"imageUrl":"","caption":"string","description":"string","metadata":{"takenAt":"ISO-8601","location":"string","device":"string"},"imageStatus":"fallback"}',
    cctv: '{"cameraName":"string","location":"string","frames":[{"imageUrl":"","timestamp":"HH:MM:SS","description":"string"}]}',
    note: '{"format":"note|receipt|email|log","body":"markdown string"}', document: '{"format":"note|receipt|email|log","body":"markdown string"}'
  };
  return `Create fictional ${item.type} evidence as JSON only matching this exact shape: ${schemas[item.type]}. Use no real brands or personal contact details. Preserve this purpose subtly: ${item.purpose}. Content brief: ${item.contentBrief}. Title: ${item.title}. Timestamp: ${item.timestamp}. Suspects: ${JSON.stringify(suspects)}. ${feedback ? `Correct this validation issue: ${feedback}.` : ''} Chats must contain 12-30 messages. CCTV must contain 3-6 frames. Do not include solution, culprit, purpose, or other fields.`;
}
