Recreate the container from the previous tag. Because the configuration lives on the volume, no restore step is needed.

```sh
docker rm -f agentgateway
docker run -d --name agentgateway \
  --user "$(id -u):$(id -g)" \
  -v "$PWD/agentgateway-config:/config" \
  -p 4000:4000 \
  {{< reuse "agw-docs/standalone/image-ref.md" >}}:v$OLD_VERSION
```
