---
title: Provider Rate Limiting is Not Enough for Enterprise LLM Usage
toc: false
publishDate: 2025-11-02T00:00:00-00:00
author: Christian Posta, Michael Levan
---

Hosted LLM providers like OpenAI and Anthropic have rate limiting capabilities centered around requests per minute (RPM) and tokens per minute (TPM). These are specified at the "organization" level and "project" level. API keys are associated with an organization or project, and each call is subject to token or rate limit restrictions. The actual limits are set by the provider, not you. They will depend on what tier you pay for, but generally not configurable. For example:

| Provider  | Model             | Typical TPM Limit (per project, tier 1 example) | Notes                          |
| --------- | ----------------- | ----------------------------------------------- | ------------------------------ |
| OpenAI    | GPT-3.5 Turbo     | 1,000,000 TPM                                   | Popular mid-tier model         |
| OpenAI    | GPT-4.1           | 1,000,000 TPM                                   | Advanced, large context window |
| OpenAI    | GPT-5 Tier 1      | 500,000 TPM                                     | Raised from 30K TPM recently   |
| Anthropic | Claude 3.5 Sonnet | 1,000,000 TPM                                   | Enterprise tier example        |
| Anthropic | Claude 3.0        | 400,000 TPM                                     | Lower tier example             |


In essence the providers give you coarse grained, non-configurable controls for rate limiting. Enterprises need far more control here. Providers expect users to figure this out themselves. That's where something like an LLM gateway (ie, [agentgateway](https://agentgateway.dev)) comes into the picture. 

## What do Enterprises Need?

The hosted LLM providers are trying to protect their service, and rightfully so. They give you fixed buckets for service, and coarse grained limiting that cannot be configured. Enterprises need more fine-grained control over rate limiting, however. They also need things like fine-grained attribution metrics, spike arrest, model (and potentially provider) failover, and dashboards/alerting. Most of this should NOT be implemented on the hosted LLM providers (for privacy, PII, and compliance reasons), so enterprises are leveraging AI / LLM gateways to do this. Let's see how [agentgateway](https://agentgateway.dev) can be used here. 

## Fine Grained Rate Limiting / Quota Control

Agentgateway can perform rate limiting based on "requests" or "tokens" just like you see from the providers. The time window is configurable, unlike with the providers. You can specify your rate limiting window in terms of seconds, minutes, hours, etc. 

The key to getting "fine-grained" rate limit is in how agentgateway applies these limits. It can do so on a _local_ or _global_ basis. For example, if we configure rate limits locally with the following:

```yaml
policies:
  localRateLimit:
    - maxTokens: 1000
    tokensPerFill: 1000
    fillInterval: 1s
    type: tokens
```

... then each instance of agentgateway will allow 1000 tokens per second. But since we can configure the `tokensPerFill` we can get sophisticated enough to implement a spike arrest / moving window for our rate limit. For example:


```yaml
policies:
  localRateLimit:
    - maxTokens: 1000
    tokensPerFill: 100
    fillInterval: 6s
    type: tokens
```

With this configuration, we _could_ receive a spike of 1000 tokens at any point during our time window but we would refill the rate limit bucket with 100 tokens every 6s. If we had a consistent usage of around 16 tokens per second (100/6) we would never trigger the rate limit. If we get bursts, ie, we could handle them up to a point (ie, 1000 tokens). 

We can also configure a _global_ rate limit policy that would affect all instances of agentgateway. We would need to introduce a [rate limit service](https://github.com/envoyproxy/ratelimit) that uses something like Redis to store its counters. We would then configure the global rate limiter like this on agentgateway:


```yaml
policies:
  remoteRateLimit:
    domain: "agentgateway"
    host: "${RATELIMIT_HOST:-localhost}:8081"
    descriptors:
    - entries:
        - key: "route"
          value: '"anthropic"'
        type: "tokens"      
```

Global rate limiting works by sending "descriptors" to a rate limiting service. You can think of these descriptors as tags, or metadata about the request that will be used to match on in the rate limit service. For example, in the above, we send a single descriptor called "route" with a value of "anthropic". We also specify to the rate limit service that this is of type "tokens". 

In the rate limit server, we can configure something like this:

```yaml
  - key: route
    value: "anthropic"
    rate_limit:
      unit: minute
      requests_per_unit: 5000
```

What this config does is match on the set of descriptors (in this case, "route" and the value of "antrhopic), specify the time window (minute) and the # of requests/tokens per time window. In this case, we'd get 5k tokens per minute for the `anthropic` route. But like I said, the time window is completely configurable. 

This descriptor / matcher is very powerful. We can have hierarchy, match on specific users, IP addresses, organization roles, entitlements, environments, clouds, etc etc. Here's a more sophisticated configuration:

```yaml
policies:
  remoteRateLimit:
    domain: "agentgateway"
    host: "${RATELIMIT_HOST:-localhost}:8081"
    descriptors:
      - entries:
          - key: "route"
            value: '"anthropic"'
        type: "tokens"
      - entries:
          - key: "user_id"
            value: 'jwt.sub'
        type: "tokens"
      - entries:
          - key: "remote_address"
            value: 'string(source.address)'
        type: "tokens"
```

This will enforce rate limit per route/user/source_ip tuple. This gives extremely fine-grained control over how to administer rate limiting. 


## Enriching Call Metrics with Internal Details

## Failover

## Dashboards / Alerting

## Wrapping Up