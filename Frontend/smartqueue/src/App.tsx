import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { NotificationBanner } from './components/ui/NotificationBanner';
import ProtectedRoute from './components/ProtectedRoute';
import { useQueueNotificationMonitor } from './hooks/useQueueNotificationMonitor';

// Import all pages
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import HomePage from './pages/HomePage';
import UserDashboard from './pages/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';
import QueuePage from './pages/QueuePage';
import SeatingMapPage from './pages/SeatingMapPage';
import PaymentPage from './pages/PaymentPage';
import PurchasePassPage from './pages/PurchasePassPage';
import PassPurchasePage from './pages/PassPurchasePage';
import MailboxPage from './pages/MailboxPage';

import './App.css';

/** Forces seating page to remount when concertId changes so the correct concert is shown */
function SeatingMapKeyed() {
  const { concertId } = useParams();
  return <SeatingMapPage key={concertId} />;
}

/** Wrapper to remount NotificationBanner on each page navigation */
function NotificationBannerWithLocationKey() {
  const location = useLocation();
  return <NotificationBanner key={location.pathname} />;
}

/** Inner app wrapper that uses the queue notification monitor hook */
function AppContent() {
  useQueueNotificationMonitor();

  return (
    <Router>
      <NotificationBannerWithLocationKey />
      <div className="App">
        <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignUpPage />} />
            
            {/* Protected routes - require authentication */}
            <Route path="/home" element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            } />
            
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <UserDashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/admin" element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/queue/:concertId" element={
              <ProtectedRoute>
                <QueuePage />
              </ProtectedRoute>
            } />
            
            <Route path="/seating/:concertId" element={
              <ProtectedRoute>
                <SeatingMapKeyed />
              </ProtectedRoute>
            } />
            
            <Route path="/payment/:concertId" element={
              <ProtectedRoute>
                <PaymentPage />
              </ProtectedRoute>
            } />
            
            <Route path="/purchase-pass" element={
              <ProtectedRoute>
                <PurchasePassPage />
              </ProtectedRoute>
            } />
            
            <Route path="/purchase-pass/checkout" element={
              <ProtectedRoute>
                <PassPurchasePage />
              </ProtectedRoute>
            } />

            <Route path="/mailbox" element={
              <ProtectedRoute>
                <MailboxPage />
              </ProtectedRoute>
            } />
            
            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/home" replace />} />
            
            {/* Catch all route */}
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </div>
      </Router>
    );
}

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
