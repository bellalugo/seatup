
'use client';

import type React from 'react'; // Ensure React is imported for ElementType
import { useState, useEffect, useCallback } from 'react'; // Added useCallback
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
} from '@/lib/data';
import type { GameTable, GameTableInput } from '@/lib/types';
import { Pencil, Trash2, PlusCircle, Loader2 } from 'lucide-react';

const conventionDayOrder = ['Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const timeSlotOrder = ["09:00 - 13:00", "14:00 - 19:00"];

export default function TableManager() {
  const [tables, setTables] = useState<GameTable[]>([]);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<GameTable | null>(null);
  const [formData, setFormData] = useState<Omit<GameTableInput, 'imageUrl'>>({
    gameName: '',
    day: 'Jeudi',
    timeSlot: '09:00 - 13:00',
    totalSeats: 4,
  });
  const { toast } = useToast();

  const fetchTables = useCallback(async (setPageLoadingState = true) => {
    console.log('TableManager: fetchTables called. setPageLoadingState:', setPageLoadingState, 'Current isLoadingPage before fetch:', isLoadingPage); // Debug log
    if (setPageLoadingState) {
        setIsLoadingPage(true);
    }
    try {
      const fetchedTables = await getGameTables();
      setTables(fetchedTables);
    } catch (error) {
      console.error("Erreur lors de la récupération des tables:", error);
      toast({ variant: "destructive", title: "Erreur de chargement", description: (error as Error).message });
    } finally {
      if (setPageLoadingState) {
        setIsLoadingPage(false);
      }
      console.log('TableManager: fetchTables finished. Current isLoadingPage after fetch:', isLoadingPage); // Debug log
    }
  }, [toast, isLoadingPage]); // Added isLoadingPage to dependencies of useCallback as it's used in log

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

  const handleSelectChange = (name: keyof Omit<GameTableInput, 'imageUrl' | 'gameName' | 'totalSeats'>) => (value: string) => {
     setFormData(prev => ({ ...prev, [name]: value as GameTable['day'] | GameTable['timeSlot'] }));
  };

  const handleEdit = (table: GameTable) => {
    setEditingTable(table);
    setFormData({
        gameName: table.gameName,
        day: table.day,
        timeSlot: table.timeSlot,
        totalSeats: table.totalSeats,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (tableId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette table ? Cette action supprimera également toutes les inscriptions associées.")) {
        return;
    }
    setIsSubmitting(true);
    try {
        await deleteGameTable(tableId);
        await fetchTables(false); 
        toast({ title: "Table supprimée", description: "La table de jeu et ses inscriptions ont été supprimées." });
    } catch (error) {
         toast({ variant: "destructive", title: "Erreur lors de la suppression", description: (error as Error).message });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleOpenDialogForAdd = () => {
    setEditingTable(null);
    setFormData({
      gameName: '',
      day: 'Jeudi',
      timeSlot: '09:00 - 13:00',
      totalSeats: 4,
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
        ...formData
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
        });
    } catch(error) {
         toast({ variant: "destructive", title: "Opération échouée", description: (error as Error).message });
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
    <Card className="shadow-lg">
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
            });
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenDialogForAdd} disabled={isSubmitting}>
              <PlusCircle className="mr-2 h-4 w-4" /> Ajouter une table
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
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
                    <Input id="gameName" name="gameName" value={formData.gameName} onChange={handleInputChange} className="col-span-3" required disabled={isSubmitting} />
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="day" className="text-right">Jour</Label>
                     <Select name="day" value={formData.day} onValueChange={handleSelectChange('day')} required disabled={isSubmitting}>
                        <SelectTrigger className="col-span-3">
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
                         <SelectTrigger className="col-span-3">
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
                    <Input id="totalSeats" name="totalSeats" type="number" value={formData.totalSeats} onChange={handleInputChange} className="col-span-3" min="1" required disabled={isSubmitting} />
                 </div>
              </div>
              <DialogFooter>
                 <DialogClose asChild>
                    <Button type="button" variant="outline" disabled={isSubmitting}>Annuler</Button>
                 </DialogClose>
                <Button type="submit" disabled={isSubmitting}>
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
                <TableHead>Image</TableHead>
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
                    <TableCell>
                        {table.imageUrl ? (
                            <Image
                                src={table.imageUrl}
                                alt={`Icône ${table.gameName}`}
                                width={32}
                                height={32}
                                className="rounded object-cover h-8 w-8"
                                data-ai-hint="game icon"
                            />
                        ) : (
                            <div className="h-8 w-8 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">?</div>
                        )}
                    </TableCell>
                    <TableCell className="font-medium">{table.gameName}</TableCell>
                    <TableCell>{table.day}</TableCell>
                    <TableCell>{table.timeSlot}</TableCell>
                    <TableCell className="text-center">{table.totalSeats}</TableCell>
                    <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="icon" onClick={() => handleEdit(table)} disabled={isSubmitting}>
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Modifier</span>
                    </Button>
                    <Button variant="destructive" size="icon" onClick={() => handleDelete(table.id)} disabled={isSubmitting}>
                        {isSubmitting && tables.find(t => t.id === table.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        <span className="sr-only">Supprimer</span>
                    </Button>
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
