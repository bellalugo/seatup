

'use client';

import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, Trophy, CalendarDays, BarChart3, Star, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAllGameResults, getGameTables, getParticipants, getRegistrations } from '@/lib/data';
import type { GameResult, GameTable, Participant, Registration, ConventionDay } from '@/lib/types';
import { CONVENTION_DAYS } from '@/lib/types'; // Import CONVENTION_DAYS
import { Button } from '@/components/ui/button';

// conventionDays already defined in types, use the imported one
// const conventionDays = ['Jeudi', 'Vendredi', 'Samedi', 'Dimanche'] as const;
// type ConventionDay = typeof conventionDays[number]; // Use imported ConventionDay

interface PlayerScore {
  id: string;
  name: string;
  // email: string; // Email is kept in the data structure, but not displayed
  dailyScores: Record<ConventionDay, number>;
  dailyGamesPlayed: Record<ConventionDay, number>;
  dailyWins: Record<ConventionDay, number>;
  totalScore: number;
  gamesPlayed: number;
  wins: number;
}

interface RankedPlayer extends PlayerScore {
  rank: number;
}

export default function HallOfFamePage() {
  const [rankedPlayersOverall, setRankedPlayersOverall] = useState<RankedPlayer[]>([]);
  const [dailyRankings, setDailyRankings] = useState<Record<ConventionDay, RankedPlayer[]>>(
    () => Object.fromEntries(CONVENTION_DAYS.map(d => [d, [] as RankedPlayer[]])) as Record<ConventionDay, RankedPlayer[]>
  );
  const [hasAnyResults, setHasAnyResults] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const calculateScores = useCallback((
    gameResults: GameResult[],
    gameTables: GameTable[],
    participants: Participant[],
    registrations: Registration[]
  ): { overall: RankedPlayer[], daily: Record<ConventionDay, RankedPlayer[]> } => {
    const playerScores: Map<string, PlayerScore> = new Map();
    const gameTablesMap = new Map(gameTables.map(t => [t.id, t]));

    // Initialize scores for all participants
    const emptyDailyRecord = (): Record<ConventionDay, number> =>
      Object.fromEntries(CONVENTION_DAYS.map(d => [d, 0])) as Record<ConventionDay, number>;

    participants.forEach(p => {
      if (p.typeBillet !== 'Invitation') {
        const formattedName = `${p.prenom || ''} ${p.nom ? p.nom.charAt(0) + '.' : ''}`.trim();
        playerScores.set(p.id, {
          id: p.id,
          name: formattedName,
          // email: p.email, // Not displayed
          dailyScores: emptyDailyRecord(),
          dailyGamesPlayed: emptyDailyRecord(),
          dailyWins: emptyDailyRecord(),
          totalScore: 0,
          gamesPlayed: 0,
          wins: 0,
        });
      }
    });
    
    // Calculate daily wins, total wins, daily scores, and total scores
    gameResults.forEach(result => {
      const table = gameTablesMap.get(result.tableId);
      if (!table || !table.days || table.days.length === 0) return; // Table not found or has no days defined
      
      const dayForScore = table.days[0]; // Attribute score to the first day of the table's schedule
      if (!CONVENTION_DAYS.includes(dayForScore)) return; // Ensure this chosen day is a valid convention day

      const pointsPerWin = result.playersInGame >= 5 ? 2 : 1;

      result.winnerIds.forEach(winnerId => {
        const participantData = playerScores.get(winnerId);
        if (participantData) {
          participantData.dailyScores[dayForScore] += pointsPerWin;
          participantData.totalScore += pointsPerWin;
          participantData.dailyWins[dayForScore] += 1; 
          participantData.wins += 1;           
        }
      });
    });

    // Calculate daily games played and total games played
    const gameResultTableIds = new Set(gameResults.map(gr => gr.tableId));
    registrations.forEach(registration => {
      const table = gameTablesMap.get(registration.tableId);
      // Ensure the table exists and a result is recorded for it
      if (table && gameResultTableIds.has(registration.tableId)) {
        if (!table.days || table.days.length === 0) return; // Skip if table has no days

        const dayForGamePlayed = table.days[0]; // Attribute game played to the first day of the table's schedule
        // Ensure the table's day is a valid convention day
        if (CONVENTION_DAYS.includes(dayForGamePlayed)) {
          const participantData = playerScores.get(registration.userId);
          if (participantData) {
            participantData.dailyGamesPlayed[dayForGamePlayed] += 1; 
            participantData.gamesPlayed += 1;          
          }
        }
      }
    });

    const allPlayersArray = Array.from(playerScores.values());

    // Calculate overall ranking
    const sortedOverall = [...allPlayersArray]
      .filter(p => p.totalScore > 0)
      .sort((a, b) => b.totalScore - a.totalScore || a.name.localeCompare(b.name))
      .map((player, index) => ({ ...player, rank: index + 1 }));

    // Calculate daily rankings
    const daily: Record<ConventionDay, RankedPlayer[]> = Object.fromEntries(
      CONVENTION_DAYS.map(d => [d, [] as RankedPlayer[]])
    ) as Record<ConventionDay, RankedPlayer[]>;
    CONVENTION_DAYS.forEach(day => {
      daily[day] = [...allPlayersArray]
        .filter(p => p.dailyScores[day] > 0)
        .sort((a, b) => b.dailyScores[day] - a.dailyScores[day] || a.name.localeCompare(b.name))
        .map((player, index) => ({ ...player, rank: index + 1 }));
    });

    return { overall: sortedOverall, daily };
  }, []);

  const loadHallOfFameData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [results, tables, participants, registrationsData] = await Promise.all([
        getAllGameResults(),
        getGameTables(),
        getParticipants(),
        getRegistrations(),
      ]);

      if (!results || !tables || !participants || !registrationsData) {
          throw new Error("Données de base manquantes (résultats, tables, participants ou inscriptions) pour calculer le Hall of Fame.");
      }

      setHasAnyResults(results.length > 0);

      const { overall, daily } = calculateScores(results, tables, participants, registrationsData);
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
            <TableHead className="text-center">Nombre de parties jouées</TableHead>
            <TableHead className="text-center">Victoires</TableHead>
            <TableHead className="w-24 text-center">Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.map((player) => {
            const currentScore = isDaily && day ? player.dailyScores[day] : player.totalScore;
            return (
              <TableRow key={player.id}>
                <TableCell className="text-center font-medium">
                  {player.rank === 1 && <Trophy className="inline h-5 w-5 mr-1 text-amber-500" />}
                  {player.rank === 2 && <Trophy className="inline h-5 w-5 mr-1 text-slate-400" />}
                  {player.rank === 3 && <Trophy className="inline h-5 w-5 mr-1 text-yellow-700" />}
                  {player.rank}
                </TableCell>
                <TableCell>
                  <div className="font-medium">{player.name}</div>
                </TableCell>
                <TableCell className="text-center">
                  {isDaily && day ? player.dailyGamesPlayed[day] : player.gamesPlayed}
                </TableCell>
                <TableCell className="text-center">
                  {isDaily && day ? player.dailyWins[day] : player.wins}
                </TableCell>
                <TableCell className="text-center font-bold">
                  <div className="flex items-center justify-center">
                    {currentScore === 0 ? '-' : currentScore}
                    {currentScore > 0 && <Star className="ml-1 h-4 w-4 text-black fill-black" />}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
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
      <Card className="shadow-xl bg-primary">
        <CardHeader className="text-center">
           <div className="mx-auto bg-black rounded-full p-4 w-fit mb-4 shadow-md">
             <Trophy className="h-10 w-10 text-primary" />
           </div>
          <CardTitle className="text-4xl font-bold tracking-tight text-primary-foreground">ASYNCONV26 : HALL OF FAME (for the fun !)</CardTitle>
          <CardDescription className="text-lg text-primary-foreground/90">
            Classement des Grands Maîtres de la convention !
          </CardDescription>
          <Badge variant="outline" className="mx-auto mt-2 border-primary-foreground/50 text-primary-foreground/90 flex items-center gap-1">
            <Star className="inline-block h-3.5 w-3.5 text-primary-foreground fill-primary-foreground" /> par victoire | Bonus de <Star className="inline-block h-3.5 w-3.5 text-primary-foreground fill-primary-foreground" /> par victoire si la partie compte 5 joueurs ou plus
          </Badge>
        </CardHeader>
      </Card>

      {!isLoading && !hasAnyResults && (
        <Card className="shadow-lg border-primary/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3 p-4 bg-muted/40 rounded-md">
              <Info className="h-5 w-5 mt-0.5 flex-shrink-0 text-primary" />
              <div className="text-sm">
                <p className="font-semibold">Aucun classement disponible pour le moment.</p>
                <p className="text-muted-foreground">
                  Le calcul du Hall of Fame se fera dès l&apos;enregistrement du premier résultat de partie.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="mr-3 h-7 w-7 text-primary" />
            Classement Général (Tous les jours)
          </CardTitle>
          <CardDescription>Performance globale des participants sur l'ensemble de la convention.</CardDescription>
        </CardHeader>
        <CardContent>
          {renderRankingTable(rankedPlayersOverall, "Classement général sur les 5 jours")}
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
          <Tabs defaultValue={CONVENTION_DAYS[0]} className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
              {CONVENTION_DAYS.map(day => (
                <TabsTrigger key={day} value={day}>{day}</TabsTrigger>
              ))}
            </TabsList>
            {CONVENTION_DAYS.map(day => (
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
