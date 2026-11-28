import { useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Check,
  Crown,
  ImagePlus,
  KeyRound,
  Mail,
  ShieldCheck,
  Sparkles,
  Trash2,
  X
} from 'lucide-react';
import { useI18n } from '../../i18n/context.js';
import {
  DEFAULT_CLUB_BRANDING,
  fileToLogoDataUrl,
  type ClubBranding
} from '../../infrastructure/club-branding-store.js';
import { FREE_MAX_PLAYERS, PRO_PURCHASE_CONFIG } from '../../infrastructure/commercial-config.js';
import {
  type LicenseVerificationResult,
  type VerifiedProLicense
} from '../../infrastructure/license-store.js';

export type ProModalGateReason = 'player_limit' | 'branding' | 'share_card';

interface ProLicenseModalProps {
  isPro: boolean;
  license: VerifiedProLicense | null;
  clubBranding: ClubBranding;
  reason?: ProModalGateReason;
  onClose: () => void;
  onActivateLicense: (rawKey: string) => Promise<LicenseVerificationResult>;
  onDeactivateLicense: () => void;
  onSaveClubBranding: (branding: ClubBranding) => void;
}

export function ProLicenseModal({
  isPro,
  license,
  clubBranding,
  reason,
  onClose,
  onActivateLicense,
  onDeactivateLicense,
  onSaveClubBranding
}: ProLicenseModalProps) {
  const { locale, t } = useI18n();
  const [licenseInput, setLicenseInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [activationNotice, setActivationNotice] = useState<string | null>(null);

  const [clubName, setClubName] = useState(clubBranding.clubName);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(clubBranding.logoDataUrl);
  const [brandingError, setBrandingError] = useState<string | null>(null);
  const [brandingSavedNotice, setBrandingSavedNotice] = useState(false);

  const mailtoSubject = encodeURIComponent(
    locale === 'en'
      ? 'Domino Tournament Manager Pro Key Request ($10)'
      : 'Solicitud clave Pro Domino Tournament Manager ($10)'
  );
  const mailtoBody = encodeURIComponent(
    locale === 'en'
      ? 'Hi Enrique,\n\nI would like a Pro lifetime license key ($10).\nOrganizer / Club Name: \nPreferred payment method (USDC / Zelle / PayPal / Pago Móvil): '
      : 'Hola Enrique,\n\nQuiero solicitar una clave Pro de por vida ($10).\nNombre de Club u Organizador: \nMétodo de pago preferido (USDC / Zelle / PayPal / Pago Móvil): '
  );
  const contactHref =
    PRO_PURCHASE_CONFIG.whatsappUrl ||
    `mailto:${PRO_PURCHASE_CONFIG.contactEmail}?subject=${mailtoSubject}&body=${mailtoBody}`;

  async function handleActivate(e: FormEvent) {
    e.preventDefault();
    setActivationError(null);
    setActivationNotice(null);
    setVerifying(true);
    try {
      const result = await onActivateLicense(licenseInput);
      if (result.valid) {
        setLicenseInput('');
        setActivationNotice(t.proModal.activationSuccess(result.license.holder));
      } else {
        setActivationError(t.proModal.errors[result.reason]);
      }
    } finally {
      setVerifying(false);
    }
  }

  async function handleLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBrandingError(null);
    setBrandingSavedNotice(false);
    try {
      const dataUrl = await fileToLogoDataUrl(file);
      setLogoDataUrl(dataUrl);
    } catch (err) {
      setBrandingError(err instanceof Error ? err.message : t.app.unexpectedError);
    }
  }

  function handleSaveBranding(e: FormEvent) {
    e.preventDefault();
    setBrandingError(null);
    try {
      onSaveClubBranding({
        clubName,
        logoDataUrl
      });
      setBrandingSavedNotice(true);
    } catch (err) {
      setBrandingError(err instanceof Error ? err.message : t.app.unexpectedError);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pro-modal-title"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-950/60 p-3 backdrop-blur-xs sm:items-center sm:p-4"
    >
      <div className="my-auto max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-stone-200 bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <h2 id="pro-modal-title" className="text-lg font-bold text-stone-900">
                {isPro ? t.proModal.activeTitle : t.proModal.upgradeTitle}
              </h2>
              <p className="text-xs text-stone-500">
                {isPro ? t.proModal.subtitlePro : t.proModal.subtitleFree}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t.proModal.closeAria}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!isPro && reason && (
          <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-950">
            {reason === 'player_limit'
              ? t.proModal.gateReasons.player_limit(FREE_MAX_PLAYERS)
              : t.proModal.gateReasons[reason]}
          </div>
        )}

        {activationNotice && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-900">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-700" />
            <span>{activationNotice}</span>
          </div>
        )}

        {!isPro ? (
          <div className="mt-5 space-y-5">
            {/* Free vs Pro Comparison */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-stone-900">{t.proModal.freeHeading}</h3>
                  <span className="rounded-full bg-stone-200 px-2.5 py-0.5 text-xs font-bold text-stone-700">
                    {t.proModal.freeBadge}
                  </span>
                </div>
                <ul className="mt-3 space-y-1.5 text-xs text-stone-600">
                  {t.proModal.freeFeatures.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border-2 border-emerald-600 bg-emerald-50/70 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-1.5 text-sm font-bold text-emerald-950">
                    <Sparkles className="h-4 w-4 text-amber-600" />
                    {t.proModal.proHeading}
                  </h3>
                  <span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-extrabold text-stone-950">
                    {t.proModal.proBadge}
                  </span>
                </div>
                <ul className="mt-3 space-y-1.5 text-xs text-emerald-950">
                  {t.proModal.proFeatures.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Semi-manual purchase box */}
            <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
              <p className="text-xs font-bold text-stone-900">{t.proModal.requestKeyTitle}</p>
              <p className="mt-1 text-xs leading-relaxed text-stone-600">
                {t.proModal.requestKeyDesc}
              </p>
              <p className="mt-2 text-[11px] font-medium text-stone-700">
                <span className="font-semibold">{t.proModal.paymentMethodsLabel}</span>{' '}
                {PRO_PURCHASE_CONFIG.acceptedMethods[locale]}
              </p>
              {PRO_PURCHASE_CONFIG.usdcWalletNote && (
                <p className="mt-1 font-mono text-[11px] text-stone-600">
                  {PRO_PURCHASE_CONFIG.usdcWalletNote}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={contactHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2 text-xs font-bold text-stone-950 transition hover:bg-amber-300"
                >
                  <Mail className="h-3.5 w-3.5" />
                  {t.proModal.contactCta}
                </a>
                <span className="inline-flex items-center rounded-xl border border-stone-200 bg-white px-3 py-2 text-[11px] font-medium text-stone-600">
                  {PRO_PURCHASE_CONFIG.contactEmail}
                </span>
              </div>
            </div>

            {/* License activation form */}
            <form onSubmit={handleActivate} className="space-y-3 rounded-2xl border border-stone-200 p-4">
              <h3 className="flex items-center gap-1.5 text-xs font-bold text-stone-900">
                <KeyRound className="h-3.5 w-3.5 text-emerald-700" />
                {t.proModal.activateSectionTitle}
              </h3>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-stone-700">
                  {t.proModal.keyInputLabel}
                </span>
                <textarea
                  rows={2}
                  value={licenseInput}
                  onChange={(e) => {
                    setLicenseInput(e.target.value);
                    setActivationError(null);
                  }}
                  placeholder={t.proModal.keyPlaceholder}
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 font-mono text-xs text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </label>

              {activationError && (
                <p role="alert" className="text-xs font-medium text-rose-600">
                  {activationError}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-stone-300 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                >
                  {t.pinModal.cancel}
                </button>
                <button
                  type="submit"
                  disabled={verifying}
                  className="rounded-xl bg-emerald-800 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {verifying ? t.proModal.activatingButton : t.proModal.activateButton}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            {license && (
              <div className="flex flex-col justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center">
                <div className="space-y-1 text-xs text-emerald-950">
                  <p className="flex items-center gap-1.5 font-bold">
                    <ShieldCheck className="h-4 w-4 text-emerald-700" />
                    {t.proModal.activeBannerTitle}
                  </p>
                  <p>
                    <span className="font-semibold">{t.proModal.licensedTo}</span>{' '}
                    <span className="font-bold">{license.holder}</span>
                  </p>
                  <p className="text-[11px] text-emerald-900/80">
                    {t.proModal.licenseIdLabel} <span className="font-mono">{license.id}</span> ·{' '}
                    {t.proModal.issuedAtLabel} {license.issuedAt}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onDeactivateLicense}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t.proModal.deactivateButton}
                </button>
              </div>
            )}

            {/* Club Branding Form */}
            <form
              onSubmit={handleSaveBranding}
              className="space-y-3 rounded-2xl border border-stone-200 p-4"
            >
              <div>
                <h3 className="text-sm font-bold text-stone-900">
                  {t.proModal.brandingSectionTitle}
                </h3>
                <p className="mt-0.5 text-xs text-stone-500">{t.proModal.brandingDesc}</p>
              </div>

              <label className="block space-y-1">
                <span className="text-xs font-semibold text-stone-700">
                  {t.proModal.clubNameLabel}
                </span>
                <input
                  type="text"
                  maxLength={60}
                  value={clubName}
                  onChange={(e) => {
                    setClubName(e.target.value);
                    setBrandingSavedNotice(false);
                  }}
                  placeholder={t.proModal.clubNamePlaceholder}
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </label>

              <div className="space-y-1.5">
                <span className="block text-xs font-semibold text-stone-700">
                  {t.proModal.logoLabel}
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  {logoDataUrl && (
                    <img
                      src={logoDataUrl}
                      alt={clubName || 'Club logo'}
                      className="h-12 w-12 rounded-xl border border-stone-200 object-cover"
                    />
                  )}
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50">
                    <ImagePlus className="h-3.5 w-3.5 text-emerald-700" />
                    {t.proModal.chooseLogoButton}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={(e) => void handleLogoChange(e)}
                      className="sr-only"
                    />
                  </label>
                  {logoDataUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setLogoDataUrl(DEFAULT_CLUB_BRANDING.logoDataUrl);
                        setBrandingSavedNotice(false);
                      }}
                      className="rounded-xl border border-stone-200 px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50"
                    >
                      {t.proModal.removeLogoButton}
                    </button>
                  )}
                </div>
              </div>

              {brandingError && (
                <p role="alert" className="text-xs font-medium text-rose-600">
                  {brandingError}
                </p>
              )}

              {brandingSavedNotice && (
                <p className="text-xs font-semibold text-emerald-700">
                  {t.proModal.brandingSavedMessage}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-stone-300 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                >
                  {t.pinModal.close}
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-800 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  {t.proModal.saveBrandingButton}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
