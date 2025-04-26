
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

  React.useEffect(() => {
    if (!loading && !user) {
      // If not loading and no user is logged in, redirect to login
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
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
