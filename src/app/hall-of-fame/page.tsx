'use client';

import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, AlertTriangle, Trophy, CalendarDays, BarChart3, Star, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAllGameResults, getSlots, getParticipants, getRegistrations } from '@/lib/data';
import type { GameResult, Slot, Participant, Registration, ConventionDay } from '@/lib/types';
import { CONVENTION_DAYS } from '@/lib/types';
import { Button } from '@/components/ui/button';

interface PlayerScore {
  id: string;
  name: string;
  dailyPoints: Record<ConventionDay, number>;
  dailyWins: Record<ConventionDay, number>;
  dailyGames: Record<ConventionDay, number>;
  points: number;
  wins: number;
  games: number;
}

interface RankedPlayer extends PlayerScore {
  rank: number;
}


export default function HallOfFamePage() {
  const [byPoints, setByPoints] = useState<RankedPlayer[]>([]);
  const [byWins, setByWins] = useState<RankedPlayer[]>([]);
  const [dailyRankings, setDailyRankings] = useState<Record<ConventionDay, RankedPlayer[]>>(
    () => Object.fromEntries(CONVENTION_DAYS.map(d => [d, [] as RankedPlayer[]])) as Record<ConventionDay, RankedPlayer[]>
  );
  const [hasAnyResults, setHasAnyResults] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const calculateScores = useCallback((
    gameResults: GameResult[],
    slots: Slot[],
    participants: Participant[],
    registrations: Registration[]
  ): { byPoints: RankedPlayer[]; byWins: RankedPlayer[]; daily: Record<ConventionDay, RankedPlayer[]> } => {
    const playerScores: Map<string, PlayerScore> = new Map();
    const slotsMap = new Map(slots.map(s => [s.id, s]));

    const emptyDailyRecord = (): Record<ConventionDay, number> =>
      Object.fromEntries(CONVENTION_DAYS.map(d => [d, 0])) as Record<ConventionDay, number>;

    // On inclut tous les participants (y compris les billets Auteur/Animateur, classés en
    // 'Invitation') : ceux qui n'ont rien joué seront de toute façon écartés des classements
    // par les filtres points>0 / wins>0 plus bas.
    participants.forEach(p => {
      const formattedName = `${p.prenom || ''} ${p.nom ? p.nom.charAt(0) + '.' : ''}`.trim();
      playerScores.set(p.id, {
        id: p.id,
        name: formattedName,
        dailyPoints: emptyDailyRecord(),
        dailyWins: emptyDailyRecord(),
        dailyGames: emptyDailyRecord(),
        points: 0,
        wins: 0,
        games: 0,
      });
    });

    const dayOfSlot = (slot: Slot | undefined): ConventionDay | null => {
      const day = slot?.cells?.[0]?.day;
      return day && CONVENTION_DAYS.includes(day) ? day : null;
    };

    // Points par position : 1er = N pts, 2e = N-1, ... (min 1). Le 1er compte une victoire.
    gameResults.forEach(result => {
      const slot = slotsMap.get(result.tableId);
      const day = dayOfSlot(slot);
      if (!day) return;
      const ranking = (result.ranking && result.ranking.length) ? result.ranking : null;
      if (ranking) {
        // Le classement liste TOUS les joueurs (animateur-joueur inclus) → points + partie jouée.
        const N = ranking.length;
        ranking.forEach((pid, i) => {
          const player = playerScores.get(pid);
          if (!player) return;
          player.dailyPoints[day] += Math.max(1, N - i);
          player.points += Math.max(1, N - i);
          player.dailyGames[day] += 1;
          player.games += 1;
          if (i === 0) { player.dailyWins[day] += 1; player.wins += 1; }
        });
      } else {
        // Anciens résultats sans classement complet : seul le vainqueur est connu ;
        // les parties jouées sont déduites des inscriptions du slot.
        const pts = Math.max(1, result.playersInGame || 1);
        (result.winnerIds || []).forEach(pid => {
          const player = playerScores.get(pid);
          if (!player) return;
          player.dailyPoints[day] += pts;
          player.points += pts;
          player.dailyWins[day] += 1;
          player.wins += 1;
        });
        registrations.filter(r => r.slotId === result.tableId).forEach(r => {
          const player = playerScores.get(r.userId);
          if (!player) return;
          player.dailyGames[day] += 1;
          player.games += 1;
        });
      }
    });

    const all = Array.from(playerScores.values());

    const rankedByPoints = all
      .filter(p => p.points > 0)
      .sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name))
      .map((p, i) => ({ ...p, rank: i + 1 }));

    const rankedByWins = all
      .filter(p => p.wins > 0)
      .sort((a, b) => b.wins - a.wins || b.points - a.points || a.name.localeCompare(b.name))
      .map((p, i) => ({ ...p, rank: i + 1 }));

    const daily: Record<ConventionDay, RankedPlayer[]> = Object.fromEntries(
      CONVENTION_DAYS.map(d => [d, [] as RankedPlayer[]])
    ) as Record<ConventionDay, RankedPlayer[]>;
    CONVENTION_DAYS.forEach(day => {
      daily[day] = all
        .filter(p => p.dailyPoints[day] > 0)
        .sort((a, b) => b.dailyPoints[day] - a.dailyPoints[day] || b.dailyWins[day] - a.dailyWins[day] || a.name.localeCompare(b.name))
        .map((p, i) => ({ ...p, rank: i + 1 }));
    });

    return { byPoints: rankedByPoints, byWins: rankedByWins, daily };
  }, []);

  const loadHallOfFameData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [results, slots, participants, registrationsData] = await Promise.all([
        getAllGameResults(),
        getSlots(),
        getParticipants(),
        getRegistrations(),
      ]);

      setHasAnyResults((results?.length || 0) > 0);

      const { byPoints: bp, byWins: bw, daily } = calculateScores(results, slots, participants, registrationsData);
      setByPoints(bp);
      setByWins(bw);
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

  const renderRankingTable = (players: RankedPlayer[], caption: string, day?: ConventionDay) => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="ml-2 text-muted-foreground">Chargement du classement...</p>
        </div>
      );
    }
    if (players.length === 0) {
      return <p className="text-muted-foreground text-center py-6">Aucune donnée de classement disponible pour le moment.</p>;
    }

    const games = (p: RankedPlayer) => day ? p.dailyGames[day] : p.games;
    const wins = (p: RankedPlayer) => day ? p.dailyWins[day] : p.wins;
    const points = (p: RankedPlayer) => day ? p.dailyPoints[day] : p.points;

    return (
      <Table>
        <TableCaption>{caption}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16 text-center">Rang</TableHead>
            <TableHead>Participant</TableHead>
            <TableHead className="text-center">Parties jouées</TableHead>
            <TableHead className="text-center font-bold text-foreground">Victoires</TableHead>
            <TableHead className="text-center font-bold text-foreground">Points</TableHead>
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
              <TableCell><div className="font-medium">{player.name}</div></TableCell>
              <TableCell className="text-center">{games(player)}</TableCell>
              <TableCell className="text-center font-bold">
                <div className="flex items-center justify-center">
                  {wins(player)}
                  {wins(player) > 0 && <Star className="ml-1 h-4 w-4 text-amber-500 fill-amber-500" />}
                </div>
              </TableCell>
              <TableCell className="text-center font-bold">{points(player)}</TableCell>
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
      <Card className="shadow-xl bg-primary">
        <CardHeader className="text-center">
          <div className="mx-auto bg-black rounded-full p-4 w-fit mb-4 shadow-md">
            <Trophy className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-4xl font-bold tracking-tight text-primary-foreground">ASYNCONV 5|5 : HALL OF FAME (for the fun !)</CardTitle>
          <CardDescription className="text-lg text-primary-foreground/90">
            Deux classements : nombre de victoires (prestige) et nombre de points (régularité).
          </CardDescription>
          <div className="mx-auto mt-3 max-w-2xl rounded-md bg-black text-white text-sm px-4 py-2 text-center">
            Points : gagner une partie à N joueurs rapporte (N + 1 - position dans le classement) points.<br />Exemple : être deuxième dans une partie à 5 joueurs rapporte 4 points.
          </div>
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
            <Star className="mr-3 h-7 w-7 text-primary fill-primary" />
            Classement par points (régularité)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {renderRankingTable(byPoints, "Classement général par points")}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="mr-3 h-7 w-7 text-primary" />
            Classement par nombre de victoires
          </CardTitle>
          <CardDescription>Nombre total de parties gagnées sur l&apos;ensemble de la convention.</CardDescription>
        </CardHeader>
        <CardContent>
          {renderRankingTable(byWins, "Classement général par victoires")}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <CalendarDays className="mr-3 h-7 w-7 text-primary" />
            Classements journaliers (par points)
          </CardTitle>
          <CardDescription>Performance par jour de la convention.</CardDescription>
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
                {renderRankingTable(dailyRankings[day], `Classement du ${day}`, day)}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
