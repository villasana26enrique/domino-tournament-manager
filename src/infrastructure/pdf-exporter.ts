import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  CoreLocale,
  StandingRow,
  StructuredRulesDocument,
  TournamentStatistics
} from '../core/index.js';
import type { TournamentRecord } from '../application/ports/tournament-repository.js';
import { localizeStageName } from '../i18n/domain-labels.js';

function sanitizePdfText(text: string): string {
  return text
    .replaceAll('→', '->')
    .replaceAll('≥', '>=')
    .replaceAll('≤', '<=')
    .replaceAll('×', 'x')
    .replaceAll('—', '-')
    .replaceAll('–', '-')
    .replaceAll('“', '"')
    .replaceAll('”', '"');
}

function slugifyFilename(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'tournament'
  );
}

function triggerBrowserDownload(bytes: Uint8Array, filename: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function generateRulesPdfBytes(
  tournamentName: string,
  rules: StructuredRulesDocument,
  seed: string,
  locale: CoreLocale = 'es'
): Uint8Array {
  const isEn = locale === 'en';
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 44;
  const maxWidth = pageWidth - margin * 2;
  let y = 52;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 48) {
      doc.addPage();
      y = 50;
    }
  };

  doc.setFillColor(6, 78, 59);
  doc.rect(0, 0, pageWidth, 88, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text(
    sanitizePdfText(
      isEn ? `Official Rules - ${tournamentName}` : `Reglamento Oficial - ${tournamentName}`
    ),
    margin,
    38
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(sanitizePdfText(rules.modalityTitle), margin, 58);
  doc.text(
    sanitizePdfText(
      isEn
        ? `Reproducible seed: ${seed} | Version ${rules.version}`
        : `Semilla reproducible: ${seed} | Version ${rules.version}`
    ),
    margin,
    74
  );

  y = 112;
  doc.setTextColor(28, 25, 23);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(isEn ? 'Overview' : 'Resumen general', margin, y);
  y += 16;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const summaryLines = doc.splitTextToSize(sanitizePdfText(rules.summary), maxWidth) as string[];
  doc.text(summaryLines, margin, y);
  y += summaryLines.length * 14 + 14;

  for (const section of rules.sections) {
    ensureSpace(48);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(6, 78, 59);
    doc.text(sanitizePdfText(section.title), margin, y);
    y += 16;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(41, 37, 36);

    for (const item of section.items) {
      const wrapped = doc.splitTextToSize(sanitizePdfText(`- ${item}`), maxWidth - 10) as string[];
      ensureSpace(wrapped.length * 14 + 6);
      doc.text(wrapped, margin + 6, y);
      y += wrapped.length * 14 + 5;
    }
    y += 8;
  }

  return new Uint8Array(doc.output('arraybuffer'));
}

export function generateFinalReportPdfBytes(
  tournament: TournamentRecord,
  standings: readonly StandingRow[],
  stats: TournamentStatistics,
  locale: CoreLocale = 'es'
): Uint8Array {
  const isEn = locale === 'en';
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = 50;

  doc.setFillColor(6, 78, 59);
  doc.rect(0, 0, pageWidth, 86, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text(
    sanitizePdfText(
      isEn ? `Official Report - ${tournament.name}` : `Reporte Oficial - ${tournament.name}`
    ),
    margin,
    36
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const formatLabel = isEn
    ? tournament.config.format === 'rounds_all_play'
      ? 'Fixed Rounds (Everyone plays)'
      : 'Qualifying + Knockouts to the Final'
    : tournament.config.format === 'rounds_all_play'
      ? 'Por rondas (todos juegan)'
      : 'Clasificatoria con eliminaciones hasta la Final';
  doc.text(
    sanitizePdfText(
      isEn
        ? `${formatLabel} | ${tournament.participants.length} players | ${tournament.plannedRounds} rounds`
        : `${formatLabel} | ${tournament.participants.length} participantes | ${tournament.plannedRounds} rondas`
    ),
    margin,
    56
  );
  doc.text(
    sanitizePdfText(isEn ? `Seed: ${tournament.seed}` : `Semilla: ${tournament.seed}`),
    margin,
    72
  );

  y = 108;
  doc.setTextColor(28, 25, 23);

  const topChamp = tournament.finalChampion?.individualChampion ?? standings[0];
  if (topChamp) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    const diffStr = topChamp.pointDiff >= 0 ? `+${topChamp.pointDiff}` : String(topChamp.pointDiff);
    doc.text(
      sanitizePdfText(
        isEn
          ? `Individual Champion: #${topChamp.participantNumber} ${topChamp.displayName} (${topChamp.wins}W-${topChamp.draws}D-${topChamp.losses}L, Diff ${diffStr})`
          : `Campeon Individual: #${topChamp.participantNumber} ${topChamp.displayName} (${topChamp.wins}V-${topChamp.draws}E-${topChamp.losses}D, Dif ${diffStr})`
      ),
      margin,
      y
    );
    y += 18;
  }

  if (tournament.finalChampion) {
    const fc = tournament.finalChampion;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(
      sanitizePdfText(
        isEn
          ? `Grand Final Winning Pair (${fc.finalMatch.pairAScore} - ${fc.finalMatch.pairBScore}): ${fc.winningPair[0].displayName} & ${fc.winningPair[1].displayName}`
          : `Pareja Ganadora de la Final (${fc.finalMatch.pairAScore} - ${fc.finalMatch.pairBScore}): ${fc.winningPair[0].displayName} & ${fc.winningPair[1].displayName}`
      ),
      margin,
      y
    );
    y += 18;
  }

  // Stats summary block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(isEn ? 'Tournament statistics' : 'Estadisticas del campeonato', margin, y);
  y += 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  const statLines: string[] = isEn
    ? [
        `Matches played: ${stats.totalMatches} | Time draws: ${stats.drawsCount} | Total points scored: ${stats.totalPointsScored}`,
        stats.highestMatchScore
          ? `Highest table score: ${stats.highestMatchScore.score}-${stats.highestMatchScore.loserScore} (Round ${stats.highestMatchScore.roundNumber}, Table ${stats.highestMatchScore.tableNumber})`
          : 'Highest table score: N/A',
        stats.largestVictoryMargin
          ? `Largest victory margin: +${stats.largestVictoryMargin.margin} pts (${stats.largestVictoryMargin.winnerScore}-${stats.largestVictoryMargin.loserScore}, R${stats.largestVictoryMargin.roundNumber} T${stats.largestVictoryMargin.tableNumber})`
          : 'Largest victory margin: N/A'
      ]
    : [
        `Partidas disputadas: ${stats.totalMatches} | Empates por tiempo: ${stats.drawsCount} | Puntos totales anotados: ${stats.totalPointsScored}`,
        stats.highestMatchScore
          ? `Mayor puntaje en mesa: ${stats.highestMatchScore.score}-${stats.highestMatchScore.loserScore} (Ronda ${stats.highestMatchScore.roundNumber}, Mesa ${stats.highestMatchScore.tableNumber})`
          : 'Mayor puntaje en mesa: N/A',
        stats.largestVictoryMargin
          ? `Mayor diferencia en una partida: +${stats.largestVictoryMargin.margin} pts (${stats.largestVictoryMargin.winnerScore}-${stats.largestVictoryMargin.loserScore}, R${stats.largestVictoryMargin.roundNumber} M${stats.largestVictoryMargin.tableNumber})`
          : 'Mayor diferencia en una partida: N/A'
      ];
  for (const line of statLines) {
    doc.text(sanitizePdfText(line), margin, y);
    y += 13;
  }
  y += 8;

  // Standings table
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    headStyles: { fillColor: [6, 78, 59], textColor: 255, fontSize: 8.5 },
    bodyStyles: { fontSize: 8.5 },
    head: [
      isEn
        ? ['Pos', 'Player', 'GP', 'W', 'D', 'L', 'Pts', 'Win%', 'PF', 'PA', 'Diff', 'Byes']
        : ['Pos', 'Jugador', 'PJ', 'V', 'E', 'D', 'Pts', '% Efect', 'PF', 'PC', 'Dif', 'Desc']
    ],
    body: standings.map((r) => [
      `${r.rank}${r.isTied ? '=' : ''}`,
      sanitizePdfText(`#${r.participantNumber} ${r.displayName}`),
      String(r.gamesPlayed),
      String(r.wins),
      String(r.draws),
      String(r.losses),
      String(r.matchPoints),
      `${(r.winRate * 100).toFixed(1)}%`,
      String(r.pointsFor),
      String(r.pointsAgainst),
      r.pointDiff > 0 ? `+${r.pointDiff}` : String(r.pointDiff),
      String(r.byes)
    ])
  });

  const lastTableY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 120;
  let nextY = lastTableY + 22;

  const participantById = new Map(tournament.participants.map((p) => [p.id, p]));
  const nameOf = (id: string) => {
    const p = participantById.get(id);
    return p ? `#${p.number} ${p.displayName}` : id;
  };

  if (nextY > doc.internal.pageSize.getHeight() - 80) {
    doc.addPage();
    nextY = 48;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(isEn ? 'Round & table summary' : 'Resumen de mesas por ronda', margin, nextY);
  nextY += 14;

  const matchRows: string[][] = [];
  for (const round of tournament.rounds) {
    for (const m of round.matches) {
      matchRows.push([
        sanitizePdfText(localizeStageName(round.stageName, locale)),
        isEn ? `Table ${m.tableNumber}` : `Mesa ${m.tableNumber}`,
        sanitizePdfText(`${nameOf(m.pairA[0])} & ${nameOf(m.pairA[1])}`),
        sanitizePdfText(`${nameOf(m.pairB[0])} & ${nameOf(m.pairB[1])}`),
        m.status === 'completed'
          ? `${m.pairAScore} - ${m.pairBScore}`
          : isEn
            ? 'Pending'
            : 'Pendiente'
      ]);
    }
  }

  autoTable(doc, {
    startY: nextY,
    margin: { left: margin, right: margin },
    headStyles: { fillColor: [41, 37, 36], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    head: [
      isEn
        ? ['Round', 'Table', 'Pair A', 'Pair B', 'Score']
        : ['Ronda', 'Mesa', 'Pareja A', 'Pareja B', 'Marcador']
    ],
    body: matchRows
  });

  const corrections = tournament.resultAuditLogs.filter((l) => l.action === 'corrected');
  if (corrections.length > 0) {
    const afterRoundsY =
      (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? nextY + 80;
    let auditY = afterRoundsY + 20;
    if (auditY > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      auditY = 48;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(
      isEn ? 'Recorded administrative corrections' : 'Correcciones administrativas registradas',
      margin,
      auditY
    );
    auditY += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    for (const c of corrections) {
      doc.text(
        sanitizePdfText(
          isEn
            ? `- R${c.roundNumber} T${c.tableNumber}: ${c.prevPairAScore}-${c.prevPairBScore} -> ${c.newPairAScore}-${c.newPairBScore} (${c.reason ?? 'No reason'})`
            : `- R${c.roundNumber} M${c.tableNumber}: ${c.prevPairAScore}-${c.prevPairBScore} -> ${c.newPairAScore}-${c.newPairBScore} (${c.reason ?? 'Sin motivo'})`
        ),
        margin,
        auditY
      );
      auditY += 13;
    }
  }

  return new Uint8Array(doc.output('arraybuffer'));
}

export function downloadRulesPdf(
  tournamentName: string,
  rules: StructuredRulesDocument,
  seed: string,
  locale: CoreLocale = 'es'
): void {
  const bytes = generateRulesPdfBytes(tournamentName, rules, seed, locale);
  const prefix = locale === 'en' ? 'domino-rules' : 'reglamento';
  triggerBrowserDownload(bytes, `${prefix}-${slugifyFilename(tournamentName)}.pdf`);
}

export function downloadFinalReportPdf(
  tournament: TournamentRecord,
  standings: readonly StandingRow[],
  stats: TournamentStatistics,
  locale: CoreLocale = 'es'
): void {
  const bytes = generateFinalReportPdfBytes(tournament, standings, stats, locale);
  const prefix = locale === 'en' ? 'domino-report' : 'reporte';
  triggerBrowserDownload(bytes, `${prefix}-${slugifyFilename(tournament.name)}.pdf`);
}
