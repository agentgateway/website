{{< tabs >}}
{{% tab name="Admin Console" %}}
In the Okta Admin Console, delete the resources that you created, including the `agentgateway-test-password-only` authentication policy, the `agentgateway-backend` authorization server, the `agentgateway` and `agentgateway-test-client` apps, and the test user. Deactivate each app and the user before you delete them.
{{% /tab %}}
{{% tab name="Okta API" %}}
Delete the Okta resources that you created. Okta deletes only deactivated apps, users, and authorization servers, so each resource is deactivated first. Each delete command returns `204`.

```sh
for APP_ID in $GATEWAY_APP_ID $TEST_APP_ID; do
  curl -s -o /dev/null -X POST https://$OKTA_DOMAIN/api/v1/apps/$APP_ID/lifecycle/deactivate \
    -H "Authorization: SSWS $OKTA_API_TOKEN"
  curl -s -X DELETE https://$OKTA_DOMAIN/api/v1/apps/$APP_ID \
    -H "Authorization: SSWS $OKTA_API_TOKEN" -w "%{http_code}\n"
done
curl -s -X DELETE https://$OKTA_DOMAIN/api/v1/policies/$AUTHN_POLICY_ID \
  -H "Authorization: SSWS $OKTA_API_TOKEN" -w "%{http_code}\n"
curl -s -o /dev/null -X POST "https://$OKTA_DOMAIN/api/v1/users/$TEST_USER_ID/lifecycle/deactivate?sendEmail=false" \
  -H "Authorization: SSWS $OKTA_API_TOKEN"
curl -s -X DELETE https://$OKTA_DOMAIN/api/v1/users/$TEST_USER_ID \
  -H "Authorization: SSWS $OKTA_API_TOKEN" -w "%{http_code}\n"
curl -s -o /dev/null -X POST https://$OKTA_DOMAIN/api/v1/authorizationServers/$AUTH_SERVER_ID/lifecycle/deactivate \
  -H "Authorization: SSWS $OKTA_API_TOKEN"
curl -s -X DELETE https://$OKTA_DOMAIN/api/v1/authorizationServers/$AUTH_SERVER_ID \
  -H "Authorization: SSWS $OKTA_API_TOKEN" -w "%{http_code}\n"
```

If you no longer need the API token, revoke it in the Okta Admin Console, in **Security** > **API** > **Tokens**.
{{% /tab %}}
{{< /tabs >}}
