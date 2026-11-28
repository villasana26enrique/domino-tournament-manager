import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Crown,
  Database,
  Download,
  Home,
  KeyRound,
  Lock,
  Unlock,
  X
} from 'lucide-react';
import type { MatchEndReason, TournamentConfig, TournamentPlan } from '../core/index.js';
import type { TournamentRecord } from '../application/ports/tournament-repository.js';
import type { TournamentService } from '../application/tournament-service.js';
import { I18nProvider, useI18n } from '../i18n/context.js';
import { localizeRuntimeLabel } from '../i18n/domain-labels.js';
import type { Locale } from '../i18n/locale.js';
import {
  createClubBrandingStore,
  type ClubBranding
} from '../infrastructure/club-branding-store.js';
import { FREE_MAX_PLAYERS } from '../infrastructure/commercial-config.js';
import {
  createLicenseStore,
  type LicenseState
} from '../infrastructure/license-store.js';
import { createOrganizerPinStore } from '../infrastructure/organizer-pin.js';
import { usePwaInstall } from './hooks/usePwaInstall.js';
import { BackupModal } from './components/BackupModal.js';
import { DeleteTournamentModal } from './components/DeleteTournamentModal.js';
import { DominoLogo } from './components/DominoLogo.js';
import { LeaveTournamentModal } from './components/LeaveTournamentModal.js';
import {
  OrganizerPinModal,
  type OrganizerPinModalMode
} from './components/OrganizerPinModal.js';
import {
  ProLicenseModal,
  type ProModalGateReason
} from './components/ProLicenseModal.js';
import { ActiveTournamentScreen } from './screens/ActiveTournamentScreen.js';
import { CompletedTournamentScreen } from './screens/CompletedTournamentScreen.js';
import { HomeScreen } from './screens/HomeScreen.js';
import { ModalitiesScreen } from './screens/ModalitiesScreen.js';
import { PreviewScreen } from './screens/PreviewScreen.js';
import { RegistrationScreen } from './screens/RegistrationScreen.js';

type Screen = 'home' | 'register' | 'preview' | 'active' | 'completed' | 'modalities';

export interface AppProps {
  service: TournamentService;
  runtimeLabel: string;
  initialLocale?: Locale;
  licensePublicKey?: string;
}

export function App({ service, runtimeLabel, initialLocale, licensePublicKey }: AppProps) {
  return (
    <I18nProvider {...(initialLocale ? { initialLocale } : {})}>
      <AppContent
        service={service}
        runtimeLabel={runtimeLabel}
        {...(licensePublicKey ? { licensePublicKey } : {})}
      />
    </I18nProvider>
  );
}

function AppContent({
  service,
  runtimeLabel,
  licensePublicKey
}: {
  service: TournamentService;
  runtimeLabel: string;
  licensePublicKey?: string;
}) {
  const { locale, setLocale, t } = useI18n();
  const { canInstall, promptInstall } = usePwaInstall();
  const [screen, setScreen] = useState<Screen>('home');
  const [tournaments, setTournaments] = useState<TournamentRecord[]>([]);
  const [current, setCurrent] = useState<TournamentRecord | null>(null);
  const [previewPlan, setPreviewPlan] = useState<TournamentPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingLeaveTarget, setPendingLeaveTarget] = useState<Screen | null>(null);
  const [pendingDeleteTournament, setPendingDeleteTournament] =
    useState<TournamentRecord | null>(null);
  const [backupModalOpen, setBackupModalOpen] = useState(false);

  const licenseStore = useMemo(() => createLicenseStore(undefined, licensePublicKey), [licensePublicKey]);
  const brandingStore = useMemo(() => createClubBrandingStore(), []);
  const [licenseState, setLicenseState] = useState<LicenseState>({ tier: 'free', license: null });
  const [clubBranding, setClubBranding] = useState<ClubBranding>(() => brandingStore.load());
  const [proModalState, setProModalState] = useState<{ reason?: ProModalGateReason } | null>(null);

  const isPro = licenseState.tier === 'pro';
  const effectiveBranding = isPro ? clubBranding : undefined;

  useEffect(() => {
    let active = true;
    void licenseStore.loadVerifiedLicense().then((state) => {
      if (active) setLicenseState(state);
    });
    return () => {
      active = false;
    };
  }, [licenseStore]);

  const openProModal = useCallback((reason?: ProModalGateReason) => {
    setProModalState(reason ? { reason } : {});
  }, []);

  const organizerPinStore = useMemo(() => createOrganizerPinStore(), []);
  const [hasOrganizerPin, setHasOrganizerPin] = useState(() => organizerPinStore.hasPin());
  const [organizerLocked, setOrganizerLocked] = useState(() => organizerPinStore.hasPin());
  const [pinModal, setPinModal] = useState<{
    mode: OrganizerPinModalMode;
    actionLabel?: string;
    onUnlocked?: () => void;
  } | null>(null);

  const requireOrganizerAction = useCallback(
    (actionLabel: string, action: () => void) => {
      if (!organizerLocked) {
        action();
        return;
      }
      setPinModal({
        mode: 'unlock',
        actionLabel,
        onUnlocked: action
      });
    },
    [organizerLocked]
  );

  const refreshList = useCallback(async () => {
    const items = await service.listTournaments();
    setTournaments(items);
  }, [service]);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  const currentRoundRunning = useMemo(() => {
    if (!current || current.status !== 'in_progress') return false;
    const round = current.rounds.find((r) => r.roundNumber === current.currentRoundNumber);
    return round?.timerStartedAtUtcMs !== null && round?.timerStartedAtUtcMs !== undefined;
  }, [current]);

  useEffect(() => {
    if (screen !== 'active' || !currentRoundRunning) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [screen, currentRoundRunning]);

  const liveStandings = useMemo(() => {
    if (!current) return [];
    return service.computeStandingsForRecord(current);
  }, [current, service]);

  async function runAction<T>(fn: () => Promise<T>): Promise<T | null> {
    setBusy(true);
    setErrorMessage(null);
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.app.unexpectedError;
      setErrorMessage(msg);
      return null;
    } finally {
      setBusy(false);
    }
  }

  function navigateWithGuard(target: Screen) {
    setErrorMessage(null);
    if (screen === 'active' && current?.status === 'in_progress') {
      setPendingLeaveTarget(target);
      return;
    }
    setScreen(target);
  }

  async function handleCreateTournament(name: string) {
    const created = await runAction(() => service.createDraft(name));
    if (!created) return;
    setCurrent(created);
    setPreviewPlan(null);
    await refreshList();
    setScreen('register');
  }

  function handleOpenTournament(record: TournamentRecord) {
    setErrorMessage(null);
    setCurrent(record);
    setPreviewPlan(null);
    if (record.status === 'completed') {
      setScreen('completed');
    } else if (record.status === 'in_progress') {
      setScreen('active');
    } else {
      setScreen('register');
    }
  }

  async function handleConfirmDeleteTournament() {
    if (!pendingDeleteTournament) return;
    const targetId = pendingDeleteTournament.id;
    await runAction(async () => {
      await service.deleteTournament(targetId);
      if (current?.id === targetId) {
        setCurrent(null);
        setPreviewPlan(null);
      }
      await refreshList();
      setPendingDeleteTournament(null);
    });
  }

  async function handleExportBackup() {
    return runAction(() => service.exportBackupPayload());
  }

  async function handleImportBackup(rawJson: string) {
    const summary = await service.importBackupPayload(rawJson);
    await refreshList();
    return summary;
  }

  async function handleAddParticipant(name: string) {
    if (!current) return;
    if (!isPro && current.participants.length >= FREE_MAX_PLAYERS) {
      openProModal('player_limit');
      return;
    }
    const updated = await runAction(() => service.addParticipant(current.id, name));
    if (updated) {
      setCurrent(updated);
      await refreshList();
    }
  }

  async function handleAddBulk(rawLines: string) {
    if (!current) return;
    const incomingCount = rawLines
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0).length;
    if (!isPro && current.participants.length + incomingCount > FREE_MAX_PLAYERS) {
      openProModal('player_limit');
      return;
    }
    const updated = await runAction(() => service.addParticipantsBulk(current.id, rawLines));
    if (updated) {
      setCurrent(updated);
      await refreshList();
    }
  }

  async function handleUpdateParticipant(participantId: string, newName: string) {
    if (!current) return;
    const updated = await runAction(() =>
      service.updateParticipantName(current.id, participantId, newName)
    );
    if (updated) {
      setCurrent(updated);
      await refreshList();
    }
  }

  async function handleRemoveParticipant(participantId: string) {
    if (!current) return;
    const updated = await runAction(() => service.removeParticipant(current.id, participantId));
    if (updated) {
      setCurrent(updated);
      await refreshList();
    }
  }

  async function handleGoToPreview() {
    if (!current) return;
    const plan = await runAction(() => service.previewTournament(current.id));
    if (plan) {
      setPreviewPlan(plan);
      setScreen('preview');
    }
  }

  async function handleUpdateConfig(
    patch: Partial<TournamentConfig>,
    overrideRounds?: number | null
  ) {
    if (!current) return;
    const result = await runAction(async () => {
      const updated = await service.updateConfig(current.id, patch, overrideRounds);
      const plan = await service.previewTournament(updated.id);
      return { updated, plan };
    });
    if (result) {
      setCurrent(result.updated);
      setPreviewPlan(result.plan);
      await refreshList();
    }
  }

  async function handleRegenerateSeed() {
    if (!current) return;
    const result = await runAction(async () => {
      const updated = await service.regenerateSeed(current.id);
      const plan = await service.previewTournament(updated.id);
      return { updated, plan };
    });
    if (result) {
      setCurrent(result.updated);
      setPreviewPlan(result.plan);
      await refreshList();
    }
  }

  async function handleConfirmAndStart() {
    if (!current) return;
    const started = await runAction(() => service.confirmAndStartTournament(current.id));
    if (started) {
      setCurrent(started);
      await refreshList();
      setScreen('active');
    }
  }

  async function handleStartRoundTimer() {
    if (!current) return;
    const updated = await runAction(() => service.startRoundTimer(current.id));
    if (updated) {
      setCurrent(updated);
      await refreshList();
    }
  }

  async function handlePauseRoundTimer() {
    if (!current) return;
    const updated = await runAction(() => service.pauseRoundTimer(current.id));
    if (updated) {
      setCurrent(updated);
      await refreshList();
    }
  }

  async function handleExpireRoundTimer() {
    if (!current) return;
    const updated = await runAction(() => service.expireRoundTimerNow(current.id));
    if (updated) {
      setCurrent(updated);
      await refreshList();
    }
  }

  const handleSyncRoundTimer = useCallback(async () => {
    if (!current || current.status !== 'in_progress') return null;
    const outcome = await service.syncRoundTimer(current.id);
    if (outcome.warningTriggered || outcome.expiredTriggered) {
      setCurrent(outcome.record);
      await refreshList();
    }
    return outcome;
  }, [current, refreshList, service]);

  async function handleRecordMatchResult(input: {
    matchId: string;
    pairAScore: number;
    pairBScore: number;
    endedBy: MatchEndReason;
    reason?: string;
  }) {
    if (!current) return;
    const updated = await runAction(() => service.recordMatchResult(current.id, input));
    if (updated) {
      setCurrent(updated);
      await refreshList();
    }
  }

  async function handleSimulateRoundResults() {
    if (!current) return;
    const updated = await runAction(() => service.simulateCurrentRoundResults(current.id));
    if (updated) {
      setCurrent(updated);
      await refreshList();
    }
  }

  async function handleCompleteRound() {
    if (!current) return;
    const updated = await runAction(() => service.completeRoundAndAdvance(current.id));
    if (updated) {
      setCurrent(updated);
      await refreshList();
      if (updated.status === 'completed') {
        setScreen('completed');
      }
    }
  }

  async function handleSubstitutePlayer(participantId: string, substituteName: string) {
    if (!current) return;
    const updated = await runAction(() =>
      service.substituteActivePlayer(current.id, participantId, substituteName)
    );
    if (updated) {
      setCurrent(updated);
      await refreshList();
    }
  }

  async function handleWithdrawPlayer(participantId: string) {
    if (!current) return;
    const updated = await runAction(() => service.withdrawActivePlayer(current.id, participantId));
    if (updated) {
      setCurrent(updated);
      await refreshList();
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      {/* Top Navigation */}
      <header className="no-print sticky top-0 z-20 border-b border-stone-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-1.5 px-2.5 py-2 sm:gap-4 sm:px-6 sm:py-3">
          <button
            type="button"
            onClick={() => navigateWithGuard('home')}
            aria-label={t.app.title}
            className="flex min-w-0 items-center gap-2 text-left sm:gap-3"
          >
            <DominoLogo className="h-8 w-8 shrink-0 sm:h-9 sm:w-9" />
            <div className="hidden min-w-0 md:block">
              <p className="truncate text-xs font-bold tracking-tight text-stone-900 sm:text-sm">
                {t.app.title}
              </p>
              <p className="truncate text-[10px] text-stone-500 sm:text-[11px]">
                {t.app.subtitle}
              </p>
            </div>
          </button>

          <nav className="flex min-w-0 shrink-0 items-center gap-1 sm:gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border border-stone-200 bg-stone-100 px-3 py-1 text-[11px] font-medium text-stone-600 lg:inline-flex">
              <Database className="h-3 w-3 text-emerald-700" />
              {localizeRuntimeLabel(runtimeLabel, locale)}
            </span>
            {canInstall && (
              <button
                type="button"
                onClick={() => void promptInstall()}
                aria-label={t.app.installApp}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-2 py-1.5 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-100 sm:px-3"
              >
                <Download className="h-3.5 w-3.5 text-emerald-700" />
                <span className="hidden md:inline">{t.app.installApp}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => navigateWithGuard('home')}
              aria-label={t.app.homeNav}
              className={`inline-flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-xs font-semibold transition sm:px-3 ${
                screen === 'home'
                  ? 'bg-emerald-900 text-white'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Home className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">{t.app.homeNav}</span>
            </button>
            <button
              type="button"
              onClick={() => navigateWithGuard('modalities')}
              aria-label={t.app.modalitiesNav}
              className={`inline-flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-xs font-semibold transition sm:px-3 ${
                screen === 'modalities'
                  ? 'bg-emerald-900 text-white'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">{t.app.modalitiesNav}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setPinModal({
                  mode: !hasOrganizerPin ? 'setup' : organizerLocked ? 'unlock' : 'manage'
                })
              }
              className={`inline-flex items-center gap-1 rounded-xl border px-2 py-1.5 text-xs font-semibold transition sm:gap-1.5 sm:px-3 ${
                !hasOrganizerPin
                  ? 'border-stone-300 bg-white text-stone-700 hover:bg-stone-100'
                  : organizerLocked
                    ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
              }`}
            >
              {!hasOrganizerPin ? (
                <>
                  <KeyRound className="h-3.5 w-3.5 shrink-0 text-stone-600" />
                  <span className="hidden sm:inline">{t.app.pinProtect}</span>
                  <span className="sm:hidden">{t.app.pinShort}</span>
                </>
              ) : organizerLocked ? (
                <>
                  <Lock className="h-3.5 w-3.5 shrink-0 text-amber-700" />
                  <span>{t.app.pinLocked}</span>
                </>
              ) : (
                <>
                  <Unlock className="h-3.5 w-3.5 shrink-0 text-emerald-700" />
                  <span>{t.app.pinUnlocked}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => openProModal()}
              aria-label={isPro ? t.app.proActive : t.app.getPro}
              className={`inline-flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-bold transition sm:gap-1.5 sm:px-3 ${
                isPro
                  ? 'border border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                  : 'bg-amber-400 text-stone-950 hover:bg-amber-300'
              }`}
            >
              <Crown className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">{isPro ? t.app.proActive : t.app.getPro}</span>
              <span className="sm:hidden">{t.app.proActive}</span>
            </button>

            <div
              role="group"
              aria-label="Language / Idioma"
              className="inline-flex rounded-xl border border-stone-200 bg-stone-100 p-0.5 text-[11px] font-bold"
            >
              {(['en', 'es'] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  aria-pressed={locale === code}
                  onClick={() => setLocale(code)}
                  className={`rounded-lg px-1.5 py-1 uppercase transition sm:px-2 ${
                    locale === code
                      ? 'bg-white text-emerald-900 shadow-xs'
                      : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  {code.toUpperCase()}
                </button>
              ))}
            </div>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-3 py-5 sm:px-6 sm:py-8">
        {errorMessage && (
          <div
            role="alert"
            className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              aria-label={t.app.closeAlert}
              className="rounded-lg p-1 hover:bg-rose-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {screen === 'home' && (
          <HomeScreen
            tournaments={tournaments}
            busy={busy}
            isPro={isPro}
            onCreateTournament={handleCreateTournament}
            onOpenTournament={handleOpenTournament}
            onRequestDeleteTournament={(item) =>
              requireOrganizerAction(
                locale === 'en' ? `delete "${item.name}"` : `eliminar "${item.name}"`,
                () => setPendingDeleteTournament(item)
              )
            }
            onOpenBackup={() => setBackupModalOpen(true)}
            onOpenModalities={() => setScreen('modalities')}
            onOpenProModal={(reason) => openProModal(reason)}
          />
        )}

        {screen === 'register' && current && (
          <RegistrationScreen
            tournament={current}
            busy={busy}
            isPro={isPro}
            onBackHome={() => setScreen('home')}
            onAddParticipant={handleAddParticipant}
            onAddBulk={handleAddBulk}
            onUpdateParticipant={handleUpdateParticipant}
            onRemoveParticipant={handleRemoveParticipant}
            onGoToPreview={handleGoToPreview}
            onOpenProModal={(reason) => openProModal(reason)}
          />
        )}

        {screen === 'preview' && current && previewPlan && (
          <PreviewScreen
            tournament={current}
            plan={previewPlan}
            busy={busy}
            isPro={isPro}
            {...(effectiveBranding ? { clubBranding: effectiveBranding } : {})}
            onEditParticipants={() => setScreen('register')}
            onUpdateConfig={handleUpdateConfig}
            onRegenerateSeed={handleRegenerateSeed}
            onConfirmAndStart={handleConfirmAndStart}
          />
        )}

        {screen === 'active' && current && (
          <ActiveTournamentScreen
            tournament={current}
            standings={liveStandings}
            busy={busy}
            isPro={isPro}
            {...(effectiveBranding ? { clubBranding: effectiveBranding } : {})}
            organizerLocked={organizerLocked}
            onRequireOrganizerAction={requireOrganizerAction}
            onRequestLeave={() => navigateWithGuard('home')}
            onStartRoundTimer={handleStartRoundTimer}
            onPauseRoundTimer={handlePauseRoundTimer}
            onExpireRoundTimer={handleExpireRoundTimer}
            onSyncRoundTimer={handleSyncRoundTimer}
            onRecordMatchResult={handleRecordMatchResult}
            onSimulateRoundResults={handleSimulateRoundResults}
            onCompleteRound={handleCompleteRound}
            onSubstitutePlayer={handleSubstitutePlayer}
            onWithdrawPlayer={handleWithdrawPlayer}
          />
        )}

        {screen === 'completed' && current && (
          <CompletedTournamentScreen
            tournament={current}
            standings={liveStandings}
            isPro={isPro}
            {...(effectiveBranding ? { clubBranding: effectiveBranding } : {})}
            onBackHome={() => setScreen('home')}
            onOpenProModal={(reason) => openProModal(reason)}
          />
        )}

        {screen === 'modalities' && <ModalitiesScreen onBackHome={() => setScreen('home')} />}
      </main>

      {pendingLeaveTarget && current && (
        <LeaveTournamentModal
          tournamentName={current.name}
          timerRunning={currentRoundRunning}
          onStay={() => setPendingLeaveTarget(null)}
          onConfirmLeave={() => {
            const target = pendingLeaveTarget;
            setPendingLeaveTarget(null);
            setScreen(target);
          }}
        />
      )}

      {pendingDeleteTournament && (
        <DeleteTournamentModal
          tournament={pendingDeleteTournament}
          busy={busy}
          onCancel={() => setPendingDeleteTournament(null)}
          onConfirmDelete={handleConfirmDeleteTournament}
        />
      )}

      {backupModalOpen && (
        <BackupModal
          busy={busy}
          tournamentCount={tournaments.length}
          onClose={() => setBackupModalOpen(false)}
          onExportBackup={handleExportBackup}
          onImportBackup={handleImportBackup}
        />
      )}

      {pinModal && (
        <OrganizerPinModal
          mode={pinModal.mode}
          {...(pinModal.actionLabel ? { actionDescription: pinModal.actionLabel } : {})}
          onClose={() => setPinModal(null)}
          onSetPin={(pin) => {
            organizerPinStore.setPin(pin);
            setHasOrganizerPin(true);
            setOrganizerLocked(true);
          }}
          onVerifyAndUnlock={(pin) => {
            const ok = organizerPinStore.verifyPin(pin);
            if (!ok) return false;
            setOrganizerLocked(false);
            const callback = pinModal.onUnlocked;
            if (callback) callback();
            return true;
          }}
          onLockNow={() => setOrganizerLocked(true)}
          onClearPin={(currentPin) => {
            const ok = organizerPinStore.clearPin(currentPin);
            if (!ok) return false;
            setHasOrganizerPin(false);
            setOrganizerLocked(false);
            return true;
          }}
        />
      )}
      {proModalState && (
        <ProLicenseModal
          isPro={isPro}
          license={licenseState.license}
          clubBranding={clubBranding}
          {...(proModalState.reason ? { reason: proModalState.reason } : {})}
          onClose={() => setProModalState(null)}
          onActivateLicense={async (rawKey) => {
            const res = await licenseStore.activateLicense(rawKey);
            if (res.valid) {
              setLicenseState({ tier: 'pro', license: res.license });
            }
            return res;
          }}
          onDeactivateLicense={() => {
            licenseStore.clearLicense();
            setLicenseState({ tier: 'free', license: null });
          }}
          onSaveClubBranding={(branding) => {
            const saved = brandingStore.save(branding);
            setClubBranding(saved);
          }}
        />
      )}
    </div>
  );
}
