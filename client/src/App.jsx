import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Home from './pages/Home';
import Room from './pages/Room';
import Auth from './pages/Auth';
import './App.css';

// Protected Route wrapper
function ProtectedRoute({ children }) {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <p>Verifying session...</p>
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/auth" replace />;
  }

  return children;
}

function AppContent() {
  const { token } = useAuth();

  return (
    <Routes>
      {/* Public auth route, redirect to home if already logged in */}
      <Route 
        path="/auth" 
        element={token ? <Navigate to="/" replace /> : <Auth />} 
      />
      
      {/* Protected routes */}
      <Route 
        path="/" 
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/room/:roomId" 
        element={
          <ProtectedRoute>
            <Room />
          </ProtectedRoute>
        } 
      />
      
      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#161b22',
              color: '#c9d1d9',
              border: '1px solid #30363d',
              borderRadius: '8px'
            }
          }}
        />
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
