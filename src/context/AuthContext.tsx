import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import { apiFetch } from '../lib/api.ts';
import { AccountUser } from '../types/portal.ts';

interface PatientOtpSession {
  token: string;
  patientCode: string;
  testCode: string;
}

interface AuthContextValue {
  loading: boolean;
  firebaseUser: FirebaseUser | null;
  accountUser: AccountUser | null;
  patientSession: PatientOtpSession | null;
  authError: string | null;
  getToken: () => Promise<string | null>;
  signInWithGoogle: () => Promise<void>;
  startPatientOtpSession: (session: PatientOtpSession) => void;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [accountUser, setAccountUser] = useState<AccountUser | null>(null);
  const [patientSession, setPatientSession] = useState<PatientOtpSession | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const syncAccountProfile = useCallback(async (user: FirebaseUser) => {
    try {
      const idToken = await user.getIdToken();
      const data = await apiFetch<{ user: AccountUser }>('/api/me', { token: idToken });
      setAccountUser(data.user);
      setAuthError(null);
    } catch (err: any) {
      console.error('Failed to sync account profile:', err);
      setAccountUser(null);
      setAuthError(err?.message || 'Unable to verify your account profile.');
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        setPatientSession(null);
        await syncAccountProfile(user);
      } else {
        setAccountUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [syncAccountProfile]);

  const getToken = useCallback(async (): Promise<string | null> => {
    if (firebaseUser) {
      return firebaseUser.getIdToken();
    }
    if (patientSession) {
      return patientSession.token;
    }
    return null;
  }, [firebaseUser, patientSession]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      const credential = await signInWithPopup(auth, googleAuthProvider);
      setPatientSession(null);
      await syncAccountProfile(credential.user);
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') {
        return;
      }
      setAuthError(err?.message || 'Google sign-in failed. Please try again.');
    }
  }, [syncAccountProfile]);

  const startPatientOtpSession = useCallback((session: PatientOtpSession) => {
    setAuthError(null);
    setPatientSession(session);
  }, []);

  const logout = useCallback(async () => {
    setPatientSession(null);
    setAccountUser(null);
    setAuthError(null);
    if (auth.currentUser) {
      await signOut(auth);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (firebaseUser) {
      await syncAccountProfile(firebaseUser);
    }
  }, [firebaseUser, syncAccountProfile]);

  return (
    <AuthContext.Provider
      value={{
        loading,
        firebaseUser,
        accountUser,
        patientSession,
        authError,
        getToken,
        signInWithGoogle,
        startPatientOtpSession,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
