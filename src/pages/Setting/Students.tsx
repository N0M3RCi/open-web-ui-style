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

import { proxyFetchDelete, proxyFetchGet, proxyFetchPost } from '@/api/http';
import { useCallback, useEffect, useState } from 'react';

interface Student {
  id: number;
  email: string;
  name: string | null;
  passcode: string | null;
  created_at: string | null;
  last_active: string | null;
}

export default function Students() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resettingId, setResettingId] = useState<number | null>(null);
  const [newPasscode, setNewPasscode] = useState<string | null>(null);
  const [newPasscodeTarget, setNewPasscodeTarget] = useState<string | null>(
    null
  );

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await proxyFetchGet('/api/v1/admin/students');
      setStudents(data?.items || []);
    } catch {
      setError('Failed to load students. Make sure you are logged in.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStudents();
  }, [fetchStudents]);

  const handleResetPasscode = async (
    studentId: number,
    studentName: string
  ) => {
    setResettingId(studentId);
    setNewPasscode(null);
    try {
      const data = await proxyFetchPost(
        `/api/v1/admin/students/${studentId}/reset-passcode`,
        {}
      );
      if (data?.passcode) {
        setNewPasscode(data.passcode);
        setNewPasscodeTarget(studentName);
        // Refresh list
        void fetchStudents();
      }
    } catch {
      setError('Failed to reset passcode');
    } finally {
      setResettingId(null);
    }
  };

  const handleDelete = async (studentId: number) => {
    if (!window.confirm('Delete this student account? This cannot be undone.'))
      return;
    try {
      await proxyFetchDelete(`/api/v1/admin/students/${studentId}`);
      void fetchStudents();
    } catch {
      setError('Failed to delete student');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-white text-xl font-bold">Students</h2>
        <p className="text-white/60 mt-1 text-sm">
          Manage student accounts and passcodes
        </p>
      </div>

      {error && (
        <div className="border-red-500/30 bg-red-500/10 mb-4 rounded-lg border p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {newPasscode && newPasscodeTarget && (
        <div className="border-amber-500/30 bg-amber-500/10 mb-4 rounded-lg border p-4">
          <p className="text-sm font-semibold text-amber-300">
            New passcode for {newPasscodeTarget}:
          </p>
          <p className="text-white mt-1 text-2xl font-bold tracking-widest">
            {newPasscode}
          </p>
          <p className="text-amber-200/60 mt-1 text-xs">
            This passcode will only be shown once. Copy it now and share it with
            the student.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard
                  .writeText(newPasscode)
                  .then(() => {
                    setNewPasscode(null);
                    setNewPasscodeTarget(null);
                  })
                  .catch(() => {
                    // Fallback: select the text manually
                    const el = document.createElement('textarea');
                    el.value = newPasscode;
                    document.body.appendChild(el);
                    el.select();
                    document.execCommand('copy');
                    document.body.removeChild(el);
                    setNewPasscode(null);
                    setNewPasscodeTarget(null);
                  });
              }}
              className="rounded bg-amber-600/30 px-3 py-1 text-xs text-amber-300 hover:bg-amber-600/50"
            >
              Copy & Dismiss
            </button>
            <button
              type="button"
              onClick={() => {
                setNewPasscode(null);
                setNewPasscodeTarget(null);
              }}
              className="bg-white/10 text-white/60 hover:bg-white/20 rounded px-3 py-1 text-xs"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {students.length === 0 ? (
        <div className="border-white/10 bg-white/5 rounded-lg border p-8 text-center">
          <p className="text-white/60">
            No students yet. Students will appear here once they register.
          </p>
        </div>
      ) : (
        <div className="border-white/10 overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-white/10 bg-white/5 border-b">
                <th className="text-white/70 px-4 py-3 font-medium">Name</th>
                <th className="text-white/70 px-4 py-3 font-medium">
                  Passcode
                </th>
                <th className="text-white/70 px-4 py-3 font-medium">Created</th>
                <th className="text-white/70 px-4 py-3 font-medium">
                  Last Active
                </th>
                <th className="text-white/70 px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr
                  key={student.id}
                  className="border-white/5 hover:bg-white/5 border-b transition-colors"
                >
                  <td className="text-white px-4 py-3">
                    {student.name || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono tracking-wider text-purple-300">
                      {student.passcode ? '••••••' : '—'}
                    </span>
                  </td>
                  <td className="text-white/60 px-4 py-3">
                    {student.created_at
                      ? new Date(student.created_at).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="text-white/60 px-4 py-3">
                    {student.last_active
                      ? new Date(student.last_active).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={resettingId === student.id}
                        onClick={() =>
                          handleResetPasscode(
                            student.id,
                            student.name || 'Student'
                          )
                        }
                        className="rounded bg-purple-600/30 px-2.5 py-1 text-xs text-purple-300 transition-colors hover:bg-purple-600/50 disabled:opacity-50"
                      >
                        {resettingId === student.id ? '...' : 'Reset'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(student.id)}
                        className="rounded bg-red-600/30 px-2.5 py-1 text-xs text-red-300 transition-colors hover:bg-red-600/50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
