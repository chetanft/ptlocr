import { FTProvider, MessageContainer, TooltipProvider } from "ft-design-system";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/auth/AuthContext";
import { RequireAuth, RequireRole } from "@/auth/ProtectedRoute";
import { getDefaultRouteForRole } from "@/auth/routeUtils";
import { Header } from "@/components/layout/Header";
import ConfigWorkspace from "./pages/ConfigWorkspace";
import ConfigList from "./pages/ConfigList";
import NotFound from "./pages/NotFound";
import PodUploadPage from "./pages/pod/PodUploadPage";
import PodReviewPage from "./pages/pod/PodReviewPage";
import EpodPage from "./pages/EpodPage";
import EpodUploadPage from "./pages/epod/EpodUploadPage";
import EpodSubmissionJobPage from "./pages/epod/EpodSubmissionJobPage";
import LoginPage from "./pages/LoginPage";

const queryClient = new QueryClient();

function AppShell() {
  return (
    <div className="min-h-screen bg-bg-secondary">
      <Header />
      <main>
        <Outlet />
      </main>
    </div>
  );
}

function HomeRedirect() {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={getDefaultRouteForRole(user.role)} replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <FTProvider theme="system">
        <MessageContainer>
          <TooltipProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/" element={<HomeRedirect />} />

                <Route element={<RequireAuth />}>
                  <Route element={<AppShell />}>
                    <Route element={<RequireRole role="Transporter" />}>
                      <Route path="/transporter/epod" element={<EpodPage />} />
                      <Route path="/transporter/epod/upload" element={<EpodUploadPage />} />
                      <Route path="/transporter/epod/jobs/:jobId" element={<EpodSubmissionJobPage />} />
                      <Route path="/transporter/epod/:id/review" element={<PodReviewPage />} />
                    </Route>

                    <Route element={<RequireRole role="Ops" />}>
                      <Route path="/ops/epod" element={<EpodPage />} />
                      <Route path="/ops/epod/upload" element={<EpodUploadPage />} />
                      <Route path="/ops/epod/jobs/:jobId" element={<EpodSubmissionJobPage />} />
                      <Route path="/ops/epod/:id/review" element={<PodReviewPage />} />
                    </Route>

                    <Route element={<RequireRole role="Reviewer" />}>
                      <Route path="/reviewer/epod" element={<EpodPage />} />
                      <Route path="/reviewer/epod/upload" element={<EpodUploadPage />} />
                      <Route path="/reviewer/epod/jobs/:jobId" element={<EpodSubmissionJobPage />} />
                      <Route path="/reviewer/epod/:id/review" element={<PodReviewPage />} />
                    </Route>

                    <Route path="/config" element={<ConfigWorkspace />} />
                    <Route path="/config-list" element={<ConfigList />} />
                    <Route path="/pod/upload" element={<PodUploadPage />} />
                  </Route>
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </MessageContainer>
      </FTProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
