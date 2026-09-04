## Method availability and field differences

The standalone binary and Kubernetes configure the same features, but they do not use the same field names, and in several places they do not use the same shape either. Expand the following section before you copy a configuration block from one mode to the other.

{{% details title="Compare the standalone binary and Kubernetes" closed="true" %}}

Which methods each mode supports:

| Method | Standalone | Kubernetes |
| -- | -- | -- |
| Static key | `key` | `key` or `secretRef` |
| Passthrough | `passthrough` | `passthrough` |
| AWS | `aws` | `aws` |
| Azure | `azure` | `azure` |
| Google Cloud | `gcp` | `gcp` |
| GitHub Copilot | `copilot` | Not available |
| Signed JWT | `jwtSign`, in 1.5.x and later | `jwtSign`, in 1.5.x and later |
| OAuth token exchange | `oauthTokenExchange` | `oauthTokenExchange` |
| Cross App Access | `crossAppAccess` | `crossAppAccess` |
| Extra credentials | `credentials` | `credentials` |

Where the two differ in shape:

| Concern | Standalone | Kubernetes |
| -- | -- | -- |
| Field that holds the settings | `policies.backendAuth` | `spec.backend.auth` or `spec.policies.auth` |
| Static key | `key.value`, either inline or `{file: <path>}` | `key`, an inline string |
| Credential from a Secret | Not available. Read the value from a file instead. | `secretRef` |
| Credential location | Nested under the method, such as `key.location` | A sibling field, `auth.location` |
| Methods that accept `location` | Every method that writes a credential | `key`, `secretRef`, and `passthrough` only |
| Entry in the `credentials` list | `location` and `key` | `location` and `secretRef` |
| Google token type | `accessToken` and `idToken` | `AccessToken` and `IdToken` |
| Azure credential source | Nested under `explicitConfig`, plus an `implicit` and a `developerImplicit` method | Set directly on `azure`, with no `developerImplicit` method |
| OAuth client authentication method | `clientSecretBasic`, `clientSecretPost`, and `privateKeyJwt` | `ClientSecretBasic`, `ClientSecretPost`, and `PrivateKeyJwt` |
| Signing key for `jwtSign` | `signingKey`, either the PEM text or `{file: <path>}` | `signingKeyRef`, a Secret reference |

The capitalization differences are enforced, not cosmetic. The standalone binary rejects `AccessToken`, and the custom resources reject `accessToken`. A wrong case fails validation rather than falling back to a default.

{{% /details %}}
