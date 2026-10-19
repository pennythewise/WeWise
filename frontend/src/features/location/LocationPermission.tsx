import { useState } from 'react';
import { L } from '@/engine/l';
import { AppIcon } from '@/components/AppIcon';
import { Notice } from '@/components/ui';
import { useTx } from '@/i18n/useTx';
import { cityById } from '@/mock/cities';
import { useLocationStore } from './locationStore';

/**
 * In-app explainer shown BEFORE the browser/OS location prompt (so the user knows why and can say no).
 * Calls `onDone` with the matched city id, or null if the user declined or location is unavailable.
 */
export function LocationPermission({ onDone, compact = false }: { onDone?: (cityId: string | null) => void; compact?: boolean }) {
  const { tx } = useTx();
  const { status, cityId, distanceKm, request, useDemo, decline } = useLocationStore();
  const [busy, setBusy] = useState(false);

  const allow = async () => { setBusy(true); const id = await request(); setBusy(false); onDone?.(id); };
  const demo = () => onDone?.(useDemo());
  const no = () => { decline(); onDone?.(null); };

  if ((status === 'granted' || status === 'demo') && cityId) {
    const c = cityById(cityId);
    return (
      <div className="flex items-center gap-3 rounded-input border border-cardline bg-white p-3" data-testid="location-known">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bluewash text-brand"><AppIcon name="home" size={18} /></span>
        <p className="min-w-0 flex-1 text-[13px] text-body">
          <span className="block font-semibold text-ink">{tx(c.name)}</span>
          {status === 'demo' ? tx(L('Demo location', '演示位置')) : distanceKm && distanceKm > 80 ? tx(L(`Nearest city we have data for (${distanceKm} km away)`, `最近的有数据城市（相距 ${distanceKm} 公里）`)) : tx(L('From your device location. Only the city is kept.', '来自设备定位，仅保留城市。'))}
        </p>
        {onDone && <button type="button" className="btn-primary btn-compact shrink-0" onClick={() => onDone(cityId)}>{tx(L('Use this', '使用'))}</button>}
        <button type="button" className="min-h-touch shrink-0 px-1 text-[13px] font-semibold text-primary" onClick={() => useLocationStore.getState().reset()}>{tx(L('Change', '更改'))}</button>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-secline bg-bluewash/60 p-4" data-testid="location-permission">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-brand ring-1 ring-secline"><AppIcon name="home" size={20} /></span>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-ink">{tx(L('Allow WeWise to use your location?', '允许微晓使用您的位置吗？'))}</p>
          {!compact && <p className="mt-1 text-[13px] leading-relaxed text-body">{tx(L('Your city tells me about local risks (typhoons, floods, dengue), your city\'s health scheme, and the right emergency numbers.', '通过您所在的城市，我可以了解当地风险（台风、洪水、登革热）、本市惠民保以及正确的紧急电话。'))}</p>}
        </div>
      </div>
      <ul className="mt-3 space-y-1 text-xs text-muted">
        <li className="flex gap-1.5"><AppIcon name="lock" size={14} />{tx(L('Only your city is kept. Exact coordinates are discarded on your device.', '只保留城市，精确坐标在设备上即被丢弃。'))}</li>
        <li className="flex gap-1.5"><AppIcon name="check" size={14} />{tx(L('Used once when you ask. You can change or remove it any time.', '仅在您提问时使用一次，可随时更改或删除。'))}</li>
      </ul>
      {status === 'denied' && <div className="mt-3"><Notice tone="warn">{tx(L('Location is off. To turn it on, allow location for this site in your browser settings, or use the demo city.', '位置权限已关闭。如需开启，请在浏览器设置中允许本站使用位置，或使用演示城市。'))}</Notice></div>}
      {status === 'unavailable' && <div className="mt-3"><Notice tone="warn">{tx(L('Your device could not find a location (location needs HTTPS or localhost). Try the demo city.', '设备无法获取位置（定位需要 HTTPS 或 localhost）。可先使用演示城市。'))}</Notice></div>}
      <div className="mt-3 grid gap-2">
        <button type="button" className="btn-primary w-full" disabled={busy || status === 'asking'} onClick={() => void allow()} data-testid="allow-location">
          <AppIcon name="home" size={18} />{busy || status === 'asking' ? tx(L('Waiting for your device…', '等待设备响应…')) : tx(L('Allow location', '允许使用位置'))}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn-secondary" onClick={demo} data-testid="demo-location">{tx(L('Use demo city', '使用演示城市'))}</button>
          <button type="button" className="btn-secondary" onClick={no}>{tx(L('Not now', '暂不'))}</button>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-muted">{tx(L('After you tap Allow, your browser or phone will also ask. That is the system permission.', '点击“允许”后，浏览器或手机还会弹出系统权限请求。'))}</p>
    </div>
  );
}
