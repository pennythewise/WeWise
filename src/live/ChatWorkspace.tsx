import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AppIcon } from '@/components/AppIcon';
import { api, errorText, json, type Policy } from './api';
import { ErrorBox, Field, Notice, RequireAccount, Section, useLive } from './LiveApp';
import { useVoice } from './voice';

type Message = { id?: string; role: string; text: string; result?: any; created_at?: string };
const textOf = (value: unknown): string => typeof value === 'string' ? value : '';
function messageOf(value: any): Message {
  let result = value.result ?? value.response;
  if (!result && typeof value.result_json === 'string') { try { result = JSON.parse(value.result_json); } catch { /* old record */ } }
  return { id: value.id, role: value.role, text: textOf(value.content) || textOf(value.text) || textOf(value.answer), result, created_at: value.created_at };
}

function Evidence({ citations }: { citations: any[] }) {
  const { t } = useLive();
  return <div className="workspace-evidence">{citations.map((c, i) => <details key={c.id ?? i}><summary>{t('条款出处', 'Source')} {i + 1} · p.{c.page} · {textOf(c.quote).slice(0, 90)}{textOf(c.quote).length > 90 ? '…' : ''}</summary><blockquote>{c.quote}</blockquote><Link to={`/documents/${encodeURIComponent(c.document_id)}?page=${c.page}`}>{t('核对原文页码', 'Review original page')} ↗</Link></details>)}</div>;
}

function ResultCard({ card }: { card: any }) {
  const { t } = useLive();
  const kind = card.type ?? card.kind;
  const data = card.data ?? card;
  const claimId = card.claim_id ?? data.claim_id ?? (kind?.includes('claim') || kind === 'tracker' ? data.id : null);
  const policyId = card.policy_id ?? data.policy_id;
  const safePath = typeof card.path === 'string' && /^\/(?:me|reports|incidents|buy|capture|claims(?:\/[a-zA-Z0-9_-]+)?|policies\/[a-zA-Z0-9_-]+)$/.test(card.path) ? card.path : null;
  const href = safePath ?? (kind === 'emergency' ? '/emergency' : kind === 'buying' || kind === 'comparison' ? '/buy' : claimId ? `/claims/${encodeURIComponent(claimId)}` : policyId ? `/policies/${encodeURIComponent(policyId)}` : kind === 'gap' || kind === 'coverage' ? '/' : kind === 'incident_library' ? '/incidents' : null);
  const title = card.title ?? ({ emergency: t('先获得紧急与人类帮助', 'Get urgent and human help'), buying: t('按需要比较保障', 'Compare cover against your needs'), comparison: t('保障比较', 'Cover comparison'), policy_review: t('核对保单资料', 'Review policy facts'), claim: t('理赔准备', 'Claim preparation'), claim_tracker: t('查看理赔进度', 'Track this case'), gap: t('保障观察', 'Coverage observations'), coverage: t('条款检查', 'Clause checks'), incident_library: t('按事故查下一步', 'Find incident guidance') } as Record<string, string>)[kind] ?? t('下一步', 'Next step');
  return <div className="workspace-result-card"><strong>{title}</strong>{card.description || card.detail ? <p>{card.description ?? card.detail}</p> : null}{data.notice ? <p>{data.notice}</p> : null}
    {Array.isArray(data.checklist) ? <ul>{data.checklist.slice(0, 8).map((item: any, i: number) => <li key={item.category ?? i}>{item.confirmed ? '✓' : '○'} {item.label ?? item.category} · {item.confirmed ? t('已核对', 'Reviewed') : t('需准备或核对', 'Needs review')}</li>)}</ul> : null}
    {Array.isArray(data.checks) ? <ul>{data.checks.slice(0, 6).map((item: any, i: number) => <li key={item.id ?? i}><strong>{item.label ?? item.id}</strong> · {item.detail ?? item.status}</li>)}</ul> : null}
    {Array.isArray(data.rows) ? <ul>{data.rows.slice(0, 8).map((item: any, i: number) => <li key={item.id ?? i}>{item.label ?? item.name ?? item.area} · {item.status} {item.reason ?? item.explanation ?? ''}</li>)}</ul> : null}
    {Array.isArray(data.products) ? <div className="workspace-mini-comparison">{data.products.slice(0, 3).map((p: any) => <div key={p.id}><strong>{p.name}</strong><p>{p.explanation ?? p.benefit_notes}</p><small>{p.quote_status ?? t('待核对正式计划和报价', 'Verify the issued plan and quote')}</small></div>)}</div> : null}
    {kind === 'workspace' ? <details><summary>{t('查看本次资料', 'Review these results')}</summary><pre className="workspace-json">{JSON.stringify(data, null, 2)}</pre></details> : null}
    {href ? <Link className="btn-secondary btn-compact" to={href}>{t('继续这个任务', 'Continue this task')} <AppIcon name="chevron" size={16}/></Link> : null}
  </div>;
}

export default function ChatWorkspace() {
  const { user, locale, t, health, setTrace, setTraceId, openInspector } = useLive();
  const [params] = useSearchParams();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [policy, setPolicy] = useState(params.get('policy') ?? '');
  const [claimId, setClaimId] = useState(params.get('claim') ?? '');
  const [conversationId, setConversationId] = useState<string | null>(params.get('conversation'));
  const [revision, setRevision] = useState<number | undefined>();
  const [conversations, setConversations] = useState<any[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [pending, setPending] = useState<any>(null);
  const [confirmed, setConfirmed] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const tail = useRef<HTMLDivElement>(null);
  const voice = useVoice(locale, text => setDraft(text));
  const refreshHistory = useCallback(async () => {
    if (!user) return;
    const r = await api('/conversations');
    setConversations(r.conversations ?? []);
  }, [user]);
  useEffect(() => {
    if (!user) return;
    let current = true;
    void Promise.all([api('/policies'), api('/conversations')]).then(([p, c]) => { if (current) { setPolicies(p.policies ?? []); setConversations(c.conversations ?? []); } }).catch(e => { if (current) setError(errorText(e)); });
    return () => { current = false; };
  }, [user]);
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => { tail.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [messages.length]);
  const loadConversation = async (id: string) => {
    if (busy) return;
    setError(''); voice.stop();
    try {
      const r = await api(`/conversations/${encodeURIComponent(id)}`);
      setConversationId(id); setRevision(r.revision ?? r.conversation?.revision);
      setMessages((r.messages ?? []).map(messageOf));
      setPolicy(r.state?.policy_id ?? r.policy_id ?? r.conversation?.policy_id ?? ''); setClaimId(r.state?.claim_id ?? '');
      setPending(r.pending_action ?? r.messages?.[r.messages.length - 1]?.result?.pending_action ?? null); setConfirmed(false);
      setTraceId(r.last_trace_id ?? r.turns?.[r.turns.length - 1]?.trace_id ?? null);
    } catch (e) { setError(errorText(e)); }
  };
  useEffect(() => { const id = params.get('conversation'); if (id && user) void loadConversation(id); }, [user?.id]);
  const applyResult = (r: any) => {
    setMessages(previous => [...previous, { role: 'assistant', text: r.answer ?? '', result: r }]);
    if (r.conversation_id) setConversationId(r.conversation_id);
    setRevision(r.conversation_revision ?? r.state?.revision);
    if (r.state?.policy_id ?? r.policy_id) setPolicy(r.state?.policy_id ?? r.policy_id);
    if (r.state?.claim_id) setClaimId(r.state.claim_id);
    if (r.trace_id) setTraceId(r.trace_id);
    if (Array.isArray(r.trace)) setTrace(r.trace);
    setPending(r.pending_action ?? null); setConfirmed(false);
  };
  const execute = async (text: string) => {
    if (!text.trim() || busy) return;
    setBusy(true); setError(''); setStage(t('理解你的需要', 'Understanding your request')); setTrace([]); setTraceId(null);
    setMessages(previous => [...previous, { role: 'user', text }]); setDraft('');
    const controller = new AbortController(); abort.current = controller;
    const events: any[] = [];
    let completed = false;
    try {
      const response = await fetch('/api/chat/stream', { ...json('POST', { message: text, policy_id: policy || null, claim_id: claimId || null, conversation_id: conversationId, ...(revision ? { expected_revision: revision } : {}), locale }), headers: { 'Content-Type': 'application/json' }, credentials: 'include', signal: controller.signal });
      if (!response.ok) {
        let detail = response.statusText;
        try { const body = await response.json(); detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail); } catch { /* retain status */ }
        throw new Error(detail);
      }
      if (!response.body) throw new Error(t('没有收到服务器数据流，请重试。', 'No server stream was returned. Please retry.'));
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
      const handle = (line: string) => {
        if (!line.trim()) return;
        const value = JSON.parse(line);
        if (value.type === 'error' || value.event === 'error') throw new Error(value.message ?? value.detail ?? t('任务未完成', 'Task did not finish'));
        if (value.type === 'result' || value.event === 'result' || value.answer !== undefined) { applyResult(value.result ?? value.data ?? value); completed = true; return; }
        const event = value.event && typeof value.event === 'object' ? value.event : value.data && typeof value.data === 'object' ? value.data : value;
        if (event.stage || event.tool || event.status) { events.push(event); setTrace([...events]); setStage(event.label ?? event.stage ?? event.tool); }
        if (value.trace_id ?? event.trace_id) setTraceId(value.trace_id ?? event.trace_id);
        if (value.conversation_id ?? event.conversation_id) setConversationId(value.conversation_id ?? event.conversation_id);
      };
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split('\n'); buffer = lines.pop() ?? '';
        for (const line of lines) handle(line);
        if (done) break;
      }
      if (buffer.trim()) handle(buffer);
      if (!completed) throw new Error(t('连接结束但任务没有完成。查看实际记录后重试；不要重复确认敏感操作。', 'The connection ended before completion. Review the trace before retrying an action.'));
      await refreshHistory();
    } catch (e) {
      setError(e instanceof DOMException && e.name === 'AbortError' ? t('已停止等待。已完成的服务器操作可能已保存，请先查看历史。', 'Stopped waiting. Completed server operations may be saved; review history first.') : errorText(e));
    } finally { setBusy(false); setStage(''); abort.current = null; }
  };
  const submit = (event: FormEvent) => { event.preventDefault(); void execute(draft.trim()); };
  const confirmAction = async () => {
    if (!pending?.token || !confirmed || busy) return;
    setBusy(true); setError('');
    try { const r = await api('/agent/actions/confirm', json('POST', { conversation_id: conversationId, token: pending.token, confirmed: true })); setPending(null); setConfirmed(false); setMessages(previous => [...previous, {role:'assistant',text:r.notice ?? t('准备包已生成，可在理赔中下载。','The package is ready to download in Claims.'), result:{cards:[{type:'claim',claim_id:pending.claim_id}]}}]); if(conversationId) {const history=await api(`/conversations/${conversationId}`);setRevision(history.revision);} await refreshHistory(); }
    catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  };
  const deleteHistory = async () => { if(!conversationId || busy || !window.confirm(t('删除此对话及执行记录？已保存文件和记忆不受影响。','Delete this conversation and its traces? Saved documents and memories remain separate.')))return; setBusy(true); try {await api(`/conversations/${conversationId}`,json('DELETE'));setConversationId(null);setRevision(undefined);setMessages([]);setPending(null);setTrace([]);setTraceId(null);await refreshHistory();} catch(e){setError(errorText(e));}finally{setBusy(false);}};
  const prompts = [t('我的门诊治疗需要什么材料？', 'What documents are needed for outpatient treatment?'), t('帮我查看理赔进度', 'Show my claim progress'), t('按我的需要比较保险', 'Compare insurance against my needs'), t('检查保障缺口', 'Check coverage gaps')];
  return <><div className="live-page-title"><div><span className="live-eyebrow">{t('清楚理解 · 安全行动', 'UNDERSTAND · PLAN · VERIFY')}</span><h1>{t('保障助手', 'Your insurance assistant')}</h1><p>{t('保留上下文，逐步完成任务。每个重要解释都可以核对出处。', 'Keep context and complete the next step. Review the evidence behind important explanations.')}</p></div><button className="btn-secondary btn-compact" onClick={openInspector}>{t('查看实际执行', 'Inspect execution')}</button></div><RequireAccount>
    <Section><div className="workspace-chat-controls"><Field label={t('保单上下文', 'Policy context')}><select value={policy} disabled={busy} onChange={e => { setPolicy(e.target.value); voice.stop(); }}><option value="">{t('需要时再选保单', 'Choose a policy when needed')}</option>{policies.map(p => <option value={p.id} key={p.id}>{p.title}{p.confirmed ? '' : t('（待核对）', ' (review needed)')}</option>)}</select></Field><Field label={t('我的对话历史', 'My conversation history')}><select value={conversationId ?? ''} disabled={busy} onChange={e => e.target.value && void loadConversation(e.target.value)}><option value="">{t('新对话', 'New conversation')}</option>{conversations.map(c => <option key={c.id} value={c.id}>{c.title ?? c.updated_at ?? c.id}</option>)}</select></Field><button className="btn-secondary btn-compact" disabled={busy} onClick={() => { setConversationId(null); setRevision(undefined); setMessages([]); setPending(null); setClaimId(''); setTrace([]); setTraceId(null); voice.stop(); }}>{t('开始新对话', 'New conversation')}</button>{conversationId ? <button className="live-text-button" disabled={busy} onClick={() => void deleteHistory()}>{t('删除此对话', 'Delete conversation')}</button> : null}</div><small className="live-muted">{health?.ai?.configured ? `${t('已配置模型', 'Configured model')}: ${health.ai.model}` : t('检索模式 · 有出处的摘录与规则流程，不伪装模型回答。', 'Retrieval mode · source extracts and rule-based workflows, without invented model calls.')}</small><p className="live-muted">{t('对话历史只属于当前账户；个人记忆仍须单独批准。可在“我的”管理数据。', 'History belongs to this account. Personal memory still needs separate approval. Manage your data in Me.')}</p></Section>
    <div className="workspace-chat" aria-live="polite">{messages.length ? messages.map((m, i) => <article className={`workspace-message ${m.role === 'user' ? 'user' : 'assistant'}`} key={m.id ?? i}><span className="live-message-role">{m.role === 'user' ? t('你', 'You') : 'WeWise'}</span>{m.result?.engine === 'retrieval_only' && m.result?.citations?.length ? <><p>{m.text.split('\n\n')[0]}</p><details><summary>{t('展开完整摘录与条件', 'Read full extracts and conditions')}</summary><p className="workspace-answer">{m.text}</p></details></> : <p className="workspace-answer">{m.text}</p>}
      {m.result?.citations?.length ? <Evidence citations={m.result.citations}/> : null}
      {m.result?.clarification?.type === 'select_policy' ? <div className="live-actions">{(m.result.clarification.options ?? []).map((p: any) => <button className="btn-secondary btn-compact" key={p.id} onClick={() => { setPolicy(p.id); setDraft(messages.slice(0, i).reverse().find(v => v.role === 'user')?.text ?? ''); }}>{t('使用', 'Use')}: {p.title}</button>)}</div> : null}
      {m.result?.clarification?.type === 'select_claim' ? <div className="live-actions">{(m.result.clarification.options ?? []).map((c: any) => <button className="btn-secondary btn-compact" key={c.id} disabled={busy} onClick={() => { setClaimId(c.id); setDraft(messages.slice(0, i).reverse().find(v => v.role === 'user')?.text ?? ''); }}>{t('使用这份理赔', 'Use this claim')}: {c.title}</button>)}</div> : null}
      {m.result?.clarification?.type === 'confirm_policy' && m.result.clarification.policy_id ? <Link className="btn-secondary btn-compact" to={`/policies/${m.result.clarification.policy_id}`}>{t('核对并确认保单', 'Review and confirm policy')}</Link> : null}
      {m.result?.cards?.length ? <div className="workspace-result-grid">{m.result.cards.map((card: any, j: number) => <ResultCard card={card} key={j}/>)}</div> : null}
      {m.result?.chips?.length ? <div className="live-chips">{m.result.chips.map((chip: any, j: number) => <button key={j} onClick={() => setDraft(typeof chip === 'string' ? chip : chip.text ?? chip.label)}>{typeof chip === 'string' ? chip : chip.label ?? chip.text}</button>)}</div> : null}
      {m.result?.trace_id ? <button className="live-text-button" onClick={() => { setTraceId(m.result.trace_id); openInspector(); }}>{t('查看本次执行与安全记录', 'Inspect this execution and safety checks')}</button> : null}
    </article>) : <div className="live-chat-welcome"><AppIcon name="chat" size={38}/><h2>{t('保障、材料与下一步，一起看清楚', 'Make cover, documents and next steps clear')}</h2><p>{t('你可以更正先前资料、追问或暂停操作。资料不够时，助手会保留不确定。', 'Correct earlier information, ask a follow-up or pause. Missing evidence stays uncertain.')}</p><div className="live-chips">{prompts.map(p => <button key={p} onClick={() => setDraft(p)}>{p}</button>)}</div></div>}{busy ? <div className="workspace-running" role="status"><span className="live-dot"/>{stage || t('正在处理', 'Working')}<button className="live-text-button" onClick={openInspector}>{t('查看步骤', 'View steps')}</button><button className="live-text-button" onClick={() => abort.current?.abort()}>{t('停止等待', 'Stop waiting')}</button></div> : null}<div ref={tail}/></div>
    {pending ? <Section title={t('确认这一次具体操作', 'Confirm this specific action')}><Notice tone="warning">{t('只批准下方已冻结的版本。修改资料后需要重新预览；不会向保险公司自动发送。', 'Approve only this frozen version. Changes require a new preview. No automatic insurer delivery.')}</Notice><p>{pending.summary ?? pending.action ?? pending.kind}</p><details><summary>{t('查看完整内容与接收方', 'Review payload and recipient')}</summary><pre className="workspace-json">{JSON.stringify(pending.payload ?? pending.snapshot ?? {}, null, 2)}</pre></details><label className="live-checkbox"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/><span>{t('我已核对本次操作、资料与接收方。', 'I reviewed the action, information and recipient.')}</span></label><button className="btn-primary" disabled={!confirmed || busy || !pending.token} onClick={() => void confirmAction()}>{t('确认这次操作', 'Confirm this action')}</button></Section> : null}
    <ErrorBox error={error}/><ErrorBox error={voice.error}/><form className="live-composer" onSubmit={submit}><textarea aria-label={t('输入问题或更正', 'Question or correction')} value={draft} onChange={e => setDraft(e.target.value)} rows={2} placeholder={t('例如：不，是我的旅行保单；帮我继续准备材料。', 'For example: No, I mean my travel policy. Continue preparing the documents.')}/><div className="live-actions"><button type="button" className="btn-secondary btn-compact" disabled={!voice.canListen || busy} onClick={voice.listening ? voice.stop : voice.listen}>{voice.listening ? t('停止聆听', 'Stop listening') : t('语音输入', 'Voice input')}</button><button type="button" className="btn-secondary btn-compact" disabled={!voice.canSpeak || !messages.some(m => m.role === 'assistant')} onClick={() => voice.speaking ? voice.stop() : voice.speak([...messages].reverse().find(m => m.role === 'assistant')?.text ?? '')}>{voice.speaking ? t('停止朗读', 'Stop audio') : t('朗读回复', 'Read reply')}</button><button className="btn-primary btn-compact" disabled={busy || !draft.trim()}>{t('发送', 'Send')}</button></div><small>{t('语音由浏览器提供，可能使用厂商服务。应用不保存原始音频；文字始终可用。', 'Speech uses browser capabilities and may use its provider. This app does not store raw audio. Text always works.')}</small></form>
  </RequireAccount></>;
}
