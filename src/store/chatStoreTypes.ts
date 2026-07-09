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
// Types extracted from chatStore.ts (4968 lines → ~4800 lines).

export const API_CODE_TRIAL_LIMIT = '22';
export const PROJECT_CONTEXT_MAX_CHARS = 24_000;
export const PROJECT_CONTEXT_MAX_RUNS = 8;

export type ConfirmedUserPromptSources = {
  lastMessageContent?: unknown;
  messageContent?: unknown;
  question?: unknown;
  isFollowUpConfirm: boolean;
};

export const nonEmptyString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

export function resolveConfirmedUserMessageContent({
  lastMessageContent,
  messageContent,
  question,
  isFollowUpConfirm,
}: ConfirmedUserPromptSources): string {
  const optimisticMessage = nonEmptyString(lastMessageContent);
  if (optimisticMessage) return optimisticMessage;

  const capturedStartMessage = nonEmptyString(messageContent);
  const eventQuestion = nonEmptyString(question);

  if (isFollowUpConfirm) {
    return eventQuestion || capturedStartMessage || '';
  }

  return capturedStartMessage || eventQuestion || '';
}

export const hasApiCode = (value: unknown, code: string) =>
  typeof value === 'object' &&
  value !== null &&
  String((value as { code?: unknown }).code) === code;

export interface Task {
  task_id: number;
  project_id: string;
  session_id: string;
  status: string;
  session_mode: string;
  is_regenerating: boolean;
  start_time: string | null;
  end_time: string | null;
  from_existing?: boolean;
  is_queued?: boolean;
  total_tokens_used?: number;
  user_id?: number;
  model?: string;
  enable_thinking?: boolean;
  agent_ids?: number[];
  active_tool_id?: number;
  current_agent?: number;
  chat: AgentMessage[];
  artifact_ids: string[];
  artifacts: any[];
}

export type UploadFileSource =
  'project_output' | 'camel_log' | 'user_attachment';

export interface UploadCandidate {
  file: File;
  source: UploadFileSource;
}

export interface GeneratedUploadFile {
  name: string;
  formatted_size: string;
  raw_size: number;
  url: string;
  path: string;
  type: string;
  source: UploadFileSource;
}

export interface UploadOutcome {
  files: GeneratedUploadFile[];
}
