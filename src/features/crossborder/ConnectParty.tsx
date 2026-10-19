import { useEffect, useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { Badge } from '@/components/ui';
import { L } from '@/engine/l';
import { useTx } from '@/i18n/useTx';
import { useAgentStore } from '@/agentStore';
import { LOCAL, PARTIES, localFor, type PartyKind } from '@/mock/local';

const STEP_MS = 1600;

function Connected({ kind, country }: { kind: PartyKind; country: string }) {
  const { tx, lang } = useTx();
  const p = PARTIES[kind];
  const local = localFor(country).lang;
  const [n, setN] = useState(1);
  useEffect(() => {
    if (n >= p.steps.length) return;
    const id = setTimeout(() => setN((x) => x + 1), STEP_MS);
    return () => clearTimeout(id);
  }, [n, p.steps.length]);
  const done = n >= p.steps.length;
  const localText = p.reply.local[local as keyof typeof p.reply.local];

  return (
    <li className="rounded-input border border-cardline bg-white p-3" data-party={kind}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[14px] font-semibold text-ink">{tx(p.name)}</p>
        <Badge tone={done ? 'ok' : 'info'} icon={done ? 'check' : 'clock'}>{done ? tx(L('Connected', '已连接')) : tx(L('Connecting', '连接中'))}</Badge>
      </div>
      <ol className="mt-2 space-y-1.5" aria-live="polite">
        {p.steps.slice(0, n).map((s, i) => (
          <li key={i} className="flex gap-2 text-[13px] text-body animate-fade-in">
            <span className={`mt-0.5 shrink-0 ${i === n - 1 && !done ? 'text-primary' : 'text-ok'}`}><AppIcon name={i === n - 1 && !done ? 'clock' : 'check'} size={14} strokeWidth={2} /></span>
            {tx(s)}
          </li>
        ))}
      </ol>
      {n >= 3 && (
        <div className="mt-2 animate-fade-in rounded-input bg-wash p-2.5 text-[13px]">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{tx(L('Message from them, translated', '对方消息（已翻译）'))}</p>
          {localText && <p lang={local} className="mt-1 text-ink">{localText}</p>}
          <p className="mt-0.5 text-body">{lang === 'zh' ? p.reply.zh : p.reply.en}</p>
        </div>
      )}
    </li>
  );
}

/**
 * Connect the people involved with the insurer (PRD C6). The user chooses a party, sees exactly what will be shared
 * (masked), gives consent, and WeWise opens a shared case. The party gets a secure link in their own language.
 */
export function ConnectParty({ country }: { country: string }) {
  const { tx } = useTx();
  const [kind, setKind] = useState<PartyKind>('hospital');
  const [contact, setContact] = useState(PARTIES.hospital.contact);
  const [consent, setConsent] = useState(false);
  const [connected, setConnected] = useState<PartyKind[]>([]);
  const running = useAgentStore((s) => s.running);
  const p = PARTIES[kind];
  const local = LOCAL[localFor(country).lang];
  const already = connected.includes(kind);

  const pick = (k: PartyKind) => { setKind(k); setContact(PARTIES[k].contact); setConsent(false); };
  const invite = () => {
    setConnected((c) => [...c, kind]);
    setConsent(false);
    void useAgentStore.getState().runTurn('party.connect', kind);
  };

  return (
    <section className="rounded-card border border-cardline p-3" aria-label={tx(L('Connect the people involved', '连接相关方'))} data-testid="connect-party">
      <h4 className="text-[14px] font-semibold text-ink">{tx(L('Connect the people involved with your insurer', '让相关方直接对接您的保险公司'))}</h4>
      <p className="mt-0.5 text-xs text-muted">{tx(L('They get a secure link in their own language and talk to your insurer directly, so you don\'t have to translate or negotiate.', '对方会收到当地语言的安全链接，直接与您的保险公司沟通，您无需翻译或自行协商。'))}</p>

      <div className="mt-3 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={tx(L('Who to connect', '连接对象'))}>
        {(Object.keys(PARTIES) as PartyKind[]).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => pick(k)} className={`min-h-[44px] rounded-control border px-2 text-xs font-semibold ${kind === k ? 'border-primary bg-[#F4F7FF] text-primary' : 'border-cardline bg-white text-ink'}`}>
            {k === 'hospital' ? tx(L('Hospital', '医院')) : k === 'police' ? tx(L('Police', '警方')) : tx(L('Other driver', '对方司机'))}
          </button>
        ))}
      </div>

      {!already && (
        <div className="mt-3 space-y-2">
          <label className="block text-xs font-medium text-muted" htmlFor="party-contact">{tx(p.name)} · {tx(L('phone', '电话'))}</label>
          <input id="party-contact" value={contact} onChange={(e) => setContact(e.target.value)} className="min-h-[44px] w-full rounded-input border border-line px-3 text-[14px] text-ink" />
          <div className="rounded-input border border-cardline bg-surface p-2.5">
            <p className="text-xs font-semibold text-muted">{tx(L('What they will see', '对方可看到'))}</p>
            <ul className="mt-1 space-y-1 text-[13px] text-body">{p.shares.map((s, i) => <li key={i} className="flex gap-1.5"><span className="text-ok">✓</span>{tx(s)}</li>)}</ul>
            <p className="mt-1.5 text-xs text-muted">{tx(L(`Sent in ${local.label}. Your ID number, address and bank details are never shared.`, `以${local.label}发送。您的证件号、地址和银行信息绝不会被分享。`))}</p>
          </div>
          <label className="flex items-start gap-3 text-[13px] text-body">
            <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--wb-primary)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            {tx(L('I agree to share these items with this party and my insurer for this incident only.', '我同意仅就本次事故，向该方及我的保险公司分享以上信息。'))}
          </label>
          <button type="button" className="btn-primary w-full" disabled={!consent || !contact.trim() || running} onClick={invite}>
            <AppIcon name="user" size={18} />{tx(L('Send secure invite', '发送安全邀请'))}
          </button>
        </div>
      )}

      {connected.length > 0 && <ul className="mt-3 space-y-2">{connected.map((k) => <Connected key={k} kind={k} country={country} />)}</ul>}
    </section>
  );
}
