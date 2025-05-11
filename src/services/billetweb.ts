// lib/billetweb.ts
import type { TicketType, Participant } from '@/lib/types';

/* ------------------------------------------------------------------ */
/*  CONFIGURATION                                                     */
/* ------------------------------------------------------------------ */

/**
 * Les 3 variables sont **cachées côté serveur** (Cloud Functions ou
 * routes /api de Next.js). Ne jamais les rendre publiques.
 *
 * • sur Firebase :   firebase functions:config:set billetweb.user="…" ...
 * • sur Vercel    :  BILLETWEB_USER=… etc.
 */
const BILLETWEB_USER   = process.env.BILLETWEB_USER;
const BILLETWEB_KEY    = process.env.BILLETWEB_KEY;
const BILLETWEB_EVENT  = process.env.BILLETWEB_EVENT_ID;

if (!BILLETWEB_USER || !BILLETWEB_KEY || !BILLETWEB_EVENT) {
  console.warn('[Billetweb] Variables d’environnement manquantes → fallback mock');
}
/* ------------------------------------------------------------------ */
/*  HELPERS                                                           */
/* ------------------------------------------------------------------ */
function mapTicketName(name: string): TicketType {
  if (/strat[eè]ge/i.test(name))   return 'Stratège';
  if (/mar[eé]chal/i.test(name))   return 'Maréchal';
  if (/g[eé]n[eé]ral/i.test(name)) return 'Général';
  return 'Aucun';                       // billet non reconnu
}
async function callBilletweb<T = any>(endpoint: string): Promise<T> {
  const url = `https://www.billetweb.fr/api/${endpoint}` +
              `?user=${BILLETWEB_USER}&key=${BILLETWEB_KEY}&version=1`;
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) {
    throw new Error(`Billetweb ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}
/* ------------------------------------------------------------------ */
/*  1. RÉCUPÉRER TOUS LES PARTICIPANTS                                */
/* ------------------------------------------------------------------ */
export async function getParticipantsFromBilletweb(): Promise<Participant[]> {
  if (!BILLETWEB_USER) {
    const { mockUsers } = await import('@/lib/data');
    return mockUsers;
  }  

  type Attendee = {
    order_id: string;
    firstname: string;
    lastname : string;
    email    : string;
    ticket   : { name: string };
  };

  const attendees = await callBilletweb<Attendee[]>(
    `event/${BILLETWEB_EVENT}/attendees`
  );

  return attendees.map(a => ({
    id        : a.order_id,
    nom       : a.lastname,
    prenom    : a.firstname,
    email     : a.email,
    typeBillet: mapTicketName(a.ticket.name),
  }));
}

/* ------------------------------------------------------------------ */
/*  2. OBTENIR LE TICKET D’UN UTILISATEUR PAR SON EMAIL (userId)      */
/* ------------------------------------------------------------------ */

export async function getTicketInfo(userId: string): Promise<TicketInfo | null> {
  // userId = email (plus simple). Adapte si tu utilises un autre identifiant.
  const email = userId.trim().toLowerCase();

  const participants = await getParticipantsFromBilletweb();
  const match = participants.find(p => p.email.toLowerCase() === email);

  return match
    ? { id: match.id, type: match.typeBillet }
    : null;
}

/* ------------------------------------------------------------------ */
/*  TYPES LOCAUX                                                      */
/* ------------------------------------------------------------------ */

export interface TicketInfo {
  id  : string;
  type: TicketType;
}