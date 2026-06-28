'use client';

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, UserX, Trophy } from 'lucide-react';
import { addSlotRegistration, removeRegistration, saveGameResult } from '@/lib/data';
import type { Slot, Participant, Registration } from '@/lib/types';

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
  const [winners, setWinners] = useState<Set<string>>(new Set());

  const pById = useMemo(() => new Map(participants.map(p => [p.id, p])), [participants]);

  const slotRegs = slot ? registrations.filter(r => r.slotId === slot.id) : [];
  const confirmed = slotRegs.filter(r => (r.status || 'confirmed') === 'confirmed');

  const totalSeats = slot?.config?.totalSeats || 0;
  const animatorSeat = slot?.config?.animatorPlays ? 1 : 0;
  const available = Math.max(0, totalSeats - animatorSeat - confirmed.length);

  const registeredIds = new Set(slotRegs.map(r => r.userId));

  // Un joueur ne peut pas se dédoubler : on exclut ceux déjà engagés (place OU file) sur un créneau de ce slot.
  const slotsById = useMemo(() => new Map(slots.map(s => [s.id, s])), [slots]);
  const targetKeys = useMemo(() => new Set((slot?.cells || []).map(c => `${c.day}|${c.session}`)), [slot]);
  const hasTimeConflict = (uid: string) =>
    registrations.some(r =>
      r.userId === uid && r.slotId && r.slotId !== slot?.id &&
      (slotsById.get(r.slotId)?.cells || []).some(c => targetKeys.has(`${c.day}|${c.session}`)));

  const addable = participants
    .filter(p => !registeredIds.has(p.id) && !hasTimeConflict(p.id))
    .sort((a, b) => fullName(a).localeCompare(fullName(b)));

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

  const toggleWinner = (id: string) => setWinners(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleSaveWinners = async () => {
    if (!slot) return;
    setBusy(true);
    try {
      await saveGameResult(slot.id, [...winners], confirmed.length);
      toast({ title: 'Résultat enregistré', description: `${winners.size} vainqueur(s) sur ${confirmed.length} joueur(s).` });
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
                    <span className="flex items-center gap-2 min-w-0"><span className="truncate">{slot.config.authorAnimator}</span><Badge className="text-[10px] bg-amber-600">animateur</Badge></span>
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

          {/* Vainqueurs */}
          {confirmed.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-1 flex items-center gap-1"><Trophy className="h-4 w-4 text-amber-500" /> Vainqueur(s)</p>
              <ul className="space-y-1">
                {confirmed.map(r => {
                  const p = pById.get(r.userId);
                  return (
                    <li key={`w-${r.id}`} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={winners.has(r.userId)} onCheckedChange={() => toggleWinner(r.userId)} disabled={busy} />
                      <span className="truncate">{fullName(p)}</span>
                    </li>
                  );
                })}
              </ul>
              <Button type="button" size="sm" className="mt-2" disabled={busy} onClick={handleSaveWinners}>
                {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trophy className="h-4 w-4 mr-1" />} Enregistrer le résultat
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
