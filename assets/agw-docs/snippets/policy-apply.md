The guides in this section show example configuration for different types of policies. Policies are applied to routes, which are part of a listener on a bind.

```yaml
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
```