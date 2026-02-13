---
title: External processing (ExtProc)
weight: 16
description: 
---

Attach to:
{{< badge content="Listener" link="/docs/configuration/listeners/">}} {{< badge content="Route" link="/docs/configuration/routes/">}}

{{< gloss "ExtProc (External Processing)" >}}External processing{{< /gloss >}} is an advanced filter that allows arbitrary modifications to HTTP requests and responses with an external processing server.

Agentgateway is API-compatible with Envoy's [External Processing gRPC service](https://www.envoyproxy.io/docs/envoy/latest/api-v3/service/ext_proc/v3/external_processor.proto).

## About external processing

With agentgateway's external processing (ExtProc) integration, you can implement an external gRPC processing server that can read and modify all aspects of an HTTP request or response. Agentgateway extracts specific information from the request or response, such as the headers, the body, or trailers, and automatically forwards them to the ExtProc server. The ExtProc server then manipulates these attributes according to your rules and returns the modified attributes. Agentgateway injects the modified attributes before forwarding traffic to an upstream or downstream service. The request or response can also be terminated at any given time.

## How it works

```mermaid
sequenceDiagram
    participant Client
    participant Agentgateway
    participant ExtProcServer
    participant Backend

    Client->>Agentgateway: Send request with headers
    Agentgateway->>ExtProcServer: Forward request headers
    ExtProcServer->>ExtProcServer: Modify headers
    ExtProcServer-->>Agentgateway: Send back modified headers 
    Agentgateway->>Agentgateway: Add headers to request
    Agentgateway->>Backend: Forward request to backend.
```

1. The client sends a request with headers to agentgateway.
2. Agentgateway extracts the header information and sends it to the external processing server.
3. The external processing server modifies, adds, or removes the request headers.
4. The modified request headers are sent back to agentgateway.
5. The modified headers are added to the request.
6. The request is forwarded to the backend service.

## Failure modes

You can choose whether you want agentgateway to forward requests if the external processing server is unavailable with the `extProc.failureMode` setting. Choose between the following modes: 

* **failOpen (not recommended)**: Forward requests to the backend service, even if the connection to the external processing server fails. You might choose this option to ensure availability of the backend services even when the ExtProc service is down.
* **failClosed**: Block requests if the request to the external processing server fails. This is the default behavior. 

> [!WARNING]
> `failOpen` mode, as specified in the Envoy External Processing API, allows transitive timeouts to corrupt requests, which can lead to unexpected behavior. As such, the mode is fundamentally unsafe and should not be used.

## Compatibility

The [External Processing gRPC service](https://www.envoyproxy.io/docs/envoy/latest/api-v3/service/ext_proc/v3/external_processor.proto) was designed for Envoy,
and includes a number of Envoy-specific fields that do not make sense outside of Envoy.
Although agentgateway aims to support the API as closely as possible, there are some gaps.

A non-exhaustive list of these gaps is as follows:
* Headers and Body are *always* sent, with Body in streaming mode. This means your server must process both headers and the body.
* `attributes`, `metadata_context`, and `protocol_config` are never sent in requests.
* `dynamic_metadata`, `mode_override`, and `override_message_timeout` are ignored in all responess.
* `clear_route_cache` is ignored in responses. Agentgateway does not have a route cache.
* `status.CONTINUE_AND_REPLACE` is ignored in responses.

If any incompatibility causes issues for your external processing server, open an issue on the [agentgateway GitHub repository](https://github.com/agentgateway/agentgateway/issues).

## Setup

External processing can be applied at the route or the gateway level. If applied to both, the route-level policy takes precedence.

{{< tabs items="Route-level,Gateway-level">}}
{{% tab %}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - ai:
         name: openai
         provider:
           openAI:
             # Optional; overrides the model in requests
             model: gpt-3.5-turbo
      policies:
        backendAuth:
          key: "$OPEN_AI_APIKEY"
        extProc:
          host: "extproc.com:9000"
          failureMode: failClosed
```
{{% /tab %}}
{{% tab %}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - gatewayName: my-gateway
gatewayPolicies:
  - name: extproc
    target:
      gateway: my-gateway
    policy:
      extProc:
        host: "extproc.com:9000"
        failureMode: failClosed
```
{{% /tab %}}
{{< /tabs >}}
