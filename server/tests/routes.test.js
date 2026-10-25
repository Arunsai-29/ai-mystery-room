import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';
import { Case } from '../src/models/Case.js';
import { casesRouter } from '../src/routes/cases.routes.js';
import { errorHandler } from '../src/middleware/errors.js';

function testApp(sessionId = 'session-a') {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.session = { sessionId, notes: [], pins: [], save: async () => {}, markModified: () => {} }; next(); });
  app.use('/cases', casesRouter);
  app.use(errorHandler);
  return app;
}
const ownedCase = (overrides = {}) => ({
  publicId: 'case-123', sessionId: 'session-a', status: 'ready', suspects: [{ id: 'sus_01' }], evidence: [],
  solution: { culpritId: 'sus_01' }, accusation: null, hintsUsed: 0, save: async () => {}, ...overrides
});

describe('case API privacy and accusation guards', () => {
  let findOne;
  beforeEach(() => { findOne = jest.spyOn(Case, 'findOne'); });
  afterEach(() => { findOne.mockRestore(); });

  it('returns CASE_NOT_READY for a case still generating', async () => {
    findOne.mockResolvedValue(ownedCase({ status: 'generating_evidence' }));
    const response = await request(testApp()).get('/cases/case-123');
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CASE_NOT_READY');
  });

  it('rejects an invalid suspect id and a second accusation', async () => {
    findOne.mockResolvedValueOnce(ownedCase());
    const invalid = await request(testApp()).post('/cases/case-123/accuse').send({ suspectId: 'sus_missing' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');

    findOne.mockResolvedValueOnce(ownedCase({ status: 'solved', accusation: { correct: true } }));
    const second = await request(testApp()).post('/cases/case-123/accuse').send({ suspectId: 'sus_01' });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('ALREADY_ACCUSED');
  });

  it('hides cases from other guest sessions', async () => {
    findOne.mockResolvedValue(null);
    const otherSession = await request(testApp('session-b')).get('/cases/case-123');
    expect(otherSession.status).toBe(404);
    expect(otherSession.body.error.code).toBe('NOT_FOUND');
    const otherAccusation = await request(testApp('session-b')).post('/cases/case-123/accuse').send({ suspectId: 'sus_01' });
    expect(otherAccusation.status).toBe(404);
    expect(otherAccusation.body.error.code).toBe('NOT_FOUND');
  });
});
