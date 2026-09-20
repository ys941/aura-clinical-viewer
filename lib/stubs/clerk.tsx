"use client";

/**
 * A stand-in for `@clerk/nextjs` used only by the static demo build, which has
 * no server and no sign-in. Importing the real package pulls Server Actions
 * into the bundle, which a static export cannot contain — so the demo build
 * aliases the package to this file (see next.config.mjs).
 *
 * Every export here is inert: with AUTH_ENABLED false, none of it is rendered.
 */
import type { ReactNode } from "react";

export function ClerkProvider({ children }: { children: ReactNode; [key: string]: unknown }) {
  return <>{children}</>;
}

export function UserButton(_props: Record<string, unknown>) {
  return null;
}

export function UserProfile(_props: Record<string, unknown>) {
  return null;
}

export function SignIn(_props: Record<string, unknown>) {
  return null;
}

export function SignUp(_props: Record<string, unknown>) {
  return null;
}

export function useUser() {
  return { user: null, isLoaded: true, isSignedIn: false };
}
