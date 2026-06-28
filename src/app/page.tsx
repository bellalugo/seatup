
'use client';

import type React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from '@/hooks/use-toast';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import {
    getSlots,
    deleteSlot,
    setSlotStatus,
    getRegistrations,
    addSlotRegistration,
    updateRegistrationStatus,
    removeRegistration as removeRegistrationFromDb,
    canRegisterBasedOnTicket,
    verifyParticipantCredentials,
    getParticipants,
    getAllGameResults,
    getRegistrationControl,
} from '@/lib/data';
import type { GameTable, Slot, SlotCell, SessionType, User, Registration, Participant, GameResult, TicketType, ManualRegistrationControls, ConventionDay } from '@/lib/types';
import { CONVENTION_DAYS as APP_CONVENTION_DAYS, SESSIONS } from '@/lib/types';
import { exportPlanningPdf } from '@/lib/planning-pdf';
import { CalendarDays, Clock, CheckCircle, AlertCircle, Info, Loader2, Hash, UserCircle2, LogIn, LogOut, Mail, UserCheck, Trophy, BarChart3, Star, Dices, Ban, Sun, SunDim, Moon, Mic, Users, FileDown } from 'lucide-react';
import { TableSeats } from '@/components/salon/table-seats';
import { SlotPlayersDialog } from '@/components/salon/slot-players-dialog';
import { useAuth } from '@/context/AuthContext';

const conventionDaysConfig = [
    { name: 'Jeudi' as ConventionDay, date: '09/07', value: 'jeudi' },
    { name: 'Vendredi' as ConventionDay, date: '10/07', value: 'vendredi' },
    { name: 'Samedi' as ConventionDay, date: '11/07', value: 'samedi' },
    { name: 'Dimanche' as ConventionDay, date: '12/07', value: 'dimanche' },
    { name: 'Lundi' as ConventionDay, date: '13/07', value: 'lundi' }
];

// Maps the system date to the matching ConventionDay name (or null if outside the convention window).
// 2026-07-09 -> Jeudi, ..., 2026-07-13 -> Lundi.
const getCurrentLiveConventionDay = (): ConventionDay | null => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = now.getMonth() + 1;
    const dd = now.getDate();
    if (yyyy !== 2026 || mm !== 7) return null;
    switch (dd) {
        case 9:  return 'Jeudi';
        case 10: return 'Vendredi';
        case 11: return 'Samedi';
        case 12: return 'Dimanche';
        case 13: return 'Lundi';
        default: return null;
    }
};

interface LivePlayerScore {
  id: string;
  name: string;
  score: number;
}
interface RankedLivePlayer extends LivePlayerScore {
  rank: number;
}

interface TicketPhaseStatusInfo {
  ticketType: TicketType;
  text: string;
  variant: 'strategist' | 'marshal' | 'general' | 'colonel' | 'outline' | 'secondary';
  isOpen: boolean;
}


// Maps a SessionType (slot atomique) to a small icon + readable label for the salon section header.
const SESSION_HEADERS: Record<SessionType, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  'Matin': { label: 'Matin · 09h00–13h00', icon: Sun },
  'Après-midi': { label: 'Après-midi · 14h00–19h00', icon: SunDim },
  'Soir': { label: 'Soirée', icon: Moon },
};

export default function Home() {
  const { user: firebaseUser } = useAuth();
  const isAdmin = !!firebaseUser && !firebaseUser.isAnonymous;

  const [slots, setSlots] = useState<Slot[]>([]);
  const [registrations, setRegistrations] = useState<(Registration & {id: string})[]>([]);
  const [allParticipantsData, setAllParticipantsData] = useState<Participant[]>([]);
  const [gameResultsData, setGameResultsData] = useState<Map<string, GameResult>>(new Map());
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingRegistration, setIsSubmittingRegistration] = useState(false);
  const [tableToConfirm, setTableToConfirm] = useState<GameTable | null>(null);
  const [managedSlot, setManagedSlot] = useState<Slot | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const { toast } = useToast();

  const [emailInput, setEmailInput] = useState('');
  const [ticketInput, setTicketInput] = useState('');
  const [isLookingUpUser, setIsLookingUpUser] = useState(false);

  const [currentLiveConventionDay, setCurrentLiveConventionDay] = useState<ConventionDay | null>(null);
  const [topPlayersToday, setTopPlayersToday] = useState<RankedLivePlayer[]>([]);
  const [isLoadingLiveHof, setIsLoadingLiveHof] = useState(true);

  const [registrationControls, setRegistrationControls] = useState<ManualRegistrationControls | null>(null);
  const [ticketPhaseStatuses, setTicketPhaseStatuses] = useState<TicketPhaseStatusInfo[]>([]);

  const loadPageData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [
        fetchedSlots,
        fetchedRegistrations,
        fetchedAllParticipants,
        fetchedGameResults,
        fetchedRegistrationControls,
    ] = await Promise.all([
        getSlots(),
        getRegistrations(),
        getParticipants(),
        getAllGameResults(),
        getRegistrationControl(),
      ]);
      setSlots(fetchedSlots);
      setRegistrations(fetchedRegistrations);
      setAllParticipantsData(fetchedAllParticipants);
      setRegistrationControls(fetchedRegistrationControls);

      const resultsMap = new Map<string, GameResult>();
      fetchedGameResults.forEach(result => resultsMap.set(result.tableId, result));
      setGameResultsData(resultsMap);

    } catch (error) {
      console.error("Échec du chargement des données de la page:", error);
      toast({
        variant: "destructive",
        title: "Erreur de chargement des données",
        description: (error as Error).message || "Impossible de récupérer les données.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  useEffect(() => {
    const interval = setInterval(() => {
      getRegistrationControl().then(controls => {
        setRegistrationControls(controls);
      });
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (registrationControls) {
      const statuses: TicketPhaseStatusInfo[] = [];
      const isStrategistOpen = registrationControls.strategistManuallyOpen;
      statuses.push({
        ticketType: 'Stratège',
        text: `Stratège : ${isStrategistOpen ? 'Ouvert' : 'Fermé'}`,
        variant: isStrategistOpen ? 'strategist' : 'outline',
        isOpen: isStrategistOpen,
      });
      const isMarshalOpen = registrationControls.marshalManuallyOpen;
      statuses.push({
        ticketType: 'Maréchal',
        text: `Maréchal : ${isMarshalOpen ? 'Ouvert' : 'Fermé'}`,
        variant: isMarshalOpen ? 'marshal' : 'outline',
        isOpen: isMarshalOpen,
      });
      const isGeneralOpen = registrationControls.generalManuallyOpen;
      statuses.push({
        ticketType: 'Général',
        text: `Général : ${isGeneralOpen ? 'Ouvert' : 'Fermé'}`,
        variant: isGeneralOpen ? 'general' : 'outline',
        isOpen: isGeneralOpen,
      });
      const isColonelOpen = registrationControls.colonelManuallyOpen;
      statuses.push({
        ticketType: 'Colonel',
        text: `Colonel : ${isColonelOpen ? 'Ouvert' : 'Fermé'}`,
        variant: isColonelOpen ? 'colonel' : 'outline',
        isOpen: isColonelOpen,
      });
      setTicketPhaseStatuses(statuses);
    }
  }, [registrationControls]);

  useEffect(() => {
    // On attend uniquement la fin du chargement principal. S'il n'y a pas encore de participants,
    // de tables ou de résultats, on ne reste PAS bloqué sur le spinner : le bloc de calcul ci-dessous
    // est ignoré et l'on tombe sur setIsLoadingLiveHof(false), affichant l'état vide.
    if (isLoading) return;
    setIsLoadingLiveHof(true);
    // Dérive le jour courant à partir de la date système (null si hors période de convention).
    const liveDayName: ConventionDay | null = getCurrentLiveConventionDay();
    setCurrentLiveConventionDay(liveDayName);

    if (liveDayName && allParticipantsData.length > 0 && slots.length > 0 && gameResultsData.size > 0) {
        const playerScoresMap: Map<string, { id: string, name: string, score: number }> = new Map();
        allParticipantsData.forEach(p => {
            if (p.typeBillet !== 'Invitation') {
                const formattedName = `${p.prenom || ''} ${p.nom ? p.nom.charAt(0) + '.' : ''}`.trim();
                playerScoresMap.set(p.id, { id: p.id, name: formattedName, score: 0 });
            }
        });
        const slotsMap = new Map(slots.map(s => [s.id, s]));
        Array.from(gameResultsData.values()).forEach(result => {
            const slot = slotsMap.get(result.tableId);
            if (!slot || !(slot.cells || []).some(c => c.day === liveDayName)) return;
            const pointsPerWin = result.playersInGame >= 5 ? 2 : 1;
            result.winnerIds.forEach(winnerId => {
                const playerData = playerScoresMap.get(winnerId);
                if (playerData) playerData.score += pointsPerWin;
            });
        });
        const rankedToday = Array.from(playerScoresMap.values())
            .filter(p => p.score > 0) 
            .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)) 
            .slice(0, 5) 
            .map((player, index) => ({ ...player, rank: index + 1 }));
        setTopPlayersToday(rankedToday);
    }
    setIsLoadingLiveHof(false);
  }, [isLoading, allParticipantsData, slots, gameResultsData]);

  const handleUserLookup = async () => {
    if (!emailInput.trim() || !ticketInput.trim()) {
      toast({ variant: "destructive", title: "Champs requis", description: "Saisissez votre email et votre numéro de billet." });
      return;
    }
    setIsLookingUpUser(true);
    setCurrentUser(null);
    try {
      const participant = await verifyParticipantCredentials(emailInput.trim(), ticketInput.trim());
      if (participant) {
        const formattedName = `${participant.prenom || ''} ${participant.nom ? participant.nom.charAt(0) + '.' : ''}`.trim();
        setCurrentUser({
          id: participant.id,
          name: formattedName,
          ticketType: participant.typeBillet,
          email: participant.email
        });
        toast({ title: "Participant trouvé", description: `Bienvenue ${formattedName} !` });
      } else {
        toast({ variant: "destructive", title: "Connexion refusée", description: "Email ou numéro de billet incorrect." });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Vérification impossible.";
      toast({ variant: "destructive", title: "Erreur", description: msg });
    } finally {
      setIsLookingUpUser(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setEmailInput('');
    setTicketInput('');
  };

  // --- Helpers slots ---
  const confirmedRegsForSlot = (slotId: string) =>
    registrations.filter(r => r.slotId === slotId && (r.status || 'confirmed') === 'confirmed');

  const seatsForSlot = (slot: Slot) => {
    const total = slot.config?.totalSeats || 0;
    const animatorSeat = slot.config?.animatorPlays ? 1 : 0;
    const occupied = confirmedRegsForSlot(slot.id).length + animatorSeat;
    return { total, available: Math.max(0, total - occupied) };
  };

  // Cellules déjà occupées par les inscriptions confirmées d'un joueur (hors slot exclu).
  const userOccupiedCells = (userId: string, exceptSlotId?: string): Set<string> => {
    const set = new Set<string>();
    registrations
      .filter(r => r.userId === userId && r.slotId && r.slotId !== exceptSlotId)
      .forEach(r => {
        const s = slots.find(x => x.id === r.slotId);
        (s?.cells || []).forEach(c => set.add(`${c.day}|${c.session}`));
      });
    return set;
  };

  const slotConflictsForUser = (slot: Slot, userId: string): boolean => {
    const occ = userOccupiedCells(userId, slot.id);
    return (slot.cells || []).some(c => occ.has(`${c.day}|${c.session}`));
  };

  // Construit une "carte" compatible SalonTableCard à partir d'un slot, pour une cellule donnée.
  const slotToCard = (slot: Slot, cell: SlotCell): GameTable => ({
    id: slot.id,
    gameId: slot.config?.gameId || '',
    days: [cell.day],
    timeSlotType: cell.session as unknown as GameTable['timeSlotType'],
    totalSeats: slot.config?.totalSeats || 1,
    tableNumber: slot.config?.gameTableNumber || '',
    tableShape: slot.config?.tableShape,
    authorAnimator: slot.config?.authorAnimator,
    animatorPlays: slot.config?.animatorPlays,
    status: slot.status,
    gameName: slot.config?.gameName,
    gameImageUrl: slot.config?.gameImageUrl,
    imageUrl: slot.config?.gameImageUrl,
  });

  const cellsLabel = (slot: Slot) => (slot.cells || []).map(c => `${c.day} ${c.session}`).join(', ');

  const myRegForSlot = (slotId: string) =>
    currentUser ? registrations.find(r => r.slotId === slotId && r.userId === currentUser.id) : undefined;

  // Admin/animateur : statut de la partie (Ouverte / EnCours / Terminée).
  const handleSetSlotStatus = async (slotId: string, status: 'Ouverte' | 'EnCours' | 'Terminee') => {
    setIsSubmittingRegistration(true);
    try {
      await setSlotStatus(slotId, status);
      setSlots(await getSlots());
    } catch (error) {
      toast({ variant: 'destructive', title: 'Échec', description: (error as Error).message });
    } finally {
      setIsSubmittingRegistration(false);
    }
  };

  // Admin uniquement : retire un slot directement depuis le salon.
  const handleDeleteTable = async (table: GameTable) => {
    if (!isAdmin) return;
    if (!window.confirm(`Retirer ce slot du salon (T.${table.tableNumber} · ${table.gameName}) ?`)) return;
    try {
      await deleteSlot(table.id);
      toast({ title: "Slot retiré", description: `${table.gameName} retiré.` });
      await loadPageData();
    } catch (error) {
      toast({ variant: "destructive", title: "Suppression impossible", description: error instanceof Error ? error.message : "Erreur." });
    }
  };

  const openConfirmationDialog = (table: GameTable) => {
    if (!currentUser || !registrationControls) return;
    const slot = slots.find(s => s.id === table.id);
    if (!slot) return;
    if (!canRegisterBasedOnTicket(currentUser.ticketType, registrationControls)) {
       toast({ variant: "destructive", title: "Inscription non disponible", description: "Votre billet ne permet pas encore l'inscription." });
       return;
    }
    if (seatsForSlot(slot).available <= 0) return;
    if (registrations.some(r => r.userId === currentUser.id && r.slotId === slot.id && (r.status || 'confirmed') === 'confirmed')) return;
    if (slotConflictsForUser(slot, currentUser.id)) {
       toast({ variant: "destructive", title: "Conflit", description: "Vous avez déjà un jeu prévu sur ce créneau." });
       return;
    }
    setTableToConfirm(table);
    setIsConfirmDialogOpen(true);
  };

  const handleRegister = async (slotId: string) => {
    if (!currentUser) return;
    setIsSubmittingRegistration(true);
    try {
        await addSlotRegistration(currentUser.id, slotId, 'confirmed');
        setRegistrations(await getRegistrations());
        toast({ title: "Inscription réussie !" });
    } catch (error) {
         toast({ variant: "destructive", title: "Échec", description: (error as Error).message });
    } finally {
        setIsSubmittingRegistration(false);
        setIsConfirmDialogOpen(false);
        setTableToConfirm(null);
    }
  };

  const handleUnregister = async (slotId: string) => {
    if (!currentUser) return;
    setIsSubmittingRegistration(true);
    try {
        await removeRegistrationFromDb(`${currentUser.id}_${slotId}`);
        setRegistrations(await getRegistrations());
        toast({ title: "Désinscrit(e)" });
    } catch (error) {
        toast({ variant: "destructive", title: "Échec", description: (error as Error).message });
    } finally {
        setIsSubmittingRegistration(false);
    }
  };

  const userSchedule = useMemo(() => {
    if (!currentUser) return [];
    const ids = new Set(registrations.filter(r => r.userId === currentUser.id && (r.status || 'confirmed') === 'confirmed').map(r => r.slotId));
    return slots
        .filter(s => ids.has(s.id))
        .sort((a, b) => {
            const ca = (a.cells || [])[0];
            const cb = (b.cells || [])[0];
            const da = ca ? APP_CONVENTION_DAYS.indexOf(ca.day) : 99;
            const db_ = cb ? APP_CONVENTION_DAYS.indexOf(cb.day) : 99;
            if (da !== db_) return da - db_;
            const sa = ca ? SESSIONS.indexOf(ca.session) : 99;
            const sb = cb ? SESSIONS.indexOf(cb.session) : 99;
            return sa - sb;
        });
  }, [currentUser, registrations, slots]);

  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const handleExportPdf = async () => {
    if (!currentUser) return;
    setIsExportingPdf(true);
    try {
      await exportPlanningPdf({
        userName: currentUser.name,
        ticketType: currentUser.ticketType,
        rows: userSchedule.map(slot => ({
          table: String(slot.config?.gameTableNumber || '–'),
          game: slot.config?.gameName || '',
          creneau: cellsLabel(slot),
        })),
      });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Export impossible', description: e instanceof Error ? e.message : 'Erreur lors de la génération du PDF.' });
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Dispatcher invoked by SalonTableCard when a user clicks a seat in the salon view.
  // - empty: open the inscription confirmation dialog for this table.
  // - you: directly unregister.
  // - animator: admin-only toggle of the animatorPlays flag.
  const handleSeatClick = async (clickedTable: GameTable, seatKind: 'empty' | 'you' | 'animator') => {
    if (seatKind === 'empty') {
      if (!currentUser) {
        toast({ variant: "destructive", title: "Connexion requise", description: "Connectez-vous (email + numéro de billet) pour vous inscrire." });
        return;
      }
      const slot = slots.find(s => s.id === clickedTable.id);
      if (!slot) return;
      openConfirmationDialog(clickedTable);
      return;
    }
    if (seatKind === 'you') {
      handleUnregister(clickedTable.id);
      return;
    }
    // seatKind === 'animator' : la présence/jeu de l'animateur est définie par la CONFIGURATION
    // (onglet Configurations), pas modifiable depuis le salon. On ne fait rien.
  };

  const getTicketBadgeVariant = (ticketType?: TicketType): "strategist" | "marshal" | "general" | "colonel" | "secondary" => {
    switch (ticketType) {
      case 'Stratège': return 'strategist';
      case 'Maréchal': return 'marshal';
      case 'Général': return 'general';
      case 'Colonel': return 'colonel';
      default: return 'secondary';
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 md:gap-6 space-y-6 md:space-y-0">
          <Card className="shadow-lg h-full flex flex-col"> 
              <CardHeader>
                  <CardTitle>Connexion</CardTitle>
                  <CardDescription>Saisissez l&apos;email et le numéro de billet utilisés sur Billetweb.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 flex-grow"> 
              {!currentUser ? (
                  <div className="flex flex-col gap-3">
                      <div className="w-full">
                          <Label htmlFor="email-lookup" className="mb-1 block">Email Billetweb :</Label>
                          <div className="relative">
                              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input id="email-lookup" type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} disabled={isLookingUpUser} className="pl-10" onKeyDown={(e) => { if (e.key === 'Enter') handleUserLookup(); }} />
                          </div>
                      </div>
                      <div className="w-full">
                          <Label htmlFor="ticket-lookup" className="mb-1 block">Numéro de billet :</Label>
                          <div className="relative">
                              <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input id="ticket-lookup" value={ticketInput} onChange={(e) => setTicketInput(e.target.value)} disabled={isLookingUpUser} className="pl-10" placeholder="ex. T927-5275-E1288809" onKeyDown={(e) => { if (e.key === 'Enter') handleUserLookup(); }} />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Il figure sur votre billet et votre email de confirmation Billetweb.</p>
                      </div>
                      <Button onClick={handleUserLookup} disabled={isLookingUpUser || !emailInput.trim() || !ticketInput.trim()} className="self-start">
                          {isLookingUpUser ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogIn className="h-4 w-4 mr-2" />}
                          Se connecter
                      </Button>
                  </div>
              ) : (
                  <div className="flex items-center justify-between p-3 bg-accent/10 rounded-md">
                    <div>
                        <p className="font-semibold">{currentUser.name}</p>
                        <Badge variant={getTicketBadgeVariant(currentUser.ticketType)}>{currentUser.ticketType}</Badge>
                    </div>
                    <Button onClick={handleLogout} variant="outline" size="sm">
                        <LogOut className="h-4 w-4" />
                    </Button>
                  </div>
              )}
              </CardContent>
          </Card>

          <Card className="shadow-lg h-full flex flex-col"> 
              <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Trophy className="h-6 w-6 text-amber-500" /> TOP 5 du Jour</CardTitle>
              </CardHeader>
              <CardContent className="flex-grow">
                  {isLoadingLiveHof ? (
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  ) : gameResultsData.size === 0 ? (
                      <div className="flex items-start gap-2 p-3 bg-muted/30 rounded-md text-sm text-muted-foreground">
                          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span>Le classement sera disponible dès l&apos;enregistrement du premier résultat de partie.</span>
                      </div>
                  ) : !currentLiveConventionDay ? (
                      <div className="flex items-start gap-2 p-3 bg-muted/30 rounded-md text-sm text-muted-foreground">
                          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span>Hors période de convention : le TOP 5 du jour s&apos;affichera du 9 au 13 juillet 2026.</span>
                      </div>
                  ) : topPlayersToday.length === 0 ? (
                      <div className="flex items-start gap-2 p-3 bg-muted/30 rounded-md text-sm text-muted-foreground">
                          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span>Aucun score enregistré pour aujourd&apos;hui pour le moment.</span>
                      </div>
                  ) : (
                      <ul className="space-y-2">
                          {topPlayersToday.map((p) => (
                          <li key={p.id} className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
                              <span className="text-sm font-medium">{p.rank}. {p.name}</span>
                              <span className="flex items-center font-bold">{p.score} <Star className="h-4 w-4 fill-current ml-1" /></span>
                          </li>
                          ))}
                      </ul>
                  )}
              </CardContent>
          </Card>
        </div>

        <Tabs defaultValue={conventionDaysConfig[0].value} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
            {conventionDaysConfig.map(day => (
                <TabsTrigger key={day.value} value={day.value}>{day.name}</TabsTrigger>
            ))}
            </TabsList>

            <div className="mt-3 flex flex-col gap-2.5 rounded-md border border-border bg-muted/40 px-4 py-3 text-muted-foreground">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold text-foreground">Inscriptions ouvertes pour</span>
                    {ticketPhaseStatuses.some(s => s.isOpen) ? (
                        ticketPhaseStatuses.filter(s => s.isOpen).map(s => (
                            <Badge key={s.ticketType} variant={s.variant}>{s.ticketType.toUpperCase()}</Badge>
                        ))
                    ) : (
                        <span>aucune catégorie pour le moment, les inscriptions ne sont pas encore ouvertes.</span>
                    )}
                </div>
                <div className="flex items-start gap-2 text-sm">
                    <Info className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                    {currentUser ? (
                        <span>Pour vous inscrire, <strong>cliquez sur une place libre (verte)</strong> sur le schéma de la table. Pour annuler, cliquez sur <strong>votre place (jaune)</strong>.</span>
                    ) : (
                        <span>Connectez-vous avec votre email Billetweb (encadré <strong>« Connexion »</strong> ci-dessus) pour réserver vos places aux tables.</span>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-6 text-sm">
                    <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: '#c0dd97', border: '1.5px solid #639922' }} /> place libre</span>
                    <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: '#fec107', border: '1.5px solid #a07a00' }} /> votre place</span>
                    <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: '#888888', border: '1.5px solid #444444' }} /> place prise</span>
                    <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: '#8b6914', border: '1.5px solid #5a4408' }} /> animateur</span>
                </div>
            </div>
            {conventionDaysConfig.map(dayConfig => {
                const slotsOfDay = slots.filter(s => (s.cells || []).some(c => c.day === dayConfig.name));
                return (
                <TabsContent key={dayConfig.value} value={dayConfig.value}>
                    <Card>
                        <CardHeader>
                            <CardTitle>
                                <span>Tables du {dayConfig.name} {dayConfig.date}</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {slotsOfDay.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-6 text-center">Aucune table programmée ce jour.</p>
                            ) : (
                                <>
                                    {/* En-tête des colonnes (desktop) */}
                                    <div className="hidden md:flex items-center gap-3 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        <div className="w-56 shrink-0">Table</div>
                                        <div className="flex-1 grid grid-cols-3 gap-2 pl-3">
                                            {SESSIONS.map(session => {
                                                const SIcon = SESSION_HEADERS[session].icon;
                                                return <div key={session} className="text-center flex items-center justify-center gap-1"><SIcon className="h-4 w-4" /> {session}</div>;
                                            })}
                                        </div>
                                    </div>

                                    {(() => {
                                        // Regroupe les slots du jour par jeu (= table) ; pour chaque session, le slot correspondant.
                                        const byGame = new Map<string, { gameName: string; tableNumber: string; gameImageUrl: string; sessions: Partial<Record<SessionType, Slot>> }>();
                                        slotsOfDay.forEach(s => {
                                            const gid = s.config?.gameId;
                                            if (!gid) return;
                                            if (!byGame.has(gid)) byGame.set(gid, { gameName: s.config?.gameName || 'Jeu', tableNumber: s.config?.gameTableNumber || '', gameImageUrl: s.config?.gameImageUrl || '', sessions: {} });
                                            (s.cells || []).filter(c => c.day === dayConfig.name).forEach(c => { byGame.get(gid)!.sessions[c.session] = s; });
                                        });
                                        const rows = [...byGame.values()].sort((a, b) => ((parseInt(a.tableNumber, 10) || 999) - (parseInt(b.tableNumber, 10) || 999)) || a.gameName.localeCompare(b.gameName));
                                        return rows.map(row => (
                                            <div key={`${row.tableNumber}-${row.gameName}`} className="flex flex-col md:flex-row md:items-center gap-2 border rounded-lg p-2">
                                                <div className="md:w-56 shrink-0 flex flex-col items-center gap-1.5">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <span className="bg-foreground text-background px-1.5 py-0.5 rounded text-xs font-bold shrink-0">{row.tableNumber || '?'}</span>
                                                        <span className="font-semibold text-sm leading-tight text-center">{row.gameName}</span>
                                                    </div>
                                                    {row.gameImageUrl
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        ? <img src={row.gameImageUrl} alt={row.gameName} className="w-44 h-[92px] object-cover rounded-md border border-border" loading="lazy" />
                                                        : <div className="w-44 h-[92px] rounded-md border border-border bg-muted" />}
                                                </div>
                                                <div className="flex-1 grid grid-cols-3 gap-2 md:border-l md:pl-3">
                                                    {SESSIONS.map(session => {
                                                        const slot = row.sessions[session];
                                                        return (
                                                            <div key={session} className="flex flex-col items-center justify-start">
                                                                <div className="md:hidden text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{session}</div>
                                                                {slot ? (() => {
                                                                    const { available } = seatsForSlot(slot);
                                                                    const isFull = available <= 0;
                                                                    const statusText = isFull ? 'Complète' : `${available} place${available > 1 ? 's' : ''} libre${available > 1 ? 's' : ''}`;
                                                                    const statusColor = isFull ? 'text-destructive' : available <= 1 ? 'text-amber-700' : 'text-green-700';
                                                                    const myReg = myRegForSlot(slot.id);
                                                                    const iAmConfirmed = !!myReg && (myReg.status === 'confirmed' || !myReg.status);
                                                                    return (
                                                                    <>
                                                                        <div className="w-full flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 mb-0.5 px-1">
                                                                            {slot.config?.authorAnimator
                                                                                ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.5 text-[10px] font-medium max-w-full"><Mic className="h-3 w-3 shrink-0" /><span className="truncate">{slot.config.authorAnimator}{slot.config.animatorPlays ? ' (joue)' : ''}</span></span>
                                                                                : <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-800 border border-green-300 px-1.5 py-0.5 text-[10px] font-medium"><Users className="h-3 w-3" /> Accès libre</span>}
                                                                            <span className={`text-[11px] font-semibold ${statusColor}`}>{statusText}</span>
                                                                        </div>
                                                                        <TableSeats
                                                                            table={slotToCard(slot, { day: dayConfig.name, session })}
                                                                            registrationsForTable={registrations.filter(r => r.slotId === slot.id && (r.status || 'confirmed') === 'confirmed')}
                                                                            currentUserId={currentUser?.id ?? null}
                                                                            isAdmin={isAdmin}
                                                                            isSubmitting={isSubmittingRegistration}
                                                                            onSeatClick={handleSeatClick}
                                                                            onDelete={isAdmin ? handleDeleteTable : undefined}
                                                                            size={132}
                                                                            showStatus={false}
                                                                        />
                                                                        {currentUser && iAmConfirmed && (
                                                                            <button type="button" onClick={() => handleUnregister(slot.id)} disabled={isSubmittingRegistration} className="mt-1 text-[11px] text-destructive underline">Se désinscrire</button>
                                                                        )}
                                                                        {isAdmin && (
                                                                            <div className="mt-1 flex flex-wrap items-center justify-center gap-1">
                                                                                {(slot.status === 'Ouverte' || !slot.status) && <button type="button" onClick={() => handleSetSlotStatus(slot.id, 'EnCours')} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500 text-white">Démarrer</button>}
                                                                                {slot.status === 'EnCours' && <button type="button" onClick={() => handleSetSlotStatus(slot.id, 'Terminee')} className="text-[10px] px-1.5 py-0.5 rounded bg-stone-600 text-white">Terminer</button>}
                                                                                {slot.status === 'Terminee' && <button type="button" onClick={() => handleSetSlotStatus(slot.id, 'Ouverte')} className="text-[10px] px-1.5 py-0.5 rounded bg-green-600 text-white">Rouvrir</button>}
                                                                                <button type="button" onClick={() => setManagedSlot(slot)} className="text-[10px] px-1.5 py-0.5 rounded bg-stone-200 text-stone-800 hover:bg-stone-300">Gérer</button>
                                                                            </div>
                                                                        )}
                                                                    </>
                                                                    );
                                                                })() : (
                                                                    <div className="text-muted-foreground/50 text-xs flex items-center justify-center h-full py-10">–</div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ));
                                    })()}
                                </>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
                );
            })}
        </Tabs>

        {currentUser && userSchedule.length > 0 && (
            <Card className="mt-6 border-primary/20">
                <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                    <CardTitle>Mon Planning</CardTitle>
                    <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={isExportingPdf}>
                        {isExportingPdf ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <FileDown className="h-4 w-4 mr-1.5" />}
                        Exporter en PDF
                    </Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-20">Table</TableHead>
                                <TableHead>Jeu</TableHead>
                                <TableHead>Créneaux</TableHead>
                                <TableHead className="text-center">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {userSchedule.map(slot => (
                                <TableRow key={`sched-${slot.id}`}>
                                    <TableCell className="font-bold">{slot.config?.gameTableNumber || '–'}</TableCell>
                                    <TableCell className="font-semibold">{slot.config?.gameName}</TableCell>
                                    <TableCell className="text-xs"><Badge variant="outline">{cellsLabel(slot)}</Badge></TableCell>
                                    <TableCell className="text-center">
                                        <Button variant="ghost" size="sm" onClick={() => handleUnregister(slot.id)} className="text-destructive"><Info className="h-4 w-4 mr-1" /> Annuler</Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        )}

        <AlertDialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirmer l'inscription</AlertDialogTitle>
                    <AlertDialogDescription>Voulez-vous vous inscrire à la table {tableToConfirm?.tableNumber} pour {tableToConfirm?.gameName} ?</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={() => tableToConfirm && handleRegister(tableToConfirm.id)}>Confirmer</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <SlotPlayersDialog
            open={!!managedSlot}
            onOpenChange={(o) => { if (!o) setManagedSlot(null); }}
            slot={managedSlot}
            slots={slots}
            participants={allParticipantsData}
            registrations={registrations}
            onChanged={loadPageData}
        />
      </div>
    </TooltipProvider>
  );
}
