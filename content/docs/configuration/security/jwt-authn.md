---
title: JWT authentication
weight: 15
---

Attach to:
{{< badge content="Listener" link="/docs/configuration/listeners/">}} {{< badge content="Route" link="/docs/configuration/routes/">}}

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