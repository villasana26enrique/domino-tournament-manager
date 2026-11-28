// @vitest-environment jsdom
import { generateKeyPairSync, sign } from 'node:crypto';
import { cleanup, render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TournamentService } from '../../src/application/tournament-service.js';
import { CLUB_BRANDING_STORAGE_KEY } from '../../src/infrastructure/club-branding-store.js';
import { InMemoryTournamentRepository } from '../../src/infrastructure/in-memory-tournament-repository.js';
import { PRO_LICENSE_STORAGE_KEY } from '../../src/infrastructure/license-store.js';
import * as shareCardExporter from '../../src/infrastructure/share-card-exporter.js';
import { App } from '../../src/ui/App.js';

function createTestKeypair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const rawPub = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
  return {
    publicKeyB64Url: rawPub.toString('base64url'),
    signPro(holder: string): string {
      const payloadB64 = Buffer.from(
        JSON.stringify({
          v: 1,
          plan: 'pro',
          holder,
          issuedAt: '2026-11-27',
          id: 'DTM-UI-TEST-01'
        }),
        'utf8'
      ).toString('base64url');
      const sigB64 = sign(null, Buffer.from(payloadB64, 'utf8'), privateKey).toString('base64url');
      return `DTM-PRO-1.${payloadB64}.${sigB64}`;
    }
  };
}

function createTestService(tag = 'pro'): TournamentService {
  let seq = 1;
  return new TournamentService({
    repository: new InMemoryTournamentRepository(),
    generateId: (prefix) => `${prefix}-${tag}-${seq++}`,
    nowIso: () => '2026-11-27T20:00:00.000Z',
    nowUtcMs: () => 1_700_000_000_000
  });
}

beforeEach(() => {
  window.localStorage.removeItem(PRO_LICENSE_STORAGE_KEY);
  window.localStorage.removeItem(CLUB_BRANDING_STORAGE_KEY);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.removeItem(PRO_LICENSE_STORAGE_KEY);
  window.localStorage.removeItem(CLUB_BRANDING_STORAGE_KEY);
});

describe('Pro Licensing, Free >16 Gate, Club Branding & WhatsApp Card UI (TDD)', () => {
  it('allows up to 16 players on Free, opens Pro modal on player #17, and unlocks 20 players + Club Branding + Share Card with valid Ed25519 key', async () => {
    const user = userEvent.setup();
    const kp = createTestKeypair();
    const service = createTestService('gate');

    const shareSpy = vi.spyOn(shareCardExporter, 'shareChampionCard').mockResolvedValue('downloaded');

    const view = render(
      <App
        service={service}
        runtimeLabel="Local browser storage"
        initialLocale="en"
        licensePublicKey={kp.publicKeyB64Url}
      />
    );

    // 1. Free tier: create tournament and add 16 players cleanly
    await user.type(await view.findByLabelText(/Tournament name/i), 'Pro Gate Open');
    await user.click(view.getByRole('button', { name: /Create tournament/i }));

    await user.click(await view.findByRole('button', { name: /^16 players$/i }));
    expect(await view.findByText(/Free limit of 16 players reached/i)).toBeInTheDocument();

    // 2. Attempting to add 17th player opens Pro modal without adding player #17
    await user.type(view.getByLabelText(/Player name/i), 'Player 17');
    await user.click(view.getByRole('button', { name: /Add player/i }));

    const dialog = await view.findByRole('dialog');
    expect(within(dialog).getByText(/exceed the 16-player Free limit/i)).toBeInTheDocument();

    // Reject forged key first
    await user.type(within(dialog).getByLabelText(/Paste your signed Pro key/i), 'INVALID-KEY');
    await user.click(within(dialog).getByRole('button', { name: /Activate Pro/i }));
    expect(await within(dialog).findByText(/Invalid key format/i)).toBeInTheDocument();

    // Activate valid Ed25519 signed Pro key
    const validKey = kp.signPro('Enrique Villasana');
    const keyInput = within(dialog).getByLabelText(/Paste your signed Pro key/i);
    await user.clear(keyInput);
    await user.type(keyInput, validKey);
    await user.click(within(dialog).getByRole('button', { name: /Activate Pro/i }));

    expect(
      await within(dialog).findByText(/Pro unlocked! Licensed to Enrique Villasana/i)
    ).toBeInTheDocument();

    // Configure Club Branding inside the active Pro modal
    const clubInput = within(dialog).getByLabelText(/^Name$/i);
    await user.type(clubInput, 'Club Vecinos Caracas');
    await user.click(within(dialog).getByRole('button', { name: /Save branding/i }));
    expect(await within(dialog).findByText(/Club branding saved/i)).toBeInTheDocument();

    // Close modal -> Header now shows Pro button
    await user.click(within(dialog).getByRole('button', { name: /Close Pro modal/i }));
    expect(view.getByRole('button', { name: /^Pro$/i })).toBeInTheDocument();

    // 3. Now Pro unlocks adding 17..20 players
    const bulkBox = view.getByLabelText(/Paste player list/i);
    await user.type(bulkBox, 'Vecino 17\nVecino 18\nVecino 19\nVecino 20');
    await user.click(view.getByRole('button', { name: /Add list/i }));
    expect(await view.findByText('Vecino 20')).toBeInTheDocument();

    // 4. Start tournament -> ProjectionView displays Club Branding
    await user.click(view.getByRole('button', { name: /Generate tournament/i }));
    await user.click(await view.findByRole('button', { name: /Fixed Rounds/i }));
    await user.click(view.getByRole('button', { name: /Confirm & start tournament/i }));

    await user.click(await view.findByRole('button', { name: /Projection mode/i }));
    expect(view.getByText('Club Vecinos Caracas')).toBeInTheDocument();
    await user.click(view.getByRole('button', { name: /Exit projection/i }));

    // Finish tournament quickly (1 round? Wait: 20 players default fixed rounds -> simulate all rounds to reach Completed)
    // Complete all planned rounds until Completed screen appears
    for (let guard = 0; guard < 10; guard += 1) {
      await user.click(view.getByRole('button', { name: /Simulate results/i }));
      const finishBtn = view.queryByRole('button', { name: /Finish tournament/i });
      if (finishBtn) {
        await user.click(finishBtn);
        break;
      }
      await user.click(view.getByRole('button', { name: /Close round & advance/i }));
    }

    // 5. Completed screen -> Share WhatsApp Card (PNG) invokes shareChampionCard with Pro club branding
    const shareBtn = await view.findByRole('button', { name: /Share WhatsApp Card \(PNG\)/i });
    await user.click(shareBtn);
    expect(shareSpy).toHaveBeenCalledTimes(1);
    expect(shareSpy.mock.calls[0]?.[0].clubBranding?.clubName).toBe('Club Vecinos Caracas');
  }, 15000);

  it('gates WhatsApp PNG card on Free tier and supports clean license deactivation', async () => {
    const user = userEvent.setup();
    const kp = createTestKeypair();
    const service = createTestService('free-completed');

    const trn = await service.createDraft('Quick Completed Cup');
    await service.addParticipantsBulk(trn.id, 'A\nB\nC\nD');
    await service.updateConfig(trn.id, { format: 'rounds_all_play' }, 1);
    await service.confirmAndStartTournament(trn.id);
    await service.simulateCurrentRoundResults(trn.id);
    await service.completeRoundAndAdvance(trn.id);

    const view = render(
      <App
        service={service}
        runtimeLabel="Local browser storage"
        initialLocale="en"
        licensePublicKey={kp.publicKeyB64Url}
      />
    );

    await user.click(await view.findByRole('button', { name: /View summary/i }));
    await user.click(await view.findByRole('button', { name: /Share WhatsApp Card \(PNG\)/i }));

    const dialog = await view.findByRole('dialog');
    expect(within(dialog).getByText(/WhatsApp Champion Card PNG export is included in Pro/i)).toBeInTheDocument();

    // Activate then deactivate cleanly
    await user.type(within(dialog).getByLabelText(/Paste your signed Pro key/i), kp.signPro('Club Tester'));
    await user.click(within(dialog).getByRole('button', { name: /Activate Pro/i }));
    expect(
      await within(dialog).findByText(/Pro unlocked! Licensed to Club Tester/i)
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /Deactivate key/i }));
    expect(await within(dialog).findByLabelText(/Paste your signed Pro key/i)).toBeInTheDocument();
  });
});
