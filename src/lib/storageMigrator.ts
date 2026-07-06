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

const MIGRATION_FLAG_KEY = 'merci-storage-migrated-v2';

/** Map of known old → new key names (exact matches). */
const KEY_MAP: Record<string, string> = {
  // Auth & session
  nova_session_id: 'merci_session_id',
  'nova:local-default': 'merci:local-default',
  nova_desktop_instance_id: 'merci_desktop_instance_id',

  // UI state
  'nova-home-sidebar-width-px': 'merci-home-sidebar-width-px',
  'nova-home-hub-view-mode': 'merci-home-hub-view-mode',
  'nova-sidebar-instructions-memory-on': 'merci-sidebar-instructions-memory-on',
  'nova-pinned-projects': 'merci-pinned-projects',
  'nova-workspace-onboarding-checked': 'merci-workspace-onboarding-checked',

  // Zustand persist stores (structured JSON with {state, version})
  'nova-space-store': 'merci-space-store',
  'nova-page-tab': 'merci-page-tab',
};

function isZustandData(raw: string): boolean {
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null && 'state' in parsed;
  } catch {
    return false;
  }
}

/**
 * Migrate a single key: copy value to new key, remove old key.
 * Skips if new key already has data (fresh install / already migrated).
 */
function migrateOne(oldKey: string, newKey: string): void {
  const value = localStorage.getItem(oldKey);
  if (value === null) return;
  if (localStorage.getItem(newKey) !== null) {
    localStorage.removeItem(oldKey); // clean up stale old key
    return;
  }
  localStorage.setItem(newKey, value);
  localStorage.removeItem(oldKey);
}

/**
 * Migrate all nova-prefixed localStorage keys to merci-prefixed keys.
 *
 * - Handles known exact keys via KEY_MAP.
 * - Scans for any unknown `nova-` / `nova:` prefixed keys and migrates them.
 * - Zustand persist stores are handled correctly (structured JSON).
 *
 * Idempotent — guards against re-running via MIGRATION_FLAG_KEY.
 * Call once at app startup before any store initialization.
 */
export function migrateStorageKeys(): void {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(MIGRATION_FLAG_KEY) === 'true') return;

  // 1. Migrate known exact keys
  for (const [oldKey, newKey] of Object.entries(KEY_MAP)) {
    migrateOne(oldKey, newKey);
  }

  // 2. Wildcard scan: catch any dynamically-created keys not in the map
  //    (e.g. nova-instructions-md-<id>, nova-provider-models-v1:<provider>, nova:task-card-expanded*)
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const oldKey = localStorage.key(i);
    if (!oldKey) continue;

    // Match any key starting with nova- or nova:
    const match = oldKey.match(/^nova[-:]/);
    if (!match) continue;

    // Skip keys already handled in the exact map
    if (KEY_MAP[oldKey]) continue;

    // Build new key by replacing nova with merci
    const newKey = 'merci' + oldKey.slice('nova'.length);

    // Don't overwrite if new key already exists
    if (localStorage.getItem(newKey) !== null) {
      localStorage.removeItem(oldKey);
      continue;
    }

    const value = localStorage.getItem(oldKey);
    if (value === null) continue;

    // Handle Zustand-structured data discovered via wildcard
    if (isZustandData(value)) {
      localStorage.setItem(newKey, value);
    } else {
      localStorage.setItem(newKey, value);
    }
    localStorage.removeItem(oldKey);
  }

  localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
}