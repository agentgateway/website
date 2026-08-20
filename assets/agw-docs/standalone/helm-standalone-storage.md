By default, the agentgateway Deployment

add what the default storage scenario is, including readonly mode

## Store configuration in a database

To keep configuration changes that you make in the UI, run PostgreSQL and set the agentgateway configuration `mode` to `database` in your Helm values file. Agentgateway creates the schema that it needs on first startup, so no migration step is required.

```yaml
mode: database
database:
  postgres:
    url: postgres://agw:secret@postgres.{{< reuse "agw-docs/snippets/namespace.md" >}}.svc.cluster.local:5432/agw
config:
  binds:
  - port: 4000
    listeners:
    - routes:
      - backends:
        - host: httpbin.httpbin.svc.cluster.local:8000
```

The chart rejects a `database.postgres.url` value that does not begin with `postgres://` or `postgresql://`, and rejects the value entirely when `mode` is `readonly`.

Both modes support more than one replica. To scale the deployment, set `replicaCount`.