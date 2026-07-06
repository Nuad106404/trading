"use client";

import { Megaphone } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";

export function BroadcastDialog({ users }: { users: User[] }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [target, setTarget] = useState("all");
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    try {
      const { delivered } = await api<{ delivered: number }>("/push/broadcast", {
        method: "POST",
        body: { title, body, url: url || undefined, target },
      });
      toast.success(`Broadcast sent to ${delivered} device${delivered === 1 ? "" : "s"}.`);
      setOpen(false);
      setTitle("");
      setBody("");
      setUrl("");
      setTarget("all");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Broadcast failed.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Megaphone className="h-4 w-4" />
          Broadcast
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send push broadcast</DialogTitle>
          <DialogDescription>
            Delivers a push notification to every subscribed device of the selected target.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="bc-title">Title</Label>
            <Input
              id="bc-title"
              required
              maxLength={100}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bc-body">Message</Label>
            <Input
              id="bc-body"
              required
              maxLength={500}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bc-url">URL (optional, opened on click)</Label>
            <Input
              id="bc-url"
              placeholder="/admin/users"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bc-target">Target</Label>
            <Select id="bc-target" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="all">All users</option>
              <option value="admins">Admins & superadmins</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username} ({u.role})
                </option>
              ))}
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Sending…" : "Send broadcast"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
