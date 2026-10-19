export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await fetch(`/api${path}`, { ...init, headers, credentials: 'include' });
  const text = await response.text();
  let data: any;
  try { data = text ? JSON.parse(text) : {}; } catch { throw new ApiError(response.status, '服务器返回了无法读取的结果。请检查 API 服务。 / Invalid API response.'); }
  if (!response.ok) {
    const detail = data.detail ?? data.error ?? response.statusText;
    throw new ApiError(response.status, typeof detail === 'string' ? detail : JSON.stringify(detail));
  }
  return data as T;
}
export const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });
export const errorText = (e: unknown) => e instanceof Error ? e.message : String(e);
export interface Policy {
  id: string; document_id: string; title: string; insurer: string; policy_number: string;
  insured_name: string; start_date: string; end_date: string; family: string; confirmed: boolean;
  fields: Record<string, any>; revision: number;
  documents?: { id: string; name: string; kind: string; ocr_status?: string; page_count?: number }[];
}
export const policyValue = (p: Policy, key: string): string => {
  const value = p.fields?.[key] ?? p[key as keyof Policy];
  return Array.isArray(value) ? value.map(item => typeof item === 'object' && item ? item.name ?? JSON.stringify(item) : String(item)).join('\n') : value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
};
