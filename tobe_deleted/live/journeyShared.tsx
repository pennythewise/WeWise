import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api, errorText } from './api';
import { useLive } from './LiveApp';
import './journeys.css';

export function useResource<T = any>(path: string, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(enabled);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion(v => v + 1), []);
  useEffect(() => {
    let active = true;
    if (!enabled) { setData(null); setLoading(false); return; }
    setLoading(true); setError('');
    void api<T>(path).then(result => { if (active) setData(result); }).catch(e => { if (active) setError(errorText(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [path, enabled, version]);
  return { data, error, loading, reload };
}

export function useMutation() {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const run = async (fn: () => Promise<void>) => { if (busy) return; setBusy(true); setError(''); try { await fn(); } catch (e) { setError(errorText(e)); } finally { setBusy(false); } };
  return { busy, error, run };
}

export function DetailText({ value }: { value: unknown }) {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number') return <>{value}</>;
  if (Array.isArray(value)) return <ul className="journey-bullets">{value.map((item, i) => <li key={i}><DetailText value={item} /></li>)}</ul>;
  return <dl className="live-facts">{Object.entries(value as Record<string, unknown>).filter(([, val]) => val != null && val !== '').map(([key, val]) => <div className="live-fact-pair" key={key}><dt>{key.replace(/_/g, ' ')}</dt><dd><DetailText value={val} /></dd></div>)}</dl>;
}

export function JourneyTitle({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="live-page-title"><div><h1>{title}</h1>{children ? <p>{children}</p> : null}</div></div>;
}

export const FAMILIES: Record<string, [string, string]> = { medical: ['医疗险', 'Medical'], critical_illness: ['重疾险', 'Critical illness'], accident: ['意外险', 'Accident'], life: ['寿险', 'Life'], motor: ['车险', 'Motor'], travel: ['旅行险', 'Travel'], home: ['家庭财产险', 'Home'], savings: ['储蓄 / 年金', 'Savings / annuity'], sme: ['企业险', 'Business'] };
export function FamilySelect({ value, onChange, all = false }: { value: string; onChange: (v: string) => void; all?: boolean }) { const { t } = useLive(); return <select value={value} onChange={e => onChange(e.target.value)}>{all ? <option value="">{t('全部类别', 'All families')}</option> : null}{Object.entries(FAMILIES).map(([id, names]) => <option key={id} value={id}>{t(...names)}</option>)}</select>; }
