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
 * ChatStore Unit Tests - Core Functionality
 *
 * Tests basic chatStore operations:
 * - Task creation and removal
 * - Status management
 * - Token tracking
 * - Message handling
 */

import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies - moved to top before other imports
vi.mock('@/api/http', async () => {
  const { fetchEventSource } = await import('@microsoft/fetch-event-source');
  const getBaseURL = vi.fn(() => Promise.resolve('http://localhost:8000'));

  return {
    fetchPost: vi.fn(),
    fetchPut: vi.fn(),
    getBaseURL,
    proxyFetchPost: vi.fn(() => Promise.resolve({ id: 'mock-history-id' })),
    proxyFetchPut: vi.fn(),
    proxyFetchGet: vi.fn(() =>
      Promise.resolve({
        value: '',
        api_url: '',
        items: [],
        warning_code: null,
      })
    ),
    uploadFile: vi.fn(),
    fetchDelete: vi.fn(),
    waitForBackendReady: vi.fn(() => Promise.resolve(true)),
    sseTransport: vi.fn(async (options: any) => {
      const baseURL = await getBaseURL();
      const fullUrl =
        options.url.startsWith('http://') || options.url.startsWith('https://')
          ? options.url
          : `${baseURL}${options.url}`;
      const body =
        typeof options.body === 'string'
          ? options.body
          : options.body
            ? JSON.stringify(options.body)
            : undefined;

      await fetchEventSource(fullUrl, {
        method: options.method || 'POST',
        openWhenHidden: options.openWhenHidden ?? true,
        signal: options.signal,
        headers: options.extraHeaders ?? {},
        body,
        onmessage: options.onmessage,
        onopen: options.onopen,
        onerror: options.onerror,
        onclose: options.onclose,
      });
    }),
  };
});

vi.mock('@microsoft/fetch-event-source', () => ({
  fetchEventSource: vi.fn(),
}));

vi.mock('../../../src/store/authStore', () => ({
  useAuthStore: {
    token: null,
    username: null,
    email: null,
    user_id: null,
    appearance: 'light',
    language: 'system',
    isFirstLaunch: true,
    modelType: 'cloud' as const,
    cloud_model_type: 'gpt-5.4' as const,
    initState: 'carousel' as const,
    share_token: null,
    workerListData: {},
  },
  getAuthStore: vi.fn(() => ({
    token: null,
    username: null,
    email: null,
    user_id: null,
    appearance: 'light',
    language: 'system',
    isFirstLaunch: true,
    modelType: 'cloud' as const,
    cloud_model_type: 'gpt-5.4' as const,
    initState: 'carousel' as const,
    share_token: null,
    workerListData: {},
  })),
  useWorkerList: vi.fn(() => []),
  getWorkerList: vi.fn(() => []),
}));

vi.mock('../../../src/store/projectStore', () => ({
  useProjectStore: {
    getState: vi.fn(() => ({
      activeProjectId: null,
      getHistoryId: () => null,
    })),
  },
}));

import {
  fetchPost,
  fetchPut,
  proxyFetchGet,
  waitForBackendReady,
} from '@/api/http';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { generateUniqueId } from '../../../src/lib';
import {
  collectTaskUploadFiles,
  extractEndPayloadText,
  resolveEndMessageText,
  useChatStore,
} from '../../../src/store/chatStore';
import { resolveConfirmedUserMessageContent } from '../../../src/store/chatStoreTypes';
import { useProjectStore } from '../../../src/store/projectStore';
import { ChatTaskStatus } from '../../../src/types/constants';

// Mock electron IPC
(global as any).ipcRenderer = {
  invoke: vi.fn((channel, ..._args) => {
    if (channel === 'get-system-language') return Promise.resolve('en');
    if (channel === 'get-browser-port') return Promise.resolve(9222);
    if (channel === 'get-env-path') return Promise.resolve('/path/to/env');
    if (channel === 'mcp-list') return Promise.resolve({});
    return Promise.resolve();
  }),
};

describe('ChatStore - Core Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton store state to prevent cross-test leakage
    useChatStore.setState({
      activeTaskId: null,
      nextTaskId: null,
      tasks: {},
      updateCount: 0,
    });
  });

  describe('Confirmed user prompt resolution', () => {
    it('uses the optimistic user message when it exists', () => {
      expect(
        resolveConfirmedUserMessageContent({
          lastMessageContent: 'current typed prompt',
          messageContent: 'first prompt',
          question: 'backend current prompt',
          isFollowUpConfirm: true,
        })
      ).toBe('current typed prompt');
    });

    it('uses the SSE question for follow-up confirms before stale startTask content', () => {
      expect(
        resolveConfirmedUserMessageContent({
          messageContent: 'first prompt',
          question: 'follow-up prompt',
          isFollowUpConfirm: true,
        })
      ).toBe('follow-up prompt');
    });

    it('keeps first-run confirms on the captured startTask content before question', () => {
      expect(
        resolveConfirmedUserMessageContent({
          messageContent: 'first prompt',
          question: 'backend confirmed prompt',
          isFollowUpConfirm: false,
        })
      ).toBe('first prompt');
    });
  });

  describe('END message resolution', () => {
    it('keeps non-empty END payload ahead of prior agent summaries', () => {
      expect(
        resolveEndMessageText('Final task output', [
          { step: 'agent_summary_end', summary: 'Older summary' },
        ] as any)
      ).toBe('Final task output');
    });

    it('extracts result-shaped END payloads', () => {
      expect(
        extractEndPayloadText({
          result: 'Final result from replay payload',
          tokens: 10,
        })
      ).toBe('Final result from replay payload');
    });

    it('falls back to completed subtask reports when END payload is empty', () => {
      expect(
        resolveEndMessageText('', [], {
          taskAssigning: [
            {
              tasks: [
                { report: 'Created INC0494320' },
                { report: 'Generated ticket report with 27 rows' },
              ],
            },
          ],
        } as any)
      ).toContain('Generated ticket report with 27 rows');
    });
  });

  describe('Task Upload Files', () => {
    it('collects project outputs, camel logs, and unique user attachments', () => {
      const uploadFiles = collectTaskUploadFiles(
        [
          {
            path: '/tmp/project/report.md',
            name: 'report.md',
            source: 'project_output',
          },
          {
            path: '/tmp/logs/ba4462e1/agent.log',
            name: 'agent.log',
            relativePath: 'ba4462e1',
            source: 'camel_log',
          },
          {
            path: '/tmp/project',
            name: 'project',
            isFolder: true,
            source: 'project_output',
          },
        ],
        [
          {
            id: 'msg-1',
            role: 'user',
            content: 'question',
            attaches: [
              {
                fileName: 'brief.pdf',
                filePath: '/Users/test/Documents/brief.pdf',
              },
              {
                fileName: 'report.md',
                filePath: '/tmp/project/report.md',
              },
            ],
          },
        ] as any,
        [
          {
            fileName: 'followup.csv',
            filePath: '/Users/test/Documents/followup.csv',
          },
        ] as any,
        'task-123'
      );

      expect(uploadFiles).toEqual([
        {
          path: '/tmp/project/report.md',
          name: 'report.md',
          uploadName: 'project_output/report.md',
          source: 'project_output',
        },
        {
          path: '/tmp/logs/ba4462e1/agent.log',
          name: 'agent.log',
          uploadName: 'camel_log/ba4462e1/agent.log',
          source: 'camel_log',
        },
        {
          path: '/Users/test/Documents/brief.pdf',
          name: 'brief.pdf',
          uploadName: 'user_attachment/brief.pdf',
          source: 'user_attachment',
        },
        {
          path: '/Users/test/Documents/followup.csv',
          name: 'followup.csv',
          uploadName: 'user_attachment/followup.csv',
          source: 'user_attachment',
        },
      ]);
    });

    it('skips remote attachment URLs and falls back to filename from path', () => {
      const uploadFiles = collectTaskUploadFiles(
        [],
        [
          {
            id: 'msg-2',
            role: 'user',
            content: 'question',
            attaches: [
              {
                fileName: '',
                filePath: 'C:\\Users\\test\\Desktop\\notes.txt',
              },
              {
                fileName: 'remote.pdf',
                filePath: 'https://example.com/remote.pdf',
              },
            ],
          },
        ] as any,
        [],
        'task-456'
      );

      expect(uploadFiles).toEqual([
        {
          path: 'C:\\Users\\test\\Desktop\\notes.txt',
          name: 'notes.txt',
          uploadName: 'user_attachment/notes.txt',
          source: 'user_attachment',
        },
      ]);
    });

    it('collects generated files from task output file lists', () => {
      const uploadFiles = collectTaskUploadFiles([], [], [], 'task-789', [
        {
          path: '/Users/test/.nova/user_1/space_x/index.html',
          name: 'index.html',
          type: 'html',
        },
        {
          path: 'https://example.com/files/remote.html',
          name: 'remote.html',
          type: 'html',
        },
      ] as any);

      expect(uploadFiles).toEqual([
        {
          path: '/Users/test/.nova/user_1/space_x/index.html',
          name: 'index.html',
          uploadName: 'project_output/index.html',
          source: 'project_output',
        },
      ]);
    });

    it('keeps camel log upload names nested under camel_log', () => {
      const uploadFiles = collectTaskUploadFiles(
        [
          {
            path: '/Users/test/.nova/user_1/project_p/task_t/camel_logs/agent/conv.json',
            name: 'conv.json',
            relativePath: 'agent',
            source: 'camel_log',
          },
        ],
        [],
        [],
        'task-123'
      );

      expect(uploadFiles).toEqual([
        {
          path: '/Users/test/.nova/user_1/project_p/task_t/camel_logs/agent/conv.json',
          name: 'conv.json',
          uploadName: 'camel_log/agent/conv.json',
          source: 'camel_log',
        },
      ]);
    });
  });

  describe('Task Creation', () => {
    it('should create a task with unique ID', () => {
      const store = useChatStore;

      act(() => {
        const taskId1 = store.getState().create();
        const taskId2 = store.getState().create();

        expect(taskId1).toBeDefined();
        expect(taskId2).toBeDefined();
        expect(taskId1).not.toBe(taskId2);
        expect(store.getState().tasks[taskId1]).toBeDefined();
        expect(store.getState().tasks[taskId2]).toBeDefined();
      });
    });

    it('should create a task with custom ID', () => {
      const store = useChatStore;
      const customId = 'custom-task-123';

      act(() => {
        const taskId = store.getState().create(customId);

        expect(taskId).toBe(customId);
        expect(store.getState().tasks[customId]).toBeDefined();
      });
    });

    it('should initialize task with correct default state', () => {
      const store = useChatStore;

      act(() => {
        const taskId = store.getState().create();
        const task = store.getState().tasks[taskId];

        expect(task.status).toBe('pending');
        expect(task.messages).toEqual([]);
        expect(task.tokens).toBe(0);
        expect(task.isPending).toBe(false);
        expect(task.hasWaitComfirm).toBe(false);
        expect(task.progressValue).toBe(0);
        expect(task.taskInfo).toEqual([]);
        expect(task.taskRunning).toEqual([]);
        expect(task.taskAssigning).toEqual([]);
      });
    });

    it('should set task as active when created', () => {
      const store = useChatStore;

      act(() => {
        const taskId = store.getState().create();

        expect(store.getState().activeTaskId).toBe(taskId);
      });
    });
  });

  describe('Task Removal', () => {
    it('should remove a task by ID', () => {
      const store = useChatStore;

      act(() => {
        const taskId = store.getState().create();
        expect(store.getState().tasks[taskId]).toBeDefined();

        store.getState().removeTask(taskId);

        expect(store.getState().tasks[taskId]).toBeUndefined();
      });
    });

    it('should handle removing non-existent task gracefully', () => {
      const store = useChatStore;

      act(() => {
        // Should not throw
        store.getState().removeTask('non-existent-id');
      });
    });

    it('should clear all tasks and create new one', () => {
      const store = useChatStore;

      act(() => {
        const _taskId1 = store.getState().create();
        const _taskId2 = store.getState().create();

        expect(Object.keys(store.getState().tasks)).toHaveLength(2);

        store.getState().clearTasks();

        const remainingTasks = Object.keys(store.getState().tasks);
        expect(remainingTasks).toHaveLength(1);
        expect(store.getState().activeTaskId).toBeDefined();
      });
    });
  });

  describe('Status Management', () => {
    it('should update task status correctly', () => {
      const store = useChatStore;

      act(() => {
        const taskId = store.getState().create();

        store.getState().setStatus(taskId, 'running');
        expect(store.getState().tasks[taskId].status).toBe('running');

        store.getState().setStatus(taskId, 'finished');
        expect(store.getState().tasks[taskId].status).toBe('finished');

        store.getState().setStatus(taskId, 'pause');
        expect(store.getState().tasks[taskId].status).toBe('pause');
      });
    });

    it('should set pending state independently of status', () => {
      const store = useChatStore;

      act(() => {
        const taskId = store.getState().create();

        store.getState().setIsPending(taskId, true);
        expect(store.getState().tasks[taskId].isPending).toBe(true);
        expect(store.getState().tasks[taskId].status).toBe('pending');

        store.getState().setStatus(taskId, 'running');
        expect(store.getState().tasks[taskId].isPending).toBe(true);
        expect(store.getState().tasks[taskId].status).toBe('running');
      });
    });
  });

  describe('Token Management', () => {
    it('should accumulate tokens correctly', () => {
      const store = useChatStore;

      act(() => {
        const taskId = store.getState().create();

        store.getState().addTokens(taskId, 100);
        expect(store.getState().getTokens(taskId)).toBe(100);

        store.getState().addTokens(taskId, 50);
        expect(store.getState().getTokens(taskId)).toBe(150);

        store.getState().addTokens(taskId, 250);
        expect(store.getState().getTokens(taskId)).toBe(400);
      });
    });

    it('should handle negative token additions', () => {
      const store = useChatStore;

      act(() => {
        const taskId = store.getState().create();

        store.getState().addTokens(taskId, 100);
        store.getState().addTokens(taskId, -50);

        expect(store.getState().getTokens(taskId)).toBe(50);
      });
    });

    it('should return 0 tokens for non-existent task', () => {
      const store = useChatStore;

      expect(store.getState().getTokens('non-existent')).toBe(0);
    });

    it('should preserve tokens when creating new task with initial tokens', () => {
      const store = useChatStore;

      act(() => {
        const taskId1 = store.getState().create();
        store.getState().addTokens(taskId1, 500);

        // Simulate new task in same project with accumulated tokens
        const taskId2 = store.getState().create();
        store.getState().addTokens(taskId2, 500); // Cumulative

        expect(store.getState().getTokens(taskId2)).toBe(500);
      });
    });
  });

  describe('Message Management', () => {
    it('should add messages to task', () => {
      const store = useChatStore;

      act(() => {
        const taskId = store.getState().create();

        store.getState().addMessages(taskId, {
          id: generateUniqueId(),
          role: 'user',
          content: 'Hello, world!',
        });

        expect(store.getState().tasks[taskId].messages).toHaveLength(1);
        expect(store.getState().tasks[taskId].messages[0].content).toBe(
          'Hello, world!'
        );
      });
    });

    it('should maintain message order', () => {
      const store = useChatStore;

      act(() => {
        const taskId = store.getState().create();

        store.getState().addMessages(taskId, {
          id: '1',
          role: 'user',
          content: 'First',
        });
        store.getState().addMessages(taskId, {
          id: '2',
          role: 'agent',
          content: 'Second',
        });
        store.getState().addMessages(taskId, {
          id: '3',
          role: 'user',
          content: 'Third',
        });

        const messages = store.getState().tasks[taskId].messages;
        expect(messages).toHaveLength(3);
        expect(messages[0].content).toBe('First');
        expect(messages[1].content).toBe('Second');
        expect(messages[2].content).toBe('Third');
      });
    });

    it('should get last user message', () => {
      const store = useChatStore;

      act(() => {
        const taskId = store.getState().create();
        store.getState().setActiveTaskId(taskId);

        store.getState().addMessages(taskId, {
          id: '1',
          role: 'user',
          content: 'First user message',
        });
        store.getState().addMessages(taskId, {
          id: '2',
          role: 'agent',
          content: 'Agent response',
        });
        store.getState().addMessages(taskId, {
          id: '3',
          role: 'user',
          content: 'Second user message',
        });

        const lastUserMessage = store.getState().getLastUserMessage();
        expect(lastUserMessage?.content).toBe('Second user message');
      });
    });

    it('should return null when no user messages exist', () => {
      const store = useChatStore;

      act(() => {
        const taskId = store.getState().create();
        store.getState().setActiveTaskId(taskId);

        store.getState().addMessages(taskId, {
          id: '1',
          role: 'agent',
          content: 'Agent message',
        });

        const lastUserMessage = store.getState().getLastUserMessage();
        expect(lastUserMessage).toBeNull();
      });
    });

    it('should set messages replacing existing ones', () => {
      const store = useChatStore;

      act(() => {
        const taskId = store.getState().create();

        store.getState().addMessages(taskId, {
          id: '1',
          role: 'user',
          content: 'Original',
        });

        const newMessages = [
          { id: '2', role: 'user' as const, content: 'New 1' },
          { id: '3', role: 'agent' as const, content: 'New 2' },
        ];

        store.getState().setMessages(taskId, newMessages);

        expect(store.getState().tasks[taskId].messages).toHaveLength(2);
        expect(store.getState().tasks[taskId].messages[0].content).toBe(
          'New 1'
        );
      });
    });
  });

  describe('Task Time Tracking', () => {
    it('should track task time', () => {
      const store = useChatStore;

      act(() => {
        const taskId = store.getState().create();
        const startTime = Date.now();

        store.getState().setTaskTime(taskId, startTime);

        expect(store.getState().tasks[taskId].taskTime).toBe(startTime);
      });
    });

    it('should track elapsed time', () => {
      const store = useChatStore;

      act(() => {
        const taskId = store.getState().create();

        store.getState().setElapsed(taskId, 5000);

        expect(store.getState().tasks[taskId].elapsed).toBe(5000);
      });
    });

    it('should format task time correctly', () => {
      const store = useChatStore;

      act(() => {
        const taskId = store.getState().create();

        // Test elapsed time formatting
        store.getState().setTaskTime(taskId, 0);
        store.getState().setElapsed(taskId, 3665000); // 1h 1m 5s

        const formatted = store.getState().getFormattedTaskTime(taskId);
        expect(formatted).toBe('01:01:05');
      });
    });
  });

  describe('Progress Tracking', () => {
    it('should update progress value', () => {
      const store = useChatStore;

      act(() => {
        const taskId = store.getState().create();

        store.getState().setProgressValue(taskId, 50);
        expect(store.getState().tasks[taskId].progressValue).toBe(50);

        store.getState().setProgressValue(taskId, 100);
        expect(store.getState().tasks[taskId].progressValue).toBe(100);
      });
    });

    it('should compute progress based on completed tasks', () => {
      const store = useChatStore;

      act(() => {
        const taskId = store.getState().create();

        // Set up task structure
        store.getState().setTaskRunning(taskId, [
          { id: '1', content: 'Task 1', status: 'completed' },
          { id: '2', content: 'Task 2', status: 'completed' },
          { id: '3', content: 'Task 3', status: 'running' },
          { id: '4', content: 'Task 4', status: 'waiting' },
        ] as any);

        store.getState().computedProgressValue(taskId);

        // 2 out of 4 = 50%
        expect(store.getState().tasks[taskId].progressValue).toBe(50);
      });
    });
  });

  describe('Update Counter', () => {
    it('should increment update count', () => {
      const store = useChatStore;

      const initialCount = store.getState().updateCount;

      act(() => {
        store.getState().setUpdateCount();
      });

      expect(store.getState().updateCount).toBe(initialCount + 1);

      act(() => {
        store.getState().setUpdateCount();
      });

      expect(store.getState().updateCount).toBe(initialCount + 2);
    });
  });

  describe('Task startup', () => {
    it('renders the pending user turn before backend readiness resolves', async () => {
      let resolveBackendReady!: (ready: boolean) => void;
      vi.mocked(waitForBackendReady).mockReturnValueOnce(
        new Promise((resolve) => {
          resolveBackendReady = resolve;
        })
      );

      const store = useChatStore;
      const appendInitChatStore = vi.fn(() => {
        const optimisticTaskId = store.getState().create('optimistic-task');
        store.getState().setActiveTaskId(optimisticTaskId);
        return {
          taskId: optimisticTaskId,
          chatStore: store,
        };
      });
      const getProjectStoreState = vi.mocked(useProjectStore.getState);
      const previousProjectStoreImplementation =
        getProjectStoreState.getMockImplementation();
      getProjectStoreState.mockReturnValue({
        activeProjectId: 'project-1',
        appendInitChatStore,
        getProjectById: () => ({
          id: 'project-1',
          mode: 'single',
          spaceId: 'space-1',
        }),
        getHistoryId: () => null,
      } as any);

      let startPromise!: Promise<void>;
      act(() => {
        const initialTaskId = store.getState().create('initial-task');
        startPromise = store
          .getState()
          .startTask(
            initialTaskId,
            undefined,
            undefined,
            undefined,
            'Resume this project',
            [],
            undefined,
            'project-1',
            'single' as any
          );
      });

      expect(appendInitChatStore).toHaveBeenCalledTimes(1);
      expect(store.getState().tasks['optimistic-task']).toMatchObject({
        isPending: true,
        status: ChatTaskStatus.PENDING,
        messages: [
          expect.objectContaining({
            role: 'user',
            content: 'Resume this project',
          }),
        ],
      });

      resolveBackendReady(false);
      await act(async () => {
        await startPromise;
      });

      expect(store.getState().tasks['optimistic-task']).toMatchObject({
        isPending: false,
        status: ChatTaskStatus.FINISHED,
      });
      if (previousProjectStoreImplementation) {
        getProjectStoreState.mockImplementation(
          previousProjectStoreImplementation
        );
      }
    });
  });

  describe('Cross-store task safety', () => {
    it('does not create phantom tasks through task-scoped setters', () => {
      const store = useChatStore;

      act(() => {
        store.getState().setSelectedFile('missing-task', {
          name: 'missing.md',
          path: '/missing.md',
          type: 'md',
        });
        store.getState().setActiveWorkspace('missing-task', 'workflow');
        store.getState().setActiveAgent('missing-task', 'agent-1');
      });

      expect(store.getState().tasks['missing-task']).toBeUndefined();
    });
  });

  describe('Plan confirmation', () => {
    it('rolls back confirmed plan UI when backend start request fails', async () => {
      vi.mocked(fetchPut).mockRejectedValueOnce(new Error('network down'));
      const store = useChatStore;

      let taskId: string;
      await act(async () => {
        taskId = store.getState().create();
        store.getState().setActiveTaskId(taskId);
        store.getState().setTaskInfo(taskId, [
          {
            id: 'task.1',
            content: 'Do the work',
            status: 'empty',
          } as any,
        ]);
        store.getState().addMessages(taskId, {
          id: generateUniqueId(),
          role: 'agent',
          content: '',
          step: 'to_sub_tasks',
          isConfirm: false,
        });
      });

      await act(async () => {
        await store.getState().handleConfirmTask('project-1', taskId!);
      });

      const task = store.getState().tasks[taskId!];
      const planMessage = task.messages.find(
        (message) => message.step === 'to_sub_tasks'
      );
      expect(planMessage?.isConfirm).toBe(false);
      expect(task.status).toBe(ChatTaskStatus.PENDING);
      expect(task.taskTime).toBe(0);
      expect(fetchPost).not.toHaveBeenCalledWith('/task/project-1/start', {});
    });
  });

  /**
   * Issue #1212: Duplicate task execution after network reconnection / system wake-up.
   * When the task is already FINISHED, SSE onerror must not retry (throw to stop retry).
   */
  describe('SSE onerror - no retry when task already finished (issue #1212)', () => {
    it('should stop retry when task is already FINISHED (avoids duplicate execution)', async () => {
      const mockFetchEventSource = vi.mocked(fetchEventSource);
      mockFetchEventSource.mockImplementation((_url, opts) => {
        // Simulate connection error; when onerror runs, store checks task status
        // and throws to stop retry (issue #1212 fix)
        try {
          opts.onerror?.(new Error('Failed to fetch'));
        } catch {
          // Expected: onerror throws to stop fetch-event-source from retrying
        }
        return Promise.resolve();
      });

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const store = useChatStore;
      const previousProjectStoreState =
        useProjectStore.getState.getMockImplementation();
      useProjectStore.getState.mockReturnValue({
        activeProjectId: 'project-1',
        getHistoryId: () => null,
        setHistoryId: vi.fn(),
        setProjectSpace: vi.fn(),
        getProjectById: () => ({
          id: 'project-1',
          mode: 'single',
          spaceId: 'space-1',
        }),
        appendInitChatStore: vi.fn(() => ({
          taskId: store.getState().activeTaskId,
          chatStore: store,
        })),
        getAllChatStores: vi.fn(() => []),
      } as any);

      // Mock proxyFetchGet to return a valid cloud model key
      const previousProxyFetchGetImpl = proxyFetchGet.getMockImplementation();
      proxyFetchGet.mockResolvedValue({
        value: 'mock-cloud-key',
        api_url: 'http://localhost:8000',
        items: [],
        warning_code: null,
      });

      let taskId: string;
      await act(async () => {
        taskId = store.getState().create();
        store.getState().setActiveTaskId(taskId!);
        store.getState().setStatus(taskId!, ChatTaskStatus.FINISHED);
        store.getState().addMessages(taskId!, {
          id: generateUniqueId(),
          role: 'user',
          content: 'Test message',
        });
        store.getState().setHasMessages(taskId!, true);
      });

      await act(async () => {
        await store
          .getState()
          .startTask(
            taskId!,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            'project-1'
          );
      });

      expect(mockFetchEventSource).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('already finished, stopping retry')
      );

      logSpy.mockRestore();
      if (previousProjectStoreState) {
        useProjectStore.getState.mockImplementation(previousProjectStoreState);
      }
      if (previousProxyFetchGetImpl) {
        proxyFetchGet.mockImplementation(previousProxyFetchGetImpl);
      }
    });
  });

  describe('Replay', () => {
    const replayProjectState = () => ({
      activeProjectId: 'proj-replay',
      getHistoryId: () => null,
      getProjectById: () => ({
        id: 'proj-replay',
        mode: 'single',
        spaceId: 'space-1',
      }),
    });

    beforeEach(() => {
      vi.mocked(useProjectStore.getState).mockImplementation(
        replayProjectState as any
      );
      vi.mocked(proxyFetchGet).mockImplementation((url: string) =>
        url?.includes?.('snapshots')
          ? Promise.resolve([])
          : Promise.resolve({
              value: '',
              api_url: '',
              items: [],
              warning_code: null,
            })
      );
    });

    it('replay() creates task and starts SSE', async () => {
      vi.mocked(fetchEventSource).mockImplementation(() => Promise.resolve());
      const store = useChatStore;

      await act(async () => {
        await store.getState().replay('replay-1', 'Q', 0.2);
      });

      expect(store.getState().tasks['replay-1']).toBeDefined();
      expect(store.getState().activeTaskId).toBe('replay-1');
      expect(fetchEventSource).toHaveBeenCalled();
    });

    it('replay SSE: AbortError does not throw', async () => {
      vi.mocked(fetchEventSource).mockImplementation(() =>
        Promise.reject(new DOMException('', 'AbortError'))
      );
      const store = useChatStore;
      let taskId!: string;
      await act(async () => {
        taskId = store.getState().create();
        store.getState().setHasMessages(taskId, true);
        store.getState().addMessages(taskId, {
          id: generateUniqueId(),
          role: 'user',
          content: 'Q',
        });
      });

      await expect(
        store.getState().startTask(taskId, 'replay', undefined, 0.2)
      ).resolves.toBeUndefined();
    });

    it('replay SSE: unexpected error is logged and rethrown', async () => {
      const err = new Error('SSE failed');
      vi.mocked(fetchEventSource).mockImplementation(() => Promise.reject(err));
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const store = useChatStore;
      let taskId!: string;
      await act(async () => {
        taskId = store.getState().create();
        store.getState().setHasMessages(taskId, true);
        store.getState().addMessages(taskId, {
          id: generateUniqueId(),
          role: 'user',
          content: 'Q',
        });
      });

      await expect(
        store.getState().startTask(taskId, 'replay', undefined, 0.2)
      ).rejects.toThrow('SSE failed');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('SSE stream failed for task'),
        err
      );
      consoleSpy.mockRestore();
    });
  });
});
