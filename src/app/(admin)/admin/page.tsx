
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ConventionManager from "@/components/admin/table-manager";
import { Button } from "@/components/ui/button";
import { ShieldCheck, DownloadCloud, Loader2, ListChecks, Settings2, PlayCircle, XCircle, Users2, RefreshCw } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { syncBilletwebParticipants } from "@/ai/flows/sync-billetweb-participants-flow";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ParticipantList from "@/components/admin/participant-list";
import { getRegistrationControl, updateRegistrationControl } from "@/lib/data";
import type { ManualRegistrationControls, TicketType } from "@/lib/types"; 
import { REGISTRATION_SCHEDULE } from "@/lib/types"; 


export default function AdminPage() {
  const [isSyncingBilletweb, setIsSyncingBilletweb] = useState(false);
  const [activeBilletwebTab, setActiveBilletwebTab] = useState("sync");
  const { toast } = useToast();

  const [registrationControls, setRegistrationControls] = useState<ManualRegistrationControls | null>(null);
  const [isUpdatingControls, setIsUpdatingControls] = useState(false);
  const [isRefreshingControls, setIsRefreshingControls] = useState(false); // New state for refresh button

  const fetchControls = useCallback(async () => {
    // Determine if this call is from the refresh button or initial load/update
    const isManualRefresh = isRefreshingControls; 
    if (!isManualRefresh) setIsUpdatingControls(true); // Show loader on phase change buttons
    else setIsRefreshingControls(true); // Show loader on refresh button

    try {
      const controls = await getRegistrationControl();
      setRegistrationControls(controls);
      if (isManualRefresh) {
        toast({ title: "Contrôles actualisés", description: "L'état des phases d'inscription a été rechargé." });
      }
    } catch (error) {
      toast({ 
        variant: "destructive", 
        title: "Erreur de chargement des contrôles", 
        description: error instanceof Error ? error.message : "Impossible de charger les contrôles d'inscription."
      });
    } finally {
      if (!isManualRefresh) setIsUpdatingControls(false);
      else setIsRefreshingControls(false);
    }
  }, [toast, isRefreshingControls]); // Add isRefreshingControls to dependency array

  useEffect(() => {
    fetchControls();
  }, [fetchControls]); // Initial fetch

  const handleUpdateControls = async (phaseToOpen?: TicketType | 'reset') => {
    setIsUpdatingControls(true); // This state is for the phase change buttons specifically
    let newControls: Partial<ManualRegistrationControls> = {
        strategistManuallyOpen: registrationControls?.strategistManuallyOpen || false,
        marshalManuallyOpen: registrationControls?.marshalManuallyOpen || false,
        generalManuallyOpen: registrationControls?.generalManuallyOpen || false,
    };

    const currentControls = registrationControls || { strategistManuallyOpen: false, marshalManuallyOpen: false, generalManuallyOpen: false };

    if (phaseToOpen === 'reset') {
        newControls = { strategistManuallyOpen: false, marshalManuallyOpen: false, generalManuallyOpen: false };
    } else if (phaseToOpen === 'Stratège') {
        newControls.strategistManuallyOpen = !currentControls.strategistManuallyOpen;
        if (!newControls.strategistManuallyOpen) { 
            newControls.marshalManuallyOpen = false;
            newControls.generalManuallyOpen = false;
        }
    } else if (phaseToOpen === 'Maréchal') {
        newControls.marshalManuallyOpen = !currentControls.marshalManuallyOpen;
        if (newControls.marshalManuallyOpen) { 
            newControls.strategistManuallyOpen = true; 
        } else { 
            newControls.generalManuallyOpen = false; 
        }
    } else if (phaseToOpen === 'Général') {
        newControls.generalManuallyOpen = !currentControls.generalManuallyOpen;
        if (newControls.generalManuallyOpen) { 
            newControls.strategistManuallyOpen = true; 
            newControls.marshalManuallyOpen = true;
        }
    }

    try {
        await updateRegistrationControl(newControls);
        // After updating, fetch the controls again to ensure UI reflects the source of truth
        // This also resets registrationControls state correctly.
        await fetchControls(); 
        toast({ title: "Contrôles mis à jour", description: `Phase d'inscription ${phaseToOpen === 'reset' ? 'fermée (tous types)' : phaseToOpen } modifiée manuellement.` });
    } catch (error) {
        toast({ variant: "destructive", title: "Erreur de mise à jour", description: (error as Error).message });
         // If update fails, still refresh controls to show the actual current state from DB
        await fetchControls();
    } finally {
        setIsUpdatingControls(false);
    }
  };


  const handleSyncBilletweb = async () => {
    console.log('CLIENT BROWSER LOG: handleSyncBilletweb CALLED - Attempting to call syncBilletwebParticipants flow...');
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
          <div className="flex flex-row items-center justify-between">
            <div className="flex flex-row items-center gap-4">
                <ShieldCheck className="h-8 w-8 text-primary" />
                <div>
                <CardTitle>Administration</CardTitle>
                <CardDescription>Gérer les tables de jeu, les jeux et les paramètres de la convention.</CardDescription>
                </div>
            </div>
            {/* Removed global refresh button from here as it's too broad */}
          </div>
        </CardHeader>
        <CardContent className="pt-4">
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium flex items-center gap-2"><Settings2 className="h-4 w-4"/>Contrôle des Phases d'Inscription</h4>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => { setIsRefreshingControls(true); fetchControls(); }} // Set isRefreshingControls before calling
                        disabled={isUpdatingControls || isRefreshingControls}
                        className="shadow-sm rounded-md"
                    >
                        {isRefreshingControls ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4"/>}
                        Actualiser Contrôles
                    </Button>
                </div>
                 <p className="text-xs text-muted-foreground">
                    État actuel : <span className="font-semibold">{getPhaseStatusMessage()}</span>
                 </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                    <Button 
                        variant={registrationControls?.strategistManuallyOpen && !registrationControls.marshalManuallyOpen && !registrationControls.generalManuallyOpen ? "default" : "outline"}
                        onClick={() => handleUpdateControls('Stratège')} 
                        disabled={isUpdatingControls || isRefreshingControls || !!registrationControls?.marshalManuallyOpen || !!registrationControls?.generalManuallyOpen}
                        className="w-full"
                    >
                        {isUpdatingControls ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlayCircle className="mr-2 h-4 w-4"/>}
                        {strategistsButtonText()}
                    </Button>
                    <Button 
                        variant={registrationControls?.marshalManuallyOpen && !registrationControls.generalManuallyOpen ? "default" : "outline"}
                        onClick={() => handleUpdateControls('Maréchal')} 
                        disabled={isUpdatingControls || isRefreshingControls || !!registrationControls?.generalManuallyOpen}
                        className="w-full"
                    >
                        {isUpdatingControls ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlayCircle className="mr-2 h-4 w-4"/>}
                        {marshalsButtonText()}
                    </Button>
                    <Button 
                        variant={registrationControls?.generalManuallyOpen ? "default" : "outline"}
                        onClick={() => handleUpdateControls('Général')} 
                        disabled={isUpdatingControls || isRefreshingControls}
                        className="w-full"
                    >
                        {isUpdatingControls ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlayCircle className="mr-2 h-4 w-4"/>}
                        {generalsButtonText()}
                    </Button>
                    <Button 
                        variant="destructive" 
                        onClick={() => handleUpdateControls('reset')} 
                        disabled={isUpdatingControls || isRefreshingControls || (!registrationControls?.strategistManuallyOpen && !registrationControls?.marshalManuallyOpen && !registrationControls?.generalManuallyOpen)}
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
