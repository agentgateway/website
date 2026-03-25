## Policy processing order {#processing-order}

Agentgateway processes each request through four phases in the following order. You cannot change the phase order, but you can control which filters run in each phase by configuring the appropriate policy sections.

```mermaid
graph LR
    frontend

    subgraph frontend ["Phase 1: Frontend"]
        fe_fields["tcp · tls · http<br/>accessLog · tracing"]
    end

    frontend --> prerouting

    subgraph prerouting ["Phase 2: PreRouting traffic"]
        pr["Auth (JWT, basic, API key)<br/>ExtAuth<br/>ExtProc<br/>Transformation"]
    end

    prerouting -->|route selection| postrouting

    subgraph postrouting ["Phase 3: PostRouting traffic"]
        po["CORS<br/>Auth (JWT, basic, API key)<br/>ExtAuth<br/>Rate limiting<br/>ExtProc<br/>Transformation<br/>CSRF<br/>Headers<br/>Host rewrite<br/>Direct response"]
    end

    postrouting --> backend

    subgraph backend ["Phase 4: Backend"]
        be_fields["tls · tcp · http · tunnel<br/>auth · transformation<br/>health · ai · mcp"]
    end
```

1. **Frontend policies:** Control how the gateway accepts incoming connections, including TLS settings, TCP configuration, and access logging. Frontend policies apply at the gateway level before any routing decisions.
2. **PreRouting traffic policies:** Run before route selection. Only a subset of traffic filters is available in the PreRouting phase. See [PreRouting filters](#prerouting-filters).
3. **PostRouting traffic policies:** Run after route selection. PostRouting is the default phase for traffic policies and supports all traffic filters.
4. **Backend policies:** Run when the gateway connects to the destination backend, including backend TLS, authentication, and health checking.

Within each phase, agentgateway merges all applicable policies with a shallow field-level merge. If two policies configure different fields, both apply. For example, if one policy sets `transformation` and another sets `extAuth`, both filters run. If two policies configure the same field, the higher-precedence policy takes effect. For details, see [merge precedence](#merging).

### Traffic filter execution order

Within the traffic phase (both PreRouting and PostRouting), filters execute in a fixed order. You cannot change this order.

| Order | Filter | Field |
| -- | -- | -- |
| 1 | Cross-Origin Resource Sharing (CORS) | `cors` |
| 2 | JSON Web Token (JWT) authentication | `jwtAuthentication` |
| 3 | Basic authentication | `basicAuthentication` |
| 4 | API key authentication | `apiKeyAuthentication` |
| 5 | External authorization | `extAuth` |
| 6 | Authorization | `authorization` |
| 7 | Rate limiting (local) | `rateLimit` |
| 8 | Rate limiting (remote) | `rateLimit` |
| 9 | External processing | `extProc` |
| 10 | Transformation | `transformation` |
| 11 | Cross-Site Request Forgery (CSRF) | `csrf` |
| 12 | Header modifiers | `headerModifiers` |
| 13 | Host rewrite | `hostRewrite` |
| 14 | Direct response | `directResponse` |

### PreRouting filters

The PreRouting phase supports only the following filters, in order of execution:

1. `jwtAuthentication`
1. `basicAuthentication`
1. `apiKeyAuthentication`
1. `extAuth`
1. `extProc`
1. `transformation`

To run a filter in the PreRouting phase, set `phase: PreRouting` on the traffic policy. PreRouting policies can only target a Gateway or ListenerSet.

### Adjusting execution order with phases

You can use the PreRouting phase to run certain filters earlier in the request lifecycle. For example, to run external processing before rate limiting, configure an `extProc` policy with the PreRouting phase, and a separate `rateLimit` policy with the default PostRouting phase. External processing then runs during PreRouting (before route selection), and rate limiting runs during PostRouting (after route selection).
