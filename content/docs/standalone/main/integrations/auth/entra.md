---
title: Microsoft Entra ID
weight: 60
description: Protect MCP servers with Microsoft Entra ID (Azure AD) as the authorization server.
---

[Microsoft Entra ID](https://learn.microsoft.com/en-us/entra/identity-platform/) is Microsoft's cloud identity platform. Agentgateway includes a native `entra` MCP authentication provider so that you can use Entra as the authorization server for your MCP servers, even though Entra does not fully implement the OAuth behaviors that the [MCP authorization specification](https://modelcontextprotocol.io/specification/draft/basic/authorization) assumes.

## Why the Entra provider is needed {#why}

MCP clients such as Claude follow the MCP authorization spec, which relies on OAuth features that Entra handles differently. Without the `entra` provider, you would need to run a separate adapter proxy in front of agentgateway to bridge these gaps. 

Entra deviates from the MCP spec in three main ways:

- **It rejects the RFC 8707 `resource` parameter.** MCP clients are required to send `resource`, but Entra's v2.0 endpoints reject it alongside v2-style scopes with `AADSTS9010010: invalid_target`.
- **No Dynamic Client Registration (RFC 7591).** Entra has no client registration endpoint.
- **No RFC 8414 authorization server metadata.** Entra serves only OIDC discovery (`openid-configuration`), not the `oauth-authorization-server` metadata that MCP clients discover through the gateway.

When you set `provider.entra`, agentgateway bridges these gaps as follows:

- Fetches the tenant's v2.0 `openid-configuration` and serves it as RFC 8414 authorization server metadata, injecting `code_challenge_methods_supported: ["S256"]` because Entra supports PKCE but omits it from its discovery document.
- Advertises gateway-proxied `authorize` and `token` endpoints, and strips the `resource` parameter before forwarding requests to Entra.
- Short-circuits Dynamic Client Registration by returning your pre-registered `clientId`.
- Injects a `clientSecret` into proxied token requests for confidential (Web platform) app registrations.

For the underlying `mcpAuthentication` fields, see [MCP authentication]({{< link-hextra path="/configuration/security/mcp-authn" >}}).

## Before you begin {#before-you-begin}

{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}

## Register an app in Entra ID {#register}

Register an application in Microsoft Entra ID and collect the values that agentgateway needs.

1. Make sure that you have access to a [Microsoft Entra ID tenant](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-create-new-tenant). If you do not have one, you can create a free tenant for development purposes.

2. [Register an application](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app) in the Microsoft Entra admin center. During registration:
   - For **Supported account types**, choose the option that fits your organization. For testing, **Accounts in this organizational directory only** is sufficient.
   - Under **Redirect URI**, add the callback URLs of the MCP clients that you plan to connect. Choose the platform based on the client type:
     - **Mobile and desktop applications** for public clients that use PKCE, such as local MCP clients. Public clients do not require a client secret.
     - **Web** for confidential clients. Entra requires a client secret at the token endpoint for Web-platform apps.

     {{< callout type="warning" >}}
     Do not use the **Single-page application (SPA)** platform. Entra redeems SPA-issued authorization codes only through browser cross-origin requests (`AADSTS9002327`), which does not work behind the gateway's token proxy.
     {{< /callout >}}

3. After registration, collect the following values from the app's **Overview** page. Save them as environment variables.

   ```bash
   export ENTRA_TENANT_ID=<your-tenant-id>
   export ENTRA_CLIENT_ID=<your-application-client-id>
   ```

   | Value | Where to find it | Description |
   | ----- | ---------------- | ----------- |
   | Tenant ID | **Overview** > **Directory (tenant) ID** | The unique identifier for your Entra ID tenant. Agentgateway derives the Entra endpoints from this value. |
   | Application (client) ID | **Overview** > **Application (client) ID** | The unique identifier for the registered app. Use this value as `clientId` in your agentgateway config. Tokens issued for this app include the ID as the audience (`aud`) claim, in the `api://<client-id>` or bare `<client-id>` format. |

4. Expose an API so that tokens can be issued for this app.
   1. Go to your app registration and select **Expose an API**.
   2. Next to **Application ID URI**, click **Set** and accept the default value of `api://${ENTRA_CLIENT_ID}`.
   3. Click **Add a scope**. Enter a scope name such as `mcp_access`, set **Who can consent** to **Admins and users**, fill in the display name and description, and click **Add scope**. You reference this scope in the `resourceMetadata.scopesSupported` field of your agentgateway config.

5. If your app registration uses the **Web** platform (confidential client), create a client secret.
   1. Go to **Certificates & secrets** > **Client secrets** > **New client secret**.
   2. Save the secret **Value** (not the Secret ID). You cannot retrieve this value later.

      ```bash
      export ENTRA_CLIENT_SECRET=<your-client-secret-value>
      ```

## Configure agentgateway {#configure}

Configure the `mcpAuthentication` policy with the `entra` provider. Note the following Entra-specific requirements:

- The route must match the `/.well-known/oauth-authorization-server/<path>` path prefix so that agentgateway can serve the bridged metadata and proxy the `authorize` and `token` endpoints.
- Set `clientId` to your app registration's Application (client) ID. Agentgateway uses it to short-circuit Dynamic Client Registration.
- List both the `api://<client-id>` and bare `<client-id>` audience formats to accept the `aud` claim that Entra mints for v1 and v2 tokens.
- The `jwks` field is optional. When omitted, agentgateway defaults to `https://login.microsoftonline.com/<tenant-id>/discovery/v2.0/keys`.

{{< tabs >}}
{{< tab name="Simplified (MCP)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    cors:
      allowOrigins: ["*"]
      allowHeaders: ["*"]
      exposeHeaders: ["Mcp-Session-Id"]
    mcpAuthentication:
      # v2 issuer form. The v1 form https://sts.windows.net/<tenant-id>/ is also
      # supported; use it when the app registration mints v1 access tokens.
      issuer: https://login.microsoftonline.com/<tenant-id>/v2.0
      audiences:
      - api://<client-id>
      - <client-id>
      provider:
        entra: {}
      # Pre-registered app registration (client) id. Entra has no Dynamic Client
      # Registration, so the gateway answers registration requests with this id.
      clientId: <client-id>
      # Required only for confidential (Web platform) app registrations.
      clientSecret: <client-secret>
      resourceMetadata:
        resource: http://localhost:3000/mcp
        scopesSupported:
        - api://<client-id>/mcp_access
        bearerMethodsSupported:
        - header
  targets:
  - name: tools
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
routes:
- backends:
  - mcp:
      targets:
      - name: tools
        stdio:
          cmd: npx
          args: ["@modelcontextprotocol/server-everything"]
  matches:
  - path:
      exact: /mcp
  - path:
      exact: /.well-known/oauth-protected-resource/mcp
  - path:
      pathPrefix: /.well-known/oauth-authorization-server/mcp
  policies:
    cors:
      allowOrigins: ["*"]
      allowHeaders: ["*"]
      exposeHeaders: ["Mcp-Session-Id"]
    mcpAuthentication:
      issuer: https://login.microsoftonline.com/<tenant-id>/v2.0
      audiences:
      - api://<client-id>
      - <client-id>
      provider:
        entra: {}
      clientId: <client-id>
      clientSecret: <client-secret>
      resourceMetadata:
        resource: http://localhost:3000/mcp
        scopesSupported:
        - api://<client-id>/mcp_access
        bearerMethodsSupported:
        - header
```
{{< /tab >}}
{{< /tabs >}}

## Public vs. confidential clients {#client-secret}

Whether you need a `clientSecret` depends on the platform of your Entra app registration:

- **Public clients** (**Mobile and desktop applications** platform with public client flows enabled) authenticate with PKCE only. Omit `clientSecret`. The flow is pure PKCE end to end.
- **Confidential clients** (**Web** platform) require client authentication at the token endpoint in addition to PKCE (`AADSTS7000218` otherwise). Set `clientSecret` to the secret that you created for your app registration. Agentgateway attaches it server-side, only to `authorization_code` and `refresh_token` requests for the configured `clientId`.

{{< callout type="info" >}}
`clientSecret` is the credential of your own app registration, not a credential that MCP clients supply. MCP clients always remain public clients that use PKCE: the gateway advertises `token_endpoint_auth_method: none` in the registration response.
{{< /callout >}}

## Connect an MCP client {#connect}

Point your MCP client at the gateway's MCP endpoint, for example `http://localhost:3000/mcp`. The client discovers the bridged authorization server metadata, registers with your pre-configured `clientId`, and completes the OAuth 2.1 authorization code flow with PKCE through Entra. After the user signs in, agentgateway validates the Entra-issued token on each request and enforces any additional route policies.

## Claim-based authorization {#authorization}

Because MCP authentication runs at the route level, you can use claims from the validated Entra token in an [authorization]({{< link-hextra path="/configuration/security/mcp-authz" >}}) policy. For example, check for an app role or group claim:

```yaml
policies:
  mcpAuthentication:
    issuer: https://login.microsoftonline.com/<tenant-id>/v2.0
    audiences:
    - api://<client-id>
    - <client-id>
    provider:
      entra: {}
    clientId: <client-id>
  authorization:
    rules:
    # Check for an app role assigned in Entra ID
    - '"mcp.admin" in jwt.roles'
```

## Learn more

- [Microsoft identity platform documentation](https://learn.microsoft.com/en-us/entra/identity-platform/)
- [MCP authentication]({{< link-hextra path="/configuration/security/mcp-authn" >}})
- [MCP authorization]({{< link-hextra path="/configuration/security/mcp-authz" >}})
