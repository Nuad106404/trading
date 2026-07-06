"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { UsersClient } from "@/components/users/users-client";
import { useAuth } from "@/lib/auth-context";

export default function AdminUsersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // client-side role gate on top of the middleware cookie check
  useEffect(() => {
    if (!loading && user && user.role === "user") router.replace("/profile");
  }, [loading, user, router]);

  if (loading || !user || user.role === "user") return null;

  return <UsersClient currentUser={user} />;
}
