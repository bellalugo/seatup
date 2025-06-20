
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
import { CONVENTION_DAYS as APP_CONVENTION_DAYS, getTimeSlotTypeDisplayLabel, TIME_SLOT_TYPE_OPTIONS } from '@/lib/types'; // Renamed to avoid conflict & IMPORTED TIME_SLOT_TYPE_OPTIONS
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
    // setIsLoadingLiveHof(true); // Moved inside the useEffect that depends on its data
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
    if (isLoading || !allParticipantsData.length || !tables.length ) return; 

    setIsLoadingLiveHof(true);

    const liveDayName: ConventionDay | null = 'Jeudi'; // TODO: Determine current day dynamically based on actual date
    setCurrentLiveConventionDay(liveDayName);

    if (liveDayName && allParticipantsData.length > 0 && tables.length > 0 && gameResultsData.size > 0) {
        const playerScoresMap: Map<string, { id: string, name: string, score: number, gamesPlayedToday: number, winsToday: number }> = new Map();

        allParticipantsData.forEach(p => {
            if (p.typeBillet !== 'Invitation') { 
                const formattedName = `${p.prenom || ''} ${p.nom ? p.nom.charAt(0) + '.' : ''}`.trim();
                playerScoresMap.set(p.id, {
                    id: p.id,
                    name: formattedName,
                    score: 0,
                    gamesPlayedToday: 0, 
                    winsToday: 0,        
                });
            }
        });

        const gameTablesMap = new Map(tables.map(t => [t.id, t]));

        Array.from(gameResultsData.values()).forEach(result => {
            const table = gameTablesMap.get(result.tableId);
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
        
        registrations.forEach(reg => {
            const tableOfRegistration = gameTablesMap.get(reg.tableId);
            if (tableOfRegistration && tableOfRegistration.days.includes(liveDayName) && gameResultsData.has(reg.tableId)) {
                const playerData = playerScoresMap.get(reg.userId);
                if (playerData) {
                    playerData.gamesPlayedToday +=1;
                }
            }
        });


        const rankedToday = Array.from(playerScoresMap.values())
            .filter(p => p.score > 0 || p.gamesPlayedToday > 0) 
            .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)) 
            .slice(0, 5) 
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
    setEmailInput(''); 
    toast({ title: "Déconnecté", description: "Vous avez été déconnecté." });
  };


  const openConfirmationDialog = (table: GameTable) => {
    if (!currentUser || !registrationControls) {
      toast({ variant: "destructive", title: "Utilisateur non connecté ou contrôles non chargés", description: "Veuillez vous connecter avec votre email pour vous inscrire ou attendez le chargement des données." });
      return;
    }

    if (!canRegisterBasedOnTicket(currentUser.ticketType, registrationControls)) {
       let description = `L'inscription pour votre type de billet (${currentUser.ticketType}) n'est pas ouverte pour le moment.`;
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
        duration: 7000, 
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
    if (hasTimeConflict({ days: table.days, timeSlotType: table.timeSlotType }, userCurrentRegistrations, tables)) {
       toast({ variant: "destructive", title: "Conflit de créneau horaire", description: "Vous êtes déjà inscrit(e) à un jeu pendant ce créneau horaire." });
       return;
    }

    setTableToConfirm(table);
    setIsConfirmDialogOpen(true);
  };


  const handleRegister = async (tableId: string) => {
    if (!currentUser || !registrationControls) { 
      toast({ variant: "destructive", title: "Utilisateur non connecté ou contrôles non chargés", description: "Veuillez vous connecter ou attendez le chargement des données." });
      return;
    }

    const table = tables.find(t => t.id === tableId);
    if (!table) {
      toast({ variant: "destructive", title: "Table non trouvée" });
      return;
    }

    if (!canRegisterBasedOnTicket(currentUser.ticketType, registrationControls)) {
      toast({
        variant: "destructive",
        title: "Inscription non plus disponible",
        description: `L'inscription pour votre type de billet (${currentUser.ticketType}) a été fermée.`,
        duration: 7000,
      });
      setIsConfirmDialogOpen(false); 
      setTableToConfirm(null);
      return;
    }

    const availableSeats = getAvailableSeats(table.id, registrations, tables);
    if (availableSeats <= 0) {
      toast({ variant: "destructive", title: "Table complète", description: "Aucune place disponible à cette table." });
      setIsConfirmDialogOpen(false);
      setTableToConfirm(null);
      return;
    }

    const isAlreadyRegistered = registrations.some(r => r.userId === currentUser.id && r.tableId === tableId);
    if (isAlreadyRegistered) {
      toast({ variant: "destructive", title: "Déjà inscrit(e)", description: "Vous êtes déjà inscrit(e) à cette table." });
      setIsConfirmDialogOpen(false);
      setTableToConfirm(null);
      return;
    }

    const userCurrentRegistrations = registrations.filter(r => r.userId === currentUser.id);
     if (hasTimeConflict({ days: table.days, timeSlotType: table.timeSlotType }, userCurrentRegistrations, tables)) {
       toast({ variant: "destructive", title: "Conflit de créneau horaire", description: "Vous êtes déjà inscrit(e) à un jeu pendant ce créneau horaire." });
       setIsConfirmDialogOpen(false);
       setTableToConfirm(null);
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

  const getUserSchedule = useCallback((): GameTable[] => {
    if (!currentUser) return [];
    const userTableIds = registrations.filter(r => r.userId === currentUser.id).map(r => r.tableId);
    return tables
        .filter(t => userTableIds.includes(t.id))
        .sort((a, b) => {
            const dayOrder = APP_CONVENTION_DAYS; 
            const firstDayA = a.days.length > 0 ? a.days[0] : '';
            const firstDayB = b.days.length > 0 ? b.days[0] : '';

            if (dayOrder.indexOf(firstDayA as ConventionDay) !== dayOrder.indexOf(firstDayB as ConventionDay)) {
                return dayOrder.indexOf(firstDayA as ConventionDay) - dayOrder.indexOf(firstDayB as ConventionDay);
            }
            const timeSlotTypeSortOrder = TIME_SLOT_TYPE_OPTIONS.map(opt => opt.value);
            const timeSlotAIndex = timeSlotTypeSortOrder.indexOf(a.timeSlotType);
            const timeSlotBIndex = timeSlotTypeSortOrder.indexOf(b.timeSlotType);
            if (timeSlotAIndex < timeSlotBIndex) return -1;
            if (timeSlotAIndex > timeSlotBIndex) return 1;
            return 0;
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
      case 'Invitation': 
        return 'secondary';
      default:
        return 'secondary';
    }
  };
  
  const openPhaseBadges = ticketPhaseStatuses.filter(s => s.isOpen);
  const closedPhaseBadges = ticketPhaseStatuses.filter(s => !s.isOpen);
  
  const showUserSpecificWarning = currentUser && 
                                registrationControls && 
                                currentUser.ticketType !== 'Invitation' && 
                                !canRegisterBasedOnTicket(currentUser.ticketType, registrationControls) &&
                                openPhaseBadges.length > 0; 

  const timeSlotTypeSortOrder = TIME_SLOT_TYPE_OPTIONS.map(opt => opt.value);

  const getTimeSlotColorClass = (timeSlotType: TimeSlotType): string => {
    switch (timeSlotType) {
      case 'Matin':
        return 'text-blue-600';
      case 'Après-midi':
        return 'text-orange-700';
      case 'Journée':
      case 'Off':
      default:
        return 'text-destructive';
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 md:gap-6 space-y-6 md:space-y-0">
          <Card className="shadow-lg rounded-lg h-full flex flex-col"> 
              <CardHeader>
              <div className="flex flex-row items-center justify-between">
                  <div>
                  <CardTitle>Connexion</CardTitle>
                  <CardDescription>Saisissez le courriel utilisé sur <strong>billetweb</strong> pour vous identifier et accéder aux système de réservation des tables.</CardDescription>
                  </div>
              </div>
              </CardHeader>
              <CardContent className="space-y-4 flex-grow"> 
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
              
              <div className="space-y-2 mt-3 pt-3 border-t">
                {isLoading && !registrationControls && ( 
                     <p className="text-sm text-muted-foreground">Chargement de l'état des inscriptions...</p>
                )}
                {registrationControls && ( 
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

                        {closedPhaseBadges.length > 0 && openPhaseBadges.length > 0 && ( 
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
                        
                        {openPhaseBadges.length === 0 && ( 
                            <p className="text-sm font-semibold text-destructive">Inscriptions actuellement closes.</p>
                        )}
                    </>
                )}
              </div>
              </CardContent>
          </Card>

          <Card className="shadow-lg rounded-lg h-full flex flex-col"> 
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

         {isLoading && !tables.length ? ( 
             <div className="flex justify-center items-center min-h-[calc(100vh-25rem)]"> 
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
                      const dayTables = tables
                          .filter(table => table.days.includes(dayConfig.name)) 
                          .sort((a, b) => { 
                              const tableNumA_raw = a.tableNumber || '';
                              const tableNumB_raw = b.tableNumber || '';
                              
                              const numA_parsed = parseFloat(tableNumA_raw.replace(',', '.'));
                              const numB_parsed = parseFloat(tableNumB_raw.replace(',', '.'));
                              
                              const isPurelyNumericA = !isNaN(numA_parsed) && isFinite(numA_parsed) && tableNumA_raw.match(/^[\d,.]+$/);
                              const isPurelyNumericB = !isNaN(numB_parsed) && isFinite(numB_parsed) && tableNumB_raw.match(/^[\d,.]+$/);

                              if (isPurelyNumericA && isPurelyNumericB) {
                                  if (numA_parsed < numB_parsed) return -1;
                                  if (numA_parsed > numB_parsed) return 1;
                              } else if (isPurelyNumericA) { 
                                  return -1;
                              } else if (isPurelyNumericB) {
                                  return 1;
                              } else { 
                                  const strA = tableNumA_raw.toLowerCase();
                                  const strB = tableNumB_raw.toLowerCase();
                                  if (strA < strB) return -1;
                                  if (strA > strB) return 1;
                              }
                              
                              const timeSlotAIndex = timeSlotTypeSortOrder.indexOf(a.timeSlotType);
                              const timeSlotBIndex = timeSlotTypeSortOrder.indexOf(b.timeSlotType);
                              if (timeSlotAIndex < timeSlotBIndex) return -1;
                              if (timeSlotAIndex > timeSlotBIndex) return 1;
                              return 0;
                          });
                      return (
                          <TabsContent key={dayConfig.value} value={dayConfig.value}>
                              <Card className="shadow-md rounded-lg">
                                  <CardHeader>
                                      <CardTitle>Tables de jeu du {dayConfig.name} {dayConfig.date}</CardTitle>
                                      <CardDescription>Jeux disponibles pour {dayConfig.name}.</CardDescription>
                                  </CardHeader>
                                  <CardContent>
                                      {isLoading && tables.length > 0 && <div className="text-center py-4"><Loader2 className="inline h-6 w-6 animate-spin text-primary mr-2" />Chargement des tables...</div>}
                                      {!isLoading && dayTables.length === 0 && <p className="text-muted-foreground text-center py-4">Aucune table disponible pour {dayConfig.name} {dayConfig.date}.</p>}
                                      {!isLoading && dayTables.length > 0 && (
                                          <Table>
                                              <TableCaption>Liste des jeux disponibles le {dayConfig.name} {dayConfig.date}.</TableCaption>
                                              <TableHeader>
                                                  <TableRow>
                                                      <TableHead className="w-24 text-center">Table n°</TableHead>
                                                      <TableHead className="w-64" /> 
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
                                                      const userCurrentRegistrations = registrations.filter(r => r.userId === currentUser?.id); 
                                                      const conflict = currentUser && hasTimeConflict({ days: table.days, timeSlotType: table.timeSlotType }, userCurrentRegistrations, tables);

                                                      const registrationsForThisTable = registrations.filter(r => r.tableId === table.id);
                                                      const registeredParticipantDetails = registrationsForThisTable.map(reg => {
                                                          return allParticipantsData.find(p => p.id === reg.userId);
                                                      }).filter(p => p !== undefined) as Participant[]; 

                                                      const occupiedSeatsCount = registeredParticipantDetails.length;
                                                      const freeSeatsCount = table.totalSeats - occupiedSeatsCount;
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
                                                              <TableCell className="text-xs">{table.days.join(', ')}</TableCell>
                                                              <TableCell className={`font-bold ${getTimeSlotColorClass(table.timeSlotType)}`}>
                                                                <Clock className="inline h-4 w-4 mr-1 text-muted-foreground" />{getTimeSlotTypeDisplayLabel(table.timeSlotType)}
                                                              </TableCell>
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
                                                                  {table.totalSeats > 0 && ( 
                                                                      <p className="text-xs text-muted-foreground mt-1">
                                                                          ({occupiedSeatsCount} / {table.totalSeats} occupées)
                                                                      </p>
                                                                  )}
                                                              </TableCell>
                                                              <TableCell className="text-center">
                                                                {(() => {
                                                                  if (isSubmittingRegistration || isLookingUpUser) {
                                                                    return (
                                                                      <Button size="sm" variant="secondary" disabled className="shadow-sm rounded-md">
                                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement...
                                                                      </Button>
                                                                    );
                                                                  }
                                                                  if (isRegisteredByUser) {
                                                                    return (
                                                                      <Button onClick={() => handleUnregister(table.id)} size="sm" variant="secondary" title="Cliquez pour vous désinscrire" className="shadow-sm rounded-md">
                                                                        <CheckCircle className="mr-2 h-4 w-4" /> Inscrit(e)
                                                                      </Button>
                                                                    );
                                                                  }
                                                                  if (!currentUser) {
                                                                    if (availableSeats <= 0) {
                                                                      return <Badge variant="destructive" title="Cette table est complète">Complet !</Badge>;
                                                                    }
                                                                    return (
                                                                      <Button onClick={() => openConfirmationDialog(table)} size="sm" variant="secondary" title="Connectez-vous pour vous inscrire" className="shadow-sm rounded-md">
                                                                        Connectez-vous
                                                                      </Button>
                                                                    );
                                                                  }
                                                                  // From here, currentUser is guaranteed to exist
                                                                  if (currentUser.ticketType === 'Invitation') {
                                                                    return (
                                                                      <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                          <span className="inline-flex items-center justify-center p-2 rounded-md hover:bg-muted/10 cursor-default" aria-label="Indisponible (Invitation)">
                                                                            <Ban className="h-5 w-5 text-muted-foreground" />
                                                                          </span>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent><p>Les détenteurs de billets 'Invitation' ne peuvent pas s'inscrire.</p></TooltipContent>
                                                                      </Tooltip>
                                                                    );
                                                                  }
                                                                  if (!canRegisterNow) {
                                                                    return (
                                                                      <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                          <span className="inline-flex items-center justify-center p-2 rounded-md hover:bg-muted/10 cursor-default" aria-label="Indisponible (Phase fermée)">
                                                                            <Ban className="h-5 w-5 text-muted-foreground" />
                                                                          </span>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent><p>{`L'inscription pour votre billet (${currentUser.ticketType}) n'est pas ouverte.`}</p></TooltipContent>
                                                                      </Tooltip>
                                                                    );
                                                                  }
                                                                  if (conflict) { 
                                                                    return (
                                                                      <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                          <span className="inline-flex items-center justify-center p-2 rounded-md hover:bg-destructive/10 cursor-default" aria-label="Conflit horaire">
                                                                            <Ban className="h-5 w-5 text-destructive" />
                                                                          </span>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent><p>Conflit avec votre planning.</p></TooltipContent>
                                                                      </Tooltip>
                                                                    );
                                                                  }
                                                                  if (availableSeats <= 0) {
                                                                    return <Badge variant="destructive" title="Cette table est complète">Complet</Badge>;
                                                                  }
                                                                  return (
                                                                    <Button onClick={() => openConfirmationDialog(table)} size="sm" variant="default" title="Cliquez pour vous inscrire" className="shadow-sm rounded-md">
                                                                      S'inscrire
                                                                    </Button>
                                                                  );
                                                                })()}
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
                                  <TableCell className={`font-bold ${getTimeSlotColorClass(table.timeSlotType)}`}>
                                    <Clock className="inline h-4 w-4 mr-1 text-muted-foreground" />{getTimeSlotTypeDisplayLabel(table.timeSlotType)}
                                  </TableCell>
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

