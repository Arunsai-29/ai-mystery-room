import { v4 as uuid } from 'uuid';
import { Session } from '../models/Session.js';
import { env } from '../config/env.js';

export async function sessionMiddleware(req, res, next) {
  try {
    let id = req.cookies?.[env.SESSION_COOKIE_NAME];
    let session = id ? await Session.findOne({ sessionId: id }) : null;
    if (!session) {
      id = uuid();
      session = await Session.create({ sessionId: id });
      res.cookie(env.SESSION_COOKIE_NAME, id, { httpOnly: true, sameSite: 'lax', secure: env.NODE_ENV === 'production', maxAge: 30 * 86400000, path: '/' });
    } else { session.lastSeenAt = new Date(); await session.save(); }
    req.session = session;
    next();
  } catch (error) { next(error); }
}
