---
title: Transformations
weight: 12
description: Modify header and body information for requests and responses. 
---

Attaches to: {{< badge content="Listener" path="/configuration/listeners/">}} {{< badge content="Route" path="/configuration/routes/">}}

Agentgateway uses {{< gloss "Transformation" >}}transformation{{< /gloss >}} templates that are written in {{< gloss "CEL (Common Expression Language)" >}}Common Expression Language (CEL){{< /gloss >}}. CEL is a fast, portable, and safely executable language that goes beyond declarative configurations. CEL lets you develop more complex expressions in a readable, developer-friendly syntax.

To learn more about how to use CEL, refer to the following resources:

- [cel.dev tutorial](https://cel.dev/tutorials/cel-get-started-tutorial)
- [Agentgateway reference docs](https://agentgateway.dev/docs/standalone/latest/reference/cel/)

{{< callout type="info" >}}
Try out CEL expressions in the built-in [CEL playground]({{< link-hextra path="/reference/cel/playground/" >}}) in the agentgateway admin UI before using them in your configuration.
{{< /callout >}}

### Header transformation

You can add, set, or remove request and response headers with agentgateway's transformation policies. 

{{< callout type="info" >}}
To provide a specific string value, add your string in single quotes `'` followed by double quotes `"`. This way, the string is interpreted as a string value. If you provide the value without quotes or with double quotes only, it is interpreted as a CEL expression. 
{{< /callout >}}

#### Route-level header transformation

Transform headers after route selection:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - ai:
         name: openai
         provider:
           openAI:
             # Optional; overrides the model in requests
             model: gpt-3.5-turbo
      policies:
        backendAuth:
          key: "$OPEN_AI_APIKEY"
        cors:
          allowOrigins:
            - "*"
          allowHeaders:
            - "*"
        transformations:
          request:
            add:
              x-request-path: request.path
              x-client-ip: source.address
          response:
            add:
              x-response-code: 'string(response.code)'
            remove:
            - server
            - x-content-type-options
```

#### Listener-level header transformation

Transform headers before route selection by attaching the policy at the listener level:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - policies:
      transformations:
        request:
          add:
            x-gateway: '"agentgateway"'
      backendAuth:
        key: "$OPEN_AI_APIKEY"
    routes:
    - backends:
      - ai:
         name: openai
         provider:
           openAI:
             model: gpt-3.5-turbo
```

### Body transformation

You can provide a custom body for a request or response. 

{{< callout type="info" >}}
To provide a specific string value, add your string in single quotes `'` followed by double quotes `"`. This way, the string is interpreted as a string value. If you provide the value without quotes or with double quotes only, it is interpreted as a CEL expression. 
{{< /callout >}}

```yaml
transformations:
  request:
    body: |
      "Hello " + default(request.headers["x-user-name"], "guest")
  response:
    body: |
      "Response code: " + string(response.code)
```
