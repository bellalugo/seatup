
'use client'; // Needed for hooks (useAuth, useRouter) and onClick

import Link from 'next/link';
import Image from 'next/image'; // Import Image component
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { ShieldCheck, LogIn, LogOut, Loader2 } from 'lucide-react'; // Import icons
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
      <div className="container mx-auto flex h-24 items-center justify-between px-4 md:px-6"> {/* Changed h-16 to h-24 */}
        <Link href="/" className="flex items-center gap-2 h-full py-1">
          <Image
            src="https://www.asynconv.fr/wp-content/uploads/2025/04/Signature_FR.jpg"
            alt="ASYNCONV Logo"
            width={1000} // Original width of the image
            height={328} // Original height of the image
            priority // Load logo quickly
            className="object-contain h-full w-auto" // Ensure image scales within its bounds
            data-ai-hint="brand logo"
          />
        </Link>
        <nav className="flex items-center gap-4">
           {/* Show Admin link only if user is logged in */}
           {user && (
             <Link href="/admin" className="flex items-center gap-1 text-sm text-primary-foreground hover:text-red-700 transition-colors font-bold" title="Espace Admin">
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
              className="text-primary-foreground hover:bg-primary/80 hover:text-red-700 font-bold"
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
              className="text-primary-foreground hover:bg-primary/80 hover:text-red-700"
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