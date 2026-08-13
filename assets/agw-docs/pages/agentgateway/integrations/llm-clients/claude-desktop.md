Configure [Claude Desktop](https://claude.com/download) to route requests through your agentgateway proxy.

## About third-party inference mode {#about}

{{< reuse "agw-docs/snippets/claude-desktop-3p.md" >}}

The steps in this guide run agentgateway on the same machine as Claude Desktop and use the loopback address `127.0.0.1`, so no certificate is needed. To point Claude Desktop at an agentgateway proxy on another host, serve the proxy over HTTPS. For more information, see [HTTPS listeners]({{< link-hextra path="/configuration/listeners/#https-listeners" >}}).

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. Install [Claude Desktop](https://claude.com/download).
3. Decide how the proxy authenticates callers, and meet the requirements for that path.

   * **A gateway API key**, which [Use Client Setup with a gateway API key](#client-setup) covers. Configure an LLM model and a [virtual API key]({{< link-hextra path="/llm/cost-controls/virtual-keys/" >}}) in agentgateway.
   * **A shared token from a Claude subscription**, which [Configure agentgateway with a Claude subscription](#configure-agentgateway) covers. You need a Claude Teams or Pro subscription, and the [Claude Code CLI](https://code.claude.com/docs) (`npm install -g @anthropic-ai/claude-code`), which provides the `claude setup-token` command.
   * **A per-user token from your identity provider**, which [Authenticate users with your identity provider](#sso) covers. You need an OIDC provider and an Anthropic API key for the proxy to send upstream.

## Use Client Setup with a gateway API key {#client-setup}

{{< reuse "agw-docs/snippets/llm-client-setup-callout.md" >}}

For Claude Desktop, Client Setup outputs the gateway URL and API key; it does not configure a model name in Claude Desktop. The gateway route must already accept the key and support the Anthropic Messages API at `/v1/messages`, and agentgateway must hold the upstream provider credential. An endpoint that exposes only the OpenAI-compatible `/v1/chat/completions` API is not sufficient. For more information about the UI, see [Admin UI]({{< link-hextra path="/operations/ui/" >}}).

{{< reuse-image-light src="img/ui-client-setup-claude-desktop.png" alt="Admin UI Client Setup page with the Claude Desktop recipe selected, showing the gateway URL and API key to enter in Claude Desktop" >}}
{{< reuse-image-dark srcDark="img/ui-client-setup-claude-desktop-dark.png" alt="Admin UI Client Setup page with the Claude Desktop recipe selected, showing the gateway URL and API key to enter in Claude Desktop" >}}

> [!NOTE]
> Client Setup fills its **Model** and **Virtual API key** dropdowns from the `llm` section of your configuration. The configuration in this guide scopes the key to a route instead, so that it applies only to the `/claude` path, and those dropdowns therefore do not list it. Client Setup reports `No models configured` against this configuration. Select **Raw value** in the **Virtual API key** dropdown and paste the key to generate the recipe, or read the gateway URL and key from the steps that follow. To manage models and keys in the `llm` section so that Client Setup lists them, see [Virtual keys]({{< link-hextra path="/llm/cost-controls/virtual-keys/" >}}).

The following steps configure agentgateway to validate a client API key on the route and to send your own Anthropic credential upstream, then point Claude Desktop at that route. Client Setup generates the client-side values only; it does not create any of this configuration.

1. Save your Anthropic API key and the client API key that Claude Desktop sends to agentgateway. These are two different credentials: the first is what agentgateway sends to Anthropic, and the second is what Claude Desktop sends to agentgateway. Agentgateway reads variable references in the configuration file from the environment at startup.

   The client API key is a value that you choose, not one that a provider issues to you. Agentgateway accepts whatever string the policy in the next step lists, so generate an unguessable one.

   ```bash
   export ANTHROPIC_API_KEY=<your-anthropic-api-key>
   export GATEWAY_API_KEY="agw_sk_$(openssl rand -hex 32)"
   ```

   The `agw_sk_` prefix is the convention that the Admin UI follows when it generates a key, and it makes the value easy to recognize in a client's settings. To create and store keys interactively instead, use **LLM > Virtual API Keys > New key**, which offers an auto-generate option (`agw_sk_*****`) and a **Copy** action. For that workflow, see [Virtual keys]({{< link-hextra path="/llm/cost-controls/virtual-keys/" >}}).

   {{< doc-test paths="claude-desktop-gateway-key" >}}
   # WHAT THIS TEST VALIDATES:
   #   * the gateway-API-key config block parses and passes --validate-only
   #   * agentgateway starts with it and serves the /claude route on 4001
   #   * apiKey mode: strict rejects a request with no Authorization header, with
   #     agentgateway's own 401 body (the negative check in "Verify the connection")
   #   * a request carrying the client key gets PAST the gateway's own auth, which is
   #     what distinguishes a gateway rejection from an upstream one
   # WHAT THIS TEST DOES NOT VALIDATE (and why):
   #   * every Claude Desktop panel step (developer mode, Configure Third-Party
   #     Inference, Credential kind, Apply Changes) — UI-only step, no scriptable
   #     equivalent for a desktop app
   #   * a successful completion through to Anthropic — external dependency, needs a
   #     real ANTHROPIC_API_KEY, so the test asserts only that gateway auth passed
   #   * the Claude subscription and interactive sign-in paths — the former needs a
   #     Claude subscription token from `claude setup-token`, the latter an OIDC provider
   #   * the macOS deploymentMode workaround — modifies a desktop app's config file
   # The placeholders in the visible export block are deliberately not shell-safe
   # (unquoted <...> would redirect), so the test supplies its own defaults here and
   # takes real values from the environment when they are set.
   export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-sk-ant-not-a-real-key}"
   export GATEWAY_API_KEY="${GATEWAY_API_KEY:-agw_sk_docs_example_key}"
   {{< /doc-test >}}

2. Create a configuration file that requires the client API key on the route and attaches the Anthropic credential to the backend.

   ```yaml {paths="claude-desktop-gateway-key"}
   cat > config.yaml << 'EOF'
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   gateways:
     default:
       port: 4001
       protocol: HTTP
   routes:
   - name: claude-agent
     matches:
     - path:
         pathPrefix: /claude
     policies:
       urlRewrite:
         path:
           prefix: /
       apiKey:
         mode: strict
         keys:
         - key: "$GATEWAY_API_KEY"
           metadata:
             user: claude-desktop
     backends:
     - ai:
         name: claude-agent
         provider:
           anthropic: {}
         policies:
           backendAuth:
             key: "$ANTHROPIC_API_KEY"
           ai:
             routes:
               /v1/messages: messages
               /v1/messages/count_tokens: anthropicTokenCount
               '*': passthrough
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}}

   | Setting | Description |
   | -- | -- |
   | `apiKey.mode` | Set to `strict` so that agentgateway rejects any request that does not carry a valid key. The default value, `optional`, admits unauthenticated requests. |
   | `apiKey.keys` | The client keys that this route accepts. Claude Desktop sends the key in the `Authorization: Bearer <key>` header. |
   | `metadata` | Optional labels attached to requests authenticated with this key, which you can use in metrics and logs to attribute traffic. |
   | `backendAuth.key` | The Anthropic API key that agentgateway sends upstream. The client never holds this credential. |

   For more information about client keys, see [Virtual keys]({{< link-hextra path="/llm/cost-controls/virtual-keys/" >}}).

3. Start agentgateway.

   ```bash
   agentgateway -f config.yaml
   ```

   {{< doc-test paths="claude-desktop-gateway-key" >}}
   # Claude Desktop gateway API key: schema-gate the config before running it, so a field
   # error is reported as such rather than as a confusing startup failure.
   agentgateway --validate-only -f config.yaml
   # The visible block runs in the foreground, so the test starts its own background copy.
   # Output goes to a file so nothing can leak into a captured value.
   agentgateway -f config.yaml > agw-claude-desktop.log 2>&1 &
   AGW_PID=$!
   stop_gateway() {
     [ -n "${AGW_PID:-}" ] || return 0
     kill "$AGW_PID" 2>/dev/null || true
     wait "$AGW_PID" 2>/dev/null || true
     AGW_PID=""
   }
   trap stop_gateway EXIT
   for i in $(seq 1 30); do
     curl -s -o /dev/null --max-time 2 http://127.0.0.1:4001/claude/v1/messages && break
     sleep 1
   done
   if ! curl -s -o /dev/null --max-time 5 http://127.0.0.1:4001/claude/v1/messages; then
     echo "FAIL: agentgateway did not start serving /claude on 127.0.0.1:4001"
     cat agw-claude-desktop.log
     exit 1
   fi
   {{< /doc-test >}}

4. {{< reuse "agw-docs/snippets/claude-desktop-developer-mode.md" >}}

5. In the menu bar, go to **Developer → Configure Third Party Inference → Gateway**.

6. Enter the gateway URL. Use `127.0.0.1` rather than `localhost`.

   ```
   http://127.0.0.1:4001/claude
   ```

7. For the **Credential kind** dropdown, select `Static API key`. In the **Gateway API key** field, enter the `GATEWAY_API_KEY` value from step 1.

8. Click **Apply Changes**, then fully quit Claude Desktop and reopen it. Claude Desktop reads its configuration only at launch.

   {{< reuse "agw-docs/snippets/claude-desktop-3p-macos.md" >}}

To use a Claude subscription token instead of a gateway API key, continue with the following sections.

## Configure agentgateway with a Claude subscription {#configure-agentgateway}

Start agentgateway with the Teams configuration. Agentgateway listens on port `4001` and exposes Claude at the `/claude` path.

1. Create a configuration file.

   ```yaml
   cat > config.yaml << 'EOF'
   gateways:
     default:
       port: 4001
       protocol: HTTP
   routes:
   - name: claude-agent
     matches:
     - path:
         pathPrefix: /claude
     policies:
       urlRewrite:
         path:
           prefix: /
     backends:
     - ai:
         name: claude-agent
         provider:
           anthropic: {}
         policies:
           ai:
             routes:
               /v1/messages: messages
               /v1/messages/count_tokens: anthropicTokenCount
               '*': passthrough
   EOF
   ```

2. Start agentgateway.

   ```bash
   agentgateway -f config.yaml
   ```

> [!NOTE]
> Claude Code automatically sends the `anthropic-beta: oauth-2025-04-20` header required for OAuth-based authentication. Claude Desktop may require this header to be set as well depending on your client version. If requests fail with a 400 error, add the following to the `passthrough` route policy in your config:
>
> ```yaml
> policies:
>   requestHeaderModifier:
>     add:
>       anthropic-beta: oauth-2025-04-20
> ```

## Configure Claude Desktop with a Claude subscription

1. Get a bearer token for your Claude account.

   ```bash
   claude setup-token
   ```

   Copy the token printed to the terminal.

2. {{< reuse "agw-docs/snippets/claude-desktop-developer-mode.md" >}}

3. In the menu bar, go to **Developer → Configure Third Party Inference → Gateway**.

4. Enter the gateway URL. Use `127.0.0.1` rather than `localhost`.

   ```
   http://127.0.0.1:4001/claude
   ```

5. For the **Credential kind** dropdown, select `Static API key` and then in the **Gateway API key** field, enter the bearer token you copied in step 1. To authenticate each user with your identity provider instead of requiring users to pass the same shared token, see [Authenticate users with your identity provider](#sso).

6. Click **Apply Changes**, then fully quit Claude Desktop and reopen it. Claude Desktop reads its configuration only at launch.

   {{< reuse "agw-docs/snippets/claude-desktop-3p-macos.md" >}}

## Authenticate users with your identity provider {#sso}

{{< reuse "agw-docs/snippets/claude-desktop-sso-overview.md" >}}

The following steps use Microsoft Entra ID as the example identity provider. Any OpenID Connect (OIDC) provider works the same way. Substitute your own issuer URL, client ID, and JWKS URL.

1. Register an application with your identity provider, and record the client ID and the issuer URL. Claude Desktop is a public client that receives the redirect on a loopback address, so configure the application accordingly.

   | Setting | Value |
   | -- | -- |
   | Client type | Public client. Claude Desktop holds no client secret. |
   | Redirect URI | `http://127.0.0.1/callback` |
   | Scopes | `openid profile email offline_access` |

   > [!IMPORTANT]
   > Two details about the redirect URI cause most failures:
   >
   > * Include the `/callback` path. Claude Desktop redirects to `http://127.0.0.1:<port>/callback`, and a registration of `http://127.0.0.1` alone does not match. On Entra ID, the mismatch returns `AADSTS50011`.
   > * Register the URI as a native or desktop client, not a web client. Claude Desktop picks an ephemeral port for each sign-in. A native client registration accepts any loopback port, as described in [RFC 8252](https://datatracker.ietf.org/doc/html/rfc8252#section-7.3), and a web client registration requires an exact port match. On Entra ID, select the **Mobile and desktop applications** platform and set **Allow public client flows** to **Yes**.

2. Save the identifiers from your registration and your Anthropic API key, so that agentgateway can resolve them. Agentgateway reads variable references in the configuration file from the environment at startup.

   ```bash
   export TENANT_ID=<your-tenant-id>
   export CLIENT_ID=<your-client-id>
   export ANTHROPIC_API_KEY=<your-anthropic-api-key>
   ```

3. Update your configuration file to validate the token on the route and to send an Anthropic API key upstream. Interactive sign-in puts the identity provider token in the `Authorization` header, so the proxy must supply the provider credential itself rather than pass a user token upstream.

   ```yaml
   cat > config.yaml << 'EOF'
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   gateways:
     default:
       port: 4001
       protocol: HTTP
   routes:
   - name: claude-agent
     matches:
     - path:
         pathPrefix: /claude
     policies:
       urlRewrite:
         path:
           prefix: /
       jwtAuth:
         mode: strict
         issuer: https://login.microsoftonline.com/$TENANT_ID/v2.0
         audiences:
         - $CLIENT_ID
         jwks:
           url: https://login.microsoftonline.com/$TENANT_ID/discovery/v2.0/keys
     backends:
     - ai:
         name: claude-agent
         provider:
           anthropic: {}
         policies:
           backendAuth:
             key: "$ANTHROPIC_API_KEY"
           ai:
             routes:
               /v1/messages: messages
               /v1/messages/count_tokens: anthropicTokenCount
               '*': passthrough
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}}

   | Setting | Description |
   | -- | -- |
   | `jwtAuth.mode` | Set to `strict` so that agentgateway rejects any request that has no valid token. The default value, `optional`, admits requests that carry no token at all. |
   | `jwtAuth.issuer` | The expected `iss` claim. Validating the issuer alongside the signature is what ties a token to your tenant. |
   | `jwtAuth.audiences` | The expected `aud` claim. For an ID token, the audience is the client ID of the application that you registered. |
   | `jwtAuth.jwks.url` | The JWKS endpoint that agentgateway fetches signing keys from. |
   | `backendAuth.key` | The Anthropic API key that agentgateway sends upstream. Because the user token authenticates the caller, this credential no longer comes from the client. |

   For more detail on JWT validation, see [JWT authentication]({{< link-hextra path="/configuration/security/jwt-authn/" >}}).

4. Restart agentgateway to load the new configuration.

   ```bash
   agentgateway -f config.yaml
   ```

5. In Claude Desktop, go to **Developer → Configure Third Party Inference → Gateway** and set the following fields.

   | Field | Value |
   | -- | -- |
   | Credential kind | **Interactive sign-in** |
   | Gateway base URL | `http://127.0.0.1:4001/claude` |
   | Client ID | The client ID of the application that you registered |
   | Issuer URL | `https://login.microsoftonline.com/$TENANT_ID/v2.0` |
   | Bearer token | **ID token** |
   | Scopes | `openid profile email offline_access` |

   {{< reuse "agw-docs/snippets/claude-desktop-id-token-warning.md" >}}

6. Click **Apply Changes**, then fully quit Claude Desktop and reopen it. A browser window opens to your identity provider. After you sign in, Claude Desktop stores the token and refreshes it in the background through the `offline_access` scope.

## Send custom headers {#headers}

Use the **Custom inference headers** field to add a header to every inference request, such as a tenant identifier that a route or a policy matches on. Claude Desktop sends these headers on requests from Chat, Cowork, and Code alike.

To supply a header value that changes over time, set a credential helper instead. A credential helper is an executable that Claude Desktop runs with no arguments and that prints either a bare token or a JSON object in the form `{"token": "...", "headers": {"Name": "Value"}}`. Claude Desktop caches the result and re-runs the helper when the cache expires, with no prompt and no relaunch. Helper headers override custom inference headers of the same name, and a configured helper replaces any static API key. Use a helper to read a short-lived credential from a secret store.

## Roll out to your organization {#mdm}

Configure and test one machine in developer mode first. When the connection works, click **Export** in the **Configure Third Party Inference** panel to produce a profile for your device management system, and distribute it with the tool that you already use, such as Jamf, Intune, Workspace ONE, or Group Policy. Users then receive the configuration on first launch and do not configure anything by hand.

Managed configuration takes precedence over local settings, so a user cannot point the app at a different endpoint. The delivery mechanism differs per operating system.

| Operating system | Managed configuration |
| -- | -- |
| macOS | A configuration profile that writes `/Library/Managed Preferences/<user>/com.anthropic.claudefordesktop.plist` |
| Windows | Registry values under `HKLM\SOFTWARE\Policies\Claude`, which override any values under `HKCU` |
| Linux | A root-owned `/etc/claude-desktop/managed-settings.json` file that is not writable by group or other |

The following example shows the Linux form. On macOS and Windows, write every value as a string, including numbers, booleans, and nested JSON.

```json
{
  "inferenceProvider": "gateway",
  "inferenceGatewayBaseUrl": "https://agentgateway.example.com/claude",
  "inferenceCredentialKind": "interactive",
  "inferenceGatewayOidc": {
    "issuer": "https://login.microsoftonline.com/$TENANT_ID/v2.0",
    "clientId": "$CLIENT_ID",
    "scopes": "openid profile email offline_access",
    "bearerTokenType": "id_token"
  },
  "inferenceCustomHeaders": {
    "X-Tenant-Id": "acme"
  }
}
```

For every available key and for the per-region profiles that a multi-region deployment needs, see the [Claude Desktop configuration reference](https://claude.com/docs/third-party/claude-desktop/configuration).

## Verify the connection

Send a message in Claude Desktop. If the connection is successful, responses flow through your agentgateway proxy and appear in the terminal where agentgateway is already running.

Look for log entries like the following in your running agentgateway output:

```
info  request gateway=default/default listener=http route=claude-agent endpoint=api.anthropic.com:443 http.method=POST http.path=/v1/messages http.status=200 protocol=llm
```

If you configured gateway API key or OIDC authentication in strict mode, send a request without the `Authorization` header and confirm that agentgateway rejects it. This negative check verifies that the route does not admit unauthenticated requests.

```bash {paths="claude-desktop-gateway-key"}
curl -i http://127.0.0.1:4001/claude/v1/messages -H content-type:application/json -d '{
  "model": "claude-sonnet-4-5",
  "max_tokens": 16,
  "messages": [{"role": "user", "content": "hi"}]
}'
```

{{< doc-test paths="claude-desktop-gateway-key" >}}
BODY_FILE=$(mktemp)
# Negative: no Authorization header must be refused BY AGENTGATEWAY, not upstream.
CODE=$(curl -s -o "$BODY_FILE" -w '%{http_code}' --max-time 20 \
  http://127.0.0.1:4001/claude/v1/messages -H content-type:application/json \
  -d '{"model":"claude-sonnet-4-5","max_tokens":16,"messages":[{"role":"user","content":"hi"}]}')
if [ "$CODE" != "401" ]; then
  echo "FAIL: expected 401 without an Authorization header, got $CODE"; cat "$BODY_FILE"; exit 1
fi
if ! grep -q "no API Key found" "$BODY_FILE"; then
  echo "FAIL: 401 did not come from agentgateway's API key policy. Body was:"; cat "$BODY_FILE"; exit 1
fi
echo "OK: agentgateway refused the unauthenticated request"

# Positive: the client key must get PAST agentgateway's own auth. The upstream call is
# expected to fail without a real ANTHROPIC_API_KEY, so assert only that the rejection is
# no longer agentgateway's — that is exactly the distinction the guide describes.
CODE=$(curl -s -o "$BODY_FILE" -w '%{http_code}' --max-time 30 \
  http://127.0.0.1:4001/claude/v1/messages -H content-type:application/json \
  -H "Authorization: Bearer $GATEWAY_API_KEY" \
  -d '{"model":"claude-sonnet-4-5","max_tokens":16,"messages":[{"role":"user","content":"hi"}]}')
if grep -q "no API Key found" "$BODY_FILE"; then
  echo "FAIL: the client key was refused by agentgateway (status $CODE). Body was:"; cat "$BODY_FILE"; exit 1
fi
echo "OK: the client key passed agentgateway's API key policy (upstream status $CODE)"
rm -f "$BODY_FILE"
{{< /doc-test >}}

Check the response body, not only the status code. Agentgateway rejects the request itself, and the body names the reason.

```
HTTP/1.1 401 Unauthorized
api key authentication failure: no API Key found
```

Anthropic also returns `401` when it rejects a credential, so the status code alone does not tell you which hop refused the request. An upstream rejection returns a JSON body with a `request_id` instead.

## Next steps

{{< cards >}}
  {{< card path="/llm/providers/anthropic" title="Anthropic provider" subtitle="Complete Anthropic provider configuration" >}}
  {{< card path="/llm/prompt-guards/" title="Prompt guards" subtitle="Set up guardrails for LLM requests and responses" >}}
{{< /cards >}}
