
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ConventionManager from "@/components/admin/table-manager"; // Updated import name
import { Button } from "@/components/ui/button";
import { ShieldCheck, Ticket, ExternalLink } from "lucide-react"; // Example icon
import Link from "next/link";

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center gap-4">
          <ShieldCheck className="h-8 w-8 text-primary" />
          <div>
            <CardTitle>Administration</CardTitle>
            <CardDescription>Gérer les tables de jeu, les jeux et les paramètres de la convention.</CardDescription>
          </div>
        </CardHeader>
      </Card>

      <ConventionManager /> {/* Updated component name */}

      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex flex-row items-center gap-4">
            <Ticket className="h-8 w-8 text-primary" />
            <div>
              <CardTitle>Intégration Billetweb</CardTitle>
              <CardDescription>Consulter la plateforme Billetweb.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Link href="https://www.billetweb.fr/" passHref legacyBehavior>
            <a target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="w-full sm:w-auto">
                <ExternalLink className="mr-2 h-4 w-4" />
                Visiter Billetweb
              </Button>
            </a>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

