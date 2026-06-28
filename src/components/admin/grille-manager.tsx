'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, LayoutGrid, Rows3 } from 'lucide-react';
import { getGames, getTableConfigs, getSlots, getRegistrations, addSlot, updateSlot, deleteSlot, fillSlotsForCells, createSlotsFromGroups } from '@/lib/data';
import type { Game, TableConfig, Slot, SlotCell, SessionType, ConventionDay, Registration } from '@/lib/types';
import { SESSIONS, CONVENTION_DAYS } from '@/lib/types';

const cellKey = (day: ConventionDay, session: SessionType) => `${day}|${session}`;

export default function GrilleManager() {
  const { toast } = useToast();
  const [games, setGames] = useState<Game[]>([]);
  const [configs, setConfigs] = useState<TableConfig[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [registrations, setRegistrations] = useState<(Registration & { id: string })[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogGameId, setDialogGameId] = useState<string>('');
  const [editing, setEditing] = useState<Slot | null>(null);
  const [selConfig, setSelConfig] = useState('');
  const [selCells, setSelCells] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isFilling, setIsFilling] = useState<string | null>(null);
  const [fillGame, setFillGame] = useState<Game | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [g, c, s, r] = await Promise.all([getGames(), getTableConfigs(), getSlots(), getRegistrations()]);
      setGames(g);
      setConfigs(c);
      setSlots(s);
      setRegistrations(r);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur de chargement', description: e instanceof Error ? e.message : 'Erreur.' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const configsByGame = (gameId: string) => configs.filter(c => c.gameId === gameId);
  const gamesWithConfigs = games.filter(g => configsByGame(g.id).length > 0).sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
  const dialogGame = games.find(g => g.id === dialogGameId);

  // Slot d'un jeu couvrant une case donnée.
  const slotAt = (gameId: string, day: ConventionDay, session: SessionType) =>
    slots.find(s => s.config?.gameId === gameId && (s.cells || []).some(c => c.day === day && c.session === session));

  const confirmedCount = (slotId: string) =>
    registrations.filter(r => r.slotId === slotId && (r.status || 'confirmed') === 'confirmed').length;

  // Cases déjà occupées par d'autres slots du même jeu (1 config par case par jeu).
  const occupiedCells = (gameId: string, exceptSlotId?: string) => {
    const set = new Set<string>();
    slots.filter(s => s.config?.gameId === gameId && s.id !== exceptSlotId)
      .forEach(s => (s.cells || []).forEach(c => set.add(cellKey(c.day, c.session))));
    return set;
  };

  const openAdd = (gameId: string, pre?: { day: ConventionDay; session: SessionType }) => {
    setDialogGameId(gameId);
    setEditing(null);
    const cfgs = configsByGame(gameId);
    setSelConfig(cfgs[0]?.id || '');
    setSelCells(pre ? new Set([cellKey(pre.day, pre.session)]) : new Set());
    setIsDialogOpen(true);
  };

  const openEdit = (slot: Slot) => {
    setDialogGameId(slot.config?.gameId || '');
    setEditing(slot);
    setSelConfig(slot.configId);
    setSelCells(new Set((slot.cells || []).map(c => cellKey(c.day, c.session))));
    setIsDialogOpen(true);
  };

  const toggleCell = (day: ConventionDay, session: SessionType, disabled: boolean) => {
    if (disabled) return;
    setSelCells(prev => {
      const k = cellKey(day, session);
      const n = new Set(prev);
      if (n.has(k)) n.delete(k); else n.add(k);
      return n;
    });
  };

  const handleSave = async () => {
    if (!selConfig) { toast({ variant: 'destructive', title: 'Configuration requise' }); return; }
    if (selCells.size === 0) { toast({ variant: 'destructive', title: 'Aucune case', description: 'Sélectionnez au moins une case.' }); return; }
    setIsSaving(true);
    try {
      const cells: SlotCell[] = [...selCells].map(k => {
        const [day, session] = k.split('|');
        return { day: day as ConventionDay, session: session as SessionType };
      });
      if (editing) {
        await updateSlot({ id: editing.id, configId: selConfig, cells });
        toast({ title: 'Slot mis à jour' });
      } else {
        await addSlot({ configId: selConfig, cells });
        toast({ title: 'Slot créé' });
      }
      setIsDialogOpen(false);
      await load();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Échec', description: e instanceof Error ? e.message : 'Erreur.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (slot: Slot) => {
    if (!window.confirm(`Retirer ce slot de la grille (${slot.config?.gameName || ''}${slot.config?.label ? ` · ${slot.config.label}` : ''}) ?`)) return;
    setIsDeleting(slot.id);
    try {
      await deleteSlot(slot.id);
      toast({ title: 'Slot retiré' });
      await load();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Suppression impossible', description: e instanceof Error ? e.message : 'Erreur.' });
    } finally {
      setIsDeleting(null);
    }
  };

  const defaultConfigFor = (gameId: string): TableConfig | null => {
    const cfgs = configsByGame(gameId);
    return cfgs.find(c => c.isDefault) || (cfgs.length === 1 ? cfgs[0] : null);
  };

  // Ouvre le menu de remplissage (demi-journées / journée / plusieurs jours) pour un jeu.
  const openFill = (game: Game) => {
    if (configsByGame(game.id).length === 0) return;
    if (!defaultConfigFor(game.id)) {
      toast({ title: 'Configuration par défaut manquante', description: `Coche « Configuration par défaut » sur une config de « ${game.nom} » (onglet Configurations).` });
      return;
    }
    setFillGame(game);
  };

  const runFill = async (game: Game, groups: SlotCell[][]) => {
    const cfg = defaultConfigFor(game.id);
    if (!cfg) return;
    if (groups.length === 0) { toast({ title: 'Rien à remplir', description: 'Les créneaux concernés sont déjà occupés.' }); return; }
    setIsFilling(game.id);
    try {
      await createSlotsFromGroups(cfg.id, groups);
      toast({ title: 'Grille remplie', description: `${groups.length} slot(s) créé(s) pour ${game.nom}.` });
      setFillGame(null);
      await load();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Échec', description: e instanceof Error ? e.message : 'Erreur.' });
    } finally {
      setIsFilling(null);
    }
  };

  // Un slot par demi-journée libre.
  const fillHalfDays = (game: Game) => {
    const occ = occupiedCells(game.id);
    const groups: SlotCell[][] = [];
    CONVENTION_DAYS.forEach(day => SESSIONS.forEach(session => {
      if (!occ.has(cellKey(day, session))) groups.push([{ day, session }]);
    }));
    runFill(game, groups);
  };

  // Un slot « journée » (Matin + Après-midi) par jour où les deux sont libres.
  const fillDays = (game: Game) => {
    const occ = occupiedCells(game.id);
    const groups: SlotCell[][] = [];
    CONVENTION_DAYS.forEach(day => {
      if (!occ.has(cellKey(day, 'Matin')) && !occ.has(cellKey(day, 'Après-midi'))) {
        groups.push([{ day, session: 'Matin' }, { day, session: 'Après-midi' }]);
      }
    });
    runFill(game, groups);
  };

  // Plusieurs jours d'affilée : on ouvre le dialogue manuel (matrice de cases) avec la config par défaut.
  const fillMultiDays = (game: Game) => {
    setDialogGameId(game.id);
    setEditing(null);
    setSelConfig(defaultConfigFor(game.id)?.id || configsByGame(game.id)[0]?.id || '');
    setSelCells(new Set());
    setFillGame(null);
    setIsDialogOpen(true);
  };

  const dialogOccupied = occupiedCells(dialogGameId, editing?.id);

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Une ligne = un <strong>jeu</strong> (une table installée pour toute la convention). Sur chaque créneau, on pose une <strong>configuration</strong> de ce jeu (animée, accès libre…). Une config peut couvrir plusieurs créneaux contigus (journée, plusieurs jours). Un seul slot par case et par jeu.
        </p>

        {!isLoading && gamesWithConfigs.length === 0 && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
            Aucun jeu n&apos;a de configuration. Crée des configurations dans l&apos;onglet « Configurations » : les jeux apparaîtront alors ici, ligne par ligne.
          </p>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : gamesWithConfigs.length > 0 && (
          <div className="overflow-x-auto border rounded-md">
            <table className="border-collapse text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="p-2 text-left font-medium border-b border-r sticky left-0 bg-muted/50 z-10 min-w-[160px]">Jeu (table)</th>
                  {CONVENTION_DAYS.map(day => (
                    <th key={day} className="p-1 text-center font-medium border-b border-r" colSpan={SESSIONS.length}>{day}</th>
                  ))}
                </tr>
                <tr className="bg-muted/30 text-[11px]">
                  <th className="p-1 border-b border-r sticky left-0 bg-muted/30 z-10"></th>
                  {CONVENTION_DAYS.map(day => (
                    SESSIONS.map(session => (
                      <th key={`${day}-${session}`} className="p-1 font-normal border-b border-r text-muted-foreground whitespace-nowrap">
                        {session === 'Après-midi' ? 'AM' : session === 'Matin' ? 'Mat.' : 'Soir'}
                      </th>
                    ))
                  ))}
                </tr>
              </thead>
              <tbody>
                {gamesWithConfigs.map(game => (
                  <tr key={game.id} className="align-top">
                    <td className="p-2 font-medium border-b border-r sticky left-0 bg-background z-10 min-w-[160px]">
                      <div className="flex items-center gap-1.5">
                        {game.tableNumber
                          ? <span className="bg-foreground text-background px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0">{game.tableNumber}</span>
                          : <span className="text-[10px] text-amber-600 shrink-0" title="Numéro de table non défini (onglet Jeux)">?</span>}
                        <span className="truncate flex-1">{game.nom}</span>
                        <Tooltip><TooltipTrigger asChild>
                          <button type="button" onClick={() => openFill(game)} disabled={isFilling === game.id} title="Remplir la ligne (journée / demi-journées / plusieurs jours)" className="shrink-0 text-muted-foreground hover:text-foreground">
                            {isFilling === game.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rows3 className="h-3.5 w-3.5" />}
                          </button>
                        </TooltipTrigger><TooltipContent><p>Remplir tous les créneaux libres</p></TooltipContent></Tooltip>
                      </div>
                    </td>
                    {CONVENTION_DAYS.map(day => (
                      SESSIONS.map(session => {
                        const slot = slotAt(game.id, day, session);
                        return (
                          <td key={`${day}-${session}`} className="p-1 border-b border-r align-top min-w-[64px]">
                            {slot ? (
                              <div className="group flex items-start gap-0.5 rounded bg-primary/10 border border-primary/20 px-1 py-0.5">
                                <button type="button" onClick={() => openEdit(slot)} className="min-w-0 text-left flex-1" title="Éditer ce slot">
                                  <span className="block text-[11px] leading-tight truncate">{slot.config?.label || 'config'}</span>
                                  <span className="block text-[10px] text-muted-foreground">{slot.config?.totalSeats ?? '?'} pl.</span>
                                </button>
                                <button type="button" onClick={() => handleDelete(slot)} disabled={isDeleting === slot.id || confirmedCount(slot.id) > 0} title={confirmedCount(slot.id) > 0 ? 'Des joueurs sont inscrits : suppression bloquée' : 'Retirer'} className={confirmedCount(slot.id) > 0 ? 'text-red-300 cursor-not-allowed shrink-0' : 'text-red-600 hover:text-red-700 shrink-0'}>
                                  {isDeleting === slot.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                </button>
                              </div>
                            ) : (
                              <button type="button" onClick={() => openAdd(game.id, { day, session })} title="Ajouter un slot" className="w-full h-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded border border-dashed">
                                <Plus className="h-3 w-3" />
                              </button>
                            )}
                          </td>
                        );
                      })
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Dialog open={!!fillGame} onOpenChange={(o) => { if (!o) setFillGame(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Remplir la ligne · {fillGame?.nom}</DialogTitle>
              <DialogDescription>Avec la configuration par défaut « {fillGame ? (defaultConfigFor(fillGame.id)?.label || 'config') : ''} ». Choisis la granularité :</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-1">
              <Button variant="outline" className="w-full justify-start h-auto py-2 text-left whitespace-normal leading-snug" disabled={!!isFilling} onClick={() => fillGame && fillDays(fillGame)}>
                <span><strong>Journées</strong> · 1 partie/jour (Matin+Après-midi), une seule inscription pour les deux demi-journées</span>
              </Button>
              <Button variant="outline" className="w-full justify-start h-auto py-2 text-left whitespace-normal leading-snug" disabled={!!isFilling} onClick={() => fillGame && fillHalfDays(fillGame)}>
                <span><strong>Demi-journées</strong> · 1 partie par créneau (Matin, Après-midi, Soir séparés)</span>
              </Button>
              <Button variant="outline" className="w-full justify-start h-auto py-2 text-left whitespace-normal leading-snug" disabled={!!isFilling} onClick={() => fillGame && fillMultiDays(fillGame)}>
                <span><strong>Plusieurs jours…</strong> · saisie manuelle des créneaux (table sur 2 jours et +)</span>
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{editing ? 'Modifier le slot' : 'Ajouter un slot'} · {dialogGame?.nom}</DialogTitle>
              <DialogDescription>Choisis la configuration et les créneaux qu&apos;elle occupe. Les cases déjà prises par ce jeu sont désactivées.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div>
                <Label className="mb-1 block">Configuration</Label>
                <Select value={selConfig} onValueChange={setSelConfig} disabled={isSaving}>
                  <SelectTrigger className="rounded-md"><SelectValue placeholder="Choisir une configuration" /></SelectTrigger>
                  <SelectContent>
                    {configsByGame(dialogGameId).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.label || 'config'} · {c.totalSeats} pl.{c.authorAnimator ? ` · ${c.authorAnimator}` : ' · accès libre'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="mb-1 block">Créneaux occupés</Label>
                <div className="overflow-x-auto border rounded-md">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="p-1.5 text-left border-b border-r">Session</th>
                        {CONVENTION_DAYS.map(day => (<th key={day} className="p-1.5 text-center border-b">{day.slice(0, 3)}</th>))}
                      </tr>
                    </thead>
                    <tbody>
                      {SESSIONS.map(session => (
                        <tr key={session}>
                          <td className="p-1.5 border-r border-b text-muted-foreground whitespace-nowrap">{session}</td>
                          {CONVENTION_DAYS.map(day => {
                            const k = cellKey(day, session);
                            const disabled = dialogOccupied.has(k);
                            return (
                              <td key={day} className="p-1.5 text-center border-b">
                                <Checkbox checked={selCells.has(k)} onCheckedChange={() => toggleCell(day, session, disabled)} disabled={isSaving || disabled} />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">{selCells.size} créneau(x) sélectionné(s). Les cases grisées sont déjà occupées par ce jeu.</p>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>Annuler</Button>
              <Button type="button" onClick={handleSave} disabled={isSaving || !selConfig || selCells.size === 0}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LayoutGrid className="mr-2 h-4 w-4" />}
                {editing ? 'Enregistrer' : 'Créer le slot'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
