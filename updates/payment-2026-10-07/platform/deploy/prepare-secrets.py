"""Prepare read-only merchant key mounts for the Linux API group (10001).

Inspect the entire tree before any mutation. Never follow links or change a
hard-linked file, and never grant the API access to JSON, passwords or backups.
"""
import argparse
import os
from pathlib import Path
import stat
import sys


class SecretTreeError(ValueError):
    pass


def permission_plan(root):
    root = Path(root).absolute()
    pending = [root]
    plan = []
    while pending:
        path = pending.pop()
        info = path.lstat()
        if stat.S_ISLNK(info.st_mode) or getattr(path, 'is_junction', lambda: False)():
            raise SecretTreeError('Secrets must not contain symbolic links or junctions.')
        if stat.S_ISDIR(info.st_mode):
            plan.append((path, 0o750, info.st_dev, info.st_ino))
            pending.extend(sorted(path.iterdir()))
        elif stat.S_ISREG(info.st_mode):
            if info.st_nlink != 1:
                raise SecretTreeError('Secrets must not contain hard-linked files.')
            mode = 0o640 if path.suffix.lower() == '.pem' else 0o600
            plan.append((path, mode, info.st_dev, info.st_ino))
        else:
            raise SecretTreeError('Secrets must contain only directories and ordinary files.')
    if not plan or not stat.S_ISDIR(root.lstat().st_mode):
        raise SecretTreeError('Secrets root must be a directory.')
    return plan


def apply_permissions(root):
    if os.name != 'posix' or os.geteuid() != 0:
        raise SecretTreeError('Run this helper as root on the Linux deployment host.')
    plan = permission_plan(root)
    for path, mode, device, inode in plan:
        descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
        try:
            current = os.fstat(descriptor)
            if (current.st_dev, current.st_ino) != (device, inode):
                raise SecretTreeError('Secrets changed during preparation; check and rerun.')
            if stat.S_ISREG(current.st_mode) and current.st_nlink != 1:
                raise SecretTreeError('Secrets changed during preparation; check and rerun.')
            os.fchown(descriptor, 0, 10001)
            os.fchmod(descriptor, mode)
        finally:
            os.close(descriptor)
    return len(plan)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    parser.add_argument('--check-only', action='store_true')
    args = parser.parse_args()
    try:
        count = (len(permission_plan(args.directory)) if args.check_only
                 else apply_permissions(args.directory))
    except (OSError, SecretTreeError):
        # Do not print file names, file contents or exception data from private trees.
        print('Secret preparation failed: use an ordinary directory with no links; '
              'apply permissions as root on Linux.', file=sys.stderr)
        return 2
    print('Secret tree checked.' if args.check_only else
          f'Secret permissions prepared for {count} entries; only PEM files are API-readable.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
