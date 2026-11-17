1. Get an access token for the test user from the custom authorization server, and save it in an environment variable. The test app requests only the `openid` scope, so the token does not grant access to the backend yet. Okta access tokens expire after 1 hour by default, so get a new one if you come back to this guide later.

   ```sh
   export INBOUND_TOKEN=$(curl -s https://$OKTA_DOMAIN/oauth2/$AUTH_SERVER_ID/v1/token \
     -d grant_type=password -d client_id=$TEST_CLIENT_ID \
     --data-urlencode username=$OKTA_USERNAME \
     --data-urlencode password=$OKTA_PASSWORD \
     -d scope=openid | jq -r .access_token)
   ```

2. Decode the token's payload. The `cid` claim is the client ID of the test app, and the `scp` claim has only `openid`.

   ```sh
   echo "$INBOUND_TOKEN" | cut -d. -f2 | jq -R 'gsub("-";"+") | gsub("_";"/") | . + ("=" * ((4 - (length % 4)) % 4)) | @base64d | fromjson | {iss, aud, sub, cid, scp}'
   ```

   Example output:

   ```json
   {
     "iss": "https://integrator-1234567.okta.com/oauth2/aus1a2b3c4d5e6f7g8h9",
     "aud": "api://agentgateway-backend",
     "sub": "testuser@example.com",
     "cid": "0oa1test2client3id4h9",
     "scp": [
       "openid"
     ]
   }
   ```
