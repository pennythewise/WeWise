import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, Link, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AppIcon, type IconName } from '@/components/AppIcon';
import logo from '@/assets/webank-logo.png';
import { api, errorText } from './api';
import { Home, PolicyPage, UploadPage, ClaimsPage, ClaimPage, EmergencyPage, BuyPage, MePage, SourcePage, CapturePage, VisualPage, AboutPage, ReportPage, IncidentLibraryPage } from './pages';
import ChatWorkspace from './ChatWorkspace';
import InspectorPanel from './InspectorPanel';
import './live.css';
import './workspace.css';

export type Locale = 'zh' | 'en';
export interface User { id: string; email: string; display_name: string }
interface AppContext {
  locale: Locale; t: (zh: string, en: string) => string; user: User | null; ready: boolean;
  health: any; refreshUser: () => Promise<void>; trace: any[]; setTrace: (trace: any[]) => void; openInspector: () => void;
  traceId: string | null; setTraceId: (id: string | null) => void;
}
const Context = createContext<AppContext>(null!);
export const useLive = () => useContext(Context);

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warning' | 'success' | 'error' }) {
  return <div className={`live-notice ${tone}`} role={tone === 'error' ? 'alert' : undefined}>{children}</div>;
}
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="live-field"><span>{label}</span>{children}</label>;
}
export function Section({ title, children, action }: { title?: string; children: ReactNode; action?: ReactNode }) {
  return <section className="live-card">{title ? <div className="live-section-title"><h2>{title}</h2>{action}</div> : null}{children}</section>;
}
export function Loading() { const { t } = useLive(); return <p role="status" className="live-muted">{t('正在读取…', 'Loading…')}</p>; }
export function ErrorBox({ error }: { error: string }) { return error ? <Notice tone="error">{error}</Notice> : null; }

export function RequireAccount({ children }: { children: ReactNode }) {
  const { user, ready, t } = useLive();
  if (!ready) return <Loading />;
  return user ? <>{children}</> : <Section title={t('登录你的私人空间', 'Your private workspace')}><p>{t('保单、理赔材料和记忆只属于你的账户。紧急帮助始终无需登录。', 'Policies, claim documents and memories belong to your account. Urgent help is always available without login.')}</p><div className="live-actions"><Link className="btn-primary" to="/me">{t('登录 / 注册', 'Sign in / register')}</Link><Link className="btn-secondary" to="/emergency">{t('立即获取帮助', 'Get urgent help')}</Link></div></Section>;
}

function Frame() {
  const [locale, setLocale] = useState<Locale>(() => { try { return localStorage.getItem('wewise.live.locale') === 'en' ? 'en' : 'zh'; } catch { return 'zh'; } });
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [health, setHealth] = useState<any>(null);
  const [healthError, setHealthError] = useState('');
  const [trace, setTrace] = useState<any[]>([]);
  const [traceId, setTraceId] = useState<string | null>(null);
  const [inspector, setInspector] = useState(false);
  const location = useLocation();
  const t = useCallback((zh: string, en: string) => locale === 'zh' ? zh : en, [locale]);
  const refreshUser = useCallback(async () => { try { const r = await api('/auth/me'); setUser(r.user); } catch { setUser(null); } finally { setReady(true); } }, []);
  useEffect(() => { void refreshUser(); void api('/health').then(setHealth).catch((e) => setHealthError(errorText(e))); }, [refreshUser]);
  useEffect(() => { document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en'; try { localStorage.setItem('wewise.live.locale', locale); } catch { /* optional preference */ } }, [locale]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [location.pathname]);
  useEffect(() => { setTrace([]); setTraceId(null); setInspector(false); }, [user?.id]);
  const navigation: { to: string; icon: IconName; zh: string; en: string }[] = [
    { to: '/', icon: 'home', zh: '首页', en: 'Home' },
    { to: '/ask', icon: 'chat', zh: '保障助手', en: 'Assistant' },
    { to: '/claims', icon: 'file', zh: '理赔', en: 'Claims' },
    { to: '/me', icon: 'user', zh: '我的', en: 'Me' },
  ];
  const active = (to: string) => to === '/' ? location.pathname === '/' || location.pathname.startsWith('/polic') || location.pathname === '/upload' : location.pathname.startsWith(to);
  return <Context.Provider value={{ locale, t, user, ready, health, refreshUser, trace, setTrace, traceId, setTraceId, openInspector: () => setInspector(true) }}>
    <div className="live-shell">
      <aside className="live-sidebar">
        <Link to="/" aria-label="WeWise home"><img src={logo} alt="WeBank 微众银行" className="live-logo" /></Link>
        <div className="live-brand"><strong>WeWise</strong><span>{t('让保障更清楚，让理赔少一点慌张', 'Clarity for your cover. Support for your claim.')}</span></div>
        <nav aria-label={t('主导航', 'Main navigation')}>{navigation.map(n => <NavLink key={n.to} to={n.to} end={n.to === '/'} className={active(n.to) ? 'selected' : ''}><AppIcon name={n.icon} /><span>{t(n.zh, n.en)}</span></NavLink>)}</nav>
        <div className="live-sidebar-extra"><Link to="/buy"><AppIcon name="umbrella" />{t('探索保障', 'Explore cover')}</Link><Link to="/incidents"><AppIcon name="file" />{t('事故指引', 'Incident guidance')}</Link><Link to="/reports"><AppIcon name="scan" />{t('报告核对', 'Report review')}</Link><Link to="/visual"><AppIcon name="shield" />{t('可选 3D 概览', 'Optional 3D view')}</Link><Link to="/capture"><AppIcon name="scan" />{t('拍摄证据', 'Capture evidence')}</Link><Link to="/about"><AppIcon name="info" />{t('能力与来源', 'Capabilities & sources')}</Link></div>
        <div className="live-sidebar-footer"><span>{t('独立黑客松项目 · WeBank 风格适配', 'Independent hackathon · WeBank-inspired')}</span><a href="/?mode=simulator">{t('打开预设引导模拟器 ↗', 'Open guided simulator ↗')}</a></div>
      </aside>
      <div className="live-body">
        <header className="live-topbar"><Link to="/" className="live-mobile-brand"><img src={logo} alt="WeBank 微众银行" /><strong>WeWise</strong></Link><span className="live-desktop-tag">{t('保险助手 · 中国保单 / 境外协助', 'Insurance assistant · China policies / overseas support')}</span><div className="live-top-actions"><div className="live-lang" role="group" aria-label="Language"><button onClick={() => setLocale('zh')} aria-pressed={locale === 'zh'}>中文</button><button onClick={() => setLocale('en')} aria-pressed={locale === 'en'}>EN</button></div><button className="live-icon-btn" aria-label={t('查看实际运行记录', 'Actual agent trace')} onClick={() => setInspector(!inspector)}><AppIcon name="info" /></button><Link className="live-urgent" to="/emergency"><AppIcon name="phone" size={18} />{t('紧急帮助', 'Urgent help')}</Link></div></header>
        <div className="live-demo-strip"><span className="live-dot" />{t('黑客松工作版本 · 仅使用合成个人资料；保险公司回执、进度与回拨均为模拟', 'Hackathon build · Synthetic personal data only; insurer receipts, timelines and callbacks are simulated')}</div>
        {healthError ? <div className="live-offline"><strong>{t('API 尚未连接', 'API unavailable')}</strong> — {t('请启动后端。应用不会静默切换到预设答案。', 'Start the backend. The app never silently switches to preset answers.')}<button className="live-text-button" onClick={()=>{void api('/health').then(r=>{setHealth(r);setHealthError('');void refreshUser();}).catch(e=>setHealthError(errorText(e)));}}>{t('重新连接','Reconnect')}</button><details><summary>{t('查看错误', 'Details')}</summary>{healthError}</details></div> : null}
        <main className="live-main" id="main"><Outlet /></main>
        <nav className="live-bottom-nav" aria-label={t('底部导航', 'Bottom navigation')}>{navigation.map(n => <NavLink key={n.to} to={n.to} end={n.to === '/'} className={active(n.to) ? 'selected' : ''}><AppIcon name={n.icon} size={24} /><span>{t(n.zh, n.en)}</span></NavLink>)}</nav>
      </div>
      {inspector ? <InspectorPanel onClose={() => setInspector(false)}/> : null}
    </div>
  </Context.Provider>;
}

export default function LiveApp() {
  return <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route element={<Frame />}>
    <Route index element={<Home />} /><Route path="policies" element={<Home />} /><Route path="policies/:id" element={<PolicyPage />} /><Route path="upload" element={<UploadPage />} /><Route path="ask" element={<ChatWorkspace />} /><Route path="claims" element={<ClaimsPage />} /><Route path="claims/:id" element={<ClaimPage />} /><Route path="emergency" element={<EmergencyPage />} /><Route path="buy" element={<BuyPage />} /><Route path="me" element={<MePage />} /><Route path="memory" element={<MePage />} /><Route path="documents/:id" element={<SourcePage />} /><Route path="capture" element={<CapturePage />} /><Route path="visual" element={<VisualPage />} /><Route path="reports" element={<ReportPage />} /><Route path="incidents" element={<IncidentLibraryPage />} /><Route path="about" element={<AboutPage />} /><Route path="*" element={<Home />} />
  </Route></Routes></BrowserRouter>;
}
