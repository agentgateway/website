#!/usr/bin/env bash
# Seed a Kubernetes agentgateway proxy's request-log database with the deterministic
# cost-dashboard dataset, so `npm run test:kube-costs` captures a populated Analytics page.
#
# It reproduces, as repeatable infra, what the standalone `serve-costs-ui.sh` does locally:
#   1. build the seeded SQLite DB (scripts/seed-costs-db.mjs)
#   2. ship it as a ConfigMap (binaryData)
#   3. enable config.database via an AgentgatewayParameters rawConfig, and copy the seeded DB
#      into a writable volume with a busybox init container (the proxy image is distroless)
#   4. attach the params to the Gateway and wait for the rollout
#
#   ./scripts/seed-kube-costs.sh          # seed the cluster in the current kubecontext
# Then, in another shell:
#   kubectl port-forward deployment/agentgateway-proxy -n agentgateway-system 15000:15000 &
#   UI_BASE_URL=http://localhost:15000 npm run test:kube-costs
#
# Requires: kubectl (pointed at the cluster), Node 18+, base64. Idempotent.
set -euo pipefail

NS="${AGW_NAMESPACE:-agentgateway-system}"
GATEWAY="${AGW_GATEWAY:-agentgateway-proxy}"
PARAMS="${AGW_PARAMS:-cost-dashboard-params}"
CONTAINER="${AGW_CONTAINER:-agentgateway}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE="${NODE_BIN:-node}"
DB="$ROOT/.agw-runtime/kube-costs.db"

mkdir -p "$ROOT/.agw-runtime"
echo "→ building seeded database"
rm -f "$DB" "$DB.seed.sql"
"$NODE" "$ROOT/scripts/seed-costs-db.mjs" "$DB"

echo "→ publishing seed ConfigMap costs-seed-db (binaryData)"
B64="$(base64 -i "$DB" | tr -d '\n')"
# --server-side avoids the client-side last-applied annotation (the base64 exceeds its 256KB cap).
python3 - "$B64" "$NS" > "$ROOT/.agw-runtime/costs-seed-cm.json" <<'PY'
import sys, json
b64, ns = sys.argv[1], sys.argv[2]
print(json.dumps({"apiVersion":"v1","kind":"ConfigMap",
  "metadata":{"name":"costs-seed-db","namespace":ns},"binaryData":{"costs.db":b64}}))
PY
kubectl apply --server-side -f "$ROOT/.agw-runtime/costs-seed-cm.json"

echo "→ enabling config.database + init-container seed on $PARAMS"
kubectl apply -f- <<EOF
apiVersion: agentgateway.dev/v1alpha1
kind: AgentgatewayParameters
metadata:
  name: $PARAMS
  namespace: $NS
spec:
  rawConfig:
    config:
      database:
        url: "sqlite:////costdb/costs.db?mode=rwc"
  deployment:
    spec:
      template:
        spec:
          volumes:
          - name: costs-db
            emptyDir: {}
          - name: costs-seed
            configMap:
              name: costs-seed-db
          initContainers:
          - name: seed-costs
            image: busybox:1.36
            # The init container runs as root; chmod so the non-root proxy (uid 10101) can
            # open the copied SQLite file read-write.
            command: ["sh","-c","cp /seed/costs.db /costdb/costs.db && chmod 0666 /costdb/costs.db"]
            volumeMounts:
            - name: costs-db
              mountPath: /costdb
            - name: costs-seed
              mountPath: /seed
          containers:
          - name: $CONTAINER
            volumeMounts:
            - name: costs-db
              mountPath: /costdb
EOF

echo "→ attaching $PARAMS to Gateway $GATEWAY"
kubectl patch gateway "$GATEWAY" -n "$NS" --type merge \
  -p "{\"spec\":{\"infrastructure\":{\"parametersRef\":{\"name\":\"$PARAMS\",\"group\":\"agentgateway.dev\",\"kind\":\"AgentgatewayParameters\"}}}}"

echo "→ waiting for rollout"
sleep 8
kubectl rollout status "deployment/$GATEWAY" -n "$NS" --timeout=180s
echo "✓ seeded. Port-forward $NS/$GATEWAY :15000 and run: npm run test:kube-costs"
