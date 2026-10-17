import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './AppShell';
import { PortfolioHome } from '@/features/home/PortfolioHome';
import { PolicyList } from '@/features/policies/PolicyList';
import { PolicyDetail } from '@/features/policies/PolicyDetail';
import { ClaimsList } from '@/features/claims/ClaimsList';
import { ClaimDetail } from '@/features/claims/ClaimDetail';
import { ChatView } from '@/features/chat/ChatView';
import { MemoryPage } from '@/features/settings/MemoryPage';
import { CaptureEvidence } from '@/features/capture/CaptureEvidence';
import { About } from '@/features/settings/About';

/** Keep preset routes explicit after Link/useNavigate and on a later reload. */
function SimulatorModeGuard({children}:{children:ReactNode}) {
  const location=useLocation();
  const params=new URLSearchParams(location.search);
  if(params.get('mode')!=='simulator') {
    params.set('mode','simulator');
    return <Navigate replace state={location.state} to={{pathname:location.pathname,search:`?${params.toString()}`,hash:location.hash}}/>;
  }
  return <>{children}</>;
}

// AppShell is the layout route; pages render inside PhoneFrame via <Outlet/>.
export default function App() {
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100dvh',minWidth:0}}>
    <aside aria-label="Simulation mode notice" style={{display:'flex',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:'8px 16px',padding:'10px 16px',flexShrink:0,background:'var(--wb-ink, #1D2943)',color:'white',position:'relative',zIndex:30}}>
      <p style={{margin:0,fontSize:13,lineHeight:1.7,flex:'1 1 220px'}}>引导模拟器 · 此模式全部办理结果与对话均为预设演示<br/><span lang="en">Guided simulator · preset conversations and transactions</span></p>
      <a href="/" style={{display:'inline-flex',alignItems:'center',justifyContent:'center',minHeight:44,padding:'8px 16px',borderRadius:8,background:'white',color:'var(--wb-ink, #1D2943)',fontSize:13,fontWeight:600,whiteSpace:'nowrap',textDecoration:'none',flexShrink:0}}>返回真实功能 / Real features</a>
    </aside>
    <div className="simulator-viewport" style={{flex:1,minHeight:0,minWidth:0}}>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <SimulatorModeGuard>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<PortfolioHome />} />
          <Route path="/policies" element={<PolicyList />} />
          <Route path="/policies/:id" element={<PolicyDetail />} />
          <Route path="/claims" element={<ClaimsList />} />
          <Route path="/claims/:id" element={<ClaimDetail />} />
          <Route path="/ask" element={<ChatView />} />
          <Route path="/memory" element={<MemoryPage />} />
          <Route path="/capture" element={<CaptureEvidence />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<PortfolioHome />} />
        </Route>
      </Routes>
      </SimulatorModeGuard>
    </BrowserRouter></div></div>
  );
}
