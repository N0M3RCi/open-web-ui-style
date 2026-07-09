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

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const LEGACY_DEFAULT_CLOUD_MODEL_ID = 'gpt-5.5';

export interface CloudModel {
  id: string;
  display_name: string;
  model_type: string;
  model_platform: string;
  provider_family: string;
  kind: 'chat' | 'image' | string;
  capabilities?: Record<string, unknown> | null;
  is_default?: boolean;
  sort_order?: number;
  min_plan_key?: string | null;
  min_app_version?: string | null;
  replaced_by_model_id?: string | null;
}

export interface RetiredCloudModel {
  id: string;
  replaced_by_model_id?: string | null;
}

export type CloudModelResolutionSource = 'selected' | 'replaced' | 'default';

export interface ResolvedCloudModel {
  model: CloudModel;
  source: CloudModelResolutionSource;
  requestedModelId?: string;
}

type CloudModelFetchStatus = 'idle' | 'loading' | 'ready' | 'error';
type CloudModelSource = 'server' | 'cache' | 'legacy';
const CLOUD_MODEL_STORAGE_VERSION = 3;
type PersistedCloudModelState = Pick<
  CloudModelState,
  | 'models'
  | 'retired'
  | 'defaultModelId'
  | 'version'
  | 'lastFetchedAt'
  | 'source'
>;

interface CloudModelState {
  models: CloudModel[];
  retired: RetiredCloudModel[];
  defaultModelId: string;
  version: string;
  lastFetchedAt: number;
  status: CloudModelFetchStatus;
  source: CloudModelSource;
  error: string | null;
  fetchCloudModels: (force?: boolean) => Promise<CloudModel[]>;
  resolveCloudModel: (modelId?: string | null) => ResolvedCloudModel | null;
  getModelDisplayName: (modelId?: string | null) => string;
  /**
   * Returns the id of the enabled chat model that a persisted selection
   * effectively maps to (selected as-is, or via `replaced_by_model_id`, or
   * the current default when truly orphaned). Use this for UI selection
   * comparisons so retired/replaced ids still show as "selected" in dropdowns.
   */
  getEffectiveModelId: (modelId?: string | null) => string | null;
}

function humanizeModelId(modelId?: string | null): string {
  if (!modelId) return '';
  return modelId
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizePersistedState(
  _persistedState: unknown
): PersistedCloudModelState {
  // Cloud models are disabled — always return empty.
  return {
    models: [],
    retired: [],
    defaultModelId: '',
    version: 'disabled',
    lastFetchedAt: 0,
    source: 'legacy',
  };
}

export const useCloudModelStore = create<CloudModelState>()(
  persist(
    (set, get) => ({
      models: [],
      retired: [],
      defaultModelId: '',
      version: 'disabled',
      lastFetchedAt: 0,
      status: 'idle',
      source: 'legacy',
      error: null,

      fetchCloudModels: async () => {
        // Cloud models are disabled — always return empty.
        return [];
      },

      resolveCloudModel: (modelId) => {
        const { models, retired, defaultModelId } = get();
        const requestedModelId =
          typeof modelId === 'string' && modelId.length > 0
            ? modelId
            : undefined;
        const selected = requestedModelId
          ? models.find((model) => model.id === requestedModelId)
          : undefined;
        if (selected) {
          return {
            model: selected,
            source: 'selected',
            requestedModelId,
          };
        }

        const retiredModel = requestedModelId
          ? retired.find((model) => model.id === requestedModelId)
          : undefined;
        const replacement = retiredModel?.replaced_by_model_id
          ? models.find(
              (model) => model.id === retiredModel.replaced_by_model_id
            )
          : undefined;
        if (replacement) {
          return {
            model: replacement,
            source: 'replaced',
            requestedModelId,
          };
        }

        const defaultModel =
          models.find((model) => model.id === defaultModelId) ||
          models.find((model) => model.is_default) ||
          models[0] ||
          null;
        return defaultModel
          ? {
              model: defaultModel,
              source: 'default',
              requestedModelId,
            }
          : null;
      },

      getModelDisplayName: (modelId) => {
        const resolved = get().resolveCloudModel(modelId);
        return resolved?.model.display_name || humanizeModelId(modelId);
      },

      getEffectiveModelId: (modelId) => {
        return get().resolveCloudModel(modelId)?.model.id ?? null;
      },
    }),
    {
      name: 'cloud-model-storage',
      version: CLOUD_MODEL_STORAGE_VERSION,
      migrate: (persistedState) => normalizePersistedState(persistedState),
      partialize: (state) => ({
        models: state.models,
        retired: state.retired,
        defaultModelId: state.defaultModelId,
        version: state.version,
        lastFetchedAt: state.lastFetchedAt,
        source: state.source,
      }),
    }
  )
);

export const getCloudModelStore = () => useCloudModelStore.getState();
