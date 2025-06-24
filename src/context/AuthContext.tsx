
'use client';

import type { User as FirebaseUser } from 'firebase/auth';
import { onAuthStateChanged, signOut as firebaseSignOut, signInAnonymously } from 'firebase/auth';
import * as React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '@/firebase/clientApp'; // Ensure Firebase is initialized

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
    // onAuthStateChanged will automatically handle signing the user in
    // as an anonymous user after they sign out.
    await firebaseSignOut(auth);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // User is signed in, either as an admin or anonymously.
        setUser(currentUser);
        setLoading(false);
      } else {
        // No user is signed in, so we sign them in anonymously.
        try {
          await signInAnonymously(auth);
          // The onAuthStateChanged listener will be called again with the
          // new anonymous user, at which point the 'if (currentUser)' block
          // will run. We don't need to set state here.
        } catch (error) {
            console.error("Erreur de connexion anonyme:", error);
            setLoading(false); // Stop loading even if anonymous sign-in fails
        }
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

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
