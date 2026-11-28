export const CLUB_BRANDING_STORAGE_KEY = 'dtm.club_branding.v1';
export const MAX_CLUB_NAME_LENGTH = 60;
export const MAX_LOGO_DATA_URL_LENGTH = 350_000;

export interface ClubBranding {
  clubName: string;
  logoDataUrl: string | null;
}

export const DEFAULT_CLUB_BRANDING: ClubBranding = {
  clubName: '',
  logoDataUrl: null
};

const VALID_LOGO_DATA_URL_RE = /^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/i;

function sanitizeBranding(input: ClubBranding): ClubBranding {
  const clubName = input.clubName.trim().slice(0, MAX_CLUB_NAME_LENGTH);
  let logoDataUrl: string | null = null;
  if (input.logoDataUrl !== null && input.logoDataUrl.trim().length > 0) {
    const trimmed = input.logoDataUrl.trim();
    if (!VALID_LOGO_DATA_URL_RE.test(trimmed)) {
      throw new Error('Invalid logo format. Use PNG, JPEG, WebP, or SVG.');
    }
    if (trimmed.length > MAX_LOGO_DATA_URL_LENGTH) {
      throw new Error('Logo exceeds the local size limit (approx. 250 KB).');
    }
    logoDataUrl = trimmed;
  }
  return { clubName, logoDataUrl };
}

function resolveDefaultStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export interface ClubBrandingStore {
  load: () => ClubBranding;
  save: (branding: ClubBranding) => ClubBranding;
  clear: () => void;
}

export function createClubBrandingStore(
  storage: Storage | null = resolveDefaultStorage()
): ClubBrandingStore {
  return {
    load(): ClubBranding {
      if (!storage) return DEFAULT_CLUB_BRANDING;
      const raw = storage.getItem(CLUB_BRANDING_STORAGE_KEY);
      if (!raw) return DEFAULT_CLUB_BRANDING;
      try {
        const parsed = JSON.parse(raw) as Partial<ClubBranding>;
        return sanitizeBranding({
          clubName: typeof parsed.clubName === 'string' ? parsed.clubName : '',
          logoDataUrl: typeof parsed.logoDataUrl === 'string' ? parsed.logoDataUrl : null
        });
      } catch {
        return DEFAULT_CLUB_BRANDING;
      }
    },

    save(branding: ClubBranding): ClubBranding {
      const sanitized = sanitizeBranding(branding);
      if (storage) {
        storage.setItem(CLUB_BRANDING_STORAGE_KEY, JSON.stringify(sanitized));
      }
      return sanitized;
    },

    clear(): void {
      if (!storage) return;
      storage.removeItem(CLUB_BRANDING_STORAGE_KEY);
    }
  };
}

export async function fileToLogoDataUrl(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp|svg\+xml)$/i.test(file.type)) {
    throw new Error('Invalid logo format. Use PNG, JPEG, WebP, or SVG.');
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected image file.'));
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Could not read the selected image file.'));
        return;
      }
      if (reader.result.length > MAX_LOGO_DATA_URL_LENGTH) {
        reject(new Error('Logo exceeds the local size limit (approx. 250 KB).'));
        return;
      }
      resolve(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
