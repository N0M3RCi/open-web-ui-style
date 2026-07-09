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

import { proxyFetchGet } from '@/api/http';
import { useQuery } from '@tanstack/react-query';

export const modelQueryKeys = {
  platforms: ['models', 'platforms'] as const,
  models: (platform: string) => ['models', 'list', platform] as const,
};

/** Fetch available model platforms from the backend. */
export function useModelPlatforms() {
  return useQuery({
    queryKey: modelQueryKeys.platforms,
    queryFn: async () => {
      const res = await proxyFetchGet('/api/v1/models/platforms');
      return (res?.platforms || []) as string[];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes — platforms rarely change
    retry: 1,
  });
}

/** Fetch available models for a given platform. */
export function useModels(platform: string) {
  return useQuery({
    queryKey: modelQueryKeys.models(platform),
    queryFn: async () => {
      const res = await proxyFetchGet('/api/v1/models', {
        platform,
      });
      return (res?.models || []) as string[];
    },
    staleTime: 10 * 60 * 1000,
    retry: 1,
    enabled: !!platform,
  });
}
