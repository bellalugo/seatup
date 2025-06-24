
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, ArrowLeft, DatabaseZap, CloudCog } from "lucide-react";
import type { BilletwebAttendee } from "@/lib/types";

export default function BilletwebPage() {
  const { toast } = useToast();
  const [billetwebAttendees, setBilletwebAttendees] = useState<BilletwebAttendee[] | null>(null);
  const [isFetchingBilletweb, setIsFetchingBilletweb] = useState(false);
  const [billetwebError, setBilletwebError] = useState<string | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ added: number; updated: number } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const handleFetchBilletweb = async () => {
    setIsFetchingBilletweb(true);
    setBilletwebError(null);
    setBilletwebAttendees(null);
    try {
      const response = await fetch('/api/sync-billetweb', { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Une erreur est survenue lors de la récupération.');
      }
      setBilletwebAttendees(data.attendees);
      toast({
        title: 'Liste récupérée',
        description: `${data.attendees.length} participants récupérés depuis Billetweb.`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Une erreur inconnue est survenue.";
      setBilletwebError(errorMessage);
      toast({
        variant: 'destructive',
        title: 'Échec de la récupération',
        description: errorMessage,
      });
    } finally {
      setIsFetchingBilletweb(false);
    }
  };

  const handleSyncWithFirestore = async () => {
    setIsSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    try {
        const response = await fetch('/api/sync-participants', { method: 'POST' });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Une erreur est survenue lors de la synchronisation.');
        }
        setSyncResult({ added: data.added, updated: data.updated });
        toast({
            title: 'Synchronisation terminée',
            description: `${data.added} participant(s) ajouté(s), ${data.updated} mis à jour.`,
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Une erreur inconnue est survenue.";
        setSyncError(errorMessage);
        toast({
            variant: 'destructive',
            title: 'Échec de la synchronisation',
            description: errorMessage,
        });
    } finally {
        setIsSyncing(false);
    }
  };

  const getBadgeVariantFromTicket = (ticketName: string | null | undefined): "strategist" | "marshal" | "general" | "secondary" => {
    if (!ticketName) return 'secondary';
    const lowerCaseTicket = ticketName.toLowerCase();
    if (lowerCaseTicket.includes('stratège')) {
        return 'strategist';
    }
    if (lowerCaseTicket.includes('maréchal')) {
        return 'marshal';
    }
    if (lowerCaseTicket.includes('général')) {
        return 'general';
    }
    return 'secondary';
  };

  return (
    <div className="space-y-6">
       <Card className="shadow-lg">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2"><DatabaseZap className="h-6 w-6 text-primary"/>Données Billetweb</CardTitle>
              <CardDescription>
                  Récupérer la liste des participants directement depuis Billetweb sans mettre à jour la base de données locale.
                  <br/>
                  Ceci est utile pour vérifier les données brutes ou débugger les problèmes de connexion.
              </CardDescription>
            </div>
            <Link href="/admin" passHref>
                <Button variant="outline">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Retour à l'admin
                </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
            <div className="flex flex-col space-y-4">
                <Button onClick={handleFetchBilletweb} disabled={isFetchingBilletweb}>
                    {isFetchingBilletweb ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Récupérer la liste des participants Billetweb
                </Button>
                {billetwebError && (
                    <p className="text-sm text-destructive">{billetwebError}</p>
                )}
                {billetwebAttendees && (
                    <div className="mt-4 border rounded-md max-h-[60vh] overflow-y-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Prénom</TableHead>
                                    <TableHead>Nom</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Type de Billet</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {billetwebAttendees.length > 0 ? (
                                    billetwebAttendees.map(attendee => (
                                        <TableRow key={attendee.id}>
                                            <TableCell>{attendee.firstname}</TableCell>
                                            <TableCell>{attendee.name}</TableCell>
                                            <TableCell>{attendee.email}</TableCell>
                                            <TableCell>
                                                <Badge variant={getBadgeVariantFromTicket(attendee.ticket)}>
                                                    {attendee.ticket || 'N/A'}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center">Aucun participant trouvé sur Billetweb.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>
        </CardContent>
      </Card>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CloudCog className="h-6 w-6 text-primary"/>Synchroniser la base de données</CardTitle>
          <CardDescription>
              Mettre à jour la base de données des participants sur Firestore avec les dernières informations de Billetweb.
              <br/>
              Cette action ajoutera les nouveaux participants et mettra à jour les informations (nom, prénom, type de billet) des participants existants.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <Button onClick={handleSyncWithFirestore} disabled={isSyncing}>
                {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DatabaseZap className="mr-2 h-4 w-4" />}
                Mettre à jour la base de données locale
            </Button>
        </CardContent>
        {(syncResult || syncError) && (
            <CardFooter className="text-sm">
                {syncError && <p className="text-destructive">Erreur : {syncError}</p>}
                {syncResult && <p className="text-muted-foreground">Résultat : {syncResult.added} ajouté(s), {syncResult.updated} mis(s) à jour.</p>}
            </CardFooter>
        )}
      </Card>
    </div>
  );
}
