import type { CoreLocale, StandingRow, TournamentStatistics } from '../core/index.js';
import type { TournamentRecord } from '../application/ports/tournament-repository.js';
import type { ClubBranding } from './club-branding-store.js';

export interface ChampionCardInput {
  tournament: TournamentRecord;
  standings: readonly StandingRow[];
  stats: TournamentStatistics;
  locale: CoreLocale;
  clubBranding?: ClubBranding;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1)}…`;
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

export function buildChampionCardSvg(input: ChampionCardInput): string {
  const { tournament, standings, stats, locale, clubBranding } = input;
  const isEn = locale === 'en';
  const champion = tournament.finalChampion?.individualChampion ?? standings[0];
  const finalChampion = tournament.finalChampion;
  const top3 = standings.slice(0, 3);
  const clubTitle = clubBranding?.clubName.trim() || '';

  const headerKicker = escapeXml(
    clubTitle
      ? `${clubTitle.toUpperCase()} · ${isEn ? 'OFFICIAL RESULTS' : 'RESULTADOS OFICIALES'}`
      : isEn
        ? 'DOMINO TOURNAMENT MANAGER · OFFICIAL RESULTS'
        : 'DOMINO TOURNAMENT MANAGER · RESULTADOS OFICIALES'
  );

  const tournamentTitle = escapeXml(truncateText(tournament.name, 34));
  const subtitle = escapeXml(
    isEn
      ? `${tournament.participants.length} players · ${tournament.plannedRounds} rounds · ${stats.totalMatches} matches`
      : `${tournament.participants.length} jugadores · ${tournament.plannedRounds} rondas · ${stats.totalMatches} partidas`
  );

  const champName = escapeXml(truncateText(champion?.displayName ?? '-', 26));
  const champRecord = champion
    ? escapeXml(
        isEn
          ? `#${champion.participantNumber} · ${champion.wins}W-${champion.draws}D-${champion.losses}L · Diff ${champion.pointDiff >= 0 ? `+${champion.pointDiff}` : champion.pointDiff}`
          : `#${champion.participantNumber} · ${champion.wins}V-${champion.draws}E-${champion.losses}D · Dif ${champion.pointDiff >= 0 ? `+${champion.pointDiff}` : champion.pointDiff}`
      )
    : '';

  const winningPairText = finalChampion
    ? escapeXml(
        truncateText(
          `${finalChampion.winningPair[0].displayName} & ${finalChampion.winningPair[1].displayName} (${finalChampion.finalMatch.pairAScore} - ${finalChampion.finalMatch.pairBScore})`,
          48
        )
      )
    : '';

  const standingsRowsSvg = top3
    .map((row, idx) => {
      const y = 740 + idx * 102;
      const diff = row.pointDiff >= 0 ? `+${row.pointDiff}` : String(row.pointDiff);
      const recordText = isEn
        ? `${row.wins}W-${row.draws}D-${row.losses}L · Diff ${diff}`
        : `${row.wins}V-${row.draws}E-${row.losses}D · Dif ${diff}`;
      return `
        <rect x="72" y="${y}" width="936" height="84" rx="20" fill="#1c1917" fill-opacity="0.72" stroke="#34d399" stroke-opacity="0.22" />
        <text x="112" y="${y + 52}" fill="#fbbf24" font-family="system-ui, -apple-system, sans-serif" font-size="32" font-weight="800">#${row.rank}</text>
        <text x="195" y="${y + 42}" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="30" font-weight="700">${escapeXml(truncateText(row.displayName, 24))}</text>
        <text x="195" y="${y + 70}" fill="#a7f3d0" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="500">${escapeXml(recordText)}</text>
        <text x="970" y="${y + 52}" text-anchor="end" fill="#ffffff" font-family="ui-monospace, monospace" font-size="28" font-weight="700">${row.matchPoints} pts</text>
      `;
    })
    .join('');

  const pairBlockSvg = finalChampion
    ? `
      <rect x="72" y="518" width="936" height="122" rx="24" fill="#ffffff" fill-opacity="0.08" stroke="#ffffff" stroke-opacity="0.16" />
      <text x="108" y="562" fill="#6ee7b7" font-family="system-ui, -apple-system, sans-serif" font-size="21" font-weight="700" letter-spacing="1.5">${escapeXml(isEn ? 'GRAND FINAL WINNING PAIR' : 'PAREJA GANADORA DE LA FINAL')}</text>
      <text x="108" y="610" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="30" font-weight="700">${winningPairText}</text>
    `
    : '';

  const podiumY = finalChampion ? 698 : 570;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#064e3b" />
      <stop offset="52%" stop-color="#065f46" />
      <stop offset="100%" stop-color="#1c1917" />
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.28" />
      <stop offset="100%" stop-color="#fbbf24" stop-opacity="0.12" />
    </linearGradient>
  </defs>
  <rect width="1080" height="1350" fill="url(#bg)" />
  <circle cx="960" cy="140" r="240" fill="#10b981" fill-opacity="0.12" />
  <circle cx="110" cy="1210" r="260" fill="#f59e0b" fill-opacity="0.08" />

  <text x="72" y="106" fill="#fde68a" font-family="system-ui, -apple-system, sans-serif" font-size="23" font-weight="800" letter-spacing="2.2">${headerKicker}</text>
  <text x="72" y="176" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="56" font-weight="900">${tournamentTitle}</text>
  <text x="72" y="224" fill="#d1fae5" font-family="system-ui, -apple-system, sans-serif" font-size="27" font-weight="500">${subtitle}</text>

  <rect x="72" y="274" width="936" height="214" rx="28" fill="url(#gold)" stroke="#fbbf24" stroke-opacity="0.45" stroke-width="2" />
  <text x="108" y="328" fill="#fde68a" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="800" letter-spacing="2">${escapeXml(isEn ? 'INDIVIDUAL CHAMPION' : 'CAMPEÓN INDIVIDUAL')}</text>
  <text x="108" y="402" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="54" font-weight="900">${champName}</text>
  <text x="108" y="454" fill="#ecfdf5" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="600">${champRecord}</text>

  ${pairBlockSvg}

  <text x="72" y="${podiumY}" fill="#a7f3d0" font-family="system-ui, -apple-system, sans-serif" font-size="23" font-weight="800" letter-spacing="1.8">${escapeXml(isEn ? 'TOP STANDINGS' : 'PODIO FINAL')}</text>
  ${standingsRowsSvg}

  <rect x="72" y="1090" width="936" height="128" rx="22" fill="#ffffff" fill-opacity="0.06" />
  <text x="112" y="1142" fill="#a7f3d0" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="700">${escapeXml(isEn ? 'TOURNAMENT SUMMARY' : 'RESUMEN DEL TORNEO')}</text>
  <text x="112" y="1188" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="26" font-weight="600">${escapeXml(
    isEn
      ? `Total points: ${stats.totalPointsScored} · Time draws: ${stats.drawsCount} · Repeated partners: ${stats.repeatedPartnersCount}`
      : `Puntos totales: ${stats.totalPointsScored} · Empates: ${stats.drawsCount} · Parejas repetidas: ${stats.repeatedPartnersCount}`
  )}</text>

  <text x="72" y="1288" fill="#a7f3d0" fill-opacity="0.8" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="600">${escapeXml(
    clubTitle ? `${clubTitle} · Domino Tournament Manager Pro` : 'Domino Tournament Manager Pro'
  )}</text>
</svg>`;
}

export async function renderChampionCardPngBlob(input: ChampionCardInput): Promise<Blob> {
  const svgMarkup = buildChampionCardSvg(input);
  const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Failed to render summary card image.'));
      image.src = svgUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context unavailable.');
    }
    ctx.drawImage(img, 0, 0, 1080, 1350);

    if (input.clubBranding?.logoDataUrl) {
      try {
        const logoImg = await new Promise<HTMLImageElement>((resolve, reject) => {
          const logo = new Image();
          logo.onload = () => resolve(logo);
          logo.onerror = () => reject(new Error('Logo draw failed'));
          logo.src = input.clubBranding!.logoDataUrl!;
        });
        ctx.save();
        ctx.beginPath();
        ctx.arc(948, 128, 56, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(logoImg, 892, 72, 112, 112);
        ctx.restore();
      } catch {
        // Keep generated summary card clean even if logo failed to decode
      }
    }

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to export PNG image.'));
      }, 'image/png');
    });
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

export function triggerPngDownload(blob: Blob, filename: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function shareChampionCard(
  input: ChampionCardInput
): Promise<'shared' | 'downloaded'> {
  const blob = await renderChampionCardPngBlob(input);
  const filename = `domino-champion-${slugifyFilename(input.tournament.name)}.png`;

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof File !== 'undefined') {
    const file = new File([blob], filename, { type: 'image/png' });
    const canShareFiles =
      typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] });
    if (canShareFiles) {
      try {
        await navigator.share({
          title: input.tournament.name,
          files: [file]
        });
        return 'shared';
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return 'downloaded';
        }
      }
    }
  }

  triggerPngDownload(blob, filename);
  return 'downloaded';
}
