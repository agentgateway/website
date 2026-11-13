Response compression reduces bandwidth for JSON, HTML, CSS, JavaScript, XML, plain text, and SVG responses. Clients must advertise a configured algorithm in the `Accept-Encoding` header to receive compressed responses.

The following limits apply:

* Responses must have a known length of at least 32 bytes. Streams without a known length, such as server-sent events, are not compressed.
* Responses that are already encoded, have a `Content-Range` header, or set `Cache-Control: no-transform` are not compressed. Responses with a `1xx`, `204`, or `304` status code are also excluded.
* Request decompression requires a single configured encoding in `Content-Encoding`. Unsupported or layered encodings, such as `Content-Encoding: gzip, br`, are forwarded unchanged.
