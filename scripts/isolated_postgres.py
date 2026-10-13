"""Run tests against a disposable local cluster, never the application database.

python scripts/isolated_postgres.py
Requires PostgreSQL binaries on PATH. No Docker or credentials needed.
"""
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile


def main():
    for binary in ("initdb", "pg_ctl"):
        if not shutil.which(binary):
            raise SystemExit(f"{binary} required; no fallback to an existing database")
    with tempfile.TemporaryDirectory(prefix="waka-isolated-") as folder:
        root = Path(folder)
        data = root / "data"
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        subprocess.run(["initdb", "-D", str(data), "-A", "trust", "-U", "waka_test",
                        "--no-locale", "--encoding=UTF8"], check=True, stdout=subprocess.DEVNULL)
        subprocess.run(["pg_ctl", "-D", str(data), "-l", str(root / "postgres.log"),
                        "-o", f"-p {port} -h 127.0.0.1 -k {root} -c max_connections=30",
                        "-w", "start"], check=True, stdout=subprocess.DEVNULL)
        try:
            env = {**os.environ,
                "DATABASE_URL": f"postgresql+psycopg://waka_test@127.0.0.1:{port}/postgres",
                "WAKA_ISOLATED_TEST": "1", "DEMO_MODE": "true", "ENVIRONMENT": "test"}
            subprocess.run(["python", "-m", "backend.test_postgres"], env=env, check=True)
            subprocess.run(["createdb", "-h", "127.0.0.1", "-p", str(port),
                            "-U", "waka_test", "fresh_test"], check=True)
            fresh = {**env, "DATABASE_URL": f"postgresql+psycopg://waka_test@127.0.0.1:{port}/fresh_test"}
            subprocess.run(["python", "-m", "backend.migrate"], env=fresh, check=True)
            subprocess.run(["python", "-m", "backend.migrate"], env=fresh, check=True)
            print("Clean-database migration and repeat: PASS")
        finally:
            subprocess.run(["pg_ctl", "-D", str(data), "-m", "fast", "-w", "stop"],
                           check=True, stdout=subprocess.DEVNULL)


if __name__ == "__main__":
    main()
