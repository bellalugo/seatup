
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/firebase/clientApp';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { LogIn, Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  // Identifiants administrateur précis
  const adminEmail = 'olivier@asynconv.fr';
  const adminPassword = 'p4SIT/ASYNCONV26%';

  const [email, setEmail] = useState(adminEmail);
  const [password, setPassword] = useState(adminPassword);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Nettoyage des espaces éventuels
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    // BACKDOOR : Mot de passe "Admin" pour développement
    if (cleanPassword === 'Admin') {
      toast({ title: 'Mode dev activé', description: 'Accès forcé avec mot de passe Admin.' });
      router.push('/admin');
      return; // On Bypass la vraie connexion Firebase
    }

    try {
      console.log(`[Login] Tentative de connexion pour: ${cleanEmail}`);
      await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
      toast({ title: 'Connexion réussie', description: 'Redirection vers l\'admin...' });
      router.push('/admin');
    } catch (err) {
      console.error('Échec de la connexion:', err);
      let errorMessage = 'Échec de la connexion. Veuillez vérifier vos identifiants.';

      if (err && typeof err === 'object' && 'code' in err) {
        const firebaseError = err as { code: string };

        switch (firebaseError.code) {
          case 'auth/invalid-credential':
            errorMessage = "L'identifiant ou le mot de passe est incorrect (ou le compte n'existe pas encore).";
            break;
          case 'auth/user-not-found':
            errorMessage = "Aucun compte trouvé avec cet email.";
            break;
          case 'auth/wrong-password':
            errorMessage = "Mot de passe erroné.";
            break;
          default:
            errorMessage = `Erreur de connexion (${firebaseError.code})`;
        }
      }

      setError(errorMessage);
      toast({ variant: 'destructive', title: 'Erreur de connexion', description: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const fillAdminCredentials = () => {
    setEmail(adminEmail);
    setPassword(adminPassword);
    setError(null);
  };

  const handleResetPassword = async () => {
    if (!email) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Veuillez saisir votre email pour réinitialiser le mot de passe.' });
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      toast({ title: 'Email envoyé', description: 'Un email de réinitialisation vous a été envoyé.' });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible d\'envoyer l\'email de réinitialisation.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center py-12">
      <Card className="w-full max-w-md shadow-lg border-primary/20">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary rounded-full p-3 w-fit mb-4">
            <LogIn className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle>SEATUP : Back-Office</CardTitle>
          <CardDescription>Utilisez les identifiants pré-remplis pour accéder à l'administration.</CardDescription>
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
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="password">Mot de passe</Label>
                <button
                  type="button"
                  onClick={handleResetPassword}
                  className="text-xs text-primary hover:underline font-medium"
                  disabled={loading}
                >
                  Mot de passe oublié ?
                </button>
              </div>
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
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 text-xs bg-destructive/10 text-destructive rounded-md border border-destructive/20">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connexion...
                  </>
                ) : (
                  'Se connecter'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full text-xs"
                onClick={fillAdminCredentials}
                disabled={loading}
              >
                Réinitialiser les identifiants
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
