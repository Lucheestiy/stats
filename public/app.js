const DATA_URL = "/data/latest.json";
const REFRESH_MS = 60_000;

const updatedAtEl = document.getElementById("updatedAt");
const hostEl = document.getElementById("host");
const providersEl = document.getElementById("providers");
const costEl = document.getElementById("cost");
const errorsEl = document.getElementById("errors");
const rawJsonEl = document.getElementById("rawJson");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatIso(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatNumber(value) {
  if (value === null || value === undefined) return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString();
}

function formatUsd(value) {
  if (value === null || value === undefined) return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function windowLabel(minutes) {
  if (!minutes) return "Window";
  if (minutes === 300) return "Session (5h)";
  if (minutes === 10080) return "Week (7d)";
  const hours = minutes / 60;
  if (hours < 48) return `Window (${hours.toFixed(1)}h)`;
  return `Window (${(hours / 24).toFixed(1)}d)`;
}

function percentBadge(usedPercent) {
  const n = Number(usedPercent);
  if (!Number.isFinite(n)) return { text: "—", cls: "" };
  const left = Math.max(0, 100 - n);
  let cls = "";
  if (left <= 15) cls = "warn";
  return { text: `${left}% left`, cls };
}

function buildUsageSection(usage) {
  if (!usage) return `<div class="usageBlock"><div class="k">No usage data</div></div>`;

  const blocks = [
    { key: "primary", title: windowLabel(usage.primary?.windowMinutes) },
    { key: "secondary", title: windowLabel(usage.secondary?.windowMinutes) },
    usage.tertiary ? { key: "tertiary", title: windowLabel(usage.tertiary?.windowMinutes) } : null,
  ].filter(Boolean);

  const rows = blocks
    .map(({ key, title }) => {
      const u = usage[key];
      if (!u) return "";
      const used = Number(u.usedPercent);
      const usedText = Number.isFinite(used) ? `${used}% used` : "—";
      const badge = percentBadge(u.usedPercent);
      const fill = Number.isFinite(used) ? Math.min(100, Math.max(0, used)) : 0;
      const reset = u.resetsAt ? `Resets: ${formatIso(u.resetsAt)}` : null;

      return `
        <div>
          <div class="usageRow">
            <div class="usageLabel">${escapeHtml(title)}</div>
            <div class="usageValue">${escapeHtml(usedText)} · <span class="pill">${escapeHtml(badge.text)}</span></div>
          </div>
          <div class="bar"><div class="barFill ${badge.cls}" style="width:${fill}%"></div></div>
          ${reset ? `<div class="k" style="margin-top:6px">${escapeHtml(reset)}</div>` : ""}
        </div>
      `;
    })
    .join("");

  return `<div class="usageBlock">${rows}</div>`;
}

function buildCostSection(cost) {
  if (!cost) return `<div class="k">No cost data</div>`;
  return `
    <div class="costBlock">
      <div>
        <div class="k">Today</div>
        <div class="v">${escapeHtml(formatUsd(cost.sessionCostUSD))} · ${escapeHtml(formatNumber(cost.sessionTokens))} tokens</div>
      </div>
      <div>
        <div class="k">Last 30 days</div>
        <div class="v">${escapeHtml(formatUsd(cost.last30DaysCostUSD))} · ${escapeHtml(formatNumber(cost.last30DaysTokens))} tokens</div>
      </div>
    </div>
  `;
}

function buildProviderCard(providerUsage) {
  const provider = providerUsage.provider || "provider";
  const baseName = provider;
  const profile = providerUsage.codexAuthAccount;
  const name = profile ? `${baseName} (${profile})` : baseName;
  const source = providerUsage.source || "—";
  const loginMethod = providerUsage.usage?.loginMethod || providerUsage.usage?.identity?.loginMethod || "—";
  const providerError = providerUsage.error?.message || null;

  const isCodex = provider === "codex";
  const headRight = isCodex ? "" : `<span class="pill">${escapeHtml(source)}</span>`;
  const identityLines = [];
  if (!isCodex) {
    identityLines.push(`<div><div class="k">Login</div><div class="v">${escapeHtml(loginMethod)}</div></div>`);
  }

  const credits = providerUsage.credits?.remaining;
  const creditLine =
    !isCodex && typeof credits === "number"
      ? `<div><div class="k">Credits</div><div class="v">${escapeHtml(formatNumber(credits))}</div></div>`
      : "";

  const usageSection = buildUsageSection(providerUsage.usage);
  const errorSection = providerError ? `<div class="inlineError">${escapeHtml(providerError)}</div>` : "";
  const meta = `${identityLines.join("")}${creditLine}`;
  const metaSection = meta ? `<div class="kv">${meta}</div>` : "";

  return `
    <article class="card">
      <div class="cardHeader">
        <div>
          <h2 class="providerName">${escapeHtml(name)}</h2>
          ${metaSection}
        </div>
        <div>${headRight}</div>
      </div>
      ${errorSection}
      ${usageSection}
    </article>
  `;
}

function buildCostCard(cost) {
  const name = cost.provider || "provider";
  const source = cost.source || "—";
  const updatedAt = cost.updatedAt ? `Updated: ${formatIso(cost.updatedAt)}` : null;

  return `
    <article class="card">
      <div class="cardHeader">
        <div>
          <h2 class="providerName">${escapeHtml(name)}</h2>
          <div class="kv"><div><div class="k">Source</div><div class="v">${escapeHtml(source)}</div></div></div>
        </div>
        <div></div>
      </div>
      ${buildCostSection(cost)}
      ${updatedAt ? `<div class="k" style="margin-top:12px">${escapeHtml(updatedAt)}</div>` : ""}
    </article>
  `;
}

function render(data) {
  const updatedAt = data.generatedAt ? `Updated: ${formatIso(data.generatedAt)}` : "Updated: —";
  updatedAtEl.textContent = updatedAt;
  hostEl.textContent = data.hostname ? `Host: ${data.hostname}` : "";

  if (Array.isArray(data.errors) && data.errors.length > 0) {
    errorsEl.hidden = false;
    errorsEl.innerHTML = `
      <h2>Errors</h2>
      <pre>${escapeHtml(JSON.stringify(data.errors, null, 2))}</pre>
    `;
  } else {
    errorsEl.hidden = true;
    errorsEl.textContent = "";
  }

  const usage = Array.isArray(data.usage) ? data.usage : [];
  const cost = Array.isArray(data.cost) ? data.cost : [];

  providersEl.innerHTML = usage.map((u) => buildProviderCard(u)).join("");
  costEl.innerHTML = cost.length > 0 ? cost.map((c) => buildCostCard(c)).join("") : `<div class="card"><div class="k">No cost data</div></div>`;
  rawJsonEl.textContent = JSON.stringify(data, null, 2);
}

async function refresh() {
  try {
    const res = await fetch(`${DATA_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    render(data);
  } catch (err) {
    updatedAtEl.textContent = `Error loading data: ${err?.message || err}`;
    errorsEl.hidden = false;
    errorsEl.innerHTML = `<h2>Errors</h2><pre>${escapeHtml(String(err?.stack || err))}</pre>`;
  }
}

refresh();
setInterval(refresh, REFRESH_MS);
