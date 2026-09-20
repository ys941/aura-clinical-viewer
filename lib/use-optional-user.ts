"use client";

import { useUser } from "@clerk/nextjs";

import { AUTH_ENABLED } from "@/lib/auth-mode";

type OptionalUser = { user: ReturnType<typeof useUser>["user"] | null; isLoaded: boolean };

/**
 * `useUser()` when Clerk is configured, and a null user when it isn't.
 *
 * AUTH_ENABLED is a build-time constant, so the branch taken never changes
 * between renders and the hook order stays stable.
 */
export function useOptionalUser(): OptionalUser {
  if (!AUTH_ENABLED) return { user: null, isLoaded: true };
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { user, isLoaded } = useUser();
  return { user: user ?? null, isLoaded };
}
