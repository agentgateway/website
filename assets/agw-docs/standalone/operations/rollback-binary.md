Run the script again with the version that you upgraded from.

```sh
curl -sL {{< reuse "agw-docs/standalone/install-url.md" >}} | bash -s -- --version v$OLD_VERSION
```
