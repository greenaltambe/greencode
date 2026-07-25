import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./stores/authStore";
import Layout from "./components/layout/Layout";
import LandingPage from "./features/landing/LandingPage";
import LoginPage from "./features/auth/LoginPage";
import RegisterPage from "./features/auth/RegisterPage";
import VerifyEmailPage from "./features/auth/VerifyEmailPage";
import ProblemsPage from "./features/problems/pages/ProblemsPage";
import ProblemWorkspace from "./features/problems/pages/ProblemWorkspace";
import ProblemFormStepper from "./features/problems/pages/ProblemFormStepper";
import UserListsPage from "./features/userlist/pages/UserListsPage";
import UserListDetailsPage from "./features/userlist/pages/UserListDetailsPage";
import ReviewPage from "./features/userlist/pages/ReviewPage";
import StatsPage from "./features/stats/pages/StatsPage";

// Guard for authenticated users
const ProtectedRoute = ({ children }) => {
  const user = useAuthStore((state) => state.user);
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!user.isVerified) {
    return <Navigate to="/verify-email" replace />;
  }
  return children;
};

// Guard for admin-only pages
const AdminRoute = ({ children }) => {
  const user = useAuthStore((state) => state.user);
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!user.isVerified) {
    return <Navigate to="/verify-email" replace />;
  }
  if (user.role !== "admin") {
    return <Navigate to="/problems" replace />;
  }
  return children;
};

function App() {
  return (
    <Routes>
      {/* Public Pages */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />

      {/* App Workspace Pages inside AppShell Layout */}
      <Route
        path="/problems"
        element={
          <ProtectedRoute>
            <Layout>
              <ProblemsPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/problems/create"
        element={
          <AdminRoute>
            <Layout>
              <ProblemFormStepper mode="create" />
            </Layout>
          </AdminRoute>
        }
      />

      <Route
        path="/problems/:id/edit"
        element={
          <AdminRoute>
            <Layout>
              <ProblemFormStepper mode="edit" />
            </Layout>
          </AdminRoute>
        }
      />

      <Route
        path="/problems/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <ProblemWorkspace />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/userlists"
        element={
          <ProtectedRoute>
            <Layout>
              <UserListsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/stats"
        element={
          <ProtectedRoute>
            <Layout>
              <StatsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/userlists/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <UserListDetailsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/userlists/:id/review"
        element={
          <ProtectedRoute>
            <Layout>
              <ReviewPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Redirect all unmatched routes */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
