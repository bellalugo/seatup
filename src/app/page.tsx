'use client'; // Required for useState, useEffect, onClick handlers

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
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
      console.error("Failed to load data:", error);
      toast({
        variant: "destructive",
        title: "Error Loading Data",
        description: "Could not fetch game tables and user data.",
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
      toast({ title: "Registration Phase Update", description: "Registration now open for Marshals and Strategists." });
    }, 15000); // 15 seconds after load for demo

    const phaseTimer2 = setTimeout(() => {
      setCurrentRegistrationPhaseIndex(2); // Open for Generals
       toast({ title: "Registration Phase Update", description: "Registration now open for Generals, Marshals, and Strategists." });
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
      toast({ variant: "destructive", title: "No User Selected", description: "Please select a user." });
      return;
    }

    const table = tables.find(t => t.id === tableId);
    if (!table) {
      toast({ variant: "destructive", title: "Table Not Found" });
      return;
    }

    // 1. Check Ticket Eligibility
    if (!canRegisterBasedOnTicket(currentUser.ticketType, currentRegistrationPhaseIndex)) {
       toast({
        variant: "destructive",
        title: "Registration Not Yet Open",
        description: `Registration for your ticket type (${currentUser.ticketType}) opens later. Current phase: ${registrationPhases[currentRegistrationPhaseIndex]}.`,
      });
      return;
    }

    // 2. Check Available Seats (using current registrations state)
    const availableSeats = getAvailableSeats(tableId, registrations, tables);
    if (availableSeats <= 0) {
      toast({ variant: "destructive", title: "Table Full", description: "No available seats at this table." });
      return;
    }

    // 3. Check if Already Registered for this Table
    const isAlreadyRegistered = registrations.some(r => r.userId === currentUser.id && r.tableId === tableId);
    if (isAlreadyRegistered) {
      toast({ variant: "destructive", title: "Already Registered", description: "You are already registered for this table." });
      return;
    }

    // 4. Check for Time Conflicts
    const userCurrentRegistrations = registrations.filter(r => r.userId === currentUser.id);
    if (hasTimeConflict(table, userCurrentRegistrations, tables)) {
       toast({ variant: "destructive", title: "Time Slot Conflict", description: "You are already registered for a game during this time slot." });
       return;
    }


    // If all checks pass, add registration using the mock mutation function
    try {
        addRegistration(currentUser.id, tableId);
        // Refresh local state after mock mutation
        setRegistrations(getCurrentRegistrations());

        toast({
        title: "Registration Successful",
        description: `Successfully registered ${currentUser.name} for ${table.gameName}.`,
        action: <CheckCircle className="text-green-500" />,
        });
    } catch (error) {
         toast({ variant: "destructive", title: "Registration Failed", description: (error as Error).message });
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
            title: "Unregistered",
            description: `Removed registration for ${table.gameName}.`,
            action: <Info className="text-blue-500" />,
        });
    } catch (error) {
        toast({ variant: "destructive", title: "Unregistration Failed", description: (error as Error).message });
    }
  }


  const getUserSchedule = (): GameTable[] => {
    if (!currentUser) return [];
    const userTableIds = registrations.filter(r => r.userId === currentUser.id).map(r => r.tableId);
    // Filter from the current state of tables
    return tables.filter(t => userTableIds.includes(t.id))
                 .sort((a, b) => { // Sort schedule by day then time
                    const dayOrder = ['Thursday', 'Friday', 'Saturday', 'Sunday'];
                    if (a.day !== b.day) {
                        return dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
                    }
                    return a.timeSlot.localeCompare(b.timeSlot);
                 });
  };

  const userSchedule = getUserSchedule();
  const days = ['Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>User Selection & Info</CardTitle>
                <CardDescription>Select a user to view tables and manage registrations.</CardDescription>
            </div>
             {/* Manual Refresh Button - Useful for mock data setup */}
             <Button onClick={loadData} variant="outline" size="sm" disabled={isLoading}>
                 <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                 Refresh Data
             </Button>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <Select onValueChange={handleUserChange} value={currentUser?.id ?? ""}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select User" />
            </SelectTrigger>
            <SelectContent>
               {/* Removed SelectItem with empty value - placeholder is handled by SelectValue */}
              {Object.values(users).map(user => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {currentUser && (
            <Badge variant={currentUser.ticketType === 'None' ? 'destructive' : 'secondary'}>
              Ticket: {currentUser.ticketType}
            </Badge>
          )}
           <Badge variant="outline" className="ml-auto">
             Current Registration Phase: <span className="font-semibold ml-1">{registrationPhases[currentRegistrationPhaseIndex]}</span>
           </Badge>
        </CardContent>
      </Card>

       {isLoading ? (
           <div className="flex justify-center items-center h-64"><p>Loading game tables...</p></div>
       ) : (
          <>
            <Tabs defaultValue="thursday" className="w-full">
                <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
                {days.map(day => (
                    <TabsTrigger key={day} value={day.toLowerCase()}>{day}</TabsTrigger>
                ))}
                </TabsList>

                {days.map(day => (
                <TabsContent key={day} value={day.toLowerCase()}>
                    <Card>
                    <CardHeader>
                        <CardTitle>{day} Game Tables</CardTitle>
                        <CardDescription>Available games for {day}. Registration priority: Strategist {'>'} Marshal {'>'} General.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                        <TableCaption>List of games available on {day}.</TableCaption>
                        <TableHeader>
                            <TableRow>
                            <TableHead>Game</TableHead>
                            <TableHead>Time Slot</TableHead>
                            <TableHead className="text-center">Available Seats</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {tables.filter(table => table.day === day).sort((a, b) => a.timeSlot.localeCompare(b.timeSlot)).map((table) => {
                            const availableSeats = getAvailableSeats(table.id, registrations, tables);
                            const isRegisteredByUser = currentUser && registrations.some(r => r.userId === currentUser.id && r.tableId === table.id);
                            const canRegisterNow = currentUser && canRegisterBasedOnTicket(currentUser.ticketType, currentRegistrationPhaseIndex);
                            // Calculate conflicts based on *current* registrations state
                             const userCurrentRegistrations = registrations.filter(r => r.userId === currentUser?.id);
                            const conflict = currentUser && hasTimeConflict(table, userCurrentRegistrations, tables);

                            const isDisabled = !currentUser || availableSeats <= 0 || !canRegisterNow || (conflict && !isRegisteredByUser) || (isRegisteredByUser);


                            let buttonText = "Register";
                            let buttonVariant: "default" | "secondary" | "destructive" = "default";
                            let onClickAction = () => handleRegister(table.id);
                            let tooltipText = "";

                            if (isRegisteredByUser) {
                                buttonText = "Registered";
                                buttonVariant = "secondary";
                                onClickAction = () => handleUnregister(table.id); // Change to unregister
                                tooltipText = "Click to unregister";
                            } else if (!currentUser) {
                                tooltipText = "Select a user to register";
                                buttonText = "Select User";
                                buttonVariant = "secondary";
                            } else if (!canRegisterNow) {
                                tooltipText = `Registration not open for ${currentUser.ticketType} yet`;
                                buttonText = "Unavailable";
                                buttonVariant = "secondary";
                             } else if (conflict) {
                                tooltipText = "Conflicts with your schedule";
                                buttonText = "Conflict";
                                buttonVariant = "destructive";
                            } else if (availableSeats <= 0) {
                                tooltipText = "Table is full";
                                buttonText = "Full";
                                buttonVariant = "destructive";
                            } else {
                                tooltipText = "Click to register for this table";
                            }


                            return (
                                <TableRow key={table.id} className={isRegisteredByUser ? "bg-secondary/30" : ""}>
                                <TableCell className="font-medium flex items-center gap-2">
                                    {table.gameTypeIcon && React.createElement(table.gameTypeIcon, { className: "h-5 w-5 text-muted-foreground" })}
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
                                    { isRegisteredByUser && <CheckCircle className="mr-2 h-4 w-4" />}
                                    { !isRegisteredByUser && (availableSeats <=0 || conflict) && <AlertCircle className="mr-2 h-4 w-4" />}
                                    {buttonText}
                                    </Button>
                                </TableCell>
                                </TableRow>
                            );
                            })}
                        </TableBody>
                        </Table>
                    </CardContent>
                    </Card>
                </TabsContent>
                ))}
            </Tabs>

            {currentUser && (
                <Card className="mt-6 shadow-lg">
                <CardHeader>
                    <CardTitle>{currentUser.name}'s Schedule</CardTitle>
                    <CardDescription>Tables you are currently registered for.</CardDescription>
                </CardHeader>
                <CardContent>
                    {userSchedule.length > 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                            <TableHead>Day</TableHead>
                            <TableHead>Time Slot</TableHead>
                            <TableHead>Game</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                        {userSchedule.map(table => (
                            <TableRow key={`schedule-${table.id}`}>
                            <TableCell><CalendarDays className="inline h-4 w-4 mr-1 text-muted-foreground" />{table.day}</TableCell>
                            <TableCell><Clock className="inline h-4 w-4 mr-1 text-muted-foreground" />{table.timeSlot}</TableCell>
                            <TableCell className="font-medium flex items-center gap-2">
                                    {table.gameTypeIcon && React.createElement(table.gameTypeIcon, { className: "h-5 w-5 text-muted-foreground" })}
                                    {table.gameName}
                            </TableCell>
                            <TableCell className="text-right">
                                    <Button
                                    onClick={() => handleUnregister(table.id)}
                                    size="sm"
                                    variant="outline"
                                    title="Unregister from this table"
                                    >
                                    Unregister
                                    </Button>
                            </TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                    ) : (
                    <p className="text-muted-foreground text-center py-4">You are not registered for any tables yet.</p>
                    )}
                </CardContent>
                </Card>
            )}
          </>
       )}
    </div>
  );
}
