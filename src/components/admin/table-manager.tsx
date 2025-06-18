
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
} from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from '@/hooks/use-toast';
import {
  getGameTables,
  addGameTable,
  updateGameTable,
  deleteGameTable,
  getRegistrations,
  getGames,
  getParticipants,
  addRegistration as addRegistrationToDb,
  removeRegistration as removeRegistrationFromDb,
  saveGameResult,
  getAllGameResults,
} from '@/lib/data';
import type { GameTable, GameTableInput, Registration, Game, Participant, GameResult } from '@/lib/types';
import { Pencil, Trash2, Loader2, AlertTriangle, Gamepad2, TableIcon, UserSquare2, UserCircle2, Copy, UserCheck, Info, PlusCircle, UserX, Users, Timer, Square, Trophy, CalendarDays } from 'lucide-react';
import GameManager from './game-manager';

const conventionDayOrder = ['Jeudi', 'Vendredi', 'Samedi', 'Dimanche'] as const;
type ConventionDayAdmin = typeof conventionDayOrder[number];
const timeSlotOrder = ["09:00 - 13:00", "14:00 - 19:00", "Off"];

const defaultTableFormData: GameTableInput = {
  gameId: '',
  day: 'Jeudi',
  timeSlot: '09:00 - 13:00',
  totalSeats: 4,
  tableNumber: '',
  authorAnimator: undefined,
};

const sortParticipantsByName = (participants: Participant[]): Participant[] => {
  return [...participants].sort((a, b) => {
    const nameA = `${a.nom} ${a.prenom}`.toLowerCase();
    const nameB = `${b.nom} ${b.prenom}`.toLowerCase();
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;
    return 0;
  });
};

export default function ConventionManager() {
  const [activeMainTab, setActiveMainTab] = useState("games");
  const [activeDayTab, setActiveDayTab] = useState<ConventionDayAdmin>(conventionDayOrder[0]);

  const [tables, setTables] = useState<GameTable[]>([]);
  const [allGames, setAllGames] = useState<Game[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [allParticipantsData, setAllParticipantsData] = useState<Participant[]>([]);
  const [invitationParticipants, setInvitationParticipants] = useState<Participant[]>([]);
  const [gameResultsData, setGameResultsData] = useState<Map<string, GameResult>>(new Map());

  const [isLoadingTables, setIsLoadingTables] = useState(true);
  const [isSubmittingTable, setIsSubmittingTable] = useState(false);
  const [isDeletingTable, setIsDeletingTable] = useState<string | null>(null);

  const [isTableDialogOpen, setIsTableDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<GameTable | null>(null);
  const [currentTableRegistrants, setCurrentTableRegistrants] = useState<Participant[]>([]);
  const [selectableParticipantsForDialog, setSelectableParticipantsForDialog] = useState<Participant[]>([]);
  const [selectedParticipantToAdd, setSelectedParticipantToAdd] = useState<string>('');
  const [isManagingParticipant, setIsManagingParticipant] = useState(false);

  const [tableFormData, setTableFormData] = useState<GameTableInput>(defaultTableFormData);

  const [tableToDelete, setTableToDelete] = useState<GameTable | null>(null);
  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);

  const { toast } = useToast();

  const [inProgressTables, setInProgressTables] = useState<Map<string, boolean>>(new Map());
  const [isWinnerSelectDialogOpen, setIsWinnerSelectDialogOpen] = useState(false);
  const [currentTableForWinnerSelection, setCurrentTableForWinnerSelection] = useState<GameTable | null>(null);
  const [participantsForWinnerDialog, setParticipantsForWinnerDialog] = useState<Participant[]>([]);
  const [selectedWinnerIdsInDialog, setSelectedWinnerIdsInDialog] = useState<string[]>([]);


  const fetchPageData = useCallback(async (setPageLoadingState = true) => {
    if (setPageLoadingState) setIsLoadingTables(true);
    try {
      const [
        fetchedTables,
        fetchedRegistrationsResult,
        fetchedGamesList,
        fetchedParticipants,
        fetchedGameResults
      ] = await Promise.all([
        getGameTables(),
        getRegistrations(),
        getGames(),
        getParticipants(),
        getAllGameResults()
      ]);
      setTables(fetchedTables);
      setRegistrations(fetchedRegistrationsResult);
      setAllGames(fetchedGamesList);
      setAllParticipantsData(fetchedParticipants);
      setInvitationParticipants(fetchedParticipants.filter(p => p.typeBillet === 'Invitation'));
      
      const resultsMap = new Map<string, GameResult>();
      fetchedGameResults.forEach(result => resultsMap.set(result.tableId, result));
      setGameResultsData(resultsMap);

    } catch (error) {
      console.error("Erreur lors de la récupération des données:", error);
      const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
      toast({ variant: "destructive", title: "Erreur de chargement des données", description: errorMessage });
    } finally {
      if (setPageLoadingState) setIsLoadingTables(false);
    }
  }, [toast]);

  useEffect(() => {
    if (activeMainTab === "tables") {
      fetchPageData(true);
    }
  }, [fetchPageData, activeMainTab]);

  const fetchRegistrantsForDialog = useCallback(async (tableId: string) => {
    if (!tableId) return;
    try {
      const regsForTable = registrations.filter(r => r.tableId === tableId);
      const registrantIds = regsForTable.map(r => r.userId);
      const registrants = allParticipantsData.filter(p => registrantIds.includes(p.id));
      setCurrentTableRegistrants(registrants);

      const availableForSelection = allParticipantsData.filter(p =>
        !registrantIds.includes(p.id) 
      );
      setSelectableParticipantsForDialog(sortParticipantsByName(availableForSelection));

    } catch (error) {
        console.error("Erreur récupération inscrits pour dialogue:", error);
        toast({ variant: "destructive", title: "Erreur participants", description: "Impossible de charger les inscrits pour cette table."});
    }
  }, [registrations, allParticipantsData, toast]);


  useEffect(() => {
    if (editingTable && isTableDialogOpen) {
      fetchRegistrantsForDialog(editingTable.id);
    }
  }, [editingTable, isTableDialogOpen, fetchRegistrantsForDialog]);


  const handleTableSelectChange = (name: keyof Pick<GameTableInput, 'day' | 'timeSlot' | 'gameId' | 'authorAnimator'>) => (value: string) => {
    setTableFormData(prev => {
        let processedValue: string | undefined = value === '' ? undefined : value;
        if (name === 'authorAnimator' && value === '_NONE_') processedValue = undefined;

        const newState = { ...prev, [name]: processedValue };
        if (name === 'gameId' && newState.gameId) {
            const selectedGame = allGames.find(game => game.id === newState.gameId);
            if (selectedGame) newState.totalSeats = selectedGame.nbre_max;
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
        authorAnimator: table.authorAnimator || undefined,
    });
    fetchRegistrantsForDialog(table.id);
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
      authorAnimator: table.authorAnimator || undefined,
    });
    setCurrentTableRegistrants([]);
    setSelectableParticipantsForDialog(sortParticipantsByName(allParticipantsData));
    setIsTableDialogOpen(true);
    toast({
      title: "Table dupliquée",
      description: `Les informations de la table "${table.gameName}" (N° ${table.tableNumber}) ont été copiées. Modifiez le numéro de table et/ou le créneau horaire, puis enregistrez.`,
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
        await deleteGameTable(tableToDelete.id);
        toast({ title: "Table supprimée", description: `La table "${tableToDelete.gameName}" (N° ${tableToDelete.tableNumber}) et ses résultats ont été supprimés.` });
        fetchPageData(false); 
    } catch (err) {
         const errorMessage = err instanceof Error ? err.message : "Une erreur inconnue est survenue.";
         if (err instanceof Error && err.message.includes("joueur(s) inscrit(s)")) {
             toast({
                variant: "destructive",
                title: "Suppression impossible",
                description: errorMessage,
                action: <AlertTriangle className="text-destructive-foreground h-5 w-5" />,
                duration: 7000,
            });
         } else {
            toast({ variant: "destructive", title: "Erreur lors de la suppression", description: errorMessage });
         }
    } finally {
        setIsDeletingTable(null);
        setTableToDelete(null);
        setIsConfirmDeleteDialogOpen(false);
    }
  };

  const handleOpenTableDialogForAdd = () => {
    setEditingTable(null);
    setTableFormData({...defaultTableFormData, day: activeDayTab, tableNumber: ''}); 
    setCurrentTableRegistrants([]);
    setSelectableParticipantsForDialog(sortParticipantsByName(allParticipantsData)); 
    setIsTableDialogOpen(true);
  };

   const handleTableDetailsSubmit = async (e: React.FormEvent) => {
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
            const newTable = await addGameTable(payload);
            setEditingTable(newTable); 
            toast({ title: "Table ajoutée", description: "Nouvelle table de jeu créée. Vous pouvez maintenant gérer les participants." });
        }
        await fetchPageData(false); 

        if (!editingTable && !(payload as any).id) { 
             setIsTableDialogOpen(false); 
             setEditingTable(null);
             setTableFormData({...defaultTableFormData, day: activeDayTab}); 
        } else if (editingTable) { 
             fetchRegistrantsForDialog(editingTable.id); 
        }


    } catch(error) {
         const errorMessage = error instanceof Error ? error.message : "Opération inconnue échouée.";
         toast({ variant: "destructive", title: "Opération Table échouée", description: errorMessage });
    } finally {
        setIsSubmittingTable(false);
    }
  };

  const handleAddParticipantToTable = async () => {
    if (!editingTable || !selectedParticipantToAdd) {
        toast({variant: "destructive", title: "Sélection manquante", description: "Veuillez sélectionner un participant à ajouter."});
        return;
    }
    if (currentTableRegistrants.length >= tableFormData.totalSeats) {
        toast({variant: "destructive", title: "Table complète", description: "Cette table a atteint son nombre maximum de participants."});
        return;
    }
    setIsManagingParticipant(true);
    try {
        await addRegistrationToDb(selectedParticipantToAdd, editingTable.id);
        toast({title: "Participant ajouté", description: "Le participant a été inscrit à la table."});
        setSelectedParticipantToAdd('');
        await fetchPageData(false); 
        fetchRegistrantsForDialog(editingTable.id); 
    } catch (error) {
        toast({variant: "destructive", title: "Erreur d'ajout", description: (error as Error).message});
    } finally {
        setIsManagingParticipant(false);
    }
  };

  const handleRemoveParticipantFromTable = async (participantId: string) => {
    if (!editingTable) return;
    setIsManagingParticipant(true);
    try {
        await removeRegistrationFromDb(participantId, editingTable.id);
        toast({title: "Participant désinscrit", description: "Le participant a été retiré de la table."});
        await fetchPageData(false); 
        fetchRegistrantsForDialog(editingTable.id); 
    } catch (error) {
        toast({variant: "destructive", title: "Erreur de désinscription", description: (error as Error).message});
    } finally {
        setIsManagingParticipant(false);
    }
  };

  const toggleGameInProgress = (tableId: string) => {
    setInProgressTables(prev => {
      const newMap = new Map(prev);
      const currentStatus = !!newMap.get(tableId);
      newMap.set(tableId, !currentStatus);
      return newMap;
    });
  };

  const handleOpenWinnerDialog = (table: GameTable) => {
    setCurrentTableForWinnerSelection(table);
    const regsForTable = registrations.filter(r => r.tableId === table.id);
    const registrantIds = regsForTable.map(r => r.userId);
    const registrantsDetails = allParticipantsData.filter(p => registrantIds.includes(p.id));
    setParticipantsForWinnerDialog(registrantsDetails);

    const existingResult = gameResultsData.get(table.id);
    setSelectedWinnerIdsInDialog(existingResult?.winnerIds || []);
    setIsWinnerSelectDialogOpen(true);
  };

  const handleWinnerSelectionInDialog = (participantId: string) => {
    setSelectedWinnerIdsInDialog(prev => {
      if (prev.includes(participantId)) {
        return prev.filter(id => id !== participantId);
      } else {
        return [...prev, participantId];
      }
    });
  };

  const handleConfirmWinners = async () => {
    if (currentTableForWinnerSelection && currentTableForWinnerSelection.id) {
      const tableId = currentTableForWinnerSelection.id;
      const playersInGame = participantsForWinnerDialog.length; 
      try {
        await saveGameResult(tableId, selectedWinnerIdsInDialog, playersInGame);
        toast({ title: "Vainqueur(s) enregistré(s)", description: `Les vainqueurs pour la table ${currentTableForWinnerSelection.tableNumber} ont été sauvegardés.`});
        setGameResultsData(prev => {
            const newMap = new Map(prev);
            newMap.set(tableId, { tableId, winnerIds: selectedWinnerIdsInDialog, playersInGame, timestamp: new Date() });
            return newMap;
        });
      } catch (error) {
        toast({ variant: "destructive", title: "Erreur sauvegarde vainqueurs", description: (error as Error).message });
      }
    }
    setIsWinnerSelectDialogOpen(false);
    setCurrentTableForWinnerSelection(null);
    setSelectedWinnerIdsInDialog([]);
  };

  const renderSingleDayTable = (day: ConventionDayAdmin) => {
    const dayTables = tables
        .filter(table => table.day === day)
        .sort((a, b) => {
            const tableNumA_raw = a.tableNumber || '';
            const tableNumB_raw = b.tableNumber || '';
            const numA_parsed = parseFloat(tableNumA_raw.replace(',', '.'));
            const numB_parsed = parseFloat(tableNumB_raw.replace(',', '.'));

            const isPurelyNumericA = !isNaN(numA_parsed) && isFinite(numA_parsed) && tableNumA_raw.match(/^[\d,.]+$/);
            const isPurelyNumericB = !isNaN(numB_parsed) && isFinite(numB_parsed) && tableNumB_raw.match(/^[\d,.]+$/);

            if (isPurelyNumericA && isPurelyNumericB) {
                if (numA_parsed < numB_parsed) return -1;
                if (numA_parsed > numB_parsed) return 1;
            } else if (isPurelyNumericA) { 
                return -1;
            } else if (isPurelyNumericB) {
                return 1;
            } else { 
                const strA = tableNumA_raw.toLowerCase();
                const strB = tableNumB_raw.toLowerCase();
                if (strA < strB) return -1;
                if (strA > strB) return 1;
            }
            
            const timeSlotAIndex = timeSlotOrder.indexOf(a.timeSlot);
            const timeSlotBIndex = timeSlotOrder.indexOf(b.timeSlot);
            if (timeSlotAIndex < timeSlotBIndex) return -1;
            if (timeSlotAIndex > timeSlotBIndex) return 1;
            return 0;
        });

    if (isLoadingTables && dayTables.length === 0) { 
         return (
            <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-4 text-muted-foreground">Chargement des tables pour {day}...</p>
            </div>
        );
    }
    
    if (!isLoadingTables && dayTables.length === 0) {
        return <p className="text-muted-foreground text-center py-4">Aucune table configurée pour {day}.</p>;
    }

    return (
        <TooltipProvider>
        <Table>
            <TableCaption>Liste des tables de jeu pour {day}. ({dayTables.length} table(s))</TableCaption>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-20 text-center">Table n°</TableHead>
                    <TableHead className="w-48 px-1 py-1">Visuel</TableHead>
                    <TableHead>Jeu</TableHead>
                    <TableHead>Auteur/Animateur</TableHead>
                    <TableHead>Créneau horaire</TableHead>
                    <TableHead className="text-left">Sièges</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {dayTables.map((table) => {
                    const registrationsForThisTable = registrations.filter(r => r.tableId === table.id);
                    const registeredParticipantDetails = registrationsForThisTable.map(reg => {
                        return allParticipantsData.find(p => p.id === reg.userId);
                    }).filter(p => p !== undefined) as Participant[];

                    const occupiedSeatsCount = registeredParticipantDetails.length;
                    const freeSeatsCount = table.totalSeats - occupiedSeatsCount;
                    const imageUrl = table.gameImageUrl || table.imageUrl;
                    const isFull = table.totalSeats > 0 && occupiedSeatsCount >= table.totalSeats;
                    const isGameInProgress = inProgressTables.get(table.id) || false;
                    const gameResult = gameResultsData.get(table.id);
                    const isGameEffectivelyFinished = !!gameResult;


                    return (
                        <TableRow key={table.id} className={isFull && !isGameInProgress && !isGameEffectivelyFinished ? "bg-primary/20" : isGameInProgress ? "bg-green-100 dark:bg-green-900/30" : isGameEffectivelyFinished ? "bg-blue-100 dark:bg-blue-900/30" : ""}>
                            <TableCell className="font-bold text-center w-20">{table.tableNumber || 'N/A'}</TableCell>
                            <TableCell className="w-48 px-1 py-1">
                                {imageUrl ? (
                                    <Image
                                        src={imageUrl}
                                        alt={`Visuel ${table.gameName || 'Jeu inconnu'}`}
                                        width={192}
                                        height={108}
                                        className="rounded object-contain h-20 w-auto shadow-sm"
                                        data-ai-hint="game cover"
                                    />
                                ) : (
                                    <div className="h-20 w-full bg-muted rounded flex items-center justify-center text-xs text-muted-foreground shadow-sm">?</div>
                                )}
                            </TableCell>
                            <TableCell><strong className="font-bold">{table.gameName || 'Jeu inconnu'}</strong></TableCell>
                            <TableCell>{table.authorAnimator ? <span className="font-medium flex items-center"><UserSquare2 className="inline h-4 w-4 mr-1 text-muted-foreground" />{table.authorAnimator}</span> : <span className="text-muted-foreground italic">N/A</span>}</TableCell>
                            <TableCell>{table.timeSlot === 'Off' ? table.timeSlot : table.timeSlot.replace(' - ', ' à ')}</TableCell>
                            <TableCell className="text-left align-top min-w-[200px]">
                                <ul className="list-none p-0 m-0 text-xs space-y-0.5">
                                    {registeredParticipantDetails.map(participant => (
                                        <li key={participant.id} className="flex items-center">
                                            <UserCheck className="h-3.5 w-3.5 mr-1.5 text-green-600 flex-shrink-0" />
                                            <span className="truncate" title={`${participant.prenom} ${participant.nom}`}>{participant.prenom} {participant.nom.substring(0,1)}.</span>
                                        </li>
                                    ))}
                                    {Array.from({ length: freeSeatsCount }).map((_, i) => (
                                        <li key={`free-admin-${table.id}-${i}`} className="flex items-center">
                                            <UserCircle2 className="h-3.5 w-3.5 mr-1.5 text-gray-400 flex-shrink-0" />
                                            <span className="italic text-muted-foreground">Place libre</span>
                                        </li>
                                    ))}
                                    {table.totalSeats === 0 && freeSeatsCount === 0 && registeredParticipantDetails.length === 0 && (
                                        <li className="flex items-center">
                                            <Info className="h-3.5 w-3.5 mr-1.5 text-blue-500 flex-shrink-0" />
                                            <span className="italic text-muted-foreground">0 place définie</span>
                                        </li>
                                    )}
                                </ul>
                                {gameResult && gameResult.winnerIds.length > 0 && (
                                    <div className="mt-1 text-xs">
                                        <span className="font-semibold text-amber-600">Vainqueur(s):</span>
                                        <ul className="list-disc list-inside">
                                            {gameResult.winnerIds.map(winnerId => {
                                                const winner = allParticipantsData.find(p => p.id === winnerId);
                                                return <li key={winnerId} className="text-amber-700">{winner ? `${winner.prenom} ${winner.nom}` : 'Inconnu'}</li>;
                                            })}
                                        </ul>
                                    </div>
                                )}
                                {table.totalSeats > 0 && (
                                    <p className={`text-xs mt-1 ${isFull && !isGameEffectivelyFinished ? 'font-bold text-destructive' : 'text-muted-foreground'}`}>
                                        ({occupiedSeatsCount} / {table.totalSeats} occupées) {isFull && !isGameEffectivelyFinished ? " - COMPLET" : ""}
                                    </p>
                                )}
                            </TableCell>
                            <TableCell className="text-right space-x-1">
                                {isGameInProgress ? ( // Game is actively in progress
                                    <>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="outline" size="icon" onClick={() => handleOpenWinnerDialog(table)} disabled={occupiedSeatsCount === 0} className="shadow-sm rounded-md h-8 w-8 border-amber-500 text-amber-600 hover:bg-amber-100"><Trophy className="h-4 w-4" /></Button>
                                            </TooltipTrigger>
                                            <TooltipContent><p>Désigner Vainqueur(s)</p></TooltipContent>
                                        </Tooltip>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="destructive" size="icon" onClick={() => toggleGameInProgress(table.id)} className="shadow-sm rounded-md h-8 w-8 bg-red-600 hover:bg-red-700 text-white"><Square className="h-4 w-4" /></Button>
                                            </TooltipTrigger>
                                            <TooltipContent><p>Terminer la partie</p></TooltipContent>
                                        </Tooltip>
                                    </>
                                ) : isGameEffectivelyFinished ? ( // Game has a result (finished), not actively in progress
                                    <>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="outline" size="icon" onClick={() => handleOpenWinnerDialog(table)} disabled={occupiedSeatsCount === 0} className="shadow-sm rounded-md h-8 w-8 border-amber-500 text-amber-600 hover:bg-amber-100"><Trophy className="h-4 w-4" /></Button>
                                            </TooltipTrigger>
                                            <TooltipContent><p>Modifier Vainqueur(s)</p></TooltipContent>
                                        </Tooltip>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="outline" size="icon" onClick={() => handleDuplicateTable(table)} disabled={isSubmittingTable || !!isDeletingTable} className="shadow-sm rounded-md h-8 w-8"><Copy className="h-4 w-4" /></Button>
                                            </TooltipTrigger>
                                            <TooltipContent><p>Dupliquer la table</p></TooltipContent>
                                        </Tooltip>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="outline" size="icon" onClick={() => handleEditTable(table)} disabled={isSubmittingTable || !!isDeletingTable} className="shadow-sm rounded-md h-8 w-8"><Pencil className="h-4 w-4" /></Button>
                                            </TooltipTrigger>
                                            <TooltipContent><p>Modifier les détails de la table (participants verrouillés)</p></TooltipContent>
                                        </Tooltip>
                                    </>
                                ) : ( // Game not started, no results yet
                                    <>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="default" size="icon" onClick={() => toggleGameInProgress(table.id)} disabled={occupiedSeatsCount === 0 || isSubmittingTable || !!isDeletingTable} className="shadow-sm rounded-md h-8 w-8 bg-green-600 hover:bg-green-700 text-white"><Timer className="h-4 w-4" /></Button>
                                            </TooltipTrigger>
                                            <TooltipContent><p>Démarrer la partie</p></TooltipContent>
                                        </Tooltip>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="outline" size="icon" onClick={() => handleDuplicateTable(table)} disabled={isSubmittingTable || !!isDeletingTable} className="shadow-sm rounded-md h-8 w-8"><Copy className="h-4 w-4" /></Button>
                                            </TooltipTrigger>
                                            <TooltipContent><p>Dupliquer la table</p></TooltipContent>
                                        </Tooltip>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="outline" size="icon" onClick={() => handleEditTable(table)} disabled={isSubmittingTable || !!isDeletingTable} className="shadow-sm rounded-md h-8 w-8"><Pencil className="h-4 w-4" /></Button>
                                            </TooltipTrigger>
                                            <TooltipContent><p>Modifier la table et les participants</p></TooltipContent>
                                        </Tooltip>
                                    </>
                                )}
                                 <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="destructive" size="icon"
                                            disabled={isSubmittingTable || (isDeletingTable !== null && isDeletingTable !== table.id) || isDeletingTable === table.id || isGameInProgress}
                                            className="shadow-sm rounded-md h-8 w-8 hover:bg-red-700"
                                            onClick={() => openDeleteConfirmationDialog(table)}
                                        >
                                            {isDeletingTable === table.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>{isGameInProgress ? "Terminez la partie avant de supprimer" : `Supprimer table ${table.gameName} (N° ${table.tableNumber})`}</p></TooltipContent>
                                </Tooltip>
                            </TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
        </TooltipProvider>
    );
  };


  const renderTableManagerContent = () => {
    if (isLoadingTables && tables.length === 0 && activeMainTab === "tables") {
      return (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-4 text-muted-foreground">Chargement initial des données des tables...</p>
        </div>
      );
    }
    const isGameFinishedForDialog = editingTable && gameResultsData.has(editingTable.id);

    return (
      <>
        <div className="flex justify-end mb-4">
            <Button onClick={handleOpenTableDialogForAdd} disabled={isSubmittingTable || !!isDeletingTable} className="shadow-sm rounded-md">
              <TableIcon className="mr-2 h-4 w-4" /> Ajouter une table ({activeDayTab})
            </Button>
        </div>

        <Tabs value={activeDayTab} onValueChange={(value) => setActiveDayTab(value as ConventionDayAdmin)} className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
                {conventionDayOrder.map(day => (
                    <TabsTrigger key={day} value={day} className="flex items-center gap-1.5">
                        <CalendarDays className="h-4 w-4" /> {day}
                    </TabsTrigger>
                ))}
            </TabsList>
            {conventionDayOrder.map(day => (
                <TabsContent key={`content-${day}`} value={day} className="mt-4">
                    {renderSingleDayTable(day)}
                </TabsContent>
            ))}
        </Tabs>

        <Dialog open={isTableDialogOpen} onOpenChange={(open) => {
          setIsTableDialogOpen(open);
          if (!open) {
            setEditingTable(null);
            setTableFormData({ ...defaultTableFormData, day: activeDayTab }); 
            setCurrentTableRegistrants([]);
            setSelectedParticipantToAdd('');
          }
        }}>
          <DialogContent className="sm:max-w-2xl rounded-lg shadow-xl">
            <DialogHeader>
              <DialogTitle>{editingTable ? 'Modifier la table de jeu' : 'Ajouter une nouvelle table de jeu'}</DialogTitle>
              <DialogDescription>
                {editingTable ? `Gestion des détails et des participants pour la table N° ${editingTable.tableNumber} - ${editingTable.gameName}.` : 'Entrez les détails de la nouvelle table de jeu.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleTableDetailsSubmit} className="space-y-4 max-h-[calc(80vh-150px)] overflow-y-auto pr-2">
              <fieldset className="grid grid-cols-1 gap-4 py-4 border p-4 rounded-md">
                <legend className="text-sm font-medium px-1">Détails de la table</legend>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="tableNumber" className="text-right">Numéro</Label>
                    <Input id="tableNumber" name="tableNumber" value={tableFormData.tableNumber} onChange={handleTableNonSelectInputChange} className="col-span-3 rounded-md shadow-sm" required disabled={isSubmittingTable} placeholder="Ex: 101, A5"/>
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="gameId" className="text-right">Jeu</Label>
                     <Select name="gameId" value={tableFormData.gameId} onValueChange={handleTableSelectChange('gameId')} required disabled={isSubmittingTable || allGames.length === 0}>
                        <SelectTrigger className="col-span-3 rounded-md shadow-sm"><SelectValue placeholder="Sélectionner un jeu" /></SelectTrigger>
                        <SelectContent>
                            {allGames.length === 0 && <SelectItem value="_NO_GAMES_" disabled>Aucun jeu disponible</SelectItem>}
                            {allGames.map(game => (<SelectItem key={game.id} value={game.id}>{game.nom} ({game.nbre_min}-{game.nbre_max}j)</SelectItem>))}
                        </SelectContent>
                    </Select>
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="authorAnimator" className="text-right">Auteur/Animateur</Label>
                    <Select name="authorAnimator" value={tableFormData.authorAnimator || '_NONE_'} onValueChange={handleTableSelectChange('authorAnimator')} disabled={isSubmittingTable || invitationParticipants.length === 0}>
                        <SelectTrigger className="col-span-3 rounded-md shadow-sm"><SelectValue placeholder="Sélectionner un invité" /></SelectTrigger>
                        <SelectContent>
                            {invitationParticipants.length === 0 && <SelectItem value="_NO_INVITES_" disabled>Aucun invité</SelectItem>}
                            <SelectItem value="_NONE_">Aucun / Effacer</SelectItem>
                            {invitationParticipants.map(p => (<SelectItem key={p.id} value={`${p.prenom} ${p.nom}`}>{p.prenom} {p.nom}</SelectItem>))}
                        </SelectContent>
                    </Select>
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="day" className="text-right">Jour</Label>
                     <Select name="day" value={tableFormData.day} onValueChange={handleTableSelectChange('day')} required disabled={isSubmittingTable}>
                        <SelectTrigger className="col-span-3 rounded-md shadow-sm"><SelectValue placeholder="Jour" /></SelectTrigger>
                        <SelectContent>{conventionDayOrder.map(d => (<SelectItem key={d} value={d}>{d}</SelectItem>))}</SelectContent>
                    </Select>
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="timeSlot" className="text-right">Créneau</Label>
                     <Select name="timeSlot" value={tableFormData.timeSlot} onValueChange={handleTableSelectChange('timeSlot')} required disabled={isSubmittingTable}>
                         <SelectTrigger className="col-span-3 rounded-md shadow-sm"><SelectValue placeholder="Créneau" /></SelectTrigger>
                         <SelectContent>{timeSlotOrder.map(ts => (<SelectItem key={ts} value={ts}>{ts === 'Off' ? ts : ts.replace(' - ', ' à ')}</SelectItem>))}</SelectContent>
                     </Select>
                 </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="totalSeats" className="text-right">Places</Label>
                    <Input id="totalSeats" name="totalSeats" type="number" value={tableFormData.totalSeats} onChange={handleTableNonSelectInputChange} className="col-span-3 rounded-md shadow-sm" min="1" required disabled={isSubmittingTable} />
                 </div>
                 <DialogFooter className="pt-2">
                    <Button type="submit" disabled={isSubmittingTable || allGames.length === 0} className="shadow-sm rounded-md">
                        {isSubmittingTable && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {editingTable ? 'Enregistrer Détails Table' : 'Ajouter et Continuer'}
                    </Button>
                 </DialogFooter>
              </fieldset>
            </form>

            {editingTable && (
            <div className="space-y-4 mt-4 border p-4 rounded-md max-h-[calc(80vh-350px)] overflow-y-auto pr-2">
                <h3 className="text-md font-medium">Gestion des Participants ({currentTableRegistrants.length} / {tableFormData.totalSeats} inscrits)</h3>
                <Separator />

                 {isGameFinishedForDialog && (
                    <p className="text-sm text-amber-600 font-medium pt-2 border-b pb-2 mb-2">
                        <AlertTriangle className="inline h-4 w-4 mr-1" />
                        La gestion des participants est verrouillée car un résultat a été enregistré pour cette partie.
                        Vous pouvez modifier le(s) vainqueur(s) depuis la liste des tables.
                    </p>
                )}

                {currentTableRegistrants.length > 0 ? (
                    <div className="space-y-2">
                        <Label>Participants inscrits :</Label>
                        <ul className="space-y-1 text-sm">
                        {currentTableRegistrants.map(p => (
                            <li key={p.id} className="flex items-center justify-between p-1.5 bg-muted/50 rounded-md">
                                <span><UserCheck className="inline h-4 w-4 mr-1.5 text-green-600"/>{p.prenom} {p.nom} ({p.typeBillet})</span>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => handleRemoveParticipantFromTable(p.id)} 
                                    disabled={isManagingParticipant || !!isGameFinishedForDialog} 
                                    title={isGameFinishedForDialog ? "Impossible de retirer un participant d'une partie terminée" : "Désinscrire ce participant"}
                                >
                                    {isManagingParticipant ? <Loader2 className="h-4 w-4 animate-spin"/> : <UserX className="h-4 w-4 text-destructive"/>}
                                </Button>
                            </li>
                        ))}
                        </ul>
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">Aucun participant inscrit à cette table.</p>
                )}

                {currentTableRegistrants.length < tableFormData.totalSeats && (
                    <div className="space-y-2 pt-2">
                        <Label htmlFor="add-participant-select">Ajouter un participant :</Label>
                        <div className="flex items-center gap-2">
                            <Select
                                value={selectedParticipantToAdd}
                                onValueChange={setSelectedParticipantToAdd}
                                disabled={isManagingParticipant || selectableParticipantsForDialog.length === 0 || !!isGameFinishedForDialog}
                            >
                                <SelectTrigger id="add-participant-select" className="flex-grow rounded-md shadow-sm">
                                    <SelectValue placeholder={selectableParticipantsForDialog.length === 0 ? "Aucun participant à ajouter" : "Sélectionner un participant"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {selectableParticipantsForDialog.length === 0 && <SelectItem value="" disabled>Aucun participant disponible</SelectItem>}
                                    {selectableParticipantsForDialog.map(p => (
                                        <SelectItem key={p.id} value={p.id}>{p.nom} {p.prenom} ({p.typeBillet})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button
                                type="button"
                                onClick={handleAddParticipantToTable}
                                disabled={!selectedParticipantToAdd || isManagingParticipant || currentTableRegistrants.length >= tableFormData.totalSeats || !!isGameFinishedForDialog}
                                className="rounded-md shadow-sm"
                                size="sm"
                                title={isGameFinishedForDialog ? "Impossible d'ajouter un participant à une partie terminée" : "Inscrire le participant"}
                            >
                                {isManagingParticipant ? <Loader2 className="mr-2 h-3 w-3 animate-spin"/> : <PlusCircle className="mr-2 h-3 w-3"/>}
                                Inscrire
                            </Button>
                        </div>
                    </div>
                )}
                 {currentTableRegistrants.length >= tableFormData.totalSeats && !isGameFinishedForDialog && (
                    <p className="text-sm text-amber-600 font-medium pt-2">Cette table est complète.</p>
                )}
            </div>
            )}
             <DialogFooter className="pt-6">
                <DialogClose asChild>
                    <Button type="button" variant="outline" className="shadow-sm rounded-md">Fermer</Button>
                </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={isConfirmDeleteDialogOpen} onOpenChange={(open) => {
            if (isDeletingTable) return; 
            setIsConfirmDeleteDialogOpen(open);
            if (!open) setTableToDelete(null);
        }}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Êtes-vous absolument sûr(e) ?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Cette action est irréversible. La table "{tableToDelete?.gameName}" (N° {tableToDelete?.tableNumber}) du {tableToDelete?.day} à {tableToDelete?.timeSlot} et ses résultats de jeu associés seront définitivement supprimés.
                        <br/><strong>La suppression ne sera effectuée que si aucune inscription n'est associée à cette table.</strong>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => { setIsConfirmDeleteDialogOpen(false); setTableToDelete(null); }} disabled={!!isDeletingTable}>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDeleteTable} disabled={!!isDeletingTable} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                        {isDeletingTable === tableToDelete?.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Confirmer la suppression
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <Dialog open={isWinnerSelectDialogOpen} onOpenChange={(open) => {
            setIsWinnerSelectDialogOpen(open);
            if (!open) {
                setCurrentTableForWinnerSelection(null);
                setSelectedWinnerIdsInDialog([]); 
            }
        }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Désigner Vainqueur(s) pour Table {currentTableForWinnerSelection?.tableNumber}</DialogTitle>
                    <DialogDescription>
                        Sélectionnez le(s) vainqueur(s) parmi les participants inscrits.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-4 max-h-[60vh] overflow-y-auto">
                    {participantsForWinnerDialog.length > 0 ? (
                        participantsForWinnerDialog.map(participant => (
                            <div key={participant.id} className="flex items-center space-x-2">
                                <Checkbox
                                    id={`winner-${participant.id}`}
                                    checked={selectedWinnerIdsInDialog.includes(participant.id)}
                                    onCheckedChange={() => handleWinnerSelectionInDialog(participant.id)}
                                />
                                <Label htmlFor={`winner-${participant.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    {participant.prenom} {participant.nom}
                                </Label>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-muted-foreground">Aucun participant inscrit à cette table pour désigner un vainqueur.</p>
                    )}
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="outline">Annuler</Button></DialogClose>
                    <Button type="button" onClick={handleConfirmWinners} disabled={participantsForWinnerDialog.length === 0}>
                        <Trophy className="mr-2 h-4 w-4" /> Confirmer Vainqueur(s)
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
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
        <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="w-full">
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
    
