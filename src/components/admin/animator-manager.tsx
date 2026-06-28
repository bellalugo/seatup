'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Pencil, Trash2, Mic } from 'lucide-react';
import { getAnimators, addAnimator, updateAnimator, deleteAnimator } from '@/lib/data';
import type { Animator } from '@/lib/types';
import { animatorDisplayName, shortAnimatorName } from '@/lib/types';

export default function AnimatorManager() {
  const { toast } = useToast();
  const [animators, setAnimators] = useState<Animator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newPrenom, setNewPrenom] = useState('');
  const [newNom, setNewNom] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editing, setEditing] = useState<Animator | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setAnimators(await getAnimators());
    } catch (e) {
      toast({ variant: 'destructive', title: 'Chargement impossible', description: e instanceof Error ? e.message : 'Erreur.' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!newPrenom.trim()) { toast({ variant: 'destructive', title: 'Prénom requis' }); return; }
    setIsAdding(true);
    try {
      await addAnimator({ prenom: newPrenom, nom: newNom });
      setNewPrenom(''); setNewNom('');
      await load();
      toast({ title: 'Animateur ajouté' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Échec', description: e instanceof Error ? e.message : 'Erreur.' });
    } finally { setIsAdding(false); }
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    if (!editing.prenom.trim()) { toast({ variant: 'destructive', title: 'Prénom requis' }); return; }
    setIsSaving(true);
    try {
      await updateAnimator(editing);
      setEditing(null);
      await load();
      toast({ title: 'Animateur mis à jour' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Échec', description: e instanceof Error ? e.message : 'Erreur.' });
    } finally { setIsSaving(false); }
  };

  const handleDelete = async (a: Animator) => {
    if (!window.confirm(`Supprimer l'animateur « ${animatorDisplayName(a)} » ?\n\nLes configurations de tables qui le mentionnent ne sont pas modifiées (le nom y est déjà enregistré).`)) return;
    setDeletingId(a.id);
    try {
      await deleteAnimator(a.id);
      await load();
      toast({ title: 'Animateur supprimé' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Échec', description: e instanceof Error ? e.message : 'Erreur.' });
    } finally { setDeletingId(null); }
  };

  return (
    <div className="space-y-4">
      {/* Ajouter un animateur */}
      <div className="rounded-lg border p-3">
        <p className="text-sm font-medium mb-2 flex items-center gap-1"><Mic className="h-4 w-4" /> Ajouter un animateur / auteur</p>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="flex-1">
            <Label htmlFor="new-prenom" className="text-xs">Prénom</Label>
            <Input id="new-prenom" value={newPrenom} onChange={(e) => setNewPrenom(e.target.value)} placeholder="Olivier" className="rounded-md" disabled={isAdding} autoComplete="off" />
          </div>
          <div className="flex-1">
            <Label htmlFor="new-nom" className="text-xs">Nom</Label>
            <Input id="new-nom" value={newNom} onChange={(e) => setNewNom(e.target.value)} placeholder="JOUCLA" className="rounded-md" disabled={isAdding} autoComplete="off" />
          </div>
          <Button type="button" onClick={handleAdd} disabled={isAdding || !newPrenom.trim()}>
            {isAdding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />} Ajouter
          </Button>
        </div>
      </div>

      {/* Liste */}
      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement…</div>
      ) : (
        <Table>
          <TableCaption>{animators.length} animateur(s). « Affichage » correspond à ce que voient les participants.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Prénom</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Affichage</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {animators.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Aucun animateur.</TableCell></TableRow>
            ) : animators.map(a => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.prenom}</TableCell>
                <TableCell>{a.nom || <span className="italic text-muted-foreground">–</span>}</TableCell>
                <TableCell className="text-muted-foreground">{shortAnimatorName(animatorDisplayName(a))}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setEditing({ ...a })} title="Modifier"><Pencil className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(a)} disabled={deletingId === a.id} title="Supprimer">
                      {deletingId === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Dialog d'édition */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Modifier l&apos;animateur</DialogTitle>
            <DialogDescription>Le nom de famille n&apos;est pas obligatoire. L&apos;affichage public est « Prénom Initiale. ».</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3 py-1">
              <div>
                <Label htmlFor="edit-prenom" className="text-xs">Prénom</Label>
                <Input id="edit-prenom" value={editing.prenom} onChange={(e) => setEditing({ ...editing, prenom: e.target.value })} className="rounded-md" disabled={isSaving} autoComplete="off" />
              </div>
              <div>
                <Label htmlFor="edit-nom" className="text-xs">Nom</Label>
                <Input id="edit-nom" value={editing.nom} onChange={(e) => setEditing({ ...editing, nom: e.target.value })} className="rounded-md" disabled={isSaving} autoComplete="off" />
              </div>
              <p className="text-xs text-muted-foreground">Aperçu : <span className="font-medium text-foreground">{shortAnimatorName(animatorDisplayName(editing))}</span></p>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={isSaving}>Annuler</Button>
            <Button type="button" onClick={handleSaveEdit} disabled={isSaving || !editing?.prenom.trim()}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
