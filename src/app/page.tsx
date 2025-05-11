
'use client';

import type React from 'react';
import { useState, useEffect, useCallback } from 'react'; // Added useCallback
import Image from 'next/image';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
    mockUsers,
    getGameTables,
    getRegistrations,
    addRegistration as addRegistrationToDb,
    removeRegistration as removeRegistrationFromDb,
    getAvailableSeats,
    hasTimeConflict,
    canRegisterBasedOnTicket,
    registrationPhases as importedRegistrationPhases // Renamed to avoid conflict
} from '@/lib/data';
import type { GameTable, User, Registration } from '@/lib/types';
import { Users, CalendarDays, Clock, CheckCircle, AlertCircle, Info, RefreshCw, Loader2, Hash, UserCircle2 } from 'lucide-react';

const conventionDays = [
    { name: 'Jeudi', date: '03/07', value: 'jeudi' },
    { name: 'Vendredi', date: '04/07', value: 'vendredi' },
    { name: 'Samedi', date: '05/07', value: 'samedi' },
    { name: 'Dimanche', date: '06/07', value: 'dimanche' }
];

export default function Home() {
  const [tables, setTables] = useState<GameTable[]>([]);
  const [users, setUsers] = useState<Record<string, User>>({});
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingRegistration, setIsSubmittingRegistration] = useState(false);
  const [currentRegistrationPhaseIndex, setCurrentRegistrationPhaseIndex] = useState(0);
  const [tableToConfirm, setTableToConfirm] = useState<GameTable | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const { toast } = useToast();
  const registrationPhases = importedRegistrationPhases; // Use the renamed import

  const loadData = useCallback(async () => {
    console.log('Home: loadData called. Current isLoading before fetch:', isLoading);
    setIsLoading(true);
    try {
      const [fetchedTables, fetchedRegistrations] = await Promise.all([
        getGameTables(),
        getRegistrations()
      ]);
      setTables(fetchedTables);
      setRegistrations(fetchedRegistrations);
      setUsers(mockUsers); 
      setCurrentUser(prevUser => {
         if (prevUser && mockUsers[prevUser.id]) {
            return mockUsers[prevUser.id];
         }
         const userKeys = Object.keys(mockUsers);
         if (userKeys.length > 0) {
            const firstUserId = userKeys[0];
            return mockUsers[firstUserId];
         }
         return null;
      });
    } catch (error) {
      console.error("Échec du chargement des données:", error);
      toast({
        variant: "destructive",
        title: "Erreur de chargement des données",
        description: (error as Error).message || "Impossible de récupérer les données depuis la base de données.",
      });
    } finally {
      setIsLoading(false);
      console.log('Home: loadData finished. Intended isLoading state after fetch: false');
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

   useEffect(() => {
    const phaseTimer1 = setTimeout(() => {
      setCurrentRegistrationPhaseIndex(1);
      toast({ title: "Mise à jour de la phase d'inscription", description: "Inscription maintenant ouverte pour les Maréchaux et Stratèges." });
    }, 15000);

    const phaseTimer2 = setTimeout(() => {
      setCurrentRegistrationPhaseIndex(2);
       toast({ title: "Mise à jour de la phase d'inscription", description: "Inscription maintenant ouverte pour les Généraux, Maréchaux et Stratèges." });
    }, 30000);

    return () => {
        clearTimeout(phaseTimer1);
        clearTimeout(phaseTimer2);
    }
  }, [toast]);

  const handleUserChange = (userId: string) => {
    setCurrentUser(users[userId] || null);
  };

  const openConfirmationDialog = (table: GameTable) => {
    if (!currentUser) {
      toast({ variant: "destructive", title: "Aucun utilisateur sélectionné", description: "Veuillez sélectionner un utilisateur." });
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
      toast({ variant: "destructive", title: "Aucun utilisateur sélectionné", description: "Veuillez sélectionner un utilisateur." });
      return;
    }

    const table = tables.find(t => t.id === tableId);
    if (!table) {
      toast({ variant: "destructive", title: "Table non trouvée" });
      return;
    }

    // Checks are already done in openConfirmationDialog, but keep them for direct calls or safety
    if (!canRegisterBasedOnTicket(currentUser.ticketType, currentRegistrationPhaseIndex)) {
       toast({
        variant: "destructive",
        title: "Inscription pas encore ouverte",
        description: `L'inscription pour votre type de billet (${currentUser.ticketType}) ouvre plus tard. Phase actuelle : ${registrationPhases[currentRegistrationPhaseIndex]}.`,
      });
      return;
    }

    const availableSeats = getAvailableSeats(tableId, registrations, tables);
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
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>Sélection utilisateur &amp; Infos</CardTitle>
                <CardDescription>Sélectionnez un utilisateur pour voir les tables et gérer les inscriptions.</CardDescription>
            </div>
             <Button onClick={() => loadData()} variant="outline" size="sm" disabled={isLoading || isSubmittingRegistration}>
                 <RefreshCw className={`mr-2 h-4 w-4 ${(isLoading || isSubmittingRegistration) ? 'animate-spin' : ''}`} />
                 Actualiser les données
             </Button>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <Select onValueChange={handleUserChange} value={currentUser?.id || ""} disabled={isLoading || isSubmittingRegistration}>
            <SelectTrigger className="w-[280px] rounded-md shadow-sm">
              <SelectValue placeholder="Sélectionner un utilisateur" />
            </SelectTrigger>
            <SelectContent>
              {Object.values(users).map(user => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {currentUser && (
            <Badge variant={currentUser.ticketType === 'Aucun' ? 'destructive' : 'secondary'} className="shadow-sm">
              Billet : {currentUser.ticketType}
            </Badge>
          )}
           <Badge variant="outline" className="ml-auto shadow-sm">
             Phase d'inscription actuelle : <span className="font-semibold ml-1">{registrationPhases[currentRegistrationPhaseIndex]}</span>
           </Badge>
        </CardContent>
      </Card>

       {isLoading ? (
           <div className="flex justify-center items-center min-h-[calc(100vh-20rem)]">
             <Loader2 className="h-12 w-12 animate-spin text-primary" />
             <p className="ml-4 text-muted-foreground">Chargement des tables de jeu...</p>
           </div>
       ) : (
          <>
            <Tabs defaultValue={conventionDays[0].value} className="w-full">
                <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 shadow-sm rounded-md">
                {conventionDays.map(day => (
                    <TabsTrigger key={day.value} value={day.value} disabled={isSubmittingRegistration}>{day.name} {day.date}</TabsTrigger>
                ))}
                </TabsList>

                {conventionDays.map(day => {
                    const dayTables = tables.filter(table => table.day === day.name).sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));
                    return (
                        <TabsContent key={day.value} value={day.value}>
                            <Card className="shadow-md rounded-lg">
                                <CardHeader>
                                    <CardTitle>Tables de jeu du {day.name} {day.date}</CardTitle>
                                    <CardDescription>Jeux disponibles pour {day.name}. Priorité d'inscription : Stratège &gt; Maréchal &gt; Général.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {dayTables.length > 0 ? (
                                        <Table>
                                            <TableCaption>Liste des jeux disponibles le {day.name} {day.date}.</TableCaption>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-24 text-center">Table n°</TableHead>
                                                    <TableHead className="w-64"></TableHead> {}
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
                                                    const isRegisteredByUser = currentUser && registrations.some(r => r.userId === currentUser.id && r.tableId === table.id);
                                                    const canRegisterNow = currentUser && canRegisterBasedOnTicket(currentUser.ticketType, currentRegistrationPhaseIndex);
                                                    const userCurrentRegistrations = registrations.filter(r => r.userId === currentUser?.id);
                                                    const conflict = currentUser && hasTimeConflict(table, userCurrentRegistrations, tables);

                                                    let isDisabled = !currentUser || !canRegisterNow || isSubmittingRegistration;
                                                    if (!isRegisteredByUser) {
                                                        isDisabled = isDisabled || availableSeats <= 0 || (conflict && !isRegisteredByUser);
                                                    }

                                                    let buttonText = "S'inscrire";
                                                    let buttonVariant: "default" | "secondary" | "destructive" = "default";
                                                    let onClickAction = () => openConfirmationDialog(table); 
                                                    let tooltipText = "";

                                                    if (isSubmittingRegistration) {
                                                        buttonText = "Chargement...";
                                                        buttonVariant = "secondary";
                                                    } else if (isRegisteredByUser) {
                                                        buttonText = "Inscrit(e)";
                                                        buttonVariant = "secondary";
                                                        onClickAction = () => handleUnregister(table.id);
                                                        tooltipText = "Cliquez pour vous désinscrire";
                                                    } else if (!currentUser) {
                                                        tooltipText = "Sélectionnez un utilisateur pour vous inscrire";
                                                        buttonText = "Sélectionner utilisateur";
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
                                                            <TableCell><Clock className="inline h-4 w-4 mr-1 text-muted-foreground" />{table.timeSlot}</TableCell>
                                                            <TableCell className="text-center">
                                                                <Badge variant={availableSeats > 0 ? "default" : "destructive"} className="bg-accent text-accent-foreground px-2 py-1 shadow-sm">
                                                                    <Users className="inline h-4 w-4 mr-1" /> {availableSeats} / {table.totalSeats}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-center">
                                                                <Button
                                                                    onClick={onClickAction}
                                                                    size="sm"
                                                                    variant={buttonVariant}
                                                                    disabled={isDisabled}
                                                                    aria-label={tooltipText || buttonText}
                                                                    title={tooltipText || buttonText}
                                                                    className="shadow-sm rounded-md"
                                                                >
                                                                    {isSubmittingRegistration && isRegisteredByUser && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                                    {isSubmittingRegistration && !isRegisteredByUser && tableToConfirm?.id === table.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                                    {!isSubmittingRegistration && isRegisteredByUser && <CheckCircle className="mr-2 h-4 w-4" />}
                                                                    {!isSubmittingRegistration && !isRegisteredByUser && (availableSeats <= 0 || conflict) && <AlertCircle className="mr-2 h-4 w-4" />}
                                                                    {buttonText}
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    ) : (
                                        <p className="text-muted-foreground text-center py-4">Aucune table disponible pour {day.name} {day.date}.</p>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>
                    )
                })}
            </Tabs>

            {currentUser && (
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
                            <TableHead className="w-64"></TableHead> {}
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
                                <TableCell><Clock className="inline h-4 w-4 mr-1 text-muted-foreground" />{table.timeSlot}</TableCell>
                                <TableCell className="font-bold">
                                    {table.gameName}
                                </TableCell>
                                <TableCell className="text-center">
                                        <Button
                                        onClick={() => handleUnregister(table.id)}
                                        size="sm"
                                        variant="outline"
                                        title="Se désinscrire de cette table"
                                        disabled={isSubmittingRegistration}
                                        className="shadow-sm rounded-md"
                                        >
                                        {isSubmittingRegistration && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
