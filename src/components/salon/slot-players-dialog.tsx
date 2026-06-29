'use client';

import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, UserX, Trophy, GripVertical, ArrowUp, ArrowDown } from 'lucide-react';
import { addSlotRegistration, removeRegistration, saveGameResult } from '@/lib/data';
import type { Slot, Participant, Registration } from '@/lib/types';
import { shortAnimatorName } from '@/lib/types';

const fullName = (p?: Participant) => p ? `${p.prenom || ''} ${p.nom || ''}`.trim() : 'Inconnu';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  slot: Slot | null;
  slots?: Slot[];
  participants: Participant[];
  registrations: (Registration & { id: string })[];
  onChanged: () => Promise<void> | void;
}

export function SlotPlayersDialog({ open, onOpenChange, slot, slots = [], participants, registrations, onChanged }: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [addId, setAddId] = useState('');
  const [order, setOrder] = useState<string[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);

  const pById = useMemo(() => new Map(participants.map(p => [p.id, p])), [participants]);

  const slotRegs = slot ? registrations.filter(r => r.slotId === slot.id) : [];
  const confirmed = slotRegs.filter(r => (r.status || 'confirmed') === 'confirmed');

  const totalSeats = slot?.config?.totalSeats || 0;
  const animatorSeat = slot?.config?.animatorPlays ? 1 : 0;
  const available = Math.max(0, totalSeats - animatorSeat - confirmed.length);

  const registeredIds = new Set(slotRegs.map(r => r.userId));

  // Un joueur ne peut pas se dédoubler : on exclut ceux déjà engagés sur un créneau de ce slot.
  const slotsById = useMemo(() => new Map(slots.map(s => [s.id, s])), [slots]);
  const targetKeys = useMemo(() => new Set((slot?.cells || []).map(c => `${c.day}|${c.session}`)), [slot]);
  const hasTimeConflict = (uid: string) =>
    registrations.some(r =>
      r.userId === uid && r.slotId && r.slotId !== slot?.id &&
      (slotsById.get(r.slotId)?.cells || []).some(c => targetKeys.has(`${c.day}|${c.session}`)));

  const addable = participants
    .filter(p => !registeredIds.has(p.id) && !hasTimeConflict(p.id))
    .sort((a, b) => fullName(a).localeCompare(fullName(b)));

  // L'animateur « + joueur » est inscrit d'office comme joueur (via son billet lié à la config).
  const animatorPid = (slot?.config?.animatorPlays && slot?.config?.animatorParticipantId) ? slot.config.animatorParticipantId : '';

  // Synchronise l'ordre du classement avec les joueurs (animateur-joueur + inscrits confirmés).
  const playerIds = animatorPid
    ? [animatorPid, ...confirmed.map(r => r.userId).filter(id => id !== animatorPid)]
    : confirmed.map(r => r.userId);
  const playerKey = playerIds.join(',');
  useEffect(() => {
    const ids = playerKey ? playerKey.split(',') : [];
    setOrder(prev => {
      const set = new Set(ids);
      const kept = prev.filter(id => set.has(id));
      const added = ids.filter(id => !prev.includes(id));
      return [...kept, ...added];
    });
  }, [playerKey, slot?.id]);

  const refresh = async () => { await onChanged(); };

  const handleAdd = async () => {
    if (!slot || !addId) return;
    setBusy(true);
    try {
      await addSlotRegistration(addId, slot.id, 'confirmed');
      setAddId('');
      await refresh();
      toast({ title: 'Joueur inscrit' });
    } catch (e) { toast({ variant: 'destructive', title: 'Échec', description: e instanceof Error ? e.message : 'Erreur.' }); }
    finally { setBusy(false); }
  };

  const handleRemove = async (reg: Registration & { id: string }) => {
    setBusy(true);
    try { await removeRegistration(reg.id); await refresh(); }
    catch (e) { toast({ variant: 'destructive', title: 'Échec', description: e instanceof Error ? e.message : 'Erreur.' }); }
    finally { setBusy(false); }
  };

  const reorder = (id: string, targetIndex: number) => {
    setOrder(prev => {
      const arr = [...prev];
      const from = arr.indexOf(id);
      if (from < 0) return prev;
      const to = Math.max(0, Math.min(arr.length - 1, targetIndex));
      arr.splice(from, 1);
      arr.splice(to, 0, id);
      return arr;
    });
  };
  const move = (id: string, delta: number) => reorder(id, order.indexOf(id) + delta);
  const onDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) { setDragId(null); return; }
    reorder(dragId, order.indexOf(targetId));
    setDragId(null);
  };

  const handleSaveResult = async () => {
    if (!slot || order.length === 0) return;
    setBusy(true);
    try {
      const ranking = [...order];
      await saveGameResult(slot.id, [ranking[0]], ranking.length, ranking);
      toast({ title: 'Résultat enregistré', description: `Classement de ${ranking.length} joueur(s) enregistré.` });
      await refresh();
    } catch (e) { toast({ variant: 'destructive', title: 'Échec', description: e instanceof Error ? e.message : 'Erreur.' }); }
    finally { setBusy(false); }
  };

  if (!slot) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{slot.config?.gameTableNumber || '?'} {slot.config?.gameName}</DialogTitle>
          <DialogDescription>
            {(slot.cells || []).map(c => `${c.day} ${c.session}`).join(', ')} · {confirmed.length}/{totalSeats - animatorSeat} place(s) prise(s){available > 0 ? ` · ${available} libre(s)` : ' · complet'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Ajouter un joueur */}
          <div>
            <p className="text-sm font-medium mb-1">Ajouter un joueur</p>
            <div className="flex gap-2">
              <Select value={addId} onValueChange={setAddId} disabled={busy}>
                <SelectTrigger className="rounded-md"><SelectValue placeholder="Choisir un participant" /></SelectTrigger>
                <SelectContent>
                  {addable.length === 0 && <SelectItem value="_none_" disabled>Tous les participants sont déjà inscrits</SelectItem>}
                  {addable.map(p => <SelectItem key={p.id} value={p.id}>{fullName(p)} ({p.typeBillet})</SelectItem>)}
                </SelectContent>
              </Select>
              <Button type="button" size="sm" disabled={busy || !addId || available <= 0} onClick={handleAdd} title={available <= 0 ? 'Table complète' : 'Inscrire'}>
                <UserPlus className="h-4 w-4 mr-1" /> Inscrire
              </Button>
            </div>
          </div>

          {/* Inscrits */}
          <div>
            <p className="text-sm font-medium mb-1">Inscrits ({confirmed.length + animatorSeat})</p>
            {(confirmed.length + animatorSeat) === 0 ? <p className="text-xs text-muted-foreground">Aucun joueur inscrit.</p> : (
              <ul className="space-y-1">
                {animatorSeat > 0 && slot.config?.authorAnimator && (
                  <li className="flex items-center justify-between gap-2 text-sm border rounded px-2 py-1 bg-amber-50">
                    <span className="flex items-center gap-2 min-w-0"><span className="truncate">{shortAnimatorName(slot.config.authorAnimator)}</span><Badge className="text-[10px] bg-amber-600">animateur</Badge></span>
                  </li>
                )}
                {confirmed.map(r => {
                  const p = pById.get(r.userId);
                  return (
                    <li key={r.id} className="flex items-center justify-between gap-2 text-sm border rounded px-2 py-1">
                      <span className="flex items-center gap-2 min-w-0"><span className="truncate">{fullName(p)}</span><Badge variant="outline" className="text-[10px]">{p?.typeBillet || '?'}</Badge></span>
                      <button type="button" onClick={() => handleRemove(r)} disabled={busy} className="text-red-600 hover:text-red-700 shrink-0" title="Retirer"><UserX className="h-4 w-4" /></button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Classement de la partie (glisser-déposer) */}
          {order.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-1 flex items-center gap-1"><Trophy className="h-4 w-4 text-amber-500" /> Classement de la partie</p>
              <p className="text-[11px] text-muted-foreground mb-1">Classe les joueurs du 1er au dernier (glisse les lignes ou utilise les flèches). Points : 1er = {order.length} pts, puis −1 par rang.</p>
              <ul className="space-y-1">
                {order.map((uid, i) => {
                  const p = pById.get(uid);
                  const pts = Math.max(1, order.length - i);
                  return (
                    <li
                      key={uid}
                      draggable={!busy}
                      onDragStart={() => setDragId(uid)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => onDrop(uid)}
                      className={`flex items-center gap-2 text-sm border rounded px-2 py-1 bg-background ${i === 0 ? 'border-amber-400 bg-amber-50' : ''} ${dragId === uid ? 'opacity-50' : ''} cursor-move`}
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="w-6 text-center font-semibold flex items-center justify-center gap-0.5">{i + 1}{i === 0 && <Trophy className="h-3 w-3 text-amber-500" />}</span>
                      <span className="truncate flex-1">{fullName(p)}{uid === animatorPid && <span className="ml-1 text-[10px] text-amber-700">(animateur)</span>}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">{pts} pt{pts > 1 ? 's' : ''}</Badge>
                      <span className="flex flex-col shrink-0">
                        <button type="button" onClick={() => move(uid, -1)} disabled={busy || i === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30" title="Monter"><ArrowUp className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => move(uid, 1)} disabled={busy || i === order.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30" title="Descendre"><ArrowDown className="h-3.5 w-3.5" /></button>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <Button type="button" size="sm" className="mt-2" disabled={busy} onClick={handleSaveResult}>
                {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trophy className="h-4 w-4 mr-1" />} Enregistrer le résultat
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
