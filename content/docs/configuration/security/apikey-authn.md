---
title: API Key authentication
weight: 17
---

Attach to:
{{< badge content="Listener" link="/docs/configuration/listeners/">}} {{< badge content="Route" link="/docs/configuration/routes/">}}

API Key authentication enables authenticating requests based on a user-provided API key.

> [!TIP]
> This policy is about authenticating incoming requests. For attaching API keys to outgoing requests, see [Backend Authentication](../backend-authn).

API Key authentication involves configuring a list of valid API keys, with associated metadata about the key (optional).

Additionally, authentication can run in three different modes:
* **Strict**: A valid API key must be present.
* **Optional** (default): If an API key exists, validate it.  
  *Warning*: This allows requests without an API key!
* **Permissive**: Requests are never rejected. This setting is useful for usage of claims in later steps such as authorization or logging.  
  *Warning*: This allows requests without an API key!

```yaml
apiKey:
  mode: strict
  keys:
    - key: sk-testkey-1
      metadata:
        user: test
        role: admin
```

Later policies can now operate on the metadata associated with the API key.

For example, you can set a custom `x-authenticated-user` header with the authenticated user from the API key metadata.

```yaml
transformations:
  request:
    set:
      x-authenticated-user: apiKey.user
```
