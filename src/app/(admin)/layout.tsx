
'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Loader2 } from 'lucide-react'; // Import Loader

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  // IMPORTANT : les participants du salon sont connectés en ANONYME. Seul un vrai
  // compte (email/mot de passe, donc non anonyme) doit accéder au back-office.
  const isAdmin = !!user && !user.isAnonymous;

  React.useEffect(() => {
    if (!loading && !isAdmin) {
      // Pas connecté, ou simple visiteur anonyme -> redirection vers la connexion.
      router.replace('/login');
    }
  }, [isAdmin, loading, router]);

  if (loading || !isAdmin) {
    // Show loading indicator or nothing while checking auth/redirecting
    return (
        <div className="flex justify-center items-center min-h-[calc(100vh-10rem)]"> {/* Adjust height as needed */}
         <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }

  // If loading is finished and user exists, render the admin children
  return <>{children}</>;
}
