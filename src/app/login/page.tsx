
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
import { LogIn, Loader2, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  // Les identifiants sont pré-remplis pour faciliter l'accès administrateur
  const [email, setEmail] = useState('olivier@asynconv.fr');
  const [password, setPassword] = useState('p4SIT/ASYNCONV25%');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({ title: 'Connexion réussie', description: 'Redirection vers l\'admin...' });
      router.push('/admin');
    } catch (err) {
      console.error('Échec de la connexion:', err);
      let errorMessage = 'Échec de la connexion. Veuillez vérifier vos identifiants.';
      if (err instanceof Error) {
        if (typeof err === 'object' && err !== null && 'code' in err) {
           const firebaseError = err as { code: string; message: string };
           switch (firebaseError.code) {
             case 'auth/user-not-found':
             case 'auth/wrong-password':
             case 'auth/invalid-credential':
               errorMessage = "L'identifiant ou le mot de passe est incorrect.";
               break;
             case 'auth/invalid-email':
                errorMessage = 'Format d\'email invalide.';
                break;
             case 'auth/network-request-failed':
                errorMessage = 'Erreur réseau. Veuillez vérifier votre connexion.';
                break;
             default:
                errorMessage = `Échec de la connexion (${firebaseError.code}).`;
           }
        }
      }
      setError(errorMessage);
      toast({ variant: 'destructive', title: 'Erreur de connexion', description: errorMessage });
    } finally {
      setLoading(false);
    }
  };

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
          <CardDescription>Les identifiants sont pré-remplis pour faciliter votre accès.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="exemple@domaine.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
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
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={togglePasswordVisibility}
                    disabled={loading}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
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
