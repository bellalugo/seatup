
'use client';

import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
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
    getParticipantByEmail, // Nouvelle fonction importée
} from '@/lib/data';
import type { GameTable, User, Registration, Participant } from '@/lib/types'; // User type est déjà là
import { Users, CalendarDays, Clock, CheckCircle, AlertCircle, Info, RefreshCw, Loader2, Hash, UserCircle2, LogIn, LogOut, Mail } from 'lucide-react';

const conventionDays = [
    { name: 'Jeudi', date: '03/07', value: 'jeudi' },
    { name: 'Vendredi', date: '04/07', value: 'vendredi' },
    { name: 'Samedi', date: '05/07', value: 'samedi' },
    { name: 'Dimanche', date: '06/07', value: 'dimanche' }
];

export default function Home() {
  const [tables, setTables] = useState<GameTable[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
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

  const loadPageData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [fetchedTables, fetchedRegistrations] = await Promise.all([
        getGameTables(),
        getRegistrations()
      ]);
      setTables(fetchedTables);
      setRegistrations(fetchedRegistrations);
    } catch (error) {
      console.error("Échec du chargement des données de la page:", error);
      toast({
        variant: "destructive",
        title: "Erreur de chargement des données",
        description: (error as Error).message || "Impossible de récupérer les tables ou les inscriptions.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

   useEffect(() => {
    const phaseTimer1 = setTimeout(() => {
      setCurrentRegistrationPhaseIndex(1);
      // toast({ title: "Mise à jour de la phase d'inscription", description: "Inscription maintenant ouverte pour les Maréchaux et Stratèges." });
    }, 15000);

    const phaseTimer2 = setTimeout(() => {
      setCurrentRegistrationPhaseIndex(2);
      // toast({ title: "Mise à jour de la phase d'inscription", description: "Inscription maintenant ouverte pour les Généraux, Maréchaux et Stratèges." });
    }, 30000);

    return () => {
        clearTimeout(phaseTimer1);
        clearTimeout(phaseTimer2);
    }
  }, []); // Retiré toast des dépendances pour éviter les notifications répétitives au re-render

  const handleUserLookup = async () => {
    if (!emailInput.trim()) {
      toast({ variant: "destructive", title: "Email requis", description: "Veuillez entrer un email." });
      return;
    }
    setIsLookingUpUser(true);
    setCurrentUser(null); // Clear previous user
    try {
      const participant = await getParticipantByEmail(emailInput.trim());
      if (participant) {
        setCurrentUser({
          id: participant.id, // Firestore document ID of the participant
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
      <Card className="shadow-lg rounded-lg">
        <CardHeader>
          <div className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Connexion Participant &amp; Infos</CardTitle>
              <CardDescription>Entrez votre email pour vous identifier et accéder aux inscriptions.</CardDescription>
            </div>
            <Button onClick={() => loadPageData()} variant="outline" size="sm" disabled={isLoading || isSubmittingRegistration || isLookingUpUser}>
              <RefreshCw className={`mr-2 h-4 w-4 ${(isLoading || isSubmittingRegistration || isLookingUpUser) ? 'animate-spin' : ''}`} />
              Actualiser les données
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
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
                                                    <TableHead className="text-center">Places disponibles</TableHead>
                                                    <TableHead className="text-center">Action</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {dayTables.map((table) => {
                                                    const availableSeats = getAvailableSeats(table.id, registrations, tables);
                                                    const occupiedSeats = table.totalSeats - availableSeats;
                                                    const isRegisteredByUser = currentUser && registrations.some(r => r.userId === currentUser.id && r.tableId === table.id);
                                                    const canRegisterNow = currentUser && canRegisterBasedOnTicket(currentUser.ticketType, currentRegistrationPhaseIndex);
                                                    const userCurrentRegistrations = registrations.filter(r => r.userId === currentUser?.id);
                                                    const conflict = currentUser && hasTimeConflict(table, userCurrentRegistrations, tables);

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
                                                    } else if (!currentUser) {
                                                        // This case is now only hit if !currentUser AND availableSeats > 0
                                                        // due to the new conditional rendering for the "Complet !" badge.
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
                                                    } else if (availableSeats <= 0) { // User is logged in, table is full
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
                                                            <TableCell className="text-center">
                                                                <div className="flex justify-center items-center space-x-1" title={`${availableSeats} / ${table.totalSeats} places disponibles`}>
                                                                    {Array.from({ length: table.totalSeats }).map((_, i) => (
                                                                        <UserCircle2
                                                                            key={i}
                                                                            className={`h-5 w-5 ${i < occupiedSeats ? 'text-red-600' : 'text-emerald-600'}`}
                                                                            aria-label={i < occupiedSeats ? 'Place occupée' : 'Place disponible'}
                                                                        />
                                                                    ))}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-center">
                                                                {(!currentUser && availableSeats <= 0) ? (
                                                                    <Badge variant="destructive" title="Cette table est complète">Complet !</Badge>
                                                                ) : (
                                                                    <Button
                                                                        onClick={onClickAction}
                                                                        size="sm"
                                                                        variant={buttonVariant}
                                                                        disabled={isDisabled}
                                                                        aria-label={tooltipText || buttonText}
                                                                        title={tooltipText || buttonText}
                                                                        className="shadow-sm rounded-md"
                                                                    >
                                                                        {(isSubmittingRegistration && (tableToConfirm?.id === table.id || isRegisteredByUser)) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                                        {isLookingUpUser && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                                        {!isSubmittingRegistration && !isLookingUpUser && isRegisteredByUser && <CheckCircle className="mr-2 h-4 w-4" />}
                                                                        {!isSubmittingRegistration && !isLookingUpUser && !isRegisteredByUser && (availableSeats <= 0 || conflict || (currentUser?.ticketType === 'Invitation')) && <AlertCircle className="mr-2 h-4 w-4" />}
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

