---
title: JWT authentication
weight: 15
description: Verify JWT tokens from incoming requests using JWKS and configured issuers.
test:
  jwt-authn:
  - file: ${versionRoot}/documentation/configuration/security/jwt-authn.md
    path: jwt-authn
---

Attaches to: {{< badge content="Listener" path="/documentation/configuration/listeners/">}} {{< badge content="Route" path="/documentation/configuration/routes/">}}

{{< reuse "agw-docs/snippets/config-styles-note.md" >}}

{{< doc-test paths="jwt-authn" >}}
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
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

* The **issuer** verifies that tokens come from the specified issuer (`iss`). Agentgateway rejects a token from another issuer, and it also rejects a token that has no `iss` claim.
* The **audiences** lists allowed audience values (`aud`). The token's `aud` claim must contain at least one of these values. Omit the field to accept any audience. An empty list also accepts any audience, and a non-empty list rejects a token that has no `aud` claim.
* The **jwks** defines the list of public keys to verify against.

When a `jwtAuth` policy lists more than one entry under `providers`, agentgateway tries each provider whose `issuer` matches the token's `iss` claim and whose JWKS contains the token's `kid`, in the listed order. The first provider that validates the signature and claims accepts the token. As a result, multiple issuers can publish the same `kid` value, and several providers can share one issuer, such as providers with different `audiences`.

If a token includes a not-before claim (`nbf`), agentgateway rejects the token when the `nbf` value is more than 60 seconds in the future. The `nbf` claim is optional by default. To require it, add `nbf` to `requiredClaims`.

> [!IMPORTANT]
> In version 1.4 and earlier, a configured issuer matched only when the `iss` claim was present, and a non-empty `audiences` list matched only when the `aud` claim was present. A token that omitted the claim passed. From version 1.5, each claim is required, so a token that omits it is rejected. Setting `requiredClaims: []` does not restore the earlier behavior, because it removes only the claim requirements that you add yourself, not the ones that the configured `issuer` and `audiences` imply. If a client sends tokens without an `aud` claim, remove the `audiences` field instead of emptying `requiredClaims`.

Additionally, authentication can run in three different modes:
* **Strict**: A valid token, issued by a configured issuer, must be present.
* **Optional** (default): If a token exists, validate it.  
  *Warning*: This allows requests without a JWT token!
* **Permissive**: Requests are never rejected. This is useful for usage of claims in later steps (authorization, logging, etc).  
  *Warning*: This allows requests without a JWT token!

After it validates a token, agentgateway removes the token from the location that it was read from, so that the backend never receives the client's credential. Two settings change that.

* Set `preserveToken: true` on the `jwtAuth` policy to leave the validated token where it was found. Use this setting when another policy on the same route reads the token from the request, such as an [OAuth token exchange]({{< link-hextra path="/documentation/configuration/security/backend-authn/token-exchange/standard/" >}}) that takes it as the subject token.
* Set the `passthrough` [backend authentication]({{< link-hextra path="/documentation/configuration/security/backend-authn/" >}}) method to forward the validated token to one backend. Prefer this form when only the backend needs the token, because it does not expose the credential to every policy that runs later.

You can configure JWT authentication in the UI or in your configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
The following steps add the same `jwtAuth` policy as the **Simplified (LLM)** example in the **Config file** tab.

1. Save your JWKS to a file on the gateway host, such as `./manifests/jwt/pub-key`. The file must exist before you save the policy. Otherwise, the save fails with a `failed to load JWKS` error.
2. Create a configuration with an LLM model, but no JWT policy. You add the policy in the UI.
   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   llm:
     models:
     - name: "*"
       provider: openAI
       params:
         apiKey: "$OPENAI_API_KEY"
   ```
3. Start agentgateway with this configuration.
4. Open [http://localhost:15000/ui/llm/policies](http://localhost:15000/ui/llm/policies) (**LLM** > **Policies**), and click the **JWT auth** tile.
5. In the **Enforcement** section, select **Strict** for the **Validation mode**.
6. In the **Signing keys** section, select **Local file** for the **JWKS source**. Then, enter `./manifests/jwt/pub-key` for the **JWKS file**. A relative path is resolved from the folder that agentgateway runs from.
7. In the **Token validation** section, fill out the following fields.
   1. Enter `agentgateway.dev` for the **Issuer**.
   2. In **Audiences**, enter `test.agentgateway.dev`, and click **Add**.
   3. Keep the default **Required claims** selection, `exp`.

   {{< reuse-image src="img/ui-llm-policy-jwt-auth.png" srcDark="img/ui-llm-policy-jwt-auth-dark.png" alt="JWT authentication drawer with a local JWKS file, the agentgateway.dev issuer, and the test.agentgateway.dev audience" >}}

8. Click **Save policy**.

The UI also writes an empty `jwtValidationOptions` field, which keeps the default required claims. The form supports one issuer. To configure more than one entry under `providers`, use the **Raw** icon (`<>`) in the drawer header or the **Config file** tab.

You can also add a JWT policy in **MCP** > **Policies**, or in the **Gateway policies** section of a gateway in **Traffic** > **Gateways**.

Whether the UI can save depends on your storage mode. For more information, see [Save changes from the UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/#save-changes" >}}).
{{% /tab %}}
{{% tab name="Config file" %}}
{{< tabs >}}
{{< tab name="Simplified (LLM)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  policies:
    jwtAuth:
      mode: strict
      issuer: agentgateway.dev
      audiences: [test.agentgateway.dev]
      jwks:
        # Relative to the folder the binary runs from, not the config file
        file: ./manifests/jwt/pub-key
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
```
{{< /tab >}}
{{< tab name="Simplified (MCP)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    jwtAuth:
      mode: strict
      issuer: agentgateway.dev
      audiences: [test.agentgateway.dev]
      jwks:
        # Relative to the folder the binary runs from, not the config file
        file: ./manifests/jwt/pub-key
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
```
{{< /tab >}}
{{< tab name="Routing-based" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
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
{{< /tab >}}
{{< /tabs >}}
{{% /tab %}}
{{< /tabs >}}

{{< doc-test paths="jwt-authn" >}}
# WHAT THIS TEST VALIDATES:
#   * The jwtAuth policy is accepted by agentgateway in all three configuration
#     forms: routing-based (gateways), simplified LLM (llm.policies), and
#     simplified MCP (mcp.policies).
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That a token is actually verified at runtime — requires minting a signed
#     JWT and a backend the page omits.
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
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

cat <<'EOF' > config-llm.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  policies:
    jwtAuth:
      mode: strict
      issuer: agentgateway.dev
      audiences: [test.agentgateway.dev]
      jwks:
        file: ./manifests/jwt/pub-key
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
EOF
agentgateway -f config-llm.yaml --validate-only

cat <<'EOF' > config-mcp.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    jwtAuth:
      mode: strict
      issuer: agentgateway.dev
      audiences: [test.agentgateway.dev]
      jwks:
        file: ./manifests/jwt/pub-key
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
EOF
agentgateway -f config-mcp.yaml --validate-only
{{< /doc-test >}}

It is common to pair `jwtAuth` with `authorization`, using the `claims` from the verified JWT.
For example:

{{< tabs >}}
{{% tab name="UI" %}}
The following steps add the `authorization` policy from the **Simplified (LLM)** example in the **Config file** tab. First, add the `jwtAuth` policy with the **JWT auth** tile. For the steps, see the **UI** tab that adds the `jwtAuth` policy on this page.

1. Open [http://localhost:15000/ui/llm/policies](http://localhost:15000/ui/llm/policies) (**LLM** > **Policies**), and click the **Authorization** tile.
2. Click **Add rule**. Keep the **Allow** effect.
3. Replace the example expression with `request.path == "/admin" && jwt.groups.contains("admins")`.

   {{< reuse-image src="img/ui-llm-policy-jwt-authorization.png" srcDark="img/ui-llm-policy-jwt-authorization-dark.png" alt="Authorization policy drawer with one allow rule for the /admin path and the admins group" >}}

4. Click **Save policy**.

In **MCP** > **Policies**, add the same two policies. For the **Routing-based** example, add the **JWT auth** policy in the gateway's **Gateway policies** section. Then, add the **Authorization** policy in the **Route policies** section of a named route.
{{% /tab %}}
{{% tab name="Config file" %}}
{{< tabs >}}
{{< tab name="Simplified (LLM)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  policies:
    jwtAuth:
      mode: strict
      issuer: agentgateway.dev
      audiences: [test.agentgateway.dev]
      jwks:
        file: ./manifests/jwt/pub-key
    authorization:
      rules:
      - allow: 'request.path == "/admin" && jwt.groups.contains("admins")'
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
```
{{< /tab >}}
{{< tab name="Simplified (MCP)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    jwtAuth:
      mode: strict
      issuer: agentgateway.dev
      audiences: [test.agentgateway.dev]
      jwks:
        file: ./manifests/jwt/pub-key
    authorization:
      rules:
      - allow: 'request.path == "/admin" && jwt.groups.contains("admins")'
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
```
{{< /tab >}}
{{< tab name="Routing-based" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
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
{{< /tab >}}
{{< /tabs >}}
{{% /tab %}}
{{< /tabs >}}

{{< doc-test paths="jwt-authn" >}}
# WHAT THIS TEST VALIDATES:
#   * The jwtAuth + authorization example config is accepted by agentgateway in
#     all three configuration forms: routing-based (gateways), simplified LLM
#     (llm.policies), and simplified MCP (mcp.policies).
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That the authorization rule actually allows/denies at runtime — requires
#     minting a signed JWT with the `admins` group and a backend the page omits.
cat <<'EOF' > config2.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
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

cat <<'EOF' > config2-llm.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  policies:
    jwtAuth:
      mode: strict
      issuer: agentgateway.dev
      audiences: [test.agentgateway.dev]
      jwks:
        file: ./manifests/jwt/pub-key
    authorization:
      rules:
      - allow: 'request.path == "/admin" && jwt.groups.contains("admins")'
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
EOF
agentgateway -f config2-llm.yaml --validate-only

cat <<'EOF' > config2-mcp.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    jwtAuth:
      mode: strict
      issuer: agentgateway.dev
      audiences: [test.agentgateway.dev]
      jwks:
        file: ./manifests/jwt/pub-key
    authorization:
      rules:
      - allow: 'request.path == "/admin" && jwt.groups.contains("admins")'
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
EOF
agentgateway -f config2-mcp.yaml --validate-only
{{< /doc-test >}}