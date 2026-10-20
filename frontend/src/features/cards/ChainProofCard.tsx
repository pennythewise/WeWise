import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, CardShell } from '@/components/ui';
import { L } from '@/engine/l';
import type { ChainProofKind, Txt } from '@/engine/types';
import { useTx } from '@/i18n/useTx';

interface Props { proofKind: ChainProofKind; network: string; contract: string; block: number; txHash: string; root: string; anchoredAt: string; title: Txt; items: Txt[]; simulated?: boolean }

const KIND: Record<ChainProofKind, L> = {
  claim_package: L('Claim package', '理赔材料包'),
  consent: L('Consent record', '授权记录'),
  audit_batch: L('Agent audit seal', '智能体审计封存'),
};

export const short = (h: string, n = 10) => (h.length > n * 2 ? `${h.slice(0, n)}…${h.slice(-6)}` : h);

/** A tamper-evident proof: what was fingerprinted, where it is anchored, and the promise that only hashes are on-chain. */
export function ChainProofCard({ proofKind, network, contract, block, txHash, root, anchoredAt, title, items, simulated }: Props) {
  const { tx } = useTx();
  const [open, setOpen] = useState(false);
  const t = (en: string, zh: string) => tx(L(en, zh));
  return (
    <CardShell title={tx(title)} icon="shield" right={<Badge tone="ok" icon="check">{t('Anchored', '已存证')}</Badge>}>
      <div className="flex flex-wrap gap-1.5">
        <Badge tone="info" icon={false}>{tx(KIND[proofKind])}</Badge>
        <Badge tone="neutral" icon={false}>{network}</Badge>
        {simulated && <Badge tone="warn" icon="info">{t('Simulation', '模拟演示')}</Badge>}
      </div>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
        <dt className="text-muted">{t('Block', '区块')}</dt><dd className="font-mono text-ink">#{block}</dd>
        <dt className="text-muted">{t('Transaction', '交易')}</dt><dd className="truncate font-mono text-ink" title={txHash}>{short(txHash)}</dd>
        <dt className="text-muted">{t('Fingerprint', '指纹')}</dt><dd className="truncate font-mono text-ink" title={root}>{short(root)}</dd>
        <dt className="text-muted">{t('Time', '时间')}</dt><dd className="text-ink">{anchoredAt}</dd>
      </dl>
      <p className="mt-3 rounded-control bg-wash px-3 py-2 text-xs leading-relaxed text-body">
        {t('Only a salted reference and a SHA-256 fingerprint are on-chain. No names, policy numbers, amounts or files, and no money moves.', '链上只有加盐引用和 SHA-256 指纹，没有姓名、保单号、金额或文件，也不涉及任何资金。')}
      </p>
      <button type="button" className="mt-2 min-h-touch text-[13px] font-semibold text-primary" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? t('Hide what was fingerprinted', '收起存证内容') : t(`What was fingerprinted (${items.length})`, `存证内容（${items.length}）`)}
      </button>
      {open && (
        <ul className="space-y-1 text-[13px] text-body">
          {items.map((it, i) => <li key={i} className="flex gap-2"><span className="text-ok">✓</span>{tx(it)}</li>)}
          <li className="pt-1 text-xs text-muted">{t('Contract', '合约')} <span className="font-mono">{short(contract, 8)}</span></li>
        </ul>
      )}
      {proofKind === 'claim_package' && (
        <Link to="/verify" className="btn-secondary btn-compact mt-3 w-full">{t('Verify a package', '验证资料包')}</Link>
      )}
    </CardShell>
  );
}
