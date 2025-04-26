import Link from 'next/link';
import { Swords, ShieldCheck } from 'lucide-react'; // Import icons

export default function Header() {
  return (
    <header className="bg-primary text-primary-foreground shadow-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Swords className="h-6 w-6" />
          <h1 className="text-xl font-bold tracking-tight">ASYNCONV SIT</h1>
        </Link>
        <nav>
           <Link href="/admin" className="flex items-center gap-1 text-sm hover:text-accent transition-colors" title="Admin Area">
             <ShieldCheck className="h-4 w-4" />
             <span>Admin</span>
           </Link>
        </nav>
        {/* Add other navigation or user info here if needed */}
      </div>
    </header>
  );
}