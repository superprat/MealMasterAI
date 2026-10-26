import { Request, Response, NextFunction } from 'express';
import { db } from './db';
import { families } from '@shared/schema';
import { eq } from 'drizzle-orm';

export function requirePassword(req: Request, res: Response, next: NextFunction) {
  // Skip authentication for static assets, login page, and auth endpoints
  if (
    req.path === '/login' || 
    req.path.startsWith('/api/auth') || 
    req.path.startsWith('/api/health') ||
    req.path === '/health' ||
    req.path.startsWith('/assets/') ||
    req.path.startsWith('/src/') ||
    req.path.startsWith('/@') ||
    req.path.endsWith('.js') ||
    req.path.endsWith('.ts') ||
    req.path.endsWith('.tsx') ||
    req.path.endsWith('.css') ||
    req.path.endsWith('.ico') ||
    req.path.endsWith('.png') ||
    req.path.endsWith('.jpg') ||
    req.path.endsWith('.svg') ||
    req.path.endsWith('.webmanifest') ||
    req.path.includes('vite') ||
    req.path.includes('node_modules')
  ) {
    return next();
  }

  // Check if user is authenticated via session
  const isAuthenticated = (req.session as any)?.authenticated;
  const familyId = (req.session as any)?.familyId;
  
  if (isAuthenticated && familyId) {
    // Add familyId to request for use in routes
    (req as any).familyId = familyId;
    return next();
  }

  // Debug logging for production issues
  console.log(`Auth check failed for ${req.path}, session authenticated: ${isAuthenticated}, familyId: ${familyId}`);

  // For API routes, return 401
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  // For page routes, redirect to login
  return res.redirect('/login');
}

export async function handleLogin(req: Request, res: Response) {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ success: false, message: 'Password required' });
  }

  try {
    // Find family by password
    const family = await db.select().from(families).where(eq(families.password, password)).limit(1);
    
    if (family.length > 0) {
      (req.session as any).authenticated = true;
      (req.session as any).familyId = family[0].id;
      (req.session as any).familyName = family[0].name;
      
      // Force session save before responding
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).json({ success: false, message: 'Login failed' });
        }
        res.json({ 
          success: true, 
          family: { 
            id: family[0].id, 
            name: family[0].name 
          } 
        });
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid password' });
    }
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
    res.json({ success: true });
  });
}