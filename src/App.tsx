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

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useHost } from '@/host';
import { debug } from '@/lib/debug';
import { persister, queryClient } from '@/lib/queryClient';
import AppRoutes from '@/routers/index';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useBackgroundTaskProcessor } from './hooks/useBackgroundTaskProcessor';
import { useExecutionSubscription } from './hooks/useExecutionSubscription';
import { useRemoteControlBridge } from './hooks/useRemoteControlBridge';
import { useTriggerTaskExecutor } from './hooks/useTriggerTaskExecutor';
import { useAuthStore } from './store/authStore';

function App() {
  const host = useHost();
  const navigate = useNavigate();
  const { token, initState, setInitState } = useAuthStore();

  // Subscribe to execution events when user is authenticated
  // Note: Removed triggers.length check to prevent reconnection on every trigger update
  const shouldSubscribe = !!token && initState === 'done';
  useExecutionSubscription(shouldSubscribe);
  useBackgroundTaskProcessor();

  // Execute triggered tasks automatically when WebSocket events are received
  useTriggerTaskExecutor();
  useRemoteControlBridge(token);

  useEffect(() => {
    const handleShareCode = (event: any, share_token: string) => {
      navigate({
        pathname: '/',
        search: `?share_token=${encodeURIComponent(share_token)}`,
      });
    };

    //  listen version update notification
    const handleUpdateNotification = (data: {
      type: string;
      currentVersion: string;
      previousVersion: string;
      reason: string;
    }) => {
      debug('receive version update notification:', data);

      if (data.type === 'version-update') {
        // handle version update logic
        debug(`version from ${data.previousVersion} to ${data.currentVersion}`);
        debug(`update reason: ${data.reason}`);
        setInitState('carousel');
      }
    };

    host?.ipcRenderer?.on('auth-share-token-received', handleShareCode);
    host?.electronAPI?.onUpdateNotification(handleUpdateNotification);

    return () => {
      host?.ipcRenderer?.off('auth-share-token-received', handleShareCode);
      host?.electronAPI?.removeAllListeners('update-notification');
    };
  }, [host, navigate, setInitState]);

  return (
    <ErrorBoundary>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister }}
      >
        <AppRoutes />
        <Toaster
          style={{ zIndex: 999999, position: 'fixed' }}
          position="bottom-right"
        />
      </PersistQueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
