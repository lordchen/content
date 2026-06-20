const API_BASE = (() => {
  if (window.SIMPLE_API_BASE) return window.SIMPLE_API_BASE.replace(/\/$/, "");
  const local = window.location.protocol === "file:" || ["127.0.0.1", "localhost"].includes(window.location.hostname);
  if (local) return "http://127.0.0.1:8771";
  const match = window.location.pathname.match(/^(\/[^/]+)\//);
  return match ? match[1] : "/content-agent";
})();

const state = {
  user: null,
  activeTab: "link",
  materials: [],
  pendingRows: [],
  query: "",
  filter: "all",
  loadingPreview: false,
  importing: false,
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
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return data;
}

function cleanError(message) {
  const raw = String(message || "");
  if (!raw) return "操作失败，请稍后再试。";
  if (raw.includes("batchText") || raw.includes("必须填写")) return "请填写正确的视频链接或分享文案。";
  if (raw.includes("ASR_API_KEY") || raw.includes("API_KEY") || raw.includes("subtitle")) return "服务暂时不可用，请稍后重试或联系管理员。";
  if (raw.includes("Traceback") || raw.includes("stack") || raw.includes("internal")) return "服务返回异常，请稍后重试。";
  if (raw.includes("请先登录")) return "请先登录后再操作。";
  return raw.replace(/^Error:\s*/i, "");
}

function setMessage(text = "", tone = "") {
  const node = $("#importMessage");
  if (!node) return;
  node.textContent = text;
  node.className = `v34-message ${tone}`.trim();
}

function setBusy(isBusy) {
  state.loadingPreview = isBusy;
  $("#previewButton").disabled = isBusy;
  $("#previewProgress").hidden = !isBusy;
}

function updateUser() {
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

async function init() {
  bindEvents();
  await ensureSession();
  if (!state.user) return;
  updateUser();
  await loadMaterials();
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
        <p class="v34-muted">登录后查看 v3.4 新版素材库。</p>
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
    const message = $("#loginMessage");
    if (message) message.textContent = "正在登录...";
    try {
      const data = await apiJson("/api/simple-agent/login", {
        method: "POST",
        body: JSON.stringify({
          username: $("#loginUser").value.trim(),
          password: $("#loginPass").value,
        }),
      });
      state.user = data.user;
      window.location.reload();
    } catch (error) {
      if (message) {
        message.textContent = cleanError(error.message);
        message.className = "v34-message error";
      }
    }
  });
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
  $$("[data-import-tab]").forEach((button) => {
    button.addEventListener("click", () => activateTab(button.dataset.importTab));
  });
  $("#pasteButton")?.addEventListener("click", pasteFromClipboard);
  $("#previewButton")?.addEventListener("click", previewActiveTab);
  $("#previewImportButton")?.addEventListener("click", importPendingRows);
  $("#importButton")?.addEventListener("click", importPendingRows);
  $("#continueAddButton")?.addEventListener("click", () => {
    setMessage("可以继续追加素材，已识别结果会保留在本次待入库列表。", "ok");
    if (state.activeTab === "link") $("#linkInput")?.focus();
  });
  $("#excelInput")?.addEventListener("change", updateExcelState);
  $("#materialSearch")?.addEventListener("input", (event) => {
    state.query = event.target.value.trim();
    renderMaterials();
  });
  $("#globalMaterialSearch")?.addEventListener("input", (event) => {
    state.query = event.target.value.trim();
    const listSearch = $("#materialSearch");
    if (listSearch) listSearch.value = state.query;
    renderMaterials();
  });
  $$("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter || "all";
      $$("[data-filter]").forEach((item) => item.classList.toggle("active", item === button));
      renderMaterials();
    });
  });
  $("#closeDrawer")?.addEventListener("click", closeDrawer);
  $("#detailDrawer")?.addEventListener("click", (event) => {
    if (event.target.id === "detailDrawer") closeDrawer();
  });
}

function activateTab(tab) {
  state.activeTab = tab;
  $$("[data-import-tab]").forEach((button) => button.classList.toggle("active", button.dataset.importTab === tab));
  $$("[data-import-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.importPanel !== tab;
  });
  $("#pasteButton").hidden = tab !== "link";
  $("#importButton").hidden = false;
  $("#previewButton").textContent = tab === "feishu" ? "读取并预览" : "识别并预览";
  setMessage("");
}

async function loadMaterials() {
  try {
    const data = await apiJson("/api/simple-agent/materials?limit=120");
    state.materials = data.items || [];
    $("#materialCountText").textContent = data.stats?.total ?? state.materials.length;
    renderMaterials();
  } catch (error) {
    $("#materialRows").innerHTML = `<tr><td colspan="8"><div class="v34-empty">${escapeHtml(cleanError(error.message))}</div></td></tr>`;
    $("#materialCountText").textContent = "-";
  }
}

function materialMatches(item) {
  const query = state.query.toLowerCase();
  const tags = Array.isArray(item.tags) ? item.tags.join(" ") : String(item.tags || "");
  const haystack = [item.title, item.platform, item.accountName, item.category, item.rawText, item.note, tags]
    .join(" ")
    .toLowerCase();
  if (query && !haystack.includes(query)) return false;
  if (state.filter === "douyin") return normalizePlatform(item.platform) === "douyin";
  if (state.filter === "xhs") return normalizePlatform(item.platform) === "xhs";
  if (state.filter === "video") return materialTypeLabel(item) === "视频";
  if (state.filter === "subtitle") return statusLabel(item).includes("待补字幕");
  if (state.filter === "selected") return Boolean(item.selected);
  return true;
}

function renderMaterials() {
  const rows = state.materials.filter(materialMatches);
  $("#materialScopeText").textContent = rows.length;
  if (!rows.length) {
    $("#materialRows").innerHTML = `<tr><td colspan="8"><div class="v34-empty">暂无符合条件的素材</div></td></tr>`;
    return;
  }
  $("#materialRows").innerHTML = rows.map(materialRow).join("");
  $$("[data-open-material]").forEach((button) => {
    button.addEventListener("click", () => openDrawer(Number(button.dataset.openMaterial)));
  });
  $$("[data-download-material]").forEach((button) => {
    button.addEventListener("click", () => downloadMaterial(Number(button.dataset.downloadMaterial), button));
  });
  $$("[data-toggle-selected]").forEach((button) => {
    button.addEventListener("click", () => toggleSelected(Number(button.dataset.toggleSelected)));
  });
  $$("[data-subtitle]").forEach((button) => {
    button.addEventListener("click", () => requestSubtitle(Number(button.dataset.subtitle)));
  });
}

function materialRow(item) {
  const duration = formatDuration(item.durationSeconds);
  const tags = normalizeTags(item.tags).slice(0, 3);
  const subtitle = materialSubtitle(item, tags);
  const status = statusLabel(item);
  const statusTone = status.includes("待") ? "warn" : "ok";
  const platform = platformLabel(item.platform);
  const platformKey = normalizePlatform(item.platform);
  return `
    <tr>
      <td>${thumbHtml(item, duration)}</td>
      <td>
        <span class="v34-material-name">
          <strong title="${escapeHtml(item.title || "")}">${escapeHtml(item.title || "未命名素材")}</strong>
          <small>${escapeHtml(subtitle)}</small>
        </span>
      </td>
      <td><span class="v34-platform ${platformKey}">${escapeHtml(platform)}</span></td>
      <td>${escapeHtml(materialTypeLabel(item))}</td>
      <td>${escapeHtml(duration || "-")}</td>
      <td>${escapeHtml(item.owner?.displayName || item.accountName || "-")}</td>
      <td><span class="v34-tag ${statusTone}">${escapeHtml(status)}</span></td>
      <td>
        <span class="v34-row-actions">
          <button class="v34-link-btn" type="button" data-open-material="${item.id}">预览</button>
          <button class="v34-link-btn" type="button" data-download-material="${item.id}">下载</button>
          ${status.includes("待补字幕") ? `<button class="v34-link-btn" type="button" data-subtitle="${item.id}">补字幕</button>` : ""}
          <button class="v34-link-btn" type="button" data-toggle-selected="${item.id}">${item.selected ? "移除参考" : "加入参考"}</button>
        </span>
      </td>
    </tr>
  `;
}

function thumbHtml(item, duration) {
  if (item.videoPreviewUrl) {
    return `<span class="v34-thumb"><video src="${API_BASE}${escapeHtml(item.videoPreviewUrl)}" muted preload="none"></video><span>${escapeHtml(duration || "视频")}</span></span>`;
  }
  return `<span class="v34-thumb"><span>${escapeHtml(duration || materialTypeLabel(item))}</span></span>`;
}

function materialSubtitle(item, tags) {
  if (tags.length) return tags.map((tag) => `#${tag}`).join(" ");
  if (item.category) return item.category;
  if (item.accountName) return item.accountName;
  return "未打标签";
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

function materialTypeLabel(item) {
  const value = String(item.materialType || "").toLowerCase();
  if (value.includes("image") || value.includes("图片")) return "图片";
  if (value.includes("text") || value.includes("文案")) return "文案";
  return "视频";
}

function statusLabel(item) {
  const status = String(item.status || "");
  const processing = item.processing || {};
  const subtitle = processing.subtitle || {};
  const download = processing.download || {};
  if (subtitle.status === "success" || status === "learned" || status === "reusable") return "字幕已提取";
  if (download.localPath || download.status === "success") return "视频已下载 / 待补字幕";
  if (status === "pending_text") return "待补字幕";
  if (status === "failed") return "处理失败";
  return "已入库";
}

function formatDuration(seconds) {
  const value = Number(seconds || 0);
  if (!value) return "";
  const minutes = Math.floor(value / 60);
  const rest = Math.floor(value % 60);
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags.map(String).filter(Boolean);
  return String(tags || "")
    .split(/[,，#\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function pasteFromClipboard() {
  const input = $("#linkInput");
  if (!navigator.clipboard?.readText) {
    setMessage("当前浏览器不支持直接读取剪贴板，请手动粘贴。", "warn");
    input?.focus();
    return;
  }
  try {
    const text = (await navigator.clipboard.readText()).trim();
    if (!text) {
      setMessage("剪贴板为空，请先复制素材链接或分享文案。", "warn");
      return;
    }
    input.value = text;
    setMessage("已从剪贴板录入，可以识别预览。", "ok");
  } catch (error) {
    setMessage("无法读取剪贴板，请允许浏览器权限或手动粘贴。", "warn");
  }
}

async function previewActiveTab() {
  if (state.loadingPreview) return;
  setBusy(true);
  setMessage("正在识别素材，请稍等...", "");
  try {
    let data;
    if (state.activeTab === "link") data = await previewLinks();
    if (state.activeTab === "excel") data = await previewExcel();
    if (state.activeTab === "feishu") data = await previewFeishu();
    appendPendingRows(data?.rows || []);
    renderPreview();
    setMessage(`已识别 ${data?.total ?? 0} 条，确认后可下载入库。`, data?.rows?.length ? "ok" : "warn");
  } catch (error) {
    setMessage(cleanError(error.message), "error");
  } finally {
    setBusy(false);
  }
}

async function previewLinks() {
  const batchText = $("#linkInput").value.trim();
  if (!batchText) throw new Error("batchText 必须填写");
  return apiJson("/api/simple-agent/materials/batch-preview", {
    method: "POST",
    body: JSON.stringify({ batchText, selected: true }),
  });
}

async function previewExcel() {
  const file = $("#excelInput")?.files?.[0];
  if (!file) throw new Error("请先选择 Excel 文件。");
  const dataUrl = await readFileAsDataUrl(file);
  return apiJson("/api/simple-agent/materials/excel-preview", {
    method: "POST",
    body: JSON.stringify({ filename: file.name, dataUrl, platform: "douyin" }),
  });
}

async function previewFeishu() {
  const feishuUrl = $("#feishuInput").value.trim();
  if (!feishuUrl) throw new Error("请填写飞书多维表格链接。");
  return apiJson("/api/simple-agent/materials/feishu-base-preview", {
    method: "POST",
    body: JSON.stringify({ feishuUrl, platform: "douyin", selected: true }),
  });
}

function appendPendingRows(rows) {
  const existingKeys = new Set(state.pendingRows.map(rowKey));
  rows.forEach((row) => {
    const key = rowKey(row);
    if (!existingKeys.has(key)) {
      state.pendingRows.push(row);
      existingKeys.add(key);
    }
  });
}

function rowKey(row) {
  return String(row.url || row.sourceOriginalUrl || `${row.line}-${row.title || ""}`);
}

function renderPreview() {
  const panel = $("#previewPanel");
  const importButton = $("#importButton");
  panel.hidden = !state.pendingRows.length;
  importButton.disabled = !state.pendingRows.length || state.importing;
  $("#previewImportButton").disabled = !state.pendingRows.length || state.importing;
  $("#previewSummary").textContent = previewSummaryText();
  $("#previewRows").innerHTML = state.pendingRows.map(previewRow).join("");
  $$("[data-remove-preview]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.removePreview);
      state.pendingRows.splice(index, 1);
      renderPreview();
    });
  });
}

function previewSummaryText() {
  const total = state.pendingRows.length;
  const duplicate = state.pendingRows.filter((row) => row.duplicate).length;
  const downloadable = total - duplicate;
  return `已识别 ${total} 条，可下载 ${downloadable} 条，需确认 ${duplicate} 条`;
}

function previewRow(row, index) {
  const tags = normalizeTags(row.tags);
  const duplicate = Boolean(row.duplicate);
  const hasUrl = Boolean(row.url);
  return `
    <tr>
      <td>
        <span class="v34-material-name">
          <strong title="${escapeHtml(row.title || "")}">${escapeHtml(row.title || `待入库素材 ${index + 1}`)}</strong>
          <small>${escapeHtml(tags.length ? tags.map((tag) => `#${tag}`).join(" ") : (row.note || row.sourceOriginalUrl || ""))}</small>
        </span>
      </td>
      <td><span class="v34-platform ${normalizePlatform(row.platform)}">${escapeHtml(platformLabel(row.platform))}</span></td>
      <td>视频</td>
      <td><span class="v34-tag ${duplicate ? "warn" : "ok"}">${duplicate ? "重复风险" : "未重复"}</span></td>
      <td><span class="v34-tag ${hasUrl ? "blue" : "error"}">${hasUrl ? "可下载" : "链接需确认"}</span></td>
      <td>${escapeHtml(duplicate ? (row.duplicateReason || "建议跳过重复素材") : "确认后下载入库")}</td>
      <td><button class="v34-link-btn" type="button" data-remove-preview="${index}">移出</button></td>
    </tr>
  `;
}

async function importPendingRows() {
  if (!state.pendingRows.length || state.importing) return;
  state.importing = true;
  renderPreview();
  setMessage(`正在处理 ${state.pendingRows.length} 条素材...`, "");
  $("#previewProgress").hidden = false;
  try {
    const data = await apiJson("/api/simple-agent/materials/process-batch", {
      method: "POST",
      body: JSON.stringify({ rows: state.pendingRows, selected: true }),
    });
    state.pendingRows = [];
    renderPreview();
    setMessage(`入库完成：新增 ${data.success || 0} 条，跳过 ${data.skipped || 0} 条，失败 ${data.failed || 0} 条。`, data.failed ? "warn" : "ok");
    $("#linkInput").value = "";
    $("#feishuInput").value = "";
    if ($("#excelInput")) $("#excelInput").value = "";
    updateExcelState();
    await loadMaterials();
  } catch (error) {
    setMessage(cleanError(error.message), "error");
  } finally {
    state.importing = false;
    $("#previewProgress").hidden = true;
    renderPreview();
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });
}

function updateExcelState() {
  const node = $("#excelState");
  const file = $("#excelInput")?.files?.[0];
  if (!node) return;
  node.hidden = !file;
  if (!file) {
    node.innerHTML = "";
    return;
  }
  node.innerHTML = `
    <strong>${escapeHtml(file.name)}</strong>
    <span class="v34-helper">${escapeHtml(formatFileSize(file.size))}</span>
    <span class="v34-tag warn">待识别</span>
  `;
}

function formatFileSize(size) {
  const value = Number(size || 0);
  if (value > 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  if (value > 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}

function openDrawer(id) {
  const item = state.materials.find((entry) => Number(entry.id) === id);
  if (!item) return;
  const duration = formatDuration(item.durationSeconds);
  const tags = normalizeTags(item.tags);
  $("#detailBody").innerHTML = `
    <div class="v34-detail-media">
      ${item.videoPreviewUrl ? `<video src="${API_BASE}${escapeHtml(item.videoPreviewUrl)}" controls></video>` : `<span class="v34-muted">暂无本地视频预览</span>`}
    </div>
    <section class="v34-detail-block">
      <h4>${escapeHtml(item.title || "未命名素材")}</h4>
      <div class="v34-tag-list">
        <span class="v34-platform ${normalizePlatform(item.platform)}">${escapeHtml(platformLabel(item.platform))}</span>
        <span class="v34-tag ${statusLabel(item).includes("待") ? "warn" : "ok"}">${escapeHtml(statusLabel(item))}</span>
        ${duration ? `<span class="v34-tag blue">${escapeHtml(duration)}</span>` : ""}
      </div>
    </section>
    <section class="v34-detail-grid">
      <div class="v34-detail-kv"><span>归属</span><strong>${escapeHtml(item.owner?.displayName || item.accountName || "-")}</strong></div>
      <div class="v34-detail-kv"><span>使用次数</span><strong>${Number(item.useCount || 0)}</strong></div>
      <div class="v34-detail-kv"><span>素材类型</span><strong>${escapeHtml(materialTypeLabel(item))}</strong></div>
      <div class="v34-detail-kv"><span>创建时间</span><strong>${escapeHtml(formatDate(item.createdAt))}</strong></div>
    </section>
    <section class="v34-detail-block">
      <h4>标签</h4>
      <div class="v34-tag-list">${tags.length ? tags.map((tag) => `<span class="v34-tag">${escapeHtml(tag)}</span>`).join("") : `<span class="v34-muted">未打标签</span>`}</div>
    </section>
    <section class="v34-detail-block">
      <h4>来源链接</h4>
      <p class="v34-detail-text">${escapeHtml(item.sourceOriginalUrl || item.url || "暂无链接")}</p>
    </section>
    <section class="v34-detail-block">
      <h4>字幕 / 描述</h4>
      <p class="v34-detail-text">${escapeHtml(item.rawText || item.note || "暂无字幕或描述。")}</p>
    </section>
  `;
  $("#detailActions").innerHTML = `
    <button class="v34-btn subtle" type="button" data-download-material="${item.id}">下载到本地</button>
    ${statusLabel(item).includes("待补字幕") ? `<button class="v34-btn subtle" type="button" data-subtitle="${item.id}">补充字幕</button>` : ""}
    <button class="v34-btn primary" type="button" data-toggle-selected="${item.id}">${item.selected ? "移除脚本参考" : "加入脚本参考"}</button>
  `;
  $("#detailActions").querySelector("[data-download-material]")?.addEventListener("click", (event) => downloadMaterial(item.id, event.currentTarget));
  $("#detailActions").querySelector("[data-subtitle]")?.addEventListener("click", () => requestSubtitle(item.id));
  $("#detailActions").querySelector("[data-toggle-selected]")?.addEventListener("click", () => toggleSelected(item.id));
  $("#detailDrawer").hidden = false;
}

function closeDrawer() {
  $("#detailDrawer").hidden = true;
}

function formatDate(value) {
  if (!value) return "-";
  return String(value).replace("T", " ").slice(0, 16);
}

async function toggleSelected(id) {
  const item = state.materials.find((entry) => Number(entry.id) === Number(id));
  if (!item) return;
  try {
    await apiJson(`/api/simple-agent/materials/${id}/select`, {
      method: "POST",
      body: JSON.stringify({ selected: !item.selected }),
    });
    item.selected = !item.selected;
    renderMaterials();
    if (!$("#detailDrawer").hidden) openDrawer(id);
  } catch (error) {
    setMessage(cleanError(error.message), "error");
  }
}

async function requestSubtitle(id) {
  setMessage("正在补充字幕，请稍等...", "");
  try {
    await apiJson(`/api/simple-agent/materials/${id}/subtitle`, { method: "POST", body: JSON.stringify({}) });
    setMessage("字幕已补充。", "ok");
    await loadMaterials();
    if (!$("#detailDrawer").hidden) openDrawer(id);
  } catch (error) {
    setMessage(cleanError(error.message), "error");
  }
}

async function downloadMaterial(id, button) {
  const item = state.materials.find((entry) => Number(entry.id) === Number(id));
  if (!item) return;
  const originalText = button?.textContent || "";
  if (button) {
    button.disabled = true;
    button.textContent = item.videoPreviewUrl ? "准备下载..." : "下载中...";
  }
  setMessage(item.videoPreviewUrl ? "正在准备本地下载..." : "正在通过原视频链接下载，请稍等...", "");
  try {
    let downloadable = item;
    if (!downloadable.videoPreviewUrl) {
      const data = await apiJson(`/api/simple-agent/materials/${id}/download`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (!data.ok || !data.item?.videoPreviewUrl) {
        throw new Error(data.download?.error || "下载失败，请确认原视频链接仍然可用。");
      }
      downloadable = data.item;
      state.materials = state.materials.map((entry) => (Number(entry.id) === Number(id) ? downloadable : entry));
      renderMaterials();
    }
    triggerBrowserDownload(downloadable);
    setMessage("已开始下载到浏览器默认下载目录。", "ok");
    if (!$("#detailDrawer").hidden) openDrawer(id);
  } catch (error) {
    setMessage(cleanError(error.message), "error");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

function triggerBrowserDownload(item) {
  if (!item.videoPreviewUrl) throw new Error("该素材没有可下载的视频文件。");
  const link = document.createElement("a");
  link.href = `${API_BASE}${item.videoPreviewUrl}`;
  link.download = `${safeFileName(item.title || `material-${item.id}`)}.mp4`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function safeFileName(value) {
  return String(value || "material")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "material";
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
