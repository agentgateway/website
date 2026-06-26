---
title: JWT authentication
weight: 15
description: Verify JWT tokens from incoming requests using JWKS and configured issuers.
test:
  jwt-authn:
  - file: content/docs/standalone/main/configuration/security/jwt-authn.md
    path: jwt-authn
---

Attaches to: {{< badge content="Listener" path="/configuration/listeners/">}} {{< badge content="Route" path="/configuration/routes/">}}

{{< doc-test paths="jwt-authn" >}}
{{< reuse "agw-docs/snippets/install-agentgateway.md" >}}
{{< /doc-test >}}

{{< doc-test paths="jwt-authn" >}}
# Create the JWKS file referenced by the examples
mkdir -p manifests/jwt
cat <<'EOF' > manifests/jwt/pub-key
{"keys": [{"kty": "RSA", "kid": "test", "use": "sig", "alg": "RS256", "n": "teXe4sfDoHQR5YUos3nsY_Ax6J2xrgXnIfUziaTWJ4nljejLVyg8m0g6SK9zrSaCvLm9GxAhpaJ_48RalwqDt4spBPQ8uvr-54jHrECboAbTxhy2T-oXP80Duz0xauSDVlyA_xenoCA24MFJ1rgHppy1F1eYTD-CQ-IxhXLNm5mE3rJufP_pdnMy0q6acXSfPtEzMJY3BYNV5umqimkOgH9PqQWd1RAgYdE7z5fvdCb4T4K667rRRT75PqRB4GJgSY-zQrC4CEVCw_ql7bfdouFcxXwsyh7AfImIEamA1LMODvMXVZWkZ8V0w_VEK6NHqr-BGOBVAUfRqYAEPxfaIw", "e": "AQAB"}]}
EOF
{{< /doc-test >}}

{{< gloss "JWT (JSON Web Token)" >}}JWT tokens{{< /gloss >}} from incoming requests can be verified.

JWT authentication requires a few parameters:

* The **issuer** verifies that tokens come from the specified issuer (`iss`).
* The **audiences** lists allowed audience values (`aud`)
* The **jwks** defines the list of public keys to verify against.

Additionally, authentication can run in three different modes:
* **Strict**: A valid token, issued by a configured issuer, must be present.
* **Optional** (default): If a token exists, validate it.  
  *Warning*: This allows requests without a JWT token!
* **Permissive**: Requests are never rejected. This is useful for usage of claims in later steps (authorization, logging, etc).  
  *Warning*: This allows requests without a JWT token!

The following example shows a complete configuration that verifies JWTs on the listener before forwarding requests to a backend.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - policies:
      jwtAuth:
        mode: strict
        issuer: agentgateway.dev
        audiences: [test.agentgateway.dev]
        jwks:
          # Relative to the folder the binary runs from, not the config file
          file: ./manifests/jwt/pub-key
    routes:
    - backends:
      - host: localhost:8080
```

{{< doc-test paths="jwt-authn" >}}
# WHAT THIS TEST VALIDATES:
#   * The jwtAuth listener example config is accepted by agentgateway.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That a token is actually verified at runtime — requires minting a signed
#     JWT and a backend on localhost:8080 the page omits.
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - policies:
      jwtAuth:
        mode: strict
        issuer: agentgateway.dev
        audiences: [test.agentgateway.dev]
        jwks:
          # Relative to the folder the binary runs from, not the config file
          file: ./manifests/jwt/pub-key
    routes:
    - backends:
      - host: localhost:8080
EOF
agentgateway -f config.yaml --validate-only
{{< /doc-test >}}

It is common to pair `jwtAuth` with `authorization`, using the `claims` from the verified JWT. The following example verifies the JWT on the listener, then applies a route-level authorization rule that allows access to `/admin` only for tokens with the `admins` group claim.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - policies:
      jwtAuth:
        mode: strict
        issuer: agentgateway.dev
        audiences: [test.agentgateway.dev]
        jwks:
          file: ./manifests/jwt/pub-key
    routes:
    - policies:
        authorization:
          rules:
          - allow: 'request.path == "/admin" && jwt.groups.contains("admins")'
      backends:
      - host: localhost:8080
```

{{< doc-test paths="jwt-authn" >}}
# WHAT THIS TEST VALIDATES:
#   * The jwtAuth + route-level authorization example config is accepted by
#     agentgateway.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That the authorization rule actually allows/denies at runtime — requires
#     minting a signed JWT with the `admins` group and a backend the page omits.
cat <<'EOF' > config2.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - policies:
      jwtAuth:
        mode: strict
        issuer: agentgateway.dev
        audiences: [test.agentgateway.dev]
        jwks:
          file: ./manifests/jwt/pub-key
    routes:
    - policies:
        authorization:
          rules:
          - allow: 'request.path == "/admin" && jwt.groups.contains("admins")'
      backends:
      - host: localhost:8080
EOF
agentgateway -f config2.yaml --validate-only
{{< /doc-test >}}