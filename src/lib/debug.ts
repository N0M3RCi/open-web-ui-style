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

/**
 * Debug logger — wraps console.log behind a dev-only guard.
 * In production builds (import.meta.env.PROD === true), calls are dead-code
 * eliminated by the minifier, leaving zero runtime overhead.
 *
 * Usage:
 *   import { debug } from '@/lib/debug';
 *   debug('some message', someVariable);
 */
export function debug(...args: unknown[]): void {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
}
