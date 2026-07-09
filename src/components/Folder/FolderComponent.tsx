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

import { injectFontStyles } from '@/lib/htmlFontStyles';
import {
  containsDangerousContent,
  STRICT_SANITIZE_CONFIG,
} from '@/lib/htmlSanitization';
import DOMPurify from 'dompurify';
import { useMemo } from 'react';

type Props = {
  selectedFile: {
    content?: string | null;
  };
};

export default function FolderComponent({ selectedFile }: Props) {
  const sanitizedHtml = useMemo(() => {
    const raw = selectedFile?.content || '';
    if (!raw) return '';

    // Strict dangerous content detection using shared patterns from htmlSanitization.ts
    if (containsDangerousContent(raw)) {
      return '';
    }

    const sanitized = DOMPurify.sanitize(raw, STRICT_SANITIZE_CONFIG);

    // Inject font styles into sanitized HTML
    return injectFontStyles(sanitized);
  }, [selectedFile?.content]);

  return (
    <div
      className="folder-component-content w-full overflow-auto text-ds-text-neutral-default-default"
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}
