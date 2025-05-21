
'use client';

import type React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, Users, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getParticipants } from '@/lib/data';
import type { Participant, TicketType } from '@/lib/types';
import { Button } from '../ui/button';

type SortKey = 'nom' | 'typeBillet';
type SortOrder = 'asc' | 'desc';

const ticketTypeOrder: TicketType[] = ['Stratège', 'Maréchal', 'Général', 'Invitation'];

export default function ParticipantList() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('nom');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const { toast } = useToast();

  const fetchParticipants = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedParticipants = await getParticipants();
      setParticipants(fetchedParticipants);
    } catch (err) {
      console.error("Erreur lors de la récupération des participants:", err);
      const errorMessage = err instanceof Error ? err.message : "Une erreur inconnue est survenue lors de la récupération des participants.";
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Erreur de chargement",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchParticipants();
  }, [fetchParticipants]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const sortedParticipants = useMemo(() => {
    let sorted = [...participants];
    if (sortKey) {
      sorted.sort((a, b) => {
        let valA: string | number;
        let valB: string | number;

        if (sortKey === 'typeBillet') {
          valA = ticketTypeOrder.indexOf(a.typeBillet);
          valB = ticketTypeOrder.indexOf(b.typeBillet);
        } else { // 'nom' or any other string based sort
          valA = a[sortKey]?.toLowerCase() || '';
          valB = b[sortKey]?.toLowerCase() || '';
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sorted;
  }, [participants, sortKey, sortOrder]);

  const getBadgeVariant = (ticketType: TicketType): "strategist" | "marshal" | "general" | "secondary" | "destructive" => {
    switch (ticketType) {
      case 'Stratège':
        return 'strategist';
      case 'Maréchal':
        return 'marshal';
      case 'Général':
        return 'general';
      case 'Invitation':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) {
      return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
    }
    return sortOrder === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  if (isLoading && participants.length === 0) { // Show loader only if no data yet
    return (
      <div className="flex justify-center items-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Chargement des participants...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-destructive">
        <AlertTriangle className="h-8 w-8 mb-2" />
        <p className="mb-2">Erreur: {error}</p>
        <Button onClick={fetchParticipants} variant="outline" size="sm" disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Liste des participants inscrits via Billetweb</h3>
        <Button onClick={fetchParticipants} variant="outline" size="sm" disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>
      {sortedParticipants.length > 0 ? (
        <Table>
          <TableCaption>
            {sortedParticipants.length} participant(s) récupéré(s) depuis Firestore.
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort('nom')} className="px-0 hover:bg-transparent">
                  Nom
                  {renderSortIcon('nom')}
                </Button>
              </TableHead>
              <TableHead>Prénom</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-center">
                <Button variant="ghost" onClick={() => handleSort('typeBillet')} className="px-0 hover:bg-transparent">
                  Type de Billet
                  {renderSortIcon('typeBillet')}
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedParticipants.map((participant) => (
              <TableRow key={participant.id}>
                <TableCell className="font-medium">{participant.nom}</TableCell>
                <TableCell>{participant.prenom}</TableCell>
                <TableCell>{participant.email}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={getBadgeVariant(participant.typeBillet)}>
                    {participant.typeBillet}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="text-center py-10">
          {isLoading ? (
            <>
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Chargement des participants...</p>
            </>
          ) : (
            <>
              <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Aucun participant trouvé dans la base de données.</p>
              <p className="text-sm text-muted-foreground">Essayez de lancer une synchronisation avec Billetweb.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
