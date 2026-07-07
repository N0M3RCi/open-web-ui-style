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
import { LocaleEnum, switchLanguage } from '@/i18n';
import { useAuthStore } from '@/store/authStore';
import { useInstallationStore } from '@/store/installationStore';
import { Check, Eye, EyeOff, LogOut, Pencil, X } from 'lucide-react';
import { createRef, RefObject, useCallback, useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import useChatStoreAdapter from '@/hooks/useChatStoreAdapter';
import { debug } from '@/lib/debug';

export default function SettingGeneral() {
  const { t } = useTranslation();
  const authStore = useAuthStore();

  const resetInstallation = useInstallationStore((state) => state.reset);
  const setNeedsBackendRestart = useInstallationStore(
    (state) => state.setNeedsBackendRestart
  );

  const navigate = useNavigate();
  const [_isLoading, _setIsLoading] = useState(false);
  const language = authStore.language;
  const _setLanguage = authStore.setLanguage;
  const _fullNameRef: RefObject<HTMLInputElement> = createRef();
  const _nickNameRef: RefObject<HTMLInputElement> = createRef();
  const _workDescRef: RefObject<HTMLInputElement> = createRef();
  //Get Chatstore for the active project's task
  const { chatStore } = useChatStoreAdapter();

  // Proxy configuration state
  const [proxyUrl, setProxyUrl] = useState('');
  const [isProxySaving, setIsProxySaving] = useState(false);
  const [proxyNeedsRestart, setProxyNeedsRestart] = useState(false);
  const [isProxyTesting, setIsProxyTesting] = useState(false);
  const [proxyTestResult, setProxyTestResult] = useState<{
    is_valid: boolean;
    message: string;
    latency_ms?: number;
  } | null>(null);

  // Profile editing state
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileNickname, setProfileNickname] = useState('');
  const [profileFullname, setProfileFullname] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  // Model provider config (inline in profile)
  const [providerApiKey, setProviderApiKey] = useState('');
  const [providerApiHost, setProviderApiHost] = useState('');
  const [providerModel, setProviderModel] = useState('');
  const [providerList, setProviderList] = useState<any[]>([]);
  const [providerSaving, setProviderSaving] = useState(false);
  const [providerKeyVisible, setProviderKeyVisible] = useState(false);
  const [providerKeyOriginal, setProviderKeyOriginal] = useState('');

  /** Mask an API key, showing only the last 4 characters. */
  const maskApiKey = (key: string): string => {
    if (!key || key.length <= 4) return key;
    return key.slice(0, 3) + '...' + key.slice(-4);
  };

  const loadProviders = useCallback(async () => {
    try {
      const res = await proxyFetchGet('/api/v1/providers');
      const list = Array.isArray(res) ? res : res.items || [];
      setProviderList(list);
      const saved = list.find((p: any) => p.api_key);
      if (saved) {
        setProviderApiKey(maskApiKey(saved.api_key || ''));
        setProviderKeyOriginal(saved.api_key || '');
        setProviderApiHost(saved.endpoint_url || '');
        setProviderModel(saved.model_type || '');
      }
    } catch {
      // ignore
    }
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      const data = await proxyFetchGet('/api/v1/user');
      if (data?.nickname) setProfileNickname(data.nickname);
      if (data?.fullname) setProfileFullname(data.fullname);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadProfile();
    loadProviders();
  }, [loadProfile, loadProviders]);

  const languageList = [
    {
      key: LocaleEnum.English,
      label: 'English',
    },
    {
      key: LocaleEnum.SimplifiedChinese,
      label: '简体中文',
    },
    {
      key: LocaleEnum.TraditionalChinese,
      label: '繁體中文',
    },
    {
      key: LocaleEnum.Japanese,
      label: '日本語',
    },
    {
      key: LocaleEnum.Arabic,
      label: 'العربية',
    },
    {
      key: LocaleEnum.French,
      label: 'Français',
    },
    {
      key: LocaleEnum.German,
      label: 'Deutsch',
    },
    {
      key: LocaleEnum.Russian,
      label: 'Русский',
    },
    {
      key: LocaleEnum.Spanish,
      label: 'Español',
    },
    {
      key: LocaleEnum.Korean,
      label: '한국어',
    },
    {
      key: LocaleEnum.Italian,
      label: 'Italiano',
    },
  ];

  useEffect(() => {
    // Load proxy configuration from backend
    const loadProxyConfig = async () => {
      try {
        const result = await proxyFetchGet('/api/v1/proxy/config');
        if (result?.proxy_url) {
          setProxyUrl(result.proxy_url);
        }
      } catch (_error) {
        debug('No proxy configured via backend');
      }
    };
    loadProxyConfig();
  }, []);

  // Save proxy configuration
  const handleSaveProxy = async () => {
    if (!authStore.email) {
      toast.error(t('setting.proxy-save-failed'));
      return;
    }

    const trimmed = proxyUrl.trim();

    // Validate proxy URL format when non-empty
    if (trimmed) {
      try {
        const parsed = new URL(trimmed);
        if (
          !['http:', 'https:', 'socks5:', 'socks4:'].includes(parsed.protocol)
        ) {
          toast.error(t('setting.proxy-invalid-url'));
          return;
        }
      } catch {
        toast.error(t('setting.proxy-invalid-url'));
        return;
      }
    }

    setIsProxySaving(true);
    try {
      await proxyFetchPost('/api/v1/proxy/config', {
        proxy_url: trimmed,
      });
      toast.success(t('setting.proxy-saved-restart-required'));
    } catch (error) {
      console.error('Failed to save proxy:', error);
      toast.error(t('setting.proxy-save-failed'));
    } finally {
      setIsProxySaving(false);
    }
  };

  // Test proxy connectivity
  const handleTestProxy = async () => {
    const trimmed = proxyUrl.trim();
    if (!trimmed) {
      toast.error('Enter a proxy URL first');
      return;
    }

    setIsProxyTesting(true);
    setProxyTestResult(null);
    try {
      const result = await proxyFetchPost('/api/v1/proxy/test', {
        proxy_url: trimmed,
      });
      setProxyTestResult(result);
      if (result?.is_valid) {
        toast.success(`Proxy OK (${result.latency_ms}ms)`);
      } else {
        toast.error(result?.message || 'Proxy test failed');
      }
    } catch (error) {
      toast.error('Failed to test proxy');
    } finally {
      setIsProxyTesting(false);
    }
  };

  return (
    <div className="m-auto h-auto w-full flex-1">
      {/* Header Section */}
      <div className="mx-auto flex w-full max-w-[900px] items-center justify-between px-6 pb-6 pt-8">
        <div className="flex w-full flex-row items-center justify-between gap-4">
          <div className="flex flex-col">
            <div className="text-heading-sm font-bold text-ds-text-neutral-default-default">
              {t('setting.general')}
            </div>
          </div>
        </div>
      </div>
      {/* Content Section */}
      <div className="mb-xl flex flex-col gap-6">
        {/* Profile Section */}
        <div className="flex flex-col rounded-2xl bg-ds-bg-neutral-default-default px-6 py-4">
          <div className="item-center flex flex-row justify-between">
            <div className="flex flex-col gap-2">
              <div className="text-body-base font-bold text-ds-text-neutral-default-default">
                {t('setting.profile')}
              </div>
              <div className="text-body-sm">
                <Trans
                  i18nKey="setting.you-are-currently-signed-in-with"
                  values={{ email: authStore.email }}
                  components={{
                    email: (
                      <span className="text-ds-text-status-splitting-strong-default underline" />
                    ),
                  }}
                />
              </div>
            </div>
            <div className="flex items-center gap-sm">
              {!editingProfile && (
                <Button
                  onClick={() => {
                    loadProfile();
                    setEditingProfile(true);
                  }}
                  variant="primary"
                  textWeight="semibold"
                  buttonContent="text"
                  buttonRadius="lg"
                  tone="neutral"
                  size="sm"
                >
                  <Pencil />
                  {t('setting.manage')}
                </Button>
              )}
              <Button
                variant="outline"
                textWeight="semibold"
                buttonContent="text"
                buttonRadius="lg"
                tone="neutral"
                size="sm"
                onClick={() => {
                  chatStore?.clearTasks?.();

                  resetInstallation();
                  setNeedsBackendRestart(true);

                  authStore.logout();
                  navigate('/login');
                }}
              >
                <LogOut />
                {t('setting.log-out')}
              </Button>
            </div>
          </div>
          {editingProfile && (
            <div className="mt-4 flex flex-col gap-3 border-t border-ds-border-neutral-subtle-default pt-4">
              <div className="flex flex-col gap-1">
                <label className="text-label-xs text-ds-text-neutral-muted-default">
                  Nickname
                </label>
                <Input
                  value={profileNickname}
                  onChange={(e) => setProfileNickname(e.target.value)}
                  placeholder="Your nickname"
                  className="h-9 max-w-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-label-xs text-ds-text-neutral-muted-default">
                  Full Name
                </label>
                <Input
                  value={profileFullname}
                  onChange={(e) => setProfileFullname(e.target.value)}
                  placeholder="Your full name"
                  className="h-9 max-w-sm"
                />
              </div>
              <div className="mt-2 border-t border-ds-border-neutral-subtle-default pt-3">
                <div className="text-label-sm font-semibold text-ds-text-neutral-default-default">
                  Model Configuration
                </div>
                <div className="mt-2 flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-label-xs text-ds-text-neutral-muted-default">
                      API Key
                    </label>
                    <div className="relative max-w-sm">
                      <Input
                        type={providerKeyVisible ? 'text' : 'password'}
                        value={providerApiKey}
                        onChange={(e) => setProviderApiKey(e.target.value)}
                        placeholder="sk-..."
                        className="h-9 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setProviderKeyVisible(!providerKeyVisible)
                        }
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-ds-text-neutral-muted-default hover:text-ds-text-neutral-default-default"
                      >
                        {providerKeyVisible ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-label-xs text-ds-text-neutral-muted-default">
                      Base URL
                    </label>
                    <Input
                      value={providerApiHost}
                      onChange={(e) => setProviderApiHost(e.target.value)}
                      placeholder="https://api.openai.com/v1"
                      className="h-9 max-w-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-label-xs text-ds-text-neutral-muted-default">
                      Model
                    </label>
                    <Input
                      value={providerModel}
                      onChange={(e) => setProviderModel(e.target.value)}
                      placeholder="e.g. gpt-4o, claude-sonnet-4"
                      className="h-9 max-w-sm"
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={profileSaving || providerSaving}
                  onClick={async () => {
                    setProfileSaving(true);
                    try {
                      await proxyFetchPut('/api/v1/user', {
                        nickname: profileNickname,
                        fullname: profileFullname,
                      });

                      // Save model provider config if API key is set
                      if (providerApiKey) {
                        // Use the original key if the masked value hasn't changed
                        const resolvedApiKey =
                          providerApiKey === maskApiKey(providerKeyOriginal)
                            ? providerKeyOriginal
                            : providerApiKey;

                        if (!providerApiHost) {
                          toast.error(
                            'Base URL is required when setting an API key'
                          );
                          setProfileSaving(false);
                          return;
                        }

                        const existing = providerList.find(
                          (p: any) => p.api_key
                        );
                        const data = {
                          provider_name: 'openai-compatible-model',
                          model_type: providerModel || null,
                          api_key: resolvedApiKey,
                          endpoint_url: providerApiHost,
                        };
                        if (existing?.id) {
                          await proxyFetchPut(
                            `/api/v1/provider/${existing.id}`,
                            data
                          );
                        } else {
                          await proxyFetchPost('/api/v1/provider', data);
                        }
                      }

                      toast.success('Profile updated');
                      setEditingProfile(false);
                      await loadProviders();
                    } catch {
                      toast.error('Failed to update profile');
                    } finally {
                      setProfileSaving(false);
                    }
                  }}
                >
                  <Check />
                  {profileSaving ? 'Saving...' : 'Save'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingProfile(false)}
                >
                  <X />
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Language Section */}
        <div className="item-center flex flex-row justify-between rounded-2xl bg-ds-bg-neutral-default-default px-6 py-4">
          <div className="flex flex-1 items-center">
            <div className="text-body-base font-bold text-ds-text-neutral-default-default">
              {t('setting.language')}
            </div>
          </div>
          <Select value={language} onValueChange={switchLanguage}>
            <SelectTrigger variant="secondary" className="w-48">
              <SelectValue placeholder={t('setting.select-language')} />
            </SelectTrigger>
            <SelectContent className="border bg-input-bg-default">
              <SelectGroup>
                <SelectItem value="system">
                  {t('setting.system-default')}
                </SelectItem>
                {languageList.map((item) => (
                  <SelectItem key={item.key} value={item.key}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {/* Network Proxy Section */}
        <div className="flex flex-col gap-4 rounded-2xl bg-ds-bg-neutral-default-default px-6 py-4">
          <div className="flex flex-col gap-1">
            <div className="text-body-base font-bold text-ds-text-neutral-default-default">
              {t('setting.network-proxy')}
            </div>
            <div className="mb-4 text-sm leading-13 text-ds-text-neutral-muted-default">
              {t('setting.network-proxy-description')}
            </div>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder={t('setting.proxy-placeholder')}
              value={proxyUrl}
              onChange={(e) => {
                setProxyUrl(e.target.value);
                setProxyTestResult(null);
              }}
              className="flex-1"
              size="default"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestProxy}
              disabled={isProxyTesting || !proxyUrl.trim()}
            >
              {isProxyTesting ? 'Testing...' : 'Test'}
            </Button>
          </div>
          {proxyTestResult && (
            <div
              className={`text-sm ${
                proxyTestResult.is_valid
                  ? 'text-ds-text-success-default-default'
                  : 'text-ds-text-error-default-default'
              }`}
            >
              {proxyTestResult.is_valid ? '✓ ' : '✗ '}
              {proxyTestResult.message}
              {proxyTestResult.latency_ms != null &&
                ` (${proxyTestResult.latency_ms}ms)`}
            </div>
          )}
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveProxy}
              disabled={isProxySaving}
            >
              {isProxySaving ? t('setting.saving') : t('setting.save')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
