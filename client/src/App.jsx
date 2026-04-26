// App root component - route structure per spec.md Section 4.
//
// Spec: docs/app/spec.md Section 4
// @implements REQ-NAV-001, REQ-NAV-002, REQ-NAV-003, REQ-NAV-005, REQ-NAV-007

import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import BoardView from './pages/BoardView';
import SearchView from './pages/SearchView';
import Friends from './pages/Friends';
import Settings from './pages/Settings';
import Explore from './pages/Explore';
import Join from './pages/Join';
import MemoryInvite from './pages/MemoryInvite';
import './App.css';

// Helper component to redirect /profile/:userId to /user/:userId with dynamic param
function ProfileRedirect() {
  const { userId } = useParams();
  return <Navigate to={`/user/${userId}`} replace />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes - kept as-is */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/join/:code" element={<Join />} />
          <Route path="/join" element={<Join />} />
          {/* Memory tag invite — claims an invite token minted via
              the MemoryDetail "Copy invite link" button. Bounces to
              /login first if the user isn't authenticated. */}
          <Route path="/m/:token" element={<MemoryInvite />} />

          {/* Protected routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <BoardView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/:userId"
            element={
              <ProtectedRoute>
                <BoardView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/:userId/past"
            element={
              <ProtectedRoute>
                <BoardView deepLinkTab="memory" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/:userId/future"
            element={
              <ProtectedRoute>
                <BoardView deepLinkTab="dream" />
              </ProtectedRoute>
            }
          />
          <Route path="/search" element={<Navigate to="/friends" replace />} />
          <Route
            path="/friends"
            element={
              <ProtectedRoute>
                <Friends />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />

          <Route
            path="/discover"
            element={<Explore />}
          />

          {/* Redirects for removed old routes */}
          <Route path="/travels" element={<Navigate to="/" replace />} />
          <Route path="/wishlist" element={<Navigate to="/" replace />} />
          <Route path="/lets-travel" element={<Navigate to="/" replace />} />
          {/* /discover is now a real page — no redirect needed */}
          <Route path="/trip-proposals" element={<Navigate to="/" replace />} />
          <Route path="/travel-profile" element={<Navigate to="/" replace />} />
          <Route path="/world-map" element={<Navigate to="/" replace />} />
          <Route path="/country/:countryCode" element={<Navigate to="/" replace />} />
          <Route path="/profile/:userId" element={<ProfileRedirect />} />
          <Route path="/profile" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
