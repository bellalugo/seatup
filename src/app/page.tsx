
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
    getGameTables,
    getRegistrations,
    addRegistration as addRegistrationToDb,
    removeRegistration as removeRegistrationFromDb,
    getAvailableSeats,
    hasTimeConflict,
    canRegisterBasedOnTicket,
    getParticipantByEmail,
    getParticipants,
    getAllGameResults,
    getRegistrationControl,
} from '@/lib/data';
import type { GameTable, User, Registration, Participant, GameResult, TicketType, ManualRegistrationControls, ConventionDay, TimeSlotType } from '@/lib/types';
import { CONVENTION_DAYS as APP_CONVENTION_DAYS, getTimeSlotTypeDisplayLabel } from '@/lib/types'; // Renamed to avoid conflict
import { Users, CalendarDays, Clock, CheckCircle, AlertCircle, Info, Loader2, Hash, UserCircle2, LogIn, LogOut, Mail, UserCheck, Trophy, BarChart3, ListChecks, Ban, Star } from 'lucide-react';

const conventionDaysConfig = [
    { name: 'Jeudi' as ConventionDay, date: '03/07', value: 'jeudi' },
    { name: 'Vendredi' as ConventionDay, date: '04/07', value: 'vendredi' },
    { name: 'Samedi' as ConventionDay, date: '05/07', value: 'samedi' },
    { name: 'Dimanche' as ConventionDay, date: '06/07', value: 'dimanche' }
];


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
  variant: 'strategist' | 'marshal' | 'general' | 'outline' | 'secondary';
  isOpen: boolean;
}


export default function Home() {
  const [tables, setTables] = useState<GameTable[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [allParticipantsData, setAllParticipantsData] = useState<Participant[]>([]);
  const [gameResultsData, setGameResultsData] = useState<Map<string, GameResult>>(new Map());
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingRegistration, setIsSubmittingRegistration] = useState(false);
  const [tableToConfirm, setTableToConfirm] = useState<GameTable | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const { toast } = useToast();

  const [emailInput, setEmailInput] = useState('');
  const [isLookingUpUser, setIsLookingUpUser] = useState(false);

  const [currentLiveConventionDay, setCurrentLiveConventionDay] = useState<ConventionDay | null>(null);
  const [topPlayersToday, setTopPlayersToday] = useState<RankedLivePlayer[]>([]);
  const [isLoadingLiveHof, setIsLoadingLiveHof] = useState(true);

  const [registrationControls, setRegistrationControls] = useState<ManualRegistrationControls | null>(null);
  const [ticketPhaseStatuses, setTicketPhaseStatuses] = useState<TicketPhaseStatusInfo[]>([]);


  const loadPageData = useCallback(async () => {
    setIsLoading(true);
    setIsLoadingLiveHof(true);
    try {
      const [
        fetchedTables,
        fetchedRegistrations,
        fetchedAllParticipants,
        fetchedGameResults,
        fetchedRegistrationControls,
    ] = await Promise.all([
        getGameTables(),
        getRegistrations(),
        getParticipants(),
        getAllGameResults(),
        getRegistrationControl(),
      ]);
      setTables(fetchedTables);
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
        description: (error as Error).message || "Impossible de récupérer les tables, les inscriptions, les participants, les résultats ou les contrôles d'inscription.",
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
    }, 60000); // Fetch controls every 60 seconds
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
      setTicketPhaseStatuses(statuses);
    } else {
      setTicketPhaseStatuses([]);
    }
  }, [registrationControls]);


  useEffect(() => {
    if (isLoading) return; // Wait for initial data load

    setIsLoadingLiveHof(true);

    const liveDayName: ConventionDay | null = 'Jeudi'; // TODO: Determine current day dynamically based on actual date
    setCurrentLiveConventionDay(liveDayName);

    if (liveDayName && allParticipantsData.length > 0 && tables.length > 0 && gameResultsData.size > 0) {
        // Initialize scores for all non-Invitation participants
        const playerScoresMap: Map<string, { id: string, name: string, score: number, gamesPlayedToday: number, winsToday: number }> = new Map();

        allParticipantsData.forEach(p => {
            if (p.typeBillet !== 'Invitation') { 
                const formattedName = `${p.prenom || ''} ${p.nom ? p.nom.charAt(0) + '.' : ''}`.trim();
                playerScoresMap.set(p.id, {
                    id: p.id,
                    name: formattedName,
                    score: 0,
                    gamesPlayedToday: 0, // Will be incremented based on registrations for today's games
                    winsToday: 0,        // Will be incremented based on wins in today's games
                });
            }
        });

        const gameTablesMap = new Map(tables.map(t => [t.id, t]));

        // Calculate scores and wins from game results for today
        Array.from(gameResultsData.values()).forEach(result => {
            const table = gameTablesMap.get(result.tableId);
            // Only consider results for tables active on the liveDayName
            if (!table || !table.days.includes(liveDayName)) return;

            const pointsPerWin = result.playersInGame >= 5 ? 2 : 1;

            result.winnerIds.forEach(winnerId => {
                const playerData = playerScoresMap.get(winnerId);
                if (playerData) {
                    playerData.score += pointsPerWin;
                    playerData.winsToday +=1;
                }
            });
        });
        
        // Calculate games played today from registrations for today's tables that have results
        registrations.forEach(reg => {
            const tableOfRegistration = gameTablesMap.get(reg.tableId);
            // Ensure the table exists, is for today, and has a game result recorded
            if (tableOfRegistration && tableOfRegistration.days.includes(liveDayName) && gameResultsData.has(reg.tableId)) {
                const playerData = playerScoresMap.get(reg.userId);
                if (playerData) {
                    playerData.gamesPlayedToday +=1;
                }
            }
        });


        const rankedToday = Array.from(playerScoresMap.values())
            .filter(p => p.score > 0 || p.gamesPlayedToday > 0) // Show players with score OR games played today
            .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)) // Primary sort by score, secondary by name
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
  }, [isLoading, allParticipantsData, tables, gameResultsData, registrations]); // Rerun when any of these change


  const handleUserLookup = async () => {
    if (!emailInput.trim()) {
      toast({ variant: "destructive", title: "Email requis", description: "Veuillez entrer un email." });
      return;
    }
    setIsLookingUpUser(true);
    setCurrentUser(null); // Reset current user before lookup
    try {
      const participant = await getParticipantByEmail(emailInput.trim());
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
    setEmailInput(''); // Optionally clear the email input on logout
    toast({ title: "Déconnecté", description: "Vous avez été déconnecté." });
  };


  const openConfirmationDialog = (table: GameTable) => {
    if (!currentUser || !registrationControls) {
      toast({ variant: "destructive", title: "Utilisateur non connecté ou contrôles non chargés", description: "Veuillez vous connecter avec votre email pour vous inscrire ou attendez le chargement des données." });
      return;
    }

    // Check if registration is open for the user's ticket type based on manual controls
    if (!canRegisterBasedOnTicket(currentUser.ticketType, registrationControls)) {
       // Construct a more detailed message about why registration isn't open
       let description = `L'inscription pour votre type de billet (${currentUser.ticketType}) n'est pas ouverte pour le moment.`;
       // Further refine based on which phases ARE open, if any
       const openPhases = ticketPhaseStatuses.filter(s => s.isOpen).map(s => s.ticketType);
       if (openPhases.length > 0) {
        description += ` Actuellement, les inscriptions sont ouvertes pour : ${openPhases.join(', ')}.`;
       } else {
        description += ` Les inscriptions sont actuellement fermées pour tous les types de billets.`;
       }
       toast({
        variant: "destructive",
        title: "Inscription non disponible",
        description: description,
        duration: 7000, // Longer duration for more complex message
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

    // Check for time conflicts before opening confirmation
    const userCurrentRegistrations = registrations.filter(r => r.userId === currentUser.id);
    if (hasTimeConflict({ days: table.days, timeSlotType: table.timeSlotType }, userCurrentRegistrations, tables)) {
       toast({ variant: "destructive", title: "Conflit de créneau horaire", description: "Vous êtes déjà inscrit(e) à un jeu pendant ce créneau horaire." });
       return;
    }

    setTableToConfirm(table);
    setIsConfirmDialogOpen(true);
  };


  const handleRegister = async (tableId: string) => {
    if (!currentUser || !registrationControls) { // Ensure currentUser and controls are loaded
      toast({ variant: "destructive", title: "Utilisateur non connecté ou contrôles non chargés", description: "Veuillez vous connecter ou attendez le chargement des données." });
      return;
    }

    const table = tables.find(t => t.id === tableId);
    if (!table) {
      toast({ variant: "destructive", title: "Table non trouvée" });
      return;
    }

    // Double-check registration phase (could have changed since dialog opened)
    if (!canRegisterBasedOnTicket(currentUser.ticketType, registrationControls)) {
      toast({
        variant: "destructive",
        title: "Inscription non plus disponible",
        description: `L'inscription pour votre type de billet (${currentUser.ticketType}) a été fermée.`,
        duration: 7000,
      });
      setIsConfirmDialogOpen(false); // Close dialog if phase changed
      setTableToConfirm(null);
      return;
    }

    // Check available seats again (could have changed)
    const availableSeats = getAvailableSeats(table.id, registrations, tables);
    if (availableSeats <= 0) {
      toast({ variant: "destructive", title: "Table complète", description: "Aucune place disponible à cette table." });
      setIsConfirmDialogOpen(false);
      setTableToConfirm(null);
      return;
    }

    // Check if already registered (unlikely if dialog opened, but good practice)
    const isAlreadyRegistered = registrations.some(r => r.userId === currentUser.id && r.tableId === tableId);
    if (isAlreadyRegistered) {
      toast({ variant: "destructive", title: "Déjà inscrit(e)", description: "Vous êtes déjà inscrit(e) à cette table." });
      setIsConfirmDialogOpen(false);
      setTableToConfirm(null);
      return;
    }

    // Final conflict check
    const userCurrentRegistrations = registrations.filter(r => r.userId === currentUser.id);
     if (hasTimeConflict({ days: table.days, timeSlotType: table.timeSlotType }, userCurrentRegistrations, tables)) {
       toast({ variant: "destructive", title: "Conflit de créneau horaire", description: "Vous êtes déjà inscrit(e) à un jeu pendant ce créneau horaire." });
       setIsConfirmDialogOpen(false);
       setTableToConfirm(null);
       return;
    }

    setIsSubmittingRegistration(true);
    try {
        // Add registration to DB
        await addRegistrationToDb(currentUser.id, tableId);
        // Fetch updated registrations to reflect the change immediately
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
        setIsConfirmDialogOpen(false); // Close dialog in all cases after attempt
        setTableToConfirm(null);
    }
  };

  const handleUnregister = async (tableId: string) => {
     if (!currentUser) return; // Should not happen if button is visible

     const table = tables.find(t => t.id === tableId);
     if (!table) return; // Should not happen

     setIsSubmittingRegistration(true);
     try {
        await removeRegistrationFromDb(currentUser.id, tableId);
        // Fetch updated registrations to reflect the change
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

  // Memoized user schedule
  const getUserSchedule = useCallback((): GameTable[] => {
    if (!currentUser) return [];
    const userTableIds = registrations.filter(r => r.userId === currentUser.id).map(r => r.tableId);
    return tables
        .filter(t => userTableIds.includes(t.id))
        .sort((a, b) => {
            // Sort by the first day of the table, then by timeSlotType
            const dayOrder = APP_CONVENTION_DAYS; // Use the imported constant
            const firstDayA = a.days.length > 0 ? a.days[0] : '';
            const firstDayB = b.days.length > 0 ? b.days[0] : '';

            if (dayOrder.indexOf(firstDayA as ConventionDay) !== dayOrder.indexOf(firstDayB as ConventionDay)) {
                return dayOrder.indexOf(firstDayA as ConventionDay) - dayOrder.indexOf(firstDayB as ConventionDay);
            }
            // Add sorting by timeSlotType if days are the same or not determined
            // This part might need adjustment based on how you want to order timeSlotTypes
            return getTimeSlotTypeDisplayLabel(a.timeSlotType).localeCompare(getTimeSlotTypeDisplayLabel(b.timeSlotType));
        });
  }, [currentUser, registrations, tables]);

  const userSchedule = useMemo(() => getUserSchedule(), [getUserSchedule]);

  const getTicketBadgeVariant = (ticketType?: TicketType): "strategist" | "marshal" | "general" | "secondary" => {
    if (!ticketType) return 'secondary';
    switch (ticketType) {
      case 'Stratège':
        return 'strategist';
      case 'Maréchal':
        return 'marshal';
      case 'Général':
        return 'general';
      case 'Invitation': // Invitations also use secondary, or a specific "invitation" variant if defined
        return 'secondary';
      default:
        return 'secondary';
    }
  };
  
  // For displaying registration status messages
  const openPhaseBadges = ticketPhaseStatuses.filter(s => s.isOpen);
  const closedPhaseBadges = ticketPhaseStatuses.filter(s => !s.isOpen);
  
  // Determine if a warning specific to the logged-in user's ticket type should be shown
  const showUserSpecificWarning = currentUser && 
                                registrationControls && 
                                currentUser.ticketType !== 'Invitation' && 
                                !canRegisterBasedOnTicket(currentUser.ticketType, registrationControls) &&
                                openPhaseBadges.length > 0; // Only show if some other phases ARE open

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* User Connection / Status Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 md:gap-6 space-y-6 md:space-y-0">
          <Card className="shadow-lg rounded-lg h-full flex flex-col"> {/* Ensure full height for layout consistency */}
              <CardHeader>
              <div className="flex flex-row items-center justify-between">
                  <div>
                  <CardTitle>Connexion</CardTitle>
                  <CardDescription>Saisissez le courriel utilisé sur <strong>billetweb</strong> pour vous identifier et accéder aux système de réservation des tables.</CardDescription>
                  </div>
                  {/* Actualiser button removed from here */}
              </div>
              </CardHeader>
              <CardContent className="space-y-4 flex-grow"> {/* flex-grow to push content if card is taller */}
              {!currentUser ? (
                  <div className="flex flex-col sm:flex-row items-end gap-3">
                  <div className="flex-grow w-full sm:w-auto">
                      <Label htmlFor="email-lookup" className="mb-1 block text-sm font-medium">Saisissez le courriel utilisé sur <strong>billetweb</strong> :</Label>
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
                      Vérification & connexion
                  </Button>
                  </div>
              ) : (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-accent/10 rounded-md">
                    <div>
                        <p className="font-semibold text-lg">Bienvenue, {currentUser.name} !</p>
                        <Badge variant={getTicketBadgeVariant(currentUser.ticketType)} className="shadow-sm">
                            Billet : {currentUser.ticketType}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">Email: {currentUser.email}</p>
                        {/* Specific warning for user if their ticket type cannot register but others can */}
                        {showUserSpecificWarning && (
                            <p className="text-xs text-destructive mt-1 font-medium">
                                <AlertCircle className="inline h-3.5 w-3.5 mr-1" />
                                L'inscription aux tables pour votre type de billet ({currentUser.ticketType}) n'est pas encore ouverte.
                            </p>
                        )}
                    </div>
                    <Button onClick={handleLogout} variant="outline" className="shadow-sm rounded-md">
                        <LogOut className="mr-2 h-4 w-4" />
                        Se déconnecter
                    </Button>
                  </div>
              )}
              
              {/* Registration Phase Status Display */}
              <div className="space-y-2 mt-3 pt-3 border-t">
                {isLoading && !registrationControls && ( // Show loading only if controls are not yet fetched
                     <p className="text-sm text-muted-foreground">Chargement de l'état des inscriptions...</p>
                )}
                {registrationControls && ( // Only display once controls are loaded
                    <>
                        {openPhaseBadges.length > 0 && (
                        <div>
                            <p className="text-xs font-medium text-foreground mb-1">Accès aux tables ouvert pour :</p>
                            <div className="flex flex-wrap gap-2">
                            {openPhaseBadges.map(phase => (
                                <Badge key={phase.ticketType} variant={phase.variant} className="shadow-sm text-sm py-1">
                                {phase.text}
                                </Badge>
                            ))}
                            </div>
                        </div>
                        )}

                        {closedPhaseBadges.length > 0 && openPhaseBadges.length > 0 && ( // Show closed only if some are open
                          <div className="mt-3"> 
                            <p className="text-xs font-medium text-muted-foreground mb-1">Accès aux tables fermé pour :</p>
                            <div className="flex flex-wrap gap-2">
                            {closedPhaseBadges.map(phase => (
                                <Badge key={phase.ticketType} variant={phase.variant} className="shadow-sm text-sm py-1">
                                {phase.text}
                                </Badge>
                            ))}
                            </div>
                          </div>
                        )}
                        
                        {openPhaseBadges.length === 0 && ( // If NO phases are open
                            <p className="text-sm font-semibold text-destructive">Inscriptions actuellement closes.</p>
                        )}
                    </>
                )}
              </div>
              </CardContent>
          </Card>

          {/* Live Hall of Fame Card */}
          <Card className="shadow-lg rounded-lg h-full flex flex-col"> {/* Ensure full height */}
              <CardHeader>
                  <div className="flex items-center justify-between">
                      <div>
                          <CardTitle className="flex items-center">
                              <Trophy className="mr-2 h-6 w-6 text-amber-500" /> HALL OF FAME en direct !
                          </CardTitle>
                          <CardDescription>
                              {currentLiveConventionDay ? `Classement du ${currentLiveConventionDay}` : "Aucun jour de convention actif."}
                          </CardDescription>
                      </div>
                       <Link href="/hall-of-fame" passHref>
                          <Button variant="outline" size="sm">
                              <BarChart3 className="mr-2 h-4 w-4" /> Classement détaillé
                          </Button>
                      </Link>
                  </div>
              </CardHeader>
              <CardContent className="flex-grow"> {/* flex-grow to use available space */}
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
                              <div className="flex items-center font-semibold">
                                {player.score}
                                <Star className="ml-1 h-4 w-4 text-black fill-black" />
                              </div>
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


        {/* Tables Display Section */}
         {isLoading && !tables.length ? ( // Show main loader only if no tables are loaded yet
             <div className="flex justify-center items-center min-h-[calc(100vh-25rem)]"> {/* Adjust height as needed */}
               <Loader2 className="h-12 w-12 animate-spin text-primary" />
               <p className="ml-4 text-muted-foreground">Chargement des tables de jeu...</p>
             </div>
         ) : (
            <>
              <Tabs defaultValue={conventionDaysConfig[0].value} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 shadow-sm rounded-md">
                  {conventionDaysConfig.map(day => (
                      <TabsTrigger key={day.value} value={day.value} disabled={isSubmittingRegistration || isLookingUpUser}>{day.name} {day.date}</TabsTrigger>
                  ))}
                  </TabsList>

                  {conventionDaysConfig.map(dayConfig => {
                      // Filter tables for the current day in the tab
                      const dayTables = tables
                          .filter(table => table.days.includes(dayConfig.name)) // Filter by current tab's day
                          .sort((a, b) => { // Sort by tableNumber (alphanumerically), then by timeSlotType
                              const tableNumA_raw = a.tableNumber || '';
                              const tableNumB_raw = b.tableNumber || '';
                              
                              // Attempt to parse as numbers for purely numeric table numbers
                              const numA_parsed = parseFloat(tableNumA_raw.replace(',', '.'));
                              const numB_parsed = parseFloat(tableNumB_raw.replace(',', '.'));
                              
                              const isPurelyNumericA = !isNaN(numA_parsed) && isFinite(numA_parsed) && tableNumA_raw.match(/^[\d,.]+$/);
                              const isPurelyNumericB = !isNaN(numB_parsed) && isFinite(numB_parsed) && tableNumB_raw.match(/^[\d,.]+$/);

                              if (isPurelyNumericA && isPurelyNumericB) {
                                  if (numA_parsed < numB_parsed) return -1;
                                  if (numA_parsed > numB_parsed) return 1;
                              } else if (isPurelyNumericA) { // Numeric ones first
                                  return -1;
                              } else if (isPurelyNumericB) {
                                  return 1;
                              } else { // Alphanumeric comparison
                                  const strA = tableNumA_raw.toLowerCase();
                                  const strB = tableNumB_raw.toLowerCase();
                                  if (strA < strB) return -1;
                                  if (strA > strB) return 1;
                              }
                              // If table numbers are identical (or non-numeric and same), sort by time slot
                              return getTimeSlotTypeDisplayLabel(a.timeSlotType).localeCompare(getTimeSlotTypeDisplayLabel(b.timeSlotType));
                          });
                      return (
                          <TabsContent key={dayConfig.value} value={dayConfig.value}>
                              <Card className="shadow-md rounded-lg">
                                  <CardHeader>
                                      <CardTitle>Tables de jeu du {dayConfig.name} {dayConfig.date}</CardTitle>
                                      <CardDescription>Jeux disponibles pour {dayConfig.name}.</CardDescription>
                                  </CardHeader>
                                  <CardContent>
                                      {/* Show loader inside tab if tables are still loading but some might be there */}
                                      {isLoading && tables.length > 0 && <div className="text-center py-4"><Loader2 className="inline h-6 w-6 animate-spin text-primary mr-2" />Chargement des tables...</div>}
                                      {/* No tables for this specific day */}
                                      {!isLoading && dayTables.length === 0 && <p className="text-muted-foreground text-center py-4">Aucune table disponible pour {dayConfig.name} {dayConfig.date}.</p>}
                                      {/* Tables loaded and available for this day */}
                                      {!isLoading && dayTables.length > 0 && (
                                          <Table>
                                              <TableCaption>Liste des jeux disponibles le {dayConfig.name} {dayConfig.date}.</TableCaption>
                                              <TableHeader>
                                                  <TableRow>
                                                      <TableHead className="w-24 text-center">Table n°</TableHead>
                                                      <TableHead className="w-64" /> {/* Image column */}
                                                      <TableHead>Jeu</TableHead>
                                                      <TableHead>Auteur/Animateur</TableHead>
                                                      <TableHead>Jours</TableHead>
                                                      <TableHead>Créneau horaire</TableHead>
                                                      <TableHead className="text-left">Places disponibles</TableHead>
                                                      <TableHead className="text-center">Action</TableHead>
                                                  </TableRow>
                                              </TableHeader>
                                              <TableBody>
                                                  {dayTables.map((table) => {
                                                      const availableSeats = getAvailableSeats(table.id, registrations, tables);
                                                      const isRegisteredByUser = currentUser && registrations.some(r => r.userId === currentUser.id && r.tableId === table.id);
                                                      const canRegisterNow = currentUser && registrationControls && canRegisterBasedOnTicket(currentUser.ticketType, registrationControls);
                                                      const userCurrentRegistrations = registrations.filter(r => r.userId === currentUser?.id); // Get current user's registrations
                                                      const conflict = currentUser && hasTimeConflict({ days: table.days, timeSlotType: table.timeSlotType }, userCurrentRegistrations, tables);

                                                      // Get participant details for this table
                                                      const registrationsForThisTable = registrations.filter(r => r.tableId === table.id);
                                                      const registeredParticipantDetails = registrationsForThisTable.map(reg => {
                                                          return allParticipantsData.find(p => p.id === reg.userId);
                                                      }).filter(p => p !== undefined) as Participant[]; // Filter out undefined and assert type

                                                      const occupiedSeatsCount = registeredParticipantDetails.length;
                                                      const freeSeatsCount = table.totalSeats - occupiedSeatsCount;

                                                      // Determine button state and text
                                                      let isDisabled = !currentUser || !canRegisterNow || isSubmittingRegistration || isLookingUpUser;
                                                      if (!isRegisteredByUser) { // If not registered by user, add more disable conditions
                                                          isDisabled = isDisabled || availableSeats <= 0 || (!!conflict && !isRegisteredByUser);
                                                      }
                                                       if (currentUser?.ticketType === 'Invitation') isDisabled = true; // Invitations cannot register

                                                      let buttonText = "S'inscrire";
                                                      let buttonVariant: "default" | "secondary" | "destructive" = "default";
                                                      let onClickAction: (() => void) | undefined = () => openConfirmationDialog(table);
                                                      let tooltipText = "";
                                                      let icon = null;


                                                      if (isSubmittingRegistration || isLookingUpUser) {
                                                          buttonText = "Chargement...";
                                                          buttonVariant = "secondary";
                                                          icon = <Loader2 className="mr-2 h-4 w-4 animate-spin" />;
                                                      } else if (isRegisteredByUser) {
                                                          buttonText = "Inscrit(e)";
                                                          buttonVariant = "secondary"; // Visually distinct from "S'inscrire"
                                                          onClickAction = () => handleUnregister(table.id);
                                                          tooltipText = "Cliquez pour vous désinscrire";
                                                          icon = <CheckCircle className="mr-2 h-4 w-4" />;
                                                      } else if (!currentUser && availableSeats <=0) { // Not logged in AND table full
                                                          buttonText = "Complet !";
                                                          buttonVariant = "destructive";
                                                          tooltipText = "Cette table est complète.";
                                                          onClickAction = undefined; // No action
                                                      } else if (!currentUser) { // Not logged in, but table might have seats
                                                          tooltipText = "Connectez-vous pour vous inscrire";
                                                          buttonText = "Connectez-vous";
                                                          buttonVariant = "secondary";
                                                      } else if (currentUser.ticketType === 'Invitation') {
                                                          tooltipText = "Les détenteurs de billets 'Invitation' ne peuvent pas s'inscrire.";
                                                          buttonText = "Indisponible";
                                                          buttonVariant = "secondary";
                                                          icon = <AlertCircle className="mr-2 h-4 w-4" />;
                                                      } else if (!canRegisterNow) {
                                                          tooltipText = `L'inscription pour votre type de billet (${currentUser.ticketType}) n'est pas ouverte pour le moment.`;
                                                          buttonText = "Indisponible";
                                                          buttonVariant = "secondary";
                                                          icon = <AlertCircle className="mr-2 h-4 w-4" />;
                                                      } else if (conflict && !isRegisteredByUser) { // Conflict only matters if trying to register, not if already registered
                                                          tooltipText = "Conflit avec votre planning";
                                                          // isDisabled is already true due to conflict
                                                          // Button text will be 'S'inscrire' but disabled, Tooltip explains why
                                                      } else if (availableSeats <= 0) {
                                                          tooltipText = "Table est complète";
                                                          buttonText = "Complet";
                                                          buttonVariant = "destructive";
                                                          icon = <AlertCircle className="mr-2 h-4 w-4" />;
                                                          // isDisabled is already true
                                                      } else {
                                                          tooltipText = "Cliquez pour vous inscrire à cette table";
                                                          // Default buttonText and icon are fine
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
                                                                          width={256} // Original width for aspect ratio calculation
                                                                          height={144} // Original height
                                                                          className="rounded object-contain h-20 w-auto shadow-sm" // Fixed height, auto width, contain
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
                                                              <TableCell className="text-xs">{table.days.join(', ')}</TableCell>
                                                              <TableCell className="font-bold text-destructive"><Clock className="inline h-4 w-4 mr-1 text-muted-foreground" />{getTimeSlotTypeDisplayLabel(table.timeSlotType)}</TableCell>
                                                              <TableCell className="text-left align-top">
                                                                  <ul className="list-none p-0 m-0 text-xs space-y-1">
                                                                      {registeredParticipantDetails.map(participant => (
                                                                          <li key={participant.id} className="flex items-center">
                                                                              <UserCheck className="h-4 w-4 mr-1.5 text-green-600 flex-shrink-0" />
                                                                              <span>{`${participant.prenom || ''} ${participant.nom ? participant.nom.charAt(0) + '.' : ''}`.trim()}</span>
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
                                                                  {table.totalSeats > 0 && ( // Show count only if totalSeats is defined > 0
                                                                      <p className="text-xs text-muted-foreground mt-1">
                                                                          ({occupiedSeatsCount} / {table.totalSeats} occupées)
                                                                      </p>
                                                                  )}
                                                              </TableCell>
                                                              <TableCell className="text-center">
                                                                {/* Case 1: Table full and user not logged in (Button with "Complet !") */}
                                                                {(!currentUser && availableSeats <= 0) ? (
                                                                    <Badge variant="destructive" title="Cette table est complète">Complet !</Badge>
                                                                // Case 2: Conflict for logged-in user who is NOT registered for this table
                                                                ) : (conflict && currentUser && !isRegisteredByUser) ? (
                                                                    <Tooltip>
                                                                      <TooltipTrigger asChild>
                                                                        {/* Display a Ban icon, which is not clickable but shows tooltip */}
                                                                        <span className="inline-flex items-center justify-center p-2 rounded-md hover:bg-destructive/10 cursor-default" aria-label={tooltipText}>
                                                                          <Ban className="h-5 w-5 text-destructive" />
                                                                        </span>
                                                                      </TooltipTrigger>
                                                                      <TooltipContent>
                                                                        <p>{tooltipText}</p>
                                                                      </TooltipContent>
                                                                    </Tooltip>
                                                                // Case 3: Default button (S'inscrire, Inscrit(e), Complet, Indisponible, etc.)
                                                                ) : (
                                                                    <Button
                                                                        onClick={onClickAction}
                                                                        size="sm"
                                                                        variant={buttonVariant}
                                                                        disabled={isDisabled || (!currentUser && availableSeats <=0)} // Disable if not logged in AND table full
                                                                        aria-label={tooltipText || buttonText}
                                                                        title={tooltipText || buttonText}
                                                                        className="shadow-sm rounded-md"
                                                                    >
                                                                        {icon}
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

              {/* User's Schedule Section */}
              {currentUser && currentUser.ticketType !== 'Invitation' && ( // Show schedule if user is logged in and not an Invitation
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
                              <TableHead className="w-64" /> {/* Image */}
                              <TableHead>Jours</TableHead>
                              <TableHead>Créneau horaire</TableHead>
                              <TableHead>Jeu</TableHead>
                              <TableHead className="text-center">Action</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                          {userSchedule.map(table => {
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
                                  <TableCell className="text-xs"><CalendarDays className="inline h-4 w-4 mr-1 text-muted-foreground" />{table.days.join(', ')}</TableCell>
                                  <TableCell className="font-bold text-destructive"><Clock className="inline h-4 w-4 mr-1 text-muted-foreground" />{getTimeSlotTypeDisplayLabel(table.timeSlotType)}</TableCell>
                                  <TableCell className="font-bold">
                                      {table.gameName}
                                  </TableCell>
                                  <TableCell className="text-center">
                                          <Button
                                          onClick={() => handleUnregister(table.id)}
                                          size="sm"
                                          variant="outline"
                                          title="Se désinscrire de cette table"
                                          disabled={isSubmittingRegistration || isLookingUpUser} // Disable if any global loading is active
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
               {currentUser && currentUser.ticketType === 'Invitation' && ( // Specific message for "Invitation" ticket holders
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

          {/* Confirmation Dialog */}
          <AlertDialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
              <AlertDialogContent>
                  <AlertDialogHeader>
                      <AlertDialogTitle>Confirmation d'inscription</AlertDialogTitle>
                      <AlertDialogDescription>
                          Souhaitez-vous vraiment vous inscrire à la table du jeu : <strong className="text-foreground">{tableToConfirm?.gameName}</strong>
                          {' '} ({tableToConfirm?.days.join(', ')} - {tableToConfirm ? getTimeSlotTypeDisplayLabel(tableToConfirm.timeSlotType) : ''}) ?
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
    </TooltipProvider>
  );
}
