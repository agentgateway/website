Name|Type|Labels|Help
--|--|--|--
agentgateway_controller_reconcile_duration_seconds|histogram|controller, name, namespace|Reconcile duration for controller
agentgateway_controller_reconciliations_running|gauge|controller, name, namespace|Number of reconciliations currently running
agentgateway_controller_reconciliations_total|counter|controller, name, namespace, result|Total number of controller reconciliations
agentgateway_xds_auth_rq_failure_total|counter||Total number of failed xDS auth requests
agentgateway_xds_auth_rq_success_total|counter||Total number of successful xDS auth requests
agentgateway_xds_auth_rq_total|counter||Total number of xDS auth requests
agentgateway_xds_rejects_total|counter||Total number of xDS responses rejected by agentgateway proxy
