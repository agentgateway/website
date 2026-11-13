---
title: Compression
weight: 12
description: Compress responses to clients and decompress encoded request bodies.
---

Use `traffic.compression` in an {{< reuse "agw-docs/snippets/policy.md" >}} for response compression and request decompression. You can configure either feature or both in the same policy.

## About compression

{{< reuse "agw-docs/snippets/compression-about.md" >}}

## Compression settings

The `traffic.compression` field takes a `response` block, a `request` block, or both.

Choose from `Gzip`, `Brotli`, `Deflate`, and `Zstd`. If you omit `algorithms`, the default is `Gzip`. Their HTTP encoding tokens are `gzip`, `br`, `deflate`, and `zstd`, respectively.

The following example compresses responses with `Gzip` or `Brotli` and decodes `gzip` request bodies.

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
| `traffic.compression.response.compress.algorithms` | Algorithms for response compression, in preference order. Set 1 to 4 unique, case-sensitive values. | `[Gzip]` |
| `traffic.compression.request.decompress` | Required when you set `request`. To use the default algorithm, set an empty block: `decompress: {}`. | None |
| `traffic.compression.request.decompress.algorithms` | Algorithms to decode from request bodies. Set 1 to 4 unique, case-sensitive values. | `[Gzip]` |

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
