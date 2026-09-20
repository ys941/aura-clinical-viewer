/**
 * Builds the public demo: the DICOM viewer, running entirely in the browser.
 *
 * The demo is a static site, so everything that needs a server is taken out of
 * the build — the API routes, the Clerk middleware, the attribution gate (a
 * server hook) and the sign-in and settings pages. Those files are restored
 * from git as soon as the build finishes, including if it fails, so running
 * this locally leaves the working tree exactly as it was.
 *
 * A normal `npm run build` is untouched by any of this.
 */
import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";

const SERVER_ONLY = [
  "middleware.ts",
  "instrumentation.ts",
  "app/api",
  "app/login",
  "app/signup",
  "app/(app)/settings",
];

const BASE_PATH = "/aura-clinical-viewer";

const git = (args) => execFileSync("git", args, { encoding: "utf8" });
const run = (cmd, args, env) =>
  execFileSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32", env });

// Refuse to run if any of these files have uncommitted changes — restoring
// them afterwards would throw that work away.
const dirty = git(["status", "--porcelain", "--", ...SERVER_ONLY]).trim();
if (dirty) {
  console.error("Uncommitted changes in files this build removes and restores:\n" + dirty);
  console.error("\nCommit or stash them first.");
  process.exit(1);
}

// The sample study is generated, never committed.
run("node", ["scripts/make-sample-study.mjs"], process.env);

for (const path of SERVER_ONLY) rmSync(path, { recursive: true, force: true });

try {
  run("npx", ["next", "build"], {
    ...process.env,
    GITHUB_PAGES: "1",
    NEXT_PUBLIC_DEMO: "1",
    // Served from https://ys941.github.io/aura-clinical-viewer/ — used for the
    // Next basePath and for /public asset URLs (lib/asset.ts).
    NEXT_PUBLIC_BASE_PATH: BASE_PATH,
    // Force auth off, so the demo never bundles Clerk even when a local
    // .env.local has keys in it.
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "",
    CLERK_SECRET_KEY: "",
  });
} finally {
  for (const path of SERVER_ONLY) {
    if (!existsSync(path)) git(["checkout", "--", path]);
  }
}
