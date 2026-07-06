// ========= Copyright 2025-2026 @ M3RCI - UniMind All Rights Reserved. =========
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
// ========= Copyright 2025-2026 @ M3RCI - UniMind All Rights Reserved. =========

import { proxyFetchPost } from '@/api/http';
import { isDesktop } from '@/client/platform';
import { useAuthStore } from '@/store/authStore';
import { lazy, useEffect, useReducer, useRef } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';

import Layout from '@/components/Layout';
// Lazy load page components
const Login = lazy(() => import('@/pages/Login'));
const Signup = lazy(() => import('@/pages/SignUp'));
const Workspace = lazy(() => import('@/pages/Workspace'));
const History = lazy(() => import('@/pages/History'));
const NotFound = lazy(() => import('@/pages/NotFound'));
const RemoteControl = lazy(() => import('@/pages/RemoteControl'));
const AdminUsers = lazy(() => import('@/pages/AdminUsers'));

/**
 * Redirect /setting or /setting/:tab to /history?tab=settings
 * while preserving the sub-tab as a query param so the Settings
 * component can activate the correct tab.
 */
const SettingsRedirect = () => {
  const location = useLocation();
  const subtab =
    location.pathname.replace('/setting/', '').replace(/\/$/, '') || 'general';
  const base = '/history?tab=settings';
  const to = subtab !== 'general' ? `${base}&subtab=${subtab}` : base;
  return <Navigate to={to} replace />;
};

const IS_LOCAL_MODE = import.meta.env.VITE_USE_LOCAL_PROXY === 'true';
const ENABLE_DESKTOP_REMOTE_CONTROL_FALLBACK = isDesktop();

interface AuthState {
  loading: boolean;
  isAuthenticated: boolean;
  initialized: boolean;
}

type AuthAction =
  | { type: 'INITIALIZE'; payload: { isAuthenticated: boolean } }
  | { type: 'LOGOUT' };

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'INITIALIZE':
      return {
        loading: false,
        isAuthenticated: action.payload.isAuthenticated,
        initialized: true,
      };
    case 'LOGOUT':
      return {
        loading: false,
        isAuthenticated: false,
        initialized: true,
      };
    default:
      return state;
  }
};

// Route guard: Check if user is logged in
const ProtectedRoute = () => {
  const location = useLocation();
  const [state, dispatch] = useReducer(authReducer, {
    loading: false,
    isAuthenticated: false,
    initialized: false,
  });

  const {
    token,
    localProxyValue,
    logout,
    setAuth,
    setLocalProxyValue,
    setInitState,
    setIsFirstLaunch,
    setModelType,
  } = useAuthStore();
  const autoLoginAttempted = useRef(false);

  useEffect(() => {
    // Check VITE_USE_LOCAL_PROXY value on app startup
    if (token) {
      const currentProxyValue = import.meta.env.VITE_USE_LOCAL_PROXY || null;
      const storedProxyValue = localProxyValue;

      // If stored value exists and differs from current, logout
      if (storedProxyValue !== null && storedProxyValue !== currentProxyValue) {
        console.warn('VITE_USE_LOCAL_PROXY value changed, logging out user');
        logout();
        dispatch({ type: 'LOGOUT' });
        return;
      }
    }

    // Local mode: auto-login once on mount to get a fresh token,
    // even when a (possibly stale) token exists from a previous session.
    if (IS_LOCAL_MODE && !autoLoginAttempted.current) {
      autoLoginAttempted.current = true;
      proxyFetchPost('/api/v1/user/auto-login', {})
        .then((data) => {
          if (data && data.token) {
            setAuth({ email: data.email, ...data });
            setLocalProxyValue(import.meta.env.VITE_USE_LOCAL_PROXY || null);
            setModelType('custom');
            setInitState('done');
            setIsFirstLaunch(false);
            dispatch({
              type: 'INITIALIZE',
              payload: { isAuthenticated: true },
            });
          } else {
            dispatch({
              type: 'INITIALIZE',
              payload: { isAuthenticated: false },
            });
          }
        })
        .catch(() => {
          dispatch({
            type: 'INITIALIZE',
            payload: { isAuthenticated: false },
          });
        });
      return;
    }

    if (!IS_LOCAL_MODE) {
      dispatch({ type: 'INITIALIZE', payload: { isAuthenticated: !!token } });
    }
  }, [
    token,
    localProxyValue,
    logout,
    setAuth,
    setLocalProxyValue,
    setInitState,
    setIsFirstLaunch,
    setModelType,
  ]);

  if (state.loading || !state.initialized) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
      </div>
    );
  }
  if (state.isAuthenticated) {
    return <Outlet />;
  }

  const redirect = `${location.pathname}${location.search}`;
  return (
    <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />
  );
};

// Main route configuration
const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/signup" element={<Signup />} />
    {ENABLE_DESKTOP_REMOTE_CONTROL_FALLBACK ? (
      <Route path="/remote-control/:sessionId" element={<RemoteControl />} />
    ) : null}
    <Route element={<ProtectedRoute />}>
      <Route element={<Layout />}>
        <Route path="/" element={<Workspace />} />
        <Route path="/history" element={<History />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/setting" element={<SettingsRedirect />} />
        <Route path="/setting/*" element={<SettingsRedirect />} />
      </Route>
    </Route>
    <Route path="*" element={<NotFound />} />
  </Routes>
);

export default AppRoutes;
