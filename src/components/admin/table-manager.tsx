
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  getGameTables,
  addGameTable,
  updateGameTable,
  deleteGameTable,
  getRegistrationsForTable,
  getRegistrations,
  getGames,
} from '@/lib/data';
import type { GameTable, GameTableInput, Registration, Game } from '@/lib/types';
import { Pencil, Trash2, Loader2, AlertTriangle, Users, Gamepad2, TableIcon, UserSquare2 } from 'lucide-react';
import GameManager from './game-manager';

const conventionDayOrder = ['Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const timeSlotOrder = ["09:00 - 13:00", "14:00 - 19:00"];

const defaultTableFormData: GameTableInput = {
  gameId: '',
  day: 'Jeudi',
  timeSlot: '09:00 - 13:00',
  totalSeats: 4,
  tableNumber: '',
  authorAnimator: '',
};

export default function ConventionManager() {
  const [activeTab, setActiveTab] = useState("games");
  const [tables, setTables] = useState<GameTable[]>([]);
  const [allGames, setAllGames] = useState<Game[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [isLoadingTables, setIsLoadingTables] = useState(true);
  const [isSubmittingTable, setIsSubmittingTable] = useState(false);
  const [isDeletingTable, setIsDeletingTable] = useState<string | null>(null);
  const [isTableDialogOpen, setIsTableDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<GameTable | null>(null);
  const [tableToDelete, setTableToDelete] = useState<GameTable | null>(null);
  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);
  
  const [tableFormData, setTableFormData] = useState<GameTableInput>(defaultTableFormData);
  const { toast } = useToast();

  const fetchTableData = useCallback(async (setPageLoadingState = true) => {
    if (setPageLoadingState) {
        setIsLoadingTables(true);
    }
    try {
      const [fetchedTables, fetchedRegistrationsResult, fetchedGamesList] = await Promise.all([
        getGameTables(),
        getRegistrations(),
        getGames(),
      ]);
      setTables(fetchedTables);
      setRegistrations(fetchedRegistrationsResult);
      setAllGames(fetchedGamesList);
    } catch (error) {
      console.error("Erreur lors de la récupération des données des tables:", error);
      const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
      toast({ variant: "destructive", title: "Erreur de chargement (Tables)", description: errorMessage });
    } finally {
      if (setPageLoadingState) {
        setIsLoadingTables(false);
      }
    }
  }, [toast]);

  useEffect(() => {
    if (activeTab === "tables") {
      fetchTableData(true);
    }
  }, [fetchTableData, activeTab]);

  const handleTableSelectChange = (name: keyof Pick<GameTableInput, 'day' | 'timeSlot' | 'gameId'>) => (value: string) => {
     setTableFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleTableNonSelectInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setTableFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value, 10) || 0 : value,
    }));
  };

  const handleEditTable = (table: GameTable) => {
    setEditingTable(table);
    setTableFormData({
        gameId: table.gameId,
        day: table.day,
        timeSlot: table.timeSlot,
        totalSeats: table.totalSeats,
        tableNumber: table.tableNumber || '',
        authorAnimator: table.authorAnimator || '',
    });
    setIsTableDialogOpen(true);
  };

  const openDeleteConfirmationDialog = (table: GameTable) => {
    setTableToDelete(table);
    setIsConfirmDeleteDialogOpen(true);
    // toast({ title: "Clic !", description: `Tentative de suppression de la table : ${table.gameName}` });
  };

  const confirmDeleteTable = async () => {
    if (!tableToDelete) return;
    
    setIsDeletingTable(tableToDelete.id);
    setIsConfirmDeleteDialogOpen(false);

    try {
        const currentTableRegistrations = await getRegistrationsForTable(tableToDelete.id);
        if (currentTableRegistrations.length > 0) {
            toast({ 
                variant: "destructive", 
                title: "Suppression impossible", 
                description: `La table "${tableToDelete.gameName}" (N° ${tableToDelete.tableNumber}) a ${currentTableRegistrations.length} joueur(s) inscrit(s) et ne peut pas être supprimée.`,
                action: <AlertTriangle className="text-destructive-foreground h-5 w-5" />,
                duration: 7000,
            });
            setTableToDelete(null);
            setIsDeletingTable(null);
            return;
        }
        
        await deleteGameTable(tableToDelete.id);
        
        setTables(prevTables => prevTables.filter(t => t.id !== tableToDelete.id));
        setRegistrations(prevRegs => prevRegs.filter(reg => reg.tableId !== tableToDelete.id));

        toast({ title: "Table supprimée", description: `La table "${tableToDelete.gameName}" (N° ${tableToDelete.tableNumber}) a été supprimée avec succès.` });
    } catch (err) {
         const errorMessage = err instanceof Error ? err.message : "Une erreur inconnue est survenue.";
         if (!errorMessage.includes("joueur(s) inscrit(s)")) { // Avoid re-toast if already handled
            toast({ 
                variant: "destructive", 
                title: "Erreur lors de la suppression", 
                description: errorMessage,
            });
         }
    } finally {
        setIsDeletingTable(null); 
        setTableToDelete(null);
    }
  };

  const handleOpenTableDialogForAdd = () => {
    setEditingTable(null);
    setTableFormData(defaultTableFormData);
    setIsTableDialogOpen(true);
  };

   const handleTableSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingTable(true);

    if (!tableFormData.gameId || !tableFormData.day || !tableFormData.timeSlot || tableFormData.totalSeats <= 0 || !tableFormData.tableNumber) {
        toast({ variant: "destructive", title: "Entrée invalide (Table)", description: "Veuillez remplir tous les champs obligatoires, y compris le numéro de table, et sélectionner un jeu." });
        setIsSubmittingTable(false);
        return;
    }

    try {
        if (editingTable) {
            await updateGameTable({ ...tableFormData, id: editingTable.id });
            toast({ title: "Table mise à jour", description: "Détails de la table de jeu enregistrés." });
        } else {
            await addGameTable(tableFormData);
            toast({ title: "Table ajoutée", description: "Nouvelle table de jeu créée avec succès." });
        }
        await fetchTableData(false); 
        setIsTableDialogOpen(false);
        setEditingTable(null);
        setTableFormData(defaultTableFormData);
    } catch(error) {
         const errorMessage = error instanceof Error ? error.message : "Opération inconnue échouée.";
         toast({ variant: "destructive", title: "Opération Table échouée", description: errorMessage });
    } finally {
        setIsSubmittingTable(false);
    }
  };

  const renderTableManagerContent = () => {
    if (isLoadingTables) {
      return (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-4 text-muted-foreground">Chargement des tables...</p>
        </div>
      );
    }
    return (
      <>
        <div className="flex justify-end mb-4">
            <Button onClick={handleOpenTableDialogForAdd} disabled={isSubmittingTable || !!isDeletingTable} className="shadow-sm rounded-md">
              <TableIcon className="mr-2 h-4 w-4" /> Ajouter une table
            </Button>
        </div>
        <Dialog open={isTableDialogOpen} onOpenChange={(open) => {
          setIsTableDialogOpen(open);
          if (!open) {
            setEditingTable(null);
            setTableFormData(defaultTableFormData);
          }
        }}>
          <DialogContent className="sm:max-w-[500px] rounded-lg shadow-xl">
            <DialogHeader>
              <DialogTitle>{editingTable ? 'Modifier la table de jeu' : 'Ajouter une nouvelle table de jeu'}</DialogTitle>
              <DialogDescription>
                {editingTable ? 'Modifier les détails de la table existante.' : 'Entrez les détails de la nouvelle table de jeu.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleTableSubmit}>
              <div className="grid gap-4 py-4">
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="tableNumber" className="text-right">Numéro de table</Label>
                    <Input 
                        id="tableNumber" 
                        name="tableNumber" 
                        value={tableFormData.tableNumber} 
                        onChange={handleTableNonSelectInputChange} 
                        className="col-span-3 rounded-md shadow-sm" 
                        required 
                        disabled={isSubmittingTable}
                        placeholder="Ex: 101, A5, Bleu-1"
                    />
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="gameId" className="text-right">Jeu</Label>
                     <Select name="gameId" value={tableFormData.gameId} onValueChange={handleTableSelectChange('gameId')} required disabled={isSubmittingTable || allGames.length === 0}>
                        <SelectTrigger className="col-span-3 rounded-md shadow-sm">
                            <SelectValue placeholder="Sélectionner un jeu" />
                        </SelectTrigger>
                        <SelectContent>
                            {allGames.length === 0 && <SelectItem value="" disabled>Aucun jeu disponible. Ajoutez des jeux d'abord.</SelectItem>}
                            {allGames.map(game => (
                                <SelectItem key={game.id} value={game.id}>{game.nom}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="authorAnimator" className="text-right">Auteur/Animateur</Label>
                    <Input 
                        id="authorAnimator" 
                        name="authorAnimator" 
                        value={tableFormData.authorAnimator || ''} 
                        onChange={handleTableNonSelectInputChange} 
                        className="col-span-3 rounded-md shadow-sm" 
                        disabled={isSubmittingTable}
                        placeholder="Nom de l'auteur/animateur (optionnel)"
                    />
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="day" className="text-right">Jour</Label>
                     <Select name="day" value={tableFormData.day} onValueChange={handleTableSelectChange('day')} required disabled={isSubmittingTable}>
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
                     <Select name="timeSlot" value={tableFormData.timeSlot} onValueChange={handleTableSelectChange('timeSlot')} required disabled={isSubmittingTable}>
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
                    <Input id="totalSeats" name="totalSeats" type="number" value={tableFormData.totalSeats} onChange={handleTableNonSelectInputChange} className="col-span-3 rounded-md shadow-sm" min="1" required disabled={isSubmittingTable} />
                 </div>
              </div>
              <DialogFooter>
                 <DialogClose asChild>
                    <Button type="button" variant="outline" disabled={isSubmittingTable} className="shadow-sm rounded-md">Annuler</Button>
                 </DialogClose>
                <Button type="submit" disabled={isSubmittingTable || allGames.length === 0} className="shadow-sm rounded-md">
                    {isSubmittingTable && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingTable ? 'Enregistrer les modifications' : 'Ajouter la table'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={isConfirmDeleteDialogOpen} onOpenChange={setIsConfirmDeleteDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                    <AlertDialogDescription>
                        Êtes-vous sûr de vouloir supprimer la table "{tableToDelete?.gameName}" (N° {tableToDelete?.tableNumber}) ?
                        <br/><strong>Cette action est irréversible et ne sera effectuée que si aucune inscription n'est associée à cette table.</strong>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => { setIsConfirmDeleteDialogOpen(false); setTableToDelete(null); }} disabled={isDeletingTable === tableToDelete?.id}>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDeleteTable} disabled={isDeletingTable === tableToDelete?.id} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                        {isDeletingTable === tableToDelete?.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Supprimer
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>


        {tables.length > 0 ? (
            <Table>
            <TableCaption>Une liste des tables de jeu configurées.</TableCaption>
            <TableHeader>
                <TableRow>
                <TableHead className="w-24">N°</TableHead>
                <TableHead className="w-64">Visuel</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Auteur/Animateur</TableHead>
                <TableHead>Jour</TableHead>
                <TableHead>Créneau horaire</TableHead>
                <TableHead className="text-center">Places</TableHead>
                <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                 {tables.sort((a, b) => {
                    const numA = a.tableNumber || '';
                    const numB = b.tableNumber || '';
                    const isNumA = !isNaN(parseFloat(numA)) && isFinite(numA as any);
                    const isNumB = !isNaN(parseFloat(numB)) && isFinite(numB as any);

                    if (isNumA && isNumB) {
                        if (parseFloat(numA) < parseFloat(numB)) return -1;
                        if (parseFloat(numA) > parseFloat(numB)) return 1;
                    } else {
                        if (numA.toLowerCase() < numB.toLowerCase()) return -1;
                        if (numA.toLowerCase() > numB.toLowerCase()) return 1;
                    }
                    
                    const nameA = a.gameName?.toLowerCase() || '';
                    const nameB = b.gameName?.toLowerCase() || '';
                    if (nameA < nameB) return -1;
                    if (nameA > nameB) return 1;

                    const dayAIndex = conventionDayOrder.indexOf(a.day);
                    const dayBIndex = conventionDayOrder.indexOf(b.day);
                    if (dayAIndex < dayBIndex) return -1;
                    if (dayAIndex > dayBIndex) return 1;
                    
                    const timeSlotAIndex = timeSlotOrder.indexOf(a.timeSlot);
                    const timeSlotBIndex = timeSlotOrder.indexOf(b.timeSlot);
                    if (timeSlotAIndex < timeSlotBIndex) return -1;
                    if (timeSlotAIndex > timeSlotBIndex) return 1;

                    return 0;
                }).map((table) => {
                  const occupiedSeats = registrations.filter(r => r.tableId === table.id).length;
                  const imageUrl = table.gameImageUrl || table.imageUrl;
                  return (
                    <TableRow key={table.id}>
                        <TableCell className="font-medium w-24">{table.tableNumber || 'N/A'}</TableCell>
                        <TableCell className="w-64 px-4 py-1">
                            {imageUrl ? (
                                <Image
                                    src={imageUrl}
                                    alt={`Image ${table.gameName || 'Jeu inconnu'}`}
                                    width={256} 
                                    height={144} 
                                    className="rounded object-contain h-20 w-auto shadow-sm" 
                                    data-ai-hint="game cover"
                                />
                            ) : (
                                <div className="h-20 w-full bg-muted rounded flex items-center justify-center text-xs text-muted-foreground shadow-sm">?</div>
                            )}
                        </TableCell>
                        <TableCell className="font-medium"><strong>{table.gameName || 'Jeu inconnu'}</strong></TableCell>
                        <TableCell>{table.authorAnimator || <span className="text-muted-foreground italic">N/A</span>}</TableCell>
                        <TableCell>{table.day}</TableCell>
                        <TableCell>{table.timeSlot}</TableCell>
                        <TableCell className="text-center">
                           <Badge variant={occupiedSeats === table.totalSeats ? "destructive" : "default"} className="bg-accent text-accent-foreground px-2 py-1 shadow-sm">
                             <Users className="inline h-4 w-4 mr-1" /> {occupiedSeats} / {table.totalSeats}
                           </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                        <Button variant="outline" size="icon" onClick={() => handleEditTable(table)} disabled={isSubmittingTable || !!isDeletingTable} className="shadow-sm rounded-md">
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Modifier</span>
                        </Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button 
                                    variant="destructive" 
                                    size="icon" 
                                    disabled={isSubmittingTable || (isDeletingTable !== null && isDeletingTable !== table.id) || isDeletingTable === table.id}
                                    className="shadow-sm rounded-md hover:bg-black hover:text-destructive-foreground"
                                    title={`Supprimer la table ${table.gameName} (N° ${table.tableNumber})`}
                                >
                                    {isDeletingTable === table.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                    <span className="sr-only">Supprimer</span>
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Êtes-vous absolument sûr(e) ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Cette action est irréversible. La table "{table.gameName}" (N° {table.tableNumber}) sera définitivement supprimée.
                                    <br/><strong>La suppression ne sera effectuée que si aucune inscription n'est associée à cette table.</strong>
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel disabled={isDeletingTable === table.id} onClick={() => setTableToDelete(null)}>Annuler</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={confirmDeleteTable}
                                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                    disabled={isDeletingTable === table.id}
                                >
                                    {isDeletingTable === table.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Confirmer la suppression
                                </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                        </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
            </Table>
        ) : (
             <p className="text-muted-foreground text-center py-4">Aucune table configurée pour le moment. Cliquez sur <strong>Ajouter une table</strong> pour en créer une.</p>
        )}
      </>
    );
  }

  return (
    <Card className="shadow-lg rounded-lg">
      <CardHeader>
          <CardTitle>Gestion des tables et des jeux</CardTitle>
          <CardDescription>Ajouter, modifier ou supprimer des jeux ou des tables.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="games">Gestion des jeux</TabsTrigger>
            <TabsTrigger value="tables">Gestion des tables</TabsTrigger>
          </TabsList>
          <TabsContent value="games" className="mt-4">
            <GameManager />
          </TabsContent>
          <TabsContent value="tables" className="mt-4">
            {renderTableManagerContent()}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

