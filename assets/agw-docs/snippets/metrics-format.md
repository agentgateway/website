The proxy's `/metrics` endpoint always returns metrics in the [OpenMetrics](https://openmetrics.io/) format. Two markers identify the format: the response ends with `# EOF`, and counter samples have a `_total` suffix that the counter's `# TYPE` line does not have. The `Content-Type` header of the response depends on the `Accept` header that the scraper sends.
{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" >}}
By default, the proxy sets the `Content-Type` header to `application/openmetrics-text`, so scrapers parse the response as OpenMetrics without extra configuration. Browser requests, which accept `text/html`, receive `Content-Type: text/plain` instead so that the browser displays the metrics.
{{< /version >}}
In version 1.6 and earlier, the proxy sets `Content-Type: application/openmetrics-text` only when the scraper requests OpenMetrics. Otherwise, the header is `text/plain`, and scrapers that rely on the header parse the response as classic Prometheus text. For example, the Datadog Agent without `use_latest_spec: true` drops every counter without an error, while gauges and histograms still arrive. To avoid this issue, configure your scraper to request OpenMetrics in one of the following ways:

* Send the `Accept: application/openmetrics-text; version=1.0.0` header.
* In the Datadog `openmetrics` check for the proxy, set `use_latest_spec: true`.

Prometheus, the OpenTelemetry Collector Prometheus receiver, and Grafana Alloy request OpenMetrics by default and need no changes on any version. Scrapers that cannot parse OpenMetrics, such as the Vector `prometheus_scrape` source, are not supported.
