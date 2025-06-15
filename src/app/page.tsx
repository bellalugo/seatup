
'use client';

import type React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link'; // Import Link for navigation
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
import {
    getGameTables,
    getRegistrations,
    addRegistration as addRegistrationToDb,
    removeRegistration as removeRegistrationFromDb,
    getAvailableSeats,
    hasTimeConflict,
    canRegisterBasedOnTicket,
    registrationPhases as importedRegistrationPhases,
    getParticipantByEmail,
    getParticipants,
    getAllGameResults, // Import for Hall of Fame Live
} from '@/lib/data';
import type { GameTable, User, Registration, Participant, GameResult } from '@/lib/types';
import { Users, CalendarDays, Clock, CheckCircle, AlertCircle, Info, RefreshCw, Loader2, Hash, UserCircle2, LogIn, LogOut, Mail, UserCheck, Trophy, BarChart3, ListChecks } from 'lucide-react';

const conventionDays = [
    { name: 'Jeudi', date: '03/07', value: 'jeudi' },
    { name: 'Vendredi', date: '04/07', value: 'vendredi' },
    { name: 'Samedi', date: '05/07', value: 'samedi' },
    { name: 'Dimanche', date: '06/07', value: 'dimanche' }
];

// Simplified types for live ranking, adapted from HallOfFamePage
const conventionDayNames = ['Jeudi', 'Vendredi', 'Samedi', 'Dimanche'] as const;
type ConventionDay = typeof conventionDayNames[number];

interface LivePlayerScore {
  id: string;
  name: string;
  score: number;
}
interface RankedLivePlayer extends LivePlayerScore {
  rank: number;
}


export default function Home() {
  const [tables, setTables] = useState<GameTable[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [allParticipantsData, setAllParticipantsData] = useState<Participant[]>([]);
  const [gameResultsData, setGameResultsData] = useState<Map<string, GameResult>>(new Map());
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingRegistration, setIsSubmittingRegistration] = useState(false);
  const [currentRegistrationPhaseIndex, setCurrentRegistrationPhaseIndex] = useState(0);
  const [tableToConfirm, setTableToConfirm] = useState<GameTable | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const { toast } = useToast();
  const registrationPhases = importedRegistrationPhases;

  const [emailInput, setEmailInput] = useState('');
  const [isLookingUpUser, setIsLookingUpUser] = useState(false);

  const [currentLiveConventionDay, setCurrentLiveConventionDay] = useState<ConventionDay | null>(null);
  const [topPlayersToday, setTopPlayersToday] = useState<RankedLivePlayer[]>([]);
  const [isLoadingLiveHof, setIsLoadingLiveHof] = useState(true);


  const loadPageData = useCallback(async () => {
    setIsLoading(true);
    setIsLoadingLiveHof(true);
    try {
      const [fetchedTables, fetchedRegistrations, fetchedAllParticipants, fetchedGameResults] = await Promise.all([
        getGameTables(),
        getRegistrations(),
        getParticipants(),
        getAllGameResults(),
      ]);
      setTables(fetchedTables);
      setRegistrations(fetchedRegistrations);
      setAllParticipantsData(fetchedAllParticipants);

      const resultsMap = new Map<string, GameResult>();
      fetchedGameResults.forEach(result => resultsMap.set(result.tableId, result));
      setGameResultsData(resultsMap);

    } catch (error) {
      console.error("Échec du chargement des données de la page:", error);
      toast({
        variant: "destructive",
        title: "Erreur de chargement des données",
        description: (error as Error).message || "Impossible de récupérer les tables, les inscriptions, les participants ou les résultats.",
      });
    } finally {
      setIsLoading(false);
      // Live HoF loading will be set to false after calculations
    }
  }, [toast]);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

   useEffect(() => {
    const phaseTimer1 = setTimeout(() => {
      setCurrentRegistrationPhaseIndex(1);
    }, 15000);

    const phaseTimer2 = setTimeout(() => {
      setCurrentRegistrationPhaseIndex(2);
    }, 30000);

    return () => {
        clearTimeout(phaseTimer1);
        clearTimeout(phaseTimer2);
    }
  }, []);

  // Effect for Live Hall of Fame
  useEffect(() => {
    if (isLoading) return; // Wait for main data to load

    setIsLoadingLiveHof(true);
    
    // --- TEMPORARY MODIFICATION FOR VISUALIZATION ---
    // Force a specific day to see the live HoF in action.
    // Replace 'Jeudi' with any other conventionDay.name if needed.
    // REMEMBER TO REVERT THIS for production to use the actual current date.
    const liveDayName: ConventionDay | null = 'Jeudi'; // conventionDays[0].name as ConventionDay; 
    // const today = new Date();
    // // For simplicity, using DD/MM matching. A robust solution would handle year.
    // const day = String(today.getDate()).padStart(2, '0');
    // const month = String(today.getMonth() + 1).padStart(2, '0'); // JS months are 0-indexed
    // const formattedToday = `${day}/${month}`;

    // const activeDayEntry = conventionDays.find(d => d.date === formattedToday);
    // const liveDayName = activeDayEntry ? activeDayEntry.name as ConventionDay : null;
    // --- END OF TEMPORARY MODIFICATION ---

    setCurrentLiveConventionDay(liveDayName);

    if (liveDayName && allParticipantsData.length > 0 && tables.length > 0 && gameResultsData.size > 0) {
        const playerScoresMap: Map<string, { id: string, name: string, score: number, gamesPlayedToday: number, winsToday: number }> = new Map();

        allParticipantsData.forEach(p => {
            if (p.ticketType !== 'Invitation') {
                playerScoresMap.set(p.id, {
                    id: p.id,
                    name: `${p.prenom} ${p.nom}`,
                    score: 0,
                    gamesPlayedToday: 0,
                    winsToday: 0,
                });
            }
        });

        const gameTablesMap = new Map(tables.map(t => [t.id, t]));

        Array.from(gameResultsData.values()).forEach(result => {
            const table = gameTablesMap.get(result.tableId);
            if (!table || table.day !== liveDayName) return; // Only consider results for the current live day

            const pointsPerWin = result.playersInGame >= 4 ? 2 : 1;

            result.winnerIds.forEach(winnerId => {
                const playerData = playerScoresMap.get(winnerId);
                if (playerData) {
                    playerData.score += pointsPerWin;
                    playerData.winsToday +=1;
                }
            });
            
             registrations.forEach(reg => {
                if (reg.tableId === result.tableId) { // Check if this registration belongs to the game result's table
                    const tableOfRegistration = gameTablesMap.get(reg.tableId);
                    // Ensure this game was played on the current liveDayName
                    if (tableOfRegistration && tableOfRegistration.day === liveDayName) {
                        const playerData = playerScoresMap.get(reg.userId);
                        if (playerData) {
                            // Check if this game is among those in gameResultsData for *this* liveDayName
                            // This ensures we only count games for the specific liveDayName
                            if (gameResultsData.has(reg.tableId) && gameTablesMap.get(reg.tableId)?.day === liveDayName) {
                                playerData.gamesPlayedToday +=1;
                            }
                        }
                    }
                }
            });
        });

        const rankedToday = Array.from(playerScoresMap.values())
            .filter(p => p.score > 0 || p.winsToday > 0) // Consider players with score or wins today
            .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
            .slice(0, 5) // Top 5
            .map((player, index) => ({
                id: player.id,
                name: player.name,
                score: player.score,
                rank: index + 1,
            }));
        setTopPlayersToday(rankedToday);
    } else {
        setTopPlayersToday([]);
    }
    setIsLoadingLiveHof(false);
  }, [isLoading, allParticipantsData, tables, gameResultsData, registrations]);


  const handleUserLookup = async () => {
    if (!emailInput.trim()) {
      toast({ variant: "destructive", title: "Email requis", description: "Veuillez entrer un email." });
      return;
    }
    setIsLookingUpUser(true);
    setCurrentUser(null);
    try {
      const participant = await getParticipantByEmail(emailInput.trim());
      if (participant) {
        setCurrentUser({
          id: participant.id,
          name: `${participant.prenom} ${participant.nom}`,
          ticketType: participant.typeBillet,
          email: participant.email
        });
        toast({ title: "Participant trouvé", description: `Bienvenue ${participant.prenom} ${participant.nom} !` });
      } else {
        toast({ variant: "destructive", title: "Participant non trouvé", description: "Aucun participant trouvé avec cet email. Vérifiez l'adresse ou contactez l'organisation." });
      }
    } catch (error) {
      console.error("Erreur lors de la recherche du participant:", error);
      toast({ variant: "destructive", title: "Erreur de recherche", description: "Une erreur est survenue lors de la vérification de l'email." });
    } finally {
      setIsLookingUpUser(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setEmailInput('');
    toast({ title: "Déconnecté", description: "Vous avez été déconnecté." });
  };


  const openConfirmationDialog = (table: GameTable) => {
    if (!currentUser) {
      toast({ variant: "destructive", title: "Utilisateur non connecté", description: "Veuillez vous connecter avec votre email pour vous inscrire." });
      return;
    }

    if (!canRegisterBasedOnTicket(currentUser.ticketType, currentRegistrationPhaseIndex)) {
       toast({
        variant: "destructive",
        title: "Inscription pas encore ouverte",
        description: `L'inscription pour votre type de billet (${currentUser.ticketType}) ouvre plus tard. Phase actuelle : ${registrationPhases[currentRegistrationPhaseIndex]}.`,
      });
      return;
    }

    const availableSeats = getAvailableSeats(table.id, registrations, tables);
    if (availableSeats <= 0) {
      toast({ variant: "destructive", title: "Table complète", description: "Aucune place disponible à cette table." });
      return;
    }

    const isAlreadyRegistered = registrations.some(r => r.userId === currentUser.id && r.tableId === table.id);
    if (isAlreadyRegistered) {
      toast({ variant: "destructive", title: "Déjà inscrit(e)", description: "Vous êtes déjà inscrit(e) à cette table." });
      return;
    }

    const userCurrentRegistrations = registrations.filter(r => r.userId === currentUser.id);
    if (hasTimeConflict(table, userCurrentRegistrations, tables)) {
       toast({ variant: "destructive", title: "Conflit de créneau horaire", description: "Vous êtes déjà inscrit(e) à un jeu pendant ce créneau horaire." });
       return;
    }

    setTableToConfirm(table);
    setIsConfirmDialogOpen(true);
  };


  const handleRegister = async (tableId: string) => {
    if (!currentUser) {
      toast({ variant: "destructive", title: "Utilisateur non connecté", description: "Veuillez vous connecter." });
      return;
    }

    const table = tables.find(t => t.id === tableId);
    if (!table) {
      toast({ variant: "destructive", title: "Table non trouvée" });
      return;
    }

    if (!canRegisterBasedOnTicket(currentUser.ticketType, currentRegistrationPhaseIndex)) {
       toast({
        variant: "destructive",
        title: "Inscription pas encore ouverte",
        description: `L'inscription pour votre type de billet (${currentUser.ticketType}) ouvre plus tard. Phase actuelle : ${registrationPhases[currentRegistrationPhaseIndex]}.`,
      });
      return;
    }

    const availableSeats = getAvailableSeats(table.id, registrations, tables);
    if (availableSeats <= 0) {
      toast({ variant: "destructive", title: "Table complète", description: "Aucune place disponible à cette table." });
      return;
    }

    const isAlreadyRegistered = registrations.some(r => r.userId === currentUser.id && r.tableId === tableId);
    if (isAlreadyRegistered) {
      toast({ variant: "destructive", title: "Déjà inscrit(e)", description: "Vous êtes déjà inscrit(e) à cette table." });
      return;
    }

    const userCurrentRegistrations = registrations.filter(r => r.userId === currentUser.id);
    if (hasTimeConflict(table, userCurrentRegistrations, tables)) {
       toast({ variant: "destructive", title: "Conflit de créneau horaire", description: "Vous êtes déjà inscrit(e) à un jeu pendant ce créneau horaire." });
       return;
    }

    setIsSubmittingRegistration(true);
    try {
        await addRegistrationToDb(currentUser.id, tableId);
        const updatedRegistrations = await getRegistrations(); 
        setRegistrations(updatedRegistrations);
        
        toast({
        title: "Inscription réussie !",
        description: `${currentUser.name}, vous êtes maintenant inscrit(e) pour le jeu : ${table.gameName}.`,
        action: <CheckCircle className="text-green-500" />,
        });
    } catch (error) {
         toast({ variant: "destructive", title: "Échec de l'inscription", description: (error as Error).message });
    } finally {
        setIsSubmittingRegistration(false);
        setIsConfirmDialogOpen(false);
        setTableToConfirm(null);
    }
  };

  const handleUnregister = async (tableId: string) => {
     if (!currentUser) return;

     const table = tables.find(t => t.id === tableId);
     if (!table) return;

     setIsSubmittingRegistration(true);
     try {
        await removeRegistrationFromDb(currentUser.id, tableId);
        const updatedRegistrations = await getRegistrations();
        setRegistrations(updatedRegistrations);
        
        toast({
            title: "Désinscrit(e)",
            description: `Votre inscription pour ${table.gameName} a été supprimée.`,
            action: <Info className="text-blue-500" />,
        });
    } catch (error) {
        toast({ variant: "destructive", title: "Échec de la désinscription", description: (error as Error).message });
    } finally {
        setIsSubmittingRegistration(false);
    }
  }

  const getUserSchedule = (): GameTable[] => {
    if (!currentUser) return [];
    const userTableIds = registrations.filter(r => r.userId === currentUser.id).map(r => r.tableId);
    return tables.filter(t => userTableIds.includes(t.id))
                 .sort((a, b) => {
                    const dayOrder = conventionDays.map(d => d.name);
                    if (a.day !== b.day) {
                        return dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
                    }
                    return a.timeSlot.localeCompare(b.timeSlot);
                 });
  };

  const userSchedule = getUserSchedule();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 md:gap-6 space-y-6 md:space-y-0">
        {/* Column 1: Connexion Participant & Infos */}
        <Card className="shadow-lg rounded-lg h-full flex flex-col">
            <CardHeader>
            <div className="flex flex-row items-center justify-between">
                <div>
                <CardTitle>Connexion Participant &amp; Infos</CardTitle>
                <CardDescription>Entrez votre email pour vous identifier et accéder aux inscriptions.</CardDescription>
                </div>
                <Button onClick={() => loadPageData()} variant="outline" size="sm" disabled={isLoading || isSubmittingRegistration || isLookingUpUser}>
                <RefreshCw className={`mr-2 h-4 w-4 ${(isLoading || isSubmittingRegistration || isLookingUpUser) ? 'animate-spin' : ''}`} />
                Actualiser
                </Button>
            </div>
            </CardHeader>
            <CardContent className="space-y-4 flex-grow">
            {!currentUser ? (
                <div className="flex flex-col sm:flex-row items-end gap-3">
                <div className="flex-grow w-full sm:w-auto">
                    <Label htmlFor="email-lookup" className="mb-1 block text-sm font-medium">Votre Email (associé à votre billet)</Label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                        id="email-lookup"
                        type="email"
                        placeholder="exemple@domaine.com"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        disabled={isLookingUpUser}
                        className="pl-10 shadow-sm rounded-md"
                        />
                    </div>
                </div>
                <Button onClick={handleUserLookup} disabled={isLookingUpUser || !emailInput.trim()} className="w-full sm:w-auto shadow-sm rounded-md">
                    {isLookingUpUser ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                    Vérifier et Connecter
                </Button>
                </div>
            ) : (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-accent/10 rounded-md">
                <div>
                    <p className="font-semibold text-lg">Bienvenue, {currentUser.name} !</p>
                    <Badge variant={currentUser.ticketType === 'Invitation' ? 'secondary' : 'default'} className="shadow-sm">
                    Billet : {currentUser.ticketType}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">Email: {currentUser.email}</p>
                </div>
                <Button onClick={handleLogout} variant="outline" className="shadow-sm rounded-md">
                    <LogOut className="mr-2 h-4 w-4" />
                    Se déconnecter
                </Button>
                </div>
            )}
            <Badge variant="outline" className="shadow-sm mt-2">
                Phase d'inscription actuelle : <span className="font-semibold ml-1">{registrationPhases[currentRegistrationPhaseIndex]}</span>
            </Badge>
            </CardContent>
        </Card>

        {/* Column 2: Hall of Fame - En Direct */}
        <Card className="shadow-lg rounded-lg h-full flex flex-col">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center">
                            <Trophy className="mr-2 h-6 w-6 text-amber-500" /> Hall of Fame - En Direct
                        </CardTitle>
                        <CardDescription>
                            {currentLiveConventionDay ? `Classement du ${currentLiveConventionDay}` : "Aucun jour de convention actif."}
                        </CardDescription>
                    </div>
                     <Link href="/hall-of-fame" passHref>
                        <Button variant="outline" size="sm">
                            <BarChart3 className="mr-2 h-4 w-4" /> Classement Détaillé
                        </Button>
                    </Link>
                </div>
            </CardHeader>
            <CardContent className="flex-grow">
                {isLoadingLiveHof ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <p className="ml-2 text-muted-foreground">Chargement du classement du jour...</p>
                    </div>
                ) : currentLiveConventionDay && topPlayersToday.length > 0 ? (
                    <ul className="space-y-2">
                        {topPlayersToday.map((player) => (
                        <li key={player.id} className="flex items-center justify-between p-2 bg-muted/30 rounded-md shadow-sm">
                            <div className="flex items-center">
                            <span className="font-bold w-6 text-center mr-2">
                                {player.rank === 1 && <Trophy className="inline h-4 w-4 text-amber-500" />}
                                {player.rank === 2 && <Trophy className="inline h-4 w-4 text-slate-400" />}
                                {player.rank === 3 && <Trophy className="inline h-4 w-4 text-yellow-700" />}
                                {player.rank > 3 && player.rank}
                            </span>
                            <span className="text-sm">{player.name}</span>
                            </div>
                            <Badge variant="secondary" className="font-semibold">{player.score} pts</Badge>
                        </li>
                        ))}
                    </ul>
                ) : currentLiveConventionDay ? (
                     <p className="text-muted-foreground text-center py-4">Aucun score enregistré pour {currentLiveConventionDay} pour le moment.</p>
                ) : (
                    <p className="text-muted-foreground text-center py-4">La convention n'est pas en cours aujourd'hui.</p>
                )}
            </CardContent>
        </Card>
      </div>


       {isLoading && !tables.length ? (
           <div className="flex justify-center items-center min-h-[calc(100vh-25rem)]">
             <Loader2 className="h-12 w-12 animate-spin text-primary" />
             <p className="ml-4 text-muted-foreground">Chargement des tables de jeu...</p>
           </div>
       ) : (
          <>
            <Tabs defaultValue={conventionDays[0].value} className="w-full">
                <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 shadow-sm rounded-md">
                {conventionDays.map(day => (
                    <TabsTrigger key={day.value} value={day.value} disabled={isSubmittingRegistration || isLookingUpUser}>{day.name} {day.date}</TabsTrigger>
                ))}
                </TabsList>

                {conventionDays.map(day => {
                    const dayTables = tables
                        .filter(table => table.day === day.name)
                        .sort((a, b) => {
                            const tableNumA_raw = a.tableNumber || '';
                            const tableNumB_raw = b.tableNumber || '';

                            const numA_parsed = parseFloat(tableNumA_raw);
                            const numB_parsed = parseFloat(tableNumB_raw);

                            const isPurelyNumericA = !isNaN(numA_parsed) && isFinite(numA_parsed) && tableNumA_raw === numA_parsed.toString();
                            const isPurelyNumericB = !isNaN(numB_parsed) && isFinite(numB_parsed) && tableNumB_raw === numB_parsed.toString();

                            if (isPurelyNumericA && isPurelyNumericB) {
                                if (numA_parsed < numB_parsed) return -1;
                                if (numA_parsed > numB_parsed) return 1;
                            } else {
                                const strA = tableNumA_raw.toLowerCase();
                                const strB = tableNumB_raw.toLowerCase();
                                if (strA < strB) return -1;
                                if (strA > strB) return 1;
                            }
                            return a.timeSlot.localeCompare(b.timeSlot);
                        });
                    return (
                        <TabsContent key={day.value} value={day.value}>
                            <Card className="shadow-md rounded-lg">
                                <CardHeader>
                                    <CardTitle>Tables de jeu du {day.name} {day.date}</CardTitle>
                                    <CardDescription>Jeux disponibles pour {day.name}. Priorité d'inscription : Stratège &gt; Maréchal &gt; Général.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {isLoading && tables.length > 0 && <div className="text-center py-4"><Loader2 className="inline h-6 w-6 animate-spin text-primary mr-2" />Chargement des tables...</div>}
                                    {!isLoading && dayTables.length === 0 && <p className="text-muted-foreground text-center py-4">Aucune table disponible pour {day.name} {day.date}.</p>}
                                    {!isLoading && dayTables.length > 0 && (
                                        <Table>
                                            <TableCaption>Liste des jeux disponibles le {day.name} {day.date}.</TableCaption>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-24 text-center">Table n°</TableHead>
                                                    <TableHead className="w-64" />
                                                    <TableHead>Jeu</TableHead>
                                                    <TableHead>Auteur/Animateur</TableHead>
                                                    <TableHead>Créneau horaire</TableHead>
                                                    <TableHead className="text-left">Places disponibles</TableHead>
                                                    <TableHead className="text-center">Action</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {dayTables.map((table) => {
                                                    const availableSeats = getAvailableSeats(table.id, registrations, tables);
                                                    const isRegisteredByUser = currentUser && registrations.some(r => r.userId === currentUser.id && r.tableId === table.id);
                                                    const canRegisterNow = currentUser && canRegisterBasedOnTicket(currentUser.ticketType, currentRegistrationPhaseIndex);
                                                    const userCurrentRegistrations = registrations.filter(r => r.userId === currentUser?.id);
                                                    const conflict = currentUser && hasTimeConflict(table, userCurrentRegistrations, tables);

                                                    const registrationsForThisTable = registrations.filter(r => r.tableId === table.id);
                                                    const registeredParticipantDetails = registrationsForThisTable.map(reg => {
                                                        return allParticipantsData.find(p => p.id === reg.userId);
                                                    }).filter(p => p !== undefined) as Participant[];

                                                    const occupiedSeatsCount = registeredParticipantDetails.length;
                                                    const freeSeatsCount = table.totalSeats - occupiedSeatsCount;


                                                    let isDisabled = !currentUser || !canRegisterNow || isSubmittingRegistration || isLookingUpUser;
                                                    if (!isRegisteredByUser) {
                                                        isDisabled = isDisabled || availableSeats <= 0 || (conflict && !isRegisteredByUser);
                                                    }
                                                     if (currentUser?.ticketType === 'Invitation') isDisabled = true;


                                                    let buttonText = "S'inscrire";
                                                    let buttonVariant: "default" | "secondary" | "destructive" = "default";
                                                    let onClickAction = () => openConfirmationDialog(table);
                                                    let tooltipText = "";

                                                    if (isSubmittingRegistration || isLookingUpUser) {
                                                        buttonText = "Chargement...";
                                                        buttonVariant = "secondary";
                                                    } else if (isRegisteredByUser) {
                                                        buttonText = "Inscrit(e)";
                                                        buttonVariant = "secondary";
                                                        onClickAction = () => handleUnregister(table.id);
                                                        tooltipText = "Cliquez pour vous désinscrire";
                                                    } else if (!currentUser && availableSeats <=0) { // Condition for "Complet !"
                                                        buttonText = "Complet !";
                                                        buttonVariant = "destructive"; 
                                                        tooltipText = "Cette table est complète.";
                                                    } else if (!currentUser) {
                                                        tooltipText = "Connectez-vous pour vous inscrire";
                                                        buttonText = "Connectez-vous";
                                                        buttonVariant = "secondary";
                                                    } else if (currentUser.ticketType === 'Invitation') {
                                                        tooltipText = "Les détenteurs de billets 'Invitation' ne peuvent pas s'inscrire.";
                                                        buttonText = "Indisponible";
                                                        buttonVariant = "secondary";
                                                    } else if (!canRegisterNow) {
                                                        tooltipText = `Inscription pas encore ouverte pour ${currentUser.ticketType}`;
                                                        buttonText = "Indisponible";
                                                        buttonVariant = "secondary";
                                                    } else if (conflict) {
                                                        tooltipText = "Conflit avec votre planning";
                                                        buttonText = "Conflit";
                                                        buttonVariant = "destructive";
                                                    } else if (availableSeats <= 0) {
                                                        tooltipText = "Table est complète";
                                                        buttonText = "Complet";
                                                        buttonVariant = "destructive";
                                                    } else {
                                                        tooltipText = "Cliquez pour vous inscrire à cette table";
                                                    }
                                                    const imageUrl = table.gameImageUrl || table.imageUrl;
                                                    return (
                                                        <TableRow key={table.id} className={isRegisteredByUser ? "bg-secondary/30" : ""}>
                                                            <TableCell className="font-bold text-center w-24"><Hash className="inline h-3 w-3 mr-1 text-muted-foreground" />{table.tableNumber || 'N/A'}</TableCell>
                                                            <TableCell className="w-64 px-4 py-1">
                                                                {imageUrl ? (
                                                                    <Image
                                                                        src={imageUrl}
                                                                        alt={`Image du jeu ${table.gameName}`}
                                                                        width={256}
                                                                        height={144}
                                                                        className="rounded object-contain h-20 w-auto shadow-sm"
                                                                        data-ai-hint="game cover"
                                                                    />
                                                                ) : (
                                                                    <div className="h-20 w-full bg-muted rounded flex items-center justify-center text-xs text-muted-foreground shadow-sm">?</div>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="font-bold">
                                                                {table.gameName}
                                                            </TableCell>
                                                            <TableCell>
                                                                {table.authorAnimator ? (
                                                                    <span className="font-bold flex items-center">
                                                                        <UserCircle2 className="inline h-4 w-4 mr-1 text-muted-foreground" />
                                                                        {table.authorAnimator}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-muted-foreground italic">N/A</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="font-bold text-destructive"><Clock className="inline h-4 w-4 mr-1 text-muted-foreground" />{table.timeSlot}</TableCell>
                                                            <TableCell className="text-left align-top">
                                                                <ul className="list-none p-0 m-0 text-xs space-y-1">
                                                                    {registeredParticipantDetails.map(participant => (
                                                                        <li key={participant.id} className="flex items-center">
                                                                            <UserCheck className="h-4 w-4 mr-1.5 text-green-600 flex-shrink-0" />
                                                                            <span>{participant.prenom} {participant.nom}</span>
                                                                        </li>
                                                                    ))}
                                                                    {Array.from({ length: freeSeatsCount }).map((_, i) => (
                                                                        <li key={`free-${i}`} className="flex items-center">
                                                                            <UserCircle2 className="h-4 w-4 mr-1.5 text-gray-400 flex-shrink-0" />
                                                                            <span className="italic text-muted-foreground">Place libre</span>
                                                                        </li>
                                                                    ))}
                                                                    {table.totalSeats === 0 && freeSeatsCount === 0 && registeredParticipantDetails.length === 0 && (
                                                                        <li className="flex items-center">
                                                                            <Info className="h-4 w-4 mr-1.5 text-blue-500 flex-shrink-0" />
                                                                            <span className="italic text-muted-foreground">Aucune place définie</span>
                                                                        </li>
                                                                    )}
                                                                </ul>
                                                                {table.totalSeats > 0 && (
                                                                    <p className="text-xs text-muted-foreground mt-1">
                                                                        ({occupiedSeatsCount} / {table.totalSeats} occupées)
                                                                    </p>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-center">
                                                                {(!currentUser && availableSeats <= 0) ? (
                                                                    <Badge variant="destructive" title="Cette table est complète">Complet !</Badge>
                                                                ) : (
                                                                    <Button
                                                                        onClick={onClickAction}
                                                                        size="sm"
                                                                        variant={buttonVariant}
                                                                        disabled={isDisabled || (!currentUser && availableSeats <=0)} 
                                                                        aria-label={tooltipText || buttonText}
                                                                        title={tooltipText || buttonText}
                                                                        className="shadow-sm rounded-md"
                                                                    >
                                                                        {(isSubmittingRegistration && (tableToConfirm?.id === table.id || isRegisteredByUser)) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                                        {isLookingUpUser && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                                        {!isSubmittingRegistration && !isLookingUpUser && isRegisteredByUser && <CheckCircle className="mr-2 h-4 w-4" />}
                                                                        {!isSubmittingRegistration && !isLookingUpUser && !isRegisteredByUser && (availableSeats <= 0 || conflict || (currentUser?.ticketType === 'Invitation')) && !(!currentUser && availableSeats <=0) && <AlertCircle className="mr-2 h-4 w-4" />}
                                                                        {buttonText}
                                                                    </Button>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>
                    )
                })}
            </Tabs>

            {currentUser && currentUser.ticketType !== 'Invitation' && (
                <Card className="mt-6 shadow-lg rounded-lg">
                <CardHeader>
                    <CardTitle>Planning de {currentUser.name}</CardTitle>
                    <CardDescription>Tables auxquelles vous êtes actuellement inscrit(e).</CardDescription>
                </CardHeader>
                <CardContent>
                    {userSchedule.length > 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                            <TableHead className="w-24 text-center">Table n°</TableHead>
                            <TableHead className="w-64" />
                            <TableHead>Jour</TableHead>
                            <TableHead>Créneau horaire</TableHead>
                            <TableHead>Jeu</TableHead>
                            <TableHead className="text-center">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                        {userSchedule.map(table => {
                            const dayInfo = conventionDays.find(d => d.name === table.day);
                            const imageUrl = table.gameImageUrl || table.imageUrl;
                            return (
                                <TableRow key={`schedule-${table.id}`}>
                                <TableCell className="font-bold text-center w-24"><Hash className="inline h-3 w-3 mr-1 text-muted-foreground" />{table.tableNumber || 'N/A'}</TableCell>
                                <TableCell className="w-64 px-4 py-1">
                                    {imageUrl ? (
                                        <Image
                                            src={imageUrl}
                                            alt={`Image du jeu ${table.gameName}`}
                                            width={256}
                                            height={144}
                                            className="rounded object-contain h-20 w-auto shadow-sm"
                                            data-ai-hint="game cover"
                                        />
                                    ) : (
                                        <div className="h-20 w-full bg-muted rounded flex items-center justify-center text-xs text-muted-foreground shadow-sm">?</div>
                                    )}
                                </TableCell>
                                <TableCell><CalendarDays className="inline h-4 w-4 mr-1 text-muted-foreground" />{table.day} {dayInfo?.date}</TableCell>
                                <TableCell className="font-bold text-destructive"><Clock className="inline h-4 w-4 mr-1 text-muted-foreground" />{table.timeSlot}</TableCell>
                                <TableCell className="font-bold">
                                    {table.gameName}
                                </TableCell>
                                <TableCell className="text-center">
                                        <Button
                                        onClick={() => handleUnregister(table.id)}
                                        size="sm"
                                        variant="outline"
                                        title="Se désinscrire de cette table"
                                        disabled={isSubmittingRegistration || isLookingUpUser}
                                        className="shadow-sm rounded-md"
                                        >
                                        {(isSubmittingRegistration || isLookingUpUser) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Se désinscrire
                                        </Button>
                                </TableCell>
                                </TableRow>
                            );
                        })}
                        </TableBody>
                    </Table>
                    ) : (
                    <p className="text-muted-foreground text-center py-4">Vous n'êtes inscrit(e) à aucune table pour le moment.</p>
                    )}
                </CardContent>
                </Card>
            )}
             {currentUser && currentUser.ticketType === 'Invitation' && (
                 <Card className="mt-6 shadow-lg rounded-lg">
                    <CardHeader>
                        <CardTitle>Planning de {currentUser.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-center py-4">Les détenteurs de billets 'Invitation' ne peuvent pas s'inscrire aux tables.</p>
                    </CardContent>
                 </Card>
            )}
          </>
       )}

        <AlertDialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirmation d'inscription</AlertDialogTitle>
                    <AlertDialogDescription>
                        Souhaitez-vous vraiment vous inscrire à la table du jeu : <strong className="text-foreground">{tableToConfirm?.gameName}</strong>
                        {' '} ({tableToConfirm?.day} - {tableToConfirm?.timeSlot}) ?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => {
                        setIsConfirmDialogOpen(false);
                        setTableToConfirm(null);
                    }} disabled={isSubmittingRegistration}>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={() => tableToConfirm && handleRegister(tableToConfirm.id)}
                        disabled={isSubmittingRegistration}
                    >
                        {isSubmittingRegistration && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirmer l'inscription
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}

    
    