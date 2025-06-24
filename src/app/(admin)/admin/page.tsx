
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ConventionManager from "@/components/admin/table-manager";
import { Button } from "@/components/ui/button";
import Link from 'next/link';
import { ShieldCheck, Loader2, Settings2, PlayCircle, XCircle, RefreshCw, DatabaseZap, Utensils, Users } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { getRegistrationControl, updateRegistrationControl, getRegistrations, getGameTables, getParticipants } from "@/lib/data";
import type { ManualRegistrationControls, TicketType, ConventionDay, Registration, GameTable, Participant } from "@/lib/types"; 
import { CONVENTION_DAYS } from "@/lib/types"; 
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

// Structure pour le décompte détaillé des repas
interface DailyMealCounts {
  participants: number;
  animators: number;
  total: number;
}

// Structure pour les statistiques de participation
interface ParticipantStats {
  total: number;
  registered: number;
  ratio: number;
}

export default function AdminPage() {
  const { toast } = useToast();

  const [registrationControls, setRegistrationControls] = useState<ManualRegistrationControls | null>(null);
  const [mealCounts, setMealCounts] = useState<Record<ConventionDay, DailyMealCounts> | null>(null);
  const [participantStats, setParticipantStats] = useState<Record<Exclude<TicketType, 'Invitation'>, ParticipantStats> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingControls, setIsUpdatingControls] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const calculateMealCounts = (registrations: Registration[], tables: GameTable[]): Record<ConventionDay, DailyMealCounts> => {
    // 1. Décompte des participants (uniques par jour)
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
    
    // 2. Décompte des animateurs (uniques par jour)
    const dailyAnimators: Record<ConventionDay, Set<string>> = {
        Jeudi: new Set<string>(),
        Vendredi: new Set<string>(),
        Samedi: new Set<string>(),
        Dimanche: new Set<string>(),
    };

    for (const table of tables) {
        if (table.authorAnimator && table.timeSlotType !== 'Off') {
            for (const day of table.days) {
                if (CONVENTION_DAYS.includes(day)) {
                    dailyAnimators[day].add(table.authorAnimator);
                }
            }
        }
    }

    // 3. Combinaison des résultats
    const finalCounts = {} as Record<ConventionDay, DailyMealCounts>;
    for (const day of CONVENTION_DAYS) {
        const participantCount = dailyParticipants[day].size;
        const animatorCount = dailyAnimators[day].size;
        finalCounts[day] = {
            participants: participantCount,
            animators: animatorCount,
            total: participantCount + animatorCount,
        };
    }
    
    return finalCounts;
  };

  const calculateParticipantStats = (participants: Participant[], registrations: Registration[]): Record<Exclude<TicketType, 'Invitation'>, ParticipantStats> => {
    const ticketTypes: Exclude<TicketType, 'Invitation'>[] = ['Stratège', 'Maréchal', 'Général'];
    const stats: Record<string, ParticipantStats> = {};

    ticketTypes.forEach(type => {
        stats[type] = { total: 0, registered: 0, ratio: 0 };
    });

    const registeredUserIds = new Set(registrations.map(reg => reg.userId));

    for (const participant of participants) {
        const pType = participant.typeBillet;
        if (ticketTypes.includes(pType as any)) {
            stats[pType].total++;
            if (registeredUserIds.has(participant.id)) {
                stats[pType].registered++;
            }
        }
    }

    ticketTypes.forEach(type => {
        const { total, registered } = stats[type];
        stats[type].ratio = total > 0 ? (registered / total) * 100 : 0;
    });

    return stats as Record<Exclude<TicketType, 'Invitation'>, ParticipantStats>;
  };

  const fetchAdminData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const [controls, registrations, tables, participants] = await Promise.all([
        getRegistrationControl(),
        getRegistrations(),
        getGameTables(),
        getParticipants(),
      ]);
      
      setRegistrationControls(controls);
      
      const counts = calculateMealCounts(registrations, tables);
      setMealCounts(counts);

      const pStats = calculateParticipantStats(participants, registrations);
      setParticipantStats(pStats);

      if (isManualRefresh) {
        toast({ title: "Données actualisées", description: "Les statistiques et décomptes ont été rechargés." });
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
  
  const getTicketBadgeVariant = (ticketType: TicketType): "strategist" | "marshal" | "general" | "secondary" => {
    switch (ticketType) {
        case 'Stratège': return 'strategist';
        case 'Maréchal': return 'marshal';
        case 'Général': return 'general';
        default: return 'secondary';
    }
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
                <Users className="h-6 w-6 text-primary" /> Statistiques des Inscriptions par Billet
            </CardTitle>
            <CardDescription>
                Taux d'inscription des participants aux tables de jeu, par type de billet (hors invitations/animateurs).
            </CardDescription>
        </CardHeader>
        <CardContent>
            {isLoading ? (
                <div className="flex items-center justify-center p-4">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <p>Chargement des statistiques...</p>
                </div>
            ) : participantStats ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {(['Stratège', 'Maréchal', 'Général'] as const).map(type => (
                        <div key={type} className="p-4 bg-muted/50 rounded-lg shadow-inner flex flex-col gap-2">
                            <Badge variant={getTicketBadgeVariant(type)} className="w-fit font-bold">{type}</Badge>
                            <div className="text-sm text-muted-foreground">
                                <span className="font-bold text-foreground text-lg">{participantStats[type].registered}</span> / {participantStats[type].total} participants inscrits
                            </div>
                            <Progress value={participantStats[type].ratio} className="h-2" />
                            <div className="text-xs font-semibold text-right text-muted-foreground">{Math.round(participantStats[type].ratio)}%</div>
                        </div>
                    ))}
                </div>
            ) : (
                 <p className="text-center text-destructive p-4">Impossible de calculer les statistiques des participants.</p>
            )}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Utensils className="h-6 w-6 text-primary" /> Décompte des Repas
            </CardTitle>
            <CardDescription>
                Décompte des repas participants (comptés une fois par jour) et animateurs (un par table par jour), hors créneaux 'Off'.
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
                        <div key={day} className="p-4 bg-muted/50 rounded-lg text-center shadow-inner flex flex-col">
                            <div className="flex-grow">
                                <p className="text-sm font-medium text-muted-foreground">{day}</p>
                                <p className="text-4xl font-bold tracking-tight">{mealCounts[day].total}</p>
                                <p className="text-xs text-muted-foreground">repas au total</p>
                            </div>
                            <div className="mt-2 pt-2 border-t">
                                <p className="text-xs text-muted-foreground">
                                    {mealCounts[day].participants} participant(s)
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {mealCounts[day].animators} animateur(s)
                                </p>
                            </div>
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
