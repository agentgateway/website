The proxy's `/metrics` endpoint returns metrics in one of two formats, based on the `Accept` header that the scraper sends. Scrapers use the `Content-Type` header of the response to decide how to parse the metrics, so the header must match the format.

### OpenMetrics text format {#openmetrics-text-format}

By default, the endpoint returns metrics in the [OpenMetrics](https://openmetrics.io/) text format. An OpenMetrics response ends with `# EOF`. The counter samples in the response have a `_total` suffix that the counter's `# TYPE` line does not have.

Prometheus, the OpenTelemetry Collector Prometheus receiver, and Grafana Alloy request OpenMetrics by default and need no changes on any version. Scrapers that cannot parse OpenMetrics, such as the Vector `prometheus_scrape` source, are not supported.

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" >}}
The proxy sets the `Content-Type` header to `application/openmetrics-text`, so scrapers parse the response as OpenMetrics without extra configuration. Browser requests, which accept `text/html`, receive `Content-Type: text/plain` instead so that the browser displays the metrics.
{{< /version >}}
In version 1.6 and earlier, the proxy sets `Content-Type: application/openmetrics-text` only when the scraper requests OpenMetrics. In these versions, the proxy sets the header to `text/plain` when the scraper sends one of the following:

* No `Accept` header.
* An `Accept` header with a wildcard, such as `*/*`.
* An `Accept` header that requests `text/plain`.
* An `Accept` header that requests only types that the proxy does not support.

Scrapers that rely on the `Content-Type` header then parse the response as classic Prometheus text and can drop metrics without an error. For example, the Datadog Agent without `use_latest_spec: true` drops every counter, while gauges and histograms still arrive. To avoid dropped metrics, configure your scraper to request OpenMetrics in one of the following ways:

* Send the `Accept: application/openmetrics-text; version=1.0.0` header.
* In the Datadog `openmetrics` check for the proxy, set `use_latest_spec: true`.

### Prometheus protobuf format {#prometheus-protobuf-format}

In version 1.5 and later, the endpoint returns metrics in the Prometheus protobuf format when the scraper requests protobuf, such as Prometheus with native histograms enabled. The proxy sets the `Content-Type` header to `application/vnd.google.protobuf`, so the scraper needs no extra configuration.
