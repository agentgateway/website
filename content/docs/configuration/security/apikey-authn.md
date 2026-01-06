---
title: API Key authentication
weight: 17
---

API Key authentication enables authenticating requests based on a user-provided API key.

**[Supported attachment points](/docs/configuration/policies/):** Listener and Route.

> [!TIP]
> This policy is about authenticating incoming requests. For attaching API Keys to outgoing requests, see [Backend Authentication](../backend-authn).

API Key authentication involves configuring a list of valid API keys, with associated metadata about the key (optional).

Additionally, authentication can run in three different modes:
* **Strict**: A valid key must be present.
* **Optional** (default): If a key exists, validate it.  
  *Warning*: This allows requests without an API Key!
* **Permissive**: Requests are never rejected. This is useful for usage of claims in later steps (authorization, logging, etc).  
  *Warning*: This allows requests without an API Key!

```yaml
apiKey:
  mode: strict
  keys:
    - key: sk-testkey-1
      metadata:
        user: test
        role: admin
```

Later policies can now operate on the metadata associated with the key.
For example:

```yaml
transformations:
  request:
    set:
      x-authenticated-user: apiKey.user
```
