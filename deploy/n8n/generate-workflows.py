"""Generate the three managed starter workflows. Credentials never enter Git."""
import json
from pathlib import Path

folder = Path(__file__).parent / "workflows"
folder.mkdir(exist_ok=True)
credential = {"httpHeaderAuth": {"id": "wakaAutomation001", "name": "WAKA limited automation API"}}


def request(name, path, position, body=None, health=False):
    params = {"url": "http://backend:8080" + path,
              "options": {"timeout": 15000, "response": {"response": {"responseFormat": "json"}}}}
    if not health:
        params.update(authentication="genericCredentialType", genericAuthType="httpHeaderAuth")
    if body:
        params.update(method="POST", sendBody=True, specifyBody="json", jsonBody=body)
    node = {"id": name.lower().replace(" ", "-"), "name": name, "type": "n8n-nodes-base.httpRequest",
            "typeVersion": 4.2, "position": position, "parameters": params,
            "retryOnFail": True, "maxTries": 3, "waitBetweenTries": 2000}
    if not health:
        node["credentials"] = credential
    if health:
        node["onError"] = "continueRegularOutput"
    return node


specs = [
    ("wakaHealth000001", "WAKA - Health check", {"field": "minutes", "minutesInterval": 5},
     request("Check WAKA database health", "/health/db", [260, 120], health=True),
     "={{ {workflow:'health-check', day:$now.setZone('Africa/Kigali').toISODate(), status:$json.status === 'ok' ? 'HEALTHY' : 'UNHEALTHY', summary:$json.status === 'ok' ? 'WAKA API and database are reachable' : 'WAKA health check failed; inspect the n8n execution', payload:{checked_at:$now.toISO(), api_status:$json.status || 'error'}} }}"),
    ("wakaExpiry000001", "WAKA - Membership expiry reminders", {"field": "cronExpression", "expression": "0 8 * * *"},
     request("Read WAKA expiry summary", "/internal/automation/snapshot", [260, 120]),
     "={{ {workflow:'membership-expiry', day:$json.day, status:'DRAFT', summary:$json.metrics.expiring_members + ' membership(s) expire within seven days. Staff reminder review; no messages sent.', payload:{members:$json.expiring_members, total:$json.metrics.expiring_members, truncated:$json.expiring_list_truncated}} }}"),
    ("wakaDaily0000001", "WAKA - Daily operations summary", {"field": "cronExpression", "expression": "0 18 * * *"},
     request("Read WAKA daily summary", "/internal/automation/snapshot", [260, 120]),
     "={{ {workflow:'daily-summary', day:$json.day, status:'READY', summary:'Daily WAKA operations summary at 18:00 Kigali time', payload:{metrics:$json.metrics, generated_at:$json.generated_at, demo_mode:$json.demo_mode}} }}"),
]

for wid, name, interval, fetch, body in specs:
    nodes = [
        {"id": "manual", "name": "Run manually", "type": "n8n-nodes-base.manualTrigger", "typeVersion": 1, "position": [0, 0], "parameters": {}},
        {"id": "schedule", "name": "Schedule", "type": "n8n-nodes-base.scheduleTrigger", "typeVersion": 1.2, "position": [0, 220],
         "parameters": {"rule": {"interval": [interval]}}},
        fetch,
        request("Record internal result", "/internal/automation/results", [540, 120], body=body),
    ]
    workflow = {"id": wid, "name": name, "active": False, "nodes": nodes,
        "connections": {"Run manually": {"main": [[{"node": fetch["name"], "type": "main", "index": 0}]]},
                        "Schedule": {"main": [[{"node": fetch["name"], "type": "main", "index": 0}]]},
                        fetch["name"]: {"main": [[{"node": "Record internal result", "type": "main", "index": 0}]]}},
        "settings": {"executionOrder": "v1", "timezone": "Africa/Kigali",
                     "saveDataSuccessExecution": "all", "saveDataErrorExecution": "all"},
        "pinData": {}, "tags": []}
    (folder / f"{wid}.json").write_text(json.dumps(workflow, indent=2) + "\n")
print("Generated three WAKA starter workflows; no external messaging or financial actions.")
