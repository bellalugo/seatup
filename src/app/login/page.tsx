
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
  const [email, setEmail] = useState('admin@example.com'); // Default admin email
  const [password, setPassword] = useState('admin123'); // Default admin password
  const [showPassword, setShowPassword] = useState(false); // State for password visibility
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
      toast({ title: 'Login Successful', description: 'Redirecting to admin...' });
      router.push('/admin'); // Redirect to admin page on successful login
    } catch (err) {
      console.error('Login failed:', err);
      let errorMessage = 'Login failed. Please check your credentials.';
      // Improve error messages based on Firebase error codes if needed
      if (err instanceof Error) {
        // Example: Customize based on common Firebase Auth error codes
        if ('code' in err) {
           const firebaseError = err as { code: string; message: string };
           if (firebaseError.code === 'auth/user-not-found' || firebaseError.code === 'auth/wrong-password' || firebaseError.code === 'auth/invalid-credential') {
             errorMessage = 'Invalid email or password.';
           } else if (firebaseError.code === 'auth/invalid-email') {
              errorMessage = 'Invalid email format.';
           } else if (firebaseError.code === 'auth/invalid-api-key') {
             errorMessage = 'Firebase API key is invalid. Please check configuration.';
           }
        }
      }
      setError(errorMessage);
      toast({ variant: 'destructive', title: 'Login Error', description: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };


  return (
    <div className="flex justify-center items-center py-12">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
           <div className="mx-auto bg-primary rounded-full p-3 w-fit mb-4">
             <LogIn className="h-6 w-6 text-primary-foreground" />
           </div>
          <CardTitle>Admin Login</CardTitle>
          <CardDescription>Enter your credentials to access the admin area.</CardDescription>
           {/* Display default credentials for easy access during development/demo */}
           <CardDescription className="text-xs text-muted-foreground pt-2">
             (Demo: admin@example.com / admin123)
           </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'} // Dynamically set type
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="pr-10" // Add padding for the icon button
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                    onClick={togglePasswordVisibility}
                    disabled={loading}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                 <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Logging in...
                 </>
              ) : (
                 'Login'
              )}

            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
