"""Signed uploads for a home collector host (no GitHub OIDC token available).

The host keeps an Ed25519 private key on disk; the matching public key is listed in
worker/collector-hosts.js. Each request is signed over method, path+query, a unix
timestamp and the SHA-256 of the body.

    python host_auth.py keygen --name my-pc   # once per computer
"""
import argparse
import base64
import hashlib
import os
import sys
import time
import urllib.parse
from pathlib import Path


def key_path():
    default = Path(os.environ.get('DATA_DIR', '.')) / 'host-key.pem'
    return Path(os.environ.get('HOST_KEY_FILE', str(default)))


def b64u(raw):
    return base64.urlsafe_b64encode(raw).rstrip(b'=').decode()


def message(method, path_and_query, ts, body):
    digest = hashlib.sha256(body or b'').hexdigest()
    return f'{method}\n{path_and_query}\n{ts}\n{digest}'.encode()


def load_key(path=None):
    from cryptography.hazmat.primitives import serialization
    return serialization.load_pem_private_key(Path(path or key_path()).read_bytes(), password=None)


def public_key(private):
    from cryptography.hazmat.primitives import serialization
    return b64u(private.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw))


def header(method, url, body=b'', name=None, private=None, now=None):
    parsed = urllib.parse.urlsplit(url)
    path = parsed.path + ('?' + parsed.query if parsed.query else '')
    ts = str(int(now if now is not None else time.time()))
    private = private or load_key()
    signature = private.sign(message(method, path, ts, body))
    # q carries the signed query: hosting rewrites may add their own query parameters.
    return (f"KongbodaHost name={name or os.environ['HOST_NAME']},ts={ts},"
            f"q={b64u(parsed.query.encode())},sig={b64u(signature)}")


def keygen(name, path):
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    path = Path(path)
    if path.exists():
        private = load_key(path)
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        private = Ed25519PrivateKey.generate()
        path.write_bytes(private.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                               serialization.NoEncryption()))
        try:
            os.chmod(path, 0o600)
        except OSError:
            pass
    print("Add this line to worker/collector-hosts.js:")
    print(f" {{name:'{name}',key:'{public_key(private)}'}},")
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest='command', required=True)
    gen = sub.add_parser('keygen')
    gen.add_argument('--name', required=True)
    gen.add_argument('--out', default=None)
    args = parser.parse_args(argv)
    return keygen(args.name, args.out or key_path())


if __name__ == '__main__':
    sys.exit(main())
