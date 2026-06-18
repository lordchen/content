const CONTENT_API_BASE = "http://127.0.0.1:8771";

const contentPoolStatus = document.getElementById("contentPoolStatus");
const contentPoolList = document.getElementById("contentPoolList");
const importMessage = document.getElementById("contentImportMessage");
const batchResult = document.getElementById("contentBatchResult");
const bulkResult = document.getElementById("contentBulkResult");
const singlePreview = document.getElementById("contentSinglePreview");
const batchPreview = document.getElementById("contentBatchPreview");
const batchTemplatePanel = document.getElementById("batchTemplatePanel");
const thirdPartyReadinessPanel = document.getElementById("thirdPartyReadinessPanel");
const sourceTaskBrief = document.getElementById("sourceTaskBrief");
const r2InputPackage = document.getElementById("r2InputPackage");
const p01ImportGuide = document.getElementById("p01ImportGuide");
const transcriptImportPanel = document.getElementById("transcriptImportPanel");
const postImportNextPanel = document.getElementById("postImportNextPanel");
const subtitleHealthPanel = document.getElementById("subtitleHealthPanel");
const subtitleReadinessPanel = document.getElementById("subtitleReadinessPanel");
const benchmarkAccountList = document.getElementById("benchmarkAccountList");
const benchmarkAccountMessage = document.getElementById("benchmarkAccountMessage");
const benchmarkUpdateList = document.getElementById("benchmarkUpdateList");
const saveContentSourceBtn = document.getElementById("saveContentSource");
const batchContentSourceBtn = document.getElementById("batchContentSource");
const saveBenchmarkAccountBtn = document.getElementById("saveBenchmarkAccount");
const refreshBenchmarkAccountsBtn = document.getElementById("refreshBenchmarkAccounts");
const bulkSelectContentSourcesBtn = document.getElementById("bulkSelectContentSources");
const bulkSubtitleJobsBtn = document.getElementById("bulkSubtitleJobs");
const bulkStructureContentSourcesBtn = document.getElementById("bulkStructureContentSources");
let batchPreviewTimer = 0;
let batchPreviewRequestId = 0;
let latestBatchPreview = null;
let batchPreviewChecking = false;
let singlePreviewTimer = 0;
let singlePreviewRequestId = 0;
let batchTemplateData = null;
let activeBenchmarkTaskId = "";
let activeR2Slot = "";
let benchmarkUpdateTaskItems = [];
let modulePrimaryPackage = null;
let r2InputVerifier = null;
let p01AcceptanceVerifier = null;
const initialContentParams = new URLSearchParams(window.location.search);
const initialBenchmarkTaskId = initialContentParams.get("benchmarkTaskId") || "";
const initialReturnTo = initialContentParams.get("returnTo") || "";
const isP01VerifierReturn = initialReturnTo === "p01_verifier";

saveContentSourceBtn?.addEventListener("click", () => saveContentSource());
batchContentSourceBtn?.addEventListener("click", () => batchContentSources());
saveBenchmarkAccountBtn?.addEventListener("click", () => saveBenchmarkAccount());
refreshBenchmarkAccountsBtn?.addEventListener("click", () => {
  loadBenchmarkAccounts();
  loadBenchmarkUpdateTasks();
});
bulkSelectContentSourcesBtn?.addEventListener("click", () => bulkSelectContentSources());
bulkSubtitleJobsBtn?.addEventListener("click", () => bulkCreateSubtitleJobs());
bulkStructureContentSourcesBtn?.addEventListener("click", () => bulkStructureContentSources());
document.getElementById("contentBatchText")?.addEventListener("input", () => renderBatchPreview());
["contentTitle", "contentPlatform", "contentUrl", "contentAccount", "contentRawText"].forEach((id) => {
  document.getElementById(id)?.addEventListener("input", () => renderSinglePreview());
  document.getElementById(id)?.addEventListener("change", () => renderSinglePreview());
});
batchTemplatePanel?.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-template-action]");
  if (!actionButton) return;
  handleBatchTemplateAction(actionButton.dataset.templateAction);
});
sourceTaskBrief?.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-source-task-action]");
  if (!actionButton) return;
  handleSourceTaskAction(actionButton.dataset.sourceTaskAction);
});
transcriptImportPanel?.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-transcript-import]");
  if (!actionButton) return;
  handleTranscriptImportAction(actionButton.dataset.transcriptImport);
});
batchResult?.addEventListener("click", (event) => {
  if (event.target.closest("[data-batch-next-select]")) {
    bulkSelectContentSources();
    return;
  }
  if (event.target.closest("[data-batch-scroll-pool]")) {
    document.getElementById("contentPoolList")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});
postImportNextPanel?.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-next-action]");
  if (!actionButton) return;
  handlePostImportAction(
    actionButton.dataset.nextAction,
    actionButton.dataset.nextSourceId || actionButton.dataset.nextTaskId || "",
    actionButton,
  );
});
contentPoolList?.addEventListener("click", (event) => {
  const guideButton = event.target.closest("[data-source-guide-action]");
  if (guideButton) {
    handleSourceGuideAction(guideButton);
    return;
  }
  const selectButton = event.target.closest("[data-content-select]");
  if (selectButton) {
    toggleContentSource(selectButton);
    return;
  }
  const structureButton = event.target.closest("[data-content-structure]");
  if (structureButton) {
    structureContentSource(structureButton);
    return;
  }
  const subtitleButton = event.target.closest("[data-content-subtitle]");
  if (subtitleButton) {
    saveSubtitleText(subtitleButton);
    return;
  }
  const subtitleJobButton = event.target.closest("[data-content-subtitle-job]");
  if (subtitleJobButton) createSubtitleJob(subtitleJobButton);
});
subtitleReadinessPanel?.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-readiness-action]");
  if (!actionButton) return;
  handleSubtitleReadinessAction(actionButton);
});
thirdPartyReadinessPanel?.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-third-party-action]");
  if (!actionButton) return;
  handleThirdPartyAction(actionButton);
});
r2InputPackage?.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-r2-action]");
  if (!actionButton) return;
  handleR2PackageAction(actionButton.dataset.r2Action);
});
benchmarkUpdateList?.addEventListener("click", (event) => {
  const importButton = event.target.closest("[data-benchmark-import]");
  if (importButton) {
    prefillBenchmarkImport(importButton.dataset.benchmarkImport);
    return;
  }
  const blankTemplateButton = event.target.closest("[data-benchmark-blank-template]");
  if (blankTemplateButton) {
    fillBenchmarkBlankTemplate(blankTemplateButton.dataset.benchmarkBlankTemplate, blankTemplateButton.dataset.templateMode || "fill");
    return;
  }
  const batchImportButton = event.target.closest("[data-benchmark-batch-import]");
  if (batchImportButton) {
    prefillBenchmarkBatchImport(batchImportButton.dataset.benchmarkBatchImport);
    return;
  }
  const p01ActionButton = event.target.closest("[data-benchmark-p01-action]");
  if (p01ActionButton) {
    runBenchmarkP01Action(p01ActionButton);
    return;
  }
  const skipButton = event.target.closest("[data-benchmark-skip]");
  if (skipButton) {
    updateBenchmarkTask(skipButton.dataset.benchmarkSkip, "skipped");
    return;
  }
  const restoreButton = event.target.closest("[data-benchmark-restore]");
  if (restoreButton) {
    updateBenchmarkTask(restoreButton.dataset.benchmarkRestore, "pending");
    return;
  }
  const selectButton = event.target.closest("[data-benchmark-select]");
  if (selectButton) {
    bulkSelectBenchmarkTaskSources(selectButton.dataset.benchmarkSelect);
    return;
  }
  const structureButton = event.target.closest("[data-benchmark-structure]");
  if (structureButton) {
    bulkStructureBenchmarkTaskSources(structureButton.dataset.benchmarkStructure);
    return;
  }
  const subtitleButton = event.target.closest("[data-benchmark-subtitle]");
  if (subtitleButton) {
    bulkSubtitleBenchmarkTaskSources(subtitleButton.dataset.benchmarkSubtitle);
    return;
  }
  const sourceOpenButton = event.target.closest("[data-benchmark-source-open]");
  if (sourceOpenButton) {
    scrollToContentSource(sourceOpenButton.dataset.benchmarkSourceOpen, true);
    return;
  }
  const sourceSubtitleButton = event.target.closest("[data-benchmark-source-subtitle]");
  if (sourceSubtitleButton) {
    runBenchmarkSourceAction(sourceSubtitleButton, "subtitle");
    return;
  }
  const sourceSelectButton = event.target.closest("[data-benchmark-source-select]");
  if (sourceSelectButton) {
    runBenchmarkSourceAction(sourceSelectButton, "select");
    return;
  }
  const sourceStructureButton = event.target.closest("[data-benchmark-source-structure]");
  if (sourceStructureButton) {
    runBenchmarkSourceAction(sourceStructureButton, "structure");
    return;
  }
  const generateButton = event.target.closest("[data-benchmark-generate]");
  if (generateButton) {
    window.location.href = "./index.html?v=benchmark-task-generate-v1#stepGenerate";
  }
});

prefillManualImportFromUrl();
renderP01ImportGuide();
renderSinglePreview();
renderBatchPreview();
loadContentPoolDashboardContext();
loadBatchTemplate();
loadSubtitleHealth();
loadBenchmarkAccounts();
loadBenchmarkUpdateTasks();
loadContentSources();

async function loadContentPoolDashboardContext() {
  if (!p01ImportGuide && !r2InputPackage) return;
  try {
    const response = await fetch(`${CONTENT_API_BASE}/api/v2/dashboard`);
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    const primaryPackage = data.v2ModuleBoard?.primaryPackage || null;
    modulePrimaryPackage = primaryPackage?.moduleTitle === "对标内容池" ? primaryPackage : null;
    r2InputVerifier = data.r2InputVerifier || null;
    p01AcceptanceVerifier = data.p01AcceptanceVerifier || null;
  } catch (error) {
    modulePrimaryPackage = null;
    r2InputVerifier = null;
    p01AcceptanceVerifier = null;
  }
  renderR2InputPackage();
  renderP01ImportGuide(benchmarkUpdateTaskItems.find((item) => String(item.id) === String(activeBenchmarkTaskId || initialBenchmarkTaskId)));
}

async function fetchR2VerifierSnapshot() {
  const response = await fetch(`${CONTENT_API_BASE}/api/v2/dashboard`);
  const data = await response.json();
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return data.r2InputVerifier || null;
}

function r2StructureCheck(verifier) {
  return (verifier?.checks || []).find((item) => item.key === "real_structures") || {};
}

function r2ProgressSnapshot(verifier) {
  const structureCheck = r2StructureCheck(verifier);
  const candidates = Array.isArray(verifier?.candidateSources) ? verifier.candidateSources : [];
  return {
    level: verifier?.level || "unknown",
    label: verifier?.levelLabel || "R2 状态待判断",
    actual: Number(structureCheck.actual || 0),
    target: Number(structureCheck.target || 3),
    candidateCount: candidates.length,
    readyCount: candidates.filter((item) => item.status === "ready").length,
    needsSelect: candidates.filter((item) => item.status === "needs_select").length,
    needsText: candidates.filter((item) => item.status === "needs_text").length,
    needsStructure: candidates.filter((item) => item.status === "needs_structure").length,
    excluded: candidates.filter((item) => item.status === "excluded").length,
    nextAction: verifier?.nextAction || structureCheck.action || "补齐真实结构素材",
    evidence: structureCheck.evidence || "",
  };
}

function r2ProgressExplanation(after, actionLabel) {
  if (!after.candidateCount) {
    return `${actionLabel}后仍没有可处理的真实候选素材。先导入真实对标视频/笔记，或粘贴旧字幕项目结果。`;
  }
  const parts = [];
  if (after.needsSelect) parts.push(`${after.needsSelect} 条未加入生成`);
  if (after.needsText) parts.push(`${after.needsText} 条缺字幕/正文`);
  if (after.needsStructure) parts.push(`${after.needsStructure} 条待结构化`);
  if (after.excluded) parts.push(`${after.excluded} 条不计入真实闭环`);
  if (!parts.length && after.actual < after.target) parts.push("候选素材不足 3 条");
  return parts.length
    ? `${actionLabel}后仍未达标：${parts.join("；")}。`
    : `${actionLabel}后 R2 结构素材已达标，可以进入脚本流程。`;
}

function renderR2ProgressFeedback(beforeVerifier, afterVerifier, actionLabel, actionData = null) {
  if (!bulkResult || !afterVerifier) return;
  const before = r2ProgressSnapshot(beforeVerifier);
  const after = r2ProgressSnapshot(afterVerifier);
  const success = Number(actionData?.success || 0);
  const failed = Number(actionData?.failed || 0);
  const skipped = Number(actionData?.skipped || 0);
  const reached = after.actual >= after.target;
  const stateClass = reached ? "ok" : after.actual > before.actual || success ? "skipped" : "failed";
  const html = `
    <article class="r2-progress-feedback ${stateClass}">
      <div class="r2-progress-feedback-head">
        <span>R2 动作反馈</span>
        <strong>${escapeHtml(actionLabel)}：真实结构素材 ${before.actual}/${before.target} → ${after.actual}/${after.target}</strong>
        <p>${escapeHtml(r2ProgressExplanation(after, actionLabel))}</p>
      </div>
      <div class="r2-progress-feedback-grid">
        <div><b>候选素材</b><strong>${before.candidateCount} → ${after.candidateCount}</strong></div>
        <div><b>可进入生成</b><strong>${before.readyCount} → ${after.readyCount}</strong></div>
        <div><b>待加入</b><strong>${before.needsSelect} → ${after.needsSelect}</strong></div>
        <div><b>待结构化</b><strong>${before.needsStructure} → ${after.needsStructure}</strong></div>
        <div><b>缺字幕正文</b><strong>${before.needsText} → ${after.needsText}</strong></div>
        <div><b>本次处理</b><strong>${success} 成功 / ${failed} 失败 / ${skipped} 跳过</strong></div>
      </div>
      <p class="r2-progress-feedback-next">${escapeHtml(after.evidence || after.nextAction)}</p>
    </article>
  `;
  bulkResult.insertAdjacentHTML("afterbegin", html);
}

async function loadSubtitleHealth() {
  if (!subtitleHealthPanel) return;
  try {
    const response = await fetch(`${CONTENT_API_BASE}/api/v2/subtitle-service/health`);
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    renderSubtitleHealth(data);
  } catch (error) {
    renderSubtitleHealth({
      status: "error",
      statusLabel: "检测失败",
      summary: `字幕服务检测失败：${error.message}`,
      nextAction: "继续使用手工字幕兜底，稍后再排查本地服务。",
      fallbackAction: "粘贴旧字幕项目结果或手工字幕后继续结构化。",
    });
  }
}

function renderSubtitleHealth(data) {
  if (!subtitleHealthPanel) return;
  const status = data.status || "unknown";
  const statusLabel = data.statusLabel || subtitleServiceStatusText(status);
  subtitleHealthPanel.className = `subtitle-health-panel ${escapeHtml(status)}`;
  subtitleHealthPanel.innerHTML = `
    <div>
      <span>${escapeHtml(statusLabel)}</span>
      <strong>${escapeHtml(data.summary || "等待字幕服务检测结果。")}</strong>
    </div>
    <dl>
      <div><dt>服务地址</dt><dd>${escapeHtml(data.apiBase || "未配置")}</dd></div>
      <div><dt>默认引擎</dt><dd>${escapeHtml(data.engine || "auto")}</dd></div>
      <div><dt>下一步</dt><dd>${escapeHtml(data.nextAction || "先检测服务，再决定自动或手工字幕。")}</dd></div>
      <div><dt>兜底动作</dt><dd>${escapeHtml(data.fallbackAction || "自动字幕不可用时，粘贴手工字幕继续生产。")}</dd></div>
    </dl>
    ${data.evidence ? `<small>检测证据：${escapeHtml(truncateText(data.evidence, 220))}</small>` : ""}
  `;
}

function subtitleServiceStatusText(value) {
  return {
    healthy: "字幕服务可用",
    offline: "服务未连接",
    wrong_service: "端口不是字幕服务",
    unexpected_response: "健康返回异常",
    http_error: "健康检查失败",
    error: "检测失败",
    unknown: "待检测",
  }[value] || "待检测";
}

function prefillManualImportFromUrl() {
  const params = initialContentParams;
  const benchmarkTaskId = params.get("benchmarkTaskId") || "";
  const r2Slot = params.get("r2Slot") || "";
  if (r2Slot) activeR2Slot = String(r2Slot);
  if (benchmarkTaskId) {
    activeBenchmarkTaskId = String(benchmarkTaskId);
    const benchmarkTaskEl = document.getElementById("benchmarkUpdateTaskId");
    if (benchmarkTaskEl) benchmarkTaskEl.value = benchmarkTaskId;
  }
  if (!params.has("importPlatform") && !params.has("importNote")) return;
  const platform = params.get("importPlatform") || "manual";
  const importMode = params.get("importMode") || "single";
  const importPath = params.get("importPath") || "";
  const version = params.get("v") || "";
  const title = params.get("importTitle") || "";
  const url = params.get("importUrl") || "";
  const account = params.get("importAccount") || "";
  const note = params.get("importNote") || "";
  const platformEl = document.getElementById("contentPlatform");
  const titleEl = document.getElementById("contentTitle");
  const urlEl = document.getElementById("contentUrl");
  const accountEl = document.getElementById("contentAccount");
  const rawTextEl = document.getElementById("contentRawText");
  const shouldPrefillRawText = !importPath && !params.get("v")?.startsWith("first-real-material");
  if (platformEl) platformEl.value = platform;
  if (titleEl) titleEl.value = title;
  if (urlEl) urlEl.value = url;
  if (accountEl) accountEl.value = account;
  if (rawTextEl) {
    if (shouldPrefillRawText) rawTextEl.value = note;
    if (importPath) rawTextEl.placeholder = importPathRawTextPlaceholder(importPath);
  }
  renderSourceTaskBrief({ platform, importMode, importPath, title, account, note, r2Slot });
  renderR2InputPackage();
  if (importMode === "batch") {
    const batchEl = document.getElementById("contentBatchText");
    const taskSheetText = currentSprintTaskSheetText(version, importPath, platform, account);
    if (batchEl && !batchEl.value.trim()) {
      if (taskSheetText) {
        batchEl.value = taskSheetText;
      } else {
        batchEl.placeholder = "请粘贴第三方表格。推荐表头：标题\t链接\t账号\t平台\t字幕\t备注";
      }
    }
    renderP01ImportGuide();
    renderBatchPreview();
    document.getElementById("batch-import")?.scrollIntoView({ behavior: "smooth", block: "start" });
    setImportMessage("ok", taskSheetText
      ? "已带入 P0-1 空白任务单。请先补真实链接、字幕或结构观察；空白行会被预检阻塞，不会入库。"
      : importPathMessage(importPath, importMode));
    return;
  }
  renderP01ImportGuide();
  setImportMessage("ok", importPathMessage(importPath, importMode));
}

function currentSprintTaskSheetText(version, importPath, platform, accountName) {
  if (version !== "current-sprint-task-sheet-v1" || importPath !== "third_party_table") return "";
  const safeAccount = accountName || "固定对标账号";
  const safePlatform = platform || "douyin";
  return [
    "标题\t链接\t账号\t平台\t字幕\t备注",
    `\t\t${safeAccount}\t${safePlatform}\t\t`,
    `\t\t${safeAccount}\t${safePlatform}\t\t`,
    `\t\t${safeAccount}\t${safePlatform}\t\t`,
  ].join("\n");
}

function renderSourceTaskBrief({ platform, importMode, importPath, title, account, note, r2Slot = "" }) {
  if (!sourceTaskBrief) return;
  const isBatch = importMode === "batch";
  const sourceLabel = platformText(platform);
  const pathMeta = importPathMeta(importPath, importMode);
  const slotNumber = Number(r2Slot || 0);
  const isCurrentSprintTaskSheet = initialContentParams.get("v") === "current-sprint-task-sheet-v1" && importPath === "third_party_table";
  const slotNotice = slotNumber ? `
    <div class="source-task-slot">
      <span>R2 SLOT ${slotNumber}</span>
      <strong>正在补第 ${slotNumber} 条真实结构素材</strong>
      <p>完成标准：真实素材入库 → 加入生成工作流 → 有字幕/正文 → 结构摘要达到 structure_done。完成后 R2 补数槽位会从“待补”变成“处理中/已占位”。</p>
    </div>
  ` : "";
  const returnNotice = isP01VerifierReturn ? `
    <div class="source-task-return">
      <span>P0-1 验收回跳</span>
      <strong>处理完这一步后，回到验收器复核 5 项证据。</strong>
      <a href="${escapeHtml(p01VerifierHref(activeBenchmarkTaskId || initialBenchmarkTaskId))}">回到验收器</a>
    </div>
  ` : "";
  sourceTaskBrief.innerHTML = `
    <article class="source-task-card ${isBatch ? "batch" : "single"} ${escapeHtml(importPath || "")}">
      <div>
        <span>${escapeHtml(pathMeta.badge)}</span>
        <strong>${escapeHtml(title || `${sourceLabel}数据源待办`)}</strong>
        <p>${escapeHtml(note || "从首页数据源待办进入，请补充可用素材后继续生产。")}</p>
      </div>
      <dl>
        <div><dt>来源平台</dt><dd>${escapeHtml(sourceLabel)}</dd></div>
        <div><dt>来源/账号</dt><dd>${escapeHtml(account || "待填写")}</dd></div>
        <div><dt>当前入口</dt><dd>${escapeHtml(pathMeta.entry)}</dd></div>
        <div><dt>验收重点</dt><dd>${escapeHtml(pathMeta.acceptance)}</dd></div>
      </dl>
      <div class="source-task-steps">
        ${pathMeta.steps.map((step, index) => `<span>${index + 1}. ${escapeHtml(step)}</span>`).join("")}
      </div>
      ${isCurrentSprintTaskSheet ? `
        <div class="source-task-actions">
          <button type="button" data-source-task-action="refill-current-sprint-sheet">重新填入空白任务单</button>
          <button type="button" data-source-task-action="keep-real-current-sprint-rows">只保留有真实内容的行</button>
          <button type="button" data-source-task-action="copy-current-sprint-sheet">复制当前任务单</button>
        </div>
      ` : ""}
      ${slotNotice}
      ${returnNotice}
    </article>
  `;
}

async function handleSourceTaskAction(action) {
  const template = currentSprintTaskSheetText(
    initialContentParams.get("v") || "",
    initialContentParams.get("importPath") || "",
    document.getElementById("contentPlatform")?.value || initialContentParams.get("importPlatform") || "douyin",
    document.getElementById("contentAccount")?.value.trim() || initialContentParams.get("importAccount") || "固定对标账号",
  );
  if (!template) return;
  if (action === "copy-current-sprint-sheet") {
    await copyBatchTemplateText(template, "当前任务单已复制。粘贴到飞书或表格里补真实链接/字幕后，再复制回内容池预检。");
    return;
  }
  if (action === "refill-current-sprint-sheet") {
    fillCurrentSprintTaskSheet(template);
    return;
  }
  if (action === "keep-real-current-sprint-rows") {
    keepCurrentSprintRealRows();
  }
}

function fillCurrentSprintTaskSheet(template) {
  const textarea = document.getElementById("contentBatchText");
  if (!textarea || !template) return;
  textarea.value = template;
  textarea.focus();
  renderBatchPreview();
  setImportMessage("ok", "已重新填入 P0-1 空白任务单。请补真实链接、字幕或结构观察；空白行不会入库。");
  document.getElementById("batch-import")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function keepCurrentSprintRealRows() {
  const textarea = document.getElementById("contentBatchText");
  if (!textarea) return;
  const text = textarea.value || "";
  const compact = compactCurrentSprintTaskSheetRows(text);
  if (!compact.changed) {
    setImportMessage("warning", compact.message);
    return;
  }
  textarea.value = compact.text;
  textarea.focus();
  renderBatchPreview();
  setImportMessage("ok", compact.message);
  document.getElementById("batch-import")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function compactCurrentSprintTaskSheetRows(text) {
  const lines = String(text || "").split(/\r?\n/);
  const nonEmptyLines = lines.filter((line) => line.trim());
  if (nonEmptyLines.length <= 1) {
    return { changed: false, text, message: "当前任务单还没有可整理的内容。先补 1 行真实链接、字幕或备注。" };
  }
  const header = nonEmptyLines[0];
  const fields = header.split("\t").map(canonicalPreviewField);
  const hasKnownHeader = fields.filter(Boolean).length >= 2;
  if (!hasKnownHeader) {
    return { changed: false, text, message: "当前表头无法识别，先保留原内容并按预检提示修正。" };
  }
  const keptRows = nonEmptyLines.slice(1).filter((line) => currentSprintRowHasRealInput(line, fields));
  if (!keptRows.length) {
    return { changed: false, text, message: "没有可保留的真实内容行。请至少补 1 行真实链接、字幕/正文或备注结构观察。" };
  }
  const compactText = [header, ...keptRows].join("\n");
  const removed = Math.max(0, nonEmptyLines.length - 1 - keptRows.length);
  return {
    changed: compactText !== text,
    text: compactText,
    message: `已保留 ${keptRows.length} 行有真实内容的任务行，移除 ${removed} 行空白行；请重新等待预检结果。`,
  };
}

function currentSprintRowHasRealInput(line, fields) {
  const cells = splitPreviewRow(line, "\t");
  const realFields = new Set(["url", "rawText", "note"]);
  return cells.some((cell, index) => {
    const value = String(cell || "").trim();
    if (!value) return false;
    const field = fields[index];
    if (field === "url") return /^https?:\/\//i.test(value);
    return realFields.has(field) && value.length >= 8;
  });
}

function renderR2InputPackage() {
  if (!r2InputPackage) return;
  const verifier = r2InputVerifier;
  if (!verifier?.version) {
    r2InputPackage.innerHTML = `
      <article class="r2-input-package-card empty">
        <strong>正在读取 R2 输入增厚任务包...</strong>
        <p>系统会根据真实结构素材、热点、商品、模板和复盘信号判断今天还缺什么。</p>
      </article>
    `;
    return;
  }
  const checks = Array.isArray(verifier.checks) ? verifier.checks : [];
  const candidateSources = Array.isArray(verifier.candidateSources) ? verifier.candidateSources : [];
  const replenishmentSlots = Array.isArray(verifier.replenishmentSlots) ? verifier.replenishmentSlots : [];
  const structureCheck = checks.find((item) => item.key === "real_structures") || {};
  const actual = Number(structureCheck.actual || 0);
  const target = Number(structureCheck.target || 3);
  const missing = Math.max(0, target - actual);
  const taskId = activeBenchmarkTaskId || initialBenchmarkTaskId;
  const realLinkHref = taskId
    ? `./content-pool.html?v=r2-input-package-v1&benchmarkTaskId=${encodeURIComponent(taskId)}&importPath=real_link&importPlatform=douyin&importMode=single&returnTo=p01_verifier#manual-import`
    : "./content-pool.html?v=r2-input-package-v1&importPath=real_link&importPlatform=douyin&importMode=single#manual-import";
  const manualSubtitleHref = taskId
    ? `./content-pool.html?v=r2-input-package-v1&benchmarkTaskId=${encodeURIComponent(taskId)}&importPath=manual_subtitle&importPlatform=manual&importMode=single&returnTo=p01_verifier#manual-import`
    : "./content-pool.html?v=r2-input-package-v1&importPath=manual_subtitle&importPlatform=manual&importMode=single#manual-import";
  const thirdPartyHref = taskId
    ? `./content-pool.html?v=r2-input-package-v1&benchmarkTaskId=${encodeURIComponent(taskId)}&importPath=third_party_table&importPlatform=third_party&importMode=batch&returnTo=p01_verifier#batch-import`
    : "./content-pool.html?v=r2-input-package-v1&importPath=third_party_table&importPlatform=third_party&importMode=batch#batch-import";
  const paths = [
    {
      title: "真实链接补齐",
      label: "优先",
      body: "适合手里有对标作品链接；导入后再提取或粘贴字幕。",
      href: realLinkHref,
    },
    {
      title: "旧字幕项目补齐",
      label: "最快",
      body: "适合已经有字幕提取结果；直接粘贴文本入库并结构化。",
      href: manualSubtitleHref,
    },
    {
      title: "第三方表格补齐",
      label: "批量",
      body: "适合灰豚、蝉妈妈、飞瓜、新榜或飞书表格；先预检再导入。",
      href: thirdPartyHref,
    },
  ];
  const canBulkSelect = missing > 0;
  const canBulkStructure = missing > 0;
  r2InputPackage.innerHTML = `
    <article class="r2-input-package-card ${escapeHtml(verifier.level || "blocked")}">
      <div class="r2-input-package-head">
        <div>
          <span>R2 INPUT PACKAGE</span>
          <strong>${escapeHtml(verifier.levelLabel || "R2 输入厚度待判断")}</strong>
          <p>${escapeHtml(verifier.summary || "目标是让今天生成前至少有 3 条真实结构素材，而不是只靠热点词生成。")}</p>
        </div>
        <a href="${escapeHtml(verifier.nextHref || "#manual-import")}">${escapeHtml(verifier.nextAction || "补输入")}</a>
      </div>
      <div class="r2-input-package-meter">
        <span><b>真实结构素材</b>${actual}/${target}</span>
        <span><b>还缺</b>${missing} 条</span>
        <span><b>可生成</b>${verifier.canGenerate ? "是" : "否"}</span>
      </div>
      <div class="r2-input-package-actions">
        <button type="button" data-r2-action="refresh">刷新 R2 计数</button>
        <button type="button" data-r2-action="bulk-select" ${canBulkSelect ? "" : "disabled"}>批量加入生成</button>
        <button type="button" data-r2-action="bulk-structure" ${canBulkStructure ? "" : "disabled"}>批量结构化</button>
        <button type="button" data-r2-action="script-flow" ${actual ? "" : "disabled"}>进入脚本流程</button>
      </div>
      <div class="r2-input-package-checks">
        ${checks.map((check) => `
          <a class="${escapeHtml(check.status || "blocked")}" href="${escapeHtml(check.href || "#")}">
            <span>${escapeHtml(check.statusLabel || "待判断")}</span>
            <strong>${escapeHtml(check.label || "输入项")}</strong>
            <p>${Number(check.actual || 0)}/${Number(check.target || 0)} · ${escapeHtml(check.evidence || "")}</p>
          </a>
        `).join("")}
      </div>
      <div class="r2-replenishment-slots">
        <div class="r2-replenishment-head">
          <div>
            <span>R2 FILL LIST</span>
            <strong>今天要补齐的 3 条真实结构素材</strong>
            <p>每个槽位最终都要到“已选 + structure_done”。空槽只给路径，不自动生成任何假素材。</p>
          </div>
          <em>${actual}/${target} 已完成</em>
        </div>
        <div class="r2-replenishment-list">
          ${replenishmentSlots.map((slot) => `
            <a class="${escapeHtml(slot.status || "empty")}" href="${escapeHtml(slot.href || "#manual-import")}">
              <span>${escapeHtml(slot.statusLabel || "待补")}</span>
              <strong>${slot.slot}. ${escapeHtml(slot.title || "补真实素材")}</strong>
              <p>${escapeHtml(slot.hint || "补齐真实链接、字幕和结构摘要。")}</p>
              <small>${escapeHtml(slot.sourceStatusLabel || slot.nextAction || "查看路径")}</small>
            </a>
          `).join("")}
        </div>
      </div>
      <div class="r2-source-diagnosis">
        <div class="r2-source-diagnosis-head">
          <div>
            <span>R2 SOURCE DIAGNOSIS</span>
            <strong>逐条看素材为什么没进入脚本输入</strong>
            <p>这里只展示今天内容池里的真实候选和被排除样本。目标不是凑数量，而是把可用素材推进到“已选 + structure_done”。</p>
          </div>
          <button type="button" data-r2-action="refresh">刷新诊断</button>
        </div>
        ${candidateSources.length ? `
          <div class="r2-source-diagnosis-list">
            ${candidateSources.map((source) => `
              <article class="${escapeHtml(source.status || "waiting")}">
                <div>
                  <span>${escapeHtml(source.statusLabel || "待判断")}</span>
                  <strong>${escapeHtml(source.title || "未命名素材")}</strong>
                  <p>${escapeHtml([source.platform, source.accountName].filter(Boolean).join(" / ") || "来源待补充")}</p>
                </div>
                <dl>
                  <div><dt>正文</dt><dd>${source.hasText ? `${Number(source.textLength || 0)} 字` : "缺"}</dd></div>
                  <div><dt>加入生成</dt><dd>${source.selected ? "是" : "否"}</dd></div>
                  <div><dt>结构</dt><dd>${escapeHtml(source.structureStatus || "none")}</dd></div>
                  <div><dt>字幕</dt><dd>${escapeHtml(source.subtitleStatus || "none")}</dd></div>
                </dl>
                <p class="r2-source-blockers">${(source.blockers || []).length ? source.blockers.map((item) => `<em>${escapeHtml(item)}</em>`).join("") : "<em>已满足 R2 结构素材要求</em>"}</p>
                <a href="${escapeHtml(source.href || "#content-pool")}">${escapeHtml(source.nextAction || "查看素材")}</a>
              </article>
            `).join("")}
          </div>
        ` : `
          <div class="r2-source-diagnosis-empty">
            <strong>今天还没有可诊断的真实素材</strong>
            <p>先从下面三种路径导入真实对标视频/笔记；导入后这里会显示每条素材卡在哪一步。</p>
          </div>
        `}
      </div>
      <div class="r2-input-package-paths">
        ${paths.map((path) => `
          <a href="${escapeHtml(path.href)}">
            <span>${escapeHtml(path.label)}</span>
            <strong>${escapeHtml(path.title)}</strong>
            <p>${escapeHtml(path.body)}</p>
          </a>
        `).join("")}
      </div>
      <small>${escapeHtml(verifier.rule || "示例、测试、验证和占位素材不计入 R2 输入厚度。")}</small>
    </article>
  `;
}

async function handleR2PackageAction(action) {
  if (action === "refresh") {
    setImportMessage("", "正在刷新 R2 输入厚度...");
    const beforeVerifier = r2InputVerifier;
    await refreshContentPoolAfterAction();
    renderR2ProgressFeedback(beforeVerifier, r2InputVerifier, "刷新诊断", { success: 0, failed: 0, skipped: 0 });
    setImportMessage("ok", "R2 输入厚度已刷新。");
    return;
  }
  if (action === "bulk-select") {
    await bulkSelectContentSources();
    return;
  }
  if (action === "bulk-structure") {
    await bulkStructureContentSources();
    return;
  }
  if (action === "script-flow") {
    window.location.href = "./index.html?v=r2-input-package-v1#stepGenerate";
  }
}

function renderP01ImportGuide(task = null) {
  if (!p01ImportGuide) return;
  const activeTask = task || benchmarkUpdateTaskItems.find((item) => String(item.id) === String(activeBenchmarkTaskId));
  const hasTask = Boolean(activeTask);
  const readiness = activeTask?.generationReadiness || {};
  const counts = readiness.counts || activeTask?.qualityCounts || {};
  const blockers = Array.isArray(readiness.blockers) ? readiness.blockers : [];
  const accountName = activeTask?.accountName || initialContentParams.get("importAccount") || "";
  const title = accountName ? `P0-1：先补「${accountName}」的真实近期内容` : "P0-1：选择一个固定对标账号后补真实素材";
  const href = activeTask?.href || "#benchmark-update";
  const requiredFields = Array.isArray(modulePrimaryPackage?.requiredFields) && modulePrimaryPackage.requiredFields.length
    ? modulePrimaryPackage.requiredFields
    : [
      { label: "标题", requirement: "真实作品标题，不能写示例。" },
      { label: "链接", requirement: "真实抖音/小红书/公开视频链接；没有链接就必须补字幕或正文。" },
      { label: "字幕/备注", requirement: "至少 30 字，能看出开头、节奏、镜头或 CTA。" },
      { label: "账号归因", requirement: "必须绑定当前固定对标账号任务。" },
    ];
  const packageTasks = Array.isArray(modulePrimaryPackage?.tasks) ? modulePrimaryPackage.tasks : [];
  const doneDefinition = Array.isArray(modulePrimaryPackage?.doneDefinition) && modulePrimaryPackage.doneDefinition.length
    ? modulePrimaryPackage.doneDefinition
    : [
      "加入生成工作流。",
      "生成结构摘要。",
      "回脚本流程生成候选脚本。",
      "脚本输入证据能看到这条素材 sourceId。",
    ];
  const blockedRules = Array.isArray(modulePrimaryPackage?.blockedRules) && modulePrimaryPackage.blockedRules.length
    ? modulePrimaryPackage.blockedRules
    : [
      "example.com、replace-video、测试、示例、空链接。",
      "只有账号名、只有热词、只有路径说明。",
      "空白任务单会被预检阻塞，不能当真实素材。",
    ];
  const packageLabel = modulePrimaryPackage?.version ? "已同步 V2 首页任务包" : "本页兜底验收口径";
  p01ImportGuide.innerHTML = `
    <article class="p01-import-guide-card ${hasTask ? escapeHtml(readiness.level || activeTask.status || "active") : "empty"}">
      <div class="p01-import-guide-head">
        <div>
          <span>P0-1 REAL MATERIAL</span>
          <strong>${escapeHtml(title)}</strong>
          <p>${escapeHtml(hasTask
            ? (readiness.summary || activeTask.statusReason || "补 1 条真实视频/笔记后，继续加字幕、加入生成、结构化。")
            : "从下方固定对标号今日更新任务选择一个账号，或从 V2 执行队列进入。")}</p>
        </div>
        <a href="${escapeHtml(href)}">${hasTask ? "回到账号任务卡" : "选择账号任务"}</a>
      </div>
      <div class="p01-import-package-sync">
        <strong>${escapeHtml(packageLabel)}</strong>
        <span>${escapeHtml(modulePrimaryPackage?.summary || "这里和 V2 首页“对标内容池”优先任务使用同一套字段、完成定义和阻塞规则。")}</span>
      </div>
      ${packageTasks.length ? `
        <div class="p01-import-taskline" aria-label="对标内容池任务包">
          ${packageTasks.map((step, index) => `
            <a class="${escapeHtml(step.status || "waiting")}" href="${escapeHtml(step.href || href)}">
              <em>${index + 1}</em>
              <strong>${escapeHtml(step.label || `任务 ${index + 1}`)}</strong>
              <span>${escapeHtml(step.statusLabel || step.status || "待处理")}</span>
              <p>${escapeHtml(step.evidence || step.action || "")}</p>
            </a>
          `).join("")}
        </div>
      ` : ""}
      <div class="p01-import-guide-body">
        <section>
          <b>这次必须填什么</b>
          ${requiredFields.map((field) => `<span><strong>${escapeHtml(field.label || "字段")}</strong>${escapeHtml(field.requirement || "按真实素材填写。")}</span>`).join("")}
        </section>
        <section>
          <b>完成定义</b>
          ${doneDefinition.map((item, index) => `<span><strong>${index + 1}</strong>${escapeHtml(item)}</span>`).join("")}
        </section>
        <section class="guard">
          <b>不会入库的内容</b>
          ${blockedRules.map((rule) => `<span>${escapeHtml(rule)}</span>`).join("")}
        </section>
      </div>
      <div class="p01-import-guide-status">
        <span><b>已导入</b>${counts.total || activeTask?.importedCount || 0}</span>
        <span><b>有文本</b>${counts.withText || 0}</span>
        <span><b>已加入</b>${counts.selected || 0}</span>
        <span><b>已结构化</b>${counts.structured || activeTask?.structuredCount || 0}</span>
      </div>
      ${blockers.length ? `<div class="p01-import-guide-blockers">${blockers.map((blocker) => `<em>${escapeHtml(blocker)}</em>`).join("")}</div>` : ""}
    </article>
  `;
}

function importPathMeta(importPath, importMode) {
  const isBatch = importMode === "batch";
  const fallback = {
    badge: isBatch ? "BATCH FALLBACK" : "MANUAL FALLBACK",
    entry: isBatch ? "批量导入 / 第三方表格" : "单条导入",
    acceptance: "导入后必须生成结构摘要，并进入候选脚本输入证据。",
    steps: isBatch
      ? ["粘贴第三方表格", "查看导入前预检", "解析导入", "批量加入生成工作流", "批量生成结构摘要"]
      : ["补充链接或正文/字幕", "导入内容池", "加入生成工作流", "生成结构摘要"],
  };
  return {
    real_link: {
      badge: "REAL LINK PATH",
      entry: "单条导入 / 真实作品链接",
      acceptance: "链接必须是真实作品；自动字幕失败时继续手工字幕。",
      steps: ["填写真实链接", "导入内容池", "提取或粘贴字幕", "生成结构摘要", "生成候选脚本"],
    },
    manual_subtitle: {
      badge: "MANUAL SUBTITLE PATH",
      entry: "单条导入 / 手工字幕正文",
      acceptance: "字幕或正文不少于 30 字，能拆出开头、节奏和 CTA。",
      steps: ["粘贴字幕/正文", "导入内容池", "加入生成工作流", "生成结构摘要", "生成候选脚本"],
    },
    third_party_table: {
      badge: "THIRD PARTY TABLE PATH",
      entry: "批量导入 / 第三方表格",
      acceptance: "表格行必须含标题，并至少有真实链接或可结构化字幕/备注。",
      steps: ["粘贴第三方表格", "查看导入前预检", "解析导入", "批量加入生成工作流", "批量生成结构摘要"],
    },
  }[importPath] || fallback;
}

function importPathMessage(importPath, importMode) {
  return {
    real_link: "已进入真实链接路径：请填写真实作品链接；自动字幕失败时继续粘贴手工字幕。",
    manual_subtitle: "已进入手工字幕兜底路径：请粘贴字幕、正文或结构观察后导入内容池。",
    third_party_table: "已进入第三方表格兜底路径：请粘贴表格，先看导入前预检，再解析导入。",
  }[importPath] || (importMode === "batch"
    ? "已进入第三方表格兜底。请粘贴表格，先看导入前预检，再解析导入。"
    : "已带入人工导入信息，请补充链接、笔记正文或字幕后导入内容池。");
}

function importPathRawTextPlaceholder(importPath) {
  return {
    real_link: "如果自动字幕失败，在这里粘贴真实视频字幕、口播文本或结构观察。不要粘贴路径说明。",
    manual_subtitle: "粘贴真实字幕、笔记正文或运营整理的内容结构，至少 30 字。不要粘贴路径说明。",
    third_party_table: "批量路径请在右侧表格框粘贴数据；这里可留空。",
  }[importPath] || "粘贴视频字幕、笔记正文或结构观察。";
}

function handlePostImportAction(action, taskId = "", button = null) {
  const sourceId = taskId || "";
  if (action === "p01-recheck-inline") {
    refreshInlineP01Verifier(button, taskId || activeBenchmarkTaskId || initialBenchmarkTaskId);
    return;
  }
  if (action === "p01-verifier") {
    window.location.href = p01VerifierHref(taskId || activeBenchmarkTaskId || initialBenchmarkTaskId);
    return;
  }
  if (action === "source-open") {
    scrollToContentSource(sourceId, true);
    return;
  }
  if (action === "source-select") {
    const target = sourceId ? document.querySelector(`[data-content-select="${sourceId}"]`) : null;
    if (target) toggleContentSource(target);
    return;
  }
  if (action === "source-structure") {
    const target = sourceId ? document.querySelector(`[data-content-structure="${sourceId}"]`) : null;
    if (target) structureContentSource(target);
    return;
  }
  if (action === "bulk-select") {
    bulkSelectContentSources();
    return;
  }
  if (action === "bulk-structure") {
    bulkStructureContentSources();
    return;
  }
  if (action === "benchmark-subtitle") {
    bulkSubtitleBenchmarkTaskSources(taskId);
    return;
  }
  if (action === "benchmark-select") {
    bulkSelectBenchmarkTaskSources(taskId);
    return;
  }
  if (action === "benchmark-structure") {
    bulkStructureBenchmarkTaskSources(taskId);
    return;
  }
  if (action === "benchmark-advance") {
    advanceBenchmarkTask(taskId);
    return;
  }
  if (action === "benchmark-focus") {
    focusBenchmarkTaskCard(taskId);
    document.getElementById(`benchmark-task-${taskId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  if (action === "scroll-pool") {
    document.getElementById("contentPoolList")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  if (action === "script-flow") {
    const query = taskId
      ? `?v=post-import-next-v1&benchmarkTaskId=${encodeURIComponent(taskId)}`
      : "?v=post-import-next-v1";
    window.location.href = `./index.html${query}#stepGenerate`;
    return;
  }
  if (action === "dashboard") {
    window.location.href = "./v2.html?v=post-import-next-v1";
  }
}

async function refreshInlineP01Verifier(button = null, taskId = "") {
  const originalText = button?.textContent || "";
  if (button) {
    button.disabled = true;
    button.textContent = "复核中...";
  }
  renderInlineP01Verifier({ loading: true, taskId });
  try {
    const response = await fetch(`${CONTENT_API_BASE}/api/v2/dashboard`);
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    p01AcceptanceVerifier = data.p01AcceptanceVerifier || null;
    r2InputVerifier = data.r2InputVerifier || r2InputVerifier;
    renderInlineP01Verifier({ verifier: p01AcceptanceVerifier, taskId });
    setImportMessage("ok", `P0-1 已复核：${p01AcceptanceVerifier?.levelLabel || "待判断"}，${p01AcceptanceVerifier?.counts?.passed || 0}/${p01AcceptanceVerifier?.counts?.total || 5} 项通过。`);
  } catch (error) {
    renderInlineP01Verifier({ error: error.message, taskId });
    setImportMessage("warning", `P0-1 复核失败：${error.message}`);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText || "本页复核 P0-1";
    }
  }
}

function p01VerifierHref(taskId = "") {
  const params = new URLSearchParams({ v: "p01-return-v1" });
  if (taskId) params.set("benchmarkTaskId", taskId);
  return `./collection-center.html?${params.toString()}#p01-collection-package`;
}

function p01ReturnAction(taskId = "", primary = false) {
  if (!isP01VerifierReturn) return null;
  return {
    action: "p01-verifier",
    label: "回到 P0-1 验收器复核",
    benchmarkTaskId: taskId || activeBenchmarkTaskId || initialBenchmarkTaskId,
    primary,
  };
}

function renderPostImportNextPanel(state = {}) {
  if (!postImportNextPanel) return;
  const importedCount = Number(state.importedCount || 0);
  const failedCount = Number(state.failedCount || 0);
  const structuredCount = Number(state.structuredCount || 0);
  const selectedCount = Number(state.selectedCount || 0);
  const evidenceItems = normalizePostImportEvidence(state.evidenceItems || state.sources || state.importedItems || []);
  const sourceLabel = state.sourceLabel || "导入素材";
  const title = state.title || (importedCount ? `已接收 ${importedCount} 条素材` : "等待导入素材");
  const description = state.description || "导入后先加入生成工作流，再生成结构摘要，脚本生成才会读取这些对标素材。";
  const steps = [
    {
      label: "导入内容池",
      state: importedCount ? "done" : "pending",
      detail: importedCount ? `${importedCount} 条成功${failedCount ? `，${failedCount} 条失败` : ""}` : "等待链接、字幕或表格",
    },
    {
      label: "加入生成工作流",
      state: selectedCount ? "done" : (importedCount ? "current" : "pending"),
      detail: selectedCount ? `${selectedCount} 条已加入` : "让脚本生成读取这些素材",
    },
    {
      label: "生成结构摘要",
      state: structuredCount ? "done" : (selectedCount ? "current" : "pending"),
      detail: structuredCount ? `${structuredCount} 条已结构化` : "提取开头、节奏、CTA、风险",
    },
    {
      label: "进入脚本生成",
      state: structuredCount ? "current" : "pending",
      detail: "用已选素材生成候选脚本",
    },
  ];
  const actions = Array.isArray(state.actions) && state.actions.length
    ? state.actions
    : [
      { action: "bulk-select", label: "批量加入生成工作流", primary: true },
      { action: "bulk-structure", label: "批量生成结构摘要" },
      { action: "scroll-pool", label: "查看内容池列表" },
    ];
  const returnAction = p01ReturnAction(state.benchmarkTaskId || "");
  const visibleActions = returnAction && !actions.some((item) => item.action === "p01-verifier")
    ? [...actions, returnAction]
    : actions;
  const inlineTaskId = state.benchmarkTaskId || activeBenchmarkTaskId || initialBenchmarkTaskId || "";
  const inlineRecheckAction = inlineTaskId
    ? { action: "p01-recheck-inline", label: "本页复核 P0-1", benchmarkTaskId: inlineTaskId }
    : null;
  const finalActions = inlineRecheckAction && !visibleActions.some((item) => item.action === "p01-recheck-inline")
    ? [...visibleActions, inlineRecheckAction]
    : visibleActions;
  const taskHandoff = state.benchmarkTaskId ? `
    <div class="post-import-benchmark-handoff">
      <div>
        <span>P0-1 接力</span>
        <strong>${escapeHtml(state.benchmarkTitle || "回到固定对标账号任务卡")}</strong>
        <p>${escapeHtml(state.benchmarkNext || "导入结果已刷新到账号任务卡；回到卡片后按 P0-1 NEXT STEP 继续处理字幕、加入生成和结构摘要。")}</p>
      </div>
      <button type="button" data-next-action="benchmark-focus" data-next-task-id="${escapeHtml(state.benchmarkTaskId)}">回到该账号任务卡</button>
    </div>
  ` : "";
  const r2SlotNumber = Number(state.r2Slot || activeR2Slot || 0);
  const r2Handoff = r2SlotNumber ? `
    <div class="post-import-r2-handoff">
      <div>
        <span>R2 SLOT ${r2SlotNumber}</span>
        <strong>第 ${r2SlotNumber} 槽已接收素材，继续推进到 structure_done</strong>
        <p>${escapeHtml(state.r2Next || "下一步：补字幕/正文、加入生成工作流，并生成结构摘要。槽位只有达到“已选 + structure_done”才会计入 R2。")}</p>
      </div>
      <button type="button" data-next-action="scroll-pool">查看这条素材</button>
    </div>
  ` : "";
  postImportNextPanel.innerHTML = `
    <article class="post-import-card ${escapeHtml(state.status || "ready")}">
      <div class="post-import-head">
        <div>
          <span>${escapeHtml(sourceLabel)}</span>
          <strong>${escapeHtml(title)}</strong>
          <p>${escapeHtml(description)}</p>
        </div>
        <em>${escapeHtml(state.badge || nextPanelBadge(importedCount, selectedCount, structuredCount))}</em>
      </div>
      <div class="post-import-steps">
        ${steps.map((step, index) => `
          <div class="${escapeHtml(step.state)}">
            <b>${index + 1}</b>
            <span>${escapeHtml(step.label)}</span>
            <small>${escapeHtml(step.detail)}</small>
          </div>
        `).join("")}
      </div>
      ${postImportEvidenceHtml(evidenceItems, state)}
      <div class="post-import-actions">
        ${finalActions.map((item) => `
          <button type="button" class="${item.primary ? "primary" : ""}" data-next-action="${escapeHtml(item.action)}" ${item.benchmarkTaskId ? `data-next-task-id="${escapeHtml(item.benchmarkTaskId)}"` : ""} ${item.sourceId ? `data-next-source-id="${escapeHtml(item.sourceId)}"` : ""}>${escapeHtml(item.label)}</button>
        `).join("")}
      </div>
      <div class="post-import-p01-recheck" data-p01-inline-result></div>
      ${taskHandoff}
      ${r2Handoff}
    </article>
  `;
  renderInlineP01Verifier({ verifier: p01AcceptanceVerifier, taskId: inlineTaskId, passive: true });
}

function normalizePostImportEvidence(items = []) {
  if (!Array.isArray(items)) return [];
  return items
    .map((entry) => entry?.item || entry)
    .filter(Boolean)
    .map((item) => ({
      id: item.id || item.sourceId || "",
      title: item.title || "未命名素材",
      accountName: item.accountName || item.account || "",
      platform: item.platform || "",
      status: item.status || "",
      selected: Boolean(item.selected),
      structureStatus: item.structure?.status || item.structureStatus || "",
      benchmarkTaskId: item.benchmarkUpdateTaskId || item.benchmarkTaskId || item.benchmarkTask?.taskId || "",
      hasText: Boolean(item.rawText || item.hasText),
      isOperationalReal: item.isOperationalReal !== false,
      realMaterialReason: item.realMaterialReason || "",
    }));
}

function postImportEvidenceHtml(items = [], state = {}) {
  const importedCount = Number(state.importedCount || 0);
  if (!items.length && !importedCount) {
    return `
      <div class="post-import-evidence empty">
        <div>
          <span>写库证据</span>
          <strong>当前没有素材写入</strong>
          <p>这只是预检或失败状态，不会触发脚本生成，也不会计入 P0-1 / R2 验收。</p>
        </div>
      </div>
    `;
  }
  if (!items.length) {
    return `
      <div class="post-import-evidence warning">
        <div>
          <span>写库证据</span>
          <strong>已导入 ${importedCount} 条，但结果未返回 sourceId</strong>
          <p>请刷新内容池列表核对 sourceId 后再推进结构化；没有 sourceId 不能证明脚本读取了这条素材。</p>
        </div>
      </div>
    `;
  }
  return `
    <div class="post-import-evidence">
      <div class="post-import-evidence-head">
        <div>
          <span>写库证据</span>
          <strong>${items.length} 条素材已返回 sourceId</strong>
          <p>这一步只证明素材进入内容池；还没有生成脚本。后续必须加入生成、结构化，并在候选脚本依据里看到 sourceId。</p>
        </div>
      </div>
      <div class="post-import-evidence-list">
        ${items.slice(0, 6).map((item) => `
          <article class="${item.isOperationalReal ? "" : "warning"}">
            <b>#${escapeHtml(item.id || "待核对")}</b>
            <div>
              <strong>${escapeHtml(item.title)}</strong>
              <p>${escapeHtml([
                item.platform ? platformText(item.platform) : "",
                item.accountName || "",
                item.benchmarkTaskId ? `绑定任务 #${item.benchmarkTaskId}` : "",
              ].filter(Boolean).join(" / ") || "未绑定账号任务")}</p>
            </div>
            <small>${escapeHtml(postImportEvidenceStatus(item))}</small>
          </article>
        `).join("")}
      </div>
    </div>
  `;
}

function postImportEvidenceStatus(item = {}) {
  if (!item.isOperationalReal) return `不计入真实闭环：${item.realMaterialReason || "命中非运营素材规则"}`;
  if (!item.hasText) return "已入库，下一步补字幕/正文";
  if (!item.selected) return "已有文本，下一步加入生成工作流";
  if (item.structureStatus !== "structure_done") return "已加入生成，下一步生成结构摘要";
  return "已结构化，可进入脚本流程";
}

function renderInlineP01Verifier({ verifier = null, loading = false, error = "", taskId = "", passive = false } = {}) {
  const container = postImportNextPanel?.querySelector("[data-p01-inline-result]");
  if (!container) return;
  if (!taskId && !verifier && passive) {
    container.innerHTML = "";
    return;
  }
  if (loading) {
    container.innerHTML = `
      <div class="post-import-p01-recheck-card loading">
        <span>P0-1 RECHECK</span>
        <strong>正在重新读取库表证据...</strong>
        <p>只读 dashboard，不写入素材、不生成脚本。</p>
      </div>
    `;
    return;
  }
  if (error) {
    container.innerHTML = `
      <div class="post-import-p01-recheck-card warning">
        <span>P0-1 RECHECK</span>
        <strong>复核失败</strong>
        <p>${escapeHtml(error)}</p>
      </div>
    `;
    return;
  }
  if (!verifier?.version) {
    container.innerHTML = passive ? "" : `
      <div class="post-import-p01-recheck-card warning">
        <span>P0-1 RECHECK</span>
        <strong>暂无验收器数据</strong>
        <p>点击复核后会重新读取 dashboard，按真实库表判断 P0-1。</p>
      </div>
    `;
    return;
  }
  const counts = verifier.counts || {};
  const checks = Array.isArray(verifier.checks) ? verifier.checks : [];
  const next = checks.find((item) => item.status !== "passed") || checks[checks.length - 1] || {};
  container.innerHTML = `
    <div class="post-import-p01-recheck-card ${escapeHtml(verifier.level || "blocked")}">
      <div>
        <span>P0-1 RECHECK</span>
        <strong>${escapeHtml(verifier.levelLabel || "P0-1 待判断")}：${Number(counts.passed || 0)}/${Number(counts.total || checks.length || 5)} 项通过</strong>
        <p>${escapeHtml(verifier.summary || "逐项读取真实库表证据。")}</p>
      </div>
      <div class="post-import-p01-recheck-facts">
        <span><b>真实素材</b>${Number(counts.candidateSources || 0)}</span>
        <span><b>排除素材</b>${Number(counts.excluded || 0)}</span>
        <span><b>阻塞</b>${Number(counts.blocked || 0)}</span>
        <span><b>下一步</b>${escapeHtml(next.label || verifier.nextAction || "待判断")}</span>
      </div>
      <small>复核口径：${escapeHtml(verifier.rule || "只读真实库表证据；示例、测试、验证、占位素材不会计入。")}</small>
    </div>
  `;
}

function nextPanelBadge(importedCount, selectedCount, structuredCount) {
  if (structuredCount) return "可去生成脚本";
  if (selectedCount) return "下一步：结构化";
  if (importedCount) return "下一步：加入生成";
  return "等待导入";
}

function renderSubtitleSavedNextPanel(item = {}) {
  const isReal = item.isOperationalReal !== false;
  const itemId = item.id || "";
  const benchmarkTaskId = item.benchmarkUpdateTaskId || item.benchmarkTask?.taskId || "";
  renderPostImportNextPanel({
    sourceLabel: "手工字幕兜底",
    title: `字幕已保存：${item.title || "未命名素材"}`,
    description: isReal
      ? "这条素材已经有字幕/正文。下一步生成结构摘要，系统才会把它拆成开头、节奏、CTA 和风险，用于候选脚本。"
      : `字幕已保存，但这条素材被标记为不计入真实闭环：${item.realMaterialReason || "命中非运营素材规则"}。可用于验证流程，不能作为真实脚本生成证据。`,
    importedCount: 1,
    selectedCount: item.selected ? 1 : 0,
    structuredCount: item.structure?.status === "structure_done" ? 1 : 0,
    evidenceItems: [item],
    status: isReal ? "ready" : "warning",
    badge: isReal ? "下一步：结构化" : "仅验证流程",
    r2Slot: activeR2Slot,
    r2Next: isReal
      ? "字幕已保存。继续加入生成工作流并生成结构摘要；完成后该槽位会进入 R2 结构素材计数。"
      : "这条素材不计入真实闭环，不能填充 R2 槽位。",
    benchmarkTaskId: isReal && benchmarkTaskId ? benchmarkTaskId : "",
    benchmarkTitle: isReal && benchmarkTaskId ? "字幕已回写到固定对标账号任务" : "",
    benchmarkNext: isReal && benchmarkTaskId ? "回到账号任务卡后，P0-1 NEXT STEP 会继续提示加入生成或生成结构摘要。" : "",
    actions: isReal ? [
      p01ReturnAction(benchmarkTaskId, Boolean(benchmarkTaskId)),
      benchmarkTaskId
        ? { action: "benchmark-focus", label: "回到账号任务卡", benchmarkTaskId, primary: !isP01VerifierReturn }
        : { action: "source-structure", label: "生成这条结构摘要", sourceId: itemId, primary: true },
      item.selected
        ? { action: "script-flow", label: "去脚本流程" }
        : { action: "source-select", label: "加入生成工作流", sourceId: itemId },
      { action: "source-open", label: "查看这条素材", sourceId: itemId },
    ].filter(Boolean) : [
      { action: "source-open", label: "查看这条素材", sourceId: itemId, primary: true },
    ],
  });
}

function clearPostImportNextPanel() {
  if (postImportNextPanel) postImportNextPanel.innerHTML = "";
}

async function loadContentSources() {
  setContentStatus("pending", "正在读取对标内容池...");
  try {
    const response = await fetch(`${CONTENT_API_BASE}/api/v2/content-sources`);
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    setContentStatus("online", `内容池已连接：${data.items.length} 条`);
    renderSubtitleReadiness(data.subtitleReadiness, data.items || []);
    renderThirdPartyReadiness(data.thirdPartyReadiness, data.items || []);
    renderContentSources(data.items || []);
  } catch (error) {
    setContentStatus("offline", `内容池读取失败：${error.message}`);
    renderSubtitleReadiness(null, []);
    renderThirdPartyReadiness(null, []);
  }
}

async function refreshContentPoolAfterAction() {
  await loadContentPoolDashboardContext();
  await loadContentSources();
  await loadBenchmarkUpdateTasks();
}

function renderThirdPartyReadiness(readiness, items = []) {
  if (!thirdPartyReadinessPanel) return;
  if (!readiness) {
    thirdPartyReadinessPanel.className = "third-party-readiness-panel warning";
    thirdPartyReadinessPanel.innerHTML = `
      <strong>第三方数据清洗状态读取失败</strong>
      <p>请先确认内容池 API 是否正常；失败时仍可粘贴表格走导入前预检。</p>
    `;
    return;
  }
  const counts = readiness.counts || {};
  const queue = readiness.queue || [];
  const fieldGroups = readiness.fieldGroups || [];
  thirdPartyReadinessPanel.className = `third-party-readiness-panel ${escapeHtml(readiness.level || "empty")}`;
  thirdPartyReadinessPanel.innerHTML = `
    <div class="third-party-readiness-head">
      <div>
        <span>${escapeHtml(thirdPartyLevelText(readiness.level))}</span>
        <strong>${escapeHtml(readiness.nextAction || "粘贴第三方表格并先做预检。")}</strong>
        <p>${escapeHtml(readiness.summary || "暂无第三方导入状态。")}</p>
      </div>
      <a href="${escapeHtml(readiness.nextHref || "#batch-import")}">去处理</a>
    </div>
    <div class="third-party-readiness-counts">
      ${thirdPartyCount("表格素材", counts.totalRows)}
      ${thirdPartyCount("有链接", counts.withUrl)}
      ${thirdPartyCount("有正文", counts.withText)}
      ${thirdPartyCount("已结构化", counts.structured)}
      ${thirdPartyCount("待结构化", counts.needStructure)}
    </div>
    <div class="third-party-vendors">
      ${(readiness.supportedVendors || []).map((vendor) => `<span>${escapeHtml(vendor)}</span>`).join("")}
    </div>
    <div class="third-party-field-groups">
      ${fieldGroups.map((group) => `
        <article>
          <strong>${escapeHtml(group.label || "")}</strong>
          <p>${escapeHtml(group.rule || "")}</p>
          <div>${(group.fields || []).map((field) => `<span>${escapeHtml(field)}</span>`).join("")}</div>
        </article>
      `).join("")}
    </div>
    <div class="third-party-clean-actions">
      <button type="button" data-third-party-action="paste">粘贴表格预检</button>
      <button type="button" data-third-party-action="bulk-select" ${counts.totalRows ? "" : "disabled"}>批量加入生成工作流</button>
      <button type="button" data-third-party-action="bulk-structure" ${counts.needStructure ? "" : "disabled"}>批量生成结构摘要</button>
    </div>
    <div class="third-party-clean-queue">
      ${queue.length ? queue.map((item) => thirdPartyQueueCard(item, items)).join("") : `<article><strong>暂无第三方素材</strong><p>自动采集失败时，从灰豚、蝉妈妈、飞瓜、新榜或飞书表格复制内容到上方批量框。</p></article>`}
    </div>
    ${(readiness.rules || []).length ? `<div class="third-party-rules">${readiness.rules.map((rule) => `<span>${escapeHtml(rule)}</span>`).join("")}</div>` : ""}
  `;
}

function thirdPartyCount(label, value) {
  return `
    <span>
      <b>${escapeHtml(label)}</b>
      ${Number(value || 0)}
    </span>
  `;
}

function thirdPartyQueueCard(item, items) {
  const source = items.find((entry) => Number(entry.id) === Number(item.sourceId)) || {};
  return `
    <article class="${escapeHtml(item.status || "")}">
      <div>
        <span>${escapeHtml(item.statusLabel || "待处理")}</span>
        <strong>${escapeHtml(item.title || "未命名素材")}</strong>
        <p>${escapeHtml(item.accountName || source.accountName || "未知来源")}</p>
      </div>
      <p>${escapeHtml(item.reason || "等待处理。")}</p>
      <div class="third-party-card-actions">
        <button type="button" data-third-party-action="open-source" data-source-id="${item.sourceId}">查看素材</button>
        <button type="button" data-third-party-action="structure-source" data-source-id="${item.sourceId}" ${item.status === "need_structure" ? "" : "disabled"}>生成结构摘要</button>
      </div>
    </article>
  `;
}

function thirdPartyLevelText(level) {
  return {
    needs_structure: "需要结构化",
    usable: "兜底可用",
    empty: "等待导入",
    warning: "需要检查",
  }[level] || "第三方兜底";
}

function handleThirdPartyAction(button) {
  const action = button.dataset.thirdPartyAction;
  const sourceId = button.dataset.sourceId;
  if (action === "paste") {
    document.getElementById("contentBatchText")?.focus();
    document.getElementById("batch-import")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  if (action === "bulk-select") {
    bulkSelectContentSources();
    return;
  }
  if (action === "bulk-structure") {
    bulkStructureContentSources();
    return;
  }
  if (action === "open-source") {
    scrollToContentSource(sourceId, false);
    return;
  }
  if (action === "structure-source") {
    const target = sourceId ? document.querySelector(`[data-content-structure="${sourceId}"]`) : null;
    if (target) structureContentSource(target);
  }
}

function renderSubtitleReadiness(readiness, items = []) {
  if (!subtitleReadinessPanel) return;
  if (!readiness) {
    subtitleReadinessPanel.className = "subtitle-readiness-panel warning";
    subtitleReadinessPanel.innerHTML = `
      <strong>字幕接入状态读取失败</strong>
      <p>请先确认内容池 API 是否正常；素材列表可用后再判断自动字幕、手工字幕和结构化动作。</p>
    `;
    return;
  }
  const counts = readiness.counts || {};
  const queue = readiness.queue || [];
  const service = readiness.service || {};
  const jobTrace = readiness.jobTrace || {};
  subtitleReadinessPanel.className = `subtitle-readiness-panel ${escapeHtml(readiness.level || "empty")}`;
  subtitleReadinessPanel.innerHTML = `
    <div class="subtitle-readiness-head">
      <div>
        <span>${escapeHtml(subtitleReadinessLevelText(readiness.level))}</span>
        <strong>${escapeHtml(readiness.nextAction || "先导入素材，再判断字幕动作。")}</strong>
        <p>${escapeHtml(readiness.summary || "暂无内容池状态。")}</p>
      </div>
      <a href="${escapeHtml(readiness.nextHref || "#contentPoolList")}">${counts.structured ? "去脚本流程" : "查看内容池"}</a>
    </div>
    <div class="subtitle-readiness-counts">
      ${readinessCount("有链接", counts.withUrl)}
      ${readinessCount("有字幕/正文", counts.withText)}
      ${readinessCount("可结构化", counts.readyForStructure)}
      ${readinessCount("需手工字幕", counts.manualNeeded)}
      ${readinessCount("已结构化", counts.structured)}
    </div>
    <div class="subtitle-readiness-service">
      <span>${escapeHtml(service.statusLabel || "字幕服务待检测")}</span>
      <p>${escapeHtml(service.summary || "自动字幕服务状态未知；必要时使用手工字幕兜底。")}</p>
    </div>
    ${subtitleJobTraceHtml(jobTrace)}
    <div class="subtitle-readiness-actions">
      <button type="button" data-readiness-action="bulk-subtitle" ${counts.autoReady ? "" : "disabled"}>批量提取字幕</button>
      <button type="button" data-readiness-action="bulk-structure" ${counts.readyForStructure ? "" : "disabled"}>批量生成结构摘要</button>
      <button type="button" data-readiness-action="scroll-manual" ${counts.manualNeeded ? "" : "disabled"}>处理手工字幕</button>
    </div>
    <div class="subtitle-readiness-queue">
      ${queue.length ? queue.map((item) => subtitleReadinessQueueCard(item, items)).join("") : `<article><strong>暂无待处理素材</strong><p>先导入热点视频、对标视频链接或字幕文本。</p></article>`}
    </div>
  `;
}

function subtitleJobTraceHtml(trace = {}) {
  const counts = trace.counts || {};
  const failedSources = Array.isArray(trace.failedSources) ? trace.failedSources : [];
  const latestFailure = trace.latestFailure || failedSources[0] || null;
  const level = trace.level || "empty";
  const evidenceText = latestFailure?.error
    ? `最近失败：${latestFailure.error}`
    : "没有失败证据。";
  return `
    <div class="subtitle-job-trace ${escapeHtml(level)}">
      <div class="subtitle-job-trace-head">
        <div>
          <span>字幕任务追踪</span>
          <strong>${escapeHtml(trace.summary || "当前没有可追踪的自动字幕任务。")}</strong>
          <p>${escapeHtml(trace.nextAction || "先导入真实链接或字幕文本。")}</p>
        </div>
        <div class="subtitle-job-trace-counts">
          ${readinessCount("任务", counts.trackedJobs)}
          ${readinessCount("成功", counts.successfulJobs)}
          ${readinessCount("失败", counts.failedJobs)}
          ${readinessCount("需人工", counts.manualFallbackNeeded)}
        </div>
      </div>
      <div class="subtitle-job-trace-evidence">
        <b>${escapeHtml(evidenceText)}</b>
        ${latestFailure?.fallbackAction ? `<p>兜底动作：${escapeHtml(latestFailure.fallbackAction)}</p>` : `<p>自动字幕不稳定时，直接粘贴人工字幕也能继续结构化。</p>`}
      </div>
      ${failedSources.length ? `
        <div class="subtitle-job-trace-list">
          ${failedSources.map((item) => subtitleJobTraceFailureItem(item)).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

function subtitleJobTraceFailureItem(item) {
  return `
    <article>
      <div>
        <span>${escapeHtml(item.statusLabel || "提取失败")}</span>
        <strong>${escapeHtml(item.title || "未命名素材")}</strong>
        <p>${platformText(item.platform)} / ${escapeHtml(item.accountName || "未知来源")}</p>
      </div>
      <p>${escapeHtml(item.error || "自动字幕失败，请改用手工字幕。")}</p>
      <div class="subtitle-readiness-card-actions">
        <button type="button" data-readiness-action="manual-subtitle" data-source-id="${escapeHtml(item.sourceId)}">粘贴字幕</button>
        <button type="button" data-readiness-action="subtitle-job" data-source-id="${escapeHtml(item.sourceId)}">重新提取</button>
      </div>
    </article>
  `;
}

function readinessCount(label, value) {
  return `
    <span>
      <b>${escapeHtml(label)}</b>
      ${Number(value || 0)}
    </span>
  `;
}

function subtitleReadinessQueueCard(item, items) {
  const source = items.find((entry) => Number(entry.id) === Number(item.sourceId)) || {};
  const canAuto = item.actionType === "subtitle_job" && source.url;
  const canStructure = item.actionType === "structure";
  const canSelect = item.actionType === "select" && !source.selected;
  const selectLabel = source.selected ? "已加入生成" : "加入生成";
  return `
    <article class="${escapeHtml(item.status || "")}">
      <div>
        <span>${escapeHtml(item.statusLabel || "待处理")}</span>
        <strong>${escapeHtml(item.title || "未命名素材")}</strong>
        <p>${platformText(item.platform)} / ${escapeHtml(item.accountName || "未知来源")}</p>
      </div>
      <p>${escapeHtml(item.reason || "等待运营处理。")}</p>
      <small>完成标准：${escapeHtml(item.completion || "完成后继续进入下一步。")}</small>
      <div class="subtitle-readiness-card-actions">
        <button type="button" data-readiness-action="subtitle-job" data-source-id="${item.sourceId}" ${canAuto ? "" : "disabled"}>提取字幕</button>
        <button type="button" data-readiness-action="structure" data-source-id="${item.sourceId}" ${canStructure ? "" : "disabled"}>生成结构摘要</button>
        <button type="button" data-readiness-action="manual-subtitle" data-source-id="${item.sourceId}">${item.actionType === "manual_subtitle" ? "粘贴字幕" : "查看素材"}</button>
        <button type="button" data-readiness-action="select" data-source-id="${item.sourceId}" ${canSelect ? "" : "disabled"}>${selectLabel}</button>
      </div>
    </article>
  `;
}

function subtitleReadinessLevelText(level) {
  return {
    ready: "可结构化",
    auto_ready: "可自动提字幕",
    manual_needed: "需要手工兜底",
    structured: "可进入脚本",
    empty: "等待导入",
  }[level] || "字幕接入";
}

function handleSubtitleReadinessAction(button) {
  const action = button.dataset.readinessAction;
  const sourceId = button.dataset.sourceId;
  if (action === "bulk-subtitle") {
    bulkCreateSubtitleJobs();
    return;
  }
  if (action === "bulk-structure") {
    bulkStructureContentSources();
    return;
  }
  if (action === "scroll-manual") {
    scrollToFirstManualSubtitle();
    return;
  }
  if (action === "subtitle-job") {
    const target = sourceId ? document.querySelector(`[data-content-subtitle-job="${sourceId}"]`) : null;
    if (target) createSubtitleJob(target);
    return;
  }
  if (action === "structure") {
    const target = sourceId ? document.querySelector(`[data-content-structure="${sourceId}"]`) : null;
    if (target) structureContentSource(target);
    return;
  }
  if (action === "manual-subtitle") {
    scrollToContentSource(sourceId, true);
    return;
  }
  if (action === "select") {
    const target = sourceId ? document.querySelector(`[data-content-select="${sourceId}"]`) : null;
    if (target) toggleContentSource(target);
  }
}

function scrollToFirstManualSubtitle() {
  const firstOpen = document.querySelector(".content-subtitle-panel[open]");
  if (firstOpen) {
    firstOpen.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  document.getElementById("contentPoolList")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function scrollToContentSource(sourceId, openSubtitle = false) {
  const card = sourceId ? document.getElementById(`content-source-${sourceId}`) : null;
  if (!card) return;
  if (openSubtitle) {
    const panel = card.querySelector(".content-subtitle-panel");
    if (panel) panel.open = true;
  }
  card.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function loadBenchmarkUpdateTasks() {
  if (!benchmarkUpdateList) return;
  try {
    const response = await fetch(`${CONTENT_API_BASE}/api/v2/benchmark-update-tasks`);
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    renderBenchmarkUpdateTasks(data);
  } catch (error) {
    benchmarkUpdateList.innerHTML = `
      <article class="benchmark-update-card failed">
        <strong>对标账号更新任务读取失败</strong>
        <p>${escapeHtml(error.message)}</p>
      </article>
    `;
  }
}

async function loadBenchmarkAccounts() {
  if (!benchmarkAccountList) return;
  try {
    const response = await fetch(`${CONTENT_API_BASE}/api/v2/benchmark-accounts`);
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    renderBenchmarkAccounts(data);
  } catch (error) {
    benchmarkAccountList.innerHTML = `
      <article class="failed">
        <strong>固定账号池读取失败</strong>
        <p>${escapeHtml(error.message)}</p>
      </article>
    `;
  }
}

function renderBenchmarkAccounts(data) {
  if (!benchmarkAccountList) return;
  const items = data.items || [];
  benchmarkAccountList.innerHTML = items.length
    ? `
      <article class="benchmark-account-summary">
        <strong>${escapeHtml(data.summary || `固定对标账号池 ${items.length} 个`)}</strong>
        <p>${escapeHtml(data.nextAction || "新增账号后生成今日任务，再按账号补近期内容。")}</p>
      </article>
      ${items.map((item) => benchmarkAccountCard(item)).join("")}
    `
    : `
      <article class="benchmark-account-empty">
        <strong>还没有固定对标账号</strong>
        <p>先新增 3-5 个必须长期看的账号。没有账号池，就无法形成每日对标内容更新任务。</p>
      </article>
    `;
}

function benchmarkAccountCard(item) {
  const patterns = Array.isArray(item.patterns) ? item.patterns.slice(0, 5) : [];
  return `
    <article class="benchmark-account-card">
      <div>
        <span>${platformText(item.platform)} / ${escapeHtml(item.category || "未分类")}</span>
        <strong>${escapeHtml(item.accountName)}</strong>
        <p>${escapeHtml(item.whyTrack || "补近期内容后用于学习真实内容结构。")}</p>
      </div>
      <em>${escapeHtml(item.accountHandle || "未填账号标识")}</em>
      ${patterns.length ? `<div class="benchmark-patterns">${patterns.map((pattern) => `<span>${escapeHtml(pattern)}</span>`).join("")}</div>` : ""}
    </article>
  `;
}

async function saveBenchmarkAccount() {
  if (!saveBenchmarkAccountBtn) return;
  const payload = {
    platform: document.getElementById("benchmarkAccountPlatform")?.value || "douyin",
    accountName: document.getElementById("benchmarkAccountName")?.value.trim() || "",
    accountHandle: document.getElementById("benchmarkAccountHandle")?.value.trim() || "",
    category: document.getElementById("benchmarkAccountCategory")?.value.trim() || "",
    whyTrack: document.getElementById("benchmarkAccountWhy")?.value.trim() || "",
    patterns: document.getElementById("benchmarkAccountPatterns")?.value.trim() || "",
  };
  if (!payload.accountName || !payload.whyTrack) {
    setBenchmarkAccountMessage("warning", "账号名和为什么对标必须填写。");
    return;
  }
  saveBenchmarkAccountBtn.disabled = true;
  saveBenchmarkAccountBtn.textContent = "保存中...";
  setBenchmarkAccountMessage("", "正在保存账号，并生成今日更新任务...");
  try {
    const response = await fetch(`${CONTENT_API_BASE}/api/v2/benchmark-accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    setBenchmarkAccountMessage("ok", `${data.action === "updated" ? "已更新" : "已新增"}：${data.item.accountName}。今日任务已同步生成，可在下方按账号补近期内容。`);
    clearBenchmarkAccountForm();
    await loadBenchmarkAccounts();
    await loadBenchmarkUpdateTasks();
  } catch (error) {
    setBenchmarkAccountMessage("warning", `保存账号失败：${error.message}`);
  } finally {
    saveBenchmarkAccountBtn.disabled = false;
    saveBenchmarkAccountBtn.textContent = "保存账号并生成今日任务";
  }
}

function clearBenchmarkAccountForm() {
  ["benchmarkAccountName", "benchmarkAccountHandle", "benchmarkAccountCategory", "benchmarkAccountWhy", "benchmarkAccountPatterns"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}

function setBenchmarkAccountMessage(state, message) {
  if (!benchmarkAccountMessage) return;
  benchmarkAccountMessage.textContent = message;
  benchmarkAccountMessage.className = `benchmark-account-message ${state}`;
}

function renderBenchmarkUpdateTasks(data) {
  if (!benchmarkUpdateList) return;
  const items = data.items || [];
  benchmarkUpdateTaskItems = items;
  benchmarkUpdateList.innerHTML = items.length
    ? `
      <div class="benchmark-update-summary">
        <strong>${escapeHtml(data.summary || "固定对标账号更新任务")}</strong>
        <span>目标：每个账号 ${data.targetPerAccount || 3} 条近期内容</span>
      </div>
      ${items.map((item) => benchmarkUpdateCard(item)).join("")}
    `
    : `<article class="benchmark-update-card"><strong>暂无固定对标账号</strong><p>先维护对标账号池，再生成每日更新任务。</p></article>`;
  if (activeBenchmarkTaskId || initialBenchmarkTaskId) {
    focusBenchmarkTaskCard(activeBenchmarkTaskId || initialBenchmarkTaskId);
  }
  renderP01ImportGuide(items.find((item) => String(item.id) === String(activeBenchmarkTaskId || initialBenchmarkTaskId)));
}

function benchmarkUpdateCard(item) {
  const patterns = Array.isArray(item.patterns) ? item.patterns.slice(0, 4) : [];
  const completionStandard = Array.isArray(item.completionStandard) ? item.completionStandard : [];
  const sourceQueue = Array.isArray(item.sourceQueue) ? item.sourceQueue : [];
  const qualityCounts = item.qualityCounts || {};
  const generationReadiness = item.generationReadiness || {};
  const payload = encodeURIComponent(JSON.stringify({
    id: item.id,
    platform: item.platform,
    accountName: item.accountName,
    title: `${item.accountName} 近期内容`,
    note: item.note || item.whyTrack || "",
  }));
  return `
    <article class="benchmark-update-card ${escapeHtml(item.status)} ${String(item.id) === String(activeBenchmarkTaskId) ? "active-task" : ""}" id="benchmark-task-${escapeHtml(item.id)}">
      <div class="benchmark-update-head">
        <div>
          <span>${platformText(item.platform)} / ${escapeHtml(item.category || "未分类")}</span>
          <strong>${escapeHtml(item.accountName)}</strong>
          <p>${escapeHtml(item.whyTrack || item.note || "补近期内容后，系统才能学习真实结构。")}</p>
        </div>
        <em>${escapeHtml(item.statusLabel || "待更新")}</em>
      </div>
      <div class="benchmark-update-metrics">
        <span><b>今日导入</b>${item.importedCount || 0}/${item.targetCount || 3}</span>
        <span><b>已结构化</b>${item.structuredCount || 0} 条</span>
        <span><b>账号标识</b>${escapeHtml(item.accountHandle || "-")}</span>
      </div>
      <div class="benchmark-update-brief">
        <strong>${escapeHtml(item.nextAction || "处理这个对标账号")}</strong>
        <p>${escapeHtml(item.statusReason || "按账号补近期内容，再结构化进入脚本生成。")}</p>
      </div>
      ${benchmarkGenerationReadinessHtml(generationReadiness)}
      ${benchmarkP01NextStepPanel(item)}
      ${benchmarkRealMaterialTaskSheet(item)}
      ${completionStandard.length ? `
        <div class="benchmark-update-standard">
          <b>完成标准</b>
          ${completionStandard.map((standard) => `<span>${escapeHtml(standard)}</span>`).join("")}
        </div>
      ` : ""}
      <div class="benchmark-source-quality">
        <div class="benchmark-source-quality-head">
          <div>
            <b>今日素材质量</b>
            <p>${sourceQueue.length ? "这个账号今天已导入的素材状态。" : "这个账号今天还没有导入素材。"}</p>
          </div>
          <span>${qualityCounts.structured || 0}/${qualityCounts.total || 0} 已结构化</span>
        </div>
        <div class="benchmark-source-quality-counts">
          <span><b>素材</b>${qualityCounts.total || 0}</span>
          <span><b>有字幕/正文</b>${qualityCounts.withText || 0}</span>
          <span><b>已加入生成</b>${qualityCounts.selected || 0}</span>
          <span><b>待补字幕</b>${qualityCounts.needSubtitle || 0}</span>
        </div>
        <div class="benchmark-source-queue">
          ${sourceQueue.length ? sourceQueue.map((source) => benchmarkSourceQueueItem(source)).join("") : `
            <article class="empty">
              <strong>还没有今日素材</strong>
              <p>先点“导入这个账号近期内容”，补链接、字幕或第三方表格行。</p>
            </article>
          `}
        </div>
      </div>
      ${patterns.length ? `<div class="benchmark-patterns">${patterns.map((pattern) => `<span>${escapeHtml(pattern)}</span>`).join("")}</div>` : ""}
      <div class="benchmark-update-actions">
        <button type="button" data-benchmark-import="${payload}">导入这个账号近期内容</button>
        <button type="button" data-benchmark-batch-import="${payload}">批量补这个账号</button>
        <button type="button" data-benchmark-blank-template="${payload}" data-template-mode="fill">填入空白任务单</button>
        <button type="button" data-benchmark-blank-template="${payload}" data-template-mode="copy">复制空白表头</button>
        <button type="button" data-benchmark-subtitle="${item.id}" ${(qualityCounts.needSubtitle || 0) ? "" : "disabled"} title="${(qualityCounts.needSubtitle || 0) ? "处理该账号今日素材的自动字幕任务" : "没有需要自动提取字幕的素材"}">处理待补字幕</button>
        <button type="button" data-benchmark-select="${item.id}" ${item.importedCount ? "" : "disabled"} title="${item.importedCount ? "把该账号今日素材加入生成工作流" : "先导入这个账号的近期内容"}">加入生成工作流</button>
        <button type="button" data-benchmark-structure="${item.id}" ${item.importedCount ? "" : "disabled"} title="${item.importedCount ? "为该账号今日素材生成结构摘要" : "先导入这个账号的近期内容"}">生成结构摘要</button>
        <button type="button" data-benchmark-generate="${item.id}" ${generationReadiness.ready ? "" : "disabled"} title="${generationReadiness.ready ? "进入脚本生成流程" : escapeHtml(generationReadiness.summary || "先补齐生成输入")}">${escapeHtml(generationReadiness.ready ? "去生成脚本" : "未达生成条件")}</button>
        ${item.status === "skipped"
          ? `<button type="button" data-benchmark-restore="${item.id}">${escapeHtml(item.recoveryAction || "恢复待更新")}</button>`
          : `<button type="button" data-benchmark-skip="${item.id}">今日跳过</button>`}
      </div>
    </article>
  `;
}

function benchmarkP01NextStepPanel(item) {
  const readiness = item.generationReadiness || {};
  const counts = readiness.counts || {};
  const qualityCounts = item.qualityCounts || {};
  const payload = encodeURIComponent(JSON.stringify({
    id: item.id,
    platform: item.platform,
    accountName: item.accountName,
    title: `${item.accountName} 近期内容`,
    note: item.note || item.whyTrack || "",
  }));
  let action = "import";
  let actionLabel = "导入真实素材";
  let title = "第 1 步：补 1 条真实近期内容";
  let description = "当前还没有这个账号的真实视频/笔记。先补真实链接、字幕正文或第三方表格行，空白和示例不会入库。";
  let blocked = false;
  if (Number(counts.total || item.importedCount || 0) > 0 && Number(counts.withText || qualityCounts.withText || 0) <= 0) {
    action = "subtitle";
    actionLabel = "处理字幕/正文";
    title = "第 2 步：补字幕或正文";
    description = "已有素材但缺少可结构化文本。自动字幕不可用时，直接粘贴旧字幕项目结果或手工整理正文。";
    blocked = !(qualityCounts.needSubtitle || 0);
  } else if (Number(counts.withText || qualityCounts.withText || 0) > 0 && Number(counts.selected || qualityCounts.selected || 0) <= 0) {
    action = "select";
    actionLabel = "加入生成工作流";
    title = "第 3 步：让生成读取这条素材";
    description = "有字幕/正文后，必须加入生成工作流；否则脚本生成不会读取这个账号素材。";
  } else if (Number(counts.selected || qualityCounts.selected || 0) > 0 && Number(counts.structured || item.structuredCount || 0) <= 0) {
    action = "structure";
    actionLabel = "生成结构摘要";
    title = "第 4 步：生成结构摘要";
    description = "脚本生成需要开头、节奏、镜头、卖点和 CTA，不应该只读取标题或账号名。";
  } else if (readiness.ready) {
    action = "generate";
    actionLabel = "去生成候选脚本";
    title = "第 5 步：进入脚本生成";
    description = "这个账号已有可生成输入，回到脚本流程确认素材包和品牌商品后生成候选脚本。";
  }
  const runOrder = [
    ["导入", Number(counts.total || item.importedCount || 0) > 0],
    ["文本", Number(counts.withText || qualityCounts.withText || 0) > 0],
    ["加入", Number(counts.selected || qualityCounts.selected || 0) > 0],
    ["结构", Number(counts.structured || item.structuredCount || 0) > 0],
    ["生成", Boolean(readiness.ready)],
  ];
  return `
    <div class="benchmark-p01-next-step ${escapeHtml(action)}">
      <div class="benchmark-p01-next-head">
        <div>
          <span>P0-1 NEXT STEP</span>
          <strong>${escapeHtml(title)}</strong>
          <p>${escapeHtml(description)}</p>
        </div>
        <button type="button" data-benchmark-p01-action="${escapeHtml(action)}" data-benchmark-payload="${payload}" data-benchmark-task-id="${escapeHtml(item.id)}" ${blocked ? "disabled" : ""}>${escapeHtml(actionLabel)}</button>
      </div>
      <div class="benchmark-p01-runline">
        ${runOrder.map(([label, done], index) => `
          <span class="${done ? "done" : index === runOrder.findIndex(([, itemDone]) => !itemDone) ? "current" : "waiting"}">
            <b>${String(index + 1).padStart(2, "0")}</b>${escapeHtml(label)}
          </span>
        `).join("")}
      </div>
      <small>${escapeHtml(readiness.summary || item.statusReason || "按真实素材闭环顺序推进。")}</small>
    </div>
  `;
}

function runBenchmarkP01Action(button) {
  const action = button.dataset.benchmarkP01Action || "import";
  const payload = button.dataset.benchmarkPayload || "";
  const taskId = button.dataset.benchmarkTaskId || "";
  if (action === "import") {
    prefillBenchmarkImport(payload);
  } else if (action === "subtitle") {
    bulkSubtitleBenchmarkTaskSources(taskId);
  } else if (action === "select") {
    bulkSelectBenchmarkTaskSources(taskId);
  } else if (action === "structure") {
    bulkStructureBenchmarkTaskSources(taskId);
  } else if (action === "generate") {
    window.location.href = "./index.html?v=benchmark-task-generate-v1#stepGenerate";
  }
}

function benchmarkRealMaterialTaskSheet(item) {
  const readiness = item.generationReadiness || {};
  const blockers = Array.isArray(readiness.blockers) ? readiness.blockers : [];
  const fields = [
    ["标题", "真实视频/笔记标题，不能写示例或占位"],
    ["链接", "真实作品链接；没有链接时必须补字幕/正文"],
    ["账号", item.accountName || "固定对标账号"],
    ["平台", platformText(item.platform)],
    ["字幕", "可粘贴旧字幕项目结果或手工转写"],
    ["备注", "为什么值得参考：开头、节奏、转场、CTA"],
  ];
  return `
    <div class="benchmark-real-task-sheet ${escapeHtml(readiness.level || "missing_sources")}">
      <div class="benchmark-real-task-head">
        <div>
          <b>P0-1 真实素材任务单</b>
          <p>目标不是填满账号池，而是先补 1 条真实近期内容，让这条内容能进入脚本生成输入证据。</p>
        </div>
        <span>${escapeHtml(readiness.statusLabel || "待补真实素材")}</span>
      </div>
      <div class="benchmark-real-task-fields">
        ${fields.map(([label, help]) => `
          <article>
            <strong>${escapeHtml(label)}</strong>
            <p>${escapeHtml(help)}</p>
          </article>
        `).join("")}
      </div>
      ${blockers.length ? `<div class="benchmark-real-task-blockers">${blockers.map((blocker) => `<em>${escapeHtml(blocker)}</em>`).join("")}</div>` : ""}
      <div class="benchmark-real-task-rules">
        <span>不能使用 example.com、replace-video、测试、示例链接。</span>
        <span>只有账号名或热点词不算真实素材。</span>
        <span>导入后必须继续加入生成并生成结构摘要。</span>
      </div>
    </div>
  `;
}

function benchmarkGenerationReadinessHtml(readiness = {}) {
  const counts = readiness.counts || {};
  const blockers = Array.isArray(readiness.blockers) ? readiness.blockers : [];
  return `
    <div class="benchmark-generation-readiness ${escapeHtml(readiness.level || "unknown")}">
      <div class="benchmark-generation-readiness-head">
        <div>
          <b>生成输入就绪</b>
          <strong>${escapeHtml(readiness.statusLabel || "待检查")}</strong>
        </div>
        <span>${readiness.readyCount || 0}/${readiness.targetCount || 1} 可生成</span>
      </div>
      <p>${escapeHtml(readiness.summary || "先补齐近期内容、字幕/正文、加入生成和结构摘要。")}</p>
      <div class="benchmark-generation-counts">
        <span><b>素材</b>${counts.total || 0}</span>
        <span><b>有文本</b>${counts.withText || 0}</span>
        <span><b>已加入</b>${counts.selected || 0}</span>
        <span><b>已结构化</b>${counts.structured || 0}</span>
      </div>
      ${blockers.length ? `<div class="benchmark-generation-blockers">${blockers.map((blocker) => `<em>${escapeHtml(blocker)}</em>`).join("")}</div>` : ""}
      <small>下一步：${escapeHtml(readiness.nextAction || "补齐生成输入")}</small>
    </div>
  `;
}

function benchmarkSourceQueueItem(source) {
  const canSubtitle = source.hasUrl && source.status !== "structured";
  const canSelect = !source.selected;
  const canStructure = !source.structured;
  return `
    <article class="${escapeHtml(source.status || "")}">
      <div>
        <strong>${escapeHtml(source.title || "未命名素材")}</strong>
        <span>${escapeHtml(source.statusLabel || "待处理")}</span>
      </div>
      <p>${escapeHtml(source.nextAction || "去处理")} / ${source.selected ? "已加入生成" : "未加入生成"} / ${source.structured ? "已结构化" : "未结构化"}</p>
      <div class="benchmark-source-actions">
        <button type="button" data-benchmark-source-open="${escapeHtml(source.id)}">查看素材</button>
        <button type="button" data-benchmark-source-subtitle="${escapeHtml(source.id)}" ${canSubtitle ? "" : "disabled"}>提取字幕</button>
        <button type="button" data-benchmark-source-select="${escapeHtml(source.id)}" ${canSelect ? "" : "disabled"}>加入生成</button>
        <button type="button" data-benchmark-source-structure="${escapeHtml(source.id)}" ${canStructure ? "" : "disabled"}>生成结构摘要</button>
      </div>
    </article>
  `;
}

async function runBenchmarkSourceAction(button, action) {
  const sourceId = button.dataset.benchmarkSourceSubtitle
    || button.dataset.benchmarkSourceSelect
    || button.dataset.benchmarkSourceStructure;
  if (!sourceId) return;
  const card = button.closest(".benchmark-update-card");
  const taskId = card?.id?.replace("benchmark-task-", "") || activeBenchmarkTaskId;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "处理中...";
  try {
    if (action === "subtitle") {
      const target = document.querySelector(`[data-content-subtitle-job="${sourceId}"]`);
      if (!target) throw new Error("请先刷新内容池后再处理字幕");
      await createSubtitleJob(target);
    } else if (action === "select") {
      const target = document.querySelector(`[data-content-select="${sourceId}"]`);
      if (!target) throw new Error("请先刷新内容池后再加入生成");
      await toggleContentSource(target);
    } else if (action === "structure") {
      const target = document.querySelector(`[data-content-structure="${sourceId}"]`);
      if (!target) throw new Error("请先刷新内容池后再结构化");
      await structureContentSource(target);
    }
    await loadBenchmarkUpdateTasks();
    focusBenchmarkTaskCard(taskId);
    if (isP01VerifierReturn) {
      renderPostImportNextPanel({
        sourceLabel: `对标任务 #${taskId}`,
        title: "账号素材动作已执行",
        description: "这一步已经尝试更新素材状态。回到 P0-1 验收器后，系统会重新读取库表证据判断是否通过。",
        importedCount: 1,
        selectedCount: action === "select" ? 1 : 0,
        structuredCount: action === "structure" ? 1 : 0,
        status: "ready",
        badge: "可复核验收",
        benchmarkTaskId: taskId,
        actions: [
          p01ReturnAction(taskId, true),
          { action: "benchmark-focus", label: "回到账号任务卡", benchmarkTaskId: taskId },
        ].filter(Boolean),
      });
    }
  } catch (error) {
    setImportMessage("warning", `账号素材处理失败：${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function bulkSubtitleBenchmarkTaskSources(taskId) {
  if (!taskId) return;
  setImportMessage("", "正在处理这个对标账号的待补字幕素材...");
  try {
    const response = await fetch(`${CONTENT_API_BASE}/api/v2/content-sources/bulk-subtitle-jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "benchmark_task", benchmarkUpdateTaskId: Number(taskId), limit: 5 }),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    setImportMessage(data.failed ? "warning" : "ok", `对标账号字幕处理完成：成功 ${data.success} 条，失败 ${data.failed} 条。`);
    renderBulkActionResult(data.results || [], "这个对标账号今天没有需要自动提取字幕的链接素材。");
    renderPostImportNextPanel({
      sourceLabel: `对标任务 #${taskId}`,
      title: `字幕任务完成：成功 ${data.success} 条`,
      description: data.success
        ? "字幕文本已回写素材。下一步生成结构摘要，让脚本生成读取这批对标内容。"
        : "如果自动字幕不可用，请在素材卡手工粘贴字幕或正文后再结构化。",
      importedCount: data.results?.length || data.success || 0,
      selectedCount: 0,
      structuredCount: 0,
      failedCount: data.failed || 0,
      status: data.success ? "ready" : "warning",
      badge: data.success ? "下一步：结构化" : "需要手工字幕",
      actions: data.success ? [
        p01ReturnAction(taskId, false),
        { action: "scroll-pool", label: "查看内容池列表" },
      ].filter(Boolean) : [
        p01ReturnAction(taskId, false),
        { action: "scroll-pool", label: "查看内容池列表", primary: true },
      ].filter(Boolean),
    });
    await refreshContentPoolAfterAction();
    await loadBenchmarkUpdateTasks();
    focusBenchmarkTaskCard(taskId);
  } catch (error) {
    setImportMessage("warning", `对标账号字幕处理失败：${error.message}`);
  }
}

async function bulkSelectBenchmarkTaskSources(taskId) {
  if (!taskId) return;
  setImportMessage("", "正在把这个对标账号的今日素材加入生成工作流...");
  try {
    const response = await fetch(`${CONTENT_API_BASE}/api/v2/content-sources/bulk-select`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "benchmark_task", benchmarkUpdateTaskId: Number(taskId), limit: 10 }),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    setImportMessage("ok", `已加入生成工作流：${data.success} 条。`);
    renderBulkActionResult(data.results || [], "这个对标账号今天还没有可加入的素材。");
    renderPostImportNextPanel({
      sourceLabel: `对标任务 #${taskId}`,
      title: `已加入生成工作流：${data.success} 条`,
      description: data.success
        ? "下一步生成结构摘要，让脚本生成读取这批对标素材。"
        : "这个账号任务还没有导入素材，请先导入近期内容。",
      importedCount: data.results?.length || data.success || 0,
      selectedCount: data.success || 0,
      structuredCount: 0,
      status: data.success ? "ready" : "warning",
      actions: data.success ? [
        p01ReturnAction(taskId, false),
        { action: "scroll-pool", label: "查看内容池列表" },
      ].filter(Boolean) : [
        p01ReturnAction(taskId, false),
        { action: "scroll-pool", label: "查看内容池列表", primary: true },
      ].filter(Boolean),
    });
    await refreshContentPoolAfterAction();
    await loadBenchmarkUpdateTasks();
    focusBenchmarkTaskCard(taskId);
  } catch (error) {
    setImportMessage("warning", `对标任务加入生成失败：${error.message}`);
  }
}

async function advanceBenchmarkTask(taskId) {
  if (!taskId) return;
  setImportMessage("", "正在推进 P0-1：先加入生成工作流，再尝试生成结构摘要...");
  try {
    const selectResponse = await fetch(`${CONTENT_API_BASE}/api/v2/content-sources/bulk-select`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "benchmark_task", benchmarkUpdateTaskId: Number(taskId), limit: 10 }),
    });
    const selectData = await selectResponse.json();
    if (!selectResponse.ok || selectData.ok === false) {
      throw new Error(selectData.error || `HTTP ${selectResponse.status}`);
    }
    const structureResponse = await fetch(`${CONTENT_API_BASE}/api/v2/content-sources/bulk-structure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "benchmark_task", benchmarkUpdateTaskId: Number(taskId), limit: 5 }),
    });
    const structureData = await structureResponse.json();
    if (!structureResponse.ok || structureData.ok === false) {
      throw new Error(structureData.error || `HTTP ${structureResponse.status}`);
    }
    const selected = Number(selectData.success || 0);
    const structured = Number(structureData.success || 0);
    const failed = Number(structureData.failed || 0);
    setImportMessage(
      structured ? "ok" : "warning",
      structured
        ? `P0-1 已推进：加入生成 ${selected} 条，结构化 ${structured} 条。现在可以进入脚本流程。`
        : `已尝试推进：加入生成 ${selected} 条，结构化 ${structured} 条${failed ? `，失败 ${failed} 条` : ""}。如果缺字幕/正文，请先补文本。`,
    );
    renderBulkActionResult(structureData.results || selectData.results || [], "这个对标账号还没有可推进的真实素材。");
    renderPostImportNextPanel({
      sourceLabel: `对标任务 #${taskId}`,
      title: structured ? "P0-1 已推进到可生成结构输入" : "P0-1 推进未完成",
      description: structured
        ? "这条账号素材已经加入生成并生成结构摘要。下一步进入脚本流程，确认素材包和品牌商品后生成候选脚本。"
        : "系统已尝试加入生成和结构化；如果结构化失败，通常是素材缺字幕/正文或不是真实运营素材。",
      importedCount: selectData.results?.length || selected || 0,
      selectedCount: selected,
      structuredCount: structured,
      failedCount: failed,
      status: structured ? "ready" : "warning",
      badge: structured ? "可去生成脚本" : "需要补文本",
      benchmarkTaskId: taskId,
      benchmarkTitle: structured ? "固定对标账号素材已进入结构输入" : "固定对标账号素材还缺处理",
      benchmarkNext: structured
        ? "回到 V2 工作台后，执行队列会从 P0-1 推进到生成准备度和候选脚本生成。"
        : "回到账号任务卡后，按 P0-1 NEXT STEP 补字幕/正文或检查真实素材规则。",
      actions: structured ? [
        p01ReturnAction(taskId, true),
        { action: "script-flow", label: "进入脚本流程", primary: !isP01VerifierReturn },
        { action: "benchmark-focus", label: "回到账号任务卡", benchmarkTaskId: taskId },
      ].filter(Boolean) : [
        p01ReturnAction(taskId, false),
        { action: "benchmark-subtitle", label: "处理待补字幕", benchmarkTaskId: taskId, primary: true },
        { action: "benchmark-focus", label: "回到账号任务卡", benchmarkTaskId: taskId },
      ].filter(Boolean),
    });
    await refreshContentPoolAfterAction();
    focusBenchmarkTaskCard(taskId);
  } catch (error) {
    setImportMessage("warning", `P0-1 快速推进失败：${error.message}`);
  }
}

async function bulkStructureBenchmarkTaskSources(taskId) {
  if (!taskId) return;
  setImportMessage("", "正在结构化这个对标账号的今日素材...");
  try {
    const response = await fetch(`${CONTENT_API_BASE}/api/v2/content-sources/bulk-structure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "benchmark_task", benchmarkUpdateTaskId: Number(taskId), limit: 5 }),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    setImportMessage(data.failed ? "warning" : "ok", `对标任务结构化完成：成功 ${data.success} 条，失败 ${data.failed} 条。`);
    renderBulkActionResult(data.results || [], "这个对标账号今天没有需要结构化的素材。");
    renderPostImportNextPanel({
      sourceLabel: `对标任务 #${taskId}`,
      title: `结构摘要完成：成功 ${data.success} 条`,
      description: data.success
        ? "这批对标素材已经进入结构输入，可以进入脚本流程生成候选脚本。"
        : "如果没有可结构化素材，请先导入链接、字幕或正文，并加入生成工作流。",
      importedCount: data.results?.length || data.success || 0,
      selectedCount: data.results?.length || data.success || 0,
      structuredCount: data.success || 0,
      failedCount: data.failed || 0,
      status: data.success ? "ready" : "warning",
      badge: data.success ? "可去生成脚本" : "需要补素材",
      actions: data.success ? [
        p01ReturnAction(taskId, true),
        { action: "script-flow", label: "进入脚本流程", primary: !isP01VerifierReturn },
        { action: "scroll-pool", label: "查看结构摘要" },
      ].filter(Boolean) : [
        p01ReturnAction(taskId, false),
        { action: "scroll-pool", label: "查看内容池列表", primary: true },
      ].filter(Boolean),
    });
    await refreshContentPoolAfterAction();
    focusBenchmarkTaskCard(taskId);
  } catch (error) {
    setImportMessage("warning", `对标任务结构化失败：${error.message}`);
  }
}

function prefillBenchmarkImport(encodedPayload) {
  if (!encodedPayload) return;
  const payload = decodeBenchmarkPayload(encodedPayload);
  const platformEl = document.getElementById("contentPlatform");
  const titleEl = document.getElementById("contentTitle");
  const accountEl = document.getElementById("contentAccount");
  const rawTextEl = document.getElementById("contentRawText");
  const benchmarkTaskEl = document.getElementById("benchmarkUpdateTaskId");
  if (platformEl) platformEl.value = payload.platform || "douyin";
  if (titleEl) titleEl.value = payload.title || "";
  if (accountEl) accountEl.value = payload.accountName || "";
  if (rawTextEl && !rawTextEl.value.trim()) rawTextEl.value = payload.note || "";
  if (benchmarkTaskEl) benchmarkTaskEl.value = payload.id || "";
  activeBenchmarkTaskId = payload.id ? String(payload.id) : "";
  renderR2InputPackage();
  document.querySelectorAll(".benchmark-update-card.active-task").forEach((card) => card.classList.remove("active-task"));
  document.getElementById(`benchmark-task-${activeBenchmarkTaskId}`)?.classList.add("active-task");
  document.getElementById("manual-import")?.scrollIntoView({ behavior: "smooth", block: "start" });
  setImportMessage("ok", `已带入「${payload.accountName || "对标账号"}」的今日更新任务；导入后会自动刷新这张任务卡。`);
}

function prefillBenchmarkBatchImport(encodedPayload) {
  if (!encodedPayload) return;
  const payload = decodeBenchmarkPayload(encodedPayload);
  const batchEl = document.getElementById("contentBatchText");
  const platformEl = document.getElementById("contentPlatform");
  const accountEl = document.getElementById("contentAccount");
  const benchmarkTaskEl = document.getElementById("benchmarkUpdateTaskId");
  const platform = payload.platform || "douyin";
  const accountName = payload.accountName || "对标账号";
  if (platformEl) platformEl.value = platform;
  if (accountEl) accountEl.value = accountName;
  if (benchmarkTaskEl) benchmarkTaskEl.value = payload.id || "";
  activeBenchmarkTaskId = payload.id ? String(payload.id) : "";
  renderR2InputPackage();
  if (batchEl) {
    batchEl.value = benchmarkBatchTemplateText(platform, accountName);
    batchEl.focus();
  }
  renderSourceTaskBrief({
    platform,
    importMode: "batch",
    title: `${accountName} 批量补近期内容`,
    account: accountName,
    note: "把这个账号最近 1-3 条视频/笔记按模板填完整；至少保留链接、字幕/正文或备注其一。",
  });
  renderBatchPreview();
  focusBenchmarkTaskCard(activeBenchmarkTaskId);
  document.getElementById("batch-import")?.scrollIntoView({ behavior: "smooth", block: "start" });
  setImportMessage("ok", `已为「${accountName}」填入批量导入模板；替换链接/字幕后再解析导入，未点击导入前不会入库。`);
}

async function fillBenchmarkBlankTemplate(encodedPayload, mode = "fill") {
  if (!encodedPayload) return;
  const payload = decodeBenchmarkPayload(encodedPayload);
  const platform = payload.platform || "douyin";
  const accountName = payload.accountName || "对标账号";
  const template = benchmarkBlankTemplateText(platform, accountName);
  activeBenchmarkTaskId = payload.id ? String(payload.id) : "";
  const benchmarkTaskEl = document.getElementById("benchmarkUpdateTaskId");
  const platformEl = document.getElementById("contentPlatform");
  const accountEl = document.getElementById("contentAccount");
  if (benchmarkTaskEl) benchmarkTaskEl.value = payload.id || "";
  if (platformEl) platformEl.value = platform;
  if (accountEl) accountEl.value = accountName;
  if (mode === "copy") {
    await copyBatchTemplateText(template);
    setImportMessage("ok", `已复制「${accountName}」空白任务单。粘贴到飞书或表格里填写真实链接/字幕后再导入。`);
    return;
  }
  const batchEl = document.getElementById("contentBatchText");
  if (batchEl) {
    batchEl.value = template;
    batchEl.focus();
  }
  renderSourceTaskBrief({
    platform,
    importMode: "batch",
    importPath: "third_party_table",
    title: `${accountName} P0-1真实素材任务单`,
    account: accountName,
    note: "这是空白任务单，不含示例链接。请填写真实作品链接、字幕或结构观察后再预检导入。",
  });
  renderBatchPreview();
  focusBenchmarkTaskCard(activeBenchmarkTaskId);
  document.getElementById("batch-import")?.scrollIntoView({ behavior: "smooth", block: "start" });
  setImportMessage("ok", `已填入「${accountName}」空白任务单。请填写真实链接/字幕后预检；空白行不会入库。`);
}

function decodeBenchmarkPayload(encodedPayload) {
  try {
    return JSON.parse(decodeURIComponent(encodedPayload));
  } catch {
    return {};
  }
}

function benchmarkBlankTemplateText(platform, accountName) {
  const platformLabel = platformText(platform);
  return [
    "标题\t链接\t账号\t平台\t字幕\t备注",
    `\t\t${accountName}\t${platformLabel}\t\t`,
    `\t\t${accountName}\t${platformLabel}\t\t`,
    `\t\t${accountName}\t${platformLabel}\t\t`,
  ].join("\n");
}

function benchmarkBatchTemplateText(platform, accountName) {
  return benchmarkBlankTemplateText(platform, accountName);
}

function focusBenchmarkTaskCard(taskId) {
  if (!taskId) return;
  activeBenchmarkTaskId = String(taskId);
  const benchmarkTaskEl = document.getElementById("benchmarkUpdateTaskId");
  if (benchmarkTaskEl && !benchmarkTaskEl.value) benchmarkTaskEl.value = activeBenchmarkTaskId;
  requestAnimationFrame(() => {
    const card = document.getElementById(`benchmark-task-${taskId}`);
    if (!card) return;
    document.querySelectorAll(".benchmark-update-card.active-task").forEach((item) => {
      if (item !== card) item.classList.remove("active-task");
    });
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.classList.add("active-task");
  });
}

async function updateBenchmarkTask(id, status) {
  if (!id) return;
  try {
    const response = await fetch(`${CONTENT_API_BASE}/api/v2/benchmark-update-tasks/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    setImportMessage("ok", `已更新对标账号任务：${data.item.accountName}`);
    await loadBenchmarkUpdateTasks();
  } catch (error) {
    setImportMessage("warning", `对标账号任务更新失败：${error.message}`);
  }
}

function renderContentSources(items) {
  if (!contentPoolList) return;
  contentPoolList.innerHTML = items.length
    ? items.map((item) => contentSourceCard(item)).join("")
    : `<article class="content-source-card"><strong>暂无内容</strong><p>先导入链接、字幕或第三方表格。</p></article>`;
}

function contentSourceCard(item) {
  const structure = item.structure;
  const isExcluded = item.isOperationalReal === false;
  const guide = contentSourceGuide(item);
  const workflowBadge = isExcluded ? "不计入生成" : (item.selected ? "已加入生成" : "未加入");
  const selectActionHtml = isExcluded
    ? (item.selected
      ? `<button type="button" data-content-select="${item.id}" data-selected="0">移出历史选中标记</button>`
      : `<button type="button" disabled title="测试/示例素材不能加入真实生成工作流">不能加入真实生成</button>`)
    : `<button type="button" data-content-select="${item.id}" data-selected="${item.selected ? "0" : "1"}">${item.selected ? "移出生成工作流" : "加入生成工作流"}</button>`;
  return `
    <article class="content-source-card ${item.selected ? "selected" : ""} ${isExcluded ? "not-operational-real" : ""}" id="content-source-${item.id}">
      <div class="content-source-head">
        <div>
          <strong>${escapeHtml(item.title)}</strong>
          <p>${platformText(item.platform)} / ${escapeHtml(item.accountName || "未知来源")} / ${statusText(item.status)}</p>
        </div>
        <div class="content-source-badges">
          <span>${workflowBadge}</span>
          <span class="content-source-real-badge ${isExcluded ? "excluded" : "real"}">${escapeHtml(item.realMaterialStatusLabel || (isExcluded ? "不计入真实闭环" : "真实运营素材"))}</span>
        </div>
      </div>
      ${realMaterialNotice(item)}
      ${contentSourceGuideHtml(guide, item)}
      <div class="content-source-meta">
        <span>${sourceTypeText(item.sourceType)}</span>
        <span>${item.workdayDate || ""}</span>
        ${item.benchmarkUpdateTaskId ? `<span>对标更新任务 #${item.benchmarkUpdateTaskId}</span>` : ""}
        ${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank">查看链接</a>` : "<span>无链接</span>"}
      </div>
      ${subtitlePanel(item)}
      ${subtitleJobPanel(item)}
      ${structure ? structurePreview(structure) : `<div class="v2-structure-preview pending"><strong>未结构化</strong><p>生成结构摘要后，脚本生成会读取开头、节奏、CTA 和风险。</p></div>`}
      <div class="content-source-actions">
        ${selectActionHtml}
        <button type="button" data-content-structure="${item.id}">生成结构摘要</button>
      </div>
    </article>
  `;
}

function contentSourceGuide(item) {
  const isExcluded = item.isOperationalReal === false;
  const structureStatus = item.structure?.status || "";
  const structureDone = structureStatus === "structure_done";
  const hasText = Boolean((item.rawText || "").trim());
  const hasUrl = Boolean(item.url);
  if (isExcluded) {
    return {
      status: "blocked",
      label: "不能推进",
      title: "这条素材不计入真实闭环",
      body: item.realMaterialReason || "命中测试、示例、验证或占位规则。",
      action: "open",
      actionLabel: "查看原因",
      completion: "换成真实对标视频/笔记后，才会进入 R2 计数。",
    };
  }
  if (!hasText && !hasUrl) {
    return {
      status: "needs_text",
      label: "先补内容",
      title: "缺字幕、正文或真实链接",
      body: "系统还不知道这条素材讲了什么，不能抽结构，也不能生成高质量脚本。",
      action: "manual_subtitle",
      actionLabel: "补字幕正文",
      completion: "补到至少 30 字，或提供真实视频链接。",
    };
  }
  if (!hasText && hasUrl) {
    return {
      status: "needs_subtitle",
      label: "先提字幕",
      title: "有链接，但缺字幕/正文",
      body: "优先尝试自动字幕；失败后直接粘贴手工字幕，不要卡在自动采集。",
      action: "subtitle_job",
      actionLabel: "提取字幕",
      secondaryAction: "manual_subtitle",
      secondaryLabel: "手工粘贴",
      completion: "保存字幕后再生成结构摘要。",
    };
  }
  if (!item.selected) {
    return {
      status: "needs_select",
      label: "加入生成",
      title: "这条素材还不会被脚本生成读取",
      body: "加入生成工作流后，它才会进入脚本输入包和 R2 候选素材诊断。",
      action: "select",
      actionLabel: "加入生成",
      completion: "加入后继续生成结构摘要。",
    };
  }
  if (!structureDone) {
    return {
      status: "needs_structure",
      label: "生成结构",
      title: "已加入生成，但还缺结构摘要",
      body: "需要抽出开头、节奏、转场、CTA 和风险，脚本生成才有可借鉴结构。",
      action: "structure",
      actionLabel: "生成结构摘要",
      completion: "结构状态达到 structure_done 后计入 R2 真实结构素材。",
    };
  }
  return {
    status: "ready",
    label: "可进入脚本",
    title: "这条素材已具备生成输入条件",
    body: "已加入生成工作流，并且有 structure_done 结构摘要。",
    action: "script_flow",
    actionLabel: "进入脚本流程",
    completion: "生成脚本时应能在生成依据里看到这条素材。",
  };
}

function contentSourceGuideHtml(guide, item) {
  return `
    <div class="content-source-guide ${escapeHtml(guide.status || "waiting")}">
      <div>
        <span>${escapeHtml(guide.label || "下一步")}</span>
        <strong>${escapeHtml(guide.title || "查看素材状态")}</strong>
        <p>${escapeHtml(guide.body || "")}</p>
        <small>完成标准：${escapeHtml(guide.completion || "完成后继续推进下一步。")}</small>
      </div>
      <div class="content-source-guide-actions">
        <button type="button" data-source-guide-action="${escapeHtml(guide.action || "open")}" data-source-id="${item.id}">${escapeHtml(guide.actionLabel || "查看素材")}</button>
        ${guide.secondaryAction ? `<button type="button" data-source-guide-action="${escapeHtml(guide.secondaryAction)}" data-source-id="${item.id}">${escapeHtml(guide.secondaryLabel || "备用动作")}</button>` : ""}
      </div>
    </div>
  `;
}

function handleSourceGuideAction(button) {
  const action = button.dataset.sourceGuideAction;
  const sourceId = button.dataset.sourceId;
  if (action === "select") {
    const target = sourceId ? document.querySelector(`[data-content-select="${sourceId}"]`) : null;
    if (target) toggleContentSource(target);
    return;
  }
  if (action === "structure") {
    const target = sourceId ? document.querySelector(`[data-content-structure="${sourceId}"]`) : null;
    if (target) structureContentSource(target);
    return;
  }
  if (action === "subtitle_job") {
    const target = sourceId ? document.querySelector(`[data-content-subtitle-job="${sourceId}"]`) : null;
    if (target) createSubtitleJob(target);
    return;
  }
  if (action === "manual_subtitle" || action === "open") {
    scrollToContentSource(sourceId, true);
    return;
  }
  if (action === "script_flow") {
    window.location.href = "./index.html?v=source-guide-v1#stepGenerate";
  }
}

function realMaterialNotice(item) {
  if (item.isOperationalReal !== false) return "";
  return `
    <div class="content-source-real-notice">
      <strong>不作为真实跑通证据</strong>
      <span>${escapeHtml(item.realMaterialReason || "命中非运营素材规则")}</span>
    </div>
  `;
}

function subtitlePanel(item) {
  const hasText = Boolean(item.rawText);
  return `
    <details class="content-subtitle-panel" ${hasText ? "" : "open"}>
      <summary>${hasText ? "查看 / 更新字幕文本" : "补充字幕文本"}</summary>
      ${hasText ? `<p class="content-source-text">${escapeHtml(truncateText(item.rawText, 180))}</p>` : `<p class="subtitle-empty">这条素材目前只有链接或备注。补字幕后再生成结构摘要，脚本质量会更稳。</p>`}
      <textarea data-subtitle-input="${item.id}" rows="4" placeholder="粘贴视频字幕、笔记正文或你从旧字幕项目提取出的文本。">${escapeHtml(item.rawText || "")}</textarea>
      <div class="subtitle-actions">
        <button type="button" data-content-subtitle="${item.id}">${hasText ? "更新字幕" : "保存字幕"}</button>
        <span>${hasText ? "已带字幕，可继续结构化。" : "手工字幕是自动字幕失败时的替代入口。"}</span>
      </div>
    </details>
  `;
}

function subtitleJobPanel(item) {
  const job = item.subtitleJob;
  const canAuto = Boolean(item.url);
  const status = job?.status || (canAuto ? "not_started" : "no_url");
  const statusLabel = subtitleJobStatusText(status);
  return `
    <div class="subtitle-job-panel ${escapeHtml(status)}">
      <div>
        <strong>自动字幕任务</strong>
        <span>${escapeHtml(statusLabel)}</span>
      </div>
      <p>${subtitleJobDescription(item, job)}</p>
      ${job?.error ? `<small>失败原因：${escapeHtml(job.error)}</small>` : ""}
      <div class="subtitle-actions">
        <button type="button" data-content-subtitle-job="${item.id}" ${canAuto ? "" : "disabled"}>${job ? "重新提取字幕" : "提取字幕"}</button>
        <span>${canAuto ? "会调用本地 video-tools；失败后可继续手工粘贴字幕。" : "没有链接，不能自动提取；请直接手工粘贴字幕。"}</span>
      </div>
    </div>
  `;
}

function subtitleJobDescription(item, job) {
  if (!item.url) return "这条素材只有文本或备注，没有可调用的链接。";
  if (!job) return "还没有创建自动字幕任务。点击后会尝试调用本地 video-tools。";
  if (job.status === "success") return `已提取字幕 ${job.textLength || 0} 字，分段 ${job.segmentCount || 0} 条，已写回内容池。`;
  if (job.status === "failed") return job.fallbackAction || "自动字幕失败，请粘贴手工字幕后继续结构化。";
  if (job.status === "running") return "字幕任务运行中。";
  return "等待处理字幕任务。";
}

async function createSubtitleJob(button) {
  const id = button.dataset.contentSubtitleJob;
  if (!id) return;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "提取中...";
  setImportMessage("", "正在调用本地 video-tools 提取字幕；如果服务未启动，会显示失败原因。");
  try {
    const response = await fetch(`${CONTENT_API_BASE}/api/v2/content-sources/${id}/subtitle-job`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    if (data.job?.status === "success") {
      setImportMessage("ok", `字幕已提取并写回：${data.item.title}。下一步生成结构摘要。`);
      renderSubtitleSavedNextPanel(data.item || {});
    } else {
      setImportMessage("warning", `字幕提取失败：${data.job?.error || "请改用手工字幕"}`);
    }
    await refreshContentPoolAfterAction();
  } catch (error) {
    setImportMessage("warning", `字幕任务失败：${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function structurePreview(structure) {
  const body = structure.structure || {};
  const usable = Array.isArray(body.usable_parts) ? body.usable_parts.slice(0, 4) : [];
  const risks = Array.isArray(body.risk_notes) ? body.risk_notes.slice(0, 3) : [];
  return `
    <div class="v2-structure-preview">
      <strong>${escapeHtml(body.script_pattern || body.hook_angle || "结构摘要")}</strong>
      <p>${escapeHtml(body.status_note || "已生成结构摘要。")}</p>
      ${usable.length ? `<div>${usable.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>` : ""}
      ${risks.length ? `<small>风险：${risks.map(escapeHtml).join(" / ")}</small>` : ""}
    </div>
  `;
}

async function saveSubtitleText(button) {
  const id = button.dataset.contentSubtitle;
  const textarea = document.querySelector(`[data-subtitle-input="${id}"]`);
  const rawText = textarea?.value.trim() || "";
  if (!rawText) {
    setImportMessage("warning", "请先粘贴字幕文本。");
    return;
  }
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "保存中...";
  try {
    const response = await fetch(`${CONTENT_API_BASE}/api/v2/content-sources/${id}/subtitle-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawText }),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    setImportMessage("ok", `字幕已保存：${data.item.title}。下一步生成结构摘要。`);
    renderSubtitleSavedNextPanel(data.item || {});
    await refreshContentPoolAfterAction();
  } catch (error) {
    setImportMessage("warning", `字幕保存失败：${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function saveContentSource() {
  const title = document.getElementById("contentTitle")?.value.trim() || "";
  const platform = document.getElementById("contentPlatform")?.value || "douyin";
  const url = document.getElementById("contentUrl")?.value.trim() || "";
  const accountName = document.getElementById("contentAccount")?.value.trim() || "";
  const rawText = document.getElementById("contentRawText")?.value.trim() || "";
  const benchmarkUpdateTaskId = document.getElementById("benchmarkUpdateTaskId")?.value.trim() || "";
  setImportMessage("", "正在导入...");
  if (!title || (!url && !rawText)) {
    setImportMessage("warning", "请至少填写标题，并填写链接或字幕/备注。");
    clearPostImportNextPanel();
    return;
  }
  saveContentSourceBtn.disabled = true;
  try {
    const response = await fetch(`${CONTENT_API_BASE}/api/v2/content-sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform,
        sourceType: rawText && !url ? "manual_note" : "benchmark_video",
        title,
        url,
        accountName,
        rawText,
        note: rawText && url ? rawText : "",
        benchmarkUpdateTaskId: benchmarkUpdateTaskId ? Number(benchmarkUpdateTaskId) : undefined,
      }),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    setImportMessage("ok", `已导入：${data.item.title}`);
    const taskScoped = Boolean(benchmarkUpdateTaskId);
    renderPostImportNextPanel({
      sourceLabel: taskScoped ? `固定对标任务 #${benchmarkUpdateTaskId}` : `${platformText(platform)} / 单条导入`,
      title: `已导入「${data.item.title}」`,
      description: taskScoped
        ? "这条素材已绑定当前对标账号任务。下一步在账号卡里处理字幕、加入生成工作流并结构化。"
        : "这条素材已经进入内容池。下一步先加入生成工作流，再生成结构摘要，脚本生成才会读取它。",
      importedCount: 1,
      failedCount: 0,
      selectedCount: data.item.selected ? 1 : 0,
      structuredCount: data.item.structure ? 1 : 0,
      evidenceItems: [data.item],
      status: "ready",
      r2Slot: activeR2Slot,
      r2Next: rawText
        ? "素材已带字幕/正文。下一步加入生成工作流并生成结构摘要，完成后该槽位才计入 R2。"
        : "素材已入库但缺字幕/正文。下一步先提取或粘贴字幕，再加入生成并结构化。",
      benchmarkTaskId: taskScoped ? benchmarkUpdateTaskId : "",
      benchmarkTitle: taskScoped ? "这条素材已进入固定对标账号任务" : "",
      benchmarkNext: taskScoped ? "页面已刷新该账号任务卡。回到卡片后，P0-1 NEXT STEP 会按真实状态提示下一步：补字幕、加入生成或结构化。" : "",
      actions: taskScoped ? [
        p01ReturnAction(benchmarkUpdateTaskId, false),
        { action: "benchmark-advance", label: rawText ? "加入生成并结构化" : "加入生成工作流", benchmarkTaskId: benchmarkUpdateTaskId, primary: !isP01VerifierReturn },
        { action: "benchmark-focus", label: "回到账号任务卡", benchmarkTaskId: benchmarkUpdateTaskId },
        { action: "benchmark-subtitle", label: "处理待补字幕", benchmarkTaskId: benchmarkUpdateTaskId },
      ].filter(Boolean) : [
        { action: "scroll-pool", label: "去内容池处理这条素材", primary: true },
        { action: "bulk-select", label: "批量加入生成工作流" },
        { action: "bulk-structure", label: "批量生成结构摘要" },
      ],
    });
    ["contentTitle", "contentUrl", "contentAccount", "contentRawText"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    await refreshContentPoolAfterAction();
    renderSinglePreview();
    if (taskScoped) focusBenchmarkTaskCard(benchmarkUpdateTaskId);
  } catch (error) {
    setImportMessage("warning", `导入失败：${error.message}`);
    clearPostImportNextPanel();
  } finally {
    if (!singlePreview || saveContentSourceBtn.textContent !== "导入内容池") {
      saveContentSourceBtn.disabled = false;
    }
  }
}

function currentSingleImportPayload() {
  const title = document.getElementById("contentTitle")?.value.trim() || "";
  const platform = document.getElementById("contentPlatform")?.value || "douyin";
  const url = document.getElementById("contentUrl")?.value.trim() || "";
  const accountName = document.getElementById("contentAccount")?.value.trim() || "";
  const rawText = document.getElementById("contentRawText")?.value.trim() || "";
  return {
    platform,
    sourceType: rawText && !url ? "manual_note" : "benchmark_video",
    title,
    url,
    accountName,
    rawText,
    note: rawText && url ? rawText : "",
  };
}

function renderSinglePreview() {
  if (!singlePreview) return;
  const payload = currentSingleImportPayload();
  const hasAnyInput = payload.title || payload.url || payload.accountName || payload.rawText;
  if (!hasAnyInput) {
    singlePreview.className = "single-preview-panel";
    singlePreview.innerHTML = `
      <strong>单条导入预检</strong>
      <p>填写标题、链接或字幕后，会先判断这条能不能作为真实运营素材入库。</p>
    `;
    updateSingleImportButton(null);
    return;
  }
  const localPreview = analyzeSingleImportPayload(payload);
  renderSinglePreviewPanel(localPreview);
  clearTimeout(singlePreviewTimer);
  const requestId = ++singlePreviewRequestId;
  singlePreviewTimer = setTimeout(() => loadServerSinglePreview(payload, requestId), 260);
}

async function loadServerSinglePreview(payload, requestId) {
  if (!singlePreview) return;
  try {
    const response = await fetch(`${CONTENT_API_BASE}/api/v2/content-sources/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (requestId !== singlePreviewRequestId) return;
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    renderSinglePreviewPanel(normalizeServerSinglePreview(data));
  } catch (error) {
    if (requestId !== singlePreviewRequestId) return;
    const fallback = analyzeSingleImportPayload(payload);
    fallback.warnings = [`服务端预检失败：${error.message}`, ...(fallback.warnings || [])].slice(0, 4);
    fallback.importable = false;
    fallback.status = "warning";
    fallback.statusLabel = "预检失败";
    fallback.nextAction = "暂不建议导入，先确认保存服务是否正常。";
    renderSinglePreviewPanel(fallback);
  }
}

function normalizeServerSinglePreview(data) {
  return {
    importable: Boolean(data.importable),
    realLoopEligible: Boolean(data.realLoopEligible ?? data.importable),
    status: data.status || (data.importable ? "ready" : "blocked"),
    statusLabel: data.statusLabel || (data.importable ? "可导入真实素材" : "暂不能导入"),
    titleReady: Boolean(data.titleReady),
    hasUrl: Boolean(data.hasUrl),
    hasText: Boolean(data.hasText),
    warnings: data.warnings || [],
    blockingWarnings: data.blockingWarnings || [],
    nextAction: data.nextAction || "",
    r2AfterImportStep: data.r2AfterImportStep || "",
    gateItems: Array.isArray(data.gateItems) ? data.gateItems : [],
    rule: data.rule || "预检只判断，不写入数据库。",
    serverChecked: true,
  };
}

function analyzeSingleImportPayload(payload) {
  const warnings = [];
  if (!payload.title) warnings.push("缺少标题");
  if (!payload.url && !payload.rawText) warnings.push("缺少链接或字幕/正文");
  if (payload.url && !/^https?:\/\//i.test(payload.url)) warnings.push("链接格式不完整");
  const reason = localNonOperationalReason([payload.title, payload.url, payload.accountName, payload.rawText, payload.note].join(" "));
  if (reason) warnings.push(`非运营素材：${reason}`);
  if (!payload.rawText && !payload.note && !payload.url) warnings.push("缺少可结构化文本");
  const blockingWarnings = warnings.filter((warning) => (
    warning === "缺少标题"
    || warning === "缺少链接或字幕/正文"
    || warning === "链接格式不完整"
    || warning.startsWith("非运营素材：")
  ));
  return {
    importable: blockingWarnings.length === 0,
    realLoopEligible: blockingWarnings.length === 0,
    status: blockingWarnings.length ? "blocked" : "ready",
    statusLabel: blockingWarnings.length ? "暂不能作为真实素材导入" : "本地判断可导入真实候选",
    titleReady: Boolean(payload.title),
    hasUrl: Boolean(payload.url),
    hasText: Boolean(payload.rawText || payload.note),
    warnings,
    blockingWarnings,
    nextAction: blockingWarnings.length ? "按检查项修正后再导入" : "等待服务端预检确认后导入内容池",
    r2AfterImportStep: payload.rawText || payload.note ? "导入后加入生成并结构化" : "导入后补字幕",
    gateItems: [
      { key: "title", label: "真实标题", passed: Boolean(payload.title), detail: payload.title ? "已填写" : "必须填写" },
      { key: "real_material", label: "非测试/示例", passed: !reason, detail: reason || "未命中排除词" },
      { key: "source_body", label: "链接或正文", passed: Boolean(payload.url || payload.rawText || payload.note), detail: payload.url ? "有链接" : ((payload.rawText || payload.note) ? "有字幕/正文" : "缺少链接或正文") },
      { key: "r2_path", label: "R2 下一步", passed: blockingWarnings.length === 0, detail: payload.rawText || payload.note ? "导入后结构化" : "导入后补字幕" },
    ],
    rule: "本地预检不写库；服务端预检会继续检查重复链接和非运营素材。",
    serverChecked: false,
  };
}

function renderSinglePreviewPanel(preview) {
  if (!singlePreview) return;
  const level = preview.importable ? "ok" : (preview.status === "warning" ? "warning" : "blocked");
  const metrics = [
    ["标题", preview.titleReady ? "已填写" : "缺失"],
    ["链接", preview.hasUrl ? "有链接" : "无链接"],
    ["文本", preview.hasText ? "有字幕/正文" : "无字幕"],
  ];
  singlePreview.className = `single-preview-panel ${level}`;
  singlePreview.innerHTML = `
    <div class="single-preview-head">
      <strong>${escapeHtml(preview.statusLabel || "等待预检")}</strong>
      <span>${preview.serverChecked ? "服务端规则" : "本地初检"}</span>
    </div>
    <p>${escapeHtml(preview.nextAction || "补充素材信息后继续。")}</p>
    <div class="single-preview-gate">
      ${(preview.gateItems || []).map((item) => `
        <span class="${item.passed ? "passed" : "blocked"}">
          <b>${escapeHtml(item.label || "检查项")}</b>
          ${escapeHtml(item.detail || (item.passed ? "通过" : "待补"))}
        </span>
      `).join("")}
    </div>
    <div class="single-preview-metrics">
      ${metrics.map(([label, value]) => `<span><b>${escapeHtml(label)}</b>${escapeHtml(value)}</span>`).join("")}
    </div>
    <div class="single-preview-next">
      <b>导入后路径</b>
      <span>${escapeHtml(preview.r2AfterImportStep || (preview.importable ? "加入生成并结构化" : "暂不能进入 R2"))}</span>
    </div>
    ${(preview.warnings || []).length ? `<small>检查项：${preview.warnings.map(escapeHtml).join(" / ")}</small>` : `<small>${escapeHtml(preview.rule || "预检通过后再导入内容池。")}</small>`}
  `;
  updateSingleImportButton(preview);
}

function updateSingleImportButton(preview) {
  if (!saveContentSourceBtn) return;
  if (!preview) {
    saveContentSourceBtn.disabled = false;
    saveContentSourceBtn.textContent = "导入内容池";
    return;
  }
  saveContentSourceBtn.disabled = !preview.importable;
  saveContentSourceBtn.textContent = preview.importable ? "导入真实素材" : "暂不能导入";
}

async function batchContentSources() {
  const batchText = document.getElementById("contentBatchText")?.value.trim() || "";
  const platform = document.getElementById("contentPlatform")?.value || "douyin";
  const accountName = document.getElementById("contentAccount")?.value.trim() || "";
  const benchmarkUpdateTaskId = document.getElementById("benchmarkUpdateTaskId")?.value.trim() || "";
  if (batchResult) batchResult.innerHTML = "";
  if (!batchText) {
    setImportMessage("warning", "请先在批量导入框里粘贴素材。");
    clearPostImportNextPanel();
    return;
  }
  if (batchPreviewChecking) {
    setImportMessage("warning", "正在做服务端预检，请等预检结果出来后再导入。");
    clearPostImportNextPanel();
    updateBatchImportButton(latestBatchPreview);
    return;
  }
  if (!latestBatchPreview?.serverChecked) {
    setImportMessage("warning", "请先等待服务端预检完成，再解析导入。服务端预检会检查重复链接、占位文本和整批阻塞。");
    clearPostImportNextPanel();
    updateBatchImportButton(latestBatchPreview);
    return;
  }
  if (latestBatchPreview?.preflightBlocked) {
    setImportMessage("warning", latestBatchPreview.batchAction || "本批预检存在阻塞行。请先修正表内重复、已有链接或占位文本，再重新预检。");
    clearPostImportNextPanel();
    updateBatchImportButton(latestBatchPreview);
    return;
  }
  batchContentSourceBtn.disabled = true;
  batchContentSourceBtn.textContent = "导入中...";
  setImportMessage("", "正在批量导入...");
  try {
    const response = await fetch(`${CONTENT_API_BASE}/api/v2/content-sources/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform,
        accountName,
        batchText,
        benchmarkUpdateTaskId: benchmarkUpdateTaskId ? Number(benchmarkUpdateTaskId) : undefined,
      }),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    const skipped = Number(data.skipped || 0);
    const preflightBlocked = Boolean(data.preflightBlocked);
    setImportMessage(
      data.failed || skipped ? "warning" : "ok",
      preflightBlocked
        ? `批量导入已暂停：本批存在阻塞行，0 条写入内容池。请修正后重新提交。`
        : `批量导入完成：成功 ${data.success} 条，失败 ${data.failed} 条${skipped ? `，跳过非运营素材 ${skipped} 条` : ""}。`,
    );
    renderBatchImportResult(data.results || [], data);
    const taskScoped = Boolean(benchmarkUpdateTaskId);
    renderPostImportNextPanel({
      sourceLabel: taskScoped ? `固定对标任务 #${benchmarkUpdateTaskId}` : `${platformText(platform)} / 批量导入`,
      title: preflightBlocked ? "批量导入已暂停：0 条写入" : `批量导入完成：成功 ${data.success} 条`,
      description: preflightBlocked
        ? "本批存在阻塞行，系统没有写入任何素材。先修正重复链接、占位文本或非运营素材，再重新导入。"
        : data.success
        ? (taskScoped
          ? `这些素材已绑定当前对标账号任务。${skipped ? `已跳过 ${skipped} 条测试/示例素材。` : "下一步在账号卡里处理字幕、加入生成工作流并结构化。"}`
          : `这些素材已经进入内容池。${skipped ? `已跳过 ${skipped} 条测试/示例素材。` : "现在应批量加入生成工作流，再批量生成结构摘要。"}`)
        : "本次没有成功导入真实素材，请按失败/跳过原因修正表格。",
      importedCount: data.success || 0,
      failedCount: (data.failed || 0) + skipped,
      selectedCount: 0,
      structuredCount: 0,
      evidenceItems: (data.results || []).filter((result) => result.ok && result.item).map((result) => result.item),
      status: data.success ? "ready" : "warning",
      badge: preflightBlocked ? "整批未写入" : data.success ? "下一步：加入生成" : "需要修正",
      benchmarkTaskId: data.success && taskScoped ? benchmarkUpdateTaskId : "",
      benchmarkTitle: data.success && taskScoped ? "批量素材已进入固定对标账号任务" : "",
      benchmarkNext: data.success && taskScoped ? "页面已刷新该账号任务卡。回到卡片后，P0-1 NEXT STEP 会按素材状态提示继续补字幕、加入生成或结构化。" : "",
      actions: data.success && taskScoped ? [
        p01ReturnAction(benchmarkUpdateTaskId, false),
        { action: "benchmark-advance", label: "加入生成并结构化", benchmarkTaskId: benchmarkUpdateTaskId, primary: !isP01VerifierReturn },
        { action: "benchmark-focus", label: "回到账号任务卡", benchmarkTaskId: benchmarkUpdateTaskId },
        { action: "benchmark-subtitle", label: "处理该账号待补字幕", benchmarkTaskId: benchmarkUpdateTaskId },
      ].filter(Boolean) : data.success ? [
        { action: "bulk-select", label: "批量加入生成工作流", primary: true },
        { action: "scroll-pool", label: "查看导入内容" },
      ] : [
        { action: "scroll-pool", label: "查看内容池列表" },
      ],
    });
    if (data.success) {
      const textarea = document.getElementById("contentBatchText");
      if (textarea) textarea.value = "";
      renderBatchPreview();
    }
    await refreshContentPoolAfterAction();
    await loadBenchmarkUpdateTasks();
    if (taskScoped) focusBenchmarkTaskCard(benchmarkUpdateTaskId);
  } catch (error) {
    setImportMessage("warning", `批量导入失败：${error.message}`);
    clearPostImportNextPanel();
  } finally {
    updateBatchImportButton(latestBatchPreview);
  }
}

async function bulkSelectContentSources() {
  bulkSelectContentSourcesBtn.disabled = true;
  setImportMessage("", "正在批量加入生成工作流...");
  const beforeVerifier = r2InputVerifier || await fetchR2VerifierSnapshot().catch(() => null);
  try {
    const response = await fetch(`${CONTENT_API_BASE}/api/v2/content-sources/bulk-select`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "unselected_recent", limit: 10 }),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    const skipped = Number(data.skipped || 0);
    const messageState = data.success ? "ok" : "warning";
    setImportMessage(messageState, data.success
      ? `已加入真实生成工作流：${data.success} 条${skipped ? `；跳过非运营素材 ${skipped} 条` : ""}。`
      : `没有真实素材可加入；已跳过非运营素材 ${skipped} 条。`);
    renderBulkActionResult(data.results || []);
    renderPostImportNextPanel({
      sourceLabel: "内容池批量处理",
      title: data.success ? `已加入真实生成工作流：${data.success} 条` : "没有真实素材可加入",
      description: data.success
        ? `已选真实素材会被脚本生成读取。${skipped ? `本次跳过 ${skipped} 条测试/示例素材。` : "下一步生成结构摘要，让系统知道这些素材的开头、节奏和 CTA。"}`
        : "当前内容池只有测试/示例素材，不能作为真实跑通证据。请先导入真实对标视频/笔记。",
      importedCount: data.results?.length || data.success || 0,
      selectedCount: data.success || 0,
      structuredCount: 0,
      status: data.success ? "ready" : "warning",
      badge: data.success ? "下一步：结构化" : "无新增素材",
      actions: data.success ? [
        { action: "bulk-structure", label: "批量生成结构摘要", primary: true },
        { action: "scroll-pool", label: "查看内容池列表" },
      ] : [
        { action: "scroll-pool", label: "查看内容池列表", primary: true },
      ],
    });
    await refreshContentPoolAfterAction();
    renderR2ProgressFeedback(beforeVerifier, r2InputVerifier, "批量加入生成", data);
  } catch (error) {
    setImportMessage("warning", `批量加入失败：${error.message}`);
  } finally {
    bulkSelectContentSourcesBtn.disabled = false;
  }
}

async function bulkStructureContentSources() {
  bulkStructureContentSourcesBtn.disabled = true;
  setImportMessage("", "正在批量生成结构摘要，默认最多处理 3 条...");
  const beforeVerifier = r2InputVerifier || await fetchR2VerifierSnapshot().catch(() => null);
  try {
    const response = await fetch(`${CONTENT_API_BASE}/api/v2/content-sources/bulk-structure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "selected_without_structure", limit: 3 }),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    const skipped = Number(data.skipped || 0);
    setImportMessage(data.failed || skipped ? "warning" : "ok", data.success
      ? `结构摘要完成：成功 ${data.success} 条，失败 ${data.failed} 条${skipped ? `，跳过非运营素材 ${skipped} 条` : ""}。`
      : `没有真实素材可结构化；失败 ${data.failed || 0} 条，跳过非运营素材 ${skipped} 条。`);
    renderBulkActionResult(data.results || [], "没有需要结构化的已选素材。");
    renderPostImportNextPanel({
      sourceLabel: "内容池批量处理",
      title: data.success ? `结构摘要完成：成功 ${data.success} 条` : "没有真实素材可结构化",
      description: data.success
        ? `结构摘要已经入库。${skipped ? `本次跳过 ${skipped} 条测试/示例素材。` : "现在可以进入脚本流程，用这些对标素材生成候选脚本。"}`
        : "当前没有可结构化的真实素材。请先导入真实对标视频/笔记，并补字幕或正文。",
      importedCount: data.results?.length || data.success || 0,
      selectedCount: data.results?.length || data.success || 0,
      structuredCount: data.success || 0,
      failedCount: (data.failed || 0) + skipped,
      status: data.success ? "ready" : "warning",
      badge: data.success ? "可去生成脚本" : "需要补素材",
      actions: data.success ? [
        { action: "script-flow", label: "进入脚本流程", primary: true },
        { action: "dashboard", label: "回 V2 工作台" },
        { action: "scroll-pool", label: "查看结构摘要" },
      ] : [
        { action: "bulk-select", label: "先加入生成工作流", primary: true },
        { action: "scroll-pool", label: "查看内容池列表" },
      ],
    });
    await refreshContentPoolAfterAction();
    renderR2ProgressFeedback(beforeVerifier, r2InputVerifier, "批量结构化", data);
  } catch (error) {
    setImportMessage("warning", `批量结构化失败：${error.message}`);
  } finally {
    bulkStructureContentSourcesBtn.disabled = false;
  }
}

async function bulkCreateSubtitleJobs() {
  if (!bulkSubtitleJobsBtn) return;
  bulkSubtitleJobsBtn.disabled = true;
  setImportMessage("", "正在批量创建字幕任务，默认最多处理 3 条有链接素材...");
  try {
    const response = await fetch(`${CONTENT_API_BASE}/api/v2/content-sources/bulk-subtitle-jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "recent_with_url_without_success", limit: 3 }),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    setImportMessage(data.failed ? "warning" : "ok", `字幕任务完成：成功 ${data.success} 条，失败 ${data.failed} 条。`);
    renderBulkActionResult(data.results || [], "没有需要提取字幕的链接素材。");
    await loadContentSources();
  } catch (error) {
    setImportMessage("warning", `批量字幕任务失败：${error.message}`);
  } finally {
    bulkSubtitleJobsBtn.disabled = false;
  }
}

async function toggleContentSource(button) {
  const id = button.dataset.contentSelect;
  const selected = button.dataset.selected === "1";
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "处理中...";
  try {
    const response = await fetch(`${CONTENT_API_BASE}/api/v2/content-sources/${id}/select`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selected }),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    setImportMessage("ok", `${selected ? "已加入" : "已移出"}：${data.item.title}`);
    await loadContentSources();
    await loadBenchmarkUpdateTasks();
  } catch (error) {
    setImportMessage("warning", `操作失败：${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function structureContentSource(button) {
  const id = button.dataset.contentStructure;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "结构化中...";
  try {
    const response = await fetch(`${CONTENT_API_BASE}/api/v2/content-sources/${id}/structure`, { method: "POST" });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    setImportMessage("ok", `结构摘要已生成：${data.source.title}。现在可以进入脚本流程。`);
    renderPostImportNextPanel({
      sourceLabel: "结构摘要入库",
      title: `结构摘要已生成：${data.source.title}`,
      description: "这条素材已经完成字幕/正文和结构摘要。若已加入生成工作流，脚本流程会读取它；未加入时先加入生成工作流。",
      importedCount: 1,
      selectedCount: data.source.selected ? 1 : 0,
      structuredCount: 1,
      status: "ready",
      badge: data.source.selected ? "可去生成脚本" : "先加入生成",
      actions: data.source.selected ? [
        { action: "script-flow", label: "进入脚本流程", primary: true },
        { action: "source-open", label: "查看这条素材", sourceId: data.source.id },
      ] : [
        { action: "source-select", label: "加入生成工作流", sourceId: data.source.id, primary: true },
        { action: "script-flow", label: "进入脚本流程" },
        { action: "source-open", label: "查看这条素材", sourceId: data.source.id },
      ],
    });
    await loadContentSources();
    await loadBenchmarkUpdateTasks();
  } catch (error) {
    setImportMessage("warning", `结构化失败：${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function renderBatchImportResult(results, summary = {}) {
  if (!batchResult) return;
  const successCount = results.filter((result) => result.ok).length;
  const skippedCount = results.filter((result) => result.skipped).length;
  const failedCount = results.length - successCount - skippedCount;
  const formatText = summary.format ? `格式：${summary.format}` : "格式：已按服务端规则解析";
  const preflightBlocked = Boolean(summary.preflightBlocked);
  batchResult.innerHTML = `
    <div class="v2-batch-result-head ${preflightBlocked ? "blocked" : ""}">
      <strong>${preflightBlocked ? `整批暂停：0 条写入 / 待修正 ${failedCount + skippedCount} 条` : `导入结果：成功 ${successCount} 条 / 失败 ${failedCount} 条 / 跳过 ${skippedCount} 条`}</strong>
      <small>${escapeHtml(formatText)}。${preflightBlocked ? escapeHtml(summary.error || "本批存在阻塞行，系统没有写入任何素材。") : successCount ? "下一步建议：点击“批量加入生成工作流”，再批量生成结构摘要。" : "请按失败或跳过原因修正表格后再导入真实素材。"}</small>
    </div>
    ${successCount ? `
      <div class="batch-next-actions">
        <button type="button" data-batch-next-select>批量加入生成工作流</button>
        <button type="button" data-batch-scroll-pool>查看内容池列表</button>
      </div>
    ` : ""}
    ${results.slice(0, 12).map((result) => `
      <article class="${result.ok ? "ok" : result.skipped ? "skipped" : "failed"} ${result.notWritten ? "not-written" : ""}">
        <span>第 ${result.line} 行</span>
        <strong>${result.notWritten ? `未写入：${escapeHtml(result.error || "本批已暂停")}` : result.ok ? escapeHtml(result.item?.title || "已导入") : escapeHtml(result.skipped ? (result.error || "已跳过非运营素材") : (result.error || "导入失败"))}</strong>
        ${result.ok && result.item ? `<small>sourceId #${escapeHtml(result.item.id || "")}${result.item.benchmarkUpdateTaskId ? ` / 绑定任务 #${escapeHtml(result.item.benchmarkUpdateTaskId)}` : ""}${result.item.rawText ? " / 已带文本" : " / 待补字幕"}</small>` : ""}
        <p>${escapeHtml(result.input || "")}</p>
      </article>
    `).join("")}
  `;
}

async function loadBatchTemplate() {
  if (!batchTemplatePanel) return;
  try {
    const response = await fetch(`${CONTENT_API_BASE}/api/v2/content-sources/batch-template`);
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    batchTemplateData = data;
    renderBatchTemplate(data);
  } catch (error) {
    batchTemplatePanel.className = "batch-template-panel warning";
    batchTemplatePanel.innerHTML = `
      <div>
        <strong>字段模板加载失败</strong>
        <p>仍可手动使用表头：标题 / 链接 / 账号 / 平台 / 字幕 / 备注。失败原因：${escapeHtml(error.message)}</p>
      </div>
    `;
  }
}

function renderBatchTemplate(template) {
  if (!batchTemplatePanel) return;
  const fieldGroups = Array.isArray(template.fieldGroups) ? template.fieldGroups : [];
  const vendors = Array.isArray(template.vendors) ? template.vendors : [];
  const riskTerms = Array.isArray(template.riskTerms) ? template.riskTerms : [];
  batchTemplatePanel.className = "batch-template-panel";
  batchTemplatePanel.innerHTML = `
    <div class="batch-template-head">
      <div>
        <span>THIRD PARTY TEMPLATE</span>
        <strong>第三方/人工表格字段模板</strong>
        <p>模板来自后端清洗规则。复制到飞书表格后替换示例行，再粘贴回来先预检，不会自动入库。</p>
      </div>
      <div class="batch-template-actions">
        <button type="button" data-template-action="copy">复制模板</button>
        <button type="button" data-template-action="fill">填入并预检</button>
      </div>
    </div>
    <code>${escapeHtml(template.recommendedHeader || "标题\t链接\t账号\t平台\t字幕\t备注")}</code>
    <div class="batch-template-meta">
      <span>适配：${escapeHtml(vendors.join(" / ") || "第三方表格 / 飞书表格")}</span>
      <span>平台：${escapeHtml((template.acceptedPlatforms || []).join(" / ") || "抖音 / 小红书 / 第三方")}</span>
      <span>风险词：${escapeHtml(riskTerms.slice(0, 6).join(" / ") || "按服务端规则检查")}</span>
    </div>
    <div class="batch-template-fields">
      ${fieldGroups.map((group) => `
        <article>
          <strong>${escapeHtml(group.label || "字段组")}</strong>
          <p>${escapeHtml(group.description || "")}</p>
          ${(group.fields || []).map((field) => `<span>${escapeHtml(field.label || field.key)}：${escapeHtml((field.aliases || []).slice(0, 4).join(" / "))}</span>`).join("")}
        </article>
      `).join("")}
    </div>
    <small>${escapeHtml((template.rules || [])[0] || "模板示例不是已采集数据，正式导入前请替换内容。")}</small>
  `;
}

async function handleBatchTemplateAction(action) {
  if (!batchTemplateData) {
    await loadBatchTemplate();
  }
  if (!batchTemplateData) return;
  if (action === "copy") {
    await copyBatchTemplateText(batchTemplateData.templateText || batchTemplateData.recommendedHeader || "");
    return;
  }
  if (action === "fill") {
    fillBatchTemplateText(batchTemplateData.templateText || batchTemplateData.recommendedHeader || "");
  }
}

async function handleTranscriptImportAction(action) {
  if (action === "single") {
    prepareSingleTranscriptImport();
    return;
  }
  if (action === "batch") {
    if (!batchTemplateData) {
      await loadBatchTemplate();
    }
    fillTranscriptBatchTemplate();
  }
}

function prepareSingleTranscriptImport() {
  const platformSelect = document.getElementById("contentPlatform");
  const rawTextInput = document.getElementById("contentRawText");
  const titleInput = document.getElementById("contentTitle");
  const urlInput = document.getElementById("contentUrl");
  if (platformSelect) platformSelect.value = "manual";
  if (urlInput && !urlInput.value.trim()) urlInput.placeholder = "有原视频链接就填，没有可留空";
  if (titleInput && !titleInput.value.trim()) titleInput.placeholder = "填写真实视频标题或字幕项目文件名";
  if (rawTextInput) {
    rawTextInput.placeholder = "粘贴旧字幕项目导出的真实字幕、ASR 转写或 OCR 文本；不少于 30 字。";
    rawTextInput.focus();
  }
  setImportMessage("ok", "已切换到手工字幕兜底。请填写标题和真实字幕文本，系统会先预检再入库。");
  renderSinglePreview();
}

function fillTranscriptBatchTemplate() {
  const textarea = document.getElementById("contentBatchText");
  const platformSelect = document.getElementById("contentPlatform");
  if (!textarea) return;
  if (platformSelect) platformSelect.value = "manual";
  const template = batchTemplateData?.transcriptTemplateText
    || "标题\t链接\t账号\t平台\t字幕文本\t备注\n待替换-旧字幕项目结果\t\t待填写对标账号\t手工素材\t粘贴旧字幕项目导出的真实字幕、ASR 转写或 OCR 文本；不少于 30 字。\t可写视频链接来源、提取时间或结构观察";
  textarea.value = template;
  textarea.focus();
  renderBatchPreview();
  setImportMessage("ok", "已填入旧字幕项目表格模板。模板行只是格式，请替换成真实字幕结果后再导入。");
  document.getElementById("batch-import")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function copyBatchTemplateText(text, successMessage = "字段模板已复制。粘贴到飞书表格后替换示例行，再复制回来预检。") {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    setImportMessage("ok", successMessage);
  } catch (error) {
    setImportMessage("warning", `复制失败：${error.message}。可点击“填入并预检”后手动复制文本。`);
  }
}

function fillBatchTemplateText(text) {
  const textarea = document.getElementById("contentBatchText");
  if (!textarea || !text) return;
  textarea.value = text;
  textarea.focus();
  renderBatchPreview();
  setImportMessage("ok", "已填入模板示例并触发预检。示例行不会自动入库，正式导入前请替换为真实数据。");
}

function renderBatchPreview() {
  if (!batchPreview) return;
  const text = document.getElementById("contentBatchText")?.value || "";
  const preview = analyzeBatchText(text);
  if (!preview.total) {
    latestBatchPreview = null;
    batchPreviewChecking = false;
    batchPreview.innerHTML = `
      <strong>导入前预检</strong>
      <p>粘贴表格后会先判断格式、字段和可导入行数，避免把第三方数据导错。</p>
    `;
    batchPreview.className = "batch-preview-panel";
    updateBatchImportButton(null);
    return;
  }
  renderBatchPreviewPanel(preview);
  clearTimeout(batchPreviewTimer);
  const requestId = ++batchPreviewRequestId;
  batchPreviewChecking = true;
  updateBatchImportButton(preview);
  batchPreviewTimer = setTimeout(() => loadServerBatchPreview(text, requestId), 260);
}

async function loadServerBatchPreview(text, requestId) {
  if (!batchPreview || !text.trim()) return;
  const platform = document.getElementById("contentPlatform")?.value || "douyin";
  const accountName = document.getElementById("contentAccount")?.value.trim() || "";
  try {
    const response = await fetch(`${CONTENT_API_BASE}/api/v2/content-sources/batch-preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform, accountName, batchText: text }),
    });
    const data = await response.json();
    if (requestId !== batchPreviewRequestId) return;
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    batchPreviewChecking = false;
    renderBatchPreviewPanel(normalizeServerBatchPreview(data));
  } catch (error) {
    if (requestId !== batchPreviewRequestId) return;
    batchPreviewChecking = false;
    const localPreview = analyzeBatchText(text);
    localPreview.riskExamples = [`服务端预检失败：${error.message}`, ...(localPreview.riskExamples || [])].slice(0, 4);
    localPreview.riskCount = Math.max(1, localPreview.riskCount || 0);
    localPreview.preflightBlocked = true;
    localPreview.batchImportable = false;
    localPreview.blockedRowCount = localPreview.riskCount;
    localPreview.batchAction = "服务端预检失败，暂不能正式导入；请稍后重试或检查本地 API 服务。";
    renderBatchPreviewPanel(localPreview);
  }
}

function normalizeServerBatchPreview(data) {
  const warningRows = (data.rows || []).filter((row) => Array.isArray(row.warnings) && row.warnings.length);
  return {
    total: data.total || 0,
    importableCount: data.importableCount || 0,
    rowImportableCount: data.rowImportableCount || data.importableCount || 0,
    preflightBlocked: Boolean(data.preflightBlocked),
    batchImportable: data.batchImportable !== false && !data.preflightBlocked,
    blockedRowCount: data.blockedRowCount || 0,
    batchAction: data.batchAction || "",
    riskCount: data.warningCount || 0,
    duplicateCount: data.duplicateCount || 0,
    complianceRiskCount: data.riskCount || 0,
    riskExamples: warningRows.slice(0, 4).map((row) => `第 ${row.line} 行：${row.warnings.join("、")}`),
    fields: data.fields || [],
    formatText: data.vendor ? `${data.vendor} / ${data.formatLabel || data.format || "表格"}` : (data.formatLabel || data.format || "表格"),
    rows: data.rows || [],
    nextSteps: data.nextSteps || [],
    serverChecked: true,
  };
}

function renderBatchPreviewPanel(preview) {
  if (!batchPreview) return;
  latestBatchPreview = preview || null;
  const knownFields = preview.fields.length ? preview.fields.join(" / ") : "未识别表头，按逐行链接或文本导入";
  const preflightBlocked = Boolean(preview.preflightBlocked);
  const p01TaskSheet = p01TaskSheetProgress(preview);
  const statusText = preflightBlocked
    ? `整批需修正：${preview.blockedRowCount || preview.riskCount || 1} 行阻塞`
    : preview.riskCount
    ? `${preview.riskCount} 行需要检查`
    : (preview.serverChecked ? "已按服务端规则清洗" : "字段看起来可用");
  const metrics = [
    ["正式写入", `${preview.importableCount} 行`],
    ["行级可通过", `${preview.rowImportableCount ?? preview.importableCount} 行`],
    ["重复", `${preview.duplicateCount || 0} 行`],
    ["风险词", `${preview.complianceRiskCount || 0} 行`],
  ];
  batchPreview.className = `batch-preview-panel ${preflightBlocked || preview.riskCount ? "warning" : "ok"} ${preflightBlocked ? "blocked" : ""}`;
  batchPreview.innerHTML = `
    <div class="batch-preview-head">
      <strong>${preflightBlocked ? `${escapeHtml(preview.formatText)}：整批暂停，0 行会写入` : `${escapeHtml(preview.formatText)}：预计 ${preview.importableCount} 行可导入`}</strong>
      <span>${escapeHtml(statusText)}</span>
    </div>
    <p>识别字段：${escapeHtml(knownFields)}</p>
    ${preflightBlocked ? `<p class="batch-preview-blocked">正式导入会暂停整批，不会只写入其中几行。请先修正阻塞行，再重新预检。</p>` : ""}
    <div class="batch-preview-metrics">
      ${metrics.map(([label, value]) => `<span><b>${escapeHtml(label)}</b>${escapeHtml(value)}</span>`).join("")}
    </div>
    ${p01TaskSheet ? p01TaskSheetProgressHtml(p01TaskSheet) : ""}
    <div class="batch-preview-steps">
      ${(preview.nextSteps?.length ? preview.nextSteps : ["解析并导入", "批量加入生成工作流", "批量生成结构摘要"]).map((step, index) => `<span>${index + 1} ${escapeHtml(step)}</span>`).join("")}
    </div>
    ${preview.batchAction ? `<small>${escapeHtml(preview.batchAction)}</small>` : ""}
    ${preview.riskExamples.length ? `<small>需检查：${preview.riskExamples.map(escapeHtml).join(" / ")}</small>` : ""}
  `;
  updateBatchImportButton(preview);
}

function isCurrentSprintTaskSheetEntry() {
  return initialContentParams.get("v") === "current-sprint-task-sheet-v1"
    && initialContentParams.get("importPath") === "third_party_table";
}

function p01TaskSheetProgress(preview) {
  if (!isCurrentSprintTaskSheetEntry()) return null;
  const rows = Array.isArray(preview.rows) ? preview.rows : [];
  const realRows = rows.filter((row) => row.line !== 1);
  const validRows = realRows.filter((row) => row.ok);
  const blockers = realRows
    .flatMap((row) => (row.blockingWarnings?.length ? row.blockingWarnings : row.warnings || []))
    .filter(Boolean);
  const uniqueBlockers = Array.from(new Set(blockers)).slice(0, 4);
  const hasAnyUrl = realRows.some((row) => Boolean(row.url));
  const hasAnyText = realRows.some((row) => Boolean(row.hasText));
  const missing = [];
  const followups = [];
  if (!hasAnyUrl) missing.push("真实链接");
  if (!hasAnyText) followups.push("补字幕/正文或备注结构观察");
  const ready = validRows.length >= 1 && !preview.preflightBlocked;
  return {
    ready,
    validCount: validRows.length,
    targetCount: 1,
    rowCount: realRows.length || Math.max(0, Number(preview.total || 0) - 1),
    missing,
    followups,
    blockers: uniqueBlockers,
    rowFixes: realRows.slice(0, 3).map((row) => p01TaskSheetRowFix(row)),
    handoff: ready ? [
      "点击“预检通过，解析并导入”写入真实素材。",
      "导入成功后回到该账号任务卡，看 P0-1 NEXT STEP。",
      "继续加入生成工作流并生成结构摘要。",
      "结构完成后进入脚本流程，候选脚本必须引用这条素材 sourceId。",
    ] : [],
    nextAction: ready
      ? "已满足 P0-1 首条真实素材导入条件，可以正式导入。"
      : "先补 1 行真实链接、字幕/正文或备注里的结构观察，再重新预检。",
  };
}

function p01TaskSheetRowFix(row) {
  const warnings = row.blockingWarnings?.length ? row.blockingWarnings : row.warnings || [];
  const needs = [];
  if (!row.url) needs.push("真实链接");
  if (!row.hasText) needs.push("字幕/正文或备注");
  return {
    line: row.line,
    status: row.ok ? "ready" : "blocked",
    title: row.title || row.accountName || "空白行",
    needs,
    warnings,
    action: row.ok
      ? "这一行可进入正式导入。"
      : `补${needs.length ? needs.join("或") : "缺失字段"}，再重新预检。`,
  };
}

function p01TaskSheetProgressHtml(progress) {
  const statusClass = progress.ready ? "ready" : "blocked";
  const missing = progress.ready
    ? (progress.followups.length ? progress.followups.join(" / ") : "无")
    : (progress.missing.length ? progress.missing.join(" / ") : "真实链接 / 字幕/正文或备注结构观察");
  const missingLabel = progress.ready ? "导入后继续" : "还缺";
  const blockers = progress.blockers.length ? progress.blockers.join(" / ") : "等待服务端预检";
  return `
    <div class="batch-p01-progress ${statusClass}">
      <div>
        <span>P0-1 TASK SHEET</span>
        <strong>有效真实行 ${progress.validCount}/${progress.targetCount}</strong>
        <p>${escapeHtml(progress.nextAction)}</p>
      </div>
      <div class="batch-p01-progress-grid">
        <span><b>任务单行数</b>${escapeHtml(String(progress.rowCount))}</span>
        <span><b>${escapeHtml(missingLabel)}</b>${escapeHtml(missing)}</span>
        <span><b>阻塞原因</b>${escapeHtml(blockers)}</span>
      </div>
      <div class="batch-p01-row-fixes">
        ${progress.rowFixes.map((row) => `
          <span class="${escapeHtml(row.status)}">
            <b>第 ${escapeHtml(String(row.line))} 行 · ${escapeHtml(row.title)}</b>
            <em>${escapeHtml(row.action)}</em>
            ${row.warnings.length ? `<small>${escapeHtml(row.warnings.join(" / "))}</small>` : ""}
          </span>
        `).join("")}
      </div>
      ${progress.handoff.length ? `
        <div class="batch-p01-handoff">
          <b>导入后接力</b>
          ${progress.handoff.map((step, index) => `<span>${index + 1}. ${escapeHtml(step)}</span>`).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

function updateBatchImportButton(preview) {
  if (!batchContentSourceBtn) return;
  const hasText = Boolean(document.getElementById("contentBatchText")?.value.trim());
  if (!hasText) {
    batchContentSourceBtn.disabled = true;
    batchContentSourceBtn.textContent = "先粘贴素材";
    batchContentSourceBtn.title = "先粘贴批量素材，系统会自动预检。";
    return;
  }
  if (batchPreviewChecking) {
    batchContentSourceBtn.disabled = true;
    batchContentSourceBtn.textContent = "正在预检...";
    batchContentSourceBtn.title = "服务端正在检查字段、重复链接和阻塞项。";
    return;
  }
  if (preview?.preflightBlocked) {
    batchContentSourceBtn.disabled = true;
    batchContentSourceBtn.textContent = preview.serverChecked === false ? "预检失败，暂不能导入" : "先修正阻塞行";
    batchContentSourceBtn.title = preview.batchAction || "预检发现阻塞行，正式导入会整批暂停。";
    return;
  }
  if (preview && !preview.serverChecked) {
    batchContentSourceBtn.disabled = true;
    batchContentSourceBtn.textContent = "等待服务端预检";
    batchContentSourceBtn.title = "服务端预检完成后才能正式导入。";
    return;
  }
  batchContentSourceBtn.disabled = false;
  batchContentSourceBtn.textContent = preview?.serverChecked ? "预检通过，解析并导入" : "解析并导入";
  batchContentSourceBtn.title = preview?.serverChecked ? "服务端预检未发现整批阻塞，可以正式导入。" : "等待服务端预检完成；正式导入仍会复核。";
}

function analyzeBatchText(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) {
    return { total: 0, importableCount: 0, riskCount: 0, riskExamples: [], fields: [], formatText: "等待粘贴" };
  }
  const delimiter = lines[0].includes("\t") ? "\t" : (lines[0].includes(",") ? "," : "");
  const formatText = delimiter === "\t" ? "TSV/飞书表格" : (delimiter === "," ? "CSV 表格" : "逐行链接/文本");
  const rows = delimiter ? lines.map((line) => splitPreviewRow(line, delimiter)) : lines.map((line) => [line]);
  const header = rows[0] || [];
  const fields = header.map(canonicalPreviewField).filter(Boolean);
  const hasHeader = fields.length >= 2;
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const riskExamples = [];
  let importableCount = 0;
  dataRows.forEach((row, index) => {
    const joined = row.join(" ").trim();
    const hasUrl = row.some((cell) => /^https?:\/\//i.test(cell));
    const contentText = hasHeader ? meaningfulPreviewContent(row, fields) : joined;
    const hasText = contentText.length >= 8;
    const nonOperationalReason = localNonOperationalReason(joined);
    if (nonOperationalReason) {
      if (riskExamples.length < 3) {
        riskExamples.push(`第 ${hasHeader ? index + 2 : index + 1} 行非运营素材：${nonOperationalReason}`);
      }
    } else if (hasUrl || hasText) {
      importableCount += 1;
    } else if (riskExamples.length < 3) {
      riskExamples.push(`第 ${hasHeader ? index + 2 : index + 1} 行缺少链接或正文`);
    }
  });
  const riskCount = dataRows.length - importableCount;
  return {
    total: lines.length,
    importableCount,
    riskCount,
    riskExamples,
    fields: hasHeader ? Array.from(new Set(fields.map(previewFieldLabel))) : [],
    formatText,
  };
}

function meaningfulPreviewContent(row, fields) {
  const evidenceFields = new Set(["title", "url", "rawText", "raw_text", "note"]);
  return row
    .map((cell, index) => (evidenceFields.has(fields[index]) ? String(cell || "").trim() : ""))
    .filter(Boolean)
    .join(" ");
}

function localNonOperationalReason(text) {
  const normalized = String(text || "").toLowerCase();
  if (normalized.includes("example.com") || normalized.includes("/example")) return "示例链接";
  const keywords = ["测试", "验证", "示例", "test", "demo", "placeholder", "replace-video", "fallback-test"];
  const hit = keywords.find((keyword) => normalized.includes(keyword.toLowerCase()));
  return hit ? `命中非运营素材关键词：${hit}` : "";
}

function splitPreviewRow(line, delimiter) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (const char of line) {
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function canonicalPreviewField(value) {
  const normalized = String(value || "").trim().toLowerCase().replaceAll(" ", "").replaceAll("_", "");
  const map = {
    title: "title",
    标题: "title",
    笔记标题: "title",
    视频标题: "title",
    url: "url",
    link: "url",
    链接: "url",
    视频链接: "url",
    笔记链接: "url",
    account: "account",
    accountname: "account",
    账号: "account",
    作者: "account",
    达人: "account",
    platform: "platform",
    平台: "platform",
    来源平台: "platform",
    subtitle: "rawText",
    rawtext: "rawText",
    content: "rawText",
    字幕: "rawText",
    正文: "rawText",
    笔记正文: "rawText",
    note: "note",
    remark: "note",
    备注: "note",
    说明: "note",
  };
  return map[normalized] || "";
}

function previewFieldLabel(value) {
  return {
    title: "标题",
    url: "链接",
    account: "账号",
    platform: "平台",
    rawText: "字幕/正文",
    note: "备注",
  }[value] || value;
}

function renderBulkActionResult(results, emptyText = "没有需要处理的素材。") {
  if (!bulkResult) return;
  if (!results.length) {
    bulkResult.innerHTML = `<article class="ok"><span>处理结果</span><strong>${emptyText}</strong></article>`;
    return;
  }
  bulkResult.innerHTML = results.slice(0, 8).map((result) => `
    <article class="${result.ok ? "ok" : result.skipped ? "skipped" : "failed"}">
      <span>素材 ID ${result.id || "-"}</span>
      <strong>${escapeHtml(bulkResultTitle(result))}</strong>
      <p>${escapeHtml(bulkResultDetail(result))}</p>
    </article>
  `).join("");
}

function bulkResultTitle(result) {
  if (result.skipped) return result.title || result.item?.title || "已跳过非运营素材";
  if (result.job) {
    return result.ok ? (result.item?.title || result.title || "字幕已提取") : (result.error || result.job.error || "字幕提取失败");
  }
  return result.ok ? (result.item?.title || result.source?.title || "处理完成") : (result.error || "处理失败");
}

function bulkResultDetail(result) {
  if (result.skipped) return `已跳过：${result.reason || result.error || "不计入真实闭环"}`;
  if (result.job) {
    if (result.ok) return `字幕 ${result.job.textLength || 0} 字，分段 ${result.job.segmentCount || 0} 条。`;
    return result.title || result.job.fallbackAction || "可改用手工字幕兜底。";
  }
  return result.ok ? "已进入下一步工作流。" : (result.title || "");
}

function setContentStatus(state, message) {
  if (!contentPoolStatus) return;
  contentPoolStatus.textContent = message;
  contentPoolStatus.className = `api-status ${state}`;
}

function setImportMessage(state, message) {
  if (!importMessage) return;
  importMessage.textContent = message;
  importMessage.className = `v2-import-message ${state}`;
}

function sourceTypeText(value) {
  return {
    benchmark_video: "对标视频",
    hot_video: "热点视频",
    manual_note: "手工文本",
    third_party_row: "第三方表格",
  }[value] || value || "未知类型";
}

function platformText(value) {
  return {
    douyin: "抖音",
    xhs: "小红书",
    manual: "手工素材",
    third_party: "第三方",
  }[value] || value || "未知平台";
}

function statusText(value) {
  return {
    imported: "已导入",
    subtitle_pending: "待补字幕",
    subtitle_done: "已带字幕",
    structure_done: "已结构化",
    selected: "已选择",
    failed: "失败",
  }[value] || value || "未知状态";
}

function subtitleJobStatusText(value) {
  return {
    not_started: "未提取",
    no_url: "无链接",
    running: "提取中",
    success: "已提取",
    failed: "提取失败",
  }[value] || value || "未知";
}

function truncateText(value, maxLength) {
  const text = String(value || "");
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
