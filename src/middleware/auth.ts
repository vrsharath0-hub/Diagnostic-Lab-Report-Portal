import { Request, Response, NextFunction } from 'express';
import { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getOrCreateUser } from '../db/users.ts';
import { PatientSessionPayload, verifyPatientSessionToken } from '../lib/session.ts';

export interface DbUser {
  id: number;
  uid: string;
  email: string;
  fullName: string;
  role: string;
  phone: string | null;
}

export interface AuthRequest extends Request {
  firebaseUser?: DecodedIdToken;
  dbUser?: DbUser;
  patientSession?: PatientSessionPayload;
}

export const requireFirebaseAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token || token.startsWith('pts.')) {
    return res.status(401).json({ error: 'Account sign-in required for this resource.' });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.firebaseUser = decoded;
    const dbUser = await getOrCreateUser(
      decoded.uid,
      decoded.email || `${decoded.uid}@user.local`,
      decoded.name
    );
    req.dbUser = dbUser;
    return next();
  } catch (error) {
    console.error('Firebase token verification failed:', error);
    return res.status(401).json({ error: 'Invalid or expired authentication session.' });
  }
};

export const requireStaff = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  await requireFirebaseAuth(req, res, () => {
    if (!req.dbUser || (req.dbUser.role !== 'staff' && req.dbUser.role !== 'admin')) {
      return res.status(403).json({ error: 'Laboratory staff permissions required.' });
    }
    return next();
  });
};

export const requireAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  await requireFirebaseAuth(req, res, () => {
    if (!req.dbUser || req.dbUser.role !== 'admin') {
      return res.status(403).json({ error: 'Administrator permissions required.' });
    }
    return next();
  });
};

export const requireAnyAuthenticatedActor = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  // Check if this is a signed Patient Report OTP Session token
  if (token.startsWith('pts.')) {
    const session = verifyPatientSessionToken(token);
    if (!session) {
      return res.status(401).json({ error: 'Report access session expired. Please verify again.' });
    }
    req.patientSession = session;
    return next();
  }

  // Otherwise verify as Firebase ID token
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.firebaseUser = decoded;
    const dbUser = await getOrCreateUser(
      decoded.uid,
      decoded.email || `${decoded.uid}@user.local`,
      decoded.name
    );
    req.dbUser = dbUser;
    return next();
  } catch (error) {
    console.error('Authentication check failed:', error);
    return res.status(401).json({ error: 'Invalid or expired authentication session.' });
  }
};
