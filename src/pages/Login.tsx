// ========= Copyright 2025-2026 @ Eigent.ai All Rights Reserved. =========
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
// ========= Copyright 2025-2026 @ Eigent.ai All Rights Reserved. =========

import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/authStore';
import { useCallback, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { proxyFetchPost } from '@/api/http';
import WindowControls from '@/components/WindowControls';
import { useTranslation } from 'react-i18next';

import background from '@/assets/custom/background.png';
import eigentLogo from '@/assets/logo/eigent_icon.png';

export default function Login() {
  const {
    setAuth,
    setModelType,
    setLocalProxyValue,
    setInitState,
    setIsFirstLaunch,
  } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const titlebarRef = useRef<HTMLDivElement>(null);
  const redirectTo =
    new URLSearchParams(location.search).get('redirect') || '/';

  const getLoginErrorMessage = useCallback(
    (data: any) => {
      if (!data || typeof data !== 'object' || typeof data.code !== 'number') {
        return '';
      }

      if (data.code === 0) {
        return '';
      }

      if (data.code === 10) {
        return (
          data.text ||
          t('layout.login-failed-please-check-your-email-and-password')
        );
      }

      if (
        data.code === 1 &&
        Array.isArray(data.error) &&
        data.error.length > 0
      ) {
        const firstError = data.error[0];
        if (typeof firstError === 'string') {
          return firstError;
        }
        if (typeof firstError?.msg === 'string') {
          return firstError.msg;
        }
        if (typeof firstError?.message === 'string') {
          return firstError.message;
        }
      }

      return data.text || t('layout.login-failed-please-try-again');
    },
    [t]
  );

  // Auto login
  const handleAutoLogin = async () => {
    setGeneralError('');
    setIsLoading(true);
    try {
      const data = await proxyFetchPost('/api/v1/user/auto-login', {});

      const errorMessage = getLoginErrorMessage(data);
      if (errorMessage) {
        setGeneralError(errorMessage);
        return;
      }

      setAuth({ email: data.email, ...data });
      setLocalProxyValue(import.meta.env.VITE_USE_LOCAL_PROXY || null);
      setModelType('custom');
      setInitState('done');
      setIsFirstLaunch(false);
      navigate(redirectTo, { replace: true });
    } catch (error: any) {
      console.error('Auto login failed:', error);
      setGeneralError(t('layout.login-failed-please-try-again'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* Titlebar with drag region and window controls */}
      <div
        className="absolute left-0 right-0 top-0 z-50 flex !h-9 items-center justify-between py-1 pl-2"
        id="login-titlebar"
        ref={titlebarRef}
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div
          className="flex h-full flex-1 items-center"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <div className="h-10 flex-1"></div>
        </div>

        <div
          style={
            {
              WebkitAppRegion: 'no-drag',
              pointerEvents: 'auto',
            } as React.CSSProperties
          }
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <WindowControls />
        </div>
      </div>

      {/* Main content */}
      <div className="flex h-full items-center justify-center gap-2 px-1 pb-1 pt-10">
        <div
          className="flex h-full min-h-0 w-full flex-col items-center justify-center overflow-hidden rounded-2xl bg-ds-bg-neutral-subtle-default px-2 pb-2"
          style={{
            backgroundImage: `url(${background})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="relative flex w-80 flex-1 flex-col items-center justify-center pt-8">
            <img
              src={eigentLogo}
              className="absolute left-1/2 top-10 h-16 w-16 -translate-x-1/2"
            />
            <div className="mb-8 text-heading-lg font-bold text-ds-text-neutral-default-default">
              Eigent
            </div>
            {generalError && (
              <p className="mb-4 mt-1 text-label-md text-ds-text-status-error-strong-default">
                {generalError}
              </p>
            )}
            <Button
              onClick={handleAutoLogin}
              size="lg"
              variant="primary"
              className="w-full rounded-full"
              disabled={isLoading}
            >
              <span className="flex-1">
                {isLoading ? t('layout.logging-in') : 'Start Eigent'}
              </span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
