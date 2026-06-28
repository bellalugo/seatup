'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Pencil, Trash2, Mic, Users, Gamepad2 } from 'lucide-react';
import { getGames, getTableConfigs, addTableConfig, updateTableConfig, deleteTableConfig, getAnimators } from '@/lib/data';
import type { Game, TableConfig, TableConfigInput, TableShape, Animator } from '@/lib/types';
import { animatorDisplayName } from '@/lib/types';

type AnimatorMode = 'free' | 'animator' | 'animator-plays';

const defaultForm: TableConfigInput = {
  gameId: '',
  label: '',
  totalSeats: 4,
  tableShape: 'round',
  authorAnimator: undefined,
  animatorPlays: false,
  isDefault: false,
};

export default function ConfigManager() {
  const { toast } = useToast();
  const [games, setGames] = useState<Game[]>([]);
  const [configs, setConfigs] = useState<TableConfig[]>([]);
  const [animators, setAnimators] = useState<Animator[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TableConfig | null>(null);
  const [form, setForm] = useState<TableConfigInput>(defaultForm);
  const [animatorMode, setAnimatorMode] = useState<AnimatorMode>('free');
  const [animatorCustom, setAnimatorCustom] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [g, c, a] = await Promise.all([getGames(), getTableConfigs(), getAnimators()]);
      setGames(g);
      setConfigs(c);
      setAnimators(a);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur de chargement', description: e instanceof Error ? e.message : 'Erreur.' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const selectedGame = games.find(g => g.id === form.gameId);

  const openAdd = () => {
    setEditing(null);
    setForm(defaultForm);
    setAnimatorMode('free');
    setAnimatorCustom(false);
    setIsDialogOpen(true);
  };

  const openEdit = (c: TableConfig) => {
    setEditing(c);
    setForm({
      gameId: c.gameId,
      label: c.label || '',
      totalSeats: c.totalSeats,
      tableShape: c.tableShape || 'round',
      authorAnimator: c.authorAnimator || undefined,
      animatorPlays: !!c.animatorPlays,
      isDefault: !!c.isDefault,
    });
    setAnimatorMode(c.authorAnimator ? (c.animatorPlays ? 'animator-plays' : 'animator') : 'free');
    setAnimatorCustom(!!c.authorAnimator && !animators.some(a => animatorDisplayName(a).toLowerCase() === c.authorAnimator!.toLowerCase()));
    setIsDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.gameId) {
      toast({ variant: 'destructive', title: 'Jeu requis', description: 'Sélectionnez un jeu.' });
      return;
    }
    if (animatorMode !== 'free' && !(form.authorAnimator || '').trim()) {
      toast({ variant: 'destructive', title: "Nom d'animateur requis", description: "Indiquez l'animateur, ou repassez en « accès libre »." });
      return;
    }
    setIsSaving(true);
    try {
      const payload: TableConfigInput = {
        gameId: form.gameId,
        label: (form.label || '').trim(),
        totalSeats: Math.max(1, form.totalSeats || 1),
        tableShape: form.tableShape || 'round',
        authorAnimator: animatorMode === 'free' ? '' : (form.authorAnimator || '').trim(),
        animatorPlays: animatorMode === 'animator-plays',
        isDefault: !!form.isDefault,
      };
      if (editing) {
        await updateTableConfig({ ...editing, ...payload });
        toast({ title: 'Configuration mise à jour' });
      } else {
        await addTableConfig(payload);
        toast({ title: 'Configuration ajoutée' });
      }
      setIsDialogOpen(false);
      await load();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Échec', description: e instanceof Error ? e.message : 'Erreur.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (c: TableConfig) => {
    if (!window.confirm(`Supprimer la configuration « ${c.gameName}${c.label ? ` · ${c.label}` : ''} » ?`)) return;
    setIsDeleting(c.id);
    try {
      await deleteTableConfig(c.id);
      toast({ title: 'Configuration supprimée' });
      await load();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Suppression impossible', description: e instanceof Error ? e.message : 'Erreur.' });
    } finally {
      setIsDeleting(null);
    }
  };

  const animatorSummary = (c: TableConfig) => {
    if (!c.authorAnimator) return <span className="italic text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> Accès libre</span>;
    return (
      <span className="flex items-center gap-1">
        <Mic className="h-3 w-3 text-muted-foreground" /> {c.authorAnimator}
        {c.animatorPlays && <span className="text-xs text-muted-foreground">(joue)</span>}
      </span>
    );
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm text-muted-foreground">
            Une configuration est un gabarit réutilisable (jeu + places + forme + animation), <strong>sans date ni joueurs</strong>.
            Elle se dépose ensuite sur la grille (palier suivant) pour créer des slots.
          </p>
          <Button onClick={openAdd} disabled={isLoading || games.length === 0} className="shadow-sm rounded-md">
            <PlusCircle className="mr-2 h-4 w-4" /> Ajouter une configuration
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : configs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Aucune configuration. Créez-en une avec « Ajouter une configuration ».</p>
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableCaption>{configs.length} configuration(s)</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Jeu</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead className="text-center">Places</TableHead>
                  <TableHead className="text-center">Forme</TableHead>
                  <TableHead>Animation</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.gameName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.label || '–'}
                      {c.isDefault && <span className="ml-2 inline-block bg-primary/15 text-primary text-[10px] font-medium px-1.5 py-0.5 rounded">défaut</span>}
                    </TableCell>
                    <TableCell className="text-center">{c.totalSeats}</TableCell>
                    <TableCell className="text-center">{c.tableShape === 'rectangle' ? 'Rectangle' : 'Ronde'}</TableCell>
                    <TableCell>{animatorSummary(c)}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Tooltip><TooltipTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8 rounded-md" onClick={() => openEdit(c)} disabled={!!isDeleting}><Pencil className="h-4 w-4" /></Button>
                      </TooltipTrigger><TooltipContent><p>Éditer</p></TooltipContent></Tooltip>
                      <Tooltip><TooltipTrigger asChild>
                        <Button variant="destructive" size="icon" className="h-8 w-8 rounded-md" onClick={() => handleDelete(c)} disabled={!!isDeleting}>
                          {isDeleting === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </TooltipTrigger><TooltipContent><p>Supprimer</p></TooltipContent></Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? 'Modifier la configuration' : 'Ajouter une configuration'}</DialogTitle>
              <DialogDescription>Gabarit réutilisable : jeu, places, forme et animation. (Le planning se fait sur la grille.)</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4 py-2">
              <div className="grid grid-cols-4 items-center gap-3">
                <Label htmlFor="cfg-game" className="text-right">Jeu</Label>
                <Select value={form.gameId} onValueChange={(v) => setForm(p => ({ ...p, gameId: v }))} disabled={isSaving || games.length === 0}>
                  <SelectTrigger id="cfg-game" className="col-span-3 rounded-md"><SelectValue placeholder="Sélectionner un jeu" /></SelectTrigger>
                  <SelectContent>
                    {games.length === 0 && <SelectItem value="_NO_GAMES_" disabled>Aucun jeu</SelectItem>}
                    {games.map(g => (<SelectItem key={g.id} value={g.id}>{g.nom} ({g.nbre_min}-{g.nbre_max}j)</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>

              {selectedGame && (
                <div className="grid grid-cols-4 items-center gap-3">
                  <span />
                  <p className="col-span-3 text-xs text-muted-foreground">
                    Table : {selectedGame.tableNumber
                      ? <span className="font-medium text-foreground">T.{selectedGame.tableNumber}</span>
                      : <span className="text-amber-600">non définie (à régler dans l&apos;onglet Jeux)</span>}
                    {' '}: la table est liée au jeu, pas à la config.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-4 items-center gap-3">
                <Label htmlFor="cfg-label" className="text-right">Libellé</Label>
                <Input id="cfg-label" value={form.label || ''} onChange={(e) => setForm(p => ({ ...p, label: e.target.value }))} className="col-span-3 rounded-md" placeholder="(optionnel) ex. « animée par Florian »" disabled={isSaving} />
              </div>

              <div className="grid grid-cols-4 items-start gap-3">
                <Label className="text-right pt-2">Statut</Label>
                <RadioGroup
                  value={animatorMode}
                  onValueChange={(v) => {
                    const m = v as AnimatorMode;
                    setAnimatorMode(m);
                    if (m === 'free') { setForm(p => ({ ...p, authorAnimator: undefined, animatorPlays: false })); setAnimatorCustom(false); }
                    else if (m === 'animator') setForm(p => ({ ...p, animatorPlays: false }));
                    else setForm(p => ({ ...p, animatorPlays: true }));
                  }}
                  className="col-span-3 flex flex-col gap-2"
                  disabled={isSaving}
                >
                  <div className="flex items-center space-x-2"><RadioGroupItem value="free" id="cfg-free" /><Label htmlFor="cfg-free" className="font-normal">Accès libre <span className="text-xs text-muted-foreground">(aucun animateur)</span></Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="animator" id="cfg-anim" /><Label htmlFor="cfg-anim" className="font-normal">Animateur seul <span className="text-xs text-muted-foreground">(n'occupe pas de siège)</span></Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="animator-plays" id="cfg-animplays" /><Label htmlFor="cfg-animplays" className="font-normal">Animateur + joueur <span className="text-xs text-muted-foreground">(1 place réservée)</span></Label></div>
                </RadioGroup>
              </div>

              {animatorMode !== 'free' && (
                <div className="grid grid-cols-4 items-center gap-3">
                  <Label className="text-right pt-2 self-start">Nom animateur</Label>
                  <div className="col-span-3 space-y-2">
                    <Select
                      value={animatorCustom ? '__OTHER__' : (form.authorAnimator || '')}
                      onValueChange={(v) => {
                        if (v === '__OTHER__') { setAnimatorCustom(true); setForm(p => ({ ...p, authorAnimator: '' })); }
                        else { setAnimatorCustom(false); setForm(p => ({ ...p, authorAnimator: v })); }
                      }}
                      disabled={isSaving}
                    >
                      <SelectTrigger className="rounded-md"><SelectValue placeholder="Sélectionner un animateur" /></SelectTrigger>
                      <SelectContent>
                        {animators.length === 0 && <SelectItem value="_NO_ANIM_" disabled>Aucun animateur (lancer l&apos;import)</SelectItem>}
                        {animators.map(a => (<SelectItem key={a.id} value={animatorDisplayName(a)}>{animatorDisplayName(a)}</SelectItem>))}
                        <SelectItem value="__OTHER__">➕ Autre / nouveau…</SelectItem>
                      </SelectContent>
                    </Select>
                    {animatorCustom && (
                      <Input value={form.authorAnimator || ''} onChange={(e) => setForm(p => ({ ...p, authorAnimator: e.target.value }))} className="rounded-md" placeholder="Prénom Nom" disabled={isSaving} autoComplete="off" />
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-4 items-start gap-3">
                <Label className="text-right pt-2">Forme</Label>
                <RadioGroup value={form.tableShape || 'round'} onValueChange={(v) => setForm(p => ({ ...p, tableShape: v as TableShape }))} className="col-span-3 flex flex-wrap gap-x-6 gap-y-2" disabled={isSaving}>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="round" id="cfg-round" /><Label htmlFor="cfg-round" className="font-normal">Ronde</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="rectangle" id="cfg-rect" /><Label htmlFor="cfg-rect" className="font-normal">Rectangulaire</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="double" id="cfg-double" /><Label htmlFor="cfg-double" className="font-normal">Double <span className="text-xs text-muted-foreground">(2 rectangles)</span></Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="triple" id="cfg-triple" /><Label htmlFor="cfg-triple" className="font-normal">Triple <span className="text-xs text-muted-foreground">(3 rectangles, grande table)</span></Label></div>
                </RadioGroup>
              </div>

              <div className="grid grid-cols-4 items-center gap-3">
                <Label htmlFor="cfg-seats" className="text-right">Places</Label>
                <div className="col-span-3">
                  <Input id="cfg-seats" type="number" min={1} value={form.totalSeats} onChange={(e) => setForm(p => ({ ...p, totalSeats: parseInt(e.target.value, 10) || 1 }))} className="rounded-md" disabled={isSaving} />
                  {selectedGame && <p className="text-xs text-muted-foreground mt-1">Le jeu se joue à {selectedGame.nbre_min}–{selectedGame.nbre_max} joueurs.</p>}
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-3">
                <span />
                <label className="col-span-3 flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={!!form.isDefault} onCheckedChange={(v) => setForm(p => ({ ...p, isDefault: !!v }))} disabled={isSaving} />
                  Configuration par défaut de ce jeu <span className="text-xs text-muted-foreground">(utilisée pour « Remplir la ligne »)</span>
                </label>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>Annuler</Button>
                <Button type="submit" disabled={isSaving || !form.gameId}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Gamepad2 className="mr-2 h-4 w-4" />}
                  {editing ? 'Enregistrer' : 'Créer'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
