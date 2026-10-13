#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
repo_dir="${WAKA_REPO_DIR:-/home/ec2-user/wk-CRM}"
state_dir="${WAKA_STATE_DIR:-/home/ec2-user/.local/state/waka}"
mkdir -p "$state_dir/backups"
exec > >(tee -a "$state_dir/deploy.log") 2>&1
exec 9>"$state_dir/deploy.lock"
flock -n 9 || { echo 'Another WAKA deployment is running.' >&2; exit 1; }
cd "$repo_dir"
trap 'echo "Deployment failed. Inspect containers/logs before retrying: docker compose ps; docker compose logs --tail=80" >&2' ERR
[ "$(git branch --show-current)" = main ] || { echo 'Server must track main.' >&2; exit 1; }
git diff --quiet && git diff --cached --quiet || { echo 'Tracked server files have local changes; refusing to overwrite them.' >&2; exit 1; }
if [ "${1:-}" != --no-pull ]; then
  WAKA_SKIP_AUTO_DEPLOY=1 git pull --ff-only origin main
fi
revision="$(git rev-parse HEAD)"
echo "Deploying WAKA $revision"
# Back up the existing live database before builds or migrations.
if [ -n "$(docker compose ps -q db)" ] && docker compose exec -T db pg_isready -U waka -d waka >/dev/null 2>&1; then
  backup="$state_dir/backups/$(date -u +%Y%m%dT%H%M%SZ)-${revision:0:12}.dump"
  docker compose exec -T db pg_dump -U waka -d waka -Fc > "$backup"
  chmod 600 "$backup"
  echo "Database backup saved: $backup"
fi
# Existing app keeps running while replacement images are built.
COMPOSE_PARALLEL_LIMIT=1 docker compose --progress plain build backend initialize frontend
docker compose up -d --wait --wait-timeout 120 db
docker compose run --rm --no-deps initialize
docker compose up -d --wait --wait-timeout 180
# Refresh file mounts replaced by Git and Nginx's upstream container addresses.
# Recreate only the gateways; the database keeps its persistent volume.
gateway_services=(proxy)
if docker compose config --services | grep -qx https; then
  gateway_services+=(https)
fi
docker compose up -d --no-deps --force-recreate --wait --wait-timeout 120 "${gateway_services[@]}"
# Seed exactly once, and only an empty first-install demo dataset.
if [ ! -f "$state_dir/initialized" ]; then
  users="$(docker compose exec -T db psql -U waka -d waka -Atc 'select count(*) from waka_users')"
  if [ "$users" = 0 ]; then
    docker compose exec -T backend python -m backend.seed
  fi
  touch "$state_dir/initialized"
fi
curl --fail --silent --show-error --max-time 20 http://127.0.0.1/health/db >/dev/null
curl --fail --silent --show-error --max-time 20 http://127.0.0.1/website >/dev/null
# With HTTPS enabled, verify the public certificate through the local gateway too.
if docker compose config --services | grep -qx https; then
  public_host="$(docker compose exec -T https printenv PUBLIC_HOST)"
  curl --fail --silent --show-error --max-time 10 --retry 20 --retry-all-errors --retry-delay 2 \
    --resolve "$public_host:443:127.0.0.1" "https://$public_host/health/db" >/dev/null
fi
printf '%s\n' "$revision" > "$state_dir/deployed-revision"
printf '%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$state_dir/deployed-at"
# Limit disposable build cache on the small root disk; database volumes are never pruned.
docker buildx prune --force >/dev/null
docker image prune --force >/dev/null
docker compose ps
echo "WAKA deployment healthy: $revision"
