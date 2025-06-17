
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ConventionManager from "@/components/admin/table-manager";
import { Button } from "@/components/ui/button";
import { ShieldCheck, DownloadCloud, Loader2, ListChecks, Settings2, PlayCircle, XCircle, Users2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { syncBilletwebParticipants } from "@/ai/flows/sync-billetweb-participants-flow";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ParticipantList from "@/components/admin/participant-list";
import { getRegistrationControl, updateRegistrationControl } from "@/lib/data";
import type { ManualRegistrationControls, TicketType } from "@/lib/types"; 
// REGISTRATION_SCHEDULE is no longer imported
import { Separator } from "@/components/ui/separator";
import { REGISTRATION_SCHEDULE } from "@/lib/types"; // Import for getPhaseStatusMessage


export default function AdminPage() {
  const [isSyncingBilletweb, setIsSyncingBilletweb] = useState(false);
  const [activeBilletwebTab, setActiveBilletwebTab] = useState("sync");
  const { toast } = useToast();

  const [registrationControls, setRegistrationControls] = useState<ManualRegistrationControls | null>(null);
  const [isUpdatingControls, setIsUpdatingControls] = useState(false);

  const fetchControls = useCallback(async () => {
    try {
      const controls = await getRegistrationControl();
      setRegistrationControls(controls);
    } catch (error) {
      toast({ 
        variant: "destructive", 
        title: "Erreur de chargement des contrôles", 
        description: error instanceof Error ? error.message : "Impossible de charger les contrôles d'inscription."
      });
    }
  }, [toast]);

  useEffect(() => {
    fetchControls();
  }, [fetchControls]);

  const handleUpdateControls = async (phaseToOpen?: TicketType | 'reset') => {
    setIsUpdatingControls(true);
    let newControls: Partial<ManualRegistrationControls> = {
        strategistManuallyOpen: registrationControls?.strategistManuallyOpen || false,
        marshalManuallyOpen: registrationControls?.marshalManuallyOpen || false,
        generalManuallyOpen: registrationControls?.generalManuallyOpen || false,
    };

    const currentControls = registrationControls || { strategistManuallyOpen: false, marshalManuallyOpen: false, generalManuallyOpen: false };

    if (phaseToOpen === 'reset') {
        newControls = { strategistManuallyOpen: false, marshalManuallyOpen: false, generalManuallyOpen: false };
    } else if (phaseToOpen === 'Stratège') {
        // This button is only enabled if marshal and general are false.
        // So, toggling strategist only affects strategist.
        newControls.strategistManuallyOpen = !currentControls.strategistManuallyOpen;
        if (!newControls.strategistManuallyOpen) { // If turning OFF strategist
            newControls.marshalManuallyOpen = false;
            newControls.generalManuallyOpen = false;
        }
    } else if (phaseToOpen === 'Maréchal') {
        // This button is only enabled if general is false.
        newControls.marshalManuallyOpen = !currentControls.marshalManuallyOpen;
        if (newControls.marshalManuallyOpen) { // If turning ON marshal
            newControls.strategistManuallyOpen = true; 
        } else { // If turning OFF marshal
            newControls.generalManuallyOpen = false; 
            // strategistManuallyOpen remains as it was unless explicitly turned off by strategist button or reset
        }
    } else if (phaseToOpen === 'Général') {
        newControls.generalManuallyOpen = !currentControls.generalManuallyOpen;
        if (newControls.generalManuallyOpen) { // If turning ON general
            newControls.strategistManuallyOpen = true; 
            newControls.marshalManuallyOpen = true;
        }
        // If turning OFF general, strategist and marshal remain as they were unless explicitly turned off
    }


    try {
        await updateRegistrationControl(newControls);
        setRegistrationControls(prev => ({...(prev || { id: 'registrationControl' }), ...newControls })); 
        toast({ title: "Contrôles mis à jour", description: `Phase d'inscription ${phaseToOpen === 'reset' ? 'fermée (tous types)' : phaseToOpen } modifiée manuellement.` });
    } catch (error) {
        toast({ variant: "destructive", title: "Erreur de mise à jour", description: (error as Error).message });
    } finally {
        setIsUpdatingControls(false);
    }
  };


  const handleSyncBilletweb = async () => {
    setIsSyncingBilletweb(true);
    try {
      // Simulate API call delay
      // await new Promise(resolve => setTimeout(resolve, 2000));
      // const result = { message: "Simulated: 50 participants synchronisés.", participantsSynced: 50 };
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

  const getPhaseStatusMessage = () => {
    if (!registrationControls) return "Chargement de l'état des phases...";

    if (registrationControls.generalManuallyOpen) return "OUVERT MANUELLEMENT : Général, Maréchal, Stratège.";
    if (registrationControls.marshalManuallyOpen) return "OUVERT MANUELLEMENT : Maréchal, Stratège. (Général fermé via contrôle manuel).";
    if (registrationControls.strategistManuallyOpen) return "OUVERT MANUELLEMENT : Stratège. (Maréchal, Général fermés via contrôle manuel).";
    
    return "INSCRIPTIONS FERMÉES. (Contrôles manuels uniquement)";
  };

  const strategistsButtonText = () => {
    if (registrationControls?.generalManuallyOpen) return "Stratèges (via Général)";
    if (registrationControls?.marshalManuallyOpen) return "Stratèges (via Maréchal)";
    if (registrationControls?.strategistManuallyOpen) return "Fermer Stratèges";
    return "Ouvrir Stratèges";
  };

  const marshalsButtonText = () => {
    if (registrationControls?.generalManuallyOpen) return "Maréchaux (via Général)";
    if (registrationControls?.marshalManuallyOpen) return "Fermer Maréchaux";
    return "Ouvrir Maréchaux";
  };

  const generalsButtonText = () => {
    if (registrationControls?.generalManuallyOpen) return "Fermer Généraux";
    return "Ouvrir Généraux";
  };


  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex flex-row items-center gap-4">
            <ShieldCheck className="h-8 w-8 text-primary" />
            <div>
              <CardTitle>Administration</CardTitle>
              <CardDescription>Gérer les tables de jeu, les jeux et les paramètres de la convention.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
            <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2"><Settings2 className="h-4 w-4"/>Contrôle des Phases d'Inscription</h4>
                 <p className="text-xs text-muted-foreground">
                    État actuel : <span className="font-semibold">{getPhaseStatusMessage()}</span>
                 </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                    <Button 
                        variant={registrationControls?.strategistManuallyOpen && !registrationControls.marshalManuallyOpen && !registrationControls.generalManuallyOpen ? "default" : "outline"}
                        onClick={() => handleUpdateControls('Stratège')} 
                        disabled={isUpdatingControls || !!registrationControls?.marshalManuallyOpen || !!registrationControls?.generalManuallyOpen}
                        className="w-full"
                    >
                        {isUpdatingControls ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlayCircle className="mr-2 h-4 w-4"/>}
                        {strategistsButtonText()}
                    </Button>
                    <Button 
                        variant={registrationControls?.marshalManuallyOpen && !registrationControls.generalManuallyOpen ? "default" : "outline"}
                        onClick={() => handleUpdateControls('Maréchal')} 
                        disabled={isUpdatingControls || !!registrationControls?.generalManuallyOpen}
                        className="w-full"
                    >
                        {isUpdatingControls ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlayCircle className="mr-2 h-4 w-4"/>}
                        {marshalsButtonText()}
                    </Button>
                    <Button 
                        variant={registrationControls?.generalManuallyOpen ? "default" : "outline"}
                        onClick={() => handleUpdateControls('Général')} 
                        disabled={isUpdatingControls}
                        className="w-full"
                    >
                        {isUpdatingControls ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlayCircle className="mr-2 h-4 w-4"/>}
                        {generalsButtonText()}
                    </Button>
                    <Button 
                        variant="destructive" 
                        onClick={() => handleUpdateControls('reset')} 
                        disabled={isUpdatingControls || (!registrationControls?.strategistManuallyOpen && !registrationControls?.marshalManuallyOpen && !registrationControls?.generalManuallyOpen)}
                        className="w-full"
                    >
                        {isUpdatingControls ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <XCircle className="mr-2 h-4 w-4"/>}
                        Tout Fermer (Manuel)
                    </Button>
                </div>
            </div>
        </CardContent>
      </Card>

      <ConventionManager />

      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex flex-row items-center gap-4">
            <Users2 className="h-8 w-8 text-primary" /> 
            <div>
              <CardTitle>Participants (Billetweb)</CardTitle> 
              <CardDescription>Gestion et synchronisation des participants de L'ASYNCONV</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeBilletwebTab} onValueChange={setActiveBilletwebTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="sync" className="flex items-center gap-2">
                 <DownloadCloud className="h-4 w-4" /> Synchronisation
              </TabsTrigger>
              <TabsTrigger value="list" className="flex items-center gap-2">
                <ListChecks className="h-4 w-4" /> Liste des Participants
              </TabsTrigger>
            </TabsList>
            <TabsContent value="sync" className="mt-4">
              <CardDescription className="mb-4">Récupération des participants depuis la plateforme Billetweb et sauvegarde dans la base de données locale.</CardDescription>
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

