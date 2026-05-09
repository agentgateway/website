# agctl-debug YAML drafts

Working YAMLs used to validate the agctl trace and config-inspect task guides
before promoting code blocks into the docs.

## Standalone

`standalone/config.yaml` — agentgateway on :3000 forwarding to httpbin on :8000.

Run:
```sh
docker run --rm -d -p 8000:80 --name httpbin kennethreitz/httpbin
agentgateway -f standalone/config.yaml
```

## Kubernetes

`kubernetes/httproute.yaml` — HTTPRoute that the existing quickstart's
httpbin sample app uses. Reuses the upstream sample-app and Gateway from
`content/docs/kubernetes/main/install/sample-app.md`.

Apply order:
1. Install agentgateway via Helm (per quickstart/install)
2. Create the Gateway (per quickstart)
3. `kubectl apply -f https://raw.githubusercontent.com/kgateway-dev/kgateway/refs/heads/main/examples/httpbin.yaml`
4. `kubectl apply -f kubernetes/httproute.yaml`
