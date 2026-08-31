## About

The `copilot` backend authentication method sends a GitHub Copilot token and the request headers that the Copilot API expects. Agentgateway finds the token itself, from an environment variable or from the configuration that the GitHub Copilot tools and the GitHub CLI already wrote to disk, so no credential appears in the configuration file.

> [!IMPORTANT]
> The `copilot` method is available in the standalone binary only. The method reads its token from the environment of the agentgateway process, which has no Kubernetes equivalent, so the field does not exist in the custom resources.

## Configuration example

The `copilot` method takes no settings. Write the method name on its own, as a string rather than a map.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
- backends:
  - host: api.githubcopilot.com:443
    policies:
      backendAuth: copilot
```

> [!WARNING]
> Write `backendAuth: copilot`, not `backendAuth: {copilot: {}}`. The method is the only one that is a bare string, and the map form is rejected when the configuration loads.
>
> ```
> Error: routes[0]: data did not match any variant of untagged enum BackendAuthCompat
> ```

## Where agentgateway finds the token

Agentgateway tries the following sources in order and stops at the first one that yields a token.

1. The `GH_COPILOT_TOKEN` environment variable.
2. The `COPILOT_GITHUB_TOKEN` environment variable.
3. The `github-copilot/hosts.json` file in your configuration directory, then `github-copilot/apps.json`. The GitHub Copilot editor extensions write these files.
4. The `gh/hosts.yml` file in your configuration directory. The [GitHub CLI](https://cli.github.com/) writes this file when you run `gh auth login`.

The configuration directory is `$XDG_CONFIG_HOME` when that variable is set. Otherwise it is `%APPDATA%` on Windows and `$HOME/.config` everywhere else. Agentgateway reads the `github.com` entry from each file, so a token for a GitHub Enterprise host is not used.

In practice this means that a workstation where you already use GitHub Copilot or the GitHub CLI needs no extra setup. Set `GH_COPILOT_TOKEN` when you run agentgateway somewhere that has neither, such as a container.

```sh
export GH_COPILOT_TOKEN="<your-token>"
agentgateway -f config.yaml
```

> [!NOTE]
> Agentgateway does not cache a token that it read from a file, because the GitHub tools rotate those tokens on their own. Agentgateway reads the file again on each request, so a rotation is picked up without a restart.

## What agentgateway sends

The method writes the token to the `Authorization` header, and adds the headers that identify the caller to the Copilot API.

| Header | Value |
| -- | -- |
| `authorization` | `Bearer` followed by the token. |
| `content-type` | `application/json`. |
| `editor-version` | `agentgateway/` followed by the version of the binary. |
| `x-github-api-version` | The Copilot API version that this release targets. |
| `x-initiator` | `agent`. |
| `x-interaction-type` | `conversation-agent`. |
| `openai-intent` | `conversation-agent`. |

> [!WARNING]
> The method sets `content-type` to `application/json` on every request, and it overwrites the value that the client sent. Do not use the method on a route that carries a body of another type.

{{< doc-test paths="backend-authn-copilot" >}}
# WHAT THIS TEST VALIDATES:
#   * `backendAuth: copilot` is accepted as a complete standalone config, and the map form
#     `copilot: {}` is rejected.
#   * Both token environment variables work, and the backend receives the token plus all seven
#     headers that the "What agentgateway sends" table lists.
#   * A configuration with no token available still loads, and the request then fails with the
#     500 and the message that the Troubleshoot section quotes.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * The three file-backed token sources (github-copilot/hosts.json, apps.json, gh/hosts.yml) --
#     external dependency: the file layouts belong to the GitHub tools, and a fixture proving
#     agentgateway can read a file it wrote itself would assert nothing about the real format.
#   * That the Copilot API accepts the token -- external dependency: needs a real account with a
#     Copilot subscription. The test forwards to a local echo backend instead, which is what makes
#     the injected headers observable at all.
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

{{< doc-test paths="backend-authn-copilot" >}}
# A local echo backend, so the headers that the copilot method injects are observable. Port 8099
# is used because no documented config binds it, and doc tests share a shell.
cat <<'PY' > copilot-echo.py
import json
from http.server import BaseHTTPRequestHandler, HTTPServer

class H(BaseHTTPRequestHandler):
    def do_GET(self):
        body = json.dumps({"headers": {k.lower(): v for k, v in self.headers.items()}}).encode()
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    do_POST = do_GET
    def log_message(self, *a):
        pass

HTTPServer(("127.0.0.1", 8099), H).serve_forever()
PY
python3 copilot-echo.py &
ECHO_PID=$!

# The gateway is restarted once per token source, so its lifetime is per case. The echo backend
# has to outlive every case, so only the EXIT trap stops it.
stop_gateway() {
  [ -n "${AGW_PID:-}" ] || return 0
  kill "$AGW_PID" 2>/dev/null || true
  wait "$AGW_PID" 2>/dev/null || true
  AGW_PID=""
}
cleanup() {
  stop_gateway
  [ -n "${ECHO_PID:-}" ] && { kill "$ECHO_PID" 2>/dev/null || true; wait "$ECHO_PID" 2>/dev/null || true; }
  return 0
}
trap cleanup EXIT

# Probe for a response only this backend produces, so a stale process on the port cannot satisfy
# the readiness check.
for i in $(seq 1 30); do
  curl -sf --max-time 5 http://127.0.0.1:8099/ 2>/dev/null | grep -q '"headers"' && break
  sleep 1
done
if ! curl -sf --max-time 5 http://127.0.0.1:8099/ 2>/dev/null | grep -q '"headers"'; then
  echo "FAIL: the echo backend did not come up on 127.0.0.1:8099 (is the port already in use?)"
  exit 1
fi

cat <<'EOF' > config-copilot.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
- backends:
  - host: 127.0.0.1:8099
    policies:
      backendAuth: copilot
EOF
agentgateway -f config-copilot.yaml --validate-only

# The map form must be rejected, which is the gotcha the page warns about.
cat <<'EOF' > config-copilot-map.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
- backends:
  - host: 127.0.0.1:8099
    policies:
      backendAuth:
        copilot: {}
EOF
if agentgateway -f config-copilot-map.yaml --validate-only 2>/dev/null; then
  echo "FAIL: expected the copilot map form to be rejected"
  exit 1
fi

start_gateway() {
  agentgateway -f config-copilot.yaml > "agw-$1.log" 2>&1 &
  AGW_PID=$!
  for i in $(seq 1 30); do
    curl -s --max-time 5 -o /dev/null "http://127.0.0.1:3000/get" && return 0
    sleep 1
  done
  echo "FAIL: the gateway did not come up on port 3000"
  cat "agw-$1.log"
  exit 1
}

# Every source below must be the only one set, or the precedence order decides the answer instead
# of the variable under test.
unset GH_COPILOT_TOKEN COPILOT_GITHUB_TOKEN
export XDG_CONFIG_HOME="$PWD/no-copilot-config"
mkdir -p "$XDG_CONFIG_HOME"

check_headers() {
  python3 -c '
import json, sys
want = {
    "authorization": "Bearer " + sys.argv[2],
    "content-type": "application/json",
    "x-github-api-version": None,
    "editor-version": None,
    "x-initiator": "agent",
    "x-interaction-type": "conversation-agent",
    "openai-intent": "conversation-agent",
}
h = json.load(open(sys.argv[1]))["headers"]
for name, expected in want.items():
    assert name in h, f"{name} was not sent to the backend: {sorted(h)}"
    if expected is not None:
        assert h[name] == expected, f"{name}: expected {expected!r}, got {h[name]!r}"
assert h["editor-version"].startswith("agentgateway/"), h["editor-version"]
print("all seven copilot headers verified")' "$1" "$2"
}

# Source 1: GH_COPILOT_TOKEN.
export GH_COPILOT_TOKEN="fake-copilot-token-1"
start_gateway gh
curl -s --max-time 15 http://127.0.0.1:3000/get > copilot-gh.json
stop_gateway
check_headers copilot-gh.json fake-copilot-token-1
unset GH_COPILOT_TOKEN

# Source 2: COPILOT_GITHUB_TOKEN.
export COPILOT_GITHUB_TOKEN="fake-copilot-token-2"
start_gateway alt
curl -s --max-time 15 http://127.0.0.1:3000/get > copilot-alt.json
stop_gateway
check_headers copilot-alt.json fake-copilot-token-2
unset COPILOT_GITHUB_TOKEN

# No token anywhere: the config still loads, and the request fails at runtime with the documented
# message.
agentgateway -f config-copilot.yaml --validate-only
start_gateway notoken
CODE=$(curl -s --max-time 15 -o copilot-notoken.txt -w '%{http_code}' http://127.0.0.1:3000/get)
stop_gateway
[ "$CODE" = "500" ] || { echo "FAIL: expected 500 with no token, got $CODE"; cat copilot-notoken.txt; exit 1; }
grep -q 'Copilot token not found' copilot-notoken.txt || {
  echo "FAIL: the documented error message changed"; cat copilot-notoken.txt; exit 1; }
echo "copilot backend authentication verified"
{{< /doc-test >}}

## Troubleshoot

The method needs no token to load a configuration, so `--validate-only` passes on a host with no token available. A missing token surfaces on the first request instead, as a `500`.

```
backend authentication failed: Copilot token not found; set GH_COPILOT_TOKEN or authenticate with GitHub Copilot/GitHub CLI
```

| Symptom | Cause |
| -- | -- |
| `Copilot token not found` | None of the four sources yielded a token. Set `GH_COPILOT_TOKEN`, or run `gh auth login`. In a container, check that `HOME` or `XDG_CONFIG_HOME` points at the directory that holds the mounted configuration. |
| `data did not match any variant of untagged enum BackendAuthCompat` | The configuration uses the map form. Write `backendAuth: copilot`. |
| The backend rejects the token, although agentgateway found one. | The token belongs to an account with no Copilot subscription, or it came from a `gh` login with too few scopes. Confirm the token separately before you debug the route. |
| The upstream rejects the request body. | The method overwrote `content-type` with `application/json`. |
