import { BrowserRouter, Route, Routes } from 'react-router-dom';
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

// AppShell is the layout route; pages render inside PhoneFrame via <Outlet/>.
export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
    </BrowserRouter>
  );
}
