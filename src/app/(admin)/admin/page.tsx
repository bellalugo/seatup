
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ConventionManager from "@/components/admin/table-manager";
import { Button } from "@/components/ui/button";
import Link from 'next/link';
import { ShieldCheck, Loader2, Settings2, PlayCircle, XCircle, RefreshCw, DatabaseZap, Utensils, Users, Archive, AlertTriangle, Eraser, Gauge, Trophy } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { getRegistrationControl, updateRegistrationControl, getRegistrations, getParticipants, getRootCollectionCounts, migrate2025DataToArchives, importGames2026, importAnimators2026, wipePlanningData, clearAllRegistrations, clearAllGameResults, assignTableNumbersByPublicationOrder, simulateTestRegistrations, getSlots } from "@/lib/data";
import type { ManualRegistrationControls, TicketType, ConventionDay, Registration, Participant, Slot } from "@/lib/types";
import { CONVENTION_DAYS } from "@/lib/types";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

// Tension de la salle : demande théorique (selon les billets vendus) vs capacité.
interface RoomTension {
  perHalfDay: { day: ConventionDay; session: string; capacity: number; tensionPct: number; belowFloor: boolean }[];
  expectedPerHalfDay: number;
  stratFloor: number;
  totalDemand: number;
  totalCapacity: number;
  globalPct: number;
}

export default function AdminPage() {
  const { toast } = useToast();

  const [registrationControls, setRegistrationControls] = useState<ManualRegistrationControls | null>(null);
  const [mealCounts, setMealCounts] = useState<Record<ConventionDay, DailyMealCounts> | null>(null);
  const [participantStats, setParticipantStats] = useState<Record<Exclude<TicketType, 'Invitation' | 'Animateur'>, ParticipantStats> | null>(null);
  const [roomTension, setRoomTension] = useState<RoomTension | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingControls, setIsUpdatingControls] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Archivage 2025 -> archives/2025/*
  const [rootCounts, setRootCounts] = useState<Record<string, number> | null>(null);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveConfirmText, setArchiveConfirmText] = useState('');

  // Import des jeux 2026
  const [isImportingGames, setIsImportingGames] = useState(false);
  const [isImportingAnimators, setIsImportingAnimators] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [isNumbering, setIsNumbering] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isClearingRegs, setIsClearingRegs] = useState(false);
  const [isClearingResults, setIsClearingResults] = useState(false);

  const calculateMealCounts = (registrations: Registration[], slots: Slot[]): Record<ConventionDay, DailyMealCounts> => {
    // 1. Décompte des participants (uniques par jour), à partir des inscriptions confirmées
    //    rattachées à un slot et aux jours couverts par ce slot.
    const dailyParticipants: Record<ConventionDay, Set<string>> = CONVENTION_DAYS.reduce((acc, day) => {
        acc[day] = new Set<string>();
        return acc;
    }, {} as Record<ConventionDay, Set<string>>);

    const slotsMap = new Map(slots.map(s => [s.id, s]));

    for (const reg of registrations) {
      if ((reg.status || 'confirmed') !== 'confirmed') continue;
      const slot = reg.slotId ? slotsMap.get(reg.slotId) : undefined;
      if (!slot) continue;
      for (const cell of slot.cells || []) {
        if (CONVENTION_DAYS.includes(cell.day)) {
          dailyParticipants[cell.day].add(reg.userId);
        }
      }
    }

    // 2. Décompte des animateurs (uniques par jour) : un animateur présent sur au moins
    //    un slot d'un jour donné = un repas ce jour-là (il mange une fois, quel que soit
    //    le nombre de créneaux/tables qu'il anime).
    const dailyAnimators: Record<ConventionDay, Set<string>> = CONVENTION_DAYS.reduce((acc, day) => {
        acc[day] = new Set<string>();
        return acc;
    }, {} as Record<ConventionDay, Set<string>>);

    for (const slot of slots) {
        const animator = slot.config?.authorAnimator;
        if (!animator) continue;
        for (const cell of slot.cells || []) {
            if (CONVENTION_DAYS.includes(cell.day)) {
                dailyAnimators[cell.day].add(animator);
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

  const calculateParticipantStats = (participants: Participant[], registrations: Registration[]): Record<Exclude<TicketType, 'Invitation' | 'Animateur'>, ParticipantStats> => {
    const ticketTypes: Exclude<TicketType, 'Invitation' | 'Animateur'>[] = ['Stratège', 'Maréchal', 'Général', 'Colonel'];
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

    return stats as Record<Exclude<TicketType, 'Invitation' | 'Animateur'>, ParticipantStats>;
  };

  // Demande théorique selon les billets (Stratège 10, Maréchal 8, Général 6, Colonel 4 demi-journées)
  // confrontée à la capacité (sièges hors animateur) de chaque demi-journée Matin/Après-midi.
  const calculateRoomTension = (participants: Participant[], slots: Slot[]): RoomTension => {
    const HALF_DAYS = ['Matin', 'Après-midi'];
    const counts: Record<string, number> = { 'Stratège': 0, 'Maréchal': 0, 'Général': 0, 'Colonel': 0 };
    participants.forEach(p => { if (counts[p.typeBillet] !== undefined) counts[p.typeBillet]++; });

    const expectedPerHalfDay = counts['Stratège'] * 1 + counts['Maréchal'] * 0.8 + counts['Général'] * 0.6 + counts['Colonel'] * 0.4;
    const stratFloor = counts['Stratège'];
    const totalDemand = counts['Stratège'] * 10 + counts['Maréchal'] * 8 + counts['Général'] * 6 + counts['Colonel'] * 4;

    const capacityAt = (day: ConventionDay, session: string) => slots
      .filter(s => (s.cells || []).some(c => c.day === day && c.session === session))
      .reduce((sum, s) => sum + Math.max(0, (s.config?.totalSeats || 0) - (s.config?.animatorPlays ? 1 : 0)), 0);

    const perHalfDay: RoomTension['perHalfDay'] = [];
    let totalCapacity = 0;
    CONVENTION_DAYS.forEach(day => HALF_DAYS.forEach(session => {
      const capacity = capacityAt(day, session);
      totalCapacity += capacity;
      perHalfDay.push({
        day, session, capacity,
        tensionPct: capacity > 0 ? Math.round((expectedPerHalfDay / capacity) * 100) : 0,
        belowFloor: capacity > 0 && capacity < stratFloor,
      });
    }));

    return {
      perHalfDay,
      expectedPerHalfDay: Math.round(expectedPerHalfDay),
      stratFloor,
      totalDemand,
      totalCapacity,
      globalPct: totalCapacity > 0 ? Math.round((totalDemand / totalCapacity) * 100) : 0,
    };
  };

  const fetchAdminData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const [controls, registrations, slots, participants, rCounts] = await Promise.all([
        getRegistrationControl(),
        getRegistrations(),
        getSlots(),
        getParticipants(),
        getRootCollectionCounts(),
      ]);

      setRegistrationControls(controls);
      setRootCounts(rCounts);

      const counts = calculateMealCounts(registrations, slots);
      setMealCounts(counts);

      const pStats = calculateParticipantStats(participants, registrations);
      setParticipantStats(pStats);

      setRoomTension(calculateRoomTension(participants, slots));

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
        colonelManuallyOpen: registrationControls?.colonelManuallyOpen || false,
    };

    const currentControls = registrationControls || { strategistManuallyOpen: false, marshalManuallyOpen: false, generalManuallyOpen: false, colonelManuallyOpen: false };

    // Cascade rules:
    //   - Opening a phase ALSO opens all higher-priority phases (Stratège > Maréchal > Général > Colonel).
    //   - Closing a phase ALSO closes all lower-priority phases.
    if (phaseToOpen === 'reset') {
        newControls = { strategistManuallyOpen: false, marshalManuallyOpen: false, generalManuallyOpen: false, colonelManuallyOpen: false };
    } else if (phaseToOpen === 'Stratège') {
        newControls.strategistManuallyOpen = !currentControls.strategistManuallyOpen;
        if (!newControls.strategistManuallyOpen) {
            // Closing Stratège closes all lower phases.
            newControls.marshalManuallyOpen = false;
            newControls.generalManuallyOpen = false;
            newControls.colonelManuallyOpen = false;
        }
    } else if (phaseToOpen === 'Maréchal') {
        newControls.marshalManuallyOpen = !currentControls.marshalManuallyOpen;
        if (newControls.marshalManuallyOpen) {
            newControls.strategistManuallyOpen = true; // Cascade up
        } else {
            // Closing Maréchal closes Général and Colonel.
            newControls.generalManuallyOpen = false;
            newControls.colonelManuallyOpen = false;
        }
    } else if (phaseToOpen === 'Général') {
        newControls.generalManuallyOpen = !currentControls.generalManuallyOpen;
        if (newControls.generalManuallyOpen) {
            newControls.strategistManuallyOpen = true;
            newControls.marshalManuallyOpen = true;
        } else {
            // Closing Général closes Colonel.
            newControls.colonelManuallyOpen = false;
        }
    } else if (phaseToOpen === 'Colonel') {
        newControls.colonelManuallyOpen = !currentControls.colonelManuallyOpen;
        if (newControls.colonelManuallyOpen) {
            // Opening Colonel opens everything (every grade can register).
            newControls.strategistManuallyOpen = true;
            newControls.marshalManuallyOpen = true;
            newControls.generalManuallyOpen = true;
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

  const handleArchive2025 = async () => {
    setIsArchiving(true);
    try {
        // L'archivage doit s'exécuter CÔTÉ CLIENT (dans le navigateur), où l'admin est
        // authentifié. La route API serveur n'a pas de session Firebase et serait refusée
        // par les règles Firestore (request.auth == null).
        const data = await migrate2025DataToArchives();
        const total = Object.values(data.summary || {}).reduce((acc: number, v) => acc + (Number(v) || 0), 0);
        toast({
            title: "Archivage 2025 terminé",
            description: `${total} document(s) déplacés sous archives/2025/*.`,
        });
        setIsArchiveDialogOpen(false);
        setArchiveConfirmText('');
        await fetchAdminData();
    } catch (error) {
        toast({
            variant: "destructive",
            title: "Échec de l'archivage",
            description: error instanceof Error ? error.message : "Erreur inconnue.",
        });
    } finally {
        setIsArchiving(false);
    }
  };

  const handleImportGames2026 = async () => {
    setIsImportingGames(true);
    try {
        // Exécution CÔTÉ CLIENT (admin authentifié) : la collection `games` exige request.auth != null.
        const { added, updated, skipped } = await importGames2026();
        const parts = [`${added} ajouté(s)`];
        if (updated > 0) parts.push(`${updated} image(s) complétée(s)`);
        if (skipped > 0) parts.push(`${skipped} déjà à jour`);
        toast({
            title: "Import des jeux 2026 terminé",
            description: parts.join(', ') + '.',
        });
        await fetchAdminData();
    } catch (error) {
        toast({
            variant: "destructive",
            title: "Échec de l'import des jeux 2026",
            description: error instanceof Error ? error.message : "Erreur inconnue.",
        });
    } finally {
        setIsImportingGames(false);
    }
  };

  const handleSimulate = async () => {
    if (!window.confirm("Générer des inscriptions de TEST ?\n\nCela EFFACE toutes les inscriptions actuelles, puis remplit aléatoirement les slots (places + files d'attente) avec tes participants. Pour des tests uniquement.")) {
        return;
    }
    setIsSimulating(true);
    try {
        const res = await simulateTestRegistrations();
        toast({
            title: "Inscriptions de test générées",
            description: `${res.confirmed} inscription(s) sur ${res.slots} table(s).`,
        });
        await fetchAdminData();
    } catch (error) {
        toast({
            variant: "destructive",
            title: "Échec de la simulation",
            description: error instanceof Error ? error.message : "Erreur inconnue.",
        });
    } finally {
        setIsSimulating(false);
    }
  };

  const handleClearRegistrations = async () => {
    if (!window.confirm("Effacer toutes les inscriptions ?\n\nCela supprime les places et les files d'attente.\nLa grille (tables/slots), les jeux, configurations et participants sont conservés.")) {
        return;
    }
    setIsClearingRegs(true);
    try {
        const res = await clearAllRegistrations();
        toast({
            title: "Inscriptions effacées",
            description: `${res.registrations} inscription(s) supprimée(s). La grille est conservée.`,
        });
        await fetchAdminData();
    } catch (error) {
        toast({
            variant: "destructive",
            title: "Échec de l'effacement",
            description: error instanceof Error ? error.message : "Erreur inconnue.",
        });
    } finally {
        setIsClearingRegs(false);
    }
  };

  const handleClearResults = async () => {
    if (!window.confirm("Remettre le Hall of Fame à zéro ?\n\nCela supprime tous les résultats de parties enregistrés (vainqueurs et points).\nLes inscriptions, la grille et les participants sont conservés.")) {
        return;
    }
    setIsClearingResults(true);
    try {
        const res = await clearAllGameResults();
        toast({ title: "Hall of Fame réinitialisé", description: `${res.results} résultat(s) supprimé(s).` });
        await fetchAdminData();
    } catch (error) {
        toast({ variant: "destructive", title: "Échec", description: error instanceof Error ? error.message : "Erreur inconnue." });
    } finally {
        setIsClearingResults(false);
    }
  };

  const handleWipePlanning = async () => {
    if (!window.confirm("Réinitialiser le planning ?\n\nCela supprime DÉFINITIVEMENT toutes les tables (ancien modèle), tous les slots et toutes les inscriptions.\nLes jeux, configurations, animateurs et participants sont conservés.")) {
        return;
    }
    setIsWiping(true);
    try {
        const res = await wipePlanningData();
        toast({
            title: "Planning réinitialisé",
            description: `Supprimés : ${res.gameTables} table(s), ${res.slots} slot(s), ${res.registrations} inscription(s).`,
        });
        await fetchAdminData();
    } catch (error) {
        toast({
            variant: "destructive",
            title: "Échec de la réinitialisation",
            description: error instanceof Error ? error.message : "Erreur inconnue.",
        });
    } finally {
        setIsWiping(false);
    }
  };

  const handleNumberTables = async () => {
    setIsNumbering(true);
    try {
        const res = await assignTableNumbersByPublicationOrder();
        toast({
            title: "Tables numérotées",
            description: `${res.length} table(s) numérotée(s) par ordre de publication au programme.`,
        });
        await fetchAdminData();
    } catch (error) {
        toast({
            variant: "destructive",
            title: "Échec de la numérotation",
            description: error instanceof Error ? error.message : "Erreur inconnue.",
        });
    } finally {
        setIsNumbering(false);
    }
  };

  const handleImportAnimators2026 = async () => {
    setIsImportingAnimators(true);
    try {
        const { added, skipped } = await importAnimators2026();
        toast({
            title: "Import des animateurs terminé",
            description: `${added} ajouté(s)${skipped > 0 ? `, ${skipped} déjà présent(s)` : ''}.`,
        });
    } catch (error) {
        toast({
            variant: "destructive",
            title: "Échec de l'import des animateurs",
            description: error instanceof Error ? error.message : "Erreur inconnue.",
        });
    } finally {
        setIsImportingAnimators(false);
    }
  };

  const totalRootDocs = rootCounts
    ? Object.values(rootCounts).reduce((acc, v) => acc + (v > 0 ? v : 0), 0)
    : 0;
  const canArchive2025 = totalRootDocs > 0;

  const getPhaseStatusMessage = () => {
    if (!registrationControls) return "Chargement de l'état des phases...";

    if (registrationControls.colonelManuallyOpen) return "OUVERT MANUELLEMENT : Colonel, Général, Maréchal, Stratège.";
    if (registrationControls.generalManuallyOpen) return "OUVERT MANUELLEMENT : Général, Maréchal, Stratège. (Colonel fermé via contrôle manuel).";
    if (registrationControls.marshalManuallyOpen) return "OUVERT MANUELLEMENT : Maréchal, Stratège. (Général, Colonel fermés via contrôle manuel).";
    if (registrationControls.strategistManuallyOpen) return "OUVERT MANUELLEMENT : Stratège. (Maréchal, Général, Colonel fermés via contrôle manuel).";

    return "INSCRIPTIONS FERMÉES. (Contrôles manuels uniquement)";
  };

  const strategistsButtonText = () => {
    if (registrationControls?.colonelManuallyOpen) return "Stratèges (via Colonel)";
    if (registrationControls?.generalManuallyOpen) return "Stratèges (via Général)";
    if (registrationControls?.marshalManuallyOpen) return "Stratèges (via Maréchal)";
    if (registrationControls?.strategistManuallyOpen) return "Fermer Stratèges";
    return "Ouvrir Stratèges";
  };

  const marshalsButtonText = () => {
    if (registrationControls?.colonelManuallyOpen) return "Maréchaux (via Colonel)";
    if (registrationControls?.generalManuallyOpen) return "Maréchaux (via Général)";
    if (registrationControls?.marshalManuallyOpen) return "Fermer Maréchaux";
    return "Ouvrir Maréchaux";
  };

  const generalsButtonText = () => {
    if (registrationControls?.colonelManuallyOpen) return "Généraux (via Colonel)";
    if (registrationControls?.generalManuallyOpen) return "Fermer Généraux";
    return "Ouvrir Généraux";
  };

  const colonelsButtonText = () => {
    if (registrationControls?.colonelManuallyOpen) return "Fermer Colonels";
    return "Ouvrir Colonels";
  };

  const getTicketBadgeVariant = (ticketType: TicketType): "strategist" | "marshal" | "general" | "colonel" | "secondary" => {
    switch (ticketType) {
        case 'Stratège': return 'strategist';
        case 'Maréchal': return 'marshal';
        case 'Général': return 'general';
        case 'Colonel': return 'colonel';
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
            <div className="flex flex-col sm:flex-row gap-2">
                <Link href="/admin/archives-2025" passHref>
                    <Button variant="outline">
                        <Archive className="mr-2 h-4 w-4" />
                        Archives 2025
                    </Button>
                </Link>
                <Link href="/admin/billetweb" passHref>
                    <Button variant="outline">
                        <DatabaseZap className="mr-2 h-4 w-4" />
                        Consulter les données Billetweb
                    </Button>
                </Link>
            </div>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2">
                    <Button
                        variant={registrationControls?.strategistManuallyOpen && !registrationControls.marshalManuallyOpen && !registrationControls.generalManuallyOpen && !registrationControls.colonelManuallyOpen ? "default" : "outline"}
                        onClick={() => handleUpdateControls('Stratège')}
                        disabled={isUpdatingControls || isRefreshing || isLoading || !!registrationControls?.marshalManuallyOpen || !!registrationControls?.generalManuallyOpen || !!registrationControls?.colonelManuallyOpen}
                        className="w-full"
                    >
                        {isUpdatingControls ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlayCircle className="mr-2 h-4 w-4"/>}
                        {strategistsButtonText()}
                    </Button>
                    <Button
                        variant={registrationControls?.marshalManuallyOpen && !registrationControls.generalManuallyOpen && !registrationControls.colonelManuallyOpen ? "default" : "outline"}
                        onClick={() => handleUpdateControls('Maréchal')}
                        disabled={isUpdatingControls || isRefreshing || isLoading || !!registrationControls?.generalManuallyOpen || !!registrationControls?.colonelManuallyOpen}
                        className="w-full"
                    >
                        {isUpdatingControls ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlayCircle className="mr-2 h-4 w-4"/>}
                        {marshalsButtonText()}
                    </Button>
                    <Button
                        variant={registrationControls?.generalManuallyOpen && !registrationControls.colonelManuallyOpen ? "default" : "outline"}
                        onClick={() => handleUpdateControls('Général')}
                        disabled={isUpdatingControls || isRefreshing || isLoading || !!registrationControls?.colonelManuallyOpen}
                        className="w-full"
                    >
                        {isUpdatingControls ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlayCircle className="mr-2 h-4 w-4"/>}
                        {generalsButtonText()}
                    </Button>
                    <Button
                        variant={registrationControls?.colonelManuallyOpen ? "default" : "outline"}
                        onClick={() => handleUpdateControls('Colonel')}
                        disabled={isUpdatingControls || isRefreshing || isLoading}
                        className="w-full"
                    >
                        {isUpdatingControls ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlayCircle className="mr-2 h-4 w-4"/>}
                        {colonelsButtonText()}
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={() => handleUpdateControls('reset')}
                        disabled={isUpdatingControls || isRefreshing || isLoading || (!registrationControls?.strategistManuallyOpen && !registrationControls?.marshalManuallyOpen && !registrationControls?.generalManuallyOpen && !registrationControls?.colonelManuallyOpen)}
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {(['Stratège', 'Maréchal', 'Général', 'Colonel'] as const).map(type => (
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
                Décompte des repas : participants inscrits (comptés une fois par jour) + animateurs (un repas par animateur et par jour).
            </CardDescription>
        </CardHeader>
        <CardContent>
            {isLoading ? (
                <div className="flex items-center justify-center p-4">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <p>Chargement du décompte...</p>
                </div>
            ) : mealCounts ? (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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

      <Card className="shadow-lg">
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Gauge className="h-6 w-6 text-primary" /> Tension de la salle (théorique)
            </CardTitle>
            <CardDescription>
                Demande estimée selon les billets vendus (Stratège 10, Maréchal 8, Général 6, Colonel 4 demi-journées) confrontée à la capacité par demi-journée. Une tension basse = plus de fluidité pour organiser les tables.
            </CardDescription>
        </CardHeader>
        <CardContent>
            {isLoading || !roomTension ? (
                <div className="flex items-center justify-center p-4"><Loader2 className="mr-2 h-4 w-4 animate-spin" /><p>Calcul…</p></div>
            ) : (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                        <span>Occupation moyenne : <strong className={roomTension.globalPct >= 90 ? 'text-red-600' : roomTension.globalPct >= 70 ? 'text-amber-600' : 'text-green-600'}>{roomTension.globalPct}%</strong></span>
                        <span className="text-muted-foreground">Demande {roomTension.totalDemand} / capacité {roomTension.totalCapacity} sièges-demi-journées</span>
                        <span className="text-muted-foreground">Plancher Stratèges : {roomTension.stratFloor} sièges requis à chaque demi-journée</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {CONVENTION_DAYS.map(day => (
                            <div key={day} className="p-2 bg-muted/40 rounded-lg">
                                <p className="text-xs font-semibold text-center mb-1.5">{day}</p>
                                {roomTension.perHalfDay.filter(h => h.day === day).map(h => {
                                    const color = h.belowFloor ? 'bg-red-600' : h.tensionPct >= 90 ? 'bg-red-500' : h.tensionPct >= 70 ? 'bg-amber-500' : 'bg-green-500';
                                    return (
                                        <div key={h.session} className="mb-1.5 last:mb-0">
                                            <div className="flex justify-between text-[10px] text-muted-foreground"><span>{h.session === 'Après-midi' ? 'AM' : 'Mat.'}</span><span>{h.tensionPct}% · {h.capacity} pl.</span></div>
                                            <div className="h-2 w-full rounded-full bg-background overflow-hidden"><div className={`h-full ${color}`} style={{ width: `${Math.min(100, h.tensionPct)}%` }} /></div>
                                            {h.belowFloor && <p className="text-[9px] text-red-600 leading-tight">capacité &lt; Stratèges !</p>}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </CardContent>
      </Card>

      <Card className="shadow-lg border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Archive className="h-6 w-6 text-destructive" /> Archivage de l&apos;édition 2025
          </CardTitle>
          <CardDescription>
            Déplace toutes les données de l&apos;édition 2025 (games, gameTables, gameResults, registrations,
            liste_participants, system_settings) sous <code className="text-xs px-1 py-0.5 bg-muted rounded">archives/2025/*</code>,
            puis vide les collections racine pour repartir à zéro sur 2026.
            Action irréversible. À effectuer une seule fois, juste avant le démarrage de l&apos;édition 2026.
          </CardDescription>
        </CardHeader>
        <CardContent>
            {isLoading ? (
                <div className="flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Chargement…</div>
            ) : !canArchive2025 ? (
                <div className="flex items-start gap-2 p-3 bg-muted/40 rounded-md text-sm">
                    <Archive className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                    <span>
                        Les collections racine sont déjà vides : l&apos;archivage a soit déjà été effectué,
                        soit il n&apos;y a rien à archiver. Consulte les <Link href="/admin/archives-2025" className="underline">archives 2025</Link> pour vérifier.
                    </span>
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                        {rootCounts && Object.entries(rootCounts).map(([col, count]) => (
                            <div key={col} className="p-2 bg-muted/40 rounded">
                                <div className="font-mono text-muted-foreground">{col}</div>
                                <div className="font-bold text-base">{count >= 0 ? count : '?'} doc(s)</div>
                            </div>
                        ))}
                    </div>
                    <Button
                        variant="destructive"
                        onClick={() => setIsArchiveDialogOpen(true)}
                        disabled={isArchiving || isRefreshing || isLoading}
                    >
                        {isArchiving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Archive className="mr-2 h-4 w-4"/>}
                        Archiver l&apos;édition 2025 maintenant
                    </Button>
                </div>
            )}
        </CardContent>
      </Card>

      <Card className="shadow-lg border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DatabaseZap className="h-6 w-6 text-primary" /> Import des jeux 2026
          </CardTitle>
          <CardDescription>
            Crée les 17 jeux de l&apos;édition 2026 (issus de la page programme) dans la collection <code className="text-xs px-1 py-0.5 bg-muted rounded">games</code> :
            nom, description, nombre de joueurs et lien. Opération sans risque et ré-exécutable : un jeu déjà présent (même nom) est ignoré.
            Les visuels et les tables sont à compléter ensuite manuellement.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
            <Button
                onClick={handleImportGames2026}
                disabled={isImportingGames || isLoading}
            >
                {isImportingGames ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <DatabaseZap className="mr-2 h-4 w-4"/>}
                Importer les 17 jeux 2026
            </Button>
            <Button
                variant="outline"
                onClick={handleImportAnimators2026}
                disabled={isImportingAnimators || isLoading}
            >
                {isImportingAnimators ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Users className="mr-2 h-4 w-4"/>}
                Importer les animateurs
            </Button>
            <Button
                variant="outline"
                onClick={handleNumberTables}
                disabled={isNumbering || isLoading}
            >
                {isNumbering ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <DatabaseZap className="mr-2 h-4 w-4"/>}
                Numéroter les tables (ordre du programme)
            </Button>
            <Button
                variant="secondary"
                onClick={handleSimulate}
                disabled={isSimulating || isLoading}
            >
                {isSimulating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlayCircle className="mr-2 h-4 w-4"/>}
                Générer des inscriptions de test
            </Button>
            <Button
                variant="outline"
                onClick={handleClearRegistrations}
                disabled={isClearingRegs || isLoading}
            >
                {isClearingRegs ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Eraser className="mr-2 h-4 w-4"/>}
                Effacer les inscriptions (garder la grille)
            </Button>
            <Button
                variant="outline"
                onClick={handleClearResults}
                disabled={isClearingResults || isLoading}
            >
                {isClearingResults ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trophy className="mr-2 h-4 w-4"/>}
                Remettre le Hall of Fame à zéro
            </Button>
            <Button
                variant="destructive"
                onClick={handleWipePlanning}
                disabled={isWiping || isLoading}
            >
                {isWiping ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <AlertTriangle className="mr-2 h-4 w-4"/>}
                Réinitialiser le planning
            </Button>
        </CardContent>
      </Card>

      <AlertDialog open={isArchiveDialogOpen} onOpenChange={(open) => {
          setIsArchiveDialogOpen(open);
          if (!open) setArchiveConfirmText('');
      }}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" /> Confirmer l&apos;archivage 2025
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                    <div className="space-y-3">
                        <span className="block">
                            Cette action déplace <strong>{totalRootDocs} document(s)</strong> sous
                            <code className="ml-1 text-xs px-1 py-0.5 bg-muted rounded">archives/2025/*</code> et
                            vide les collections racine. Elle est <strong>irréversible</strong> via l&apos;interface.
                        </span>
                        <span className="block">
                            Pour confirmer, tape <code className="text-xs px-1 py-0.5 bg-muted rounded font-bold">ARCHIVER 2025</code> ci-dessous :
                        </span>
                        <input
                            type="text"
                            value={archiveConfirmText}
                            onChange={(e) => setArchiveConfirmText(e.target.value)}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            placeholder="ARCHIVER 2025"
                            autoFocus
                        />
                    </div>
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel disabled={isArchiving}>Annuler</AlertDialogCancel>
                <AlertDialogAction
                    onClick={(e) => { e.preventDefault(); handleArchive2025(); }}
                    disabled={isArchiving || archiveConfirmText !== 'ARCHIVER 2025'}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                    {isArchiving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Archive className="mr-2 h-4 w-4"/>}
                    Confirmer l&apos;archivage
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ConventionManager />
    </div>
  );
}
