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

import { statSync, readdirSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { cwd } from 'node:process';

const DIST_DIR = resolve(cwd(), 'dist-web', 'assets');
const MAX_CHUNK_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_EXTENSIONS = new Set(['.js', '.css']);

let hasError = false;

try {
  const files = readdirSync(DIST_DIR);

  for (const file of files) {
    const ext = extname(file);
    if (!ALLOWED_EXTENSIONS.has(ext)) continue;

    const filePath = join(DIST_DIR, file);
    const { size } = statSync(filePath);
    const sizeKB = (size / 1024).toFixed(1);

    if (size > MAX_CHUNK_SIZE_BYTES) {
      console.error(
        `[FAIL] ${file} is ${sizeKB} KB — exceeds ${MAX_CHUNK_SIZE_BYTES / 1024} KB limit`
      );
      hasError = true;
    } else {
      console.log(`[PASS] ${file} is ${sizeKB} KB`);
    }
  }

  if (hasError) {
    console.error(
      '\n[FAIL] Some chunks exceed the size limit. Consider code splitting.'
    );
    process.exit(1);
  }

  console.log('\n[PASS] All chunks are within size limits.');
} catch (err) {
  if (err.code === 'ENOENT') {
    console.error(
      `[SKIP] dist-web/assets not found. Run 'npm run build:web' first.`
    );
    process.exit(0);
  }
  throw err;
}
