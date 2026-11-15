Response compression reduces bandwidth for JSON, HTML, CSS, JavaScript, XML, plain text, and SVG responses. Clients must advertise a configured algorithm in the `Accept-Encoding` header to receive compressed responses.

The following limits apply:

* Responses must have a known length of at least 32 bytes. Streams without a known length, such as server-sent events, are not compressed.
* Responses that are already encoded, have a `Content-Range` header, or set `Cache-Control: no-transform` are not compressed. Responses with a `1xx`, `204`, or `304` status code are also excluded.
* Request decompression requires a single configured encoding in `Content-Encoding`. Unsupported or layered encodings, such as `Content-Encoding: gzip, br`, are forwarded unchanged.

### Algorithm selection

The algorithm with the highest quality value (`q`) in `Accept-Encoding` wins. Ties follow the configured algorithm order. A `*` entry applies to algorithms that the client does not list by name. If `identity` has a higher quality value than every configured algorithm, the response stays uncompressed.

### Headers and content types

Compressed responses set `Content-Encoding`, remove `Content-Length` and `Accept-Ranges`, and change strong `ETag` values to weak values, such as `W/"abc"`. Eligible responses include `Vary: accept-encoding` even when sent uncompressed, so caches can distinguish responses by the client's accepted encodings.

Eligible media types are `application/javascript`, `application/json`, `application/xml`, `application/xhtml+xml`, `image/svg+xml`, `text/css`, `text/html`, `text/javascript`, `text/plain`, and `text/xml`. Types with a `+json` or `+xml` suffix also qualify. Responses with other media types or without a `Content-Type` header are not compressed.

Decompressed requests have their `Content-Encoding` and `Content-Length` headers removed.

### Policy order

Response compression runs after other response policies and the access log snapshot. Transformations and response body logs see the uncompressed body. The client's `Accept-Encoding` is read before request header modifiers run, so removing that header before forwarding does not disable compression.

Request decompression runs after route-level authentication and authorization. These policies see encoded bodies, and denied requests are never decoded. Route-level rate limiting, external processing, and transformations see decoded bodies. Backend authorization also sees decoded bodies.

{{< conditional-text include-if="kubernetes" >}}Policies in the `PreRouting` phase also see encoded request bodies.{{< /conditional-text >}}{{< conditional-text include-if="standalone" >}}Gateway-phase policies (`phase: gateway`) also see encoded request bodies.{{< /conditional-text >}}
