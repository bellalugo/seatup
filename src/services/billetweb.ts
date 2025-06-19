
// lib/billetweb.ts
import type { TicketType, Participant } from '@/lib/types';

/* ------------------------------------------------------------------ */
/*  CONFIGURATION                                                     */
/* ------------------------------------------------------------------ */

const BILLETWEB_USER   = process.env.BILLETWEB_USER;
const BILLETWEB_KEY    = process.env.BILLETWEB_KEY;
const BILLETWEB_EVENT  = process.env.BILLETWEB_EVENT_ID;

// useMock will be true if any of the required Billetweb environment variables are missing.
const useMock = !BILLETWEB_USER || !BILLETWEB_KEY || !BILLETWEB_EVENT;

if (useMock) {
  console.warn('[Billetweb Service] AVERTISSEMENT: Les variables d’environnement Billetweb (BILLETWEB_USER, BILLETWEB_KEY, ou BILLETWEB_EVENT_ID) sont manquantes ou incomplètes.');
  console.warn('[Billetweb Service] L\'appel à l\'API Billetweb réelle ne pourra pas être effectué tant que ces variables ne sont pas correctement configurées dans votre fichier .env.local et que le serveur n\'est pas redémarré.');
}

/* ------------------------------------------------------------------ */
/*  HELPERS                                                           */
/* ------------------------------------------------------------------ */
function mapTicketName(name?: string): TicketType { // name can be undefined
  if (!name || name.trim() === '') { 
    return 'Invitation';
  }
  const trimmedName = name.trim();
  if (/strat[eè]ge/i.test(trimmedName))   return 'Stratège';
  if (/mar[eé]chal/i.test(trimmedName))   return 'Maréchal';
  if (/g[eé]n[eé]ral/i.test(trimmedName)) return 'Général';
  if (/invitation/i.test(trimmedName)) return 'Invitation';
  
  console.warn(`[Billetweb Service] mapTicketName: Nom de billet non reconnu "${trimmedName}", retour "Invitation".`);
  return 'Invitation';
}

async function callBilletweb<T = any>(endpoint: string): Promise<T> {
  const url = `https://www.billetweb.fr/api/${endpoint}` +
              `?user=${BILLETWEB_USER}&key=${BILLETWEB_KEY}&version=1`;
  let res;
  try {
    res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  } catch (networkError) {
    // This will catch TypeErrors from fetch (e.g., network down, ECONNRESET before response headers)
    const keyPreview = BILLETWEB_KEY ? `${BILLETWEB_KEY.substring(0, 3)}...` : '***KEY_MISSING***';
    const safeUrl = `https://www.billetweb.fr/api/${endpoint}?user=${BILLETWEB_USER}&key=${keyPreview}&version=1`;
    console.error(`[Billetweb Service] Network error during fetch to ${safeUrl}:`, networkError);
    if (networkError instanceof Error) {
        throw new Error(`Billetweb API Fetch Error to ${endpoint}: ${networkError.message}`);
    }
    throw new Error(`Billetweb API Fetch Error to ${endpoint}: An unknown network error occurred.`);
  }

  if (!res.ok) {
    // This handles HTTP errors (4xx, 5xx)
    const keyPreview = BILLETWEB_KEY ? `${BILLETWEB_KEY.substring(0, 3)}...` : '***KEY_MISSING***';
    const safeUrl = `https://www.billetweb.fr/api/${endpoint}?user=${BILLETWEB_USER}&key=${keyPreview}&version=1`;
    throw new Error(`Billetweb API HTTP Error: ${res.status} ${res.statusText} for URL: ${safeUrl}`);
  }
  return res.json() as Promise<T>;
}

/* ------------------------------------------------------------------ */
/*  1. RÉCUPÉRER TOUS LES PARTICIPANTS                                */
/* ------------------------------------------------------------------ */
export async function getParticipantsFromBilletweb(): Promise<Participant[]> {
  if (useMock) {
    console.error('[Billetweb Service] ERREUR CRITIQUE: Configuration Billetweb incomplète.');
    console.error('[Billetweb Service] Les variables d’environnement BILLETWEB_USER, BILLETWEB_KEY, ou BILLETWEB_EVENT_ID sont manquantes.');
    console.error('[Billetweb Service] L\'appel réel à l\'API Billetweb ne peut pas être effectué. Retour d\'une liste vide.');
    console.error('[Billetweb Service] Veuillez configurer ces variables dans votre fichier .env.local et redémarrer le serveur.');
    return []; // Return an empty array as mock data is removed and real call cannot be made.
  }  

  console.log('[Billetweb Service] Tentative de récupération des participants depuis l\'API Billetweb réelle...');
  type BilletwebAttendee = {
    id?: string; 
    order_id: string; 
    firstname?: string; 
    name?: string;
    email?: string;     
    ticket?: string; 
    ticket_id?: string; 
    rate_name?: string; 
    answers?: Array<{ 
        id?: string; 
        label?: string; 
        value?: string | string[] | number | boolean | null; 
        type?: string; 
    }>;
  };

  try {
    const attendees = await callBilletweb<BilletwebAttendee[]>(
      `event/${BILLETWEB_EVENT}/attendees`
    );

    console.log(`[Billetweb Service] ${attendees.length} participant(s) brut(s) récupéré(s) de Billetweb.`);

    return attendees.map((a, index) => {
      const uniqueParticipantId = a.id || `${a.order_id}_attendee_${index}`;
      
      if (index < 2) { 
        console.log(`[Billetweb Service] Raw data for attendee ${index + 1} (ID: ${uniqueParticipantId}):`, JSON.stringify(a, null, 2));
        if (a.answers) {
          console.log(`[Billetweb Service] Answers for attendee ${index + 1} (ID: ${uniqueParticipantId}):`, JSON.stringify(a.answers, null, 2));
        }
      }
      
      let mappedNom = a.name || ''; 
      let mappedPrenom = a.firstname || '';
      let mappedEmail = a.email || '';
      
      if (a.answers && Array.isArray(a.answers)) {
        const nomAnswer = a.answers.find(ans => ans.label?.toLowerCase().includes('nom'));
        if (nomAnswer && typeof nomAnswer.value === 'string' && nomAnswer.value.trim() !== '') {
            mappedNom = nomAnswer.value.trim();
        }

        const prenomAnswer = a.answers.find(ans => ans.label?.toLowerCase().includes('prénom'));
         if (prenomAnswer && typeof prenomAnswer.value === 'string' && prenomAnswer.value.trim() !== '') {
            mappedPrenom = prenomAnswer.value.trim();
        }
        
        const emailAnswer = a.answers.find(ans => ans.label?.toLowerCase().includes('email'));
        if (emailAnswer && typeof emailAnswer.value === 'string' && emailAnswer.value.trim() !== '') {
            mappedEmail = emailAnswer.value.trim();
        }
      }

      let ticketNameToMap: string | undefined = undefined;

      if (a.answers && Array.isArray(a.answers)) {
        const tarifAnswer = a.answers.find(ans => ans.label?.toLowerCase().includes('tarif'));
        if (tarifAnswer && typeof tarifAnswer.value === 'string' && tarifAnswer.value.trim() !== '') {
          ticketNameToMap = tarifAnswer.value.trim();
        }
      }

      if (!ticketNameToMap && a.ticket && typeof a.ticket === 'string' && a.ticket.trim() !== '') {
        ticketNameToMap = a.ticket.trim();
      }

      if (!ticketNameToMap && a.rate_name && typeof a.rate_name === 'string' && a.rate_name.trim() !== '') {
        ticketNameToMap = a.rate_name.trim();
      }
      
      const mappedTicketType = mapTicketName(ticketNameToMap);
      
      const participantData: Participant = {
        id        : uniqueParticipantId,
        nom       : mappedNom,
        prenom    : mappedPrenom,
        email     : mappedEmail,     
        typeBillet: mappedTicketType, 
      };
      
      if (index < 5 || mappedTicketType === 'Invitation' || !mappedNom) { 
        console.log(`[Billetweb Service DEBUG] For ID=${uniqueParticipantId}: API_Name='${a.name}', API_FirstName='${a.firstname}', API_Ticket='${a.ticket}', API_RateName='${a.rate_name}'`);
        console.log(`[Billetweb Service DEBUG] Mapped: nom='${mappedNom}', prenom='${mappedPrenom}', ticketToMap='${ticketNameToMap}', typeBillet='${mappedTicketType}'`);
      }
      
      return participantData;
    });
  } catch (error) {
    console.error("[Billetweb Service] Erreur lors de l'appel à l'API Billetweb réelle ou du mappage (attrapée dans getParticipantsFromBilletweb):", error);
    if (error instanceof Error) {
        console.error("[Billetweb Service] Message d'erreur:", error.message);
    }
    return []; 
  }
}

/* ------------------------------------------------------------------ */
/*  2. OBTENIR LE TICKET D’UN UTILISATEUR PAR SON EMAIL (userId)      */
/* ------------------------------------------------------------------ */
export interface BilletwebTicketInfo {
  id  : string;
  type: TicketType;
}

export async function getTicketInfo(userId: string): Promise<BilletwebTicketInfo | null> {
  const email = userId.trim().toLowerCase(); 

  // This will now attempt a real API call if configured, or return empty if not.
  const participants = await getParticipantsFromBilletweb(); 
  
  // If Billetweb env vars are not set, participants will be an empty array here.
  if (participants.length === 0 && useMock) { 
      console.warn(`[Billetweb Service] getTicketInfo: Impossible de vérifier le ticket pour ${email} car la configuration Billetweb est manquante.`);
      return null;
  }
  
  const match = participants.find(p => p.email.toLowerCase() === email);

  return match
    ? { id: match.id, type: match.typeBillet }
    : null;
}

