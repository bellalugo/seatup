
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
import { CONVENTION_DAYS as APP_CONVENTION_DAYS, getTimeSlotTypeDisplayLabel, TIME_SLOT_TYPE_OPTIONS } from '@/lib/types';
import { CalendarDays, Clock, CheckCircle, AlertCircle, Info, Loader2, Hash, UserCircle2, LogIn, LogOut, Mail, UserCheck, Trophy, BarChart3, Star, Dices, Ban } from 'lucide-react';

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
  const [registrations, setRegistrations] = useState<(Registration & {id: string})[]>([]);
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
      setTicketPhaseStatuses(statuses);
    }
  }, [registrationControls]);

  useEffect(() => {
    if (isLoading || !allParticipantsData.length || !tables.length ) return; 
    setIsLoadingLiveHof(true);
    const liveDayName: ConventionDay | null = 'Jeudi'; 
    setCurrentLiveConventionDay(liveDayName);

    if (liveDayName && allParticipantsData.length > 0 && tables.length > 0 && gameResultsData.size > 0) {
        const playerScoresMap: Map<string, { id: string, name: string, score: number }> = new Map();
        allParticipantsData.forEach(p => {
            if (p.typeBillet !== 'Invitation') { 
                const formattedName = `${p.prenom || ''} ${p.nom ? p.nom.charAt(0) + '.' : ''}`.trim();
                playerScoresMap.set(p.id, { id: p.id, name: formattedName, score: 0 });
            }
        });
        const gameTablesMap = new Map(tables.map(t => [t.id, t]));
        Array.from(gameResultsData.values()).forEach(result => {
            const table = gameTablesMap.get(result.tableId);
            if (!table || !table.days.includes(liveDayName)) return;
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
  }, [isLoading, allParticipantsData, tables, gameResultsData]);

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
        toast({ variant: "destructive", title: "Participant non trouvé", description: "Vérifiez votre email." });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Vérification impossible." });
    } finally {
      setIsLookingUpUser(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setEmailInput(''); 
  };

  const openConfirmationDialog = (table: GameTable) => {
    if (!currentUser || !registrationControls) return;
    if (!canRegisterBasedOnTicket(currentUser.ticketType, registrationControls)) {
       toast({ variant: "destructive", title: "Inscription non disponible", description: "Votre billet ne permet pas encore l'inscription." });
       return;
    }
    const availableSeats = getAvailableSeats(table.id, registrations, tables);
    if (availableSeats <= 0) return;
    if (registrations.some(r => r.userId === currentUser.id && r.tableId === table.id)) return;
    if (hasTimeConflict({ days: table.days, timeSlotType: table.timeSlotType }, registrations.filter(r => r.userId === currentUser.id), tables)) {
       toast({ variant: "destructive", title: "Conflit", description: "Vous avez déjà un jeu prévu à ce créneau." });
       return;
    }
    setTableToConfirm(table);
    setIsConfirmDialogOpen(true);
  };

  const handleRegister = async (tableId: string) => {
    if (!currentUser) return;
    setIsSubmittingRegistration(true);
    try {
        await addRegistrationToDb(currentUser.id, tableId);
        const updatedRegistrations = await getRegistrations();
        setRegistrations(updatedRegistrations);
        toast({ title: "Inscription réussie !" });
    } catch (error) {
         toast({ variant: "destructive", title: "Échec", description: (error as Error).message });
    } finally {
        setIsSubmittingRegistration(false);
        setIsConfirmDialogOpen(false); 
        setTableToConfirm(null);
    }
  };

  const handleUnregister = async (tableId: string) => {
    if (!currentUser) return;
    const registrationId = `${currentUser.id}_${tableId}`;
    setIsSubmittingRegistration(true);
    try {
        await removeRegistrationFromDb(registrationId);
        const updatedRegistrations = await getRegistrations();
        setRegistrations(updatedRegistrations);
        toast({ title: "Désinscrit(e)" });
    } catch (error) {
        toast({ variant: "destructive", title: "Échec", description: (error as Error).message });
    } finally {
        setIsSubmittingRegistration(false);
    }
  };

  const userSchedule = useMemo(() => {
    if (!currentUser) return [];
    const userTableIds = registrations.filter(r => r.userId === currentUser.id).map(r => r.tableId);
    return tables
        .filter(t => userTableIds.includes(t.id))
        .sort((a, b) => {
            const dayOrder = APP_CONVENTION_DAYS; 
            const firstDayA = a.days[0];
            const firstDayB = b.days[0];
            if (dayOrder.indexOf(firstDayA) !== dayOrder.indexOf(firstDayB)) {
                return dayOrder.indexOf(firstDayA) - dayOrder.indexOf(firstDayB);
            }
            return TIME_SLOT_TYPE_OPTIONS.findIndex(o => o.value === a.timeSlotType) - TIME_SLOT_TYPE_OPTIONS.findIndex(o => o.value === b.timeSlotType);
        });
  }, [currentUser, registrations, tables]);

  const getTicketBadgeVariant = (ticketType?: TicketType): "strategist" | "marshal" | "general" | "secondary" => {
    switch (ticketType) {
      case 'Stratège': return 'strategist';
      case 'Maréchal': return 'marshal';
      case 'Général': return 'general';
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
                  <CardDescription>Saisissez le courriel utilisé sur Billetweb.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 flex-grow"> 
              {!currentUser ? (
                  <div className="flex flex-col sm:flex-row items-end gap-3">
                  <div className="flex-grow w-full">
                      <Label htmlFor="email-lookup" className="mb-1 block">Email Billetweb :</Label>
                      <div className="relative">
                          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input id="email-lookup" type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} disabled={isLookingUpUser} className="pl-10" />
                      </div>
                  </div>
                  <Button onClick={handleUserLookup} disabled={isLookingUpUser || !emailInput.trim()}>
                      {isLookingUpUser ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
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
                  {isLoadingLiveHof ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : (
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
            <TabsList className="grid w-full grid-cols-4">
            {conventionDaysConfig.map(day => (
                <TabsTrigger key={day.value} value={day.value}>{day.name}</TabsTrigger>
            ))}
            </TabsList>
            {conventionDaysConfig.map(dayConfig => (
                <TabsContent key={dayConfig.value} value={dayConfig.value}>
                    <Card>
                        <CardHeader><CardTitle>Tables du {dayConfig.name}</CardTitle></CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-20 text-center">N°</TableHead>
                                        <TableHead>Jeu</TableHead>
                                        <TableHead>Auteur</TableHead>
                                        <TableHead>Créneau</TableHead>
                                        <TableHead>Places</TableHead>
                                        <TableHead className="text-center">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {tables.filter(t => t.days.includes(dayConfig.name)).map((table) => (
                                        <TableRow key={table.id}>
                                            <TableCell className="text-center font-bold">{table.tableNumber}</TableCell>
                                            <TableCell className="font-semibold">{table.gameName}</TableCell>
                                            <TableCell className="text-sm">{table.authorAnimator || 'Libre'}</TableCell>
                                            <TableCell className="text-xs">{getTimeSlotTypeDisplayLabel(table.timeSlotType)}</TableCell>
                                            <TableCell className="text-xs">{getAvailableSeats(table.id, registrations, tables)} / {table.totalSeats}</TableCell>
                                            <TableCell className="text-center">
                                                {currentUser && registrations.some(r => r.userId === currentUser.id && r.tableId === table.id) ? (
                                                    <Button size="sm" variant="secondary" onClick={() => handleUnregister(table.id)}><CheckCircle className="h-4 w-4" /></Button>
                                                ) : (
                                                    <Button size="sm" onClick={() => openConfirmationDialog(table)} disabled={getAvailableSeats(table.id, registrations, tables) <= 0}>S'inscrire</Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            ))}
        </Tabs>

        {currentUser && userSchedule.length > 0 && ( 
            <Card className="mt-6 border-primary/20">
                <CardHeader><CardTitle>Mon Planning</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-20">Table</TableHead>
                                <TableHead>Jeu</TableHead>
                                <TableHead>Jour</TableHead>
                                <TableHead>Créneau</TableHead>
                                <TableHead className="text-center">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {userSchedule.map(table => (
                                <TableRow key={`sched-${table.id}`}>
                                    <TableCell className="font-bold">{table.tableNumber}</TableCell>
                                    <TableCell className="font-semibold">{table.gameName}</TableCell>
                                    <TableCell><Badge variant="outline">{table.days.join(', ')}</Badge></TableCell>
                                    <TableCell className="text-xs">{getTimeSlotTypeDisplayLabel(table.timeSlotType)}</TableCell>
                                    <TableCell className="text-center">
                                        <Button variant="ghost" size="sm" onClick={() => handleUnregister(table.id)} className="text-destructive"><Info className="h-4 w-4 mr-1" /> Annuler</Button>
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
      </div>
    </TooltipProvider>
  );
}
