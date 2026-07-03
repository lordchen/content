const API_BASE = (() => {
  if (window.SIMPLE_API_BASE) return window.SIMPLE_API_BASE.replace(/\/$/, "");
  const local = window.location.protocol === "file:" || ["127.0.0.1", "localhost"].includes(window.location.hostname);
  if (local) return "";
  const match = window.location.pathname.match(/^(\/[^/]+)\//);
  return match ? match[1] : "/content";
})();

const state = {
  user: null,
  activeView: "campaigns",
  campaigns: [],
  matrixAccounts: [],
  query: "",
  status: "all",
  channel: "",
  filterQueryTimer: 0,
  campaignsLoaded: false,
  matrixLoaded: false,
  matrixLoading: false,
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
  node.className = `cc35-message ${tone}`.trim();
}

function createDebounce(delay, callback) {
  let timer = 0;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => callback(...args), delay);
  };
}

async function withButtonBusy(button, busyText, task) {
  const originalText = button?.textContent || "";
  if (button) {
    button.disabled = true;
    button.textContent = busyText;
  }
  try {
    return await task();
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

const scheduleCampaignRender = createDebounce(180, () => {
  renderCampaigns();
  renderMatrixAccounts();
  setMessage("campaignMessage", "");
});

function scheduleIdleTask(task, delay = 800) {
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(() => task(), { timeout: delay * 2 });
    return;
  }
  window.setTimeout(task, delay);
}

async function init() {
  bindEvents();
  await ensureSession();
  if (!state.user) return;
  renderUser();
  await loadCampaignsData();
  scheduleIdleTask(() => {
    if (!state.matrixLoaded && !state.matrixLoading) loadMatrixData({ silent: true });
  });
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
    <main class="cc35-login">
      <section class="cc35-panel cc35-login-card">
        <h1>登录内容中台</h1>
        <p class="cc35-muted">登录后查看 v3.5 新版品牌活动。</p>
        <form id="loginForm">
          <label class="cc35-field">账号<input id="loginUser" autocomplete="username" value="admin" /></label>
          <label class="cc35-field">密码<input id="loginPass" type="password" autocomplete="current-password" /></label>
          <p class="cc35-message" id="loginMessage"></p>
          <button class="cc35-btn primary large" type="submit">登录</button>
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
  $$(".cc35-modal-mask").forEach((mask) => mask.addEventListener("click", (event) => {
    if (event.target === mask) closeModal(mask.id);
  }));
}

function syncQuery(event) {
  state.query = event.target.value.trim();
  ["campaignGlobalSearch", "campaignSearch"].forEach((id) => {
    const input = $(`#${id}`);
    if (input && input !== event.target) input.value = state.query;
  });
  setMessage("campaignMessage", "正在筛选列表...", "");
  scheduleCampaignRender();
}

function activateView(view) {
  state.activeView = view === "matrix" ? "matrix" : "campaigns";
  $$("[data-view-tab]").forEach((button) => button.classList.toggle("active", button.dataset.viewTab === state.activeView));
  $("#campaignTableWrap").hidden = state.activeView !== "campaigns";
  $("#matrixTableWrap").hidden = state.activeView !== "matrix";
  $("#openCampaignModal").hidden = state.activeView !== "campaigns";
  $("#openMatrixModal").hidden = state.activeView !== "matrix";
  $("#campaignFilters").hidden = state.activeView !== "campaigns";
  if (state.activeView === "matrix" && !state.matrixLoaded && !state.matrixLoading) {
    loadMatrixData();
  }
}

async function loadCampaignsData() {
  setMessage("campaignMessage", "正在读取品牌活动...", "");
  $("#campaignRows").innerHTML = `<tr><td colspan="10"><div class="cc35-empty">正在加载品牌活动...</div></td></tr>`;
  try {
    const campaigns = await apiJson("/api/simple-agent/campaigns?limit=80");
    state.campaigns = campaigns.items || [];
    state.campaignsLoaded = true;
    setMessage("campaignMessage", "");
    renderCampaigns();
  } catch (error) {
    setMessage("campaignMessage", cleanError(error.message), "error");
  }
}

async function loadMatrixData(options = {}) {
  state.matrixLoading = true;
  if (!options.silent) setMessage("campaignMessage", "正在读取品牌矩阵号...", "");
  $("#matrixRows").innerHTML = `<tr><td colspan="6"><div class="cc35-empty">正在加载品牌矩阵号...</div></td></tr>`;
  try {
    const matrix = await apiJson("/api/simple-agent/matrix-accounts?limit=80");
    state.matrixAccounts = matrix.items || [];
    state.matrixLoaded = true;
    if (!options.silent) setMessage("campaignMessage", "");
    renderMatrixAccounts();
  } catch (error) {
    if (!options.silent) setMessage("campaignMessage", cleanError(error.message), "error");
    $("#matrixRows").innerHTML = `<tr><td colspan="6"><div class="cc35-empty">${escapeHtml(cleanError(error.message))}</div></td></tr>`;
  } finally {
    state.matrixLoading = false;
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
    $("#campaignRows").innerHTML = `<tr><td colspan="10"><div class="cc35-empty">暂无符合条件的品牌活动</div></td></tr>`;
    return;
  }
  $("#campaignRows").innerHTML = rows.map(campaignRow).join("");
  $$("[data-edit-campaign]").forEach((button) => button.addEventListener("click", () => openCampaignModal(Number(button.dataset.editCampaign))));
  $$("[data-select-campaign]").forEach((button) => button.addEventListener("click", () => toggleCampaign(Number(button.dataset.selectCampaign), button)));
  $$("[data-stop-campaign]").forEach((button) => button.addEventListener("click", () => stopCampaign(Number(button.dataset.stopCampaign), button)));
}

function campaignRow(item) {
  const points = (item.sellingPoints || []).join("，") || "卖点待补";
  const status = campaignUiStatus(item);
  return `
    <tr>
      <td><span class="cc35-material-name"><strong>${escapeHtml(item.productName || item.campaignName || "未命名活动")}</strong><small>${escapeHtml(item.campaignName || item.brandName || "")}</small></span></td>
      <td>${escapeHtml(item.brandName || "-")}</td>
      <td><span class="cc35-text-line">${escapeHtml(points)}</span></td>
      <td><span class="cc35-text-line">${escapeHtml(item.activityRules || "待补")}</span></td>
      <td><span class="cc35-price">${escapeHtml(item.priceNote || "待补")}</span></td>
      <td>${escapeHtml(item.channelScope || "待补")}</td>
      <td><span class="cc35-tag ${statusTone(status)}">${escapeHtml(statusLabel(status))}</span></td>
      <td>${escapeHtml(item.owner?.displayName || item.owner?.username || "-")}</td>
      <td>${escapeHtml(formatDate(item.updatedAt || item.createdAt))}</td>
      <td>
        <span class="cc35-row-actions">
          <button class="cc35-link-btn" type="button" data-edit-campaign="${item.id}">编辑</button>
          <button class="cc35-link-btn" type="button" data-select-campaign="${item.id}">${item.selected ? "取消选用" : "选用"}</button>
          <button class="cc35-link-btn" type="button" data-stop-campaign="${item.id}">停用</button>
        </span>
      </td>
    </tr>
  `;
}

function campaignUiStatus(item) {
  if (item.status === "expired") return "ended";
  if (item.status === "draft") return "pending";
  if (!item.channelScope || !item.activityRules) return "pending";
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
  if (!state.matrixLoaded && state.matrixLoading) {
    $("#matrixRows").innerHTML = `<tr><td colspan="6"><div class="cc35-empty">正在加载品牌矩阵号...</div></td></tr>`;
    return;
  }
  if (!state.matrixLoaded) {
    $("#matrixRows").innerHTML = `<tr><td colspan="6"><div class="cc35-empty">切换到本页时再加载品牌矩阵号。</div></td></tr>`;
    return;
  }
  const query = state.query.toLowerCase();
  const rows = state.matrixAccounts.filter((item) => {
    const text = [item.accountName, item.platform, item.accountUrl, item.category, item.whyTrack, ...(item.patterns || [])].join(" ").toLowerCase();
    return !query || text.includes(query);
  });
  if (!rows.length) {
    $("#matrixRows").innerHTML = `<tr><td colspan="6"><div class="cc35-empty">暂无品牌矩阵号</div></td></tr>`;
    return;
  }
  $("#matrixRows").innerHTML = rows.map((item) => `
    <tr>
      <td><span class="cc35-material-name"><strong>${escapeHtml(item.accountName || "未命名账号")}</strong><small>${escapeHtml(item.category || "品牌矩阵号")}</small></span></td>
      <td><span class="cc35-platform ${normalizePlatform(item.platform)}">${escapeHtml(platformLabel(item.platform))}</span></td>
      <td>${item.accountUrl ? `<a class="cc35-link-btn" href="${escapeHtml(item.accountUrl)}" target="_blank" rel="noreferrer">打开链接</a>` : "待补"}</td>
      <td><span class="cc35-text-line">${escapeHtml(item.whyTrack || (item.patterns || []).join("，") || "待补")}</span></td>
      <td><span class="cc35-tag ${item.status === "active" ? "ok" : "warn"}">${escapeHtml(item.status === "active" ? "启用" : item.status || "待确认")}</span></td>
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
  if (status === "confirmed" && (!$("#campaignChannel").value || !$("#campaignRules").value.trim())) {
    setMessage("campaignFormMessage", "渠道范围和活动规则完整后才能保存为已确认。", "error");
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
  await withButtonBusy(event.submitter, "保存中...", async () => {
    try {
      await apiJson(id ? `/api/simple-agent/campaigns/${id}` : "/api/simple-agent/campaigns", {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      closeModal("campaignModal");
      await loadCampaignsData();
    } catch (error) {
      setMessage("campaignFormMessage", cleanError(error.message), "error");
    }
  });
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
  await withButtonBusy(event.submitter, "保存中...", async () => {
    try {
      await apiJson("/api/simple-agent/accounts", { method: "POST", body: JSON.stringify(payload) });
      closeModal("matrixModal");
      state.matrixLoaded = false;
      if (state.activeView === "matrix") {
        await loadMatrixData();
      } else {
        $("#matrixRows").innerHTML = `<tr><td colspan="6"><div class="cc35-empty">切换到本页时再加载品牌矩阵号。</div></td></tr>`;
      }
    } catch (error) {
      setMessage("matrixFormMessage", cleanError(error.message), "error");
    }
  });
}

async function toggleCampaign(id, button) {
  const item = state.campaigns.find((entry) => Number(entry.id) === Number(id));
  if (!item) return;
  await withButtonBusy(button, item.selected ? "移除中..." : "选用中...", async () => {
    try {
      setMessage("campaignMessage", item.selected ? "正在移出脚本参考..." : "正在加入脚本参考...", "");
      await apiJson(`/api/simple-agent/campaigns/${id}/select`, {
        method: "POST",
        body: JSON.stringify({ selected: !item.selected }),
      });
      await loadCampaignsData();
    } catch (error) {
      setMessage("campaignMessage", cleanError(error.message), "error");
    }
  });
}

async function stopCampaign(id, button) {
  const item = state.campaigns.find((entry) => Number(entry.id) === Number(id));
  if (!item) return;
  if (!window.confirm(`确认停用「${item.productName || item.campaignName}」？`)) return;
  await withButtonBusy(button, "停用中...", async () => {
    try {
      setMessage("campaignMessage", "正在停用活动...", "");
      await apiJson(`/api/simple-agent/campaigns/${id}`, { method: "DELETE" });
      await loadCampaignsData();
    } catch (error) {
      setMessage("campaignMessage", cleanError(error.message), "error");
    }
  });
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
