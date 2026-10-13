# AWS live POC

The WAKA demonstration runs at **http://44.210.143.148**, on an Amazon Linux 2023 EC2 instance with 8 GB RAM /2 CPUs. It runs Next.js, FastAPI, PostgreSQL and Nginx through Docker Compose. This deployment uses fictional demo accounts and simulated providers.

## Daily workflow

Develop and verify locally, then commit and push to `main`. The local main worktree is `wk-CRM-live`; the audit checkouts remain separate. After pushing, connect to the server and run:

```sh
cd /home/ec2-user/wk-CRM
git pull --ff-only
```

The installed server-only `post-merge` hook invokes `deploy/waka-deploy.sh` when a pull actually updates main. It backs up the database, rebuilds images, applies Alembic migrations, restarts services and checks HTTP health. Persistent database volume and `.env` are preserved. It seeds only an empty first installation, never normal updates. Docker starts on boot and the running services use restart policies.

For a one-command pull/deploy with reliable deployment exit status, or to retry a failed deployment when Git is already up to date:

```sh
/home/ec2-user/.local/bin/waka-deploy
```

Git hooks cannot undo a completed merge or reliably make its success mean deployment succeeded. After manual `git pull`, confirm the `WAKA deployment healthy` message and compare the deployed revision below. Do not force-push a rewritten main to this installation: server updates use fast forwards only.

## Server installation

Install Docker, Git, Docker Compose plugin and Buildx on Amazon Linux. Docker Compose 5.6.0 and Buildx 0.38.0 were installed for this instance. Clone the repository into `/home/ec2-user/wk-CRM`. Create a private `.env` (0600) with a new random URL-safe database password and these demo settings:

```dotenv
HTTP_PORT=80
DEMO_MODE=true
ENVIRONMENT=demo
COOKIE_SECURE=false
FRONTEND_URL=http://44.210.143.148
ALLOWED_ORIGINS=http://44.210.143.148
DB_POOL_SIZE=5
DB_MAX_OVERFLOW=10
DB_POOL_TIMEOUT=10
```

Set `POSTGRES_PASSWORD` privately; never paste or commit its value. Then install automation **on the server only**:

```sh
cd /home/ec2-user/wk-CRM
bash deploy/install-pull-hook.sh
/home/ec2-user/.local/bin/waka-deploy
```

The installer creates a hook in `.git/hooks` and a launcher in `/home/ec2-user/.local/bin`; they survive pulls. The hook and launcher invoke the versioned deployment script, so future script improvements arrive through Git. No local-machine hook is installed.

## State, backups and diagnostics

```sh
cd /home/ec2-user/wk-CRM
docker compose ps
docker compose logs --tail=80 backend frontend proxy
cat /home/ec2-user/.local/state/waka/deployed-revision
git rev-parse HEAD
tail -80 /home/ec2-user/.local/state/waka/deploy.log
```

Backups are PostgreSQL custom-format dumps under `/home/ec2-user/.local/state/waka/backups`, private 0600 files. They contain authentication hashes and stay outside Git. Backups are local to this instance, not an off-host disaster-recovery service. Build cache is capped after healthy deployments and dangling images removed; database volumes are never pruned. Backup retention remains manual.

Build failure leaves the existing application containers running. A migration/startup failure requires checking logs and explicitly retrying or recovering; there is no automatic schema rollback. Never run `docker compose down -v`, `docker volume prune`, or `backend.seed --reset` on the persistent dataset during updates. Changing the environment password does not rotate an existing database password.

Only the Nginx HTTP port 80 is published. PostgreSQL and backend ports remain private to the Docker network. Public HTTP also requires the EC2 security group to permit inbound TCP 80. This POC currently uses an IP and HTTP; a domain/TLS configuration can be added separately. An EC2 public IP may change after stop/start unless an Elastic IP is assigned.

GitHub reads use the public HTTPS clone URL. The development workstation's push URL uses the existing Trugira SSH identity; private keys are not copied to the instance. Pushes update GitHub only; a server pull or `waka-deploy` applies them to the POC.

Installer/hook semantics follow the [Docker Compose installation guide](https://docs.docker.com/compose/install/linux/) and [Git hook documentation](https://git-scm.com/docs/githooks#_post_merge).
