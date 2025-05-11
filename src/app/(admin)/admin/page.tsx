
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ConventionManager from "@/components/admin/table-manager";
import { Button } from "@/components/ui/button";
import { ShieldCheck, DownloadCloud, Loader2, ListChecks } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { syncBilletwebParticipants } from "@/ai/flows/sync-billetweb-participants-flow";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ParticipantList from "@/components/admin/participant-list"; // New component

export default function AdminPage() {
  const [isSyncingBilletweb, setIsSyncingBilletweb] = useState(false);
  const [activeBilletwebTab, setActiveBilletwebTab] = useState("sync");
  const { toast } = useToast();

  const handleSyncBilletweb = async () => {
    setIsSyncingBilletweb(true);
    try {
      toast({
        title: "Synchronisation Billetweb en cours...",
        description: "Récupération des participants depuis Billetweb.",
      });
      const result = await syncBilletwebParticipants();
      if (result.error) {
        toast({
          variant: "destructive",
          title: "Erreur de synchronisation Billetweb",
          description: result.message,
        });
      } else {
        toast({
          title: "Synchronisation Billetweb terminée",
          description: `${result.message} (${result.participantsSynced} participant(s) traité(s)).`,
        });
      }
    } catch (error) {
      console.error("Erreur lors de l'appel du flux de synchronisation Billetweb:", error);
      let errorMessage = "Une erreur est survenue lors de la synchronisation.";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast({
        variant: "destructive",
        title: "Erreur de synchronisation Billetweb",
        description: errorMessage,
      });
    } finally {
      setIsSyncingBilletweb(false);
    }
  };

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

      <ConventionManager />

      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex flex-row items-center gap-4">
            <DownloadCloud className="h-8 w-8 text-primary" />
            <div>
              <CardTitle>Billetweb</CardTitle>
              <CardDescription>Gestion des participants de L'ASYNCONV</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeBilletwebTab} onValueChange={setActiveBilletwebTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="sync">Synchronisation</TabsTrigger>
              <TabsTrigger value="list" className="flex items-center gap-2">
                <ListChecks className="h-4 w-4" /> Liste des Participants
              </TabsTrigger>
            </TabsList>
            <TabsContent value="sync" className="mt-4">
              <CardDescription className="mb-4">Récupération des participants depuis la plateforme Billetweb.</CardDescription>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={handleSyncBilletweb}
                disabled={isSyncingBilletweb}
              >
                {isSyncingBilletweb ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <DownloadCloud className="mr-2 h-4 w-4" />
                )}
                Exécuter la synchronisation
              </Button>
            </TabsContent>
            <TabsContent value="list" className="mt-4">
              <ParticipantList />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
