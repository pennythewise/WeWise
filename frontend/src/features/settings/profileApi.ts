import { useCallback, useEffect, useState } from 'react';

/**
 * Profile data the FastAPI backend owns: approved-memory preference and consent records. Identity, policy and claim counts
 * stay on the same scripted persona as Home, Policies and Claims, because the backend demo workspace holds a different
 * synthetic fixture (one Japan travel policy) that the pages would otherwise disagree with.
 */
export interface ProfileData {
  live: boolean;
  memoryEnabled?: boolean;
  consents: { id: string; purpose: string; granted: boolean; at: string }[];
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  const res = await fetch(`/api${path}`, { ...init, headers, credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : res.statusText);
  return data as T;
}

/** Same private synthetic workspace the chat uses: the httpOnly session cookie is shared, so this never creates a second one when chat already did. */
async function ensureSession(): Promise<void> {
  try { await call('/auth/me'); } catch { await call('/auth/demo', { method: 'POST' }); }
}

async function load(): Promise<ProfileData> {
  await ensureSession();
  const [prefs, consents] = await Promise.all([
    call<{ memory_enabled: boolean }>('/preferences'),
    call<{ consents: { id: string; purpose: string; granted: number; created_at: string }[] }>('/consents'),
  ]);
  return {
    live: true,
    memoryEnabled: prefs.memory_enabled,
    consents: consents.consents.map((c) => ({ id: c.id, purpose: c.purpose, granted: !!c.granted, at: c.created_at })),
  };
}

export function useProfileData() {
  const [data, setData] = useState<ProfileData>({ live: false, consents: [] });
  const refresh = useCallback(() => { load().then(setData).catch(() => setData({ live: false, consents: [] })); }, []);
  useEffect(refresh, [refresh]);

  /** Approved-memory switch: PATCH /preferences records the consent server-side; the optimistic value is rolled back on failure. */
  const setMemoryEnabled = async (v: boolean) => {
    setData((d) => ({ ...d, memoryEnabled: v }));
    try { await call('/preferences', { method: 'PATCH', body: JSON.stringify({ memory_enabled: v }) }); refresh(); }
    catch { setData((d) => ({ ...d, memoryEnabled: !v })); }
  };
  return { data, setMemoryEnabled };
}
