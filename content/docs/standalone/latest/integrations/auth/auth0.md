---
title: Auth0
weight: 30
description: Protect MCP servers with Auth0 as the authorization server.
---

[Auth0](https://auth0.com/) is an identity platform that provides authentication and authorization services. Agentgateway includes a native `auth0` MCP authentication provider so that you can use Auth0 as the authorization server for your MCP servers.

In this guide, you create an API and applications in Auth0, protect a sample MCP server with the `auth0` provider, and verify that agentgateway rejects unauthenticated requests and admits tokens that Auth0 issues.

## Why the Auth0 provider is needed {#why}

MCP clients follow the [MCP authorization specification](https://modelcontextprotocol.io/specification/draft/basic/authorization), which relies on OAuth behaviors that Auth0 implements differently. Auth0 does not support [RFC 8707](https://www.rfc-editor.org/rfc/rfc8707.html) resource indicators, which MCP clients use to request a token for a specific resource. Instead, Auth0 expects its own [`audience` parameter](https://auth0.com/docs/secure/tokens/access-tokens/get-access-tokens). Without a workaround, Auth0 issues an opaque access token that agentgateway cannot validate as a JWT.

When you set `provider.auth0`, agentgateway bridges this gap as follows:

- Appends your first configured audience to Auth0's authorization endpoint as an `audience` query parameter, so that Auth0 issues a JWT for your API rather than an opaque token. You verify this in [Step 3](#verify).
- Fetches keys from `{issuer}/.well-known/jwks.json` after removing the trailing slash from the issuer value.

For the underlying `mcpAuthentication` fields, see [MCP authentication]({{< link-hextra path="/documentation/configuration/security/mcp-authn" >}}).

## Before you begin {#before-you-begin}

1. [Install the agentgateway binary]({{< link-hextra path="/documentation/setup/install/binary/" >}}).
2. Install [Node.js](https://nodejs.org/) so that `npx` can run the sample MCP server.
3. Make sure that you have access to an [Auth0 tenant](https://auth0.com/docs/get-started/auth0-overview/create-tenants) and permission to create an API and applications in it. A free tenant is sufficient.

## Step 1: Set up Auth0 {#register}

Create an API and the applications that your clients use, then collect the values that agentgateway needs.

1. In the Auth0 Dashboard, go to **Applications > APIs** and click **Create API**. Enter a name such as `agentgateway API`, and set the **Identifier** to the resource URL that your MCP clients request, such as `https://api.example.com`. The identifier becomes the `aud` claim of the tokens that Auth0 issues.

2. On the API's **Settings** tab, enable **Add Permissions in the Access Token**. Then define the permissions that your MCP server enforces on the **Permissions** tab, such as `read:tools`. You use this permission in [Step 5](#authorization).

3. Go to **Applications > Applications** and click **Create Application**. Choose **Native** for local MCP clients, or **Single Page Application** for browser-based clients. Both are public clients that use PKCE, which is what MCP clients require. On the application's **Settings** tab, under **Application URIs**, add the callback URLs of the MCP clients that you plan to connect.

4. Create a second application of type **Machine to Machine**, authorize it for the API that you created, and grant it the `read:tools` permission. You use this application to request a token from the command line in [Step 4](#token), which keeps the verification steps scriptable. Note its **Client ID** and **Client Secret**.

5. Save the values that the rest of this guide uses.

   ```sh
   export AUTH0_TENANT_URL='https://your-tenant.us.auth0.com'
   export AUTH0_ISSUER="${AUTH0_TENANT_URL}/"
   export AUTH0_AUDIENCE='https://api.example.com'
   export AUTH0_CLIENT_ID='<your-m2m-client-id>'
   export AUTH0_CLIENT_SECRET='<your-m2m-client-secret>'
   ```

   | Variable | Where to find it |
   | -------- | ---------------- |
   | `AUTH0_TENANT_URL` | Your tenant URL, including `https://` and with no trailing slash. The **Domain** on any application's **Settings** tab, prefixed with `https://`. |
   | `AUTH0_ISSUER` | Derived from the tenant URL. Auth0 mints the `iss` claim with a trailing slash, so this value keeps it. |
   | `AUTH0_AUDIENCE` | The **Identifier** of the API that you created in step 1. |
   | `AUTH0_CLIENT_ID` and `AUTH0_CLIENT_SECRET` | The **Settings** tab of the machine-to-machine application from step 4. |

   Agentgateway expands `${...}` references when it loads a configuration file, so the same variables also fill in the `config.yaml` that you create next. If a variable is unset, agentgateway exits with `environment variable not found` rather than starting with a broken configuration.

## Step 2: Configure and start agentgateway {#configure}

1. Create a `config.yaml` file that exposes a sample MCP server on port 3000 and protects it with the `auth0` provider.

   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   gateways:
     default:
       port: 3000
   routes:
   - backends:
     - mcp:
         targets:
         - name: everything
           stdio:
             cmd: npx
             args: ["@modelcontextprotocol/server-everything"]
     policies:
       mcpAuthentication:
         mode: strict
         issuer: ${AUTH0_ISSUER}
         audiences:
         - ${AUTH0_AUDIENCE}
         provider:
           auth0: {}
         resourceMetadata:
           resource: http://localhost:3000/mcp
           scopesSupported:
           - read:tools
           bearerMethodsSupported:
           - header
   ```

   {{< reuse "agw-docs/snippets/review-table.md" >}}

   | Setting | Description |
   | ------- | ----------- |
   | `issuer` | Your Auth0 tenant domain, including the trailing slash. Auth0 mints the `iss` claim with a trailing slash, and this value must match it. |
   | `audiences` | The **Identifier** of your Auth0 API. The first entry is the value that agentgateway sends to Auth0 as the `audience` query parameter, so list your API identifier first. |
   | `provider.auth0` | Enables the Auth0-specific behavior described in [Why the Auth0 provider is needed](#why). Takes no fields. |
   | `resourceMetadata` | The protected resource metadata that agentgateway serves to MCP clients, which you inspect in [Step 3](#verify). |
   | `jwks` | Optional. Because `provider.auth0` is set, the derived JWKS URL uses the issuer value without its trailing slash. To fetch keys from somewhere else, such as a local file or an internal mirror, set `jwks` explicitly to override the derived URL. |

2. Start agentgateway.

   ```sh
   agentgateway -f config.yaml
   ```

   Example output:

   ```
   info  state_manager  loaded config from File("config.yaml")
   info  app            serving UI at http://localhost:15000/ui
   info  proxy::gateway started bind  bind="bind/3000"
   ```

## Step 3: Verify that unauthenticated requests are rejected {#verify}

Agentgateway runs in the foreground, so run the following commands in another terminal.

1. Send an MCP `initialize` request without a token.

   ```sh
   curl -i -X POST http://localhost:3000/mcp \
     -H 'content-type: application/json' \
     -H 'accept: application/json, text/event-stream' \
     -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"1.0"}},"id":1}'
   ```

   Agentgateway returns `401` with a `WWW-Authenticate` header that points MCP clients at the protected resource metadata.

   ```
   HTTP/1.1 401 Unauthorized
   www-authenticate: Bearer resource_metadata="http://localhost:3000/.well-known/oauth-protected-resource/mcp"

   {"error":"unauthorized","error_description":"JWT token required"}
   ```

2. Follow that pointer to see the metadata that the gateway serves.

   ```sh
   curl -s http://localhost:3000/.well-known/oauth-protected-resource/mcp
   ```

   Example output:

   ```json
   {"resource":"http://localhost:3000/mcp","authorization_servers":["http://localhost:3000/mcp"],"mcp_protocol_version":"2025-06-18","resource_type":"mcp-server","bearer_methods_supported":["header"],"scopes_supported":["read:tools"]}
   ```

3. Confirm that agentgateway appends your audience to Auth0's authorization endpoint.

   ```sh
   curl -s http://localhost:3000/.well-known/oauth-authorization-server
   ```

   The `authorization_endpoint` carries an `audience` query parameter that Auth0's own discovery document does not include.

   ```json
   ...
   "authorization_endpoint": "https://your-tenant.us.auth0.com/authorize?audience=https://api.example.com",
   "token_endpoint": "https://your-tenant.us.auth0.com/oauth/token",
   ```

## Step 4: Call the MCP server with a token {#token}

MCP clients complete the OAuth flow themselves. To get a token by hand, use the client credentials flow with the machine-to-machine application from [Step 1](#register).

1. Request a token from your tenant. The `audience` parameter is what makes Auth0 return a JWT for your API rather than an opaque token.

   ```sh
   export TOKEN="$(curl -s -X POST "${AUTH0_TENANT_URL}/oauth/token" \
     -d grant_type=client_credentials \
     -d "client_id=${AUTH0_CLIENT_ID}" \
     -d "client_secret=${AUTH0_CLIENT_SECRET}" \
     -d "audience=${AUTH0_AUDIENCE}" \
     | jq -r .access_token)"
   ```

2. Send the token as a bearer token.

   ```sh
   curl -i -X POST http://localhost:3000/mcp \
     -H "authorization: Bearer ${TOKEN}" \
     -H 'content-type: application/json' \
     -H 'accept: application/json, text/event-stream' \
     -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"1.0"}},"id":1}'
   ```

   Agentgateway fetches Auth0's keys from the derived JWKS URL, validates the token, and returns the MCP server's response.

   ```
   HTTP/1.1 200 OK
   content-type: text/event-stream
   mcp-session-id: 0511047b-3f97-4dcf-9fec-4457b4c3c229

   event: message
   data: {"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05", ... ,"serverInfo":{"name":"mcp-servers/everything","title":"Everything Reference Server","version":"2.0.0"}}}
   ```

   > [!TIP]
   > The client credentials flow is a convenience for this guide. Real MCP clients use the authorization code flow with PKCE, which the gateway advertises through the metadata that you inspected in [Step 3](#verify).

## Step 5: Restrict access by permission {#authorization}

Because MCP authentication runs at the route level, you can use claims from the validated Auth0 token in an [authorization]({{< link-hextra path="/documentation/configuration/security/mcp-authz" >}}) policy. Auth0 puts the permissions that you grant to an application in the `permissions` claim when the API has **Add Permissions in the Access Token** enabled, which you did in [Step 1](#register).

1. Add an `authorization` policy alongside `mcpAuthentication` in your `config.yaml` that requires the `read:tools` permission.

   ```yaml
     policies:
       mcpAuthentication:
         mode: strict
         issuer: ${AUTH0_ISSUER}
         audiences:
         - ${AUTH0_AUDIENCE}
         provider:
           auth0: {}
         resourceMetadata:
           resource: http://localhost:3000/mcp
           scopesSupported:
           - read:tools
           bearerMethodsSupported:
           - header
       authorization:
         rules:
         # Check for the read:tools permission in the token
         - '"read:tools" in jwt.permissions'
   ```

2. Restart agentgateway to apply the policy. Because the machine-to-machine application was granted `read:tools`, the request from [Step 4](#token) still succeeds.

   ```sh
   agentgateway -f config.yaml
   ```

3. To confirm that the rule is enforced, create another **Machine to Machine** application in Auth0, authorize it for your API, but do not grant it the `read:tools` permission. Save its credentials.

   ```sh
   export AUTH0_UNAUTHORIZED_CLIENT_ID='<second-m2m-client-id>'
   export AUTH0_UNAUTHORIZED_CLIENT_SECRET='<second-m2m-client-secret>'
   ```

4. Request a token with that application and repeat the request.

   ```sh
   export NO_PERM_TOKEN="$(curl -s -X POST "${AUTH0_TENANT_URL}/oauth/token" \
     -d grant_type=client_credentials \
     -d "client_id=${AUTH0_UNAUTHORIZED_CLIENT_ID}" \
     -d "client_secret=${AUTH0_UNAUTHORIZED_CLIENT_SECRET}" \
     -d "audience=${AUTH0_AUDIENCE}" \
     | jq -r .access_token)"

   curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/mcp \
     -H "authorization: Bearer ${NO_PERM_TOKEN}" \
     -H 'content-type: application/json' \
     -H 'accept: application/json, text/event-stream' \
     -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"1.0"}},"id":1}'
   ```

   The token is valid, so authentication succeeds, but the authorization rule denies the request with `403`.

   ```
   403
   ```

## Connect an MCP client {#connect}

Point your MCP client at the gateway's MCP endpoint, `http://localhost:3000/mcp`. The client discovers the authorization server through the gateway, and redirects the user to Auth0 to log in and consent.

## Learn more

- [Auth0 documentation](https://auth0.com/docs)
- [MCP authentication]({{< link-hextra path="/documentation/configuration/security/mcp-authn" >}})
- [MCP authorization]({{< link-hextra path="/documentation/configuration/security/mcp-authz" >}})
