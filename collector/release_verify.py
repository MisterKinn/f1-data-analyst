"""Signed collector releases.

Collectors update themselves from GitHub, so whatever lands in the repository would run on
every participant's computer. To stop that, a collector installs new code only when
collector-release.json (repository root) carries a valid Ed25519 signature, made with the
owner's release key, over the SHA-256 of the exact collector/ files it is about to install.
The public keys live in collector/host/release-keys.txt; the CURRENTLY INSTALLED copy is
used for checking, so changed code cannot bring its own key along.

  python release_verify.py keygen --out KEY.pem          # once, on the owner's computer
  python release_verify.py sign REPO.zip --key KEY.pem --out collector-release.json
  python release_verify.py check NEW_COLLECTOR_DIR MANIFEST KEYS_FILE   # exit 0 = install
"""
import argparse
import base64
import hashlib
import json
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

DOMAIN = 'kongboda-collector-release'


def b64u(raw):
    return base64.urlsafe_b64encode(raw).rstrip(b'=').decode()


def unb64u(text):
    return base64.urlsafe_b64decode(text + '=' * (-len(text) % 4))


def _digest(entries):
    lines = ''.join(f'{path}\0{hashlib.sha256(data).hexdigest()}\n' for path, data in sorted(entries))
    return hashlib.sha256(lines.encode()).hexdigest()


def _wanted(path):
    # host/kit/ is the hand-out kit (never run by a collector) and has Korean file names,
    # which zip tools decode differently on each OS, so it is left out of the hash.
    return ('__pycache__' not in path.split('/') and not path.endswith('.pyc')
            and not path.startswith('host/kit/') and path.isascii())


def tree_hash_dir(directory):
    """Hash of every file under a collector/ folder (paths relative to it, '/' separators)."""
    root = Path(directory)
    return _digest((p.relative_to(root).as_posix(), p.read_bytes()) for p in root.rglob('*')
                   if p.is_file() and _wanted(p.relative_to(root).as_posix()))


def tree_hash_zip(path, prefix=None):
    """Same hash from a repository zip (git archive / GitHub codeload), files under */collector/."""
    with zipfile.ZipFile(path) as archive:
        entries = []
        for name in archive.namelist():
            if name.endswith('/'):
                continue
            parts = name.split('/')
            # git archive: collector/...; codeload: <repo>-<ref>/collector/...
            index = parts.index('collector') if 'collector' in parts[:2] else None
            if index is None:
                continue
            rel = '/'.join(parts[index + 1:])
            if rel and _wanted(rel):
                entries.append((rel, archive.read(name)))
    return _digest(entries)


def message(tree_sha256, version):
    return f'{DOMAIN}\n{tree_sha256}\n{version}'.encode()


def read_keys(path):
    try:
        lines = Path(path).read_text(encoding='utf-8-sig').splitlines()
    except OSError:
        return []
    return [line.split('#')[0].strip() for line in lines if line.split('#')[0].strip()]


def verify(manifest, tree_sha256, keys):
    from cryptography.exceptions import InvalidSignature
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
    if manifest.get('tree_sha256') != tree_sha256:
        return False
    for key in keys:
        try:
            Ed25519PublicKey.from_public_bytes(unb64u(key)).verify(
                unb64u(manifest.get('signature', '')), message(tree_sha256, str(manifest.get('version', ''))))
            return True
        except (InvalidSignature, ValueError):
            continue
    return False


def keygen(out):
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    out = Path(out)
    if out.exists():
        private = serialization.load_pem_private_key(out.read_bytes(), password=None)
    else:
        out.parent.mkdir(parents=True, exist_ok=True)
        private = Ed25519PrivateKey.generate()
        out.write_bytes(private.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                              serialization.NoEncryption()))
    print(b64u(private.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)))


def sign(repo_zip, key, out, version=None):
    from cryptography.hazmat.primitives import serialization
    private = serialization.load_pem_private_key(Path(key).read_bytes(), password=None)
    tree = tree_hash_zip(repo_zip)
    version = version or datetime.now(timezone.utc).strftime('%Y.%m.%d.%H%M')
    manifest = {'version': version, 'tree_sha256': tree, 'signed_at': datetime.now(timezone.utc).isoformat(timespec='seconds'),
                'signature': b64u(private.sign(message(tree, version)))}
    Path(out).write_text(json.dumps(manifest, indent=1) + '\n', encoding='utf-8')
    print('signed', version, tree)


def check(new_dir, manifest_path, keys_path):
    keys = read_keys(keys_path)
    if not keys:
        print('No release keys installed yet: accepting this update (first signed release).')
        return 0
    try:
        manifest = json.loads(Path(manifest_path).read_text(encoding='utf-8-sig'))
    except (OSError, ValueError):
        print('Update has no release signature; keeping the current code.')
        return 1
    if verify(manifest, tree_hash_dir(new_dir), keys):
        print('Release signature OK:', manifest.get('version'))
        return 0
    print('Release signature does not match this code; keeping the current code.')
    return 1


def main(argv=None):
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest='command', required=True)
    k = sub.add_parser('keygen')
    k.add_argument('--out', required=True)
    s = sub.add_parser('sign')
    s.add_argument('repo_zip')
    s.add_argument('--key', required=True)
    s.add_argument('--out', required=True)
    s.add_argument('--version')
    c = sub.add_parser('check')
    c.add_argument('new_dir')
    c.add_argument('manifest')
    c.add_argument('keys')
    args = parser.parse_args(argv)
    if args.command == 'keygen':
        keygen(args.out)
        return 0
    if args.command == 'sign':
        sign(args.repo_zip, args.key, args.out, args.version)
        return 0
    return check(args.new_dir, args.manifest, args.keys)


if __name__ == '__main__':
    sys.exit(main())
