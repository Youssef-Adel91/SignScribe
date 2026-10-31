// Make `path` point at `target` for a test or a tool, on every system.
//
// A symbolic link needs a privilege on Windows (EPERM without Developer Mode or an administrator). A directory JUNCTION does not, so on
// Windows a directory is linked with type 'junction'; a file link that is refused, and a junction that is refused, fall back to a copy.
// On Linux and macOS this is just symlinkSync(target, path), as before.
import { copyFileSync, cpSync, statSync, symlinkSync } from 'node:fs';

/** @returns {'symlink' | 'junction' | 'copy'} how the path was made */
export function linkPath(target, path, opts = {}) {
  const {
    platform = process.platform,
    symlink = symlinkSync,
    copyFile = copyFileSync,
    copyDir = cpSync,
    isDir,
  } = opts;
  const dir = isDir ?? statSync(target).isDirectory();
  const win = platform === 'win32';
  const type = win ? (dir ? 'junction' : 'file') : undefined;
  try {
    if (type) symlink(target, path, type);
    else symlink(target, path);
    return win && dir ? 'junction' : 'symlink';
  } catch {
    // no right to link here: a copy works everywhere (the test only needs the same content at that path)
    if (dir) copyDir(target, path, { recursive: true });
    else copyFile(target, path);
    return 'copy';
  }
}
