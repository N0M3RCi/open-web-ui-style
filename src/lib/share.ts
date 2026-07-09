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

import { proxyFetchPost } from '@/api/http';
import { toast } from 'sonner';

export const share = async (taskId: string): Promise<boolean> => {
  try {
    const res = await proxyFetchPost(`/api/v1/chat/share`, {
      task_id: taskId,
    });
    const shareLink = `${window.location.origin}/callback?share_token=${encodeURIComponent(res.share_token)}&task_id=${encodeURIComponent(taskId)}`;

    try {
      await navigator.clipboard.writeText(shareLink);
      toast.success('The share link has been copied.');
      return true;
    } catch {
      // Clipboard API failed — fallback: prompt the user to copy manually
      try {
        const textarea = document.createElement('textarea');
        textarea.value = shareLink;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        toast.success('The share link has been copied.');
        return true;
      } catch {
        // Last resort: show the link in a prompt
        prompt('Copy this share link manually:', shareLink);
        return true;
      }
    }
  } catch (error) {
    console.error('Failed to share task:', error);
    toast.error('Failed to share. Please try again.');
    return false;
  }
};
