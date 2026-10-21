import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspace = mkdtempSync(join(dirname(root), "autokas-mobile-"));
const output = join(root, "out");
const excluded = new Set([
  ".git",
  ".next",
  ".mobile-build",
  "android",
  "node_modules",
  "out",
  ".vercel",
  "coverage",
]);

try {
  cpSync(root, workspace, {
    recursive: true,
    filter(source) {
      const relativePath = relative(root, source);
      if (!relativePath) return true;
      return !relativePath.split(/[\\/]/).some((part) => excluded.has(part));
    },
  });

  const serverOnlyRoutes = [
    "middleware.ts",
    "src/app/api/extract/route.ts",
    "src/app/auth/login/route.ts",
    "src/app/auth/callback/route.ts",
    "src/app/transactions/[id]/page.tsx",
  ];
  for (const file of serverOnlyRoutes) {
    rmSync(join(workspace, file), { force: true });
  }

  const serverOnlyDirectories = [
    "src/app/api/extract",
    "src/app/api",
    "src/app/auth/login",
    "src/app/auth/callback",
    "src/app/auth",
    "src/app/transactions/[id]",
  ];
  for (const directory of serverOnlyDirectories) {
    rmSync(join(workspace, directory), { recursive: true, force: true });
  }

  const localDependencies = join(root, "node_modules");
  if (!existsSync(localDependencies)) {
    throw new Error("node_modules is missing; run npm install before building the mobile bundle.");
  }
  symlinkSync(localDependencies, join(workspace, "node_modules"), "junction");

  const nextCli = join(localDependencies, "next", "dist", "bin", "next");
  const result = spawnSync(process.execPath, [nextCli, "build"], {
    cwd: workspace,
    stdio: "inherit",
    env: {
      ...process.env,
      AUTOKAS_MOBILE_BUILD: "true",
      AUTOKAS_TURBOPACK_ROOT: dirname(root),
    },
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Next.js mobile export failed (exit ${result.status ?? "unknown"}).`);
  }

  const generated = join(workspace, "out");
  if (!existsSync(generated)) {
    throw new Error("Next.js completed without producing the static out/ bundle.");
  }
  rmSync(output, { recursive: true, force: true });
  cpSync(generated, output, { recursive: true });
  console.log(`Bundled mobile frontend written to ${output}`);
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
