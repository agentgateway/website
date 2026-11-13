---
title: Compression
weight: 12
description: Compress responses to clients and decompress encoded request bodies.
---

Use the `traffic.compression` settings in an {{< reuse "agw-docs/snippets/policy.md" >}} to compress responses to clients and to decode encoded request bodies. Response compression reduces bandwidth for large JSON, HTML, or text responses. Request decompression lets later policies and the backend read bodies that clients send encoded. You can configure one direction or both in the same policy.

## About compression

The compression policy works in two directions.

* **Response compression** (`traffic.compression.response.compress`): The gateway proxy compresses an eligible response with an algorithm that the client lists in the `Accept-Encoding` request header. If the client does not send `Accept-Encoding`, or accepts none of the configured algorithms, the gateway proxy sends the response uncompressed.
* **Request decompression** (`traffic.compression.request.decompress`): The gateway proxy decodes a request body that the client sent with a `Content-Encoding` header, such as `Content-Encoding: gzip`. Later policies and the backend receive the decoded body.

You can choose from the following algorithms: `Gzip`, `Brotli`, `Deflate`, and `Zstd`. If you omit `algorithms`, the policy uses `Gzip`. Each algorithm uses the `Accept-Encoding` and `Content-Encoding` token of the same name, except Brotli, which uses `br`.

### Response compression

The gateway proxy compresses a response only when all the following conditions are true:

* The response has a body. The gateway proxy does not compress responses with a `1xx`, `204`, or `304` status code.
* The response does not already have a `Content-Encoding` header.
* The response is not a partial response with a `Content-Range` header.
* The response does not have a `Cache-Control: no-transform` header.
* The response has a known length of at least 32 bytes. The gateway proxy sends streamed responses without a known length, such as server-sent events, as-is.
* The response has one of the following media types: `application/javascript`, `application/json`, `application/xml`, `application/xhtml+xml`, `image/svg+xml`, `text/css`, `text/html`, `text/javascript`, `text/plain`, or `text/xml`. Media types with a `+json` or `+xml` suffix, such as `application/problem+json`, also qualify. The gateway proxy sends responses with any other media type, or with no `Content-Type` header, as-is.

To choose the algorithm, the gateway proxy compares the configured `algorithms` list with the client's `Accept-Encoding` header. The algorithm with the highest quality value (`q`) wins. If the client accepts more than one algorithm equally, the first algorithm in your `algorithms` list wins. A `*` entry in `Accept-Encoding` applies to every configured algorithm that the client does not list by name. If the client gives `identity` a higher quality value than every configured algorithm, the gateway proxy sends the response uncompressed.

The gateway proxy makes the following header changes to every response that the gateway proxy compresses:

* Sets `Content-Encoding` to the chosen algorithm, such as `gzip` or `br`.
* Removes the `Content-Length` and `Accept-Ranges` headers.
* Changes a strong `ETag` to a weak `ETag`, such as `W/"abc"`, because the bytes that the gateway proxy sends no longer match the original body.

For every eligible response, the gateway proxy also adds a `Vary: accept-encoding` header, even when the client receives the uncompressed response. The `Vary` header tells caches that the response depends on the `Accept-Encoding` request header.

Response compression runs after every other response policy, so policies such as transformations see the uncompressed body. If access logs record the response body, the access logs record the uncompressed body. The gateway proxy reads the client's `Accept-Encoding` header before request header modifiers run. If you remove the `Accept-Encoding` header from requests to the backend, the client still gets a compressed response.

### Request decompression

The gateway proxy decodes a request body only when the `Content-Encoding` header names a single algorithm that is in your `algorithms` list. The gateway proxy forwards request bodies with any other encoding, or with more than one layer of encoding, such as `Content-Encoding: gzip, br`, unchanged. After decoding the body, the gateway proxy removes the `Content-Encoding` and `Content-Length` headers from the request.

Decompression runs after route-level authentication and authorization, so a denied request is never decoded. Route-level authentication and authorization, and policies in the `PreRouting` phase, see the encoded body. Backend authorization runs later and sees the decoded body. Route-level policies that read the body, such as rate limiting, external processing, and transformations, see the decoded body.

## Compression settings

The `traffic.compression` field takes a `response` block, a `request` block, or both. The following example compresses responses with `Gzip` or `Brotli` and decodes request bodies with the default algorithm.

```yaml
traffic:
  compression:
    response:
      compress:
        algorithms:
        - Gzip
        - Brotli
    request:
      decompress: {}
```

| Field | Description | Default |
| -- | -- | -- |
| `traffic.compression` | Must set `response`, `request`, or both. You cannot set `traffic.compression` in a policy that sets `traffic.phase: PreRouting`. | None |
| `traffic.compression.response.compress` | Required when you set `response`. To use the default algorithm, set an empty block: `compress: {}`. | None |
| `traffic.compression.response.compress.algorithms` | The algorithms that the gateway proxy can choose from, based on the client's `Accept-Encoding` header. Possible values are `Gzip`, `Brotli`, `Deflate`, and `Zstd`. If the client accepts more than one algorithm equally, the first algorithm in the list wins. The list takes 1 to 4 values, and each value can appear only once. Values are case-sensitive, such as `Gzip`, not `gzip`. | `[Gzip]` |
| `traffic.compression.request.decompress` | Required when you set `request`. To use the default algorithm, set an empty block: `decompress: {}`. | None |
| `traffic.compression.request.decompress.algorithms` | The algorithms that the gateway proxy decodes from request bodies. Possible values are `Gzip`, `Brotli`, `Deflate`, and `Zstd`. The gateway proxy forwards request bodies with any other encoding unchanged. The list takes 1 to 4 values, and each value can appear only once. Values are case-sensitive. | `[Gzip]` |

For the full list of fields, see the [API reference]({{< link-hextra path="/reference/api/" >}}).

{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Compress responses and decompress requests

Use an {{< reuse "agw-docs/snippets/policy.md" >}} to configure compression for a Gateway, HTTPRoute, or route rule.

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

3. Send the request without an `Accept-Encoding` header. The gateway proxy does not compress the response, so the response has a `Content-Length` header and no `content-encoding` header. The response still includes the `vary: accept-encoding` header.

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

4. Send a request body that is compressed with `gzip` to the httpbin `/anything` endpoint, which echoes the request back. The gateway proxy decodes the body, so httpbin receives the decoded JSON body. The `data` and `json` fields in the output show the decoded body.

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
