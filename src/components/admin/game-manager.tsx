
'use client';

import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  getGames,
  addGame,
  updateGame,
  deleteGame,
} from '@/lib/data';
import type { Game, GameInput } from '@/lib/types';
import { Pencil, Trash2, Loader2, AlertTriangle, Gamepad2 } from 'lucide-react';

const defaultGameFormData: GameInput = {
  nom: '',
  description: '',
  imageUrl: '',
  asynconvURL: '',
  nbre_min: 1,
  nbre_max: 4,
  tableNumber: '',
};

export default function GameManager() {
  const [games, setGames] = useState<Game[]>([]);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isGameDialogOpen, setIsGameDialogOpen] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  
  const [gameFormData, setGameFormData] = useState<GameInput>(defaultGameFormData);
  const { toast } = useToast();

  const fetchGames = useCallback(async () => {
    setIsLoadingPage(true);
    try {
      const fetchedGames = await getGames();
      setGames(fetchedGames);
    } catch (error) {
      console.error("Erreur lors de la récupération des jeux:", error);
      const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
      toast({ variant: "destructive", title: "Erreur de chargement des jeux", description: errorMessage });
    } finally {
      setIsLoadingPage(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  const handleGameInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setGameFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value, 10) || 0 : value,
    }));
  };

  const handleEditGame = (game: Game) => {
    setEditingGame(game);
    setGameFormData({
        nom: game.nom,
        description: game.description,
        imageUrl: game.imageUrl,
        asynconvURL: game.asynconvURL,
        nbre_min: game.nbre_min,
        nbre_max: game.nbre_max,
        tableNumber: game.tableNumber || '',
    });
    setIsGameDialogOpen(true);
  };

  const handleDeleteGameAttempt = async (gameId: string) => {
    const gameToDelete = games.find(g => g.id === gameId);
    if (!gameToDelete) {
        toast({ variant: "destructive", title: "Erreur", description: "Jeu non trouvé."});
        return;
    }
    setIsDeleting(gameId); 

    try {
        await deleteGame(gameId);
        setGames(prevGames => prevGames.filter(g => g.id !== gameId));
        toast({ title: "Jeu supprimé", description: `Le jeu "${gameToDelete.nom}" a été supprimé avec succès.` });
    } catch (err) {
         const errorMessage = err instanceof Error ? err.message : "Une erreur inconnue est survenue.";
         if (errorMessage.startsWith("Impossible de supprimer le jeu. Il est utilisé par")) {
            toast({ 
                variant: "destructive",
                title: "Suppression impossible", // Titre plus spécifique
                description: errorMessage, // Contient la raison spécifique
                action: <AlertTriangle className="text-destructive-foreground h-5 w-5" />,
                duration: 7000,
            });
         } else {
            // Erreur générique
            toast({ 
                variant: "destructive", 
                title: "Erreur lors de la suppression", 
                description: errorMessage,
                duration: 7000,
            });
         }
    } finally {
        setIsDeleting(null); 
    }
  };

  const handleOpenGameDialogForAdd = () => {
    setEditingGame(null);
    setGameFormData(defaultGameFormData);
    setIsGameDialogOpen(true);
  };

   const handleGameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (!gameFormData.nom || gameFormData.nbre_min <= 0 || gameFormData.nbre_max < gameFormData.nbre_min) {
        toast({ variant: "destructive", title: "Entrée invalide", description: "Veuillez remplir tous les champs obligatoires correctement. Le nombre max de joueurs doit être supérieur ou égal au min." });
        setIsSubmitting(false);
        return;
    }

    try {
        if (editingGame) {
            await updateGame({ ...gameFormData, id: editingGame.id });
            toast({ title: "Jeu mis à jour", description: "Détails du jeu enregistrés." });
        } else {
            await addGame(gameFormData);
            toast({ title: "Jeu ajouté", description: "Nouveau jeu créé avec succès." });
        }
        await fetchGames(); 
        setIsGameDialogOpen(false);
        setEditingGame(null);
        setGameFormData(defaultGameFormData);
    } catch(error) {
         const errorMessage = error instanceof Error ? error.message : "Opération inconnue échouée.";
         toast({ variant: "destructive", title: "Opération échouée", description: errorMessage });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (isLoadingPage) {
    return (
      <div className="flex justify-center items-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Chargement des jeux...</p>
      </div>
    );
  }

  return (
    <div>
        <div className="flex justify-end mb-4">
            <Button onClick={handleOpenGameDialogForAdd} disabled={isSubmitting || !!isDeleting} className="shadow-sm rounded-md">
              <Gamepad2 className="mr-2 h-4 w-4" /> Ajouter un jeu
            </Button>
        </div>
        
        <Dialog open={isGameDialogOpen} onOpenChange={(open) => {
          setIsGameDialogOpen(open);
          if (!open) {
            setEditingGame(null);
            setGameFormData(defaultGameFormData);
          }
        }}>
          <DialogContent className="sm:max-w-2xl rounded-lg shadow-xl">
            <DialogHeader>
              <DialogTitle>{editingGame ? 'Modifier le jeu' : 'Ajouter un nouveau jeu'}</DialogTitle>
              <DialogDescription>
                {editingGame ? 'Modifier les détails du jeu existant.' : 'Entrez les détails du nouveau jeu.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleGameSubmit}>
              <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="nom" className="text-right">Nom du jeu</Label>
                    <Input id="nom" name="nom" value={gameFormData.nom} onChange={handleGameInputChange} className="col-span-3 rounded-md shadow-sm" required disabled={isSubmitting} />
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="tableNumber" className="text-right">N° de table</Label>
                    <Input id="tableNumber" name="tableNumber" value={gameFormData.tableNumber || ''} onChange={handleGameInputChange} className="col-span-3 rounded-md shadow-sm" disabled={isSubmitting} placeholder="Ex: 1, A5 (table physique fixe)" />
                 </div>
                 <div className="grid grid-cols-4 items-start gap-4">
                    <Label htmlFor="description" className="text-right pt-2">Description</Label>
                    <Textarea id="description" name="description" value={gameFormData.description} onChange={handleGameInputChange} className="col-span-3 rounded-md shadow-sm" rows={4} disabled={isSubmitting} />
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="imageUrl" className="text-right">URL de l'image</Label>
                    <Input id="imageUrl" name="imageUrl" value={gameFormData.imageUrl} onChange={handleGameInputChange} className="col-span-3 rounded-md shadow-sm" disabled={isSubmitting} placeholder="https://exemple.com/image.png"/>
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="asynconvURL" className="text-right">Page ASYNCONV</Label>
                    <Input id="asynconvURL" name="asynconvURL" value={gameFormData.asynconvURL} onChange={handleGameInputChange} className="col-span-3 rounded-md shadow-sm" disabled={isSubmitting} placeholder="https://www.asynconv.fr/..."/>
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="nbre_min" className="text-right">Joueurs Min.</Label>
                    <Input id="nbre_min" name="nbre_min" type="number" value={gameFormData.nbre_min} onChange={handleGameInputChange} className="col-span-3 rounded-md shadow-sm" min="1" required disabled={isSubmitting} />
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="nbre_max" className="text-right">Joueurs Max.</Label>
                    <Input id="nbre_max" name="nbre_max" type="number" value={gameFormData.nbre_max} onChange={handleGameInputChange} className="col-span-3 rounded-md shadow-sm" min="1" required disabled={isSubmitting} />
                 </div>
              </div>
              <DialogFooter className="pt-4">
                 <DialogClose asChild>
                    <Button type="button" variant="outline" disabled={isSubmitting} className="shadow-sm rounded-md">Annuler</Button>
                 </DialogClose>
                <Button type="submit" disabled={isSubmitting} className="shadow-sm rounded-md">
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingGame ? 'Enregistrer les modifications' : 'Ajouter le jeu'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {games.length > 0 ? (
            <Table>
            <TableCaption>Une liste des jeux configurés pour la convention.</TableCaption>
            <TableHeader>
                <TableRow>
                <TableHead className="w-40">Image</TableHead>
                <TableHead className="text-center w-20">N° table</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead className="w-1/3">Description</TableHead>
                <TableHead>Page ASYNCONV</TableHead>
                <TableHead className="text-center">Joueurs</TableHead>
                <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                 {[...games].sort((a, b) =>
                     (parseInt(a.tableNumber || '', 10) || 9999) - (parseInt(b.tableNumber || '', 10) || 9999)
                     || (a.nom || '').localeCompare(b.nom || '')
                   ).map((game) => (
                    <TableRow key={game.id}>
                        <TableCell className="w-40 px-2 py-1">
                            {game.imageUrl ? (
                                <Image
                                    src={game.imageUrl}
                                    alt={`Image ${game.nom}`}
                                    width={128} 
                                    height={72} 
                                    className="rounded object-contain h-16 w-auto shadow-sm"
                                    data-ai-hint="game cover"
                                />
                            ) : (
                                <div className="h-16 w-full bg-muted rounded flex items-center justify-center text-xs text-muted-foreground shadow-sm">?</div>
                            )}
                        </TableCell>
                        <TableCell className="text-center">
                            {game.tableNumber ? <span className="bg-foreground text-background px-1.5 py-0.5 rounded text-xs font-medium">{game.tableNumber}</span> : <span className="text-muted-foreground text-xs">–</span>}
                        </TableCell>
                        <TableCell className="font-medium"><strong>{game.nom}</strong></TableCell>
                        <TableCell className="text-xs text-muted-foreground italic whitespace-pre-line">{game.description}</TableCell>
                        <TableCell>
                            <a href={game.asynconvURL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs truncate max-w-[150px] block">
                                {game.asynconvURL}
                            </a>
                        </TableCell>
                        <TableCell className="text-center">{game.nbre_min} - {game.nbre_max}</TableCell>
                        <TableCell className="text-right space-x-2">
                        <Button variant="outline" size="icon" onClick={() => handleEditGame(game)} disabled={isSubmitting || !!isDeleting} className="shadow-sm rounded-md">
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Modifier</span>
                        </Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button 
                                    variant="destructive" 
                                    size="icon" 
                                    disabled={isSubmitting || (isDeleting !== null && isDeleting !== game.id) || isDeleting === game.id}
                                    className="shadow-sm rounded-md hover:bg-black hover:text-destructive-foreground"
                                    title={`Supprimer le jeu ${game.nom}`}
                                >
                                    {isDeleting === game.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                    <span className="sr-only">Supprimer</span>
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Êtes-vous absolument sûr(e) ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Cette action est irréversible. Le jeu "{game.nom}" sera définitivement supprimé.
                                    <br/><strong>La suppression ne sera effectuée que si aucune table de jeu n'est associée à ce jeu.</strong>
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel disabled={isDeleting === game.id}>Annuler</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={() => handleDeleteGameAttempt(game.id)}
                                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                    disabled={isDeleting === game.id}
                                >
                                    {isDeleting === game.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Confirmer la suppression
                                </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                        </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
            </Table>
        ) : (
             <p className="text-muted-foreground text-center py-4">Aucun jeu configuré pour le moment. Cliquez sur <strong>Ajouter un jeu</strong> pour en créer un.</p>
        )}
    </div>
  );
}

