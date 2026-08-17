> [!WARNING]
> Self-signed certificates are used for demonstration purposes. Do not use self-signed certificates in production environments. Instead, use certificates that are issued from a trusted Certificate Authority.

1. Create the `example_certs` directory and navigate to this directory.
   ```sh {paths="all,backendtls-secret-ca"}
   mkdir -p example_certs && cd example_certs
   ```

2. Create self-signed certificates for the Certificate Authority (CA) that you later use to sign the server certificate.
   ```sh {paths="all,backendtls-secret-ca"}
   # Create CA private key
   openssl genrsa -out ca-key.pem 2048

   # Create CA certificate (valid for 1 year)
   openssl req -new -x509 -days 365 -key ca-key.pem -out ca-cert.pem \
     -subj "/CN=Test CA/O=Test Org"
   ```

3. Create a server certificate for the `example.com` hostname that is signed by the CA that you created in the previous step.
   ```sh {paths="all,backendtls-secret-ca"}
   # Create server private key
   openssl genrsa -out server-key.pem 2048

   # Create server certificate signing request
   openssl req -new -key server-key.pem -out server.csr \
     -subj "/CN=example.com/O=Test Org"

   # Create server certificate signed by CA (valid for 1 year)
   openssl x509 -req -days 365 -in server.csr -CA ca-cert.pem -CAkey ca-key.pem \
     -CAcreateserial -out server-cert.pem \
     -extensions v3_req -extfile <(echo "[v3_req]"; \
       echo "basicConstraints=CA:FALSE"; \
       echo "keyUsage=digitalSignature,keyEncipherment"; \
       echo "extendedKeyUsage=serverAuth"; \
       echo "subjectAltName=DNS:example.com,DNS:*.example.com")
   ```
