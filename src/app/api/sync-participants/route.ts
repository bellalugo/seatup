
import { NextResponse } from 'next/server';
import { syncParticipantsWithBilletweb } from '@/lib/data';

export async function POST() {
  try {
    const result = await syncParticipantsWithBilletweb();
    
    return NextResponse.json({ 
      success: true, 
      ...result 
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Une erreur inconnue est survenue.";
    console.error('[API Sync Participants Error]', errorMessage);
    return NextResponse.json(
      { success: false, message: `Échec de la synchronisation : ${errorMessage}` },
      { status: 500 }
    );
  }
}
