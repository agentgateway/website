Name|Type|Labels|Help
--|--|--|--
agentgateway_cert_expiry_seconds|gauge||Expiry timestamp (Unix seconds) of the current xDS serving certificate
agentgateway_cert_rotation_errors_total|counter||Total number of failed xDS certificate rotations
agentgateway_cert_rotation_total|counter||Total number of successful xDS certificate rotations
agentgateway_controller_reconcile_duration_seconds|histogram|controller, name, namespace|Reconcile duration for controller
agentgateway_controller_reconciliations_running|gauge|controller, name, namespace|Number of reconciliations currently running
agentgateway_controller_reconciliations_total|counter|controller, name, namespace, result|Total number of controller reconciliations
agentgateway_xds_auth_rq_failure_total|counter||Total number of failed xDS auth requests
agentgateway_xds_auth_rq_success_total|counter||Total number of successful xDS auth requests
agentgateway_xds_auth_rq_total|counter||Total number of xDS auth requests
agentgateway_xds_rejects_total|counter||Total number of xDS responses rejected by agentgateway proxy
