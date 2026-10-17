#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
cd "$(git rev-parse --show-toplevel)"
state_dir="${WAKA_STATE_DIR:-/home/ec2-user/.local/state/waka}"
mkdir -p "$state_dir"
digest="$(python3 - <<'PY'
import hashlib
from pathlib import Path
values=dict(line.split('=',1) for line in Path('.env').read_text().splitlines() if '=' in line and not line.startswith('#'))
token=values.get('AUTOMATION_TOKEN','')
if len(token)<32: raise SystemExit('Missing private automation token')
h=hashlib.sha256(token.encode())
for p in sorted(Path('deploy/n8n/workflows').glob('*.json')): h.update(p.name.encode());h.update(p.read_bytes())
print(h.hexdigest())
PY
)"
if [ "${1:-}" != --force ] && [ -f "$state_dir/n8n-workflows-revision" ] && [ "$(cat "$state_dir/n8n-workflows-revision")" = "$digest" ]; then
  echo 'Managed n8n workflows are unchanged.'
  exit 0
fi
credential_file="$(mktemp "$state_dir/n8n-credential.XXXXXX")"
trap 'rm -f "$credential_file"; docker compose exec -T n8n node -e "require(\"fs\").rmSync(\"/tmp/waka-credential.json\",{force:true})" >/dev/null 2>&1 || true' EXIT
python3 - "$credential_file" <<'PY'
import json,sys
from pathlib import Path
values=dict(line.split('=',1) for line in Path('.env').read_text().splitlines() if '=' in line and not line.startswith('#'))
data=[{'id':'wakaAutomation001','name':'WAKA limited automation API','type':'httpHeaderAuth',
       'data':{'name':'Authorization','value':'Bearer '+values['AUTOMATION_TOKEN']}}]
Path(sys.argv[1]).write_text(json.dumps(data))
PY
docker compose cp "$credential_file" n8n:/tmp/waka-credential.json
docker compose exec -T -u 0 n8n node -e 'const fs=require("fs");fs.chownSync("/tmp/waka-credential.json",1000,1000);fs.chmodSync("/tmp/waka-credential.json",0o600)'
docker compose exec -T n8n n8n import:credentials --input=/tmp/waka-credential.json
docker compose exec -T n8n n8n import:workflow --separate --input=/opt/waka-workflows
for workflow in wakaHealth000001 wakaExpiry000001 wakaDaily0000001; do
  docker compose exec -T n8n n8n publish:workflow --id="$workflow"
done
docker compose restart n8n
docker compose up -d --wait --wait-timeout 240 n8n
published="$(docker compose exec -T n8n-db psql -U n8n -d n8n -Atc 'SELECT count(*) FROM workflow_entity WHERE id IN ('"'wakaHealth000001','wakaExpiry000001','wakaDaily0000001'"') AND "activeVersionId" IS NOT NULL')"
[ "$published" = 3 ] || { echo 'Managed n8n workflows did not all publish.' >&2; exit 1; }
printf '%s\n' "$digest" > "$state_dir/n8n-workflows-revision"
echo 'Three WAKA workflows published. No external messages or financial actions.'
