import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { probeBackend } from '@/store';
import { AppShell } from './AppShell';
import { PortfolioHome } from '@/features/home/PortfolioHome';
import { PolicyList } from '@/features/policies/PolicyList';
import { PolicyDetail } from '@/features/policies/PolicyDetail';
import { ClaimsList } from '@/features/claims/ClaimsList';
import { ClaimDetail } from '@/features/claims/ClaimDetail';
import { ChatView } from '@/features/chat/ChatView';
import { MemoryPage } from '@/features/settings/MemoryPage';
import { ProfilePage } from '@/features/settings/ProfilePage';
import { CaptureEvidence } from '@/features/capture/CaptureEvidence';
import { About } from '@/features/settings/About';
import { UploadPage } from '@/features/settings/UploadSheet';
import { EmergencyCall } from '@/features/settings/EmergencyCall';
import { SwitchCheck } from '@/features/switch/SwitchCheck';
import { ShopHome } from '@/features/shop/ShopHome';
import { ShopCategory } from '@/features/shop/ShopCategory';
import { ShopProduct } from '@/features/shop/ShopProduct';
import { ShopCheckout } from '@/features/shop/ShopCheckout';
import { CoverageCheck } from '@/features/home/CoverageCheck';
import { VerifyPage } from '@/features/verify/VerifyPage';

// AppShell is the layout route; pages render inside PhoneFrame via <Outlet/>.
export default function App() {
  useEffect(() => { void probeBackend(); }, []);
  return (
    <div className="simulator-root">
      <div className="simulator-viewport">
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<PortfolioHome />} />
              <Route path="/shop" element={<ShopHome />} />
              <Route path="/shop/c/:type" element={<ShopCategory />} />
              <Route path="/shop/p/:id" element={<ShopProduct />} />
              <Route path="/shop/checkout/:id" element={<ShopCheckout />} />
              <Route path="/policies" element={<PolicyList />} />
              <Route path="/policies/:id" element={<PolicyDetail />} />
              <Route path="/claims" element={<ClaimsList />} />
              <Route path="/claims/:id" element={<ClaimDetail />} />
              <Route path="/ask" element={<ChatView />} />
              <Route path="/memory" element={<MemoryPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/capture" element={<CaptureEvidence />} />
              <Route path="/about" element={<About />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/emergency" element={<EmergencyCall />} />
              <Route path="/coverage-check" element={<CoverageCheck />} />
              <Route path="/switch-check" element={<SwitchCheck />} />
              <Route path="/verify" element={<VerifyPage />} />
              <Route path="*" element={<PortfolioHome />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </div>
    </div>
  );
}
