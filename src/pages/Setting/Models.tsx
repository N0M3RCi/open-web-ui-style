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

import { proxyFetchGet, proxyFetchPost, proxyFetchPut } from '@/api/http';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { INIT_PROVODERS } from '@/lib/llm';
import { fetchProviderModels } from '@/lib/providerModels';
import { useAuthStore } from '@/store/authStore';
import type { Provider } from '@/types';
import {
  Check,
  Eye,
  EyeOff,
  Key,
  Loader2,
  RefreshCw,
  Server,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

const DEFAULT_PROVIDERS = INIT_PROVODERS.filter(
  (p) => p.id !== 'openai-compatible-model'
);

const CUSTOM_PROVIDER: Provider = {
  id: 'openai-compatible-model',
  name: 'OpenAI Compatible',
  apiKey: '',
  apiHost: '',
  description: 'Custom OpenAI-compatible API endpoint.',
  hostPlaceHolder: 'e.g. https://cloud-api.near.ai/v1',
  is_valid: false,
  model_type: '',
};

type ModelInfo = { id: string };

/** Basic URL validation: accept http/https with a host. */
function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Try to fetch models using the backend proxy endpoint, fall back to
 * direct browser fetch, and finally allow manual model name entry.
 */
async function tryFetchModels(
  apiHost: string,
  apiKey: string
): Promise<{ models: ModelInfo[]; method: 'proxy' | 'direct' | 'none' }> {
  const baseHost = apiHost.replace(/\/+$/, '');
  const modelsUrl = `${baseHost}/models`;

  // 1) Try backend proxy (works in production, avoids CORS)
  try {
    const payload = await proxyFetchGet(
      `/api/v1/providers/models/fetch?url=${encodeURIComponent(modelsUrl)}&api_key=${encodeURIComponent(apiKey)}`
    );
    const list: ModelInfo[] = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload)
        ? payload
        : [];
    if (list.length > 0) return { models: list, method: 'proxy' };
  } catch {
    // proxy failed — fall through
  }

  // 2) Direct browser fetch (works for CORS-enabled APIs)
  try {
    const groups = await fetchProviderModels(apiHost, '/models', apiKey);
    const list = groups.flatMap((g) => g.models);
    if (list.length > 0) return { models: list, method: 'direct' };
  } catch {
    // direct fetch also failed
  }

  return { models: [], method: 'none' };
}

export default function Models() {
  const { t } = useTranslation();

  // Provider selection
  const [selectedProviderId, setSelectedProviderId] = useState(
    DEFAULT_PROVIDERS[0]?.id || 'openai'
  );
  const [isCustom, setIsCustom] = useState(false);
  const [providers, setProviders] = useState<any[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);

  // Provider form fields
  const [apiKey, setApiKey] = useState('');
  const [apiHost, setApiHost] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  // Model fetching
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');

  // Saving
  const [saving, setSaving] = useState(false);

  const currentProvider = useMemo(() => {
    if (isCustom) return CUSTOM_PROVIDER;
    return (
      providers.find((p) => p.id === selectedProviderId) ||
      DEFAULT_PROVIDERS.find((p) => p.id === selectedProviderId)
    );
  }, [isCustom, selectedProviderId, providers]);

  // Load existing provider configs from backend
  const loadProviders = useCallback(async () => {
    setLoadingProviders(true);
    try {
      const res = await proxyFetchGet('/api/v1/providers');
      const list = Array.isArray(res) ? res : res.items || [];
      setProviders(list);

      // Find existing configs and pre-fill if any saved provider exists
      const saved = list.find((p: any) => p.api_key);
      if (saved) {
        const matched = DEFAULT_PROVIDERS.find(
          (dp) => dp.id === saved.provider_name
        );
        if (matched) {
          setSelectedProviderId(matched.id);
          setIsCustom(false);
        } else {
          setIsCustom(true);
          setSelectedProviderId('');
        }
        setApiKey(saved.api_key || '');
        setApiHost(saved.endpoint_url || '');
      }
    } catch (err: any) {
      toast.error(
        err?.message ||
          t('setting.failed-to-load-providers') ||
          'Failed to load provider configuration'
      );
    } finally {
      setLoadingProviders(false);
    }
  }, [t]);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  // When provider changes, update form fields
  const handleProviderChange = useCallback(
    (value: string) => {
      if (value === 'custom') {
        setIsCustom(true);
        setSelectedProviderId('');
        setApiKey('');
        setApiHost('');
        setModels([]);
        setSelectedModel('');
        return;
      }
      setIsCustom(false);
      setSelectedProviderId(value);
      setModels([]);
      setSelectedModel('');

      // Look up saved config for this provider
      const saved = providers.find((p) => p.provider_name === value);
      if (saved) {
        setApiKey(saved.api_key || '');
        setApiHost(saved.endpoint_url || '');
      } else {
        const defaults = DEFAULT_PROVIDERS.find((p) => p.id === value);
        setApiKey(defaults?.apiKey || '');
        setApiHost(defaults?.apiHost || '');
      }
    },
    [providers]
  );

  // Fetch models from the configured API
  const handleFetchModels = useCallback(async () => {
    if (!apiKey) {
      toast.error(
        t('setting.api-key-can-not-be-empty') || 'API key is required'
      );
      return;
    }
    if (!apiHost) {
      toast.error(
        t('setting.endpoint-url-can-not-be-empty') || 'Base URL is required'
      );
      return;
    }
    if (!isValidUrl(apiHost)) {
      toast.error(
        t('setting.invalid-endpoint-url') ||
          'Invalid URL format. Must start with http:// or https://'
      );
      return;
    }

    setFetchingModels(true);
    setModels([]);
    setSelectedModel('');

    const { models: fetched } = await tryFetchModels(apiHost, apiKey);
    setModels(fetched);

    if (fetched.length > 0) {
      toast.success(
        `Found ${fetched.length} model${fetched.length > 1 ? 's' : ''}`
      );
    } else {
      toast.error(
        'Could not fetch models. You can type a model name manually below.'
      );
    }

    setFetchingModels(false);
  }, [apiKey, apiHost, t]);

  // Save provider config to backend
  const handleSave = useCallback(async () => {
    if (!apiKey) {
      toast.error(
        t('setting.api-key-can-not-be-empty') || 'API key is required'
      );
      return;
    }
    if (!apiHost) {
      toast.error(
        t('setting.endpoint-url-can-not-be-empty') || 'Base URL is required'
      );
      return;
    }
    if (!isValidUrl(apiHost)) {
      toast.error(
        t('setting.invalid-endpoint-url') ||
          'Invalid URL format. Must start with http:// or https://'
      );
      return;
    }

    setSaving(true);
    const providerId = currentProvider?.id || 'openai-compatible-model';
    const providerName = isCustom ? 'openai-compatible-model' : providerId;

    try {
      // Check if provider already exists on the backend
      const res = await proxyFetchGet('/api/v1/providers');
      const list = Array.isArray(res) ? res : res.items || [];
      const existing = list.find((p: any) => p.provider_name === providerName);

      const data = {
        provider_name: providerName,
        model_type: selectedModel || null,
        api_key: apiKey,
        endpoint_url: apiHost,
      };

      if (existing?.id) {
        await proxyFetchPut(`/api/v1/provider/${existing.id}`, data);
      } else {
        await proxyFetchPost('/api/v1/provider', data);
      }

      // If a model is selected, set it as preferred
      if (selectedModel) {
        // Get the updated provider list to find the ID
        const updatedRes = await proxyFetchGet('/api/v1/providers');
        const updatedList = Array.isArray(updatedRes)
          ? updatedRes
          : updatedRes.items || [];
        const savedProvider = updatedList.find(
          (p: any) => p.provider_name === providerName
        );
        if (savedProvider?.id) {
          await proxyFetchPost('/api/v1/provider/prefer', {
            provider_id: savedProvider.id,
          });
        }
      }

      // Set modelType to 'custom' so startTask uses the saved provider
      useAuthStore.getState().setModelType('custom');

      toast.success('Model configuration saved successfully');
      await loadProviders();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  }, [
    apiKey,
    apiHost,
    selectedModel,
    currentProvider,
    isCustom,
    t,
    loadProviders,
  ]);

  const allProviders = useMemo(
    () => [...DEFAULT_PROVIDERS, CUSTOM_PROVIDER],
    []
  );

  if (loadingProviders) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-ds-text-neutral-muted-default" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h2 className="text-heading-sm font-bold text-ds-text-neutral-default-default">
          Model Configuration
        </h2>
        <p className="mt-1 text-body-sm text-ds-text-neutral-muted-default">
          Configure your AI provider, enter API credentials, and select a model
          to use in chat and workspace.
        </p>
      </div>

      {/* Provider Selector */}
      <div className="flex flex-col gap-2">
        <label className="text-label-sm font-semibold text-ds-text-neutral-default-default">
          Provider
        </label>
        <Select
          value={isCustom ? 'custom' : selectedProviderId}
          onValueChange={handleProviderChange}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a provider" />
          </SelectTrigger>
          <SelectContent>
            {allProviders.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <span className="flex items-center gap-2">{p.name}</span>
              </SelectItem>
            ))}
            <SelectItem value="custom">
              <span className="flex items-center gap-2">Custom API</span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* API Key */}
      <div className="flex flex-col gap-2">
        <label className="text-label-sm font-semibold text-ds-text-neutral-default-default">
          API Key
        </label>
        <div className="relative">
          <Key className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ds-text-neutral-muted-default" />
          <Input
            type={showApiKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="pl-10 pr-10"
          />
          <button
            type="button"
            onClick={() => setShowApiKey(!showApiKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ds-text-neutral-muted-default hover:text-ds-text-neutral-default-default"
          >
            {showApiKey ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Base URL */}
      <div className="flex flex-col gap-2">
        <label className="text-label-sm font-semibold text-ds-text-neutral-default-default">
          Base URL
        </label>
        <div className="relative">
          <Server className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ds-text-neutral-muted-default" />
          <Input
            type="text"
            value={apiHost}
            onChange={(e) => setApiHost(e.target.value)}
            placeholder={CUSTOM_PROVIDER.hostPlaceHolder}
            className="pl-10"
          />
        </div>
      </div>

      {/* Model Selection Row */}
      <div className="flex flex-col gap-2">
        <label className="text-label-sm font-semibold text-ds-text-neutral-default-default">
          Model
        </label>
        <div className="flex flex-row items-end gap-2">
          {/* Model dropdown (shown when models are fetched) */}
          <div className="flex-1">
            {models.length > 0 ? (
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                type="text"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                placeholder={
                  fetchingModels
                    ? 'Fetching models...'
                    : 'Type model name (e.g. gpt-4o, claude-sonnet-4)'
                }
              />
            )}
          </div>

          {/* Fetch Models Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleFetchModels}
            disabled={fetchingModels || !apiKey || !apiHost}
            className="shrink-0"
          >
            {fetchingModels ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                Fetching...
              </>
            ) : (
              <>
                <RefreshCw className="mr-1 h-4 w-4" />
                Fetch Models
              </>
            )}
          </Button>
        </div>
        <p className="text-body-xs text-ds-text-neutral-muted-default">
          {models.length > 0
            ? `Select a model from the dropdown, or type a model name manually.`
            : models.length === 0 && !fetchingModels
              ? `Click "Fetch Models" to auto-detect available models, or type a model name manually.`
              : ''}
        </p>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3 pt-2">
        <Button onClick={handleSave} disabled={saving || !apiKey || !apiHost}>
          {saving ? (
            <>
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="mr-1 h-4 w-4" />
              Save Configuration
            </>
          )}
        </Button>
        {currentProvider?.is_valid && (
          <span className="flex items-center gap-1 text-body-xs text-ds-text-success-default-default">
            <Check className="h-3 w-3" />
            Configured
          </span>
        )}
      </div>
    </div>
  );
}
