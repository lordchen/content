const API_BASE = (() => {
  if (window.SIMPLE_API_BASE) return window.SIMPLE_API_BASE.replace(/\/$/, "");
  const local = window.location.protocol === "file:" || ["127.0.0.1", "localhost"].includes(window.location.hostname);
  if (local) return "http://127.0.0.1:8771";
  const match = window.location.pathname.match(/^(\/[^/]+)\//);
  return match ? match[1] : "/content-agent";
})();

const state = {
  user: null,
  activeView: "campaigns",
  campaigns: [],
  matrixAccounts: [],
  query: "",
  status: "all",
  channel: "",
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function apiJson(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function cleanError(message) {
  const raw = String(message || "");
  if (raw.includes("必须填写")) return raw;
  if (raw.includes("请先登录")) return "请先登录后再操作。";
  if (raw.includes("Traceback") || raw.includes("internal")) return "服务返回异常，请稍后重试。";
  return raw || "操作失败，请稍后再试。";
}

function setMessage(id, text = "", tone = "") {
  const node = $(`#${id}`);
  if (!node) return;
  node.textContent = text;
  node.className = `v34-message ${tone}`.trim();
}

async function init() {
  bindEvents();
  await ensureSession();
  if (!state.user) return;
  renderUser();
  await loadData();
}

async function ensureSession() {
  try {
    const data = await apiJson("/api/simple-agent/session");
    if (data.authenticated) {
      state.user = data.user;
      return;
    }
  } catch (error) {
    // Render login below.
  }
  renderLogin();
}

function renderLogin() {
  document.body.innerHTML = `
    <main class="v34-login">
      <section class="v34-card v34-login-card">
        <h1>登录内容中台</h1>
        <p class="v34-muted">登录后查看 v3.4 新版品牌活动。</p>
        <form id="loginForm">
          <label class="v34-field">账号<input id="loginUser" autocomplete="username" value="admin" /></label>
          <label class="v34-field">密码<input id="loginPass" type="password" autocomplete="current-password" /></label>
          <p class="v34-message" id="loginMessage"></p>
          <button class="v34-btn primary large" type="submit">登录</button>
        </form>
      </section>
    </main>
  `;
  $("#loginForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await apiJson("/api/simple-agent/login", {
        method: "POST",
        body: JSON.stringify({ username: $("#loginUser").value.trim(), password: $("#loginPass").value }),
      });
      window.location.reload();
    } catch (error) {
      setMessage("loginMessage", cleanError(error.message), "error");
    }
  });
}

function renderUser() {
  const displayName = state.user?.displayName || state.user?.username || "管理员";
  $("#userName").textContent = displayName;
  $("#userAvatar").textContent = displayName.slice(0, 1) || "管";
  const menuName = $("#userMenuName");
  const menuMeta = $("#userMenuMeta");
  if (menuName) menuName.textContent = displayName;
  if (menuMeta) menuMeta.textContent = [state.user?.username, state.user?.role].filter(Boolean).join(" · ") || "已登录";
}

function toggleUserMenu(forceOpen) {
  const panel = $("#userMenuPanel");
  const button = $("#userButton");
  if (!panel || !button) return;
  const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : panel.hidden;
  panel.hidden = !shouldOpen;
  button.setAttribute("aria-expanded", String(shouldOpen));
}

async function logoutUser() {
  try {
    await apiJson("/api/simple-agent/logout", { method: "POST", body: JSON.stringify({}) });
  } finally {
    window.location.reload();
  }
}

function bindEvents() {
  $("#userButton")?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleUserMenu();
  });
  $("#logoutButton")?.addEventListener("click", logoutUser);
  document.addEventListener("click", () => toggleUserMenu(false));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") toggleUserMenu(false);
  });
  $("#campaignGlobalSearch")?.addEventListener("input", syncQuery);
  $("#campaignSearch")?.addEventListener("input", syncQuery);
  $$("[data-view-tab]").forEach((button) => button.addEventListener("click", () => activateView(button.dataset.viewTab)));
  $$("[data-status-filter]").forEach((button) => button.addEventListener("click", () => {
    state.status = button.dataset.statusFilter || "all";
    $$("[data-status-filter]").forEach((item) => item.classList.toggle("active", item === button));
    renderCampaigns();
  }));
  $$("[data-channel-filter]").forEach((button) => button.addEventListener("click", () => {
    const value = button.dataset.channelFilter || "";
    state.channel = state.channel === value ? "" : value;
    $$("[data-channel-filter]").forEach((item) => item.classList.toggle("active", state.channel === item.dataset.channelFilter));
    renderCampaigns();
  }));
  $("#openCampaignModal")?.addEventListener("click", () => openCampaignModal());
  $("#openMatrixModal")?.addEventListener("click", () => openMatrixModal());
  $("#campaignForm")?.addEventListener("submit", saveCampaign);
  $("#matrixForm")?.addEventListener("submit", saveMatrixAccount);
  $$("[data-close-modal]").forEach((button) => button.addEventListener("click", () => closeModal(button.dataset.closeModal)));
  $$(".v34-modal-mask").forEach((mask) => mask.addEventListener("click", (event) => {
    if (event.target === mask) closeModal(mask.id);
  }));
}

function syncQuery(event) {
  state.query = event.target.value.trim();
  ["campaignGlobalSearch", "campaignSearch"].forEach((id) => {
    const input = $(`#${id}`);
    if (input && input !== event.target) input.value = state.query;
  });
  renderCampaigns();
  renderMatrixAccounts();
}

function activateView(view) {
  state.activeView = view === "matrix" ? "matrix" : "campaigns";
  $$("[data-view-tab]").forEach((button) => button.classList.toggle("active", button.dataset.viewTab === state.activeView));
  $("#campaignTableWrap").hidden = state.activeView !== "campaigns";
  $("#matrixTableWrap").hidden = state.activeView !== "matrix";
  $("#openCampaignModal").hidden = state.activeView !== "campaigns";
  $("#openMatrixModal").hidden = state.activeView !== "matrix";
  $("#campaignFilters").hidden = state.activeView !== "campaigns";
}

async function loadData() {
  setMessage("campaignMessage", "正在读取品牌活动...", "");
  try {
    const [campaigns, matrix] = await Promise.all([
      apiJson("/api/simple-agent/campaigns?limit=160"),
      apiJson("/api/simple-agent/matrix-accounts?limit=160"),
    ]);
    state.campaigns = campaigns.items || [];
    state.matrixAccounts = matrix.items || [];
    setMessage("campaignMessage", "");
    renderCampaigns();
    renderMatrixAccounts();
  } catch (error) {
    setMessage("campaignMessage", cleanError(error.message), "error");
  }
}

function filteredCampaigns() {
  const query = state.query.toLowerCase();
  return state.campaigns.filter((item) => {
    const text = [item.productName, item.campaignName, item.brandName, item.activityRules, item.priceNote, item.channelScope, ...(item.sellingPoints || [])].join(" ").toLowerCase();
    if (query && !text.includes(query)) return false;
    if (state.channel && !channelMatches(item, state.channel)) return false;
    if (state.status !== "all" && campaignUiStatus(item) !== state.status) return false;
    return true;
  });
}

function renderCampaigns() {
  const rows = filteredCampaigns();
  if (!rows.length) {
    $("#campaignRows").innerHTML = `<tr><td colspan="10"><div class="v34-empty">暂无符合条件的品牌活动</div></td></tr>`;
    return;
  }
  $("#campaignRows").innerHTML = rows.map(campaignRow).join("");
  $$("[data-edit-campaign]").forEach((button) => button.addEventListener("click", () => openCampaignModal(Number(button.dataset.editCampaign))));
  $$("[data-select-campaign]").forEach((button) => button.addEventListener("click", () => toggleCampaign(Number(button.dataset.selectCampaign))));
  $$("[data-stop-campaign]").forEach((button) => button.addEventListener("click", () => stopCampaign(Number(button.dataset.stopCampaign))));
}

function campaignRow(item) {
  const points = (item.sellingPoints || []).join("，") || "卖点待补";
  const status = campaignUiStatus(item);
  return `
    <tr>
      <td><span class="v34-material-name"><strong>${escapeHtml(item.productName || item.campaignName || "未命名活动")}</strong><small>${escapeHtml(item.campaignName || item.brandName || "")}</small></span></td>
      <td>${escapeHtml(item.brandName || "-")}</td>
      <td><span class="v34-text-line">${escapeHtml(points)}</span></td>
      <td><span class="v34-text-line">${escapeHtml(item.activityRules || "待补")}</span></td>
      <td><span class="v34-price">${escapeHtml(item.priceNote || "待补")}</span></td>
      <td>${escapeHtml(item.channelScope || "待补")}</td>
      <td><span class="v34-tag ${statusTone(status)}">${escapeHtml(statusLabel(status))}</span></td>
      <td>${escapeHtml(item.owner?.displayName || item.owner?.username || "-")}</td>
      <td>${escapeHtml(formatDate(item.updatedAt || item.createdAt))}</td>
      <td>
        <span class="v34-row-actions">
          <button class="v34-link-btn" type="button" data-edit-campaign="${item.id}">编辑</button>
          <button class="v34-link-btn" type="button" data-select-campaign="${item.id}">${item.selected ? "取消选用" : "选用"}</button>
          <button class="v34-link-btn" type="button" data-stop-campaign="${item.id}">停用</button>
        </span>
      </td>
    </tr>
  `;
}

function campaignUiStatus(item) {
  if (item.status === "expired") return "ended";
  if (item.status === "draft") return "pending";
  if (!hasPriceBoundary(item.priceNote) || !item.channelScope || !item.activityRules) return "pending";
  if (item.selected) return "confirmed";
  return "active";
}

function statusLabel(status) {
  return {
    active: "进行中",
    pending: "待确认",
    confirmed: "已确认",
    ended: "已结束",
  }[status] || "进行中";
}

function statusTone(status) {
  if (status === "confirmed" || status === "active") return "ok";
  if (status === "ended") return "";
  return "warn";
}

function hasPriceBoundary(value) {
  const text = String(value || "").trim();
  if (!text || /待补|待确认|未知|未填写/.test(text)) return false;
  return /[¥￥]?\s*\d+/.test(text);
}

function channelMatches(item, channel) {
  const text = [item.brandName, item.channelScope, item.campaignName, item.productName].join(" ").toLowerCase();
  if (channel === "douyin") return /抖音|douyin/.test(text);
  if (channel === "xhs") return /小红书|xhs|red/.test(text);
  return true;
}

function renderMatrixAccounts() {
  const query = state.query.toLowerCase();
  const rows = state.matrixAccounts.filter((item) => {
    const text = [item.accountName, item.platform, item.accountUrl, item.category, item.whyTrack, ...(item.patterns || [])].join(" ").toLowerCase();
    return !query || text.includes(query);
  });
  if (!rows.length) {
    $("#matrixRows").innerHTML = `<tr><td colspan="6"><div class="v34-empty">暂无品牌矩阵号</div></td></tr>`;
    return;
  }
  $("#matrixRows").innerHTML = rows.map((item) => `
    <tr>
      <td><span class="v34-material-name"><strong>${escapeHtml(item.accountName || "未命名账号")}</strong><small>${escapeHtml(item.category || "品牌矩阵号")}</small></span></td>
      <td><span class="v34-platform ${normalizePlatform(item.platform)}">${escapeHtml(platformLabel(item.platform))}</span></td>
      <td>${item.accountUrl ? `<a class="v34-link-btn" href="${escapeHtml(item.accountUrl)}" target="_blank" rel="noreferrer">打开链接</a>` : "待补"}</td>
      <td><span class="v34-text-line">${escapeHtml(item.whyTrack || (item.patterns || []).join("，") || "待补")}</span></td>
      <td><span class="v34-tag ${item.status === "active" ? "ok" : "warn"}">${escapeHtml(item.status === "active" ? "启用" : item.status || "待确认")}</span></td>
      <td>${escapeHtml(item.owner?.displayName || item.owner?.username || "-")}</td>
    </tr>
  `).join("");
}

function openCampaignModal(id = 0) {
  const item = state.campaigns.find((entry) => Number(entry.id) === Number(id));
  $("#campaignModalTitle").textContent = item ? "编辑品牌活动" : "新增品牌活动";
  $("#campaignId").value = item?.id || "";
  $("#campaignName").value = item?.productName || item?.campaignName || "";
  $("#campaignBrand").value = item?.brandName || "";
  $("#campaignSellingPoints").value = (item?.sellingPoints || []).join("，");
  $("#campaignRules").value = item?.activityRules || "";
  const [min, max] = splitPrice(item?.priceNote || "");
  $("#campaignPriceMin").value = min;
  $("#campaignPriceMax").value = max;
  $("#campaignChannel").value = normalizeChannel(item?.channelScope || "");
  $("#campaignStatus").value = item ? campaignUiStatus(item) : "draft";
  setMessage("campaignFormMessage", "");
  $("#campaignModal").hidden = false;
}

function openMatrixModal() {
  $("#matrixForm").reset();
  setMessage("matrixFormMessage", "");
  $("#matrixModal").hidden = false;
}

function closeModal(id) {
  const node = $(`#${id}`);
  if (node) node.hidden = true;
}

async function saveCampaign(event) {
  event.preventDefault();
  const id = $("#campaignId").value;
  const priceMin = $("#campaignPriceMin").value.trim();
  const priceMax = $("#campaignPriceMax").value.trim();
  const status = $("#campaignStatus").value;
  if (status === "confirmed" && (!priceMin || !priceMax || !$("#campaignChannel").value || !$("#campaignRules").value.trim())) {
    setMessage("campaignFormMessage", "价格边界、渠道范围和活动规则完整后才能保存为已确认。", "error");
    return;
  }
  const payload = {
    brandName: $("#campaignBrand").value.trim(),
    campaignName: $("#campaignName").value.trim(),
    productName: $("#campaignName").value.trim(),
    sellingPoints: $("#campaignSellingPoints").value.trim(),
    activityRules: $("#campaignRules").value.trim(),
    priceNote: [priceMin ? `¥${priceMin}` : "", priceMax ? `¥${priceMax}` : ""].filter(Boolean).join(" - "),
    channelScope: $("#campaignChannel").value,
    selected: status === "confirmed",
  };
  setMessage("campaignFormMessage", "正在保存...", "");
  try {
    await apiJson(id ? `/api/simple-agent/campaigns/${id}` : "/api/simple-agent/campaigns", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });
    closeModal("campaignModal");
    await loadData();
  } catch (error) {
    setMessage("campaignFormMessage", cleanError(error.message), "error");
  }
}

async function saveMatrixAccount(event) {
  event.preventDefault();
  const payload = {
    accountName: $("#matrixName").value.trim(),
    platform: $("#matrixPlatform").value,
    accountUrl: $("#matrixUrl").value.trim(),
    category: "品牌矩阵号",
    whyTrack: $("#matrixWhy").value.trim(),
    patterns: $("#matrixPatterns").value.trim(),
  };
  setMessage("matrixFormMessage", "正在保存...", "");
  try {
    await apiJson("/api/simple-agent/accounts", { method: "POST", body: JSON.stringify(payload) });
    closeModal("matrixModal");
    await loadData();
  } catch (error) {
    setMessage("matrixFormMessage", cleanError(error.message), "error");
  }
}

async function toggleCampaign(id) {
  const item = state.campaigns.find((entry) => Number(entry.id) === Number(id));
  if (!item) return;
  try {
    await apiJson(`/api/simple-agent/campaigns/${id}/select`, {
      method: "POST",
      body: JSON.stringify({ selected: !item.selected }),
    });
    await loadData();
  } catch (error) {
    setMessage("campaignMessage", cleanError(error.message), "error");
  }
}

async function stopCampaign(id) {
  const item = state.campaigns.find((entry) => Number(entry.id) === Number(id));
  if (!item) return;
  if (!window.confirm(`确认停用「${item.productName || item.campaignName}」？`)) return;
  try {
    await apiJson(`/api/simple-agent/campaigns/${id}`, { method: "DELETE" });
    await loadData();
  } catch (error) {
    setMessage("campaignMessage", cleanError(error.message), "error");
  }
}

function splitPrice(value) {
  const nums = String(value || "").match(/\d+(?:\.\d+)?/g) || [];
  return [nums[0] || "", nums[1] || ""];
}

function normalizeChannel(value) {
  if (/小红书/.test(value)) return "小红书";
  if (/全渠道/.test(value)) return "全渠道";
  if (/线下|门店/.test(value)) return "线下门店";
  if (/抖音/.test(value)) return "抖音";
  return "";
}

function normalizePlatform(platform) {
  const value = String(platform || "").toLowerCase();
  if (["xiaohongshu", "xhs", "小红书"].includes(value)) return "xhs";
  if (["douyin", "抖音"].includes(value)) return "douyin";
  return value || "other";
}

function platformLabel(platform) {
  const key = normalizePlatform(platform);
  if (key === "douyin") return "抖音";
  if (key === "xhs") return "小红书";
  return platform || "第三方";
}

function formatDate(value) {
  if (!value) return "-";
  return String(value).replace("T", " ").slice(0, 16);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
