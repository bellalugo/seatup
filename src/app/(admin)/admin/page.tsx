
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import TableManager from "@/components/admin/table-manager";
import { ShieldCheck } from "lucide-react"; // Example icon

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center gap-4">
          <ShieldCheck className="h-8 w-8 text-primary" />
          <div>
            <CardTitle>Administration</CardTitle>
            <CardDescription>Gérer les tables de jeu et les paramètres de la convention.</CardDescription>
          </div>
        </CardHeader>
      </Card>

      <TableManager />
    </div>
  );
}
