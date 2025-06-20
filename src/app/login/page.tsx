
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/firebase/clientApp';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { LogIn, Loader2, Eye, EyeOff } from 'lucide-react'; // Import icons

export default function LoginPage() {
  const [email, setEmail] = useState(''); // Default admin email REMOVED
  const [password, setPassword] = useState(''); // Default admin password REMOVED
  const [showPassword, setShowPassword] = useState(false); // State for password visibility
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    console.log(`Attempting login with email: ${email} and password: ${password ? '********' : '(empty)'}`);

    // --- IMPORTANT ---
    // 1. Check your .env.local file and Firebase Project settings.
    //    Ensure NEXT_PUBLIC_FIREBASE_API_KEY and other config variables are correctly set.
    //    The "auth/invalid-api-key" or "auth/api-key-not-valid" error means the key is missing or wrong.
    // 2. Ensure the user 'olivier@asynconv.fr' exists in your Firebase project's
    //    Authentication section and has the password 'p4SIT/ASYNCONV25%'.
    //    Firebase doesn't create users automatically. You might need to create this
    //    user manually in the Firebase console (Authentication -> Add user).
    // --- --- --- ---

    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({ title: 'Connexion réussie', description: 'Redirection vers l\'admin...' });
      router.push('/admin'); // Redirect to admin page on successful login
    } catch (err) {
      console.error('Échec de la connexion:', err);
      let errorMessage = 'Échec de la connexion. Veuillez vérifier vos identifiants ou la console pour plus de détails.';
      // Improve error messages based on Firebase error codes
      if (err instanceof Error) {
        // Check if the error object has a 'code' property (common in Firebase errors)
        if (typeof err === 'object' && err !== null && 'code' in err) {
           const firebaseError = err as { code: string; message: string }; // Type assertion
           switch (firebaseError.code) {
             case 'auth/user-not-found':
             case 'auth/wrong-password':
             case 'auth/invalid-credential': // Often covers both wrong email/password
               errorMessage = 'Identifiant ou mot de passe invalide.';
               break;
             case 'auth/invalid-email':
                errorMessage = 'Format d\'email invalide.'; // Adjusted for "Identifiant"
                break;
             case 'auth/invalid-api-key':
             case 'auth/api-key-not-valid': // Handle variations of the API key error
               errorMessage = 'La clé API Firebase est invalide. Veuillez vérifier la configuration dans .env.local et redémarrer le serveur.';
               break;
             case 'auth/network-request-failed':
                errorMessage = 'Erreur réseau. Veuillez vérifier votre connexion internet.';
                break;
              case 'auth/operation-not-allowed':
                 errorMessage = 'L\'authentification par email/mot de passe n\'est pas activée dans votre projet Firebase.'; // Adjusted
                 break;
             default:
                // Keep generic message but log the specific code
                console.error('Code d\'erreur Firebase Auth:', firebaseError.code);
                errorMessage = `Échec de la connexion (${firebaseError.code}). Veuillez vérifier les identifiants ou la console.`;
           }
        } else {
          // Generic error if no code is present
          errorMessage = err.message || errorMessage;
        }
      }
      setError(errorMessage);
      toast({ variant: 'destructive', title: 'Erreur de connexion', description: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  // Function to toggle password visibility
  const togglePasswordVisibility = () => {
    setShowPassword(prevShowPassword => !prevShowPassword);
  };


  return (
    <div className="flex justify-center items-center py-12">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
           <div className="mx-auto bg-primary rounded-full p-3 w-fit mb-4">
             <LogIn className="h-6 w-6 text-primary-foreground" />
           </div>
          <CardTitle>Connexion Admin</CardTitle>
          <CardDescription>Entrez vos identifiants pour accéder à l'espace admin.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label> {/* Changed from Email to Identifiant */}
              <Input
                id="email" // ID remains 'email' for signInWithEmailAndPassword which expects an email field
                type="email" // Changed from email to text, Firebase handles non-email format if allowed in project
                placeholder="exemple@domaine.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                aria-invalid={!!error}
                aria-describedby={error ? "login-error" : undefined}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="pr-10"
                    aria-invalid={!!error}
                    aria-describedby={error ? "login-error" : undefined}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                    onClick={togglePasswordVisibility}
                    disabled={loading}
                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    title={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
              </div>
            </div>
            {error && <p id="login-error" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                 <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connexion en cours...
                 </>
              ) : (
                 'Connexion'
              )}

            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

