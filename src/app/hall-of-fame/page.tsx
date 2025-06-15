
'use client';

import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, Trophy, CalendarDays, BarChart3 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAllGameResults, getGameTables, getParticipants, getRegistrations } from '@/lib/data'; // Added getRegistrations
import type { GameResult, GameTable, Participant, Registration } from '@/lib/types'; // Added Registration
import { Button } from '@/components/ui/button';

const conventionDays = ['Jeudi', 'Vendredi', 'Samedi', 'Dimanche'] as const;
type ConventionDay = typeof conventionDays[number];

interface PlayerScore {
  id: string;
  name: string;
  email: string;
  dailyScores: Record<ConventionDay, number>;
  totalScore: number;
  gamesPlayed: number;
  wins: number;
}

interface RankedPlayer extends PlayerScore {
  rank: number;
}

export default function HallOfFamePage() {
  const [rankedPlayersOverall, setRankedPlayersOverall] = useState<RankedPlayer[]>([]);
  const [dailyRankings, setDailyRankings] = useState<Record<ConventionDay, RankedPlayer[]>>({
    Jeudi: [],
    Vendredi: [],
    Samedi: [],
    Dimanche: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const calculateScores = useCallback((
    gameResults: GameResult[],
    gameTables: GameTable[],
    participants: Participant[],
    registrations: Registration[] // Added registrations parameter
  ): { overall: RankedPlayer[], daily: Record<ConventionDay, RankedPlayer[]> } => {
    const playerScores: Map<string, PlayerScore> = new Map();
    const gameTablesMap = new Map(gameTables.map(t => [t.id, t]));

    // Initialize scores for all participants
    participants.forEach(p => {
      if (p.ticketType !== 'Invitation') { // Exclude 'Invitation' ticket holders from rankings
        playerScores.set(p.id, {
          id: p.id,
          name: `${p.prenom} ${p.nom}`,
          email: p.email,
          dailyScores: { Jeudi: 0, Vendredi: 0, Samedi: 0, Dimanche: 0 },
          totalScore: 0,
          gamesPlayed: 0, // Initialized to 0
          wins: 0,
        });
      }
    });
    
    // Calculate wins and scores based on game results
    gameResults.forEach(result => {
      const table = gameTablesMap.get(result.tableId);
      if (!table || !conventionDays.includes(table.day as ConventionDay)) return;

      const day = table.day as ConventionDay;
      const pointsPerWin = result.playersInGame >= 5 ? 2 : 1; // Condition changed to >= 5

      result.winnerIds.forEach(winnerId => {
        const participantData = playerScores.get(winnerId);
        if (participantData) {
          participantData.dailyScores[day] += pointsPerWin;
          participantData.totalScore += pointsPerWin;
          participantData.wins += 1;
        }
      });
    });

    // Correctly calculate gamesPlayed
    // A game is considered "played" by a participant if they were registered for a table
    // AND that table has a game result recorded.
    const gameResultTableIds = new Set(gameResults.map(gr => gr.tableId));

    registrations.forEach(registration => {
      if (gameResultTableIds.has(registration.tableId)) {
        const participantData = playerScores.get(registration.userId);
        if (participantData) {
          participantData.gamesPlayed += 1;
        }
      }
    });

    const allPlayersArray = Array.from(playerScores.values());

    // Calculate overall ranking
    const sortedOverall = [...allPlayersArray]
      .sort((a, b) => b.totalScore - a.totalScore || a.name.localeCompare(b.name))
      .map((player, index) => ({ ...player, rank: index + 1 }));

    // Calculate daily rankings
    const daily: Record<ConventionDay, RankedPlayer[]> = { Jeudi: [], Vendredi: [], Samedi: [], Dimanche: [] };
    conventionDays.forEach(day => {
      daily[day] = [...allPlayersArray]
        .filter(p => p.dailyScores[day] > 0 || playerScores.get(p.id)?.gamesPlayed > 0) // Also include players who played but didn't score on a given day for daily tables
        .sort((a, b) => b.dailyScores[day] - a.dailyScores[day] || a.name.localeCompare(b.name))
        .map((player, index) => ({ ...player, rank: index + 1 }));
    });

    return { overall: sortedOverall, daily };
  }, []);

  const loadHallOfFameData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [results, tables, participants, registrationsData] = await Promise.all([ // Added registrationsData
        getAllGameResults(),
        getGameTables(),
        getParticipants(),
        getRegistrations(), // Fetch registrations
      ]);

      if (!results || !tables || !participants || !registrationsData) { // Check registrationsData
          throw new Error("Données de base manquantes (résultats, tables, participants ou inscriptions) pour calculer le Hall of Fame.");
      }
      
      const { overall, daily } = calculateScores(results, tables, participants, registrationsData); // Pass registrationsData
      setRankedPlayersOverall(overall);
      setDailyRankings(daily);

    } catch (err) {
      console.error("Erreur chargement Hall of Fame:", err);
      const errorMessage = err instanceof Error ? err.message : "Erreur inconnue";
      setError(errorMessage);
      toast({ variant: "destructive", title: "Erreur de chargement", description: errorMessage });
    } finally {
      setIsLoading(false);
    }
  }, [toast, calculateScores]);

  useEffect(() => {
    loadHallOfFameData();
  }, [loadHallOfFameData]);

  const renderRankingTable = (players: RankedPlayer[], caption: string, isDaily: boolean = false, day?: ConventionDay) => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="ml-2 text-muted-foreground">Chargement du classement...</p>
        </div>
      );
    }
    if (players.length === 0 && !isLoading) {
      return <p className="text-muted-foreground text-center py-6">Aucune donnée de classement disponible pour {caption.toLowerCase().replace('classement ', '')}.</p>;
    }

    return (
      <Table>
        <TableCaption>{caption}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16 text-center">Rang</TableHead>
            <TableHead>Participant</TableHead>
            <TableHead className="text-center">Parties Jouées</TableHead>
            <TableHead className="text-center">Victoires</TableHead>
            <TableHead className="w-24 text-center">Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.map((player) => (
            <TableRow key={player.id}>
              <TableCell className="text-center font-medium">
                {player.rank === 1 && <Trophy className="inline h-5 w-5 mr-1 text-amber-500" />}
                {player.rank === 2 && <Trophy className="inline h-5 w-5 mr-1 text-slate-400" />}
                {player.rank === 3 && <Trophy className="inline h-5 w-5 mr-1 text-yellow-700" />}
                {player.rank}
              </TableCell>
              <TableCell>
                <div className="font-medium">{player.name}</div>
                <div className="text-xs text-muted-foreground">{player.email}</div>
              </TableCell>
              <TableCell className="text-center">{player.gamesPlayed}</TableCell>
              <TableCell className="text-center">{player.wins}</TableCell>
              <TableCell className="text-center font-bold">
                {isDaily && day ? player.dailyScores[day] : player.totalScore}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };


  if (error) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center">
            <AlertTriangle className="mr-2 h-6 w-6" /> Erreur de chargement du Hall of Fame
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>{error}</p>
          <Button onClick={loadHallOfFameData} className="mt-4">Réessayer</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <Card className="shadow-xl bg-gradient-to-br from-primary/10 via-background to-background">
        <CardHeader className="text-center">
           <div className="mx-auto bg-primary rounded-full p-4 w-fit mb-4 shadow-md">
             <Trophy className="h-10 w-10 text-primary-foreground" />
           </div>
          <CardTitle className="text-4xl font-bold tracking-tight">Hall of Fame - ASYNCONV</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Classement des Maîtres Stratèges de la convention !
          </CardDescription>
          <Badge variant="outline" className="mx-auto mt-2">Points: 1 par victoire (+1 bonus si 5+ joueurs)</Badge>
        </CardHeader>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="mr-3 h-7 w-7 text-primary" />
            Classement Général (Tous les jours)
          </CardTitle>
          <CardDescription>Performance globale des participants sur l'ensemble de la convention.</CardDescription>
        </CardHeader>
        <CardContent>
          {renderRankingTable(rankedPlayersOverall, "Classement général sur les 4 jours")}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <CalendarDays className="mr-3 h-7 w-7 text-primary" />
            Classements Journaliers
          </CardTitle>
          <CardDescription>Performance des participants pour chaque jour de la convention.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={conventionDays[0]} className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
              {conventionDays.map(day => (
                <TabsTrigger key={day} value={day}>{day}</TabsTrigger>
              ))}
            </TabsList>
            {conventionDays.map(day => (
              <TabsContent key={`content-${day}`} value={day} className="mt-4">
                {renderRankingTable(dailyRankings[day], `Classement du ${day}`, true, day)}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
      

    
