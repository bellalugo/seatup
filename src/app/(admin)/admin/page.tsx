
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ConventionManager from "@/components/admin/table-manager";
import { Button } from "@/components/ui/button";
import Link from 'next/link';
import { ShieldCheck, Loader2, Settings2, PlayCircle, XCircle, RefreshCw, DatabaseZap, Utensils } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { getRegistrationControl, updateRegistrationControl, getRegistrations, getGameTables } from "@/lib/data";
import type { ManualRegistrationControls, TicketType, ConventionDay, Registration, GameTable } from "@/lib/types"; 
import { CONVENTION_DAYS } from "@/lib/types"; 

export default function AdminPage() {
  const { toast } = useToast();

  const [registrationControls, setRegistrationControls] = useState<ManualRegistrationControls | null>(null);
  const [mealCounts, setMealCounts] = useState<Record<ConventionDay, number> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingControls, setIsUpdatingControls] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const calculateMealCounts = (registrations: Registration[], tables: GameTable[]): Record<ConventionDay, number> => {
    const dailyParticipants: Record<ConventionDay, Set<string>> = {
      Jeudi: new Set<string>(),
      Vendredi: new Set<string>(),
      Samedi: new Set<string>(),
      Dimanche: new Set<string>(),
    };

    const tablesMap = new Map(tables.map(t => [t.id, t]));

    for (const reg of registrations) {
      const table = tablesMap.get(reg.tableId);
      if (table && table.timeSlotType !== 'Off') {
        for (const day of table.days) {
          if (CONVENTION_DAYS.includes(day)) {
            dailyParticipants[day].add(reg.userId);
          }
        }
      }
    }

    return {
      Jeudi: dailyParticipants.Jeudi.size,
      Vendredi: dailyParticipants.Vendredi.size,
      Samedi: dailyParticipants.Samedi.size,
      Dimanche: dailyParticipants.Dimanche.size,
    };
  };

  const fetchAdminData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const [controls, registrations, tables] = await Promise.all([
        getRegistrationControl(),
        getRegistrations(),
        getGameTables(),
      ]);
      
      setRegistrationControls(controls);
      
      const counts = calculateMealCounts(registrations, tables);
      setMealCounts(counts);

      if (isManualRefresh) {
        toast({ title: "Données actualisées", description: "L'état des inscriptions et le décompte des repas ont été rechargés." });
      }
    } catch (error) {
      toast({ 
        variant: "destructive", 
        title: "Erreur de chargement des données", 
        description: error instanceof Error ? error.message : "Impossible de charger les données d'administration."
      });
    } finally {
      if (isManualRefresh) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  }, [toast]);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

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
        await fetchAdminData(); 
        toast({ title: "Contrôles mis à jour", description: `Phase d'inscription ${phaseToOpen === 'reset' ? 'fermée (tous types)' : phaseToOpen } modifiée manuellement.` });
    } catch (error) {
        toast({ variant: "destructive", title: "Erreur de mise à jour", description: (error as Error).message });
        await fetchAdminData();
    } finally {
        setIsUpdatingControls(false);
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
            <Link href="/admin/billetweb" passHref>
                <Button variant="outline">
                    <DatabaseZap className="mr-2 h-4 w-4" />
                    Consulter les données Billetweb
                </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium flex items-center gap-2"><Settings2 className="h-4 w-4"/>Contrôle des Phases d'Inscription</h4>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => fetchAdminData(true)}
                        disabled={isUpdatingControls || isRefreshing || isLoading}
                        className="shadow-sm rounded-md"
                    >
                        {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4"/>}
                        Actualiser les Données
                    </Button>
                </div>
                 <p className="text-xs text-muted-foreground">
                    État actuel : <span className="font-semibold">{isLoading ? 'Chargement...' : getPhaseStatusMessage()}</span>
                 </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                    <Button 
                        variant={registrationControls?.strategistManuallyOpen && !registrationControls.marshalManuallyOpen && !registrationControls.generalManuallyOpen ? "default" : "outline"}
                        onClick={() => handleUpdateControls('Stratège')} 
                        disabled={isUpdatingControls || isRefreshing || isLoading || !!registrationControls?.marshalManuallyOpen || !!registrationControls?.generalManuallyOpen}
                        className="w-full"
                    >
                        {isUpdatingControls ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlayCircle className="mr-2 h-4 w-4"/>}
                        {strategistsButtonText()}
                    </Button>
                    <Button 
                        variant={registrationControls?.marshalManuallyOpen && !registrationControls.generalManuallyOpen ? "default" : "outline"}
                        onClick={() => handleUpdateControls('Maréchal')} 
                        disabled={isUpdatingControls || isRefreshing || isLoading || !!registrationControls?.generalManuallyOpen}
                        className="w-full"
                    >
                        {isUpdatingControls ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlayCircle className="mr-2 h-4 w-4"/>}
                        {marshalsButtonText()}
                    </Button>
                    <Button 
                        variant={registrationControls?.generalManuallyOpen ? "default" : "outline"}
                        onClick={() => handleUpdateControls('Général')} 
                        disabled={isUpdatingControls || isRefreshing || isLoading}
                        className="w-full"
                    >
                        {isUpdatingControls ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlayCircle className="mr-2 h-4 w-4"/>}
                        {generalsButtonText()}
                    </Button>
                    <Button 
                        variant="destructive" 
                        onClick={() => handleUpdateControls('reset')} 
                        disabled={isUpdatingControls || isRefreshing || isLoading || (!registrationControls?.strategistManuallyOpen && !registrationControls?.marshalManuallyOpen && !registrationControls?.generalManuallyOpen)}
                        className="w-full"
                    >
                        {isUpdatingControls ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <XCircle className="mr-2 h-4 w-4"/>}
                        Tout Fermer (Manuel)
                    </Button>
                </div>
            </div>
        </CardContent>
      </Card>
      
      <Card className="shadow-lg">
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Utensils className="h-6 w-6 text-primary" /> Décompte des Repas
            </CardTitle>
            <CardDescription>
                Nombre de repas à prévoir par jour, basé sur les inscriptions aux tables (hors créneaux 'Off'). Un participant est compté une seule fois par jour.
            </CardDescription>
        </CardHeader>
        <CardContent>
            {isLoading ? (
                <div className="flex items-center justify-center p-4">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <p>Chargement du décompte...</p>
                </div>
            ) : mealCounts ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {CONVENTION_DAYS.map(day => (
                        <div key={day} className="p-4 bg-muted/50 rounded-lg text-center shadow-inner">
                            <p className="text-sm font-medium text-muted-foreground">{day}</p>
                            <p className="text-4xl font-bold tracking-tight">{mealCounts[day]}</p>
                            <p className="text-xs text-muted-foreground">repas</p>
                        </div>
                    ))}
                </div>
            ) : (
                 <p className="text-center text-destructive p-4">Impossible de calculer le nombre de repas.</p>
            )}
        </CardContent>
      </Card>

      <ConventionManager />
    </div>
  );
}
