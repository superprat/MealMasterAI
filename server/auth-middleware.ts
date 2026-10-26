import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { timingSafeEqual } from 'crypto';
import rateLimit from 'express-rate-limit';
import { db } from './db';
import { families } from '../shared/schema';
import { eq } from 'drizzle-orm';

const BCRYPT_ROUNDS = 10;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

function isBcryptHash(value: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(value);
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

// Slows down password guessing. Counts are kept per server instance.
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' },
});

// Every API route needs a logged-in family, except login/logout/session.
// Pages and static files are public; the browser sends logged-out users to /login.
export function requirePassword(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith('/api/') || req.path.startsWith('/api/auth/')) {
    return next();
  }

  const isAuthenticated = (req.session as any)?.authenticated;
  const familyId = (req.session as any)?.familyId;

  if (isAuthenticated && familyId) {
    // Add familyId to request for use in routes
    (req as any).familyId = familyId;
    return next();
  }

  return res.status(401).json({ message: 'Authentication required' });
}

export async function handleLogin(req: Request, res: Response) {
  const { password } = req.body ?? {};

  if (typeof password !== 'string' || password.length === 0 || password.length > 200) {
    return res.status(400).json({ success: false, message: 'Password required' });
  }

  try {
    // Check every family so the response time doesn't reveal which one matched.
    // Passwords stored before hashing was added are compared in constant time
    // and re-saved as a bcrypt hash on their first successful login.
    const allFamilies = await db.select().from(families);
    let match: (typeof allFamilies)[number] | undefined;

    for (const family of allFamilies) {
      const ok = isBcryptHash(family.password)
        ? await bcrypt.compare(password, family.password)
        : safeEqual(password, family.password);
      if (ok && !match) match = family;
    }

    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid password' });
    }

    if (!isBcryptHash(match.password)) {
      await db.update(families)
        .set({ password: await hashPassword(password) })
        .where(eq(families.id, match.id));
    }

    const family = match;
    // New session id on login so a pre-login session id can't be reused
    req.session.regenerate((regenErr) => {
      if (regenErr) {
        console.error('Session regenerate error:', regenErr);
        return res.status(500).json({ success: false, message: 'Login failed' });
      }

      (req.session as any).authenticated = true;
      (req.session as any).familyId = family.id;
      (req.session as any).familyName = family.name;

      // Force session save before responding
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).json({ success: false, message: 'Login failed' });
        }
        res.json({
          success: true,
          family: {
            id: family.id,
            name: family.name
          }
        });
      });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
}

export function handleLogout(req: Request, res: Response) {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destroy error:', err);
      return res.status(500).json({ success: false, message: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
}
