
'use client'; // Needed for hooks (useAuth, useRouter) and onClick

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Swords, ShieldCheck, LogIn, LogOut, Loader2 } from 'lucide-react'; // Import icons
import { useToast } from '@/hooks/use-toast';
import * as React from 'react'; // Import React for useState

export default function Header() {
  const { user, signOut, loading: authLoading } = useAuth();
  const [signOutLoading, setSignOutLoading] = React.useState(false); // Specific loading state for sign-out
  const router = useRouter();
  const { toast } = useToast();

  const handleSignOut = async () => {
    setSignOutLoading(true);
    try {
      await signOut();
      toast({ title: 'Déconnecté(e)', description: 'Vous avez été déconnecté(e) avec succès.' });
      router.push('/'); // Redirect to home page after logout
    } catch (error) {
      console.error("La déconnexion a échoué:", error);
      toast({ variant: 'destructive', title: 'Échec de la déconnexion', description: 'Impossible de vous déconnecter. Veuillez réessayer.' });
    } finally {
      setSignOutLoading(false);
    }
  };

  return (
    <header className="bg-primary text-primary-foreground shadow-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Swords className="h-6 w-6" />
          <h1 className="text-xl font-bold tracking-tight">ASYNCONV SIT</h1>
        </Link>
        <nav className="flex items-center gap-4">
           {/* Show Admin link only if user is logged in */}
           {user && (
             <Link href="/admin" className="flex items-center gap-1 text-sm hover:text-accent transition-colors" title="Espace Admin">
               <ShieldCheck className="h-4 w-4" />
               <span>Admin</span>
             </Link>
           )}

           {/* Authentication Buttons */}
           {authLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary-foreground"/> /* Show loader while checking auth */
           ) : user ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              disabled={signOutLoading}
              className="hover:bg-primary/80 hover:text-primary-foreground"
            >
              {signOutLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="mr-2 h-4 w-4" />
              )}
              Déconnexion
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/login')}
              className="hover:bg-primary/80 hover:text-primary-foreground"
            >
              <LogIn className="mr-2 h-4 w-4" />
              Connexion
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}

