import { NextResponse } from 'next/server';
import { migrate2025DataToArchives } from '@/lib/data';

/**
 * POST /api/archive-2025
 *
 * Moves all root-level Firestore documents under archives/2025/{collection}/*.
 * Idempotent: calling it again after a successful migration is a no-op (all root collections will be empty).
 *
 * NOTE: This endpoint must only be exposed to authenticated admins. The route itself does not
 * re-check authentication beyond what Firestore security rules enforce — the assumption is that
 * the admin page that triggers this call is already auth-gated by AuthContext.
 */
export async function POST() {
    try {
        const result = await migrate2025DataToArchives();
        return NextResponse.json({
            success: true,
            ...result,
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Erreur inconnue lors de l'archivage.";
        console.error('[API Archive 2025 Error]', errorMessage);
        return NextResponse.json(
            { success: false, message: `Échec de l'archivage 2025 : ${errorMessage}` },
            { status: 500 }
        );
    }
}
