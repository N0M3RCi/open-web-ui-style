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

import { proxyFetchGet, proxyFetchPut } from '@/api/http';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LocaleEnum, switchLanguage } from '@/i18n';
import { useAuthStore } from '@/store/authStore';
import { useInstallationStore } from '@/store/installationStore';
import { Check, LogOut, Pencil, X } from 'lucide-react';
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
import { useHost } from '@/host';
import { debug } from '@/lib/debug';

export default function SettingGeneral() {
  const { t } = useTranslation();
  const host = useHost();
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

  // Profile editing state
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileNickname, setProfileNickname] = useState('');
  const [profileFullname, setProfileFullname] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

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
  }, [loadProfile]);

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
    // Load proxy configuration from global env
    const loadProxyConfig = async () => {
      if (host?.electronAPI?.readGlobalEnv) {
        try {
          const result = await host.electronAPI.readGlobalEnv('HTTP_PROXY');
          if (result?.value) {
            setProxyUrl(result.value);
          }
        } catch (_error) {
          debug('No proxy configured');
        }
      }
    };
    loadProxyConfig();
  }, [host]);

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

    if (!host?.electronAPI?.envWrite || !host?.electronAPI?.envRemove) {
      toast.error(t('setting.proxy-save-failed'));
      return;
    }

    setIsProxySaving(true);
    try {
      if (trimmed) {
        const result = await host.electronAPI.envWrite(authStore.email, {
          key: 'HTTP_PROXY',
          value: trimmed,
        });
        if (!result?.success) throw new Error('envWrite returned no success');
      } else {
        const result = await host.electronAPI.envRemove(
          authStore.email,
          'HTTP_PROXY'
        );
        if (!result?.success) throw new Error('envRemove returned no success');
      }
      setProxyNeedsRestart(true);
      toast.success(t('setting.proxy-saved-restart-required'));
    } catch (error) {
      console.error('Failed to save proxy:', error);
      toast.error(t('setting.proxy-save-failed'));
    } finally {
      setIsProxySaving(false);
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
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={profileSaving}
                  onClick={async () => {
                    setProfileSaving(true);
                    try {
                      await proxyFetchPut('/api/v1/user', {
                        nickname: profileNickname,
                        fullname: profileFullname,
                      });
                      toast.success('Profile updated');
                      setEditingProfile(false);
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
          <Input
            placeholder={t('setting.proxy-placeholder')}
            value={proxyUrl}
            onChange={(e) => {
              setProxyUrl(e.target.value);
              setProxyNeedsRestart(false);
            }}
            className="flex-1"
            size="default"
            note={
              proxyNeedsRestart ? t('setting.proxy-restart-hint') : undefined
            }
            trailingButton={
              <Button
                variant={proxyNeedsRestart ? 'outline' : 'primary'}
                size="sm"
                onClick={
                  proxyNeedsRestart
                    ? () => host?.electronAPI?.restartApp()
                    : handleSaveProxy
                }
                disabled={!proxyNeedsRestart && isProxySaving}
              >
                {proxyNeedsRestart
                  ? t('setting.restart-to-apply')
                  : isProxySaving
                    ? t('setting.saving')
                    : t('setting.save')}
              </Button>
            }
          />
        </div>
      </div>
    </div>
  );
}
