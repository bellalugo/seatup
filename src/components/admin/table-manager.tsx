
'use client';

import type React from 'react'; // Ensure React is imported for ElementType
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
  DialogTrigger,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  getGameTables,
  addGameTable,
  updateGameTable,
  deleteGameTable,
  getRegistrationsForTable,
} from '@/lib/data';
import type { GameTable, GameTableInput } from '@/lib/types';
import { Pencil, Trash2, PlusCircle, Loader2, AlertTriangle } from 'lucide-react';

const conventionDayOrder = ['Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const timeSlotOrder = ["09:00 - 13:00", "14:00 - 19:00"];

export default function TableManager() {
  const [tables, setTables] = useState<GameTable[]>([]);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null); // Track which table is being deleted
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<GameTable | null>(null);
  
  const [formData, setFormData] = useState<GameTableInput>({
    gameName: '',
    day: 'Jeudi',
    timeSlot: '09:00 - 13:00',
    totalSeats: 4,
    imageUrl: undefined, 
  });
  const { toast } = useToast();

  const fetchTables = useCallback(async (setPageLoadingState = true) => {
    if (setPageLoadingState) {
        setIsLoadingPage(true);
    }
    try {
      const fetchedTables = await getGameTables();
      setTables(fetchedTables);
    } catch (error) {
      console.error("Erreur lors de la récupération des tables:", error);
      const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
      toast({ variant: "destructive", title: "Erreur de chargement", description: errorMessage });
    } finally {
      if (setPageLoadingState) {
        setIsLoadingPage(false);
      }
    }
  }, [toast]);

  useEffect(() => {
    fetchTables(true);
  }, [fetchTables]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value, 10) || 0 : value,
    }));
  };

  const handleSelectChange = (name: keyof Pick<GameTableInput, 'day' | 'timeSlot'>) => (value: string) => {
     setFormData(prev => ({ ...prev, [name]: value as GameTable['day'] | GameTable['timeSlot'] }));
  };

  const handleEdit = (table: GameTable) => {
    setEditingTable(table);
    setFormData({
        gameName: table.gameName,
        day: table.day,
        timeSlot: table.timeSlot,
        totalSeats: table.totalSeats,
        imageUrl: table.imageUrl,
    });
    setIsDialogOpen(true);
  };

  const confirmDelete = async (tableId: string) => {
     const tableToDelete = tables.find(t => t.id === tableId);
    if (!tableToDelete) {
        toast({ variant: "destructive", title: "Erreur", description: "Table non trouvée."});
        return;
    }
    
    setIsDeleting(tableId);

    try {
        const registrations = await getRegistrationsForTable(tableId);
        if (registrations.length > 0) {
            toast({ 
                variant: "destructive", 
                title: "Suppression impossible", 
                description: `La table "${tableToDelete.gameName}" a ${registrations.length} joueur(s) inscrit(s) et ne peut pas être supprimée.`,
                action: <AlertTriangle className="text-destructive-foreground h-5 w-5" />,
                duration: 5000,
            });
            setIsDeleting(null);
            return;
        }
        // If no registrations, proceed with deletion
        await deleteGameTable(tableId);
        
        setTables(prevTables => prevTables.filter(t => t.id !== tableId));
        toast({ title: "Table supprimée", description: `La table "${tableToDelete.gameName}" a été supprimée avec succès.` });
    } catch (err) {
         const errorMessage = err instanceof Error ? err.message : "Une erreur inconnue est survenue lors de la suppression.";
         // Avoid showing the generic error if it's the "has registrations" error we already handled
         if (!errorMessage.includes("joueur(s) inscrit(s)")) {
            toast({ 
                variant: "destructive", 
                title: "Erreur lors de la suppression", 
                description: errorMessage,
            });
         }
    } finally {
        setIsDeleting(null); 
    }
  };


  const handleOpenDialogForAdd = () => {
    setEditingTable(null);
    setFormData({ 
      gameName: '',
      day: 'Jeudi',
      timeSlot: '09:00 - 13:00',
      totalSeats: 4,
      imageUrl: undefined,
    });
    setIsDialogOpen(true);
  };

   const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (!formData.gameName || !formData.day || !formData.timeSlot || formData.totalSeats <= 0) {
        toast({ variant: "destructive", title: "Entrée invalide", description: "Veuillez remplir tous les champs correctement." });
        setIsSubmitting(false);
        return;
    }

    const tableDataPayload: GameTableInput = {
        gameName: formData.gameName,
        day: formData.day,
        timeSlot: formData.timeSlot,
        totalSeats: formData.totalSeats,
        imageUrl: formData.imageUrl || undefined, 
    };

    try {
        if (editingTable) {
            await updateGameTable({ ...tableDataPayload, id: editingTable.id });
            toast({ title: "Table mise à jour", description: "Détails de la table de jeu enregistrés." });
        } else {
            await addGameTable(tableDataPayload);
            toast({ title: "Table ajoutée", description: "Nouvelle table de jeu créée avec succès." });
        }
        await fetchTables(false); 
        setIsDialogOpen(false);
        setEditingTable(null);
        setFormData({
            gameName: '',
            day: 'Jeudi',
            timeSlot: '09:00 - 13:00',
            totalSeats: 4,
            imageUrl: undefined,
        });
    } catch(error) {
         const errorMessage = error instanceof Error ? error.message : "Opération inconnue échouée.";
         toast({ variant: "destructive", title: "Opération échouée", description: errorMessage });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (isLoadingPage) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-20rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Chargement des tables...</p>
      </div>
    );
  }

  return (
    <Card className="shadow-lg rounded-lg">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Gérer les tables de jeu</CardTitle>
          <CardDescription>Ajouter, modifier ou supprimer des tables de jeu pour la convention.</CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingTable(null);
            setFormData({
                gameName: '',
                day: 'Jeudi',
                timeSlot: '09:00 - 13:00',
                totalSeats: 4,
                imageUrl: undefined,
            });
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenDialogForAdd} disabled={isSubmitting || !!isDeleting} className="shadow-sm rounded-md">
              <PlusCircle className="mr-2 h-4 w-4" /> Ajouter une table
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] rounded-lg shadow-xl">
            <DialogHeader>
              <DialogTitle>{editingTable ? 'Modifier la table de jeu' : 'Ajouter une nouvelle table de jeu'}</DialogTitle>
              <DialogDescription>
                {editingTable ? 'Modifier les détails de la table existante.' : 'Entrez les détails de la nouvelle table de jeu. L\'image du jeu sera définie automatiquement en fonction du nom si disponible.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="gameName" className="text-right">Nom du jeu</Label>
                    <Input id="gameName" name="gameName" value={formData.gameName} onChange={handleInputChange} className="col-span-3 rounded-md shadow-sm" required disabled={isSubmitting} />
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="imageUrl" className="text-right">URL de l'image (optionnel)</Label>
                    <Input id="imageUrl" name="imageUrl" value={formData.imageUrl || ''} onChange={handleInputChange} className="col-span-3 rounded-md shadow-sm" disabled={isSubmitting} placeholder="https://exemple.com/image.png ou /game-icons/monjeu.webp"/>
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="day" className="text-right">Jour</Label>
                     <Select name="day" value={formData.day} onValueChange={handleSelectChange('day')} required disabled={isSubmitting}>
                        <SelectTrigger className="col-span-3 rounded-md shadow-sm">
                            <SelectValue placeholder="Sélectionner le jour" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Jeudi">Jeudi</SelectItem>
                            <SelectItem value="Vendredi">Vendredi</SelectItem>
                            <SelectItem value="Samedi">Samedi</SelectItem>
                            <SelectItem value="Dimanche">Dimanche</SelectItem>
                        </SelectContent>
                    </Select>
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="timeSlot" className="text-right">Créneau horaire</Label>
                     <Select name="timeSlot" value={formData.timeSlot} onValueChange={handleSelectChange('timeSlot')} required disabled={isSubmitting}>
                         <SelectTrigger className="col-span-3 rounded-md shadow-sm">
                             <SelectValue placeholder="Sélectionner le créneau horaire" />
                         </SelectTrigger>
                         <SelectContent>
                             <SelectItem value="09:00 - 13:00">Matin (09:00 - 13:00)</SelectItem>
                             <SelectItem value="14:00 - 19:00">Après-midi (14:00 - 19:00)</SelectItem>
                         </SelectContent>
                     </Select>
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="totalSeats" className="text-right">Nombre total de places</Label>
                    <Input id="totalSeats" name="totalSeats" type="number" value={formData.totalSeats} onChange={handleInputChange} className="col-span-3 rounded-md shadow-sm" min="1" required disabled={isSubmitting} />
                 </div>
              </div>
              <DialogFooter>
                 <DialogClose asChild>
                    <Button type="button" variant="outline" disabled={isSubmitting} className="shadow-sm rounded-md">Annuler</Button>
                 </DialogClose>
                <Button type="submit" disabled={isSubmitting} className="shadow-sm rounded-md">
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingTable ? 'Enregistrer les modifications' : 'Ajouter la table'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {tables.length > 0 ? (
            <Table>
            <TableCaption>Une liste des tables de jeu configurées.</TableCaption>
            <TableHeader>
                <TableRow>
                <TableHead className="w-32">Image</TableHead>
                <TableHead>Nom du jeu</TableHead>
                <TableHead>Jour</TableHead>
                <TableHead>Créneau horaire</TableHead>
                <TableHead className="text-center">Places</TableHead>
                <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {tables.sort((a, b) => { 
                    if (a.gameName !== b.gameName) return a.gameName.localeCompare(b.gameName);
                    const dayAIndex = conventionDayOrder.indexOf(a.day);
                    const dayBIndex = conventionDayOrder.indexOf(b.day);
                    if (dayAIndex !== dayBIndex) return dayAIndex - dayBIndex;
                    return timeSlotOrder.indexOf(a.timeSlot) - timeSlotOrder.indexOf(b.timeSlot);
                }).map((table) => (
                <TableRow key={table.id}>
                    <TableCell className="w-32 px-4 py-2"> {/* Reduced vertical padding */}
                        {table.imageUrl ? (
                            <Image
                                src={table.imageUrl}
                                alt={`Icône ${table.gameName}`}
                                width={128} 
                                height={80} 
                                className="rounded object-contain h-20 shadow-sm"
                                data-ai-hint="game icon"
                            />
                        ) : (
                            <div className="h-20 w-full bg-muted rounded flex items-center justify-center text-xs text-muted-foreground shadow-sm">?</div>
                        )}
                    </TableCell>
                    <TableCell className="font-medium">{table.gameName}</TableCell>
                    <TableCell>{table.day}</TableCell>
                    <TableCell>{table.timeSlot}</TableCell>
                    <TableCell className="text-center">{table.totalSeats}</TableCell>
                    <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="icon" onClick={() => handleEdit(table)} disabled={isSubmitting || !!isDeleting} className="shadow-sm rounded-md">
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Modifier</span>
                    </Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button 
                                variant="destructive" 
                                size="icon" 
                                disabled={isSubmitting || (isDeleting !== null && isDeleting !== table.id) || isDeleting === table.id}
                                className="shadow-sm rounded-md hover:bg-black hover:text-destructive-foreground"
                                title={`Supprimer la table ${table.gameName}`}
                            >
                                {isDeleting === table.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                <span className="sr-only">Supprimer</span>
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>Êtes-vous absolument sûr(e) ?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Cette action est irréversible. La table "{table.gameName}" ({table.day} - {table.timeSlot}) sera définitivement supprimée.
                                La suppression ne sera effectuée que si aucune inscription n'est associée à cette table.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => confirmDelete(table.id)}
                                className="bg-destructive hover:bg-destructive/90"
                            >
                                {isDeleting === table.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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
             <p className="text-muted-foreground text-center py-4">Aucune table configurée pour le moment. Cliquez sur 'Ajouter une table' pour en créer une.</p>
        )}
      </CardContent>
    </Card>
  );
}
