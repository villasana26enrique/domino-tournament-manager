// @vitest-environment jsdom
import { cleanup, render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TournamentService } from '../../src/application/tournament-service.js';
import { InMemoryTournamentRepository } from '../../src/infrastructure/in-memory-tournament-repository.js';
import { ORGANIZER_PIN_STORAGE_KEY } from '../../src/infrastructure/organizer-pin.js';
import { LOCALE_STORAGE_KEY } from '../../src/i18n/locale.js';
import { App } from '../../src/ui/App.js';

function mockNavigatorLanguages(langs: string[]) {
  vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(langs);
  vi.spyOn(window.navigator, 'language', 'get').mockReturnValue(langs[0] ?? 'en-US');
}

function createTestService(tag = 'i18n'): TournamentService {
  let seq = 1;
  return new TournamentService({
    repository: new InMemoryTournamentRepository(),
    generateId: (prefix) => `${prefix}-${tag}-${seq++}`,
    nowIso: () => '2026-11-27T19:30:00.000Z',
    nowUtcMs: () => 1_700_000_000_000
  });
}

beforeEach(() => {
  window.localStorage.removeItem(LOCALE_STORAGE_KEY);
  window.localStorage.removeItem(ORGANIZER_PIN_STORAGE_KEY);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.removeItem(LOCALE_STORAGE_KEY);
  window.localStorage.removeItem(ORGANIZER_PIN_STORAGE_KEY);
});

describe('Bilingual EN/ES UI & Auto-detection (TDD)', () => {
  it('renders English by default for en-US, shows English bracket & standings, and toggles to ES persistently', async () => {
    mockNavigatorLanguages(['en-US', 'en']);
    const user = userEvent.setup();
    const service = createTestService('en');

    const trn = await service.createDraft('Saturday Club Open');
    await service.addParticipantsBulk(trn.id, 'Alice\nBob\nCharlie\nDiana\nEvan\nFrank');
    await service.confirmAndStartTournament(trn.id);

    const view = render(<App service={service} runtimeLabel="Local browser storage" />);

    expect(await view.findByText('Run your domino tournament in minutes')).toBeInTheDocument();
    expect(view.getByRole('button', { name: /Create tournament/i })).toBeInTheDocument();
    expect(view.getByRole('button', { name: /Protect with PIN/i })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');

    // Enter tournament and verify English bracket + projection + standings
    await user.click(view.getByRole('button', { name: /Continue tournament/i }));
    await user.click(view.getByRole('button', { name: /^Bracket$/i }));
    expect(view.getByText(/Qualification zone \(Top 4\)/i)).toBeInTheDocument();

    await user.click(view.getByRole('button', { name: /^Standings$/i }));
    expect(view.getByRole('columnheader', { name: /^Player$/i })).toBeInTheDocument();
    expect(view.getByRole('columnheader', { name: /^Diff$/i })).toBeInTheDocument();

    await user.click(view.getByRole('button', { name: /Projection mode/i }));
    await user.click(view.getByRole('button', { name: /Live bracket/i }));
    expect(view.getAllByText(/Road to the Final/i).length).toBeGreaterThan(0);
    await user.click(view.getByRole('button', { name: /Exit projection/i }));

    // Toggle ES in header -> immediately translates UI & persists to localStorage
    await user.click(view.getByRole('button', { name: /^ES$/ }));
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('es');
    expect(document.documentElement.lang).toBe('es');
    expect(view.getByRole('button', { name: /Mesas y resultados/i })).toBeInTheDocument();
    expect(view.getByRole('button', { name: /^Llave$/i })).toBeInTheDocument();

    // Switch back to EN -> works cleanly
    await user.click(view.getByRole('button', { name: /^EN$/ }));
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en');
    expect(view.getByRole('button', { name: /Tables & results/i })).toBeInTheDocument();
  });

  it('auto-detects Spanish when browser language is es-VE and allows switching to EN', async () => {
    mockNavigatorLanguages(['es-VE', 'en-US']);
    const user = userEvent.setup();
    const service = createTestService('es');

    const view = render(<App service={service} runtimeLabel="Almacenamiento local" />);
    expect(await view.findByText('Organiza tu torneo de dominó en minutos')).toBeInTheDocument();
    expect(view.getByRole('button', { name: /Crear torneo/i })).toBeInTheDocument();

    await user.click(view.getByRole('button', { name: /^EN$/ }));
    expect(view.getByText('Run your domino tournament in minutes')).toBeInTheDocument();

    const toggleGroup = view.getByRole('group', { name: /Language|Idioma/i });
    expect(within(toggleGroup).getByRole('button', { name: 'EN' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });
});
