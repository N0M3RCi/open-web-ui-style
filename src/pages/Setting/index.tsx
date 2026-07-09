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

import VerticalNavigation, {
  HISTORY_VERTICAL_SIDEBAR_CLASSNAME,
  type VerticalNavItem,
} from '@/components/Dashboard/VerticalNav';
import AdminUsers from '@/pages/AdminUsers';
import Appearance from '@/pages/Setting/Appearance';
import General from '@/pages/Setting/General';
import Models from '@/pages/Setting/Models';
import Privacy from '@/pages/Setting/Privacy';
import Students from '@/pages/Setting/Students';
import { useAuthStore } from '@/store/authStore';
import {
  Brain,
  Fingerprint,
  LogOut,
  Palette,
  Settings,
  Shield,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

export default function Setting() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const { logout, isPasscodeUser } = useAuthStore();
  const IS_LOCAL_MODE = import.meta.env.VITE_USE_LOCAL_PROXY === 'true';
  // Setting menu configuration
  const settingMenus = [
    {
      id: 'general',
      name: t('setting.general'),
      icon: Settings,
      path: '/setting/general',
    },
    {
      id: 'appearance',
      name: t('setting.appearance-tab'),
      icon: Palette,
      path: '/setting/appearance',
    },
    {
      id: 'models',
      name: 'Models',
      icon: Brain,
      path: '/setting/models',
    },
    {
      id: 'privacy',
      name: t('setting.privacy'),
      icon: Fingerprint,
      path: '/setting/privacy',
    },
    ...(!isPasscodeUser
      ? [
          {
            id: 'admin',
            name: 'Admin',
            icon: Shield,
            path: '/admin/users',
          },
        ]
      : []),
    ...(IS_LOCAL_MODE && !isPasscodeUser
      ? [
          {
            id: 'students',
            name: 'Students',
            icon: Users,
            path: '/setting/students',
          },
        ]
      : []),
  ];
  // Initialize tab from URL once, then manage locally without routing
  const getCurrentTab = () => {
    const path = location.pathname;
    const tabFromUrl =
      path.split('/setting/')[1] || searchParams.get('subtab') || 'general';
    return settingMenus.find((menu) => menu.id === tabFromUrl)?.id || 'general';
  };

  const [activeTab, setActiveTab] = useState(getCurrentTab);

  // Switch tabs locally and update the URL so the tab is preserved on remount
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    // Update the URL subtab parameter so the correct tab is picked up on mount
    navigate(`?tab=settings&subtab=${tabId}`, { replace: true });
  };

  // Close settings page
  const _handleClose = () => {
    navigate('/');
  };

  return (
    <div className="flex h-auto w-full">
      <div className={HISTORY_VERTICAL_SIDEBAR_CLASSNAME}>
        <VerticalNavigation
          items={
            settingMenus.map((menu) => {
              return {
                value: menu.id,
                label: (
                  <span className="text-body-sm font-bold">{menu.name}</span>
                ),
              };
            }) as VerticalNavItem[]
          }
          value={activeTab}
          onValueChange={handleTabChange}
          className="h-fit min-h-0 w-full flex-none gap-0"
          listClassName="h-auto w-full"
          contentClassName="hidden"
        />
        <div className="mt-auto" />
        {IS_LOCAL_MODE && (
          <button
            type="button"
            onClick={() => {
              logout();
              navigate('/enter', { replace: true });
            }}
            className="hover:bg-red-500/10 flex w-full items-center gap-2 rounded-lg px-4 py-2 text-sm text-red-400 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        )}
      </div>

      <div className="flex h-auto w-full flex-1 flex-col">
        <div className="flex flex-col gap-4">
          {activeTab === 'general' && <General />}
          {activeTab === 'appearance' && <Appearance />}
          {activeTab === 'models' && <Models />}
          {activeTab === 'privacy' && <Privacy />}
          {!isPasscodeUser && activeTab === 'admin' && <AdminUsers />}
          {!isPasscodeUser && activeTab === 'students' && <Students />}
        </div>
      </div>
    </div>
  );
}
