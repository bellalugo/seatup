
'use client';

import type { User as FirebaseUser } from 'firebase/auth';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import * as React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '@/firebase/clientApp'; // Ensure Firebase is initialized
import { Loader2 } from 'lucide-react'; // Import Loader

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true); // Start loading until auth state is determined

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false); // Auth state determined
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  // By removing the full-page loader here, the app's skeleton (header, etc.)
  // can render immediately. Components that need auth state will use the
  // 'loading' value from the context to show their own loaders.
  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
