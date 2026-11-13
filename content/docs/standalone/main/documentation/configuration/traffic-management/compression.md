---
title: Compression
weight: 18
description: Compress responses to clients and decompress encoded request bodies.
---

Attaches to: {{< badge content="Route" path="/documentation/configuration/routes/" >}}

Use the `policies.compression` policy for response compression and request decompression. You can configure either feature or both on the same route.

## About compression

{{< reuse "agw-docs/snippets/compression-about.md" >}}

## Compression settings

The `compression` policy takes a `response` block, a `request` block, or both.

Choose from `gzip`, `brotli`, `deflate`, and `zstd`. If you omit `algorithms`, the default is `gzip`. The HTTP encoding token for Brotli is `br`.

The following example compresses responses with `gzip` or `brotli` and decodes `gzip` request bodies.

```yaml
policies:
  compression:
    response:
      compress:
        algorithms: [gzip, brotli]
    request:
      decompress: {}
```

| Field | Description | Default |
| -- | -- | -- |
| `policies.compression.response.compress.algorithms` | Algorithms for response compression, in preference order. Omit the field to use the default. An empty list fails validation. | `[gzip]` |
| `policies.compression.request.decompress.algorithms` | Algorithms to decode from request bodies. Omit the field to use the default. An empty list fails validation. | `[gzip]` |

For the full list of fields, see the [configuration reference]({{< link-hextra path="/reference/configuration/" >}}).

## Before you begin

1. Install a [nightly agentgateway binary]({{< link-hextra path="/documentation/setup/install/binary/#binary" >}}). On the installation page, select **Nightly build**. Compression is not available in v1.7.0.
2. {{< reuse "agw-docs/snippets/prereq-docker.md" >}}

## Compress responses and decompress requests

The following steps start a sample httpbin app as the backend, configure a route with a compression policy, and test response compression and request decompression.

1. Start the httpbin sample app in Docker. The app listens on port 8000 on your machine.

   ```sh
   docker run -d --name httpbin -p 8000:8080 mccutchen/go-httpbin:v2.15.0
   ```

2. Create a configuration file with a compression policy. The policy compresses responses with `gzip`, `brotli`, or `zstd`, and decodes request bodies that are encoded with `gzip`.

   ```yaml
   cat > config.yaml <<EOF
   # yaml-language-server: \$schema=https://agentgateway.dev/schema/config
   gateways:
     default:
       port: 3000
   routes:
   - backends:
     - host: localhost:8000
     policies:
       compression:
         response:
           compress:
             algorithms: [gzip, brotli, zstd]
         request:
           decompress:
             algorithms: [gzip]
   EOF
   ```

3. Run agentgateway with the configuration file.

   ```sh
   agentgateway -f config.yaml
   ```

4. In another terminal, request a JSON response and advertise support for `br` and `gzip` in the `Accept-Encoding` header. The client accepts both algorithms equally, so the first matching algorithm in the policy wins. The policy lists `gzip` before `brotli`, so the proxy compresses the response with `gzip`.

   ```sh
   curl -s -o /dev/null -D - http://localhost:3000/json \
     -H "Accept-Encoding: br, gzip"
   ```

   Example output:

   ```console {hl_lines=[5,6]}
   HTTP/1.1 200 OK
   Access-Control-Allow-Credentials: true
   Access-Control-Allow-Origin: *
   Content-Type: application/json; charset=utf-8
   content-encoding: gzip
   vary: accept-encoding
   transfer-encoding: chunked
   ```

5. Send the request again and accept only `br`, which is the HTTP token for Brotli. The proxy compresses the response with Brotli.

   ```sh
   curl -s -o /dev/null -D - http://localhost:3000/json \
     -H "Accept-Encoding: br"
   ```

   Example output:

   ```console {hl_lines=[5]}
   HTTP/1.1 200 OK
   Access-Control-Allow-Credentials: true
   Access-Control-Allow-Origin: *
   Content-Type: application/json; charset=utf-8
   content-encoding: br
   vary: accept-encoding
   transfer-encoding: chunked
   ```

6. Send the request without an `Accept-Encoding` header. The proxy does not compress the response, so the response has a `Content-Length` header and no `content-encoding` header. The response still includes the `vary: accept-encoding` header.

   ```sh
   curl -s -o /dev/null -D - http://localhost:3000/json
   ```

   Example output:

   ```console {hl_lines=[5,6]}
   HTTP/1.1 200 OK
   Access-Control-Allow-Credentials: true
   Access-Control-Allow-Origin: *
   Content-Type: application/json; charset=utf-8
   Content-Length: 421
   vary: accept-encoding
   ```

7. Send a request body that is compressed with `gzip` to the httpbin `/anything` endpoint, which echoes the request back. The proxy decodes the body, so httpbin receives the decoded JSON body. The `data` and `json` fields in the output show the decoded body.

   ```sh
   echo '{"hello":"world"}' | gzip | curl -s http://localhost:3000/anything \
     -H "Content-Type: application/json" \
     -H "Content-Encoding: gzip" \
     --data-binary @-
   ```

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

Stop agentgateway and remove the resources that you created.

1. Stop agentgateway by pressing `Ctrl+C` in the terminal where agentgateway runs.

2. Remove the httpbin container and the configuration file.

   ```sh
   docker rm -f httpbin
   rm config.yaml
   ```
