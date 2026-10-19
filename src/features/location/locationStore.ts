import { create } from 'zustand';
import { DEMO_CITY, nearestCity } from '@/mock/cities';

/**
 * Location permission and the user's coarse city.
 * - 'unknown': the app has not asked yet. The in-app explainer is shown before the browser/OS prompt.
 * - 'granted': the device gave a position; only the nearest city is kept, the coordinates are dropped.
 * - 'demo': the user chose the demo city instead of sharing location.
 * - 'denied' / 'unavailable': the user said no, or the device could not provide a position.
 */
export type LocStatus = 'unknown' | 'asking' | 'granted' | 'demo' | 'denied' | 'unavailable';

interface LocState {
  status: LocStatus;
  cityId: string | null;
  distanceKm: number | null;
  request: () => Promise<string | null>;
  useDemo: () => string;
  decline: () => void;
  reset: () => void;
}

const KEY = 'wewise.location';
function load(): Pick<LocState, 'status' | 'cityId' | 'distanceKm'> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (v && typeof v.status === 'string') return { status: v.status, cityId: v.cityId ?? null, distanceKm: v.distanceKm ?? null };
  } catch { /* storage unavailable */ }
  return { status: 'unknown', cityId: null, distanceKm: null };
}
function save(s: Pick<LocState, 'status' | 'cityId' | 'distanceKm'>) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
}

export const useLocationStore = create<LocState>((set) => ({
  ...load(),
  request: () => new Promise((resolve) => {
    if (!('geolocation' in navigator)) { const s = { status: 'unavailable' as const, cityId: null, distanceKm: null }; set(s); save(s); resolve(null); return; }
    set({ status: 'asking' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { city, km } = nearestCity(pos.coords.latitude, pos.coords.longitude);
        const s = { status: 'granted' as const, cityId: city.id, distanceKm: Math.round(km) };
        set(s); save(s); resolve(city.id);
      },
      (err) => {
        const s = { status: (err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable') as LocStatus, cityId: null, distanceKm: null };
        set(s); save(s); resolve(null);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  }),
  useDemo: () => { const s = { status: 'demo' as const, cityId: DEMO_CITY, distanceKm: null }; set(s); save(s); return DEMO_CITY; },
  decline: () => { const s = { status: 'denied' as const, cityId: null, distanceKm: null }; set(s); save(s); },
  reset: () => { const s = { status: 'unknown' as const, cityId: null, distanceKm: null }; set(s); save(s); },
}));
