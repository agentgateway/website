```sh
helm upgrade -i {{< reuse "agw-docs/standalone/helm-standalone-release.md" >}} \
  {{< reuse "agw-docs/standalone/helm-standalone-chart-ref.md" >}} \
  --namespace {{< reuse "agw-docs/snippets/namespace.md" >}} \
  --version {{< reuse "agw-docs/versions/helm-version-flag.md" >}} \
  -f values.yaml
```