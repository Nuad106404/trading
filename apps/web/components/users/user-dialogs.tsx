"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { User, UserRole, UserStatus } from "@/lib/types";

export interface UserFormValues {
  username: string;
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
}

const EMPTY: UserFormValues = {
  username: "",
  email: "",
  password: "",
  fullName: "",
  role: "user",
  status: "active",
};

export function UserFormDialog({
  open,
  onOpenChange,
  editing,
  isSuperadmin,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null → create mode */
  editing: User | null;
  isSuperadmin: boolean;
  pending: boolean;
  onSubmit: (values: UserFormValues) => void;
}) {
  const [values, setValues] = useState<UserFormValues>(EMPTY);

  useEffect(() => {
    if (!open) return;
    setValues(
      editing
        ? {
            username: editing.username,
            email: editing.email,
            password: "",
            fullName: editing.fullName ?? "",
            role: editing.role,
            status: editing.status,
          }
        : EMPTY,
    );
  }, [open, editing]);

  const set = <K extends keyof UserFormValues>(key: K, value: UserFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${editing.username}` : "Add user"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update account details."
              : "Create a new account. The user can change their password later."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!editing && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="uf-username">Username</Label>
              <Input
                id="uf-username"
                required
                minLength={3}
                maxLength={30}
                value={values.username}
                onChange={(e) => set("username", e.target.value)}
              />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="uf-email">Email</Label>
            <Input
              id="uf-email"
              type="email"
              required
              value={values.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="uf-fullname">Full name</Label>
            <Input
              id="uf-fullname"
              value={values.fullName}
              onChange={(e) => set("fullName", e.target.value)}
            />
          </div>
          {!editing && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="uf-password">Password</Label>
              <Input
                id="uf-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={values.password}
                onChange={(e) => set("password", e.target.value)}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            {/* role selector only for superadmin — admins create/keep user-role accounts */}
            {isSuperadmin && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="uf-role">Role</Label>
                <Select
                  id="uf-role"
                  value={values.role}
                  onChange={(e) => set("role", e.target.value as UserRole)}
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                  <option value="superadmin">superadmin</option>
                </Select>
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="uf-status">Status</Label>
              <Select
                id="uf-status"
                value={values.status}
                onChange={(e) => set("status", e.target.value as UserStatus)}
              >
                <option value="active">active</option>
                <option value="suspended">suspended</option>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : editing ? "Save changes" : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ConfirmDeleteDialog({
  user,
  pending,
  onOpenChange,
  onConfirm,
}: {
  user: User | null;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {user?.username}?</DialogTitle>
          <DialogDescription>
            This permanently removes the account and cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ResetPasswordDialog({
  user,
  pending,
  onOpenChange,
  onConfirm,
}: {
  user: User | null;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (newPassword: string) => void;
}) {
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!user) setPassword("");
  }, [user]);

  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password for {user?.username}</DialogTitle>
          <DialogDescription>
            Set a new password. Share it with the user through a secure channel.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onConfirm(password);
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="rp-password">New password</Label>
            <Input
              id="rp-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Resetting…" : "Reset password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
