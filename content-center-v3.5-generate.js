const API_BASE = (() => {
  if (window.SIMPLE_API_BASE) return window.SIMPLE_API_BASE.replace(/\/$/, "");
  const local = window.location.protocol === "file:" || ["127.0.0.1", "localhost"].includes(window.location.hostname);
  if (local) return "http://127.0.0.1:8771";
  const match = window.location.pathname.match(/^(\/[^/]+)\//);
  return match ? match[1] : "/content";
})();

const state = {
  user: null,
  campaigns: [],
  materials: [],
  selectedMaterialIds: new Set(),
  activeJobIds: new Set(),
  jobs: new Map(),
  historyJobs: [],
  selectedHistoryJobId: null,
  jobPollTimer: null,
  serviceHealth: null,
};
const MAX_TARGET_COUNT = 50;

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
  const node = $("#generateMessage");
  if (!node) return;
  node.textContent = text;
  node.className = `cc35-message ${tone}`.trim();
}

async function init() {
  bindEvents();
  await ensureSession();
  if (!state.user) return;
  renderUser();
  await loadGenerationServiceHealth();
  await loadInputs();
  await loadLatestResults();
  resumeActiveJob();
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
        <p class="cc35-muted">登录后查看 v3.5 新版脚本生成。</p>
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
  $("#campaignSelect")?.addEventListener("change", updateSummary);
  $("#topicInput")?.addEventListener("input", updateSummary);
  $("#countInput")?.addEventListener("input", sanitizeTargetCountInput);
  $("#countInput")?.addEventListener("blur", sanitizeTargetCountInput);
  $("#openMaterialPicker")?.addEventListener("click", openMaterialPicker);
  $("#confirmMaterials")?.addEventListener("click", confirmMaterialPicker);
  $("#runGenerate")?.addEventListener("click", runGenerate);
  $("#refreshJobHistory")?.addEventListener("click", () => loadLatestResults({ silent: false }));
  $("#refreshGenerationService")?.addEventListener("click", () => loadGenerationServiceHealth({ silent: false }));
  $("#generationHistoryList")?.addEventListener("click", (event) => {
    const retryButton = event.target.closest("[data-retry-job-id]");
    if (retryButton) {
      event.stopPropagation();
      retryGenerationJob(Number(retryButton.dataset.retryJobId), retryButton);
      return;
    }
    const item = event.target.closest("[data-job-id]");
    if (item) openGenerationJob(Number(item.dataset.jobId));
  });
  $$("[data-extra-prompt]").forEach((button) => button.addEventListener("click", () => {
    $("#extraInput").value = button.dataset.extraPrompt || "";
    $("#extraInput").focus();
  }));
  $$("[data-close-modal]").forEach((button) => button.addEventListener("click", () => closeModal(button.dataset.closeModal)));
  $("#materialPickerModal")?.addEventListener("click", (event) => {
    if (event.target.id === "materialPickerModal") closeModal("materialPickerModal");
  });
}

async function loadGenerationServiceHealth(options = {}) {
  try {
    const data = await apiJson("/api/simple-agent/generation-service/health");
    state.serviceHealth = data;
    renderGenerationServiceHealth(data);
    if (options.silent === false) setMessage("已刷新生成服务状态。", "ok");
  } catch (error) {
    renderGenerationServiceHealth({
      status: "unavailable",
      statusLabel: "检测失败",
      summary: error.message || "暂时无法检测生成服务状态。",
      nextAction: "建议先不要连续生成，稍后再刷新一次。",
      recentFailures: 0,
      recentSuccesses: 0,
      recentFailureMessage: "",
    });
    if (options.silent === false) setMessage(error.message || "生成服务状态读取失败", "error");
  }
}

function renderGenerationServiceHealth(data = {}) {
  const title = $("#generationServiceTitle");
  const summary = $("#generationServiceSummary");
  const tag = $("#generationServiceStatusTag");
  if (!title || !summary || !tag) return;
  const meta = generationServiceTone(data.status);
  const tail = [];
  if (data.recentFailureMessage) tail.push(data.recentFailureMessage);
  if (typeof data.recentFailures === "number") tail.push(`最近失败 ${data.recentFailures} 次`);
  if (typeof data.recentSuccesses === "number") tail.push(`成功 ${data.recentSuccesses} 次`);
  title.textContent = data.statusLabel || "待检测";
  summary.textContent = [data.summary, data.nextAction, tail.join(" · ")].filter(Boolean).join(" ");
  tag.textContent = data.statusLabel || "待检测";
  tag.className = `cc35-tag ${meta.tagClass}`;
  const banner = $("#generationServiceBanner");
  if (banner) banner.className = `cc35-service-banner ${meta.bannerClass}`.trim();
}

function generationServiceTone(status = "") {
  if (status === "ready") return { tagClass: "ok", bannerClass: "ok" };
  if (status === "degraded" || status === "busy") return { tagClass: "warn", bannerClass: "warn" };
  if (status === "unstable" || status === "unavailable") return { tagClass: "error", bannerClass: "error" };
  return { tagClass: "blue", bannerClass: "" };
}

async function loadInputs() {
  setMessage("正在读取活动和参考素材...", "");
  try {
    const [campaigns, materials] = await Promise.all([
      apiJson("/api/simple-agent/campaigns?limit=120"),
      apiJson("/api/simple-agent/materials?limit=160"),
    ]);
    state.campaigns = campaigns.items || [];
    state.materials = materials.items || [];
    state.selectedMaterialIds = new Set(state.materials.filter((item) => item.selected).slice(0, 3).map((item) => Number(item.id)));
    renderCampaignSelect();
    renderMaterialPicker();
    updateSummary();
    setMessage("");
  } catch (error) {
    setMessage(error.message || "读取失败", "error");
  }
}

async function loadLatestResults(options = {}) {
  try {
    const data = await apiJson("/api/simple-agent/scripts?limit=30");
    state.historyJobs = data.jobs || [];
    renderJobHistory();
    const items = data.items || [];
    if (!items.length) {
      if (options.silent === false) setMessage("历史任务已刷新。", "ok");
      return;
    }
    const latestJobId = items[0]?.jobId;
    const latestItems = latestJobId ? items.filter((item) => item.jobId === latestJobId) : items.slice(0, 3);
    if (!state.selectedHistoryJobId) {
      renderResults(latestItems, { latest: true, jobId: latestJobId });
    }
    if (options.silent === false) setMessage("历史任务已刷新。", "ok");
  } catch (error) {
    if (options.silent === false) setMessage(error.message || "历史任务刷新失败", "error");
    // The generate form remains usable even if recent results fail to load.
  }
}

function renderCampaignSelect() {
  const select = $("#campaignSelect");
  const items = [...state.campaigns].sort((a, b) => Number(b.selected) - Number(a.selected));
  select.innerHTML = items.length
    ? items.map((item) => `<option value="${item.id}">${escapeHtml(item.productName || item.campaignName || "未命名活动")}</option>`).join("")
    : `<option value="">请先新增品牌活动</option>`;
}

function renderMaterialPicker() {
  const rows = state.materials.filter((item) => item.selected || state.selectedMaterialIds.has(Number(item.id)));
  $("#materialPickerRows").innerHTML = rows.length ? rows.map((item) => {
    const checked = state.selectedMaterialIds.has(Number(item.id)) ? "checked" : "";
    return `
      <tr>
        <td><input type="checkbox" value="${item.id}" ${checked} /></td>
        <td><span class="cc35-material-name"><strong>${escapeHtml(item.title || "未命名素材")}</strong><small>${escapeHtml((item.tags || []).slice(0, 3).map((tag) => `#${tag}`).join(" ") || "未打标签")}</small></span></td>
        <td><span class="cc35-platform-pill ${normalizePlatform(item.platform)}">${escapeHtml(platformLabel(item.platform))}</span></td>
        <td>${escapeHtml((item.tags || []).slice(0, 3).join("，") || item.category || "-")}</td>
      </tr>
    `;
  }).join("") : `<tr><td colspan="4"><div class="cc35-empty">暂无已加入脚本参考的素材，请先到素材库加入参考。</div></td></tr>`;
  updateMaterialButton();
}

function openMaterialPicker() {
  renderMaterialPicker();
  $("#materialPickerModal").hidden = false;
}

function confirmMaterialPicker() {
  state.selectedMaterialIds = new Set($$("#materialPickerRows input[type='checkbox']:checked").map((input) => Number(input.value)));
  closeModal("materialPickerModal");
  updateMaterialButton();
  updateSummary();
}

function closeModal(id) {
  const node = $(`#${id}`);
  if (node) node.hidden = true;
}

function updateMaterialButton() {
  const count = state.selectedMaterialIds.size;
  $("#openMaterialPicker").textContent = count ? `${count} 条素材已选` : "选择参考素材";
}

function selectedCampaign() {
  const id = Number($("#campaignSelect")?.value || 0);
  return state.campaigns.find((item) => Number(item.id) === id) || null;
}

function selectedMaterials() {
  return state.materials.filter((item) => state.selectedMaterialIds.has(Number(item.id)));
}

function updateSummary() {
  const campaign = selectedCampaign();
  const materials = selectedMaterials();
  $("#summaryCampaign").textContent = campaign
    ? `${campaign.productName || campaign.campaignName} ｜ 价格边界：${campaign.priceNote || "待补"} ｜ 渠道范围：${campaign.channelScope || "待补"}`
    : "等待选择活动";
  $("#summaryMaterials").textContent = materials.length
    ? `${materials.length} 条素材：${materials.slice(0, 3).map((item) => item.title || `素材 ${item.id}`).join("，")}`
    : "等待选择素材";
}

async function runGenerate() {
  const campaign = selectedCampaign();
  const materials = selectedMaterials();
  if (!campaign) {
    setMessage("请先选择品牌活动。", "error");
    return;
  }
  if (!materials.length) {
    setMessage("请至少选择 1 条参考素材。", "error");
    return;
  }
  const topic = $("#topicInput").value.trim() || (campaign.productName || campaign.campaignName || "本次活动脚本");
  const targetCount = normalizeTargetCount();
  const button = $("#runGenerate");
  button.disabled = true;
  button.textContent = "创建任务中...";
  setMessage("正在创建生成任务...", "");
  try {
    const data = await apiJson("/api/simple-agent/generate-task", {
      method: "POST",
      body: JSON.stringify({
        topic,
        targetCount,
        outputMode: $("#styleSelect").value,
        qualityLevel: "high",
        campaignIds: [campaign.id],
        materialIds: materials.map((item) => item.id),
        manualFeedback: $("#extraInput").value.trim(),
        avoidRules: "不写全网最低，不承诺一定有货。",
      }),
    });
    const jobId = data.job?.id || data.jobId;
    if (!jobId) throw new Error("生成任务创建失败");
    addActiveJob(data.job || { id: Number(jobId), status: "running", topic });
    upsertHistoryJob(data.job || { id: Number(jobId), status: "running", topic });
    setMessage(
      data.deduplicated
        ? `已有相同任务 #${jobId} 正在生成，已切换到该任务。`
        : "生成任务已创建，可以继续新建任务或处理其他工作。",
      "ok"
    );
    ensureJobPolling();
  } catch (error) {
    setMessage(error.message || "生成失败", "error");
  } finally {
    button.disabled = false;
    button.textContent = "生成脚本";
  }
}

function normalizeTargetCount() {
  const input = $("#countInput");
  const raw = Number(input?.value || 3);
  const count = Math.max(1, Math.min(Math.floor(Number.isFinite(raw) ? raw : 3), MAX_TARGET_COUNT));
  if (input) input.value = String(count);
  return count;
}

function sanitizeTargetCountInput() {
  const input = $("#countInput");
  if (!input || input.value === "") return;
  const raw = Number(input.value);
  if (!Number.isFinite(raw)) {
    input.value = "3";
    return;
  }
  const count = Math.max(1, Math.min(Math.floor(raw), MAX_TARGET_COUNT));
  if (String(count) !== input.value) input.value = String(count);
}

async function resumeActiveJob() {
  const storedIds = readStoredJobIds();
  storedIds.forEach((jobId) => state.activeJobIds.add(jobId));
  try {
    const data = await apiJson("/api/simple-agent/scripts?limit=10");
    (data.jobs || [])
      .filter((job) => job.status === "running")
      .forEach((job) => addActiveJob(job, { persist: false }));
  } catch (error) {
    // Recent results still render normally if task restoration fails.
  }
  if (state.activeJobIds.size) ensureJobPolling();
}

function addActiveJob(job = {}, options = {}) {
  const id = Number(job.id || 0);
  if (!id) return;
  state.activeJobIds.add(id);
  state.jobs.set(id, { ...(state.jobs.get(id) || {}), ...job });
  if (options.persist !== false) persistActiveJobs();
  renderJobList();
}

function readStoredJobIds() {
  try {
    const ids = JSON.parse(localStorage.getItem("simpleAgentActiveGenerationJobIds") || "[]");
    if (Array.isArray(ids)) return ids.map(Number).filter(Boolean);
  } catch (error) {
    // Fall through to old single-task key migration.
  }
  const legacyId = Number(localStorage.getItem("simpleAgentActiveGenerationJobId") || 0);
  if (legacyId) {
    localStorage.removeItem("simpleAgentActiveGenerationJobId");
    return [legacyId];
  }
  return [];
}

function persistActiveJobs() {
  localStorage.setItem("simpleAgentActiveGenerationJobIds", JSON.stringify([...state.activeJobIds]));
}

function ensureJobPolling() {
  if (state.jobPollTimer) return;
  pollAllGenerationJobs();
  state.jobPollTimer = window.setInterval(pollAllGenerationJobs, 2500);
}

function stopJobPolling() {
  if (state.jobPollTimer) window.clearInterval(state.jobPollTimer);
  state.jobPollTimer = null;
}

function pollAllGenerationJobs() {
  const ids = [...state.activeJobIds];
  if (!ids.length) {
    stopJobPolling();
    return;
  }
  ids.forEach((jobId) => pollGenerationJob(jobId));
}

async function pollGenerationJob(jobId) {
  try {
    const data = await apiJson(`/api/simple-agent/generation-jobs/${jobId}`);
    state.jobs.set(Number(jobId), data.job || { id: jobId });
    if (data.job?.status === "done") {
      state.activeJobIds.delete(Number(jobId));
      persistActiveJobs();
      upsertHistoryJob(data.job);
      state.selectedHistoryJobId = Number(jobId);
      renderJobList();
      renderResults(data.outputs || [], { job: data.job });
      setMessage(`任务 #${jobId} 已完成，结果已保留在下方。`, "ok");
      loadLatestResults();
      return;
    }
    if (data.job?.status === "failed") {
      state.activeJobIds.delete(Number(jobId));
      persistActiveJobs();
      upsertHistoryJob(data.job);
      renderJobList();
      const error = data.job?.log?.error || "生成失败，请稍后重试。";
      loadGenerationServiceHealth({ silent: true });
      setMessage(`任务 #${jobId} 失败：${error}`, "error");
      loadLatestResults();
      return;
    }
    upsertHistoryJob(data.job);
    renderJobList();
  } catch (error) {
    loadGenerationServiceHealth({ silent: true });
    setMessage(error.message || "任务状态读取失败", "error");
  }
}

function renderJobList() {
  const panel = $("#generationJobPanel");
  if (!panel) return;
  const jobs = [...state.jobs.values()]
    .filter((job) => job?.id && (state.activeJobIds.has(Number(job.id)) || ["running", "failed"].includes(job.status)))
    .sort((a, b) => Number(b.id) - Number(a.id));
  panel.hidden = !jobs.length;
  $("#generationJobList").innerHTML = jobs.map(jobCardHtml).join("");
}

function jobCardHtml(job = {}) {
  const status = job.status || "running";
  const log = job.log || {};
  return `
    <article class="cc35-job-card">
      <div class="cc35-job-head">
        <div>
          <strong>生成任务 #${escapeHtml(job.id || "-")}${job.topic ? `：${escapeHtml(job.topic)}` : ""}</strong>
          <span>${job.createdAt ? `创建时间 ${escapeHtml(formatShortTime(job.createdAt))}` : "可以切换页面，回来后继续查看结果。"}</span>
        </div>
        <span class="cc35-tag ${jobStatusTone(status)}">${escapeHtml(jobStatusLabel(status))}</span>
      </div>
      <div class="cc35-job-progress"><span style="width: ${escapeHtml(jobProgress(status, log))}"></span></div>
      <p>${escapeHtml(jobStatusNote(status, log))}</p>
    </article>
  `;
}

function jobStatusLabel(status) {
  if (status === "done") return "已完成";
  if (status === "failed") return "失败";
  return "生成中";
}

function jobStatusTone(status) {
  if (status === "done") return "ok";
  if (status === "failed") return "error";
  return "blue";
}

function jobProgress(status, log = {}) {
  if (status === "done") return "100%";
  if (status === "failed") return "100%";
  if (log.status === "running") return "64%";
  return "28%";
}

function jobStatusNote(status, log = {}) {
  if (status === "done") return "任务已完成，生成结果已更新。";
  if (status === "failed") return explainJobFailure(log.error || "").summary;
  if (log.provider) return `正在调用 ${log.provider} 生成脚本，可以先切换到其他页面。`;
  return "任务已创建，正在生成脚本。";
}

function formatShortTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function upsertHistoryJob(job = {}) {
  const id = Number(job?.id || 0);
  if (!id) return;
  const current = state.historyJobs.filter((item) => Number(item.id) !== id);
  state.historyJobs = [{ ...job, id }, ...current]
    .sort((a, b) => Number(b.id) - Number(a.id))
    .slice(0, 30);
  renderJobHistory();
}

function renderJobHistory() {
  const node = $("#generationHistoryList");
  if (!node) return;
  const jobs = state.historyJobs || [];
  if (!jobs.length) {
    node.innerHTML = `<div class="cc35-empty">暂无历史任务。</div>`;
    return;
  }
  node.innerHTML = jobs.map((job) => {
    const selected = Number(job.id) === Number(state.selectedHistoryJobId);
    const snapshot = job.inputSnapshot || {};
    const materials = Array.isArray(snapshot.materials) ? snapshot.materials.length : 0;
    const campaigns = Array.isArray(snapshot.campaigns) ? snapshot.campaigns.length : 0;
    const failureMeta = job.status === "failed" ? explainJobFailure(job.log?.error || "") : null;
    const meta = [
      job.createdAt ? formatShortTime(job.createdAt) : "",
      job.targetCount ? `${job.targetCount} 条` : "",
      job.outputMode || "",
      campaigns ? `${campaigns} 个活动` : "",
      materials ? `${materials} 条素材` : "",
    ].filter(Boolean).join(" · ");
    return `
      <button class="cc35-history-item ${selected ? "active" : ""}" type="button" data-job-id="${escapeHtml(job.id)}">
        <span class="cc35-history-main">
          <strong>#${escapeHtml(job.id)} ${escapeHtml(job.topic || "未命名任务")}</strong>
          <small>${escapeHtml(meta || "点击查看任务结果")}</small>
          ${failureMeta ? `<em class="cc35-history-error">失败原因：${escapeHtml(failureMeta.summary)}</em>` : ""}
          ${failureMeta ? `<span class="cc35-history-tip ${escapeHtml(failureMeta.tone)}">${escapeHtml(failureMeta.action)}</span>` : ""}
        </span>
        <span class="cc35-history-side">
          <span class="cc35-tag ${jobStatusTone(job.status)}">${escapeHtml(jobStatusLabel(job.status))}</span>
          ${failureMeta ? `<span class="cc35-tag ${escapeHtml(failureMeta.tagClass)}">${escapeHtml(failureMeta.badge)}</span>` : ""}
          ${job.status === "failed" ? `<span class="cc35-history-retry" role="button" tabindex="0" data-retry-job-id="${escapeHtml(job.id)}">重试</span>` : ""}
        </span>
      </button>
    `;
  }).join("");
}

function cleanJobError(message = "") {
  return explainJobFailure(message).summary;
}

function explainJobFailure(message = "") {
  const raw = String(message || "").trim();
  if (!raw) {
    return {
      badge: "待重试",
      summary: "生成服务没有返回具体原因，请稍后重试。",
      action: "建议先直接重试一次；如果连续失败，再检查上游服务状态。",
      tone: "neutral",
      tagClass: "warn",
      category: "unknown",
      raw,
    };
  }
  if (/timed out|timeout/i.test(raw)) {
    return {
      badge: "超时",
      summary: "生成服务响应超时，本轮等待过久后中断。",
      action: "建议先重试；如果连续超时，改成更少条数或换更轻的生成风格。",
      tone: "warn",
      tagClass: "warn",
      category: "timeout",
      raw,
    };
  }
  if (/暂不可用|temporarily unavailable|service unavailable|503/i.test(raw)) {
    return {
      badge: "服务波动",
      summary: "上游 AI 对话服务暂时不可用。",
      action: "建议稍后重试；这类问题通常不是素材或活动信息本身导致。",
      tone: "error",
      tagClass: "error",
      category: "unavailable",
      raw,
    };
  }
  if (/参数|json|scripts 数组|格式不正确|数量不正确/i.test(raw)) {
    return {
      badge: "结果异常",
      summary: "上游返回了不可用结果，没能完成脚本解析。",
      action: "建议重试一次；如果反复出现，记录任务号给技术排查返回格式。",
      tone: "warn",
      tagClass: "blue",
      category: "invalid_response",
      raw,
    };
  }
  const summary = raw.length > 120 ? `${raw.slice(0, 120)}...` : raw;
  return {
    badge: "失败",
    summary,
    action: "建议先重试；如果同类任务持续失败，再继续排查服务端日志。",
    tone: "neutral",
    tagClass: "error",
    category: "other",
    raw,
  };
}

async function retryGenerationJob(jobId, button) {
  if (!jobId) return;
  const originalText = button?.textContent || "重试";
  if (button) {
    button.textContent = "重试中";
    button.setAttribute("aria-disabled", "true");
  }
  setMessage(`正在重试任务 #${jobId}...`, "");
  try {
    const data = await apiJson(`/api/simple-agent/generation-jobs/${jobId}/retry`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    const newJob = data.job || {};
    if (!newJob.id) throw new Error("重试任务创建失败");
    state.jobs.set(Number(newJob.id), newJob);
    state.activeJobIds.add(Number(newJob.id));
    state.selectedHistoryJobId = Number(newJob.id);
    persistActiveJobs();
    upsertHistoryJob(newJob);
    renderJobList();
    renderResults([], { job: newJob });
    setMessage(`已创建重试任务 #${newJob.id}，可以先处理其他工作。`, "ok");
    ensureJobPolling();
  } catch (error) {
    setMessage(error.message || "重试失败", "error");
  } finally {
    if (button) {
      button.textContent = originalText;
      button.removeAttribute("aria-disabled");
    }
  }
}

async function openGenerationJob(jobId) {
  if (!jobId) return;
  setMessage(`正在打开任务 #${jobId}...`, "");
  try {
    const data = await apiJson(`/api/simple-agent/generation-jobs/${jobId}`);
    state.selectedHistoryJobId = Number(jobId);
    upsertHistoryJob(data.job || { id: jobId });
    renderJobHistory();
    renderResults(data.outputs || [], { job: data.job });
    const count = (data.outputs || []).length;
    setMessage(count ? `已打开任务 #${jobId}，共 ${count} 条脚本。` : `已打开任务 #${jobId}，这个任务暂无脚本结果。`, count ? "ok" : "");
  } catch (error) {
    setMessage(error.message || "任务读取失败", "error");
  }
}

function renderResults(items, options = {}) {
  if (!items.length) {
    const jobLabel = options.job?.id ? `任务 #${options.job.id}` : "当前任务";
    if (options.job?.status === "failed") {
      const failure = explainJobFailure(options.job?.log?.error || "");
      $("#resultList").innerHTML = `
        <article class="cc35-result-card cc35-result-diagnostic">
          <div class="cc35-result-head">
            <h3>${escapeHtml(jobLabel)} 生成失败</h3>
            <span class="cc35-tag ${escapeHtml(failure.tagClass)}">${escapeHtml(failure.badge)}</span>
          </div>
          <p class="cc35-result-body">${escapeHtml(failure.summary)}</p>
          <div class="cc35-diagnostic-grid">
            <div>
              <strong>建议处理</strong>
              <p>${escapeHtml(failure.action)}</p>
            </div>
            <div>
              <strong>原始提示</strong>
              <p>${escapeHtml(cleanJobError(options.job?.log?.error || ""))}</p>
            </div>
          </div>
        </article>
      `;
      return;
    }
    $("#resultList").innerHTML = `<div class="cc35-empty">${escapeHtml(jobLabel)}没有返回脚本结果。</div>`;
    return;
  }
  const badgeText = options.job?.id ? `任务 #${options.job.id}` : (options.latest ? "最近生成" : "已生成");
  $("#resultList").innerHTML = items.map((item, index) => `
    <article class="cc35-result-card">
      <div class="cc35-result-head">
        <h3>${escapeHtml(item.title || `脚本 ${index + 1}`)}</h3>
        <span class="cc35-tag ok">${escapeHtml(badgeText)}</span>
      </div>
      ${scriptBodyHtml(item)}
      <div class="cc35-result-actions">
        <button class="cc35-btn primary" type="button">采用脚本</button>
        <button class="cc35-btn" type="button">标记待改</button>
        <button class="cc35-btn" type="button">重新生成</button>
      </div>
    </article>
  `).join("");
}

function scriptBodyHtml(item) {
  const scenes = extractScenes(item);
  if (!scenes.length) {
    return `<p class="cc35-result-body">${escapeHtml(item.scriptBody || item.hook || JSON.stringify(item.output || item.outputJson || {}, null, 2))}</p>`;
  }
  return `
    <div class="cc35-script-table" role="table" aria-label="分镜脚本">
      <div class="cc35-script-row head" role="row">
        <span>时间</span>
        <span>镜头</span>
        <span>口播</span>
        <span>字幕</span>
      </div>
      ${scenes.map((scene) => `
        <div class="cc35-script-row" role="row">
          <strong>${escapeHtml(scene.time || "-")}</strong>
          <span>${escapeHtml(scene.shot || "-")}</span>
          <span>${escapeHtml(scene.voiceover || "-")}</span>
          <span>${escapeHtml(scene.subtitle || "-")}</span>
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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
