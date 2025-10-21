---
title: Transformations
weight: 10
description: Modify header and body information for requests and responses. 
---

Agentgateway uses transformation templates that are written in Common Expression Language (CEL). CEL is a fast, portable, and safely executable language that goes beyond declarative configurations. CEL lets you develop more complex expressions in a readable, developer-friendly syntax.

To learn more about how to use CEL, refer to the following resources:

- [cel.dev tutorial](https://cel.dev/tutorials/cel-get-started-tutorial)
- [Agentgateway reference docs](https://agentgateway.dev/docs/reference/cel/)

{{< callout >}}
Transformation templates can be applied at the route or the gateway level. If applied to both, the route-level transformation takes precedence. 
{{< /callout >}}

### Header transformation

You can add, set, or remove request and response headers with agentgateway's transformation policies. 

{{< tabs items="Route-level,Gateway-level" >}}
{{% tab %}}
```yaml
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
              x-gateway: '"agentgateway"'
          response:
            add:
              x-served-by: '"agentgateway"'
            remove:
            - server
            - x-content-type-options
```
{{% /tab %}}
{{% tab %}}
```yaml
binds:
- port: 3000
  listeners:
  - gatewayName: my-gateway
    routes:
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
gatewayPolicies:
  - name: global-transformations
    target:
      gateway: my-gateway
    policy:
      transformations:
        request:
          add:
            x-gateway: '"agentgateway"'
        response:
          add:
            x-served-by: '"agentgateway"'
```

{{% /tab %}}
{{< /tabs >}}

{{< callout >}}
To provide a specific string value, add your string in single quotes `'` followed by double quotes `"`. This way, the string is interpreted as a string value. If you provide the value without quotes or with double quotes only, it is interpreted as a CEL expression. 
{{< /callout >}}

### Body transformation

You can provide a custom body for a request or response. 

```yaml
transformations:
  request:
    body:
      '"This is a custom request body."'
  response:
    body:
      '"This is a custom response body."'
```

{{< callout >}}
To provide a specific string value, add your string in single quotes `'` followed by double quotes `"`. This way, the string is interpreted as a string value. If you provide the value without quotes or with double quotes only, it is interpreted as a CEL expression. 
{{< /callout >}}