---
title: Security Policies
weight: 13
description: 
---

Agentgateway has a broad collection of security policies.

## Backend TLS

By default, requests to backends will use HTTP.
To use HTTPS, a backend TLS policy can be configured.

```yaml
backendTLS:
  # A file containing the root certificate to verify.
  # If unset, the system trust bundle will be used.
  root: ./certs/root-cert.pem
  # For mutual TLS, the client certificate to use
  cert: ./certs/cert.pem
  # For mutual TLS, the client certificate key to use.
  key: ./certs/key.pem
  # If set, hostname verification is disabled
  # insecureHost: true
  # If set, all TLS verification is disabled
  # insecure: true
```

## Backend Authentication

When connecting to a backend, an authentication token can be attached to each request using the backend authentication policy.


To attach a static key as an `Authorization` value, use `key`:

```yaml
backendAuth:
  key: $MY_API_KEY
```

A filepath can also be used:

```yaml
backendAuth:
  key:
    file: /path/to/my/key
```

When using [JWT authentication](#jwt-authentication), the original token is removed by default.
To add it back, the `passthrough` method can be used:

```yaml
backendAuth:
  passthrough: {}
```

Google [Application Default Credentials](https://cloud.google.com/docs/authentication/application-default-credentials) can also be used, which can be useful when connecting to GCP services:

```yaml
backendAuth:
  gcp: {}
```

AWS authentication can be used to sign requests to AWS services:

```yaml
backendAuth:
  aws:
    # Specify access key and session token
    # Alternatively, leaving this empty will use the standard AWS credential lookup (https://docs.aws.amazon.com/sdkref/latest/guide/access.html) based on the environment
    accessKeyId: "$AWS_ACCESS_KEY_ID"
    secretAccessKey: "$AWS_SECRET_ACCESS_KEY"
    sessionToken: "$AWS_SESSION_TOKEN"
    region: us-west-2
```

## HTTP Authorization

HTTP authorization allows defining rules to allow or deny requests based on their properties, using [CEL expressions](/docs/cel).

Policies can define `allow` and `deny` rules. When evaluating a request:
1. If there are no policies, the request is allowed.
2. If any `deny` policy matches, the request is denied.
3. If any `allow` policy matches, the request is allow.
4. Otherwise, the request is denied.

```yaml
authorization:
  rules:
  - allow: 'request.path == "/authz/public"'
  - deny: 'request.path == "/authz/deny"'
  # legacy format; same as `allow: ...`
  - 'request.headers["x-allow"] == "true"'
```

## JWT Authentication

[JWT tokens](https://www.jwt.io/introduction#what-is-json-web-token-structure) from incoming requests can be verified.
JWT authentication requires a few parameters:

* The **issuer** verifies that tokens come from the specified issuer (`iss`).
* The **audiences** lists allowed audience values (`aud`)
* The **jwks** defines the list of public keys to verify against.

Additionally, authentication can run in three different modes:
* **Strict**: A valid token, issued by a configured issuer, must be present.
* **Optional** (default): If a token exists, validate it.  
  *Warning*: This allows requests without a JWT token!
* **Permissive**: Requests are never rejected. This is useful for usage of claims in later steps (authorization, logging, etc).  
  *Warning*: This allows requests without a JWT token!

```yaml
jwtAuth:
  mode: strict
  issuer: agentgateway.dev
  audiences: [test.agentgateway.dev]
  jwks:
    # Relative to the folder the binary runs from, not the config file
    file: ./manifests/jwt/pub-key
```

It is common to pair `jwtAuth` with `authorization`, using the `claims` from the verified JWT.
For example:

```yaml
authorization:
  rules:
  - allow: 'request.path == "/admin" && jwt.groups.contains("admins")'
```

## External authorization

For cases where authorization decisions need to be made out-of-process, the external authorization policy can be used.
This sends a request to an external server, such as [Open Policy Agent](https://www.openpolicyagent.org/docs/envoy) which will decide whether the request is allowed or denied.
This is done utilizing the [External Authorization gRPC service](https://www.envoyproxy.io/docs/envoy/latest/api-v3/service/auth/v3/external_auth.proto).

Configuration just requires specifying the address of the authorization service:

```yaml
extAuthz:
  host: localhost:9000
```
