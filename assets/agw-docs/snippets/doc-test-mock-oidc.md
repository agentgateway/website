# Test-only helper. Stands up a minimal OAuth 2.0 / OIDC authorization server on
# localhost so that the hosted-IdP guides (Auth0, Okta, Descope, Entra) can be
# exercised end to end without a real tenant. It serves the discovery documents
# and the JWKS that agentgateway derives for each provider, and mints RS256
# tokens from the same key, so provider-specific URL derivation and real token
# validation are both covered.
#
# Callers must export before reusing this snippet:
#   MOCK_IDP_PORT    port to listen on
#   MOCK_IDP_ISSUER  value minted as the `iss` claim, and the base for the
#                    endpoints advertised in the discovery document
#   MOCK_IDP_CLAIMS  JSON object of extra claims added to every minted token
#
# A token request whose client_id ends in `-norole` is minted without those
# extra claims, which is how the guides verify that an authorization rule denies
# an otherwise-valid token.
#
# Keep this file free of blank lines. A blank line splits the reused content
# into separate markdown blocks, and the consuming page then stops resolving
# shortcodes from that point on: every later section renders as raw source.
cat <<'MOCK_IDP_EOF' > mock_idp.py
import base64, http.server, json, os, subprocess, time, urllib.parse
PORT = int(os.environ["MOCK_IDP_PORT"])
ISSUER = os.environ["MOCK_IDP_ISSUER"]
CLAIMS = json.loads(os.environ.get("MOCK_IDP_CLAIMS", "{}"))
KEY = "mock-idp-key.pem"
BASE = ISSUER.rstrip("/")
def b64u(raw):
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()
def jwks():
    modulus = subprocess.run(
        ["openssl", "rsa", "-in", KEY, "-noout", "-modulus"],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    n = bytes.fromhex(modulus.split("=", 1)[1])
    return {"keys": [{"kty": "RSA", "kid": "mock", "use": "sig", "alg": "RS256",
                      "n": b64u(n), "e": b64u((65537).to_bytes(3, "big"))}]}
def sign(payload):
    header = b64u(json.dumps({"alg": "RS256", "typ": "JWT", "kid": "mock"}).encode())
    body = b64u(json.dumps(payload).encode())
    signature = subprocess.run(
        ["openssl", "dgst", "-sha256", "-sign", KEY],
        input=f"{header}.{body}".encode(), capture_output=True, check=True,
    ).stdout
    return f"{header}.{body}.{b64u(signature)}"
def discovery():
    return {
        "issuer": ISSUER,
        "authorization_endpoint": f"{BASE}/authorize",
        "token_endpoint": f"{BASE}/oauth/token",
        "registration_endpoint": f"{BASE}/oidc/register",
        "jwks_uri": f"{BASE}/.well-known/jwks.json",
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code", "client_credentials", "refresh_token"],
        "code_challenge_methods_supported": ["S256"],
        "scopes_supported": ["openid", "profile", "email"],
        "token_endpoint_auth_methods_supported": ["none", "client_secret_post"],
    }
class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass
    def send_json(self, code, obj):
        raw = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)
    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path.endswith("/.well-known/openid-configuration") or \
                "/.well-known/oauth-authorization-server" in path:
            return self.send_json(200, discovery())
        if path.endswith(("/jwks.json", "/v1/keys", "/keys", "/certs")) or \
                path.rstrip("/").endswith("/jwks"):
            return self.send_json(200, jwks())
        self.send_json(404, {"error": "not_found", "path": path})
    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        length = int(self.headers.get("content-length") or 0)
        raw = self.rfile.read(length).decode() if length else ""
        try:
            form = json.loads(raw)
        except ValueError:
            form = {k: v[0] for k, v in urllib.parse.parse_qs(raw).items()}
        if "token" in path:
            client_id = str(form.get("client_id", "mock-client"))
            extra = {} if client_id.endswith("-norole") else dict(CLAIMS)
            now = int(time.time())
            payload = {"iss": ISSUER,
                       "aud": form.get("audience") or form.get("resource") or "",
                       "sub": client_id, "azp": client_id, "iat": now, "exp": now + 3600,
                       "scope": form.get("scope", "")}
            payload.update(extra)
            return self.send_json(200, {"access_token": sign(payload), "token_type": "Bearer",
                                        "expires_in": 3600, "scope": form.get("scope", "")})
        if "register" in path or path.endswith("/clients"):
            reg = {"client_id": "mock-registered-client"}
            reg.update(form)
            return self.send_json(201, reg)
        self.send_json(404, {"error": "not_found", "path": path})
http.server.HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
MOCK_IDP_EOF
openssl genrsa -out mock-idp-key.pem 2048 2>/dev/null
python3 mock_idp.py &
MOCK_IDP_PID=$!
trap 'kill $MOCK_IDP_PID 2>/dev/null || true' EXIT
for i in $(seq 1 30); do
  if curl -s -o /dev/null "http://localhost:${MOCK_IDP_PORT}/.well-known/openid-configuration"; then
    echo "mock IdP is ready on port ${MOCK_IDP_PORT}"
    break
  fi
  sleep 1
done
