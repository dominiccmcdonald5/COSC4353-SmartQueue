import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Import all pages
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import HomePage from './pages/HomePage';
import UserDashboard from './pages/UserDashboard';
import QueuePage from './pages/QueuePage';
import SeatingMapPage from './pages/SeatingMapPage';
import PaymentPage from './pages/PaymentPage';
import PurchasePassPage from './pages/PurchasePassPage';
import PassPurchasePage from './pages/PassPurchasePage';

import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
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
            
            <Route path="/queue/:concertId" element={
              <ProtectedRoute>
                <QueuePage />
              </ProtectedRoute>
            } />
            
            <Route path="/seating/:concertId" element={
              <ProtectedRoute>
                <SeatingMapPage />
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
            
            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/home" replace />} />
            
            {/* Catch all route */}
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
