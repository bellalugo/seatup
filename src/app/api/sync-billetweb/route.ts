import { NextResponse } from 'next/server';
import { syncParticipantsWithBilletweb } from '@/lib/data';
import { auth } from '@/firebase/clientApp'; // We might not need this if we don't check for admin rights here, but good practice

// Protect this route by checking for admin rights in a real-world scenario.
// For now, we assume it's only accessible via the admin UI button.

export async function POST() {
  try {
    // In a production app, you would verify the user's token here
    // to ensure they are an authorized administrator before proceeding.
    
    const result = await syncParticipantsWithBilletweb();
    
    const message = `Participants : ${result.added} ajoutés, ${result.updated} mis à jour, ${result.skipped} inchangés.`;

    return NextResponse.json({ 
      success: true, 
      message: message,
      ...result 
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Une erreur inconnue est survenue.";
    console.error('[API Sync Error]', errorMessage);
    return NextResponse.json(
      { success: false, message: `Échec de la synchronisation : ${errorMessage}` },
      { status: 500 }
    );
  }
}
