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

import {
  proxyFetchDelete,
  proxyFetchGet,
  proxyFetchPost,
  proxyFetchPut,
} from '@/api/http';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthStore } from '@/store/authStore';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

interface UserItem {
  id: number;
  email: string;
  username: string | null;
  nickname: string | null;
  fullname: string | null;
  credits: number;
  status: number;
  role: string;
  created_at: string | null;
  updated_at: string | null;
}

interface UserListResponse {
  items: UserItem[];
  total: number;
  page: number;
  page_size: number;
}

interface UserDetail {
  id: number;
  email: string;
  username: string | null;
  nickname: string | null;
  fullname: string | null;
  credits: number;
  status: number;
  role: string;
  created_at: string | null;
  updated_at: string | null;
  stats: {
    download_count: number;
    register_count: number;
    task_complete_count: number;
    task_failed_count: number;
    file_download_count: number;
    file_generate_count: number;
    paid_amount_on_avg_task: number;
    task_queries: number;
    mcp_install_count: number;
    storage_used: number;
  } | null;
}

const PAGE_SIZE = 20;

export default function AdminUsers() {
  const { t } = useTranslation();
  const { token } = useAuthStore();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Create/Edit modal state
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formNickname, setFormNickname] = useState('');
  const [formFullname, setFormFullname] = useState('');
  const [formCredits, setFormCredits] = useState('0');
  const [formStatus, setFormStatus] = useState('1');
  const [formRole, setFormRole] = useState('user');
  const [formSubmitting, setFormSubmitting] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchUsers = async (p: number, q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        page_size: String(PAGE_SIZE),
      });
      if (q) params.set('search', q);
      const data = await proxyFetchGet(
        `/api/v1/admin/users?${params.toString()}`
      );
      setUsers(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      console.error('Failed to fetch users', err);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(page, search);
  }, [page, search]);

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const openCreateForm = () => {
    setEditingUser(null);
    setFormEmail('');
    setFormPassword('');
    setFormUsername('');
    setFormNickname('');
    setFormFullname('');
    setFormCredits('0');
    setFormStatus('1');
    setFormRole('user');
    setShowForm(true);
  };

  const openEditForm = (user: UserItem) => {
    setEditingUser(user);
    setFormEmail(user.email);
    setFormPassword('');
    setFormUsername(user.username ?? '');
    setFormNickname(user.nickname ?? '');
    setFormFullname(user.fullname ?? '');
    setFormCredits(String(user.credits));
    setFormStatus(String(user.status));
    setFormRole(user.role || 'user');
    setShowForm(true);
  };

  const handleFormSubmit = async () => {
    if (!formEmail) {
      toast.error('Email is required');
      return;
    }
    if (!editingUser && !formPassword) {
      toast.error('Password is required for new users');
      return;
    }

    setFormSubmitting(true);
    try {
      if (editingUser) {
        const body: Record<string, any> = {
          email: formEmail,
          username: formUsername || null,
          nickname: formNickname || null,
          fullname: formFullname || null,
          credits: Number(formCredits),
          status: Number(formStatus),
          role: formRole,
        };
        if (formPassword) {
          // Password update via separate field — backend handles it
          // For now just update other fields
        }
        await proxyFetchPut(`/api/v1/admin/users/${editingUser.id}`, body);
        toast.success('User updated');
      } else {
        await proxyFetchPost('/api/v1/admin/users', {
          email: formEmail,
          password: formPassword,
          username: formUsername || null,
          nickname: formNickname || null,
          fullname: formFullname || null,
          credits: Number(formCredits),
          role: formRole,
        });
        toast.success('User created');
      }
      setShowForm(false);
      fetchUsers(page, search);
    } catch (err: any) {
      toast.error(err?.message || 'Operation failed');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteUser = async (user: UserItem) => {
    if (!window.confirm(`Delete user ${user.email}?`)) return;
    try {
      await proxyFetchDelete(`/api/v1/admin/users/${user.id}`);
      toast.success('User deleted');
      fetchUsers(page, search);
      setSelectedUser(null);
    } catch (err: any) {
      toast.error(err?.message || 'Delete failed');
    }
  };

  const viewUserDetail = async (userId: number) => {
    setDetailLoading(true);
    try {
      const data = await proxyFetchGet(`/api/v1/admin/users/${userId}`);
      setSelectedUser(data);
    } catch (err) {
      toast.error('Failed to load user details');
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-1 flex-col gap-4 px-1 pb-1 pt-10">
      <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-ds-bg-neutral-subtle-default">
        <div className="flex items-center justify-between border-b border-ds-border-neutral-subtle-disabled px-6 py-4">
          <h1 className="text-heading-sm font-bold text-ds-text-neutral-default-default">
            User Management
          </h1>
          <Button
            onClick={openCreateForm}
            className="text-white bg-ds-bg-brand-default-default px-4 py-2 text-body-sm font-semibold hover:bg-ds-bg-brand-subtle-hover"
          >
            + Create User
          </Button>
        </div>

        <div className="flex items-center gap-2 px-6 py-3">
          <Input
            placeholder="Search by email, username, nickname..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="h-9 max-w-sm"
          />
          <Button
            onClick={handleSearch}
            className="h-9 bg-ds-bg-neutral-default-hover px-3 text-body-sm"
          >
            Search
          </Button>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Users table */}
          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-ds-border-brand-default-focus" />
            </div>
          ) : (
            <div className="flex flex-1 flex-row overflow-hidden">
              <div className="flex flex-1 flex-col overflow-auto">
                <table className="w-full text-left text-body-sm">
                  <thead>
                    <tr className="border-b border-ds-border-neutral-subtle-disabled text-label-xs text-ds-text-neutral-muted-default">
                      <th className="px-6 py-3 font-medium">ID</th>
                      <th className="px-6 py-3 font-medium">Email</th>
                      <th className="px-6 py-3 font-medium">Username</th>
                      <th className="px-6 py-3 font-medium">Nickname</th>
                      <th className="px-6 py-3 font-medium">Credits</th>
                      <th className="px-6 py-3 font-medium">Role</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium">Created</th>
                      <th className="px-6 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr>
                        <td
                          colSpan={9}
                          className="px-6 py-12 text-center text-body-sm text-ds-text-neutral-muted-default"
                        >
                          No users found
                        </td>
                      </tr>
                    ) : (
                      users.map((user) => (
                        <tr
                          key={user.id}
                          className="border-b border-ds-border-neutral-subtle-disabled transition-colors hover:bg-ds-bg-neutral-default-hover"
                        >
                          <td className="px-6 py-3 font-mono text-label-xs">
                            {user.id}
                          </td>
                          <td className="px-6 py-3">{user.email}</td>
                          <td className="px-6 py-3">{user.username || '-'}</td>
                          <td className="px-6 py-3">{user.nickname || '-'}</td>
                          <td className="px-6 py-3">{user.credits}</td>
                          <td className="px-6 py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-label-xs font-medium ${
                                user.role === 'admin'
                                  ? 'bg-ds-bg-status-completed-subtle-default text-ds-text-status-completed-subtle-default'
                                  : user.role === 'student'
                                    ? 'bg-purple-100 text-purple-700'
                                    : 'bg-ds-bg-neutral-default-hover text-ds-text-neutral-muted-default'
                              }`}
                            >
                              {user.role || 'user'}
                            </span>
                          </td>
                          <td className="px-6 py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-label-xs font-medium ${
                                user.status === 1
                                  ? 'bg-ds-bg-status-completed-subtle-default text-ds-text-status-completed-subtle-default'
                                  : 'bg-ds-bg-status-error-subtle-default text-ds-text-status-error-subtle-default'
                              }`}
                            >
                              {user.status === 1 ? 'Active' : 'Blocked'}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-label-xs text-ds-text-neutral-muted-default">
                            {user.created_at
                              ? new Date(user.created_at).toLocaleDateString()
                              : '-'}
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => viewUserDetail(user.id)}
                                className="rounded px-2 py-1 text-label-xs text-ds-text-brand-muted-default transition-colors hover:bg-ds-bg-brand-subtle-default"
                              >
                                View
                              </button>
                              <button
                                onClick={() => openEditForm(user)}
                                className="rounded px-2 py-1 text-label-xs text-ds-text-brand-muted-default transition-colors hover:bg-ds-bg-brand-subtle-default"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user)}
                                className="rounded px-2 py-1 text-label-xs text-ds-text-status-error-subtle-default transition-colors hover:bg-ds-bg-status-error-subtle-default"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-ds-border-neutral-subtle-disabled px-6 py-3">
                    <span className="text-label-xs text-ds-text-neutral-muted-default">
                      {total} total users
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="rounded px-3 py-1 text-label-xs text-ds-text-brand-muted-default transition-colors hover:bg-ds-bg-brand-subtle-default disabled:opacity-40"
                      >
                        Previous
                      </button>
                      <span className="text-label-xs text-ds-text-neutral-muted-default">
                        {page} / {totalPages}
                      </span>
                      <button
                        onClick={() =>
                          setPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={page >= totalPages}
                        className="rounded px-3 py-1 text-label-xs text-ds-text-brand-muted-default transition-colors hover:bg-ds-bg-brand-subtle-default disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Detail panel */}
              {selectedUser && (
                <div className="w-80 shrink-0 overflow-auto border-l border-ds-border-neutral-subtle-disabled p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-label-sm font-semibold text-ds-text-neutral-default-default">
                      User Details
                    </h3>
                    <button
                      onClick={() => setSelectedUser(null)}
                      className="text-ds-text-neutral-muted-default hover:text-ds-text-neutral-default-default"
                    >
                      X
                    </button>
                  </div>
                  {detailLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-ds-border-brand-default-focus" />
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 text-body-sm">
                      <div>
                        <span className="text-label-xs text-ds-text-neutral-muted-default">
                          Email
                        </span>
                        <p>{selectedUser.email}</p>
                      </div>
                      <div>
                        <span className="text-label-xs text-ds-text-neutral-muted-default">
                          Username
                        </span>
                        <p>{selectedUser.username || '-'}</p>
                      </div>
                      <div>
                        <span className="text-label-xs text-ds-text-neutral-muted-default">
                          Nickname
                        </span>
                        <p>{selectedUser.nickname || '-'}</p>
                      </div>
                      <div>
                        <span className="text-label-xs text-ds-text-neutral-muted-default">
                          Credits
                        </span>
                        <p>{selectedUser.credits}</p>
                      </div>
                      <div>
                        <span className="text-label-xs text-ds-text-neutral-muted-default">
                          Status
                        </span>
                        <p
                          className={
                            selectedUser.status === 1
                              ? 'text-ds-text-status-completed-subtle-default'
                              : 'text-ds-text-status-error-subtle-default'
                          }
                        >
                          {selectedUser.status === 1 ? 'Active' : 'Blocked'}
                        </p>
                      </div>
                      <div>
                        <span className="text-label-xs text-ds-text-neutral-muted-default">
                          Role
                        </span>
                        <p
                          className={
                            selectedUser.role === 'admin'
                              ? 'text-ds-text-status-completed-subtle-default'
                              : 'text-ds-text-neutral-muted-default'
                          }
                        >
                          {selectedUser.role || 'user'}
                        </p>
                      </div>
                      <div>
                        <span className="text-label-xs text-ds-text-neutral-muted-default">
                          Joined
                        </span>
                        <p>
                          {selectedUser.created_at
                            ? new Date(
                                selectedUser.created_at
                              ).toLocaleDateString()
                            : '-'}
                        </p>
                      </div>
                      {selectedUser.stats && (
                        <>
                          <div className="my-2 border-t border-ds-border-neutral-subtle-disabled" />
                          <h4 className="text-label-xs font-semibold text-ds-text-neutral-default-default">
                            Statistics
                          </h4>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-label-xs text-ds-text-neutral-muted-default">
                                Tasks
                              </span>
                              <p>{selectedUser.stats.task_complete_count}</p>
                            </div>
                            <div>
                              <span className="text-label-xs text-ds-text-neutral-muted-default">
                                Queries
                              </span>
                              <p>{selectedUser.stats.task_queries}</p>
                            </div>
                            <div>
                              <span className="text-label-xs text-ds-text-neutral-muted-default">
                                Downloads
                              </span>
                              <p>{selectedUser.stats.download_count}</p>
                            </div>
                            <div>
                              <span className="text-label-xs text-ds-text-neutral-muted-default">
                                MCPs
                              </span>
                              <p>{selectedUser.stats.mcp_install_count}</p>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="bg-black/50 fixed inset-0 z-50 flex items-center justify-center">
          <div className="w-full max-w-md rounded-2xl bg-ds-bg-neutral-default-default p-6 shadow-lg">
            <h2 className="mb-4 text-label-lg font-bold text-ds-text-neutral-default-default">
              {editingUser ? 'Edit User' : 'Create User'}
            </h2>
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-label-xs text-ds-text-neutral-muted-default">
                  Email *
                </label>
                <Input
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="h-9"
                />
              </div>
              <div>
                <label className="mb-1 block text-label-xs text-ds-text-neutral-muted-default">
                  {editingUser
                    ? 'New Password (leave blank to keep)'
                    : 'Password *'}
                </label>
                <Input
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder={
                    editingUser
                      ? 'Leave blank to keep current'
                      : 'Min 8 chars, letters + numbers'
                  }
                  className="h-9"
                />
              </div>
              <div>
                <label className="mb-1 block text-label-xs text-ds-text-neutral-muted-default">
                  Username
                </label>
                <Input
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  className="h-9"
                />
              </div>
              <div>
                <label className="mb-1 block text-label-xs text-ds-text-neutral-muted-default">
                  Nickname
                </label>
                <Input
                  value={formNickname}
                  onChange={(e) => setFormNickname(e.target.value)}
                  className="h-9"
                />
              </div>
              <div>
                <label className="mb-1 block text-label-xs text-ds-text-neutral-muted-default">
                  Full Name
                </label>
                <Input
                  value={formFullname}
                  onChange={(e) => setFormFullname(e.target.value)}
                  className="h-9"
                />
              </div>
              <div>
                <label className="mb-1 block text-label-xs text-ds-text-neutral-muted-default">
                  Role
                </label>
                <Select value={formRole} onValueChange={setFormRole}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="student">Student</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-label-xs text-ds-text-neutral-muted-default">
                    Credits
                  </label>
                  <Input
                    type="number"
                    value={formCredits}
                    onChange={(e) => setFormCredits(e.target.value)}
                    className="h-9"
                  />
                </div>
                {editingUser && (
                  <div className="flex-1">
                    <label className="mb-1 block text-label-xs text-ds-text-neutral-muted-default">
                      Status
                    </label>
                    <Select value={formStatus} onValueChange={setFormStatus}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Active</SelectItem>
                        <SelectItem value="-1">Blocked</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                onClick={() => setShowForm(false)}
                className="h-9 border border-ds-border-neutral-default-default bg-transparent px-4 text-body-sm text-ds-text-neutral-default-default"
              >
                Cancel
              </Button>
              <Button
                onClick={handleFormSubmit}
                disabled={formSubmitting}
                className="text-white h-9 bg-ds-bg-brand-default-default px-4 text-body-sm hover:bg-ds-bg-brand-subtle-hover"
              >
                {formSubmitting
                  ? 'Saving...'
                  : editingUser
                    ? 'Save Changes'
                    : 'Create User'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
