import { useEffect, useRef, useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { Badge, CardShell, Notice, type Tone } from '@/components/ui';
import { L } from '@/engine/l';
import { SIM_CONTRACT, SIM_NETWORK, SIM_PROOFS } from '@/engine/scenarios/chain';
import { useTx } from '@/i18n/useTx';
import { short } from '../cards/ChainProofCard';

type Verdict = 'verified' | 'verified_older_version' | 'tampered' | 'not_anchored' | 'no_proof';
interface FileCheck { path: string; status: 'ok' | 'changed' | 'missing' }
interface Result {
  verdict: Verdict; files?: FileCheck[]; unlisted?: string[]; computed_root?: string; network?: string; real_chain?: boolean;
  ledger?: { found: boolean; version: number; latest: number; block?: number; tx_hash?: string; anchored_at?: string }; detail?: string; sample?: boolean;
}
interface Status { mode: string; network?: string; contract?: string; height?: number; head?: string; integrity?: string; real_chain?: boolean; live: boolean }

const VERDICT: Record<Verdict, { tone: Tone; label: L; body: L }> = {
  verified: { tone: 'ok', label: L('Verified', '验证通过'), body: L('Every file matches the fingerprint anchored on-chain. Nothing was changed after export.', '每个文件都与链上存证的指纹一致，导出后未被改动。') },
  verified_older_version: { tone: 'warn', label: L('Verified, older version', '验证通过（旧版本）'), body: L('This package is genuine, but a newer version of the same claim package was exported later.', '此资料包真实，但同一理赔之后又导出了更新的版本。') },
  tampered: { tone: 'danger', label: L('Changed after export', '导出后被改动'), body: L('At least one file differs from what was fingerprinted, or a file was added or removed.', '至少有一个文件与存证指纹不一致，或文件被增删。') },
  not_anchored: { tone: 'danger', label: L('Not found on-chain', '链上未找到'), body: L('The files are self-consistent, but this fingerprint was never anchored. The proof may be forged.', '文件自洽，但该指纹从未上链，存证可能是伪造的。') },
  no_proof: { tone: 'neutral', label: L('No proof inside', '没有存证'), body: L('This archive has no proof.json, so WeWise did not anchor it.', '此压缩包中没有 proof.json，并非由微晓存证。') },
};

/** Sample S4 package so the check can be shown without a backend. Results are fixed for the demo. */
const SAMPLE_FILES = ['01-reviewed-summary.pdf', '02-manifest.json', 'originals/01-claim-form.pdf', 'originals/02-id-masked.jpg', 'originals/03-discharge-summary.pdf', 'originals/04-itemised-bill.pdf'];
const P = SIM_PROOFS.s4;
const sample = (tamper: boolean): Result => ({
  sample: true, verdict: tamper ? 'tampered' : 'verified', network: SIM_NETWORK, real_chain: false,
  files: SAMPLE_FILES.map((path) => ({ path, status: tamper && path.includes('itemised-bill') ? 'changed' : 'ok' })),
  computed_root: tamper ? 'e3b9a1f04c7d2e88b51f6a90c3d47e12f8a6b05d9c1e2f3a4b5c6d7e8f9a0b1c' : P.root,
  ledger: tamper ? { found: false, version: 0, latest: 1 } : { found: true, version: 1, latest: 1, block: P.block, tx_hash: P.tx, anchored_at: P.anchoredAt },
});
const SIM_STATUS: Status = { mode: 'simulation', network: SIM_NETWORK, contract: SIM_CONTRACT, height: 1304, head: '0x9f1c2e7a4b6d8f0a1c3e5b7d9f2a4c6e8b0d2f4a6c8e0b2d4f6a8c0e2b4d6f8a', integrity: 'intact', real_chain: false, live: false };

/** Public verification: anyone holding an exported package (an insurer, a judge) can check it was not changed. Nothing is stored. */
export function VerifyPage() {
  const { tx } = useTx();
  const t = (en: string, zh: string) => tx(L(en, zh));
  const [status, setStatus] = useState<Status>(SIM_STATUS);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/chain/status').then((r) => (r.ok ? r.json() : Promise.reject())).then((s) => setStatus({ ...s, live: true })).catch(() => setStatus(SIM_STATUS));
  }, []);

  const check = async (file: File) => {
    setBusy(true); setError(''); setResult(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/verify', { method: 'POST', body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : res.statusText);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t('The verifier is not reachable. Try the sample below.', '无法连接验证服务，请试试下面的示例。'));
    } finally {
      setBusy(false);
    }
  };

  const v = result ? VERDICT[result.verdict] : null;
  return (
    <div className="space-y-4" data-screen="verify">
      <CardShell>
        <div className="flex gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bluewash text-brand"><AppIcon name="shield" size={22} /></span>
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold text-ink">{t('Check a claim package', '验证理赔资料包')}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-body">{t('Drop a ZIP exported by WeWise. We recompute every file\'s fingerprint and compare it with the one anchored on-chain. You need no account, and the file is not stored.', '拖入微晓导出的 ZIP。我们会重新计算每个文件的指纹，并与链上存证比对。无需账号，文件不会被保存。')}</p>
          </div>
        </div>
        <label
          className="mt-4 flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-line bg-wash px-4 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void check(f); }}
        >
          <AppIcon name="file" size={24} />
          <span className="text-[14px] font-semibold text-ink">{busy ? t('Checking…', '验证中…') : t('Drop the ZIP here or tap to choose', '拖入 ZIP 或点击选择')}</span>
          <span className="text-xs text-muted">{t('Up to 16 MB', '最大 16 MB')}</span>
          <input ref={input} type="file" accept=".zip,application/zip" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void check(f); e.target.value = ''; }} />
        </label>
        <div className="mt-3 flex gap-2">
          <button type="button" className="btn-secondary btn-compact flex-1" onClick={() => setResult(sample(false))}>{t('Try the sample package', '试用示例资料包')}</button>
          <button type="button" className="btn-secondary btn-compact flex-1" onClick={() => setResult(sample(true))}>{t('Tamper with one file', '篡改一个文件')}</button>
        </div>
        {error && <div className="mt-3"><Notice tone="warn">{error}</Notice></div>}
      </CardShell>

      {result && v && (
        <CardShell title={tx(v.label)} icon={result.verdict.startsWith('verified') ? 'check' : 'lock'} tone={v.tone === 'danger' ? 'danger' : undefined}
          right={result.sample ? <Badge tone="warn" icon="info">{t('Sample', '示例')}</Badge> : <Badge tone={v.tone}>{tx(v.label)}</Badge>}>
          <p className="text-[13px] leading-relaxed text-body" role={v.tone === 'danger' ? 'alert' : 'status'}>{result.detail ?? tx(v.body)}</p>
          {result.files && (
            <ul className="mt-3 divide-y divide-cardline rounded-control border border-cardline">
              {result.files.map((f) => (
                <li key={f.path} className="flex items-center justify-between gap-2 px-3 py-2 text-[13px]">
                  <span className="min-w-0 truncate font-mono text-ink">{f.path}</span>
                  <Badge tone={f.status === 'ok' ? 'ok' : 'danger'}>{f.status === 'ok' ? t('Match', '一致') : f.status === 'changed' ? t('Changed', '已改动') : t('Missing', '缺失')}</Badge>
                </li>
              ))}
              {(result.unlisted ?? []).map((p) => (
                <li key={p} className="flex items-center justify-between gap-2 px-3 py-2 text-[13px]">
                  <span className="min-w-0 truncate font-mono text-ink">{p}</span><Badge tone="danger">{t('Added', '新增')}</Badge>
                </li>
              ))}
            </ul>
          )}
          {result.ledger && (
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
              <dt className="text-muted">{t('Network', '网络')}</dt><dd className="text-ink">{result.network}</dd>
              <dt className="text-muted">{t('Fingerprint', '指纹')}</dt><dd className="truncate font-mono text-ink" title={result.computed_root}>{short(result.computed_root ?? '')}</dd>
              {result.ledger.found && <><dt className="text-muted">{t('Block', '区块')}</dt><dd className="font-mono text-ink">#{result.ledger.block}</dd></>}
              {result.ledger.found && result.ledger.tx_hash && <><dt className="text-muted">{t('Transaction', '交易')}</dt><dd className="truncate font-mono text-ink" title={result.ledger.tx_hash}>{short(result.ledger.tx_hash)}</dd></>}
              {result.ledger.found && <><dt className="text-muted">{t('Anchored', '存证时间')}</dt><dd className="text-ink">{result.ledger.anchored_at}</dd></>}
              <dt className="text-muted">{t('Version', '版本')}</dt><dd className="text-ink">{result.ledger.found ? `${result.ledger.version} / ${result.ledger.latest}` : `— / ${result.ledger.latest}`}</dd>
            </dl>
          )}
          <p className="mt-3 text-xs text-muted">{t('This checks integrity only. It is not an insurer receipt, approval or payment.', '此处只验证完整性，不代表保险公司已受理、批准或付款。')}</p>
        </CardShell>
      )}

      <CardShell title={t('Ledger', '账本')} icon="lock" right={<Badge tone={status.integrity === 'broken' ? 'danger' : 'ok'}>{status.integrity === 'broken' ? t('Broken', '异常') : t('Healthy', '正常')}</Badge>}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
          <dt className="text-muted">{t('Network', '网络')}</dt><dd className="text-ink">{status.network ?? t('Off', '关闭')}</dd>
          {status.contract && <><dt className="text-muted">{t('Contract', '合约')}</dt><dd className="truncate font-mono text-ink" title={status.contract}>{short(status.contract, 8)}</dd></>}
          {status.height !== undefined && <><dt className="text-muted">{t('Height', '高度')}</dt><dd className="font-mono text-ink">#{status.height}</dd></>}
          {status.head && <><dt className="text-muted">{t('Head', '最新区块')}</dt><dd className="truncate font-mono text-ink" title={status.head}>{short(status.head)}</dd></>}
        </dl>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {!status.live && <Badge tone="warn" icon="info">{t('Simulation snapshot', '模拟快照')}</Badge>}
          {status.live && !status.real_chain && <Badge tone="warn" icon="info">{t('Local dev ledger', '本地开发账本')}</Badge>}
          {status.live && status.real_chain && <Badge tone="ok">{t('Live chain', '真实链')}</Badge>}
        </div>
        <ul className="mt-3 space-y-1 text-xs text-body">
          <li>✓ {t('On-chain: salted reference, SHA-256 Merkle root, kind, time', '链上：加盐引用、SHA-256 默克尔根、类型、时间')}</li>
          <li>✗ {t('Never on-chain: names, policy numbers, amounts, documents, contact details, money', '绝不上链：姓名、保单号、金额、文件、联系方式、资金')}</li>
        </ul>
      </CardShell>
    </div>
  );
}
