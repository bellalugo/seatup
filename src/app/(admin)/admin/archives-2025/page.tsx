'use client';

import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, Trophy, CalendarDays, BarChart3, Star, Info, ArrowLeft, Archive, Dices, LayoutGrid, Mic, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
    getArchivedGameResults,
    getArchivedGameTables,
    getArchivedGames,
    getArchivedParticipants,
    getArchivedRegistrations,
} from '@/lib/data';
import { getTimeSlotTypeDisplayLabel } from '@/lib/types';
import type { Game, GameResult, GameTable, Participant, Registration, ConventionDay } from '@/lib/types';

// The 2025 edition used 4 days only — we keep this hard-coded here because the live CONVENTION_DAYS
// constant has since been extended to 5 days for 2026. This page is frozen in time on purpose.
// (Archives view also lists archived games and tables-by-day as a reference for the 2026 edition.)
const DAYS_2025 = ['Jeudi', 'Vendredi', 'Samedi', 'Dimanche'] as const;
type Day2025 = typeof DAYS_2025[number];

interface PlayerScore {
  id: string;
  name: string;
  dailyScores: Record<Day2025, number>;
  dailyGamesPlayed: Record<Day2025, number>;
  dailyWins: Record<Day2025, number>;
  totalScore: number;
  gamesPlayed: number;
  wins: number;
}

interface RankedPlayer extends PlayerScore {
  rank: number;
}

export default function Archives2025Page() {
  const [rankedOverall, setRankedOverall] = useState<RankedPlayer[]>([]);
  const [dailyRankings, setDailyRankings] = useState<Record<Day2025, RankedPlayer[]>>(
    () => Object.fromEntries(DAYS_2025.map(d => [d, [] as RankedPlayer[]])) as Record<Day2025, RankedPlayer[]>
  );
  const [hasAnyResults, setHasAnyResults] = useState(false);
  const [archivedGames, setArchivedGames] = useState<Game[]>([]);
  const [archivedTables, setArchivedTables] = useState<GameTable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const computeScores = useCallback((
    results: GameResult[],
    tables: GameTable[],
    participants: Participant[],
    registrations: Registration[]
  ) => {
    const playerScores = new Map<string, PlayerScore>();
    const tablesMap = new Map(tables.map(t => [t.id, t]));

    const emptyRecord = (): Record<Day2025, number> =>
      Object.fromEntries(DAYS_2025.map(d => [d, 0])) as Record<Day2025, number>;

    participants.forEach(p => {
      if (p.typeBillet !== 'Invitation') {
        const formattedName = `${p.prenom || ''} ${p.nom ? p.nom.charAt(0) + '.' : ''}`.trim();
        playerScores.set(p.id, {
          id: p.id,
          name: formattedName,
          dailyScores: emptyRecord(),
          dailyGamesPlayed: emptyRecord(),
          dailyWins: emptyRecord(),
          totalScore: 0,
          gamesPlayed: 0,
          wins: 0,
        });
      }
    });

    results.forEach(result => {
      const table = tablesMap.get(result.tableId);
      if (!table || !table.days || table.days.length === 0) return;
      const dayForScore = table.days[0] as ConventionDay;
      if (!DAYS_2025.includes(dayForScore as Day2025)) return;
      const day = dayForScore as Day2025;

      const pointsPerWin = result.playersInGame >= 5 ? 2 : 1;
      result.winnerIds.forEach(winnerId => {
        const p = playerScores.get(winnerId);
        if (p) {
          p.dailyScores[day] += pointsPerWin;
          p.totalScore += pointsPerWin;
          p.dailyWins[day] += 1;
          p.wins += 1;
        }
      });
    });

    const resultTableIds = new Set(results.map(r => r.tableId));
    registrations.forEach(reg => {
      const table = tablesMap.get(reg.tableId);
      if (!table || !resultTableIds.has(reg.tableId)) return;
      if (!table.days || table.days.length === 0) return;
      const day = table.days[0] as ConventionDay;
      if (!DAYS_2025.includes(day as Day2025)) return;
      const p = playerScores.get(reg.userId);
      if (p) {
        p.dailyGamesPlayed[day as Day2025] += 1;
        p.gamesPlayed += 1;
      }
    });

    const players = Array.from(playerScores.values());
    const overall = [...players]
      .filter(p => p.totalScore > 0)
      .sort((a, b) => b.totalScore - a.totalScore || a.name.localeCompare(b.name))
      .map((p, i) => ({ ...p, rank: i + 1 }));

    const daily: Record<Day2025, RankedPlayer[]> = Object.fromEntries(
      DAYS_2025.map(d => [d, [] as RankedPlayer[]])
    ) as Record<Day2025, RankedPlayer[]>;
    DAYS_2025.forEach(day => {
      daily[day] = [...players]
        .filter(p => p.dailyScores[day] > 0)
        .sort((a, b) => b.dailyScores[day] - a.dailyScores[day] || a.name.localeCompare(b.name))
        .map((p, i) => ({ ...p, rank: i + 1 }));
    });

    return { overall, daily };
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [results, tables, games, participants, registrations] = await Promise.all([
        getArchivedGameResults(),
        getArchivedGameTables(),
        getArchivedGames(),
        getArchivedParticipants(),
        getArchivedRegistrations(),
      ]);

      setHasAnyResults(results.length > 0);
      setArchivedGames(games);
      setArchivedTables(tables);
      const { overall, daily } = computeScores(results, tables, participants, registrations);
      setRankedOverall(overall);
      setDailyRankings(daily);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      setError(msg);
      toast({ variant: "destructive", title: "Erreur de chargement", description: msg });
    } finally {
      setIsLoading(false);
    }
  }, [toast, computeScores]);

  useEffect(() => { load(); }, [load]);

  const renderRankingTable = (players: RankedPlayer[], caption: string, isDaily = false, day?: Day2025) => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="ml-2 text-muted-foreground">Chargement du classement archivé...</p>
        </div>
      );
    }
    if (players.length === 0) {
      return <p className="text-muted-foreground text-center py-6">Aucune donnée archivée disponible.</p>;
    }
    return (
      <Table>
        <TableCaption>{caption}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16 text-center">Rang</TableHead>
            <TableHead>Participant</TableHead>
            <TableHead className="text-center">Parties jouées</TableHead>
            <TableHead className="text-center">Victoires</TableHead>
            <TableHead className="w-24 text-center">Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.map(p => {
            const score = isDaily && day ? p.dailyScores[day] : p.totalScore;
            return (
              <TableRow key={p.id}>
                <TableCell className="text-center font-medium">
                  {p.rank === 1 && <Trophy className="inline h-5 w-5 mr-1 text-amber-500" />}
                  {p.rank === 2 && <Trophy className="inline h-5 w-5 mr-1 text-slate-400" />}
                  {p.rank === 3 && <Trophy className="inline h-5 w-5 mr-1 text-yellow-700" />}
                  {p.rank}
                </TableCell>
                <TableCell><div className="font-medium">{p.name}</div></TableCell>
                <TableCell className="text-center">
                  {isDaily && day ? p.dailyGamesPlayed[day] : p.gamesPlayed}
                </TableCell>
                <TableCell className="text-center">
                  {isDaily && day ? p.dailyWins[day] : p.wins}
                </TableCell>
                <TableCell className="text-center font-bold">
                  <div className="flex items-center justify-center">
                    {score === 0 ? '-' : score}
                    {score > 0 && <Star className="ml-1 h-4 w-4 text-black fill-black" />}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  const renderTablesForDay = (day: Day2025) => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="ml-2 text-muted-foreground">Chargement des tables archivées...</p>
        </div>
      );
    }
    const tablesForDay = archivedTables
      .filter(t => (t.days || []).includes(day as ConventionDay))
      .sort((a, b) => {
        const na = parseInt(a.tableNumber, 10);
        const nb = parseInt(b.tableNumber, 10);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return (a.tableNumber || '').localeCompare(b.tableNumber || '');
      });

    if (tablesForDay.length === 0) {
      return <p className="text-muted-foreground text-center py-6">Aucune table archivée pour {day}.</p>;
    }
    return (
      <Table>
        <TableCaption>{tablesForDay.length} table(s) le {day} (2025)</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16 text-center">Table</TableHead>
            <TableHead>Jeu</TableHead>
            <TableHead>Auteur / Animateur</TableHead>
            <TableHead>Créneau</TableHead>
            <TableHead className="text-center">Places</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tablesForDay.map(t => (
            <TableRow key={t.id}>
              <TableCell className="text-center font-medium">{t.tableNumber}</TableCell>
              <TableCell className="font-medium">{t.gameName}</TableCell>
              <TableCell>
                {t.authorAnimator && t.authorAnimator.trim() ? (
                  <span className="flex items-center gap-1">
                    <Mic className="h-3 w-3 text-muted-foreground" /> {t.authorAnimator}
                    {t.animatorPlays && <span className="text-xs text-muted-foreground">(joue)</span>}
                  </span>
                ) : (
                  <span className="italic text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" /> Accès libre
                  </span>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{getTimeSlotTypeDisplayLabel(t.timeSlotType)}</TableCell>
              <TableCell className="text-center">{t.totalSeats}</TableCell>
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
            <AlertTriangle className="mr-2 h-6 w-6" /> Erreur de chargement des archives
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>{error}</p>
          <Button onClick={load} className="mt-4">Réessayer</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/admin" passHref>
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" /> Retour à l&apos;admin
          </Button>
        </Link>
        <Badge variant="outline" className="text-xs">
          <Archive className="mr-1 h-3 w-3" /> Lecture seule
        </Badge>
      </div>

      <Card className="shadow-xl bg-primary">
        <CardHeader className="text-center">
          <div className="mx-auto bg-black rounded-full p-4 w-fit mb-4 shadow-md">
            <Archive className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight text-primary-foreground">
            Archives ASYNCONV25
          </CardTitle>
          <CardDescription className="text-lg text-primary-foreground/90">
            Édition précédente · figée en lecture seule
          </CardDescription>
        </CardHeader>
      </Card>

      {!isLoading && !hasAnyResults && (
        <Card className="shadow-lg border-primary/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3 p-4 bg-muted/40 rounded-md">
              <Info className="h-5 w-5 mt-0.5 flex-shrink-0 text-primary" />
              <div className="text-sm">
                <p className="font-semibold">Aucune archive trouvée.</p>
                <p className="text-muted-foreground">
                  Les données 2025 n&apos;ont pas encore été archivées, ou la migration a échoué.
                  Lance l&apos;archivage depuis la page admin pour les transférer ici.
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
            Classement Général 2025
          </CardTitle>
          <CardDescription>Performance globale sur les 4 jours de l&apos;édition 2025.</CardDescription>
        </CardHeader>
        <CardContent>
          {renderRankingTable(rankedOverall, "Classement général sur les 4 jours (2025)")}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <CalendarDays className="mr-3 h-7 w-7 text-primary" />
            Classements Journaliers 2025
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={DAYS_2025[0]} className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
              {DAYS_2025.map(day => (
                <TabsTrigger key={day} value={day}>{day}</TabsTrigger>
              ))}
            </TabsList>
            {DAYS_2025.map(day => (
              <TabsContent key={`content-${day}`} value={day} className="mt-4">
                {renderRankingTable(dailyRankings[day], `Classement du ${day} (2025)`, true, day)}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <LayoutGrid className="mr-3 h-7 w-7 text-primary" />
            Tables par jour 2025
          </CardTitle>
          <CardDescription>Programme des tables de l&apos;édition 2025, jour par jour (référence pour 2026).</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : archivedTables.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">Aucune table archivée.</p>
          ) : (
            <Tabs defaultValue={DAYS_2025[0]} className="w-full">
              <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
                {DAYS_2025.map(day => (
                  <TabsTrigger key={`tbl-${day}`} value={day}>{day}</TabsTrigger>
                ))}
              </TabsList>
              {DAYS_2025.map(day => (
                <TabsContent key={`tbl-content-${day}`} value={day} className="mt-4">
                  {renderTablesForDay(day)}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Dices className="mr-3 h-7 w-7 text-primary" />
            Liste des jeux 2025
          </CardTitle>
          <CardDescription>{archivedGames.length} jeu(x) proposé(s) lors de l&apos;édition 2025.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : archivedGames.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">Aucun jeu archivé.</p>
          ) : (
            <Table>
              <TableCaption>Jeux de l&apos;édition 2025 (ordre alphabétique)</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Jeu</TableHead>
                  <TableHead className="text-center w-32">Joueurs</TableHead>
                  <TableHead className="text-center w-24">Tables</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {archivedGames.map(g => {
                  const tableCount = archivedTables.filter(t => t.gameId === g.id).length;
                  return (
                    <TableRow key={g.id}>
                      <TableCell className="font-medium">{g.nom}</TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {g.nbre_min && g.nbre_max ? `${g.nbre_min}–${g.nbre_max}` : '–'}
                      </TableCell>
                      <TableCell className="text-center">{tableCount}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
