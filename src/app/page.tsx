
'use client'; // Required for useState, useEffect, onClick handlers

import * as React from 'react';
import { useState, useEffect } from 'react';
import Image from 'next/image'; // Import next/image
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from '@/hooks/use-toast';
import {
    mockUsers,
    getCurrentTables, // Fetch current tables
    getCurrentRegistrations, // Fetch current registrations
    addRegistration, // Add registration
    removeRegistration, // Remove registration
    getAvailableSeats,
    hasTimeConflict,
    canRegisterBasedOnTicket,
    registrationPhases // Import registrationPhases here
} from '@/lib/data';
import type { GameTable, User, Registration, TicketType } from '@/lib/types';
// Remove direct import of registrationPhases from types if it's already imported from data
// import { registrationPhases } from '@/lib/types';
import { Users, CalendarDays, Clock, CheckCircle, AlertCircle, Info, RefreshCw } from 'lucide-react';

// Define convention days with dates
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
  const [currentRegistrationPhaseIndex, setCurrentRegistrationPhaseIndex] = useState(0); // Start with Strategist
  const { toast } = useToast();

  // Fetch data function using the imported helpers
  const loadData = async () => {
    setIsLoading(true);
    try {
      // Simulate async fetch if these were API calls
      await new Promise(resolve => setTimeout(resolve, 50));
      const currentTables = getCurrentTables();
      const currentRegistrations = getCurrentRegistrations();
      setTables(currentTables);
      setRegistrations(currentRegistrations);
      setUsers(mockUsers); // Users are static for now
      // Set a default user or maintain current selection if possible
      setCurrentUser(prevUser => {
         if (prevUser && mockUsers[prevUser.id]) {
            return mockUsers[prevUser.id]; // Keep user if still valid
         }
         // Set a default if no user or previous user invalid
         const firstUserId = Object.keys(mockUsers)[0];
         return firstUserId ? mockUsers[firstUserId] : null;
      });
    } catch (error) {
      console.error("Échec du chargement des données:", error);
      toast({
        variant: "destructive",
        title: "Erreur de chargement des données",
        description: "Impossible de récupérer les tables de jeu et les données utilisateur.",
      });
    } finally {
      setIsLoading(false);
    }
  };


  useEffect(() => {
    loadData(); // Initial load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // No dependencies needed for initial load with mock data


   // Simulate progressing registration phases over time
   useEffect(() => {
    // In a real app, this might be driven by server time or admin action
    const phaseTimer1 = setTimeout(() => {
      setCurrentRegistrationPhaseIndex(1); // Open for Marshals
      toast({ title: "Mise à jour de la phase d'inscription", description: "Inscription maintenant ouverte pour les Maréchaux et Stratèges." });
    }, 15000); // 15 seconds after load for demo

    const phaseTimer2 = setTimeout(() => {
      setCurrentRegistrationPhaseIndex(2); // Open for Generals
       toast({ title: "Mise à jour de la phase d'inscription", description: "Inscription maintenant ouverte pour les Généraux, Maréchaux et Stratèges." });
    }, 30000); // 30 seconds after load for demo

    return () => {
        clearTimeout(phaseTimer1);
        clearTimeout(phaseTimer2);
    } // Cleanup timers
  }, [toast]);


  const handleUserChange = (userId: string) => {
    setCurrentUser(users[userId] || null);
  };

  const handleRegister = (tableId: string) => {
    if (!currentUser) {
      toast({ variant: "destructive", title: "Aucun utilisateur sélectionné", description: "Veuillez sélectionner un utilisateur." });
      return;
    }

    const table = tables.find(t => t.id === tableId);
    if (!table) {
      toast({ variant: "destructive", title: "Table non trouvée" });
      return;
    }

    // 1. Check Ticket Eligibility
    if (!canRegisterBasedOnTicket(currentUser.ticketType, currentRegistrationPhaseIndex)) {
       toast({
        variant: "destructive",
        title: "Inscription pas encore ouverte",
        description: `L'inscription pour votre type de billet (${currentUser.ticketType}) ouvre plus tard. Phase actuelle : ${registrationPhases[currentRegistrationPhaseIndex]}.`,
      });
      return;
    }

    // 2. Check Available Seats (using current registrations state)
    const availableSeats = getAvailableSeats(tableId, registrations, tables);
    if (availableSeats <= 0) {
      toast({ variant: "destructive", title: "Table complète", description: "Aucune place disponible à cette table." });
      return;
    }

    // 3. Check if Already Registered for this Table
    const isAlreadyRegistered = registrations.some(r => r.userId === currentUser.id && r.tableId === tableId);
    if (isAlreadyRegistered) {
      toast({ variant: "destructive", title: "Déjà inscrit(e)", description: "Vous êtes déjà inscrit(e) à cette table." });
      return;
    }

    // 4. Check for Time Conflicts
    const userCurrentRegistrations = registrations.filter(r => r.userId === currentUser.id);
    if (hasTimeConflict(table, userCurrentRegistrations, tables)) {
       toast({ variant: "destructive", title: "Conflit de créneau horaire", description: "Vous êtes déjà inscrit(e) à un jeu pendant ce créneau horaire." });
       return;
    }


    // If all checks pass, add registration using the mock mutation function
    try {
        addRegistration(currentUser.id, tableId);
        // Refresh local state after mock mutation
        setRegistrations(getCurrentRegistrations());

        toast({
        title: "Inscription réussie",
        description: `${currentUser.name} inscrit(e) avec succès pour ${table.gameName}.`,
        action: <CheckCircle className="text-green-500" />,
        });
    } catch (error) {
         toast({ variant: "destructive", title: "Échec de l'inscription", description: (error as Error).message });
    }
  };

  const handleUnregister = (tableId: string) => {
     if (!currentUser) return;

     const table = tables.find(t => t.id === tableId);
     if (!table) return;

     try {
        removeRegistration(currentUser.id, tableId);
        // Refresh local state after mock mutation
        setRegistrations(getCurrentRegistrations());

        toast({
            title: "Désinscrit(e)",
            description: `Inscription pour ${table.gameName} supprimée.`,
            action: <Info className="text-blue-500" />,
        });
    } catch (error) {
        toast({ variant: "destructive", title: "Échec de la désinscription", description: (error as Error).message });
    }
  }


  const getUserSchedule = (): GameTable[] => {
    if (!currentUser) return [];
    const userTableIds = registrations.filter(r => r.userId === currentUser.id).map(r => r.tableId);
    // Filter from the current state of tables
    return tables.filter(t => userTableIds.includes(t.id))
                 .sort((a, b) => { // Sort schedule by day then time
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
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>Sélection utilisateur & Infos</CardTitle>
                <CardDescription>Sélectionnez un utilisateur pour voir les tables et gérer les inscriptions.</CardDescription>
            </div>
             {/* Manual Refresh Button - Useful for mock data setup */}
             <Button onClick={loadData} variant="outline" size="sm" disabled={isLoading}>
                 <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                 Actualiser les données
             </Button>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <Select onValueChange={handleUserChange} value={currentUser?.id ?? ""}>
            <SelectTrigger className="w-[280px]">
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
            <Badge variant={currentUser.ticketType === 'Aucun' ? 'destructive' : 'secondary'}>
              Billet : {currentUser.ticketType}
            </Badge>
          )}
           <Badge variant="outline" className="ml-auto">
             Phase d'inscription actuelle : <span className="font-semibold ml-1">{registrationPhases[currentRegistrationPhaseIndex]}</span>
           </Badge>
        </CardContent>
      </Card>

       {isLoading ? (
           <div className="flex justify-center items-center h-64"><p>Chargement des tables de jeu...</p></div>
       ) : (
          <>
            <Tabs defaultValue={conventionDays[0].value} className="w-full">
                <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
                {conventionDays.map(day => (
                    <TabsTrigger key={day.value} value={day.value}>{day.name} {day.date}</TabsTrigger>
                ))}
                </TabsList>

                {conventionDays.map(day => {
                    const dayTables = tables.filter(table => table.day === day.name).sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));
                    return (
                        <TabsContent key={day.value} value={day.value}>
                            <Card>
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
                                                    <TableHead>Jeu</TableHead>
                                                    <TableHead>Créneau horaire</TableHead>
                                                    <TableHead className="text-center">Places disponibles</TableHead>
                                                    <TableHead className="text-right">Action</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {dayTables.map((table) => {
                                                    const availableSeats = getAvailableSeats(table.id, registrations, tables);
                                                    const isRegisteredByUser = currentUser && registrations.some(r => r.userId === currentUser.id && r.tableId === table.id);
                                                    const canRegisterNow = currentUser && canRegisterBasedOnTicket(currentUser.ticketType, currentRegistrationPhaseIndex);
                                                    // Calculate conflicts based on *current* registrations state
                                                    const userCurrentRegistrations = registrations.filter(r => r.userId === currentUser?.id);
                                                    const conflict = currentUser && hasTimeConflict(table, userCurrentRegistrations, tables);

                                                    const isDisabled = !currentUser || availableSeats <= 0 || !canRegisterNow || (conflict && !isRegisteredByUser) || (isRegisteredByUser);

                                                    let buttonText = "S'inscrire";
                                                    let buttonVariant: "default" | "secondary" | "destructive" = "default";
                                                    let onClickAction = () => handleRegister(table.id);
                                                    let tooltipText = "";

                                                    if (isRegisteredByUser) {
                                                        buttonText = "Inscrit(e)";
                                                        buttonVariant = "secondary";
                                                        onClickAction = () => handleUnregister(table.id); // Change to unregister
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

                                                    return (
                                                        <TableRow key={table.id} className={isRegisteredByUser ? "bg-secondary/30" : ""}>
                                                            <TableCell className="font-medium flex items-center gap-2">
                                                                {table.imageUrl && (
                                                                    <Image
                                                                        src={table.imageUrl}
                                                                        alt={`Icône ${table.gameName}`}
                                                                        width={24} // Adjust size as needed
                                                                        height={24}
                                                                        className="rounded object-cover h-6 w-6" // Style the image
                                                                        data-ai-hint="game icon"
                                                                    />
                                                                )}
                                                                {!table.imageUrl && <div className="h-6 w-6 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">?</div> /* Placeholder */}
                                                                {table.gameName}
                                                            </TableCell>
                                                            <TableCell><Clock className="inline h-4 w-4 mr-1 text-muted-foreground" />{table.timeSlot}</TableCell>
                                                            <TableCell className="text-center">
                                                                <Badge variant={availableSeats > 0 ? "default" : "destructive"} className="bg-accent text-accent-foreground px-2 py-1">
                                                                    <Users className="inline h-4 w-4 mr-1" /> {availableSeats} / {table.totalSeats}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <Button
                                                                    onClick={onClickAction}
                                                                    size="sm"
                                                                    variant={buttonVariant}
                                                                    disabled={isDisabled && !isRegisteredByUser} // Can always unregister if registered
                                                                    aria-label={tooltipText || buttonText}
                                                                    title={tooltipText || buttonText}
                                                                >
                                                                    {isRegisteredByUser && <CheckCircle className="mr-2 h-4 w-4" />}
                                                                    {!isRegisteredByUser && (availableSeats <= 0 || conflict) && <AlertCircle className="mr-2 h-4 w-4" />}
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
                <Card className="mt-6 shadow-lg">
                <CardHeader>
                    <CardTitle>Planning de {currentUser.name}</CardTitle>
                    <CardDescription>Tables auxquelles vous êtes actuellement inscrit(e).</CardDescription>
                </CardHeader>
                <CardContent>
                    {userSchedule.length > 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                            <TableHead>Jour</TableHead>
                            <TableHead>Créneau horaire</TableHead>
                            <TableHead>Jeu</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                        {userSchedule.map(table => {
                            const dayInfo = conventionDays.find(d => d.name === table.day);
                            return (
                                <TableRow key={`schedule-${table.id}`}>
                                <TableCell><CalendarDays className="inline h-4 w-4 mr-1 text-muted-foreground" />{table.day} {dayInfo?.date}</TableCell>
                                <TableCell><Clock className="inline h-4 w-4 mr-1 text-muted-foreground" />{table.timeSlot}</TableCell>
                                <TableCell className="font-medium flex items-center gap-2">
                                        {table.imageUrl && (
                                                <Image
                                                    src={table.imageUrl}
                                                    alt={`Icône ${table.gameName}`}
                                                    width={24} // Adjust size as needed
                                                    height={24}
                                                    className="rounded object-cover h-6 w-6" // Style the image
                                                    data-ai-hint="game icon"
                                                />
                                            )}
                                        {!table.imageUrl && <div className="h-6 w-6 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">?</div> /* Placeholder */}
                                        {table.gameName}
                                </TableCell>
                                <TableCell className="text-right">
                                        <Button
                                        onClick={() => handleUnregister(table.id)}
                                        size="sm"
                                        variant="outline"
                                        title="Se désinscrire de cette table"
                                        >
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
    </div>
  );
}

