
'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import Image from 'next/image'; // Import next/image
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
  getCurrentTables, // Use getCurrentTables to get the initial state
  addMockTable,
  updateMockTable,
  deleteMockTable,
} from '@/lib/data'; // Adjust import path if needed
import type { GameTable, GameTableInput } from '@/lib/types';
import { Pencil, Trash2, PlusCircle } from 'lucide-react'; // Import icons

// Convention days for sorting consistency if dates were part of GameTable type
const conventionDayOrder = ['Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const timeSlotOrder = ["09:00 - 13:00", "14:00 - 19:00"];


export default function TableManager() {
  const [tables, setTables] = useState<GameTable[]>([]); // Initialize empty, fetch in useEffect
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<GameTable | null>(null);
  const [formData, setFormData] = useState<Omit<GameTableInput, 'imageUrl'>>({
    gameName: '',
    day: 'Jeudi',
    timeSlot: '09:00 - 13:00', // Set default time slot
    totalSeats: 4,
  });
  const { toast } = useToast();

  // Fetch initial data on component mount
  useEffect(() => {
    setTables(getCurrentTables());
  }, []);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value, 10) || 0 : value,
    }));
  };

  const handleSelectChange = (name: keyof typeof formData) => (value: string) => {
     setFormData(prev => ({ ...prev, [name]: value as GameTable['day'] | GameTable['timeSlot'] })); // Cast value
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

  const handleDelete = (tableId: string) => {
    try {
        deleteMockTable(tableId); 
        setTables(getCurrentTables()); 
        toast({ title: "Table supprimée", description: "La table de jeu a été supprimée." });
    } catch (error) {
         toast({ variant: "destructive", title: "Erreur lors de la suppression de la table", description: (error as Error).message });
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

   const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.gameName || !formData.timeSlot || formData.totalSeats <= 0) {
        toast({ variant: "destructive", title: "Entrée invalide", description: "Veuillez remplir tous les champs correctement." });
        return;
    }
    
    const tableDataPayload: GameTableInput = {
        ...formData
    };


    try {
        if (editingTable) {
            updateMockTable({ ...tableDataPayload, id: editingTable.id });
            toast({ title: "Table mise à jour", description: "Détails de la table de jeu enregistrés." });
        } else {
            addMockTable(tableDataPayload);
            toast({ title: "Table ajoutée", description: "Nouvelle table de jeu créée avec succès." });
        }
        setTables(getCurrentTables()); 
        setIsDialogOpen(false); 
    } catch(error) {
         toast({ variant: "destructive", title: "Opération échouée", description: (error as Error).message });
    }

  };


  return (
    <Card className="shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Gérer les tables de jeu</CardTitle>
          <CardDescription>Ajouter, modifier ou supprimer des tables de jeu pour la convention.</CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenDialogForAdd}>
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
                 {/* Form Fields */}
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="gameName" className="text-right">Nom du jeu</Label>
                    <Input id="gameName" name="gameName" value={formData.gameName} onChange={handleInputChange} className="col-span-3" required />
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="day" className="text-right">Jour</Label>
                     <Select name="day" value={formData.day} onValueChange={handleSelectChange('day')} required>
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
                     <Select name="timeSlot" value={formData.timeSlot} onValueChange={handleSelectChange('timeSlot')} required>
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
                    <Input id="totalSeats" name="totalSeats" type="number" value={formData.totalSeats} onChange={handleInputChange} className="col-span-3" min="1" required />
                 </div>
              </div>
              <DialogFooter>
                 <DialogClose asChild>
                    <Button type="button" variant="outline">Annuler</Button>
                 </DialogClose>
                <Button type="submit">{editingTable ? 'Enregistrer les modifications' : 'Ajouter la table'}</Button>
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
                    if (a.day !== b.day) return conventionDayOrder.indexOf(a.day) - conventionDayOrder.indexOf(b.day);
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
                    <Button variant="outline" size="icon" onClick={() => handleEdit(table)}>
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Modifier</span>
                    </Button>
                    <Button variant="destructive" size="icon" onClick={() => handleDelete(table.id)}>
                        <Trash2 className="h-4 w-4" />
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

