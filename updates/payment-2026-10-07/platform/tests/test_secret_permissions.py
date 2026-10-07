"""Security regression for nested merchant keys, without reading real secrets."""
import importlib.util
import os
from pathlib import Path
import stat
import subprocess
import sys

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / 'deploy/prepare-secrets.py'
spec = importlib.util.spec_from_file_location('prepare_secrets', SCRIPT)
secrets = importlib.util.module_from_spec(spec)
spec.loader.exec_module(secrets)


def test_nested_keys_are_readable_but_identity_and_password_are_private(tmp_path):
    nested = tmp_path / 'wechat'
    nested.mkdir()
    for name in ('apiclient_key.pem', 'apiclient_cert.pem', 'wechat-platform-public.pem',
                 'merchant-identity.json', 'api-v3-key.txt', 'export.zip'):
        (nested / name).write_text('isolated-test-fixture')
    plan = {p.relative_to(tmp_path).as_posix(): mode
            for p, mode, _, _ in secrets.permission_plan(tmp_path)}
    assert plan['.'] == plan['wechat'] == 0o750
    assert plan['wechat/apiclient_key.pem'] == 0o640
    assert plan['wechat/apiclient_cert.pem'] == 0o640
    assert plan['wechat/wechat-platform-public.pem'] == 0o640
    for name in ('merchant-identity.json', 'api-v3-key.txt', 'export.zip'):
        assert plan['wechat/' + name] == 0o600
    assert all(not mode & (stat.S_IROTH | stat.S_IWOTH | stat.S_IXOTH | stat.S_IWGRP)
               for mode in plan.values())


def test_hardlinks_to_other_files_are_rejected_before_permissions_change(tmp_path):
    outside = tmp_path / 'untouched.txt'
    outside.write_text('private-outside-file')
    root = tmp_path / 'secrets'
    root.mkdir()
    os.link(outside, root / 'borrowed.pem')
    before = outside.stat().st_mode
    with pytest.raises(secrets.SecretTreeError, match='hard-linked'):
        secrets.permission_plan(root)
    assert outside.read_text() == 'private-outside-file'
    assert outside.stat().st_mode == before


def test_symlinks_are_rejected_before_descending(tmp_path, monkeypatch):
    # Avoid requiring Windows developer mode to create a symlink.
    original = Path.lstat
    linked = tmp_path / 'outside-link'
    linked.mkdir()
    def stat_with_link(path):
        result = original(path)
        if path == linked:
            parts = list(result)
            parts[0] = stat.S_IFLNK | 0o777
            return os.stat_result(parts)
        return result
    monkeypatch.setattr(Path, 'lstat', stat_with_link)
    with pytest.raises(secrets.SecretTreeError, match='symbolic'):
        secrets.permission_plan(tmp_path)


def test_file_cannot_be_used_as_root(tmp_path):
    key = tmp_path / 'key.pem'
    key.write_text('test-only')
    with pytest.raises(secrets.SecretTreeError, match='directory'):
        secrets.permission_plan(key)


def test_check_only_is_read_only_and_does_not_disclose_contents(tmp_path):
    content = 'do-not-print-private-test-value'
    path = tmp_path / 'identity.json'
    path.write_text(content)
    before = path.stat()
    result = subprocess.run([sys.executable, str(SCRIPT), str(tmp_path), '--check-only'],
                            capture_output=True, text=True)
    assert result.returncode == 0
    assert content not in result.stdout + result.stderr
    assert path.read_text() == content and path.stat().st_mode == before.st_mode


def test_cli_failure_does_not_disclose_secret_path(tmp_path):
    private_path = tmp_path / 'private-account-identifier'
    result = subprocess.run([sys.executable, str(SCRIPT), str(private_path), '--check-only'],
                            capture_output=True, text=True)
    assert result.returncode == 2
    assert private_path.name not in result.stdout + result.stderr
