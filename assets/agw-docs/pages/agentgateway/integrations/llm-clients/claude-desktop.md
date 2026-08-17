Configure [Claude Desktop](https://claude.com/download) to route requests through your agentgateway proxy.

## About third-party inference mode {#about}

{{< reuse "agw-docs/snippets/claude-desktop-3p.md" >}}

The steps in this guide run agentgateway on the same machine as Claude Desktop and use the loopback address `127.0.0.1`, so no certificate is needed. To point Claude Desktop at an agentgateway proxy on another host, serve the proxy over HTTPS. For more information, see [HTTPS listeners]({{< link-hextra path="/configuration/listeners/#https-listeners" >}}).

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. Install [Claude Desktop](https://claude.com/download).
3. Choose how the proxy authenticates callers.

   | Method | When to use | Upstream billing |
   | -- | -- | -- |
   | **[Gateway API key](#gateway-api-key)** | Recommended starting point. Agentgateway validates a client key and adds a separately managed Anthropic API key upstream. | Anthropic API account |
   | **[Identity provider](#sso)** | Recommended for an enterprise rollout. Agentgateway validates each user's OIDC token and adds a separately managed Anthropic API key upstream. | Anthropic API account |
   | **[Claude subscription passthrough](#configure-agentgateway)** | Advanced option for preserving per-user Claude subscription usage. Agentgateway passes each user's token upstream and does not independently authenticate the caller. | User's Claude subscription |

   For a gateway API key, configure an LLM model and a [virtual API
   key]({{< link-hextra path="/llm/cost-controls/virtual-keys/" >}}) in
   agentgateway. For subscription passthrough, you need a Claude Pro, Max,
   Team, or Enterprise subscription and the [Claude Code
   CLI](https://code.claude.com/docs), which provides the `claude setup-token`
   command. For identity-provider authentication, you need an OIDC provider
   and an Anthropic API key for the proxy to send upstream.

## Use Client Setup with a gateway API key {#gateway-api-key}

{{< reuse "agw-docs/snippets/llm-client-setup-callout.md" >}}

For Claude Desktop, Client Setup outputs the gateway URL and API key; it does not configure a model name in Claude Desktop. The gateway route must already accept the key and support the Anthropic Messages API at `/v1/messages`, and agentgateway must hold the upstream provider credential. An endpoint that exposes only the OpenAI-compatible `/v1/chat/completions` API is not sufficient. For more information about the UI, see [Admin UI]({{< link-hextra path="/operations/ui/" >}}).

For a managed rollout, see [Manage gateway API keys with Microsoft
Intune]({{< link-hextra
path="/integrations/llm-clients/microsoft-intune/#claude-gateway-api-key" >}}).

To preserve per-user subscription billing instead of using a gateway API key,
continue with the following advanced configuration.

## Optional: Use Claude subscription passthrough {#configure-agentgateway}

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

The backend deliberately has no `backendAuth` policy. In subscription mode,
the bearer token that each user creates with `claude setup-token` must pass
through agentgateway to Anthropic. Do not add a provider API key or apply a
virtual API key policy to this route.

> [!NOTE]
> Claude Code automatically sends the `anthropic-beta: oauth-2025-04-20` header required for OAuth-based authentication. Claude Desktop may require this header to be set as well depending on your client version. If requests fail with a 400 error, add the following to the `passthrough` route policy in your config:
>
> ```yaml
> policies:
>   requestHeaderModifier:
>     add:
>       anthropic-beta: oauth-2025-04-20
> ```

## Configure Claude Desktop with a Claude subscription {#configure-claude-desktop}

1. Get a bearer token for your Claude account.

   ```bash
   claude setup-token
   ```

   Copy the token printed to the terminal.

2. Open Claude Desktop and enable developer mode: **Help → Troubleshooting → Enable Developer Mode**. Then fully quit and relaunch Claude Desktop. A new **Developer** menu appears in the menu bar.

3. In the menu bar, go to **Developer → Configure Third Party Inference → Gateway**.

4. Enter the gateway URL. Use `127.0.0.1` rather than `localhost`.

   ```
   http://127.0.0.1:4001/claude
   ```

5. For **Credential kind**, select **Static API key**. For **Gateway auth
   scheme**, select **Bearer**, and enter the token from step 1 in **Gateway
   API key**. Each user must use their own subscription token. To authenticate
   users with your identity provider and use a centrally managed provider
   credential instead, see [Authenticate users with your identity
   provider](#sso).

6. Open **Models** and add at least one full model ID that the subscription can
   use, such as `claude-opus-5`. Do not use an alias such as `opus`. The
   first entry is the default. Turn off **Model discovery**, or leave it unset;
   an explicit model list makes discovery unnecessary.

7. Click **Test connection**. Claude Desktop tests inference with the first
   configured model. If no explicit model is configured, the test first calls
   `<base-url>/v1/models` and fails when the gateway or provider does not make
   that endpoint available to the subscription token.

   > [!NOTE]
   > With subscription passthrough, the connection test might return HTTP 429
   > with `rate_limit_error` even when normal Cowork inference works. Apply the
   > configuration, send a harmless prompt, and check the agentgateway request
   > log. If the actual `/v1/messages` request returns HTTP 200, treat the
   > connection-test result as a false negative.

8. Click **Apply Changes**, then fully quit Claude Desktop and reopen it. Claude Desktop reads its configuration only at launch.

   > [!NOTE]
   > On macOS, Claude Desktop might not enter third-party inference mode from the settings panel alone. If the app still signs in to Anthropic after you reopen it, set `deploymentMode` to `3p` in the third-party configuration file, then quit and reopen the app again.
   >
   > ```bash
   > python3 - <<'EOF'
   > import json, os
   > p = os.path.expanduser('~/Library/Application Support/Claude-3p/claude_desktop_config.json')
   > d = json.load(open(p))
   > d['deploymentMode'] = '3p'
   > open(p, 'w').write(json.dumps(d, indent=2))
   > EOF
   > ```

For a managed rollout of this subscription configuration, see [Manage Claude
subscriptions with Microsoft Intune]({{< link-hextra
path="/integrations/llm-clients/microsoft-intune/#claude-subscription" >}}).

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
   | Model discovery | **Off** when you use a fixed model list |
   | Models | One or more full model IDs that the backend exposes |

   {{< reuse "agw-docs/snippets/claude-desktop-id-token-warning.md" >}}

6. Click **Test connection**. Then click **Apply Changes**, fully quit Claude
   Desktop, and reopen it. A browser window opens to your identity provider.
   After you sign in, Claude Desktop stores the token and refreshes it in the
   background through the `offline_access` scope.

## Send custom headers {#headers}

Use the **Custom inference headers** field to add a header to every inference request, such as a tenant identifier that a route or a policy matches on. Claude Desktop sends these headers on requests from Chat, Cowork, and Code alike.

To supply a header value that changes over time, set a credential helper instead. A credential helper is an executable that Claude Desktop runs with no arguments and that prints either a bare token or a JSON object in the form `{"token": "...", "headers": {"Name": "Value"}}`. Claude Desktop caches the result and re-runs the helper when the cache expires, with no prompt and no relaunch. Helper headers override custom inference headers of the same name, and a configured helper replaces any static API key. Use a helper to read a short-lived credential from a secret store.

## Roll out to your organization {#mdm}

Configure and test one machine in developer mode first. When the connection works, click **Export** in the **Configure Third Party Inference** panel to produce a profile for your device management system, and distribute it with the tool that you already use, such as Jamf, Intune, Workspace ONE, or Group Policy. Users then receive the configuration on first launch and do not configure anything by hand.

For an end-to-end Microsoft Intune rollout with Entra ID and managed-device
enforcement, see [Manage Claude Desktop with Microsoft Intune]({{< link-hextra
path="/integrations/llm-clients/microsoft-intune/#claude-entra" >}}).

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
  "modelDiscoveryEnabled": false,
  "inferenceModels": ["claude-opus-5"],
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

## Troubleshoot the connection

| Symptom | Likely cause and action |
| -- | -- |
| The connection test calls an unexpected path such as `/claude/claude/v1/models` | Make the base URL match the route prefix exactly. Claude Desktop appends `/v1/models` and `/v1/messages`. |
| The gateway API key connection returns HTTP 401 | Confirm that Claude Desktop sends the client key generated by Client Setup and that the route is protected by the matching virtual-key policy. |
| A subscription request logs `api key authentication failure` | A virtual API key policy is protecting the subscription route. Remove it from this route so that the subscription bearer token can pass upstream. |
| The test needs at least one model after `/v1/models` fails | Add a full model ID under **Models** and disable or skip model discovery. |
| Anthropic returns `authentication_error` in gateway API key or OIDC mode | Confirm that the backend holds a valid Anthropic API key. |
| Anthropic returns `authentication_error` in subscription mode | Generate a new token with `claude setup-token`, confirm that the auth scheme is **Bearer**, and make sure the backend does not inject a provider API key. |
| Anthropic returns HTTP 400 in subscription mode | Add or forward `anthropic-beta: oauth-2025-04-20` as described in [Configure agentgateway with a Claude subscription](#configure-agentgateway). |
| The subscription connection test returns HTTP 429, but a normal prompt succeeds | The connection test can produce a false negative with subscription passthrough. Confirm that the real `/v1/messages` request returns HTTP 200 in the agentgateway log, and use actual inference as the final validation. |
| Normal inference returns HTTP 429 with `rate_limit_error` | The request reached Anthropic, but the subscription or API account might be at a usage limit or temporarily throttled. Check the applicable Anthropic usage dashboard or Claude usage indicator, wait for the reset, or choose an available model. See the [Claude error reference](https://code.claude.com/docs/en/errors#usage-limits). |
| No request appears in the agentgateway output | Check the base URL, agentgateway process, certificate for a remote host, DNS, and network path. |

## Next steps

{{< cards >}}
  {{< card path="/llm/providers/anthropic" title="Anthropic provider" subtitle="Complete Anthropic provider configuration" >}}
  {{< card path="/llm/prompt-guards/" title="Prompt guards" subtitle="Set up guardrails for LLM requests and responses" >}}
{{< /cards >}}
