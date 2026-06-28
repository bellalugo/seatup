// Génère un PDF du planning d'un joueur, entièrement côté navigateur (aucun appel réseau).
// jsPDF est importé dynamiquement pour ne pas alourdir le bundle initial ni gêner le SSR.

export interface PlanningRow {
  table: string;
  game: string;
  creneau: string;
}

export interface ExportPlanningOptions {
  userName: string;
  ticketType?: string;
  rows: PlanningRow[];
}

export async function exportPlanningPdf({ userName, ticketType, rows }: ExportPlanningOptions): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;

  const colTable = margin;
  const colGame = margin + 22;
  const colCreneau = pageW - margin - 48;

  let y = margin + 2;

  const drawHeaderBand = () => {
    doc.setDrawColor(210);
    doc.setFillColor(245, 243, 230);
    doc.rect(margin, y - 5, pageW - margin * 2, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(70);
    doc.text('Table', colTable + 1, y);
    doc.text('Jeu', colGame, y);
    doc.text('Créneau', colCreneau, y);
    y += 9;
  };

  // Titre
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.setTextColor(20);
  doc.text('Mon planning', margin, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(120);
  doc.text('ASYNCONV · Édition 5|5 · 8 au 13 juillet 2026', margin, y);
  y += 11;

  // Participant
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(20);
  doc.text(userName || 'Joueur', margin, y);
  if (ticketType) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`Billet : ${ticketType}`, margin, y + 5);
  }
  y += 13;

  // En-tête de tableau
  drawHeaderBand();

  // Lignes
  doc.setTextColor(20);
  doc.setFontSize(10);

  if (rows.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(120);
    doc.text('Aucune inscription pour le moment.', margin, y);
    y += 8;
  }

  for (const r of rows) {
    const gameLines = doc.splitTextToSize(r.game || '', colCreneau - colGame - 4) as string[];
    const blockH = Math.max(7, gameLines.length * 5 + 2);

    if (y + blockH > pageH - margin) {
      doc.addPage();
      y = margin + 2;
      drawHeaderBand();
      doc.setTextColor(20);
      doc.setFontSize(10);
    }

    doc.setFont('helvetica', 'bold');
    doc.text(String(r.table), colTable + 1, y);
    doc.setFont('helvetica', 'normal');
    doc.text(gameLines, colGame, y);
    doc.text(r.creneau || '', colCreneau, y);

    y += blockH;
    doc.setDrawColor(228);
    doc.line(margin, y - 3, pageW - margin, y - 3);
  }

  // Pied de page
  const now = new Date();
  const stamp = `Document généré le ${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(stamp, margin, pageH - 12);

  const safeName = (userName || 'joueur').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase();
  doc.save(`planning-asynconv-${safeName || 'joueur'}.pdf`);
}
