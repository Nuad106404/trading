"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  KeyRound,
  Lock,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
  WifiOff,
  Pause,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BulkBar, RowCheckbox } from "@/components/bulk-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import type { Paginated, User, UserStats } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { BroadcastDialog } from "./broadcast-dialog";
import { StatCards } from "./stat-cards";
import {
  ConfirmDeleteDialog,
  ResetPasswordDialog,
  UserFormDialog,
  type UserFormValues,
} from "./user-dialogs";

const ROLE_BADGE: Record<User["role"], "default" | "warning" | "secondary"> = {
  superadmin: "warning",
  admin: "default",
  user: "secondary",
};

const SORTABLE: { key: string; label: string }[] = [
  { key: "username", label: "Username" },
  { key: "email", label: "Email" },
  { key: "fullName", label: "Full name" },
  { key: "role", label: "Role" },
  { key: "status", label: "Status" },
  { key: "lastLoginAt", label: "Last login" },
  { key: "createdAt", label: "Created" },
];

function mutationErrorToast(err: unknown, fallback: string) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    // Background Sync (production SW) has queued this request for replay
    toast.info("You're offline — the change was queued and will sync when you're back online.");
    return;
  }
  toast.error(err instanceof Error ? err.message : fallback);
}

export function UsersClient({ currentUser }: { currentUser: User }) {
  const queryClient = useQueryClient();
  const isSuperadmin = currentUser.role === "superadmin";

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [deleting, setDeleting] = useState<User | null>(null);
  const [resetting, setResetting] = useState<User | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      sortBy,
      sortOrder,
    });
    if (search) params.set("search", search);
    if (role) params.set("role", role);
    if (status) params.set("status", status);
    return params.toString();
  }, [page, limit, search, role, status, sortBy, sortOrder]);

  const usersQuery = useQuery({
    queryKey: ["users", queryString],
    queryFn: () => api<Paginated<User>>(`/users?${queryString}`),
  });

  useEffect(() => setSelected(new Set()), [queryString]);

  const statsQuery = useQuery({
    queryKey: ["users", "stats"],
    queryFn: () => api<UserStats>("/users/stats"),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["users"] });

  const createMutation = useMutation({
    mutationFn: (values: UserFormValues) =>
      api<User>("/users", {
        method: "POST",
        body: {
          username: values.username.toLowerCase(),
          email: values.email,
          password: values.password,
          fullName: values.fullName || undefined,
          role: isSuperadmin ? values.role : "user",
          status: values.status,
        },
      }),
    onSuccess: () => {
      toast.success("User created.");
      setFormOpen(false);
      void invalidate();
    },
    onError: (err) => mutationErrorToast(err, "Failed to create user."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: UserFormValues }) =>
      api<User>(`/users/${id}`, {
        method: "PATCH",
        body: {
          email: values.email,
          fullName: values.fullName,
          ...(isSuperadmin ? { role: values.role } : {}),
          status: values.status,
        },
      }),
    onSuccess: () => {
      toast.success("User updated.");
      setFormOpen(false);
      setEditing(null);
      void invalidate();
    },
    onError: (err) => mutationErrorToast(err, "Failed to update user."),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: "active" | "suspended" }) =>
      api<User>(`/users/${id}/status`, { method: "PATCH", body: { status: next } }),
    onSuccess: (updated) => {
      toast.success(`${updated.username} is now ${updated.status}.`);
      void invalidate();
    },
    onError: (err) => mutationErrorToast(err, "Failed to change status."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("User deleted.");
      setDeleting(null);
      void invalidate();
    },
    onError: (err) => mutationErrorToast(err, "Failed to delete user."),
  });

  const resetMutation = useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
      api(`/users/${id}/reset-password`, { method: "POST", body: { newPassword } }),
    onSuccess: () => {
      toast.success("Password reset.");
      setResetting(null);
    },
    onError: (err) => mutationErrorToast(err, "Failed to reset password."),
  });

  const bulkStatusMutation = useMutation({
    mutationFn: ({ ids, next }: { ids: string[]; next: "active" | "suspended" }) =>
      api<{ updated: number; skipped: { id: string; reason: string }[] }>("/users/bulk/status", {
        method: "POST",
        body: { ids, status: next },
      }),
    onSuccess: (result) => {
      toast.success(
        `${result.updated} user${result.updated === 1 ? "" : "s"} updated.` +
          (result.skipped.length > 0 ? ` ${result.skipped.length} skipped.` : ""),
      );
      setSelected(new Set());
      void invalidate();
    },
    onError: (err) => mutationErrorToast(err, "Bulk status change failed."),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) =>
      api<{ deleted: number; skipped: { id: string; reason: string }[] }>("/users/bulk/delete", {
        method: "POST",
        body: { ids },
      }),
    onSuccess: (result) => {
      toast.success(
        `${result.deleted} user${result.deleted === 1 ? "" : "s"} deleted.` +
          (result.skipped.length > 0 ? ` ${result.skipped.length} skipped.` : ""),
      );
      setSelected(new Set());
      setBulkConfirm(false);
      void invalidate();
    },
    onError: (err) => mutationErrorToast(err, "Bulk delete failed."),
  });

  const toggleRow = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleSort = (key: string) => {
    if (sortBy === key) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortOrder("asc");
    }
    setPage(1);
  };

  /** admins may only act on user-role rows; nobody touches protected rows */
  const canManage = (target: User) =>
    !target.isProtected && (isSuperadmin || target.role === "user");

  /** rows eligible for bulk actions: manageable and not yourself */
  const canBulk = (target: User) => canManage(target) && target.id !== currentUser.id;

  const result = usersQuery.data;
  const bulkEligible = result?.data.filter(canBulk) ?? [];
  const allEligibleSelected =
    bulkEligible.length > 0 && bulkEligible.every((u) => selected.has(u.id));
  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1;
  const isOffline = usersQuery.isError && typeof navigator !== "undefined" && !navigator.onLine;

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold sm:text-2xl">Users</h1>
        <div className="flex items-center gap-2">
          <BroadcastDialog users={result?.data ?? []} />
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add user
          </Button>
        </div>
      </div>

      <StatCards stats={statsQuery.data} />

      <Card>
        <CardContent className="flex flex-col gap-4 p-4">
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(searchInput.trim());
              setPage(1);
            }}
          >
            <div className="relative min-w-52 flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search username, email or name…"
                className="pl-8"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <Select
              className="w-36"
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All roles</option>
              <option value="superadmin">superadmin</option>
              <option value="admin">admin</option>
              <option value="user">user</option>
            </Select>
            <Select
              className="w-36"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="active">active</option>
              <option value="suspended">suspended</option>
            </Select>
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>

          <BulkBar count={selected.size} onClear={() => setSelected(new Set())}>
            <Button
              variant="outline"
              size="sm"
              disabled={bulkStatusMutation.isPending}
              onClick={() => bulkStatusMutation.mutate({ ids: [...selected], next: "active" })}
            >
              <Play className="h-4 w-4" />
              Activate
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={bulkStatusMutation.isPending}
              onClick={() => bulkStatusMutation.mutate({ ids: [...selected], next: "suspended" })}
            >
              <Pause className="h-4 w-4" />
              Suspend
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setBulkConfirm(true)}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </BulkBar>

          {isOffline ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
              <WifiOff className="h-8 w-8" />
              <p className="text-sm">You&apos;re offline — reconnect to load data.</p>
            </div>
          ) : usersQuery.isError ? (
            <div className="py-12 text-center text-sm text-destructive">
              {usersQuery.error instanceof Error
                ? usersQuery.error.message
                : "Failed to load users."}
            </div>
          ) : usersQuery.isPending ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading users…</div>
          ) : result && result.data.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No users match these filters.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <RowCheckbox
                      checked={allEligibleSelected}
                      onChange={() =>
                        setSelected(
                          allEligibleSelected ? new Set() : new Set(bulkEligible.map((u) => u.id)),
                        )
                      }
                      disabled={bulkEligible.length === 0}
                      label="Select all"
                    />
                  </TableHead>
                  {SORTABLE.map(({ key, label }) => (
                    <TableHead key={key}>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-foreground"
                        onClick={() => toggleSort(key)}
                      >
                        {label}
                        {sortBy === key ? (
                          sortOrder === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </button>
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result?.data.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <RowCheckbox
                        checked={selected.has(u.id)}
                        onChange={() => toggleRow(u.id)}
                        disabled={!canBulk(u)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-2">
                        {u.username}
                        {u.isProtected && (
                          <Badge variant="warning" className="gap-1">
                            <Lock className="h-3 w-3" />
                            Protected
                          </Badge>
                        )}
                        {u.id === currentUser.id && <Badge variant="outline">You</Badge>}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>{u.fullName || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={ROLE_BADGE[u.role]}>{u.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.status === "active" ? "success" : "destructive"}>
                        {u.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(u.lastLoginAt)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(u.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {canManage(u) && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Edit"
                              onClick={() => {
                                setEditing(u);
                                setFormOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title={u.status === "active" ? "Suspend" : "Activate"}
                              disabled={u.id === currentUser.id || statusMutation.isPending}
                              onClick={() =>
                                statusMutation.mutate({
                                  id: u.id,
                                  next: u.status === "active" ? "suspended" : "active",
                                })
                              }
                            >
                              {u.status === "active" ? (
                                <Pause className="h-4 w-4" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </Button>
                            {isSuperadmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Reset password"
                                onClick={() => setResetting(u)}
                              >
                                <KeyRound className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Delete"
                              className="text-destructive hover:text-destructive"
                              disabled={u.id === currentUser.id}
                              onClick={() => setDeleting(u)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {result && result.total > 0 && (
            <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
              <span>
                Page {result.page} of {totalPages} · {result.total} user
                {result.total === 1 ? "" : "s"}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <UserFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        editing={editing}
        isSuperadmin={isSuperadmin}
        pending={createMutation.isPending || updateMutation.isPending}
        onSubmit={(values) => {
          if (editing) updateMutation.mutate({ id: editing.id, values });
          else createMutation.mutate(values);
        }}
      />

      <Dialog open={bulkConfirm} onOpenChange={setBulkConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selected.size} selected user{selected.size === 1 ? "" : "s"}?</DialogTitle>
            <DialogDescription>
              The selected accounts will be permanently removed — this cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setBulkConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={bulkDeleteMutation.isPending}
              onClick={() => bulkDeleteMutation.mutate([...selected])}
            >
              {bulkDeleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        user={deleting}
        pending={deleteMutation.isPending}
        onOpenChange={(open) => !open && setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />

      <ResetPasswordDialog
        user={resetting}
        pending={resetMutation.isPending}
        onOpenChange={(open) => !open && setResetting(null)}
        onConfirm={(newPassword) =>
          resetting && resetMutation.mutate({ id: resetting.id, newPassword })
        }
      />
    </div>
  );
}
