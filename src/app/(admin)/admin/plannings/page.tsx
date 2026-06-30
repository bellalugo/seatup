'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Search, CalendarDays } from 'lucide-react';
import { getParticipants, getRegistrations, getSlots } from '@/lib/data';
import type { ConventionDay } from '@/lib/types';
import { CONVENTION_DAYS, SESSIONS } from '@/lib/types';

interface PlanningEntry {
  tableNumber: string;
  gameName: string;
  label: string; // créneaux, ex. "Jeudi Matin, Jeudi Après-midi"
  sortKey: number;
}
interface ParticipantPlanning {
  id: string;
  name: string;
  ticketType: string;
  entries: PlanningEntry[];
}

export default function PlanningsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<ParticipantPlanning[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [participants, registrations, slots] = await Promise.all([getParticipants(), getRegistrations(), getSlots()]);
      const slotsById = new Map(slots.map(s => [s.id, s]));
      const pById = new Map(participants.map(p => [p.id, p]));
      const byUser = new Map<string, PlanningEntry[]>();

      registrations.forEach(r => {
        if ((r.status || 'confirmed') !== 'confirmed' || !r.slotId) return;
        const slot = slotsById.get(r.slotId);
        if (!slot) return;
        const cells = slot.cells || [];
        const first = cells[0];
        const sortKey = first ? CONVENTION_DAYS.indexOf(first.day) * 10 + SESSIONS.indexOf(first.session) : 999;
        const entry: PlanningEntry = {
          tableNumber: slot.config?.gameTableNumber || '?',
          gameName: slot.config?.gameName || 'Jeu',
          label: cells.map(c => `${c.day} ${c.session}`).join(', '),
          sortKey,
        };
        const arr = byUser.get(r.userId) || [];
        arr.push(entry);
        byUser.set(r.userId, arr);
      });

      const result: ParticipantPlanning[] = [];
      byUser.forEach((entries, userId) => {
        const p = pById.get(userId);
        if (!p) return;
        entries.sort((a, b) => a.sortKey - b.sortKey);
        result.push({ id: userId, name: `${p.prenom || ''} ${p.nom || ''}`.trim(), ticketType: p.typeBillet, entries });
      });
      result.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
      setData(result);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur de chargement', description: e instanceof Error ? e.message : 'Erreur.' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? data.filter(p => p.name.toLowerCase().includes(q)) : data;
  }, [data, query]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><CalendarDays className="h-6 w-6 text-primary" /> Plannings des participants</CardTitle>
            <CardDescription>Participants inscrits à au moins une partie, avec leur programme.</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin"><ArrowLeft className="h-4 w-4 mr-1" /> Retour à l&apos;admin</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher un participant…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9 rounded-md" />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {data.length === 0 ? "Aucun participant inscrit à une partie pour le moment." : "Aucun participant ne correspond à la recherche."}
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">{filtered.length} participant(s) inscrit(s){query ? ` sur ${data.length}` : ''}.</p>
              <div className="space-y-3">
                {filtered.map(p => (
                  <div key={p.id} className="border rounded-lg p-3">
                    <div className="flex items-center flex-wrap gap-2 mb-2">
                      <span className="font-semibold">{p.name}</span>
                      <Badge variant="outline" className="text-[10px]">{p.ticketType}</Badge>
                      <span className="text-xs text-muted-foreground">· {p.entries.length} partie(s)</span>
                    </div>
                    <ul className="space-y-1">
                      {p.entries.map((e, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="bg-foreground text-background px-1.5 py-0.5 rounded text-xs font-bold shrink-0">{e.tableNumber}</span>
                          <span className="font-medium">{e.gameName}</span>
                          <span className="text-muted-foreground text-xs">· {e.label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
