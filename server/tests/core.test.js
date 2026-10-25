import { toPlayerCase, validateBlueprint } from '../src/services/validator.js';
import { scoreAccusation } from '../src/services/scoring.js';

const validBlueprint = () => ({
  title: 'The Quiet Gallery', briefing: 'A miniature disappears during a private viewing.', setting: 'A fictional gallery.',
  suspects: [1, 2, 3, 4].map((n) => ({ id: `sus_${n}`, name: `Person ${n}`, age: 30, role: 'Guest', bio: 'A fictional guest.', alibi: 'I was elsewhere.' })),
  culprit: 'sus_1', motive: 'A private debt.', method: 'Taken in a case.', trueTimeline: [{ time: '20:00', event: 'The doors open.' }], hints: ['Check the log.'],
  evidencePlan: ['chat', 'image', 'cctv', 'document', 'note', 'document'].map((type, i) => ({ id: `ev_${i}`, type, title: `Item ${i}`, purpose: 'A detail.', isKey: i < 2, isRedHerring: false, involvedSuspectIds: ['sus_1'], timestamp: '2026-03-14T20:00:00.000Z', contentBrief: 'A clue.' }))
});

describe('player-safe case serialization', () => {
  it('never returns solution or server-only evidence annotations', () => {
    const playerCase = toPlayerCase({ publicId: 'case-a', status: 'ready', title: 'A case', suspects: [], evidence: [{ id: 'ev_1', type: 'note', title: 'Note', sourceLabel: 'Desk', timestamp: new Date(), suspectTags: [], payload: {}, isKey: true, isRedHerring: false, purpose: 'Hidden' }], solution: { culpritId: 'sus_1' }, validationReport: {}, generationMeta: {} });
    expect(playerCase).not.toHaveProperty('solution');
    expect(playerCase).not.toHaveProperty('generationMeta');
    expect(playerCase).not.toHaveProperty('validationReport');
    expect(playerCase.evidence[0]).not.toHaveProperty('isKey');
    expect(playerCase.evidence[0]).not.toHaveProperty('isRedHerring');
    expect(playerCase.evidence[0]).not.toHaveProperty('purpose');
  });
});

describe('blueprint validation', () => {
  it('requires one known culprit, two key clues, and chat, image, and CCTV', () => {
    const blueprint = validBlueprint();
    expect(() => validateBlueprint(blueprint)).not.toThrow();
    expect(() => validateBlueprint({ ...blueprint, culprit: 'missing' })).toThrow();
    expect(() => validateBlueprint({ ...blueprint, evidencePlan: blueprint.evidencePlan.map((e) => ({ ...e, isKey: false })) })).toThrow();
    expect(() => validateBlueprint({ ...blueprint, evidencePlan: blueprint.evidencePlan.filter((e) => e.type !== 'cctv') })).toThrow();
    expect(() => validateBlueprint({ ...blueprint, culprit: ['sus_1', 'sus_2'] })).toThrow();
  });
});

describe('accusation score', () => {
  it('awards 100 less hint deductions only for a correct accusation', () => {
    expect(scoreAccusation(true, 0)).toBe(100);
    expect(scoreAccusation(true, 2)).toBe(80);
    expect(scoreAccusation(false, 0)).toBe(0);
    expect(scoreAccusation(false, 2)).toBe(0);
  });
});
