
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
  getParticipants, // Import getParticipants
} from '@/lib/data';
import type { GameTable, GameTableInput, Registration, Game, Participant } from '@/lib/types'; // Import Participant
import { Pencil, Trash2, Loader2, AlertTriangle, Users, Gamepad2, TableIcon, UserSquare2, UserCircle2, Copy } from 'lucide-react';
import GameManager from './game-manager';

const conventionDayOrder = ['Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const timeSlotOrder = ["09:00 - 13:00", "14:00 - 19:00"];

const defaultTableFormData: GameTableInput = {
  gameId: '',
  day: 'Jeudi',
  timeSlot: '09:00 - 13:00',
  totalSeats: 4,
  tableNumber: '',
  authorAnimator: '', // Can be initially empty or undefined
};

export default function ConventionManager() {
  const [activeTab, setActiveTab] = useState("games");
  const [tables, setTables] = useState<GameTable[]>([]);
  const [allGames, setAllGames] = useState<Game[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [invitationParticipants, setInvitationParticipants] = useState<Participant[]>([]); // State for invitation participants
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
      const [fetchedTables, fetchedRegistrationsResult, fetchedGamesList, fetchedParticipants] = await Promise.all([
        getGameTables(),
        getRegistrations(),
        getGames(),
        getParticipants(), // Fetch all participants
      ]);
      setTables(fetchedTables);
      setRegistrations(fetchedRegistrationsResult);
      setAllGames(fetchedGamesList);
      
      // Filter for invitation participants
      const invites = fetchedParticipants.filter(p => p.typeBillet === 'Invitation');
      setInvitationParticipants(invites);

    } catch (error) {
      console.error("Erreur lors de la récupération des données des tables et participants:", error);
      const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
      toast({ variant: "destructive", title: "Erreur de chargement (Tables/Participants)", description: errorMessage });
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

  const handleTableSelectChange = (name: keyof Pick<GameTableInput, 'day' | 'timeSlot' | 'gameId' | 'authorAnimator'>) => (value: string) => {
    setTableFormData(prev => {
        const newState = { ...prev, [name]: value === '' ? undefined : value };
        if (name === 'gameId' && value) {
            const selectedGame = allGames.find(game => game.id === value);
            if (selectedGame) {
                newState.totalSeats = selectedGame.nbre_max; 
            }
        }
        return newState;
    });
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

  const handleDuplicateTable = (table: GameTable) => {
    setEditingTable(null);
    setTableFormData({
      gameId: table.gameId,
      day: table.day,
      timeSlot: table.timeSlot,
      totalSeats: table.totalSeats,
      tableNumber: '', 
      authorAnimator: table.authorAnimator || '',
    });
    setIsTableDialogOpen(true);
    toast({
      title: "Table dupliquée",
      description: `Les informations de la table "${table.gameName}" (N° ${table.tableNumber}) ont été copiées. Modifiez le créneau horaire et/ou le numéro de table, puis enregistrez.`,
      duration: 7000,
    });
  };


  const openDeleteConfirmationDialog = (table: GameTable) => {
    setTableToDelete(table);
    setIsConfirmDeleteDialogOpen(true);
  };

  const confirmDeleteTable = async () => {
    if (!tableToDelete) return;
    
    setIsDeletingTable(tableToDelete.id);

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
            setIsDeletingTable(null);
            setTableToDelete(null);
            setIsConfirmDeleteDialogOpen(false);
            return;
        }
        
        await deleteGameTable(tableToDelete.id);
        
        // Optimistic update: Remove from local state
        setTables(prevTables => prevTables.filter(t => t.id !== tableToDelete.id));
        setRegistrations(prevRegs => prevRegs.filter(reg => reg.tableId !== tableToDelete.id));

        toast({ title: "Table supprimée", description: `La table "${tableToDelete.gameName}" (N° ${tableToDelete.tableNumber}) a été supprimée avec succès.` });
    } catch (err) {
         const errorMessage = err instanceof Error ? err.message : "Une erreur inconnue est survenue.";
         if (!(err instanceof Error && err.message.includes("joueur(s) inscrit(s)"))) { 
            toast({ 
                variant: "destructive", 
                title: "Erreur lors de la suppression", 
                description: errorMessage,
            });
         }
    } finally {
        setIsDeletingTable(null); 
        setTableToDelete(null);
        setIsConfirmDeleteDialogOpen(false); 
    }
  };

  const handleOpenTableDialogForAdd = () => {
    setEditingTable(null);
    setTableFormData(defaultTableFormData); 
    setIsTableDialogOpen(true);
  };

   const handleSubmit = async (e: React.FormEvent) => { 
    e.preventDefault();
    setIsSubmittingTable(true);

    if (!tableFormData.gameId || !tableFormData.day || !tableFormData.timeSlot || tableFormData.totalSeats <= 0 || !tableFormData.tableNumber) {
        toast({ variant: "destructive", title: "Entrée invalide (Table)", description: "Veuillez remplir tous les champs obligatoires, y compris le numéro de table et le nombre de places, et sélectionner un jeu." });
        setIsSubmittingTable(false);
        return;
    }
    
    const selectedGameForValidation = allGames.find(g => g.id === tableFormData.gameId);
    if (selectedGameForValidation && (tableFormData.totalSeats < selectedGameForValidation.nbre_min || tableFormData.totalSeats > selectedGameForValidation.nbre_max)) {
        toast({
            variant: "destructive",
            title: "Nombre de places invalide",
            description: `Le nombre de places (${tableFormData.totalSeats}) doit être entre ${selectedGameForValidation.nbre_min} et ${selectedGameForValidation.nbre_max} pour le jeu ${selectedGameForValidation.nom}.`,
            duration: 7000,
        });
        setIsSubmittingTable(false);
        return;
    }


    try {
        const payload = { ...tableFormData, authorAnimator: tableFormData.authorAnimator || '' };
        if (editingTable) {
            await updateGameTable({ ...payload, id: editingTable.id });
            toast({ title: "Table mise à jour", description: "Détails de la table de jeu enregistrés." });
        } else {
            await addGameTable(payload);
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
            <form onSubmit={handleSubmit}>
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
                            {allGames.length === 0 && <SelectItem value="" disabled>Aucun jeu. Ajoutez des jeux d'abord.</SelectItem>}
                            {allGames.map(game => (
                                <SelectItem key={game.id} value={game.id}>{game.nom} ({game.nbre_min}-{game.nbre_max} joueurs)</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="authorAnimator" className="text-right">Auteur/Animateur</Label>
                    <Select
                        name="authorAnimator"
                        value={tableFormData.authorAnimator || ''}
                        onValueChange={handleTableSelectChange('authorAnimator')}
                        disabled={isSubmittingTable || invitationParticipants.length === 0}
                    >
                        <SelectTrigger className="col-span-3 rounded-md shadow-sm">
                            <SelectValue placeholder={invitationParticipants.length === 0 ? "Aucun invité disponible" : "Sélectionner un Auteur/Animateur"} />
                        </SelectTrigger>
                        <SelectContent>
                            {invitationParticipants.length === 0 && (
                                <SelectItem value="" disabled>Aucun participant avec billet 'Invitation' trouvé.</SelectItem>
                            )}
                            <SelectItem value="">Aucun / Effacer la sélection</SelectItem>
                            {invitationParticipants.map(p => (
                                <SelectItem key={p.id} value={`${p.prenom} ${p.nom}`}>
                                    {p.prenom} {p.nom}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
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
                             <SelectValue placeholder="Sélectionner le créneau" />
                         </SelectTrigger>
                         <SelectContent>
                             <SelectItem value="09:00 - 13:00">Matin (09:00 - 13:00)</SelectItem>
                             <SelectItem value="14:00 - 19:00">Après-midi (14:00 - 19:00)</SelectItem>
                         </SelectContent>
                     </Select>
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="totalSeats" className="text-right">Places totales</Label>
                    <Input id="totalSeats" name="totalSeats" type="number" value={tableFormData.totalSeats} onChange={handleTableNonSelectInputChange} className="col-span-3 rounded-md shadow-sm" min="1" required disabled={isSubmittingTable} />
                 </div>
              </div>
              <DialogFooter>
                 <DialogClose asChild>
                    <Button type="button" variant="outline" disabled={isSubmittingTable} className="shadow-sm rounded-md">Annuler</Button>
                 </DialogClose>
                <Button type="submit" disabled={isSubmittingTable || allGames.length === 0} className="shadow-sm rounded-md">
                    {isSubmittingTable && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingTable ? 'Enregistrer' : 'Ajouter la table'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={isConfirmDeleteDialogOpen} onOpenChange={(open) => {
            if (isDeletingTable) return; // Don't close if deletion is in progress
            setIsConfirmDeleteDialogOpen(open);
            if (!open) setTableToDelete(null);
        }}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                    <AlertDialogDescription>
                        Êtes-vous sûr de vouloir supprimer la table "{tableToDelete?.gameName}" (N° {tableToDelete?.tableNumber}) du {tableToDelete?.day} à {tableToDelete?.timeSlot} ?
                        <br/><strong>Cette action est irréversible. La suppression ne sera effectuée que si aucune inscription n'est associée à cette table.</strong>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => { setIsConfirmDeleteDialogOpen(false); setTableToDelete(null); }} disabled={!!isDeletingTable}>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDeleteTable} disabled={!!isDeletingTable} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground hover:bg-black">
                        {isDeletingTable === tableToDelete?.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Supprimer
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>


        {tables.length > 0 ? (
            <Table>
            <TableCaption>Liste des tables de jeu configurées.</TableCaption>
            <TableHeader>
                <TableRow>
                <TableHead className="w-24 text-center">Table n°</TableHead>
                <TableHead className="w-64 px-2 py-1">Visuel</TableHead>
                <TableHead>Jeu</TableHead>
                <TableHead>Auteur/Animateur</TableHead>
                <TableHead>Jour</TableHead>
                <TableHead>Créneau horaire</TableHead>
                <TableHead className="text-center">Places</TableHead>
                <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                 {tables.sort((a, b) => {
                    const tableNumA_raw = a.tableNumber || '';
                    const tableNumB_raw = b.tableNumber || '';

                    const numA_parsed = parseFloat(tableNumA_raw);
                    const numB_parsed = parseFloat(tableNumB_raw);

                    const isPurelyNumericA = !isNaN(numA_parsed) && isFinite(numA_parsed) && tableNumA_raw === numA_parsed.toString();
                    const isPurelyNumericB = !isNaN(numB_parsed) && isFinite(numB_parsed) && tableNumB_raw === numB_parsed.toString();

                    if (isPurelyNumericA && isPurelyNumericB) {
                        if (numA_parsed < numB_parsed) return -1;
                        if (numA_parsed > numB_parsed) return 1;
                    } else {
                        const strA = tableNumA_raw.toLowerCase();
                        const strB = tableNumB_raw.toLowerCase();
                        if (strA < strB) return -1;
                        if (strA > strB) return 1;
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
                        <TableCell className="font-bold text-center w-24">{table.tableNumber || 'N/A'}</TableCell>
                        <TableCell className="w-64 px-2 py-1">
                            {imageUrl ? (
                                <Image
                                    src={imageUrl}
                                    alt={`Visuel ${table.gameName || 'Jeu inconnu'}`}
                                    width={256} 
                                    height={144} 
                                    className="rounded object-contain h-20 w-auto shadow-sm" 
                                    data-ai-hint="game cover"
                                />
                            ) : (
                                <div className="h-20 w-full bg-muted rounded flex items-center justify-center text-xs text-muted-foreground shadow-sm">?</div>
                            )}
                        </TableCell>
                        <TableCell><strong className="font-bold">{table.gameName || 'Jeu inconnu'}</strong></TableCell>
                        <TableCell>{table.authorAnimator ? <span className="font-bold flex items-center"><UserSquare2 className="inline h-4 w-4 mr-1 text-muted-foreground" />{table.authorAnimator}</span> : <span className="text-muted-foreground italic">N/A</span>}</TableCell>
                        <TableCell>{table.day}</TableCell>
                        <TableCell>{table.timeSlot}</TableCell>
                        <TableCell className="text-center">
                           <div className="flex justify-center items-center space-x-1" title={`${table.totalSeats - occupiedSeats} / ${table.totalSeats} places disponibles`}>
                                {Array.from({ length: table.totalSeats }).map((_, i) => (
                                    <UserCircle2
                                        key={i}
                                        className={`h-5 w-5 ${i < occupiedSeats ? 'text-red-600' : 'text-emerald-600'}`}
                                        aria-label={i < occupiedSeats ? 'Place occupée' : 'Place disponible'}
                                    />
                                ))}
                            </div>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                        <Button variant="outline" size="icon" onClick={() => handleDuplicateTable(table)} disabled={isSubmittingTable || !!isDeletingTable} className="shadow-sm rounded-md" title="Dupliquer la table">
                            <Copy className="h-4 w-4" />
                            <span className="sr-only">Dupliquer</span>
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => handleEditTable(table)} disabled={isSubmittingTable || !!isDeletingTable} className="shadow-sm rounded-md" title="Modifier la table">
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
                                title={`Supprimer table ${table.gameName} (N° ${table.tableNumber})`}
                                onClick={(e) => {
                                    // No need to preventDefault or stopPropagation here
                                    // The AlertDialogTrigger will open the dialog.
                                    // We set tableToDelete here so the dialog has the correct context.
                                    setTableToDelete(table); 
                                }}
                                >
                                {isDeletingTable === table.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                <span className="sr-only">Supprimer</span>
                                </Button>
                            </AlertDialogTrigger>
                            {/* This AlertDialogContent is now correctly handled by isConfirmDeleteDialogOpen state */}
                        </AlertDialog>
                        </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
            </Table>
        ) : (
             <p className="text-muted-foreground text-center py-4">Aucune table configurée. Cliquez sur <strong>Ajouter une table</strong>.</p>
        )}
      </>
    );
  }

  return (
    <Card className="shadow-lg rounded-lg">
      <CardHeader>
          <CardTitle>Gestion des tables et des jeux</CardTitle>
          <CardDescription>Ajouter, modifier ou supprimer des jeux ou des tables de jeu.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 shadow-sm rounded-md">
            <TabsTrigger value="games" className="flex items-center gap-2"><Gamepad2 className="h-4 w-4" />Gestion des jeux</TabsTrigger>
            <TabsTrigger value="tables" className="flex items-center gap-2"><TableIcon className="h-4 w-4" />Gestion des tables</TabsTrigger>
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
