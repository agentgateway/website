---
title: Request matching
weight: 10
---

Based on the [route schema](https://github.com/agentgateway/agentgateway/blob/main/schema/local.json), you can configure the following matching conditions for routes.

## Path Matching

If no path match is specified, the default is to match all paths (`/`).

You can match incoming requests based on their path using one of the following strategies:

| Type        | Example                              | Description                                 |
|-------------|--------------------------------------|---------------------------------------------|
| Exact       | `{ "exact": "/foo/bar" }`            | Matches only the exact path `/foo/bar`      |
| Prefix      | `{ "pathPrefix": "/foo" }`           | Matches any path starting with `/foo`       |
| Regex       | `{ "regex": ["^/foo/[0-9]+$", 0] }`  | Matches paths using a regular expression    |

{{< callout type="info">}}
Only one of `exact`, `pathPrefix`, or `regex` can be specified per path matcher.
{{< /callout >}}

## Header Matching

You can match on HTTP headers:

- **Exact match:**  
  `{ "name": "Authorization", "value": { "exact": "Bearer token" } }`
- **Regex match:**  
  `{ "name": "Authorization", "value": { "regex": "^Bearer .*" } }`

## Method Matching

Optionally restrict matches to specific HTTP methods:
```json
{ "method": { "method": "GET" } }
```

## Query Parameter Matching

Match on query parameters, either by exact value or regex:
- **Exact:**  
  `{ "name": "version", "value": { "exact": "v1" } }`
- **Regex:**  
  `{ "name": "version", "value": { "regex": "^v[0-9]+$" } }`
