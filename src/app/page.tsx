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
import { mockGameTables, mockUsers, mockRegistrations as initialRegistrations, getAvailableSeats, hasTimeConflict, canRegisterBasedOnTicket } from '@/lib/data';
import type { GameTable, User, Registration, TicketType } from '@/lib/types';
import { registrationPhases } from '@/lib/types';
import { Users, CalendarDays, Clock, CheckCircle, AlertCircle, Info } from 'lucide-react';

// Simulate fetching data (replace with actual API calls if needed)
async function fetchData() {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 50));
  return {
    tables: mockGameTables,
    users: mockUsers,
    registrations: initialRegistrations,
  };
}

export default function Home() {
  const [tables, setTables] = useState<GameTable[]>([]);
  const [users, setUsers] = useState<Record<string, User>>({});
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentRegistrationPhaseIndex, setCurrentRegistrationPhaseIndex] = useState(0); // Start with Strategist
  const { toast } = useToast();

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const { tables, users, registrations } = await fetchData();
        setTables(tables);
        setUsers(users);
        setRegistrations(registrations);
        // Set a default user for demo purposes
        setCurrentUser(users['user-123']);
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
    }
    loadData();
  }, [toast]);

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

    // 2. Check Available Seats
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


    // If all checks pass, add registration
    const newRegistration: Registration = { userId: currentUser.id, tableId };
    setRegistrations(prev => [...prev, newRegistration]);

    toast({
      title: "Registration Successful",
      description: `Successfully registered ${currentUser.name} for ${table.gameName}.`,
      action: <CheckCircle className="text-green-500" />,
    });
  };

  const handleUnregister = (tableId: string) => {
     if (!currentUser) return;

     const table = tables.find(t => t.id === tableId);
     if (!table) return;


     setRegistrations(prev => prev.filter(r => !(r.userId === currentUser.id && r.tableId === tableId)));
     toast({
        title: "Unregistered",
        description: `Removed registration for ${table.gameName}.`,
        action: <Info className="text-blue-500" />,
     });
  }


  const getUserSchedule = (): GameTable[] => {
    if (!currentUser) return [];
    const userTableIds = registrations.filter(r => r.userId === currentUser.id).map(r => r.tableId);
    return tables.filter(t => userTableIds.includes(t.id))
                 .sort((a, b) => { // Sort schedule by day then time
                    const dayOrder = ['Thursday', 'Friday', 'Saturday', 'Sunday'];
                    if (a.day !== b.day) {
                        return dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
                    }
                    // Basic time sort (assumes HH:MM format)
                    return a.timeSlot.localeCompare(b.timeSlot);
                 });
  };

  const userSchedule = getUserSchedule();
  const days = ['Thursday', 'Friday', 'Saturday', 'Sunday'];

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><p>Loading game tables...</p></div>;
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>User Selection & Info</CardTitle>
          <CardDescription>Select a user to view tables and manage registrations.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Select onValueChange={handleUserChange} defaultValue={currentUser?.id}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select User" />
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
            <Badge variant={currentUser.ticketType === 'None' ? 'destructive' : 'secondary'}>
              Ticket: {currentUser.ticketType}
            </Badge>
          )}
           <Badge variant="outline" className="ml-auto">
             Current Registration Phase: <span className="font-semibold ml-1">{registrationPhases[currentRegistrationPhaseIndex]}</span>
           </Badge>
        </CardContent>
      </Card>

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
                      const isDisabled = !currentUser || availableSeats <= 0 || !canRegisterNow || (hasTimeConflict(table, registrations.filter(r=> r.userId === currentUser?.id), tables) && !isRegisteredByUser) || (isRegisteredByUser); // Disable if full, ineligible, conflict, or already registered


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
                      } else if (!canRegisterNow) {
                          tooltipText = `Registration not open for ${currentUser.ticketType} yet`;
                          buttonText = "Unavailable";
                          buttonVariant = "secondary";
                      } else if (availableSeats <= 0) {
                          tooltipText = "Table is full";
                           buttonText = "Full";
                           buttonVariant = "destructive";
                      } else if (hasTimeConflict(table, registrations.filter(r=> r.userId === currentUser?.id), tables)) {
                          tooltipText = "Conflicts with your schedule";
                          buttonText = "Conflict";
                           buttonVariant = "destructive";
                      }


                      return (
                        <TableRow key={table.id} className={isRegisteredByUser ? "bg-secondary/30" : ""}>
                          <TableCell className="font-medium flex items-center gap-2">
                             {table.gameTypeIcon && <table.gameTypeIcon className="h-5 w-5 text-muted-foreground" />}
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
                              disabled={isDisabled && !isRegisteredByUser} // Only enable unregister if registered
                              aria-label={tooltipText || buttonText}
                              title={tooltipText || buttonText}
                            >
                              { isRegisteredByUser && <CheckCircle className="mr-2 h-4 w-4" />}
                              { !isRegisteredByUser && availableSeats <=0 && <AlertCircle className="mr-2 h-4 w-4" />}
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
                            {table.gameTypeIcon && <table.gameTypeIcon className="h-5 w-5 text-muted-foreground" />}
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
    </div>
  );
}
