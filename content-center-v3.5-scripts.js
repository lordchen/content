const API_BASE = (() => {
  if (window.SIMPLE_API_BASE) return window.SIMPLE_API_BASE.replace(/\/$/, "");
  const local = window.location.protocol === "file:" || ["127.0.0.1", "localhost"].includes(window.location.hostname);
  if (local) return "http://127.0.0.1:8771";
  const match = window.location.pathname.match(/^(\/[^/]+)\//);
  return match ? match[1] : "/content";
})();

const state = {
  user: null,
  scripts: [],
  jobsById: new Map(),
  status: "all",
  type: "all",
  query: "",
  selectedId: null,
  rewriteId: null,
  libraryConfigured: false,
  libraryError: "",
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

function setMessage(text = "", tone = "") {
  const node = $("#scriptMessage");
  if (!node) return;
  node.textContent = text;
  node.className = `cc35-message ${tone}`.trim();
}

function setPreviewActionMessage(text = "", tone = "") {
  const node = $("#previewActionMessage");
  if (!node) return;
  node.textContent = text;
  node.className = `cc35-message cc35-preview-action-message ${tone}`.trim();
}

async function init() {
  bindEvents();
  await ensureSession();
  if (!state.user) return;
  renderUser();
  await loadScripts();
}

function bindEvents() {
  $("#userButton")?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleUserMenu();
  });
  $("#logoutButton")?.addEventListener("click", logoutUser);
  document.addEventListener("click", () => toggleUserMenu(false));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      toggleUserMenu(false);
      closePreviewDrawer();
    }
  });
  $("#refreshScripts")?.addEventListener("click", loadScripts);
  $("#scriptSearch")?.addEventListener("input", syncQuery);
  $("#scriptGlobalSearch")?.addEventListener("input", syncQuery);
  $("#clearPreview")?.addEventListener("click", clearPreview);
  $("#scriptPreviewDrawer")?.addEventListener("click", (event) => {
    if (event.target.id === "scriptPreviewDrawer") closePreviewDrawer();
  });
  $("#confirmRewrite")?.addEventListener("click", confirmRewrite);
  $$("[data-close-modal]").forEach((button) => button.addEventListener("click", () => closeModal(button.dataset.closeModal)));
  $("#rewriteModal")?.addEventListener("click", (event) => {
    if (event.target.id === "rewriteModal") closeModal("rewriteModal");
  });
  $$("[data-script-status]").forEach((button) => {
    button.addEventListener("click", () => {
      state.status = button.dataset.scriptStatus || "all";
      $$("[data-script-status]").forEach((item) => item.classList.toggle("active", item === button));
      renderScripts();
    });
  });
  $$("[data-script-type]").forEach((button) => {
    button.addEventListener("click", () => {
      state.type = button.dataset.scriptType || "all";
      $$("[data-script-type]").forEach((item) => item.classList.toggle("active", item === button));
      renderScripts();
    });
  });
  $("#scriptPreviewActions")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-preview-action]");
    if (!button) return;
    handlePreviewAction(button.dataset.previewAction, button);
  });
}

function syncQuery(event) {
  state.query = event.target.value.trim();
  const peerId = event.target.id === "scriptSearch" ? "scriptGlobalSearch" : "scriptSearch";
  const peer = $(`#${peerId}`);
  if (peer && peer.value !== event.target.value) peer.value = event.target.value;
  renderScripts();
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
        <p class="cc35-muted">登录后查看 v3.5 新版脚本库。</p>
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
      $("#loginMessage").textContent = error.message || "登录失败";
      $("#loginMessage").className = "cc35-message error";
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

async function loadScripts() {
  setMessage("正在读取脚本库...", "");
  $("#scriptRows").innerHTML = `<tr><td colspan="7"><div class="cc35-empty">正在读取脚本库...</div></td></tr>`;
  try {
    const data = await apiJson("/api/simple-agent/scripts?limit=100");
    renderLibraryLink(data.library);
    state.scripts = data.items || data.outputs || [];
    state.jobsById = new Map((data.jobs || []).map((job) => [Number(job.id), job]));
    state.selectedId = null;
    renderScripts();
    renderPreview(null);
    if (data.library?.configured) {
      setMessage("");
    } else if (data.library?.error) {
      setMessage(`飞书同步暂不可用：${data.library.error}`, "error");
    } else {
      setMessage("飞书同步暂不可用：飞书脚本库未配置。", "error");
    }
  } catch (error) {
    renderLibraryLink(null);
    state.scripts = [];
    $("#scriptCountText").textContent = "读取失败";
    $("#scriptRows").innerHTML = `<tr><td colspan="8"><div class="cc35-empty">${escapeHtml(error.message || "读取失败")}</div></td></tr>`;
    renderPreview(null);
    setMessage(error.message || "读取失败", "error");
  }
}

function renderLibraryLink(library) {
  const link = $("#scriptLibraryLink");
  if (!link) return;
  state.libraryConfigured = Boolean(library?.configured);
  state.libraryError = library?.error || "";
  if (library?.configured && library.url) {
    link.href = library.url;
    link.title = "打开开发环境配置的飞书脚本库";
    link.textContent = "打开飞书脚本库";
    link.classList.remove("disabled");
    return;
  }
  link.hidden = false;
  link.href = library?.url || "https://vcnhkiozlu7s.feishu.cn/base/CsDvbgIIlawKgssQl4KcgENZncb";
  link.title = library?.error || "飞书脚本库未配置";
  link.textContent = "飞书未配置";
  link.classList.add("disabled");
}

function filteredScripts() {
  const query = state.query.toLowerCase();
  return state.scripts.filter((item) => {
    const status = scriptStatusKey(item);
    const type = scriptType(item);
    const statusMatched = state.status === "all"
      || (state.status === "sample" ? Boolean(item.isQualitySample) : status === state.status);
    const typeMatched = state.type === "all" || type === state.type;
    const output = item.output || {};
    const haystack = [
      item.title,
      item.hook,
      item.scriptBody,
      item.qualityNotes,
      item.reviewNote,
      output.campaignName,
      output.productName,
      output.structure,
      output.pattern,
      output.risk,
      scriptStatusLabel(status),
      type,
    ].join(" ").toLowerCase();
    return statusMatched && typeMatched && (!query || haystack.includes(query));
  });
}

function renderScripts() {
  const rows = filteredScripts();
  $("#scriptCountText").textContent = `共 ${rows.length} 条`;
  if (!rows.length) {
    $("#scriptRows").innerHTML = `<tr><td colspan="8"><div class="cc35-empty">暂无符合条件的脚本</div></td></tr>`;
    renderPreview(null);
    return;
  }
  if (state.selectedId && !rows.some((item) => Number(item.id) === Number(state.selectedId))) {
    state.selectedId = null;
    renderPreview(null);
  }
  $("#scriptRows").innerHTML = rows.map(scriptRow).join("");
  $$("[data-open-script]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedId = Number(button.dataset.openScript);
      renderScripts();
      renderPreview(selectedScript());
      openPreviewDrawer();
    });
  });
  $$("[data-review-script]").forEach((button) => {
    button.addEventListener("click", () => reviewScript(Number(button.dataset.reviewScript), button.dataset.reviewStatus, button));
  });
  $$("[data-rewrite-script]").forEach((button) => {
    button.addEventListener("click", () => openRewriteModal(Number(button.dataset.rewriteScript)));
  });
  $$("[data-delete-script]").forEach((button) => {
    button.addEventListener("click", () => deleteScript(Number(button.dataset.deleteScript)));
  });
}

function scriptRow(item) {
  const id = Number(item.id);
  const status = scriptStatusKey(item);
  const statusMeta = scriptStatusMeta(item);
  const type = scriptType(item);
  const selected = id === Number(state.selectedId) ? "active" : "";
  return `
    <tr class="${selected}">
      <td>
        <span class="cc35-material-name">
          <strong title="${escapeHtml(item.title || "")}">${escapeHtml(item.title || "未命名脚本")}</strong>
          <small>${escapeHtml(item.hook || "未记录开头")}</small>
        </span>
      </td>
      <td>${escapeHtml(campaignName(item))}</td>
      <td>${escapeHtml(type)}</td>
      <td><span class="cc35-tag ${statusMeta.className}">${escapeHtml(statusMeta.label)}</span></td>
      <td><span class="cc35-structure-tags">${compactCoreStructure(item).map((label) => `<span>${escapeHtml(label)}</span>`).join("")}</span></td>
      <td>${feishuSyncBadge(item)}</td>
      <td>${escapeHtml(formatDate(item.updatedAt || item.createdAt))}</td>
      <td>
        <span class="cc35-row-actions">
          <button class="cc35-link-btn" type="button" data-open-script="${id}">预览</button>
          <button class="cc35-link-btn" type="button" data-review-script="${id}" data-review-status="adopted" ${syncDisabledAttr(item)}>${feishuSynced(item) ? "已同步" : "同步飞书"}</button>
          <button class="cc35-link-btn" type="button" data-rewrite-script="${id}">重写</button>
          <button class="cc35-link-btn danger" type="button" data-delete-script="${id}">删除</button>
        </span>
      </td>
    </tr>
  `;
}

function selectedScript() {
  return state.scripts.find((item) => Number(item.id) === Number(state.selectedId)) || null;
}

function clearPreview() {
  closePreviewDrawer();
}

function openPreviewDrawer() {
  const drawer = $("#scriptPreviewDrawer");
  if (!drawer) return;
  drawer.hidden = false;
  document.body.classList.add("cc35-drawer-open");
}

function closePreviewDrawer() {
  const drawer = $("#scriptPreviewDrawer");
  if (!drawer) return;
  drawer.hidden = true;
  document.body.classList.remove("cc35-drawer-open");
  state.selectedId = null;
  $("#scriptRows")?.querySelectorAll("tr").forEach((row) => row.classList.remove("active"));
  renderPreview(null);
}

function renderPreview(item) {
  const body = $("#scriptPreviewBody");
  const actions = $("#scriptPreviewActions");
  if (!body || !actions) return;
  if (!item) {
    body.innerHTML = `<div class="cc35-empty">选择一条脚本后在这里预览。</div>`;
    actions.hidden = true;
    setPreviewActionMessage("");
    return;
  }
  const meta = scriptStatusMeta(item);
  body.innerHTML = `
    <section class="cc35-script-meta-stack">
      <div class="cc35-script-meta-item">
        <span>脚本标题</span>
        <h4 class="cc35-script-preview-title">${escapeHtml(item.title || "未命名脚本")}</h4>
      </div>
      <div class="cc35-script-meta-item">
        <span>关联活动</span>
        <strong>${escapeHtml(campaignName(item))}</strong>
      </div>
      <div class="cc35-script-meta-item">
        <span>类型</span>
        <strong>${escapeHtml(scriptType(item))}</strong>
      </div>
      <div class="cc35-script-meta-item">
        <span>状态</span>
        <strong><span class="cc35-tag ${meta.className}">${escapeHtml(meta.label)}</span></strong>
      </div>
      <div class="cc35-script-meta-item">
        <span>飞书同步</span>
        <strong>${feishuSyncBadge(item)}</strong>
      </div>
      <div class="cc35-script-meta-item">
        <span>核心结构</span>
        <strong>${escapeHtml(coreStructure(item))}</strong>
      </div>
    </section>
    <section class="cc35-detail-block">
      <h4>脚本内容（节选）</h4>
      ${scriptBodyHtml(item)}
    </section>
    <section class="cc35-detail-block">
      <h4>风险提示</h4>
      <p class="cc35-risk-box">${escapeHtml(riskText(item))}</p>
    </section>
  `;
  actions.hidden = false;
  const syncButton = actions.querySelector('[data-preview-action="sync"]');
  if (syncButton) {
    syncButton.disabled = !state.libraryConfigured || feishuSynced(item);
    syncButton.title = syncButton.disabled ? syncDisabledTitle(item) : "采用脚本并写入飞书脚本库";
    syncButton.textContent = feishuSynced(item) ? "已同步飞书" : "采用并同步飞书";
  }
  setPreviewActionMessage("");
}

function scriptBodyHtml(item) {
  const scenes = extractScenes(item);
  if (!scenes.length) {
    return `<p class="cc35-detail-text">${escapeHtml(item.scriptBody || item.hook || "暂无脚本内容")}</p>`;
  }
  return `
    <div class="cc35-script-table" role="table" aria-label="分镜脚本">
      <div class="cc35-script-row head" role="row">
        <span>时间</span>
        <span>内容</span>
      </div>
      ${scenes.slice(0, 4).map((scene) => `
        <div class="cc35-script-row" role="row">
          <strong>${escapeHtml(scene.time || "-")}</strong>
          <span>
            <span class="cc35-script-part"><b>镜头</b><em>${escapeHtml(scene.shot || "-")}</em></span>
            <span class="cc35-script-part"><b>口播</b><em>${escapeHtml(scene.voiceover || "-")}</em></span>
            <span class="cc35-script-part"><b>字幕</b><em>${escapeHtml(scene.subtitle || "-")}</em></span>
          </span>
        </div>
      `).join("")}
    </div>
  `;
}

function extractScenes(item) {
  const output = item.output || item.outputJson || {};
  const candidates = [
    output.scenes,
    output.shots,
    output.script,
    item.scenes,
  ].find(Array.isArray);
  if (candidates?.length) {
    return candidates.map((scene) => ({
      time: scene.time || scene.duration || scene.range || "",
      shot: scene.shot || scene.camera || scene.visual || scene.scene || "",
      voiceover: scene.voiceover || scene.vo || scene.spoken || scene.line || "",
      subtitle: scene.subtitle || scene.caption || scene.text || "",
    }));
  }
  return parseScriptBody(item.scriptBody || "");
}

function parseScriptBody(body) {
  const text = String(body || "").trim();
  if (!text) return [];
  const matches = [...text.matchAll(/(\d+\s*[-–—]\s*\d+s?)\s*[｜|]\s*镜头[:：]\s*([\s\S]*?)\s*[｜|]\s*口播[:：]\s*([\s\S]*?)\s*[｜|]\s*字幕[:：]\s*([\s\S]*?)(?=\n?\d+\s*[-–—]\s*\d+s?\s*[｜|]\s*镜头[:：]|$)/g)];
  return matches.map((match) => ({
    time: match[1].replace(/\s+/g, ""),
    shot: match[2].trim(),
    voiceover: match[3].trim(),
    subtitle: match[4].trim(),
  }));
}

async function reviewScript(id, status, button, sample = false) {
  const original = button?.textContent;
  if (button) {
    button.disabled = true;
    button.textContent = "处理中";
  }
  const workingText = previewWorkingMessage(status, sample);
  if (button?.dataset.previewAction) setPreviewActionMessage(workingText, "warn");
  else setMessage(workingText, "warn");
  try {
    const data = await apiJson(`/api/simple-agent/scripts/${id}/review`, {
      method: "POST",
      body: JSON.stringify({
        reviewStatus: status,
        isQualitySample: sample,
        reviewNote: defaultReviewNote(status, sample),
      }),
    });
    updateScript(data.item);
    state.selectedId = Number(data.item.id);
    renderScripts();
    renderPreview(selectedScript());
    const doneText = reviewDoneMessage(data.item, status, sample);
    setMessage(doneText, "ok");
    if (button?.dataset.previewAction) setPreviewActionMessage(doneText, "ok");
  } catch (error) {
    const message = error.message || "操作失败";
    setMessage(message, "error");
    if (button?.dataset.previewAction) setPreviewActionMessage(message, "error");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = original;
    }
  }
}

function handlePreviewAction(action, button) {
  const item = selectedScript();
  if (!item) return;
  if (action === "delete") {
    deleteScript(Number(item.id), { fromPreview: true });
    return;
  }
  if (action === "sync") {
    if (!state.libraryConfigured) {
      const message = state.libraryError || "飞书脚本库未配置，暂时不能同步。";
      setPreviewActionMessage(message, "error");
      setMessage(message, "error");
      return;
    }
    if (feishuSynced(item)) {
      setPreviewActionMessage("这条脚本已经同步过飞书。", "ok");
      return;
    }
    reviewScript(Number(item.id), "adopted", button);
    return;
  }
  if (action === "needs_edit") {
    reviewScript(Number(item.id), "needs_edit", button);
    return;
  }
  if (action === "sample") {
    reviewScript(Number(item.id), scriptStatusKey(item), button, true);
  }
}

async function deleteScript(id, options = {}) {
  const item = state.scripts.find((script) => Number(script.id) === Number(id));
  if (!item) return;
  const title = item.title || `脚本 ${id}`;
  const note = feishuSynced(item)
    ? "这只会删除本地脚本库记录，不会删除飞书脚本库里的记录。"
    : "删除后不会出现在脚本库中。";
  if (!window.confirm(`确认删除「${title}」？${note}`)) return;
  setMessage("正在删除脚本...", "warn");
  if (options.fromPreview) setPreviewActionMessage("正在删除脚本...", "warn");
  try {
    await apiJson(`/api/simple-agent/scripts/${id}`, { method: "DELETE" });
    state.scripts = state.scripts.filter((script) => Number(script.id) !== Number(id));
    if (Number(state.selectedId) === Number(id)) {
      state.selectedId = null;
      closePreviewDrawer();
    }
    renderScripts();
    setMessage("脚本已删除。", "ok");
  } catch (error) {
    const message = error.message || "删除失败";
    setMessage(message, "error");
    if (options.fromPreview) setPreviewActionMessage(message, "error");
  }
}

function openRewriteModal(id) {
  state.rewriteId = id;
  const item = state.scripts.find((script) => Number(script.id) === Number(id));
  $("#rewriteModalTitle").textContent = item?.title || "重写脚本";
  $("#rewriteFeedback").value = "";
  $("#rewriteMessage").textContent = "";
  $("#rewriteModal").hidden = false;
  $("#rewriteFeedback").focus();
}

async function confirmRewrite() {
  const id = state.rewriteId;
  const feedback = $("#rewriteFeedback").value.trim();
  if (!id) return;
  if (!feedback) {
    $("#rewriteMessage").textContent = "请先写清楚希望怎么改。";
    $("#rewriteMessage").className = "cc35-message error";
    return;
  }
  const button = $("#confirmRewrite");
  button.disabled = true;
  button.textContent = "重写中...";
  try {
    const data = await apiJson(`/api/simple-agent/scripts/${id}/regenerate`, {
      method: "POST",
      body: JSON.stringify({ manualFeedback: feedback }),
    });
    if (data.item) updateScript(data.item, true);
    closeModal("rewriteModal");
    state.selectedId = Number(data.item?.id || id);
    renderScripts();
    renderPreview(selectedScript());
    setMessage("已生成重写版本。", "ok");
  } catch (error) {
    $("#rewriteMessage").textContent = error.message || "重写失败";
    $("#rewriteMessage").className = "cc35-message error";
  } finally {
    button.disabled = false;
    button.textContent = "确认重写";
  }
}

function updateScript(item, prepend = false) {
  if (!item?.id) return;
  const index = state.scripts.findIndex((script) => Number(script.id) === Number(item.id));
  if (index >= 0) {
    state.scripts[index] = item;
  } else if (prepend) {
    state.scripts.unshift(item);
  }
}

function closeModal(id) {
  const node = $(`#${id}`);
  if (node) node.hidden = true;
}

function scriptStatusKey(item) {
  return item.reviewStatus || item.review_status || "new";
}

function scriptStatusLabel(status) {
  return {
    adopted: "已采用",
    needs_edit: "待改",
    rejected: "弃用",
    new: "待复盘",
  }[status] || "待复盘";
}

function scriptStatusMeta(item) {
  if (item.isQualitySample) return { label: "样例", className: "blue" };
  const status = scriptStatusKey(item);
  return {
    adopted: { label: "已采用", className: "ok" },
    needs_edit: { label: "待改", className: "warn" },
    rejected: { label: "弃用", className: "" },
    new: { label: "待复盘", className: "blue" },
  }[status] || { label: "待复盘", className: "blue" };
}

function feishuSynced(item) {
  return Boolean(item.feishuRecordId) && item.feishuSyncStatus === "synced";
}

function syncDisabledTitle(item) {
  if (feishuSynced(item)) return "这条脚本已经同步过飞书";
  return state.libraryError || "飞书脚本库未配置，暂时不能同步";
}

function syncDisabledAttr(item) {
  if (feishuSynced(item)) return "disabled title=\"这条脚本已经同步过飞书\"";
  if (!state.libraryConfigured) return `disabled title="${escapeHtml(state.libraryError || "飞书脚本库未配置，暂时不能同步")}"`;
  return "";
}

function feishuSyncMeta(item) {
  if (feishuSynced(item)) return { label: "已同步", className: "ok", title: item.feishuSyncedAt ? `同步时间：${formatDate(item.feishuSyncedAt)}` : "已同步飞书" };
  if (item.feishuSyncStatus === "failed") {
    return { label: "同步失败", className: "error", title: item.feishuSyncError || "飞书同步失败" };
  }
  if (scriptStatusKey(item) === "adopted") return { label: "待同步", className: "warn", title: "已采用，但尚未写入飞书" };
  return { label: "未同步", className: "", title: "采用后会同步飞书" };
}

function feishuSyncBadge(item) {
  const meta = feishuSyncMeta(item);
  return `<span class="cc35-tag ${meta.className}" title="${escapeHtml(meta.title)}">${escapeHtml(meta.label)}</span>`;
}

function syncSuccessMessage(item) {
  if (item?.feishuSync?.skipped || feishuSynced(item)) return "已采用，飞书已有记录，本次未重复写入。";
  if (item?.feishuSync?.ok || item?.feishuRecordId) return "已采用，并已同步飞书脚本库。";
  return "已采用，正在等待飞书同步状态刷新。";
}

function previewWorkingMessage(status, sample) {
  if (sample) return "正在设为样例...";
  if (status === "adopted") return "正在采用并同步飞书...";
  if (status === "needs_edit") return "正在标记为待改...";
  return "正在更新状态...";
}

function reviewDoneMessage(item, status, sample) {
  if (sample) return "已设为样例，后续生成可作为参考。";
  if (status === "adopted") return syncSuccessMessage(item);
  if (status === "needs_edit") return "已标记待改，可继续重写或人工调整。";
  return "状态已更新。";
}

function scriptType(item) {
  const output = item.output || {};
  const raw = [
    output.type,
    output.scriptType,
    output.outputMode,
    output.style,
    item.outputMode,
    item.title,
    item.scriptBody,
  ].find(Boolean) || "";
  const text = String(raw);
  if (text.includes("剧情")) return "剧情";
  if (text.includes("导购") || text.includes("团购")) return "导购";
  return "口播";
}

function campaignName(item) {
  const output = item.output || {};
  const job = state.jobsById.get(Number(item.jobId)) || {};
  const logSnapshot = item.generationLog?.requestSnapshot || {};
  const snapshot = output.inputSnapshot || item.inputSnapshot || job.inputSnapshot || logSnapshot || {};
  const campaigns = snapshot.campaigns || snapshot.products || [];
  return output.campaignName
    || output.productName
    || output.activityName
    || campaigns?.[0]?.productName
    || campaigns?.[0]?.campaignName
    || campaigns?.[0]?.brandName
    || snapshot.topic
    || job.topic
    || "未关联活动";
}

function coreStructure(item) {
  const output = item.output || {};
  return output.structure
    || output.pattern
    || output.scriptPattern
    || item.qualityNotes
    || inferStructure(item.scriptBody || item.hook || "");
}

function compactCoreStructure(item) {
  const text = coreStructure(item);
  const type = scriptType(item);
  const labels = [];
  if (type) labels.push(type);
  if (/到店|试穿|门店/.test(text)) labels.push("到店场景");
  if (/提问|顾客|问/.test(text)) labels.push("场景提问");
  if (/四段|三段|分镜/.test(text)) labels.push(/四段/.test(text) ? "四段式" : "分段结构");
  if (/CTA|引导|收口|私信/.test(text)) labels.push("CTA 收口");
  if (!labels.length) labels.push("标准结构");
  return [...new Set(labels)].slice(0, 3);
}

function inferStructure(text) {
  const value = String(text || "");
  if (value.includes("顾客") || value.includes("问")) return "场景提问 → 活动说明 → 促单引导";
  if (value.includes("痛点") || value.includes("适合")) return "痛点切入 → 产品卖点 → 购买引导";
  return "开头钩子 → 卖点展开 → 行动引导";
}

function riskText(item) {
  const output = item.output || {};
  return output.risk
    || output.riskNote
    || item.qualityNotes
    || "禁止使用绝对化用语，如“最舒适”“第一”等。价格、库存和门店权益以实际确认为准。";
}

function defaultReviewNote(status, sample) {
  if (sample) return "设为样例：可作为后续脚本生成参考。";
  return {
    adopted: "采用：结构清楚，可进入脚本库复用。",
    needs_edit: "待改：需要继续调整表达或结构。",
    rejected: "弃用：当前不适合继续使用。",
    new: "恢复为待复盘。",
  }[status] || "";
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16).replace("T", " ");
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
