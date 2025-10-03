import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';

import AdminDashboard from './pages/admin/Dashboard';
import AdminInventory from './pages/admin/Inventory';
import AdminOrders from './pages/admin/Orders';
import AdminServices from './pages/admin/Services';
import AdminSettings from './pages/admin/Settings';
import AdminProductsPage from './pages/admin/Products';
import AdminManagers from './pages/admin/Managers';
import LoadingSpinner from './components/LoadingSpinner';

const PrivateRoute = ({ children, requireAdmin = false, requireManager = false, requireServices = false, requireAdminOrManager = false, requireAdminManagerOrServices = false }) => {
  const { isAuthenticated, isAdmin, isManager, isServices, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/login" replace />;
  }

  if (requireManager && !isManager) {
    return <Navigate to="/login" replace />;
  }

  if (requireServices && !isServices) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdminOrManager && !isAdmin && !isManager) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdminManagerOrServices && !isAdmin && !isManager && !isServices) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const App = () => {
  const { isAuthenticated, isAdmin, isManager, isServices, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  // Determine default route based on role
  const getDefaultRoute = () => {
    if (isAdmin) return "/dashboard";
    if (isManager) return "/admin/orders";
    if (isServices) return "/admin/services";
    return "/login";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        {/* Public routes */}
        <Route 
          path="/login" 
          element={isAuthenticated ? <Navigate to={getDefaultRoute()} replace /> : <Login />} 
        />


        {/* Protected routes */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute requireAdmin>
              <Layout>
                <AdminDashboard />
              </Layout>
            </PrivateRoute>
          }
        />

        {/* Admin and Manager routes */}
        <Route
          path="/admin/inventory"
          element={
            <PrivateRoute requireAdminOrManager>
              <Layout>
                <AdminInventory />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/products"
          element={
            <PrivateRoute requireAdminOrManager>
              <Layout>
                <AdminProductsPage />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/orders"
          element={
            <PrivateRoute requireAdminOrManager>
              <Layout>
                <AdminOrders />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/services"
          element={
            <PrivateRoute requireAdminManagerOrServices>
              <Layout>
                <AdminServices />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/managers"
          element={
            <PrivateRoute requireAdmin>
              <Layout>
                <AdminManagers />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <PrivateRoute requireAdmin>
              <Layout>
                <AdminSettings />
              </Layout>
            </PrivateRoute>
          }
        />

        {/* No client routes - admin only */}

        {/* Default redirect */}
        <Route 
          path="/" 
          element={<Navigate to={getDefaultRoute()} replace />} 
        />
        <Route 
          path="*" 
          element={<Navigate to={getDefaultRoute()} replace />} 
        />
      </Routes>
    </div>
  );
};

export default App; 