const DEFAULT_TIMEOUT_MS = 3000;

function parsePlayerAgentUrls(rawUrls = "") {
  const map = {};

  if (!rawUrls || typeof rawUrls !== "string") {
    return map;
  }

  for (const entry of rawUrls.split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;

    const pcId = trimmed.slice(0, separatorIndex).trim().toLowerCase();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!pcId || !value) continue;

    map[pcId] = value.replace(/\/+$/, "");
  }

  return map;
}

function getPlayerAgentUrl(pcId, rawUrls = process.env.PLAYER_AGENT_URLS) {
  if (typeof pcId !== "string" || !pcId.trim()) {
    return null;
  }

  const urlMap = parsePlayerAgentUrls(rawUrls);
  return urlMap[pcId.trim().toLowerCase()] || null;
}

async function sendPlayerAgentCommand(pcId, text, options = {}) {
  if (typeof pcId !== "string" || !pcId.trim()) {
    return { ok: false, error: "pcId is required" };
  }
  if (typeof text !== "string" || text.length === 0) {
    return { ok: false, error: "text is required" };
  }

  const baseUrl = options.baseUrl || getPlayerAgentUrl(pcId);
  if (!baseUrl) {
    return { ok: false, error: "player agent is not configured" };
  }

  const targetUrl = new URL("/api/serial/send", baseUrl).toString();

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ pcId: pcId.toLowerCase(), text }),
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
    });

    const payload = await response.json().catch(() => ({}));

    return {
      ok: response.ok,
      status: response.status,
      payload
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "player agent request failed"
    };
  }
}

module.exports = {
  parsePlayerAgentUrls,
  getPlayerAgentUrl,
  sendPlayerAgentCommand
};
