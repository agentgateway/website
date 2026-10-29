## About

Some upstreams do not accept a durable credential at all. The Snowflake SQL API, for example, requires a JWT that is signed with the caller's private key on each call. With `jwtSign`, agentgateway mints the token itself: it loads a PEM-encoded RSA or EC private key, signs a JWT that carries the claims you configure, and writes that token to each request that it forwards to the backend. Nothing is cached, so agentgateway signs every request afresh.

```yaml
backendAuth:
  jwtSign:
    signingKey:
      file: /path/to/signing-key.pem
    alg: ES256
    kid: my-signing-key
    claims:
      iss: MYACCOUNT.MYUSER.SHA256:my-public-key-fingerprint
      sub: MYACCOUNT.MYUSER
      aud: https://myaccount.snowflakecomputing.com
    ttl: 60s
```

{{< reuse "agw-docs/snippets/review-table.md" >}}

| Field | Description |
| -- | -- |
| `signingKey` | Required PEM-encoded RSA or EC private key. Use `file` to read the key from a path, or set the field to the PEM text itself. |
| `alg` | JWS signing algorithm: `RS256` (default), `RS384`, `RS512`, `PS256`, `ES256`, or `ES384`. The algorithm must match the key family. The `RS` and `PS` algorithms need an RSA key, and the `ES` algorithms need an EC key. |
| `kid` | Optional `kid` header that agentgateway stamps on every token. Omit the field and no `kid` header is written. |
| `claims` | Optional static claims that agentgateway copies into every token, such as `iss`, `sub`, and `aud`. A value can be any JSON value, including a number or an array. |
| `ttl` | Optional token lifetime used for `exp`. Defaults to `300s`. |
| `location` | Optional location that the signed token is written to. Defaults to the `Authorization` header with a `Bearer` prefix, and takes the same shape as the `location` field shown earlier on this page. |

Only `signingKey` is required. A policy that sets nothing else signs with `RS256` and a 300-second lifetime, and writes the token to the `Authorization` header.

The signer owns the time claims. Agentgateway always sets `iat` and `exp`, and backdates `iat` by 10 seconds so that a validator whose clock trails the proxy still accepts a freshly minted token. A decoded token therefore spans the `ttl` plus 10 seconds, and never carries an `nbf` claim. Setting `iat`, `exp`, or `nbf` under `claims` is rejected when the configuration loads.

```
Error: jwtSign claim "iat" is reserved for the signer and cannot be configured
```

An `alg` that disagrees with the key family is rejected the same way, so a mismatch surfaces before the proxy serves traffic.

```
Error: failed to parse jwtSign signingKey: failed to load RSA signing key
```
