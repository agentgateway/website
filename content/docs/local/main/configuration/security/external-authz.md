---
title: External authorization
weight: 20
---

Attach to:
{{< badge content="Listener" link="/docs/configuration/listeners/">}} {{< badge content="Route" link="/docs/configuration/routes/">}}

When {{< gloss "Authorization (AuthZ)" >}}authorization{{< /gloss >}} decisions need to be made out-of-process, use an external authorization policy.
This policy has agentgateway send the request to an external server, such as [Open Policy Agent](https://www.openpolicyagent.org/docs/envoy) which decides whether the request is allowed or denied.
You can configure agentgateway to do this by using the [External Authorization gRPC service](https://www.envoyproxy.io/docs/envoy/latest/api-v3/service/auth/v3/external_auth.proto) or by using HTTP requests.

## gRPC External Authorization

The [Envoy External Authorization gRPC service](https://www.envoyproxy.io/docs/envoy/latest/api-v3/service/auth/v3/external_auth.proto) provides a standardized API to make authorization decisions.
Agentgateway is API-compatible with the Envoy External Authorization gRPC service.

> [!NOTE]
> gRPC refers to the protocol of the external authorization service. The service can authorize both gRPC and HTTP requests from the user.

When an ExtAuthz server returns header modifications, agentgateway uses `insert` instead of `append` for response headers. This ensures headers are properly set rather than potentially duplicated.

Example configuration:

```yaml
extAuthz:
  host: localhost:9000
  protocol:
    grpc:
      # Optional: metadata to send to the external authorization service
      # The value is a CEL expression
      metadata:
        dev.agentgateway.jwt: '{"claims": jwt}'
```

## HTTP External Authorization

HTTP External Authorization allows sending plain HTTP requests to an authorization service.
If the service returns a 2xx status code, the request is allowed. Otherwise, it is denied.

Example configuration: For the full set of options, see the [configuration reference]({{< link-hextra path="/reference/configuration" >}}).

```yaml
extAuthz:
  host: localhost:9000
  protocol:
    includeRequestHeaders:
      # By default, only the Authorization header is included.
      - cookie
    http:
      # We send to /auth/<original request path>.
      path: |
        "/auth" + request.path
      includeResponseHeaders:
      # Pass the user request to the upstream service.
      # This is not required, and is just an example
      - x-auth-request-user
```

For advanced cases, configure settings for the request to the authorization service, as well as the response from the authorization service.
For example, configure `redirect` to redirect users to a signin page, and `metadata` to extract information from the authorization response to include in logs. Review the following table for more advanced options.

|Option|Description|
|---|---|
|`protocol.http.path`|CEL expression to construct the request path|
|`protocol.http.includeResponseHeaders`|Specific headers from the authorization response will be copied into the request to the backend.|
|`protocol.http.addRequestHeaders`|Specific headers to add in the authorization request, based on the CEL expression|
|`protocol.http.redirect`|When server returns "unauthorized", redirect to the URL resolved by the provided expression rather than directly returning the error.|
|`protocol.http.metadata`|Metadata to include under the `extauthz` variable, based on the authorization response.|
|`includeRequestHeaders`|Specific headers to include in the authorization request.<br>If unset, the gRPC protocol sends all request headers. The HTTP protocol sends only 'Authorization'.|
|`includeRequestBody`|Options for including the request body in the authorization request|
|`includeRequestBody.maxRequestBytes`|Maximum size of request body to buffer (default: 8192)|
|`includeRequestBody.allowPartialMessage`|If true, send partial body when max_request_bytes is reached|


For some more advanced scenarios, follow these examples:
* [Oauth2 Proxy](https://oauth2-proxy.github.io/oauth2-proxy/) integration ([example](https://github.com/agentgateway/agentgateway/tree/main/examples/oauth2-proxy)). 
* [Tailscale](https://tailscale.com/) integration ([example](https://github.com/agentgateway/agentgateway/tree/main/examples/tailscale-auth)). 
