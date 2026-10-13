#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(git rev-parse --show-toplevel)"
[ "$(git branch --show-current)" = main ] || { echo 'Install this hook in the server main checkout.' >&2; exit 1; }
git config pull.ff only
git config pull.rebase false
hooks_dir="$(git rev-parse --git-path hooks)"
mkdir -p "$hooks_dir"
cat > "$hooks_dir/post-merge" <<'HOOK'
#!/usr/bin/env bash
set -euo pipefail
if [ "${WAKA_SKIP_AUTO_DEPLOY:-0}" = 1 ]; then exit 0; fi
if [ "$(git branch --show-current)" != main ]; then exit 0; fi
exec bash "$(git rev-parse --show-toplevel)/deploy/waka-deploy.sh" --no-pull
HOOK
chmod 755 "$hooks_dir/post-merge"
mkdir -p /home/ec2-user/.local/bin
cat > /home/ec2-user/.local/bin/waka-deploy <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail
exec bash /home/ec2-user/wk-CRM/deploy/waka-deploy.sh "$@"
WRAPPER
chmod 755 /home/ec2-user/.local/bin/waka-deploy
printf 'Installed pull deployment hook in %s.\n' "$repo_dir"
