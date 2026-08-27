# Test-only helper: validate the config file exactly as the guide writes it, then
# derive a copy that points the OpenAI provider at the local mock LLM started by
# the start-mock-llm snippet. Deriving the copy instead of restating the config
# keeps the test honest: when the documented config changes, so does the config
# that the test runs. Run the gateway with `config-mock.yaml` afterwards.
agentgateway -f config.yaml --validate-only
python3 - <<'PY'
import pathlib, re, sys
src = pathlib.Path("config.yaml").read_text()
patched, count = re.subn(
    r'^(\s*)apiKey: "\$OPENAI_API_KEY"$',
    lambda m: m.group(0) + "\n" + m.group(1) + "baseUrl: http://localhost:3091",
    src,
    flags=re.M,
)
if not count:
    sys.exit("no OpenAI apiKey line in config.yaml; update point-config-at-mock-llm")
pathlib.Path("config-mock.yaml").write_text(patched)
PY
agentgateway -f config-mock.yaml --validate-only
