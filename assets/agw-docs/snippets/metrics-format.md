The proxy's `/metrics` endpoint returns metrics in one of two formats, based on the `Accept` header that the scraper sends. Scrapers use the `Content-Type` header of the response to decide how to parse the metrics, so the header must match the format.

### OpenMetrics text format {#openmetrics-text-format}

By default, the endpoint returns metrics in the [OpenMetrics](https://openmetrics.io/) text format. An OpenMetrics response ends with `# EOF`. In the response, counter samples end in `_total`, but the matching `# TYPE` line does not.

The proxy sets the `Content-Type` header to `application/openmetrics-text`, so scrapers parse the response as OpenMetrics without extra configuration. Browser requests, which accept `text/html`, receive `Content-Type: text/plain` instead so that the browser displays the metrics.

Prometheus, the OpenTelemetry Collector Prometheus receiver, and Grafana Alloy request OpenMetrics by default and need no changes. Scrapers that cannot parse OpenMetrics, such as the Vector `prometheus_scrape` source, are not supported.

### Prometheus protobuf format {#prometheus-protobuf-format}

The endpoint returns metrics in the Prometheus protobuf format when the scraper requests protobuf, such as Prometheus with native histograms enabled. The proxy sets the `Content-Type` header to `application/vnd.google.protobuf`, so the scraper needs no extra configuration.
