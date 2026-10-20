#!/usr/bin/env python3
"""Smoke-test main standalone CLI docs without provider credentials or a cluster.

Requires Python 3, PyYAML, and matching main agentgateway/agctl binaries:
  AGENTGATEWAY_BIN=agentgateway-main AGCTL_BIN=agctl python3 scripts/test-agctl-standalone.py

Extracts configuration/resource examples from the docs. Uses temporary files,
loopback ports, and a local mock LLM. No user config or running gateway is changed.
"""

import json
import os
from pathlib import Path
import re
import shutil
import socket
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer

import yaml


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "assets/agw-docs/standalone/main"


def example(path, filename, multiple=False):
    """Read the literal YAML in a documented shell heredoc."""
    text = path.read_text()
    match = re.search(r"cat <<'EOF' > " + re.escape(filename) + r"\n(.*?)\n\s*EOF", text, re.S)
    if not match:
        raise AssertionError(f"Missing example {filename} in {path}")
    lines = match[1].splitlines()
    indent = len(lines[0]) - len(lines[0].lstrip())
    text = "\n".join(line[indent:] for line in lines)
    return list(yaml.safe_load_all(text)) if multiple else yaml.safe_load(text)


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


class MockLLM(BaseHTTPRequestHandler):
    def do_GET(self):
        data = b'{"headers": {"Host": "mock-httpbin"}}'
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        request = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        response = dict(id="chatcmpl-test", object="chat.completion", created=0,
                        model=request["model"], choices=[dict(index=0, finish_reason="stop",
                        message=dict(role="assistant", content="mock completion"))],
                        usage=dict(prompt_tokens=1, completion_tokens=100, total_tokens=101))
        data = json.dumps(response).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass


def run_mode(mode, root, mock_port, gateway, agctl):
    admin_port, traffic_port = free_port(), free_port()
    config = example(DOCS / "virtual-keys.md", "config.yaml")
    config["config"].update(adminAddr=f"127.0.0.1:{admin_port}",
                             statsAddr=f"127.0.0.1:{free_port()}",
                             readinessAddr=f"127.0.0.1:{free_port()}", storage=dict(mode=mode))
    config["config"]["database"]["url"] = f"sqlite://{root}/{mode}.db"
    config["gateways"] = dict(default=dict(port=traffic_port))
    config["llm"]["models"][0]["params"].update(apiKey="test", baseUrl=f"http://127.0.0.1:{mock_port}")
    config["frontendPolicies"] = dict(accessLog=dict(database=dict(llm="full", add=dict(team='"engineering"'))))
    config_path = root / f"{mode}.yaml"
    config_path.write_text(yaml.safe_dump(config))
    env = {**os.environ, "OPENAI_API_KEY": "test"}
    for name in ("XDS_ADDRESS", "AGCTL_STANDALONE_ADDRESS", "AGCTL_CONFIG", "UI_READ_ONLY"):
        env.pop(name, None)
    subprocess.run([gateway, "--validate-only", "-f", str(config_path)], env=env, check=True, capture_output=True)

    def cli(*args, check=True):
        result = subprocess.run([agctl, "standalone", "--address", f"http://127.0.0.1:{admin_port}", *args],
                                env=env, capture_output=True, text=True, timeout=20)
        if check and result.returncode:
            raise AssertionError(result.stderr)
        return result

    with (root / f"{mode}.log").open("w") as log:
        process = subprocess.Popen([gateway, "-f", str(config_path)], env=env, stdout=log, stderr=log)
        try:
            for _ in range(50):
                if cli("get", "all", check=False).returncode == 0:
                    break
                time.sleep(.2)
            else:
                raise AssertionError("Gateway did not start")

            resource = root / "model.yaml"
            resource.write_text(yaml.safe_dump(example(DOCS / "config-resources.md", "model.yaml")))
            if mode == "readOnly":
                result = cli("apply", "-f", str(resource), check=False)
                assert result.returncode and "403" in result.stderr
                print("PASS readOnly: resource listing and rejected writes")
                return

            cli("apply", "-f", str(resource))
            exported = yaml.safe_load(cli("get", "llm.model", "example-model", "-o", "yaml", "--no-metadata").stdout)
            exported["value"]["params"]["model"] = "llama3.1"
            resource.write_text(yaml.safe_dump(exported))
            cli("apply", "-f", str(resource))
            assert "llama3.1" in cli("get", "llm.model", "example-model", "-o", "yaml").stdout
            cli("delete", "llm.model", "example-model")

            target = example(ROOT / "content/docs/standalone/main/documentation/setup/storage.md", "target.yaml")
            resource.write_text(yaml.safe_dump(target))
            cli("apply", "-f", str(resource))
            assert "cli-target" in cli("get", "mcp.target").stdout
            cli("delete", "mcp.target", "cli-target")

            # Apply the actual quickstart resource documents, adapting ports and upstreams.
            quick_model = example(DOCS / "quickstart-llm-cli.md", "openai-model.yaml")
            quick_model["value"]["params"].update(apiKey="test", baseUrl=f"http://127.0.0.1:{mock_port}")
            resource.write_text(yaml.safe_dump(quick_model))
            cli("apply", "-f", str(resource))
            assert "gpt-3.5-turbo" in cli("get", "llm.model", "gpt-3.5-turbo").stdout
            cli("delete", "llm.model", "gpt-3.5-turbo")
            quick_mcp = example(DOCS / "quickstart-mcp-cli.md", "mcp-target.yaml")
            resource.write_text(yaml.safe_dump(quick_mcp))
            cli("apply", "-f", str(resource))
            assert "server-everything" in cli("get", "mcp.target").stdout
            cli("delete", "mcp.target", "server-everything")
            http_resources = example(DOCS / "quickstart-http-cli.md", "httpbin-resources.yaml", multiple=True)
            http_port = free_port()
            http_resources[0]["value"]["port"] = http_port
            http_resources[1]["value"]["backends"][0]["host"] = f"127.0.0.1:{mock_port}"
            resource.write_text(yaml.safe_dump_all(http_resources))
            cli("apply", "-f", str(resource))
            assert "httpbin" in cli("get", "traffic.gateway", "httpbin").stdout
            assert "httpbin" in cli("get", "traffic.route", "httpbin").stdout
            time.sleep(.5)
            with urllib.request.urlopen(f"http://127.0.0.1:{http_port}/headers", timeout=10) as response:
                assert response.status == 200
            cli("delete", "traffic.route", "httpbin")
            cli("delete", "traffic.gateway", "httpbin")

            key = cli("keys", "create", "team-a", "--model", "gpt-5*", "--budget", "250tokens/24h",
                      "--budget-action", "block").stdout.strip()
            exported = yaml.safe_load(cli("get", "llm.apiKey", "team-a", "-o", "yaml", "--no-metadata").stdout)
            assert exported["id"] and exported["value"]["keyHash"].startswith("sha256:")
            assert "key" not in exported["value"]
            exported["value"]["metadata"]["group"] = "engineering"
            resource.write_text(yaml.safe_dump(exported))
            cli("apply", "-f", str(resource))
            assert len(json.loads(cli("get", "llm.apiKey", "-o", "json").stdout)) == 1
            time.sleep(1)

            def request(model="gpt-5"):
                req = urllib.request.Request(f"http://127.0.0.1:{traffic_port}/v1/chat/completions",
                    data=json.dumps(dict(model=model, messages=[dict(role="user", content="Hello!")])).encode(),
                    headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"})
                try:
                    with urllib.request.urlopen(req, timeout=10) as response:
                        return response.status
                except urllib.error.HTTPError as error:
                    return error.code

            assert request("other-model") == 403
            assert [request() for _ in range(3)] == [200, 200, 200]
            assert request() == 429
            budget = cli("budgets", "--key", "team-a").stdout
            assert "303 tokens" in budget and "exceeded" in budget and "block" in budget
            cli("keys", "create", "ci", "--model", "gpt-5*", "--budget", "5usd/24h", "--budget-action", "block")
            time.sleep(.5)
            assert "usd-24h" in cli("budgets", "--key", "ci").stdout
            cli("delete", "llm.apiKey", "ci")

            time.sleep(2)
            logs = json.loads(cli("logs", "--limit", "10", "--attributes", "-o", "json").stdout)["logs"]
            success = next(entry for entry in logs if entry["httpStatus"] == 200)
            assert "engineering" in json.dumps(logs)
            assert "mock completion" in cli("logs", success["id"], "-o", "json").stdout
            filtered = json.loads(cli("logs", "--since", "1h", "--status", "200", "--provider", "openai",
                                      "--model", "gpt-5", "-o", "json").stdout)["logs"]
            assert len(filtered) == 3 and all(entry["httpStatus"] == 200 for entry in filtered)
            follower = subprocess.Popen([agctl, "standalone", "--address", f"http://127.0.0.1:{admin_port}",
                                         "logs", "-f", "--model", "gpt-5", "-o", "json"],
                                        env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            try:
                time.sleep(1.5)
            finally:
                follower.terminate()
                output, _ = follower.communicate(timeout=5)
            assert any(json.loads(line)["httpStatus"] == 200 for line in output.splitlines())
            assert "team-a" in cli("analytics", "--by", "agentgateway.user", "--since", "24h").stdout
            assert "engineering" in cli("analytics", "--by", "agentgateway.group", "--since", "24h").stdout
            cli("analytics", "--by", "provider,model", "--since", "168h")
            cli("analytics", "--by", "model", "--provider", "openai", "--since", "6h", "--interval", "1h")
            cli("analytics", "--by", "model,ttft")
            cli("analytics", "--by", "team", "-o", "json")
            cli("delete", "llm.apiKey", "team-a")
            time.sleep(.5)
            assert request() == 401
            print(f"PASS {mode}: documented resources, key round-trip, model denial, budget enforcement, logs, analytics, revocation")
        except Exception:
            log.flush()
            print((root / f"{mode}.log").read_text())
            raise
        finally:
            process.terminate()
            try:
                process.wait(timeout=15)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)


def main():
    gateway = shutil.which(os.environ.get("AGENTGATEWAY_BIN", "agentgateway-main"))
    agctl = shutil.which(os.environ.get("AGCTL_BIN", "agctl"))
    if not gateway or not agctl:
        raise SystemExit("Set AGENTGATEWAY_BIN and AGCTL_BIN to matching main binaries")
    mock = HTTPServer(("127.0.0.1", 0), MockLLM)
    threading.Thread(target=mock.serve_forever, daemon=True).start()
    try:
        with tempfile.TemporaryDirectory(prefix="agctl-docs-") as tmp:
            for mode in ("file", "hybrid", "readOnly"):
                run_mode(mode, Path(tmp), mock.server_port, gateway, agctl)
    finally:
        mock.shutdown()
        mock.server_close()


if __name__ == "__main__":
    main()
