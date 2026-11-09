---
title: Compression
weight: 12
description: Compress responses to clients and decompress encoded request bodies.
---

Use the `traffic.compression` policy to reduce the size of responses that are sent to clients, and to decode compressed request bodies before other policies and the backend read them. You can configure response compression, request decompression, or both in the same policy.

## About compression

The compression policy works in two directions.

* **Response compression** (`traffic.compression.response.compress`): The gateway proxy compresses an eligible response with an algorithm that the client accepts in its `Accept-Encoding` request header. If the client does not send `Accept-Encoding`, or accepts none of the configured algorithms, the response is sent uncompressed.
* **Request decompression** (`traffic.compression.request.decompress`): The gateway proxy decodes a request body that the client sent with a `Content-Encoding` header, such as `Content-Encoding: gzip`. Later policies and the backend receive the plain body.

You can choose from the following algorithms: `Gzip`, `Brotli`, `Deflate`, and `Zstd`. If you configure an empty `compress` or `decompress` block, the policy uses `Gzip`.

### Response compression

The gateway proxy compresses a response only when all of the following conditions are true:

* The response has a body. Responses with a `1xx`, `204`, or `304` status code are not compressed.
* The response does not already have a `Content-Encoding` header.
* The response is not a partial response with a `Content-Range` header.
* The response does not have a `Cache-Control: no-transform` header.
* The response has a known length of at least 32 bytes. Streamed responses without a known length, such as server-sent events, are sent as-is.
* The response has a text-based content type. The following types are compressed: `application/javascript`, `application/json`, `application/xml`, `application/xhtml+xml`, `image/svg+xml`, `text/css`, `text/html`, `text/javascript`, `text/plain`, and `text/xml`. Types with a `+json` or `+xml` suffix, such as `application/problem+json`, are also compressed. Images, video, audio, fonts, and archives are already compressed, so they are sent as-is.

To choose the algorithm, the gateway proxy compares the configured `algorithms` list with the client's `Accept-Encoding` header. The algorithm with the highest quality value (`q`) wins. If the client accepts several algorithms equally, the first algorithm in your `algorithms` list wins. A `*` entry in `Accept-Encoding` applies to every configured algorithm that the client does not list by name. If the client gives `identity` a higher quality value than every configured algorithm, the response is sent uncompressed.

When the gateway proxy compresses a response, it makes the following header changes:

* Sets `Content-Encoding` to the chosen algorithm, such as `gzip` or `br`.
* Removes the `Content-Length` and `Accept-Ranges` headers.
* Changes a strong `ETag` to a weak `ETag`, such as `W/"abc"`, because the bytes that are sent no longer match the original.

For every eligible response, the gateway proxy also adds a `Vary: accept-encoding` header, even when the client receives the uncompressed response. This header tells caches that the response depends on the `Accept-Encoding` request header.

Response compression runs after every other response policy, so policies such as transformations see the uncompressed body. Access logs also record the uncompressed body. The gateway proxy reads the client's `Accept-Encoding` header before request header modifiers run, so removing that header for the backend does not turn off compression for the client.

### Request decompression

The gateway proxy decodes a request body only when the `Content-Encoding` header names a single algorithm that is in your `algorithms` list. Request bodies with any other encoding, or with more than one layer of encoding, such as `Content-Encoding: gzip, br`, are forwarded unchanged. After the gateway proxy decodes the body, it removes the `Content-Encoding` and `Content-Length` headers from the request.

Decompression runs after authentication and authorization, so a denied request is never decoded. Authentication, authorization, and policies in the `PreRouting` phase see the encoded body. Route-level policies that read the body, such as rate limiting, external processing, and transformations, see the decoded body.

## Compression settings

| Field | Description | Default |
| -- | -- | -- |
| `traffic.compression.response.compress.algorithms` | The algorithms that the gateway proxy can choose from, based on the client's `Accept-Encoding` header. Possible values are `Gzip`, `Brotli`, `Deflate`, and `Zstd`. If the client accepts several algorithms equally, the first algorithm in the list wins. | `[Gzip]` |
| `traffic.compression.request.decompress.algorithms` | The algorithms that the gateway proxy decodes from request bodies. Possible values are `Gzip`, `Brotli`, `Deflate`, and `Zstd`. Request bodies with any other encoding are forwarded unchanged. | `[Gzip]` |

Keep in mind the following validation rules:

* `traffic.compression` must set `response`, `request`, or both. `response` must set `compress`, and `request` must set `decompress`. To use the defaults, set an empty block, such as `decompress: {}`.
* If you set `algorithms`, the list must contain 1 to 4 values, and each value can appear only once. Values are case-sensitive, such as `Gzip`, not `gzip`.
* The compression policy cannot be used in a policy with `traffic.phase: PreRouting`.

For the full set of fields, see the [API reference]({{< link-hextra path="/reference/api/" >}}).

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Compress responses and decompress requests

Use a {{< reuse "agw-docs/snippets/policy.md" >}} to configure compression for a Gateway, HTTPRoute, or route rule.

1. Create a policy that applies to the httpbin HTTPRoute. The policy compresses responses with `Gzip`, `Brotli`, or `Zstd`. The empty `decompress` block decodes request bodies that are encoded with the default algorithm, `Gzip`.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: compression
     namespace: httpbin
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: HTTPRoute
       name: httpbin
     traffic:
       compression:
         response:
           compress:
             algorithms:
             - Gzip
             - Brotli
             - Zstd
         request:
           decompress: {}
   EOF
   ```

2. Send a request to the httpbin app and advertise support for `gzip` in the `Accept-Encoding` header. Verify that the response has the `content-encoding: gzip` and `vary: accept-encoding` headers.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -s -o /dev/null -D - http://$INGRESS_GW_ADDRESS:80/json \
     -H "host: www.example.com:80" \
     -H "Accept-Encoding: gzip"
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl -s -o /dev/null -D - localhost:8080/json \
     -H "host: www.example.com" \
     -H "Accept-Encoding: gzip"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:

   ```console {hl_lines=[5,6]}
   HTTP/1.1 200 OK
   Access-Control-Allow-Credentials: true
   Access-Control-Allow-Origin: *
   Content-Type: application/json; encoding=utf-8
   content-encoding: gzip
   vary: accept-encoding
   transfer-encoding: chunked
   ```

3. Send the request without an `Accept-Encoding` header. The response is not compressed, so it has a `Content-Length` header and no `content-encoding` header. The response still includes the `vary: accept-encoding` header.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -s -o /dev/null -D - http://$INGRESS_GW_ADDRESS:80/json \
     -H "host: www.example.com:80"
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl -s -o /dev/null -D - localhost:8080/json \
     -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:

   ```console {hl_lines=[5,6]}
   HTTP/1.1 200 OK
   Access-Control-Allow-Credentials: true
   Access-Control-Allow-Origin: *
   Content-Type: application/json; encoding=utf-8
   Content-Length: 421
   vary: accept-encoding
   ```

4. Send a request body that is compressed with `gzip` to the httpbin `/anything` endpoint, which echoes the request back. The gateway proxy decodes the body, so httpbin receives the plain JSON body. The `headers` that httpbin received do not include `Content-Encoding`.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   echo '{"hello":"world"}' | gzip | curl -s http://$INGRESS_GW_ADDRESS:80/anything \
     -H "host: www.example.com:80" \
     -H "Content-Type: application/json" \
     -H "Content-Encoding: gzip" \
     --data-binary @-
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   echo '{"hello":"world"}' | gzip | curl -s localhost:8080/anything \
     -H "host: www.example.com" \
     -H "Content-Type: application/json" \
     -H "Content-Encoding: gzip" \
     --data-binary @-
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:

   ```console {hl_lines=[3,5,6,7]}
   {
     ...
     "data": "{\"hello\":\"world\"}\n",
     ...
     "json": {
       "hello": "world"
     }
   }
   ```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} compression -n httpbin
```
