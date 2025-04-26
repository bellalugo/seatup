import Link from 'next/link';
import { Swords } from 'lucide-react'; // Example icon

export default function Header() {
  return (
    <header className="bg-primary text-primary-foreground shadow-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Swords className="h-6 w-6" />
          <h1 className="text-xl font-bold tracking-tight">ASYNCONV SIT</h1>
        </Link>
        {/* Add navigation or user info here if needed */}
      </div>
    </header>
  );
}
