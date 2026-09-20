/**
 * Auth is optional.
 *
 * Aura normally signs people in with Clerk. When no Clerk publishable key is
 * configured the app runs open instead of crashing — useful for a local
 * single-user install, and for the public viewer-only demo.
 *
 * Both flags are build-time constants, so the bundler drops the dead branch.
 */
export const AUTH_ENABLED = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

/** The public demo: viewer only, no server, no sign-in. */
export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO === "1";
