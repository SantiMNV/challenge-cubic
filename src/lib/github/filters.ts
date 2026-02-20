const BINARY_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "ico",
  "webp",
  "pdf",
  "zip",
  "tar",
  "gz",
  "mp3",
  "mp4",
  "mov",
  "wasm",
  "exe",
  "dll",
]);

const SKIP_DIR_SEGMENTS = new Set([
  "node_modules",
  ".agents",
  ".claude",
  ".next",
  "dist",
  "build",
  "coverage",
  ".coverage",
  ".git",
  ".turbo",
  ".cache",
  "vendor",
  "test",
  "tests",
  "__tests__",
]);

const LOCKFILE_NAMES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  "Cargo.lock",
  "composer.lock",
]);

export function shouldIncludePath(path: string): boolean {
  if (!path || path.endsWith("/")) {
    return false;
  }

  const segments = path.split("/");
  if (segments.some((segment) => SKIP_DIR_SEGMENTS.has(segment))) {
    return false;
  }

  const fileName = segments[segments.length - 1] ?? "";
  if (LOCKFILE_NAMES.has(fileName)) {
    return false;
  }

  const extension = fileName.includes(".") ? (fileName.split(".").pop() ?? "").toLowerCase() : "";
  if (extension && BINARY_EXTENSIONS.has(extension)) {
    return false;
  }

  return true;
}

export function cleanTreePaths(paths: string[]): string[] {
  return [...new Set(paths)]
    .map((path) => path.trim())
    .filter((path) => path.length > 0)
    .filter(shouldIncludePath);
}
