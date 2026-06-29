
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, ArrowLeft, DatabaseZap, CloudCog, Copy } from "lucide-react";
import type { BilletwebAttendee } from "@/lib/types";
import { syncParticipantsFromAttendees } from "@/lib/data";

export default function BilletwebPage() {
  const { toast } = useToast();
  const [billetwebAttendees, setBilletwebAttendees] = useState<BilletwebAttendee[] | null>(null);
  const [isFetchingBilletweb, setIsFetchingBilletweb] = useState(true); // Start as true
  const [billetwebError, setBilletwebError] = useState<string | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ added: number; updated: number } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const handleFetchBilletweb = async (isManualRefresh = false) => {
    setIsFetchingBilletweb(true);
    setBilletwebError(null);
    try {
      const response = await fetch('/api/sync-billetweb', { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Une erreur est survenue lors de la récupération.');
      }
      setBilletwebAttendees(data.attendees);
      if (isManualRefresh) {
        toast({
          title: 'Liste actualisée',
          description: `${data.attendees.length} participants récupérés depuis Billetweb.`,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Une erreur inconnue est survenue.";
      setBilletwebError(errorMessage);
      setBilletwebAttendees(null); // Clear data on error
      toast({
        variant: 'destructive',
        title: 'Échec de la récupération',
        description: errorMessage,
      });
    } finally {
      setIsFetchingBilletweb(false);
    }
  };

  useEffect(() => {
    handleFetchBilletweb(false);
  }, []);

  const handleSyncWithFirestore = async () => {
    setIsSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    try {
        // 1) Récupération des participants depuis Billetweb (côté serveur : clé secrète).
        const response = await fetch('/api/sync-billetweb', { method: 'POST' });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Échec de la récupération depuis Billetweb.');
        }
        // 2) Écriture dans Firestore CÔTÉ CLIENT (admin connecté) : conforme aux règles de sécurité.
        const result = await syncParticipantsFromAttendees(data.attendees || []);
        setSyncResult(result);
        setBilletwebAttendees(data.attendees);
        toast({
            title: 'Synchronisation terminée',
            description: `${result.added} participant(s) ajouté(s), ${result.updated} mis à jour.`,
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

  const handleCopy = async (text: string, label: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copié', description: `${label} copié dans le presse-papiers.` });
    } catch {
      toast({ variant: 'destructive', title: 'Échec de la copie', description: "Impossible de copier automatiquement." });
    }
  };

  const renderCopyable = (value: string | undefined | null, label: string) => (
    <div className="flex items-center gap-1.5">
      <span className="truncate">{value || '–'}</span>
      {value && (
        <button
          type="button"
          onClick={() => handleCopy(value, label)}
          className="text-muted-foreground hover:text-foreground shrink-0"
          title={`Copier ${label.toLowerCase()}`}
          aria-label={`Copier ${label.toLowerCase()}`}
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );

  const getBadgeVariantFromTicket = (ticketName: string | null | undefined): "strategist" | "marshal" | "general" | "colonel" | "animator" | "staff" | "secondary" => {
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
    if (lowerCaseTicket.includes('colonel')) {
        return 'colonel';
    }
    if (lowerCaseTicket.includes('auteur') || lowerCaseTicket.includes('animateur')) {
        return 'animator';
    }
    if (lowerCaseTicket.includes('staff')) {
        return 'staff';
    }
    return 'secondary';
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2"><DatabaseZap className="h-6 w-6 text-primary"/>Synchronisation Billetweb</CardTitle>
              <CardDescription>
                Mettre à jour la base de données des participants avec les dernières informations de Billetweb.
                <br/>
                La liste ci-dessous montre un aperçu des données qui seront utilisées pour la synchronisation.
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
        <CardContent className="space-y-6">
            <div>
                <h3 className="text-lg font-medium mb-2">1. Lancer la synchronisation</h3>
                 <p className="text-sm text-muted-foreground mb-4">
                    Cette action ajoutera les nouveaux participants et mettra à jour les informations (nom, prénom, type de billet) des participants existants dans Firestore.
                </p>
                <Button onClick={handleSyncWithFirestore} disabled={isSyncing || isFetchingBilletweb}>
                    {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CloudCog className="mr-2 h-4 w-4" />}
                    Mettre à jour la base de données locale
                </Button>
                {(syncResult || syncError) && (
                    <div className="text-sm mt-2">
                        {syncError && <p className="text-destructive">Erreur : {syncError}</p>}
                        {syncResult && <p className="text-muted-foreground">Résultat : {syncResult.added} ajouté(s), {syncResult.updated} mis(s) à jour.</p>}
                    </div>
                )}
            </div>
            
            <Separator />

            <div>
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-lg font-medium">2. Aperçu des données Billetweb</h3>
                        <p className="text-sm text-muted-foreground">Voici les données actuellement présentes sur le serveur de Billetweb.</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleFetchBilletweb(true)} disabled={isFetchingBilletweb}>
                        {isFetchingBilletweb ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Actualiser la liste
                    </Button>
                </div>

                {isFetchingBilletweb && (
                    <div className="flex items-center justify-center p-4">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        <p>Chargement des données Billetweb...</p>
                    </div>
                )}

                {billetwebError && !isFetchingBilletweb && (
                     <div className="text-center p-4 border border-destructive/20 bg-destructive/10 rounded-md">
                        <p className="text-sm font-medium text-destructive">Erreur de chargement des données</p>
                        <p className="text-xs text-destructive/80">{billetwebError}</p>
                    </div>
                )}

                {billetwebAttendees && !isFetchingBilletweb && (
                    <div className="border rounded-md max-h-[60vh] overflow-y-auto">
                        <Table>
                           <TableHeader>
                                <TableRow>
                                    <TableHead>Prénom</TableHead>
                                    <TableHead>Nom</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Numéro de billet</TableHead>
                                    <TableHead>Type de Billet</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {billetwebAttendees.length > 0 ? (
                                    billetwebAttendees.map(attendee => (
                                        <TableRow key={attendee.id}>
                                            <TableCell>{attendee.firstname}</TableCell>
                                            <TableCell>{attendee.name}</TableCell>
                                            <TableCell>{renderCopyable(attendee.email, 'Email')}</TableCell>
                                            <TableCell>{renderCopyable(attendee.ext_id, 'Numéro de billet')}</TableCell>
                                            <TableCell>
                                                <Badge variant={getBadgeVariantFromTicket(attendee.ticket)}>
                                                    {attendee.ticket || 'N/A'}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center">Aucun participant trouvé sur Billetweb.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}

                {billetwebAttendees && billetwebAttendees.length > 0 && !isFetchingBilletweb && (
                    <details className="mt-3 text-xs">
                        <summary className="cursor-pointer text-muted-foreground">Voir les données brutes d&apos;un participant (diagnostic : tous les champs renvoyés par Billetweb)</summary>
                        <pre className="mt-2 p-3 bg-muted rounded-md overflow-auto max-h-72 whitespace-pre-wrap break-all">{JSON.stringify(billetwebAttendees[0], null, 2)}</pre>
                    </details>
                )}
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
