const v2Data = window.CONTENTWORK_DATA || {};
const V2_API_BASE = "http://127.0.0.1:8771";
const v2Brand = v2Data.brand || {};
const v2Hot = v2Data.hotVideos || [];
const v2Benchmarks = v2Data.benchmarkVideos || [];
const v2Processing = v2Data.processingRows || [];
const v2Scripts = v2Data.scripts || [];
const v2Meta = v2Data.meta || {};

const moduleGrid = document.getElementById("v2ModuleGrid");
const masterPlan = document.getElementById("v2MasterPlan");
const currentSprint = document.getElementById("v2CurrentSprint");
const objectiveAudit = document.getElementById("v2ObjectiveAudit");
const objectivePlan = document.getElementById("v2ObjectivePlan");
const acceptanceBoard = document.getElementById("v2AcceptanceBoard");
const releaseRoadmap = document.getElementById("v2ReleaseRoadmap");
const executionQueue = document.getElementById("v2ExecutionQueue");
const workflowOverview = document.getElementById("v2WorkflowOverview");
const realDataLoopAudit = document.getElementById("v2RealDataLoopAudit");
const singleMaterialLoop = document.getElementById("v2SingleMaterialLoop");
const firstBenchmarkPlan = document.getElementById("v2FirstBenchmarkPlan");
const statusGrid = document.getElementById("v2StatusGrid");
const topicList = document.getElementById("v2TopicList");
const taskList = document.getElementById("v2TaskList");
const outputList = document.getElementById("v2OutputList");
const workdayOpeningReminderPanel = document.getElementById("workdayOpeningReminderPanel");
const readinessCard = document.getElementById("v2ReadinessCard");
const reviewInsights = document.getElementById("v2ReviewInsights");
const boundaryGrid = document.getElementById("v2BoundaryGrid");
const featureGrid = document.getElementById("v2FeatureGrid");
const sourceGrid = document.getElementById("v2SourceGrid");
const v2DailyReviewPanel = document.getElementById("v2DailyReviewPanel");
const qualityPipeline = document.getElementById("v2QualityPipeline");
const roadmap = document.getElementById("v2Roadmap");
const developmentBoard = document.getElementById("v2DevelopmentBoard");
const targetSystemPlan = document.getElementById("v2TargetSystemPlan");
const experienceGapBoard = document.getElementById("v2ExperienceGapBoard");
const productBlueprint = document.getElementById("v2ProductBlueprint");
const specGrid = document.getElementById("v2SpecGrid");
const importList = document.getElementById("v2ImportList");
const importMessage = document.getElementById("contentImportMessage");
const singlePreview = document.getElementById("contentSinglePreview");
const batchResult = document.getElementById("contentBatchResult");
const bulkResult = document.getElementById("contentBulkResult");
const batchTemplatePanel = document.getElementById("batchTemplatePanel");
const saveContentSourceBtn = document.getElementById("saveContentSource");
const batchContentSourceBtn = document.getElementById("batchContentSource");
const bulkSelectContentSourcesBtn = document.getElementById("bulkSelectContentSources");
const bulkStructureContentSourcesBtn = document.getElementById("bulkStructureContentSources");
const productList = document.getElementById("v2ProductList");
const productMessage = document.getElementById("productMessage");
const saveBrandProductBtn = document.getElementById("saveBrandProduct");
const v2ScriptTarget = document.getElementById("v2ScriptTarget");
const v2GenerateScriptsBtn = document.getElementById("v2GenerateScripts");
const v2GenerateStatus = document.getElementById("v2GenerateStatus");
const v2GeneratedList = document.getElementById("v2GeneratedList");
const v2WorkdayScope = document.getElementById("v2WorkdayScope");
const resetWorkdayBtn = document.getElementById("resetWorkday");
const closeWorkdayBtn = document.getElementById("closeWorkday");
const v2WorkdayMessage = document.getElementById("v2WorkdayMessage");

const brandName = document.getElementById("v2BrandName");
const brandMeta = document.getElementById("v2BrandMeta");
const apiMode = document.getElementById("v2ApiMode");
const productCharter = document.getElementById("v2ProductCharter");

let v2Dashboard = null;
let batchTemplateData = null;
let singlePreviewTimer = 0;
let singlePreviewRequestId = 0;

if (brandName) brandName.textContent = v2Brand.name || "未配置品牌";
if (brandMeta) {
  brandMeta.textContent = `${v2Brand.platform || "平台待定"} · ${v2Brand.audience || "人群待定"} · ${v2Brand.duration || 15}s`;
}

const modules = [
  ["今日工作台", "每日批次、任务状态、今日推荐和产出总览", "先做"],
  ["热点池", "多平台热榜、品牌相关性、可用方式和风险判断", "V2.0"],
  ["对标内容池", "账号、视频、链接、字幕、结构摘要和人工导入", "V2.1"],
  ["品牌与商品", "品牌画像、商品活动、权益限制和合规边界", "V2.3"],
  ["生成工作流", "素材确认、结构分析、生成数量、评分和改写", "V2.3"],
  ["脚本库复盘", "历史脚本、采用状态、发布表现和优质模板", "V2.5"],
];

const dataSources = [
  ["A 稳定自动源", "抖音总热榜、后续小红书/第三方热点源", "当前可用", "保留自动化主干，负责每天基础候选。"],
  ["B 登录态采集", "类目词搜索、对标账号主页、小批量页面采集", "谨慎使用", "每次 3 个词以内，验证码时明确暂停。"],
  ["C 人工导入", "视频链接、批量链接、飞书表格、手工字幕", "V2 必做", "自动采集不稳定时仍能完成内容生产。"],
  ["D 第三方数据", "灰豚、蝉妈妈、飞瓜、新榜、CSV/Excel", "后续增强", "先做表格导入，不急着做 API 深集成。"],
];

const features = [
  ["01 今日工作台", "首页只看当天素材、任务和产出，不被历史脚本污染。", ["今日口径", "今日任务", "今日产出"]],
  ["02 热点池", "从热度排序升级为品牌可用性判断。", ["相关性评分", "风险标签", "加入候选"]],
  ["03 对标内容池", "把固定账号池升级成真实内容和字幕结构池。", ["链接导入", "字幕提取", "结构摘要"]],
  ["04 品牌商品", "让脚本知道今天推什么、什么不能说。", ["商品组", "活动权益", "合规规则"]],
  ["05 生成工作流", "明确输入、分析、生成、评分、改写的关系。", ["确认包", "质量评分", "二次改写"]],
  ["06 脚本库复盘", "区分生成过、采用过、表现好的脚本。", ["采用状态", "发布链接", "表现回填"]],
];

const qualitySteps = [
  ["素材", "热点、对标视频、人工导入链接"],
  ["字幕/结构", "提取字幕，拆开头、节奏、CTA 和风险"],
  ["品牌商品匹配", "匹配商品、活动、门店和禁用表达"],
  ["初稿生成", "输出可拍分镜、口播、字幕、CTA"],
  ["质量评分", "可拍性、开头、贴合、转化、合规"],
  ["二次改写", "低分自动重写，保留原因和版本"],
];

const roadmapItems = [
  ["V2.0", "信息架构重构", "6 个页面、首页清空历史、脚本库独立"],
  ["V2.1", "人工导入和对标内容池", "链接导入、批量导入、手工字幕、素材入库"],
  ["V2.2", "字幕结构化闭环", "video-tools 接入、字幕任务、结构摘要"],
  ["V2.3", "脚本质量引擎", "商品活动、质量评分、低分重写、可拍理由"],
  ["V2.4", "采集任务中心", "任务状态、失败截图、登录态健康、手动重跑"],
  ["V2.5", "复盘学习闭环", "采用状态、发布表现、优质模板复用"],
];

const blueprintGoals = [
  ["最终交付", "每日候选脚本库", "每天沉淀 N 条可拍脚本，包含分镜、口播、字幕、来源、质量分和发布复盘。"],
  ["核心体验", "运营只做选择和判断", "系统负责采集、结构化、生成、评分和追踪，运营只需要选题、审核、回填。"],
  ["质量目标", "从热词文案变成可拍脚本", "每条脚本必须说明怎么拍、说什么、屏幕打什么字、用了哪些真实输入。"],
  ["数据原则", "自动采集失败不阻塞生产", "公开热榜、登录态小批量、人工导入、第三方表格四层保障必须可切换。"],
];

const blueprintRoles = [
  ["运营", "早上看采集保障和推荐选题，选 1-3 个方向生成脚本；下午审核脚本并回填发布表现。", "今日工作台 / 脚本流程 / 脚本库"],
  ["内容负责人", "看今日流程卡在哪一步、候选脚本质量、风险提示和可复用模板。", "今日生产闭环 / 复盘洞察"],
  ["采集维护", "维护登录态、采集计划、失败截图和第三方导入兜底。", "采集任务中心 / 对标内容池"],
  ["品牌负责人", "维护商品活动、可说权益、禁用表达和门店范围。", "品牌商品中心"],
];

const blueprintDataLanes = [
  ["A", "公开热榜", "稳定主干", "自动采集抖音总热榜；后续接小红书或第三方热点源。"],
  ["B", "登录态小批量", "谨慎增强", "每次 3 个词以内，遇验证码暂停，保留失败截图和错误原因。"],
  ["C", "人工导入", "正式兜底", "运营粘贴链接、字幕、笔记正文或飞书表格，保证当天生产不断。"],
  ["D", "第三方表格", "规模补充", "灰豚、蝉妈妈、飞瓜、新榜等表格先导入，API 深接后置。"],
];

const blueprintReleases = [
  ["R1", "生产闭环版", "首页闭环、审核队列、脚本生成、脚本库复盘跑通", "运营能每天生成、审核、回填。"],
  ["R2", "输入增厚版", "字幕任务、结构摘要、商品活动、对标账号内容池", "生成不再只依赖热词和品牌名。"],
  ["R3", "质量引擎版", "评分规则、自动改写、风险校验、模板复用", "低质量脚本能被识别和修正。"],
  ["R4", "采集保障版", "每日采集计划、登录态健康、失败兜底、第三方表格流程", "自动采集失败也不影响当天产出。"],
];

const specItems = [
  ["后端模块", "Workday、Trend、ContentSource、Subtitle、Structure、Generation、Review", "从单个原型 API 拆成 7 个服务边界。"],
  ["核心数据表", "workdays、trend_items、content_sources、subtitle_jobs、content_structures、script_candidates", "今日工作流、历史资产和任务状态分表管理。"],
  ["关键接口", "/api/v2/dashboard、/api/v2/content-sources、/api/v2/generation-jobs、/api/v2/script-library", "前端逐页切到 V2 API，data.js 只做兼容。"],
  ["验收门槛", "首页不混历史、人工导入可用、字幕可结构化、脚本有质量评分", "每个阶段都要有可验证的真实闭环。"],
];

renderModules();
renderProductCharter();
renderCurrentSprint();
renderObjectiveAudit();
renderObjectivePlan();
renderMasterPlan();
renderAcceptanceBoard();
renderReleaseRoadmap();
renderExecutionQueue();
renderWorkflowOverview();
renderRealDataLoopAudit();
renderSingleMaterialLoop();
renderFirstBenchmarkPlan();
renderWorkdayOpeningReminder();
renderStatus();
renderTopicRecommendations();
renderTasks();
renderOutputs();
renderReadiness();
renderReviewInsights();
renderBoundaries();
renderFeatures();
renderSources();
renderImports();
renderProducts();
renderQualityPipeline();
renderTargetSystemPlan();
renderExperienceGapBoard();
renderProductBlueprint();
renderRoadmap();
renderSpecs();
prefillManualImportFromUrl();
loadV2Dashboard();
loadBatchTemplate();
saveContentSourceBtn?.addEventListener("click", () => saveContentSource());
["contentTitle", "contentPlatform", "contentUrl", "contentAccount", "contentRawText"].forEach((id) => {
  document.getElementById(id)?.addEventListener("input", () => renderSinglePreview());
  document.getElementById(id)?.addEventListener("change", () => renderSinglePreview());
});
batchContentSourceBtn?.addEventListener("click", () => batchContentSources());
batchTemplatePanel?.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-template-action]");
  if (!actionButton) return;
  handleBatchTemplateAction(actionButton.dataset.templateAction);
});
bulkSelectContentSourcesBtn?.addEventListener("click", () => bulkSelectContentSources());
bulkStructureContentSourcesBtn?.addEventListener("click", () => bulkStructureContentSources());
saveBrandProductBtn?.addEventListener("click", () => saveBrandProduct());
resetWorkdayBtn?.addEventListener("click", () => resetTodayWorkday());
closeWorkdayBtn?.addEventListener("click", () => closeTodayWorkday());
workdayOpeningReminderPanel?.addEventListener("click", (event) => {
  const saveButton = event.target.closest("[data-save-handoff]");
  if (saveButton) saveOperationHandoff(saveButton);
  const copyButton = event.target.closest("[data-copy-handoff]");
  if (copyButton) copyOperationHandoff(copyButton);
  const processButton = event.target.closest("[data-process-handoff]");
  if (processButton) updateOperationHandoffProcess(processButton);
});
v2ScriptTarget?.addEventListener("input", () => renderV2GenerateButton());
v2GenerateScriptsBtn?.addEventListener("click", () => generateV2Scripts());
v2GeneratedList?.addEventListener("click", (event) => {
  const suggestionButton = event.target.closest("[data-review-suggestion]");
  if (suggestionButton) {
    applyReviewSuggestion(suggestionButton);
    return;
  }
  const reviewButton = event.target.closest("[data-v2-review]");
  if (reviewButton) {
    reviewV2GeneratedScript(reviewButton);
    return;
  }
  const publishButton = event.target.closest("[data-v2-publish]");
  if (publishButton) publishV2GeneratedScript(publishButton);
});
outputList?.addEventListener("click", (event) => {
  const suggestionButton = event.target.closest("[data-review-suggestion]");
  if (suggestionButton) {
    applyReviewSuggestion(suggestionButton);
    return;
  }
  const reviewButton = event.target.closest("[data-v2-review]");
  if (reviewButton) reviewV2GeneratedScript(reviewButton);
});
topicList?.addEventListener("click", (event) => {
  const adoptButton = event.target.closest("[data-adopt-topic]");
  if (adoptButton) adoptTopicRecommendation(adoptButton);
});

function prefillManualImportFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("importPlatform") && !params.has("importNote")) return;
  const platform = params.get("importPlatform") || "manual";
  const title = params.get("importTitle") || "";
  const url = params.get("importUrl") || "";
  const account = params.get("importAccount") || "";
  const note = params.get("importNote") || "";
  const platformEl = document.getElementById("contentPlatform");
  const titleEl = document.getElementById("contentTitle");
  const urlEl = document.getElementById("contentUrl");
  const accountEl = document.getElementById("contentAccount");
  const rawTextEl = document.getElementById("contentRawText");
  if (platformEl) platformEl.value = platform;
  if (titleEl) titleEl.value = title;
  if (urlEl) urlEl.value = url;
  if (accountEl) accountEl.value = account;
  if (rawTextEl) rawTextEl.value = note;
  if (importMessage) {
    importMessage.textContent = "已从采集任务带入人工导入信息，请补充链接、笔记文本或字幕后导入。";
    importMessage.className = "v2-import-message ok";
  }
  renderSinglePreview();
}

renderSinglePreview();

function renderModules() {
  if (!moduleGrid) return;
  const board = v2Dashboard?.v2ModuleBoard || v2Data.v2ModuleBoard;
  const boardModules = Array.isArray(board?.modules) ? board.modules : [];
  if (board?.version && boardModules.length) {
    const primary = board.primary || {};
    const primaryPackage = board.primaryPackage || {};
    const packageTasks = Array.isArray(primaryPackage.tasks) ? primaryPackage.tasks : [];
    const requiredFields = Array.isArray(primaryPackage.requiredFields) ? primaryPackage.requiredFields : [];
    const doneDefinition = Array.isArray(primaryPackage.doneDefinition) ? primaryPackage.doneDefinition : [];
    const blockedRules = Array.isArray(primaryPackage.blockedRules) ? primaryPackage.blockedRules : [];
    moduleGrid.innerHTML = `
      <article class="v2-module-board-hero ${escapeHtml(primary.status || "blocked")}">
        <div>
          <span class="caption">MODULE BUILD STATUS</span>
          <strong>${escapeHtml(board.headline || "V2 核心模块建设看板")}</strong>
          <p>${escapeHtml(board.summary || "")}</p>
          <small>${escapeHtml(board.rule || "按真实数据判断模块成熟度。")}</small>
        </div>
        <aside>
          <span>${Number(board.readyCount || 0)}/${Number(board.totalCount || 0)} 个模块可用</span>
          <b>${escapeHtml(primary.title || "当前优先模块")}</b>
          <p>${escapeHtml(primary.gap || primary.current || "")}</p>
          <a href="${escapeHtml(primary.href || "#")}">${escapeHtml(primary.nextAction || "处理模块缺口")}</a>
        </aside>
      </article>
      ${primaryPackage.version ? `
        <article class="v2-module-primary-package ${escapeHtml(primary.status || "blocked")}">
          <div class="v2-module-primary-head">
            <div>
              <span class="caption">PRIMARY MODULE PACKAGE</span>
              <strong>${escapeHtml(primaryPackage.headline || "当前优先模块实施任务包")}</strong>
              <p>${escapeHtml(primaryPackage.summary || "")}</p>
              <small><b>验收：</b>${escapeHtml(primaryPackage.acceptance || "")}</small>
            </div>
            <a href="${escapeHtml(primaryPackage.href || primary.href || "#")}">${escapeHtml(primaryPackage.nextAction || primary.nextAction || "处理模块缺口")}</a>
          </div>
          <div class="v2-module-package-tasks">
            ${packageTasks.length ? packageTasks.map((task, index) => `
              <a class="${escapeHtml(task.status || "waiting")}" href="${escapeHtml(task.href || primaryPackage.href || "#")}">
                <em>${String(index + 1).padStart(2, "0")}</em>
                <strong>${escapeHtml(task.label || "待处理步骤")}</strong>
                <span>${escapeHtml(task.statusLabel || moduleTaskStatusText(task.status))}</span>
                <p>${escapeHtml(task.evidence || "")}</p>
                <b>${escapeHtml(task.action || "去处理")}</b>
              </a>
            `).join("") : `<p class="v2-module-package-empty">当前模块暂无拆分任务，先进入模块页面处理主缺口。</p>`}
          </div>
          ${(requiredFields.length || doneDefinition.length || blockedRules.length) ? `
            <div class="v2-module-package-acceptance">
              ${requiredFields.length ? `
                <section>
                  <b>必填字段</b>
                  ${requiredFields.map((field) => `
                    <span><strong>${escapeHtml(field.label || "字段")}</strong>${escapeHtml(field.requirement || "")}</span>
                  `).join("")}
                </section>
              ` : ""}
              ${doneDefinition.length ? `
                <section>
                  <b>完成定义</b>
                  ${doneDefinition.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
                </section>
              ` : ""}
              ${blockedRules.length ? `
                <section class="blocked">
                  <b>不计入验收</b>
                  ${blockedRules.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
                </section>
              ` : ""}
            </div>
          ` : ""}
        </article>
      ` : ""}
      ${boardModules.map((item) => `
        <article class="v2-module-card ${escapeHtml(item.status || "in_progress")}">
          <div class="v2-module-card-head">
            <span>${escapeHtml(item.id || "")}</span>
            <em>${escapeHtml(moduleStatusText(item.status))}</em>
          </div>
          <strong>${escapeHtml(item.title || "")}</strong>
          <p>${escapeHtml(item.target || "")}</p>
          <small>${escapeHtml(item.current || "")}</small>
          <div class="v2-module-meter" aria-label="${escapeHtml(item.title || "")} 成熟度">
            <i style="width:${Math.max(0, Math.min(100, Number(item.maturity || 0)))}%"></i>
          </div>
          <div class="v2-module-metrics">
            ${(item.metrics || []).map((metric) => `<span><b>${escapeHtml(metric.value)}</b>${escapeHtml(metric.label || "")}</span>`).join("")}
          </div>
          <p class="v2-module-gap">${escapeHtml(item.gap || "")}</p>
          <a href="${escapeHtml(item.href || "#")}">${escapeHtml(item.nextAction || "查看入口")}</a>
        </article>
      `).join("")}
    `;
    return;
  }
  moduleGrid.innerHTML = modules.map(([title, desc, tag], index) => `
    <article class="v2-module-card">
      <span>${String(index + 1).padStart(2, "0")}</span>
      <strong>${title}</strong>
      <p>${desc}</p>
      <em>${tag}</em>
    </article>
  `).join("");
}

function moduleTaskStatusText(status) {
  return {
    done: "已完成",
    ready: "可处理",
    blocked: "阻塞",
    waiting: "等待",
    in_progress: "处理中",
  }[status] || "待判断";
}

function moduleStatusText(status) {
  return {
    ready: "可用",
    in_progress: "推进中",
    blocked: "有缺口",
  }[status] || "待判断";
}

function renderCurrentSprint() {
  if (!currentSprint) return;
  const workspace = v2Dashboard?.v2CurrentSprintWorkspace || v2Data.v2CurrentSprintWorkspace;
  if (!workspace?.version) {
    currentSprint.innerHTML = `
      <article class="v2-current-sprint-empty">
        <strong>等待当前 Sprint 执行台</strong>
        <p>连接 V2 API 后，这里会显示 P0-1 的当前卡点、验收证据、字段要求和可走的真实导入路径。</p>
      </article>
    `;
    return;
  }
  const sprint = workspace.currentSprint || {};
  const target = workspace.targetAccount || {};
  const blocker = workspace.blocker || {};
  const metrics = Array.isArray(workspace.metrics) ? workspace.metrics : [];
  const fields = Array.isArray(workspace.requiredFields) ? workspace.requiredFields : [];
  const taskSheet = workspace.taskSheetPackage || {};
  const steps = Array.isArray(workspace.steps) ? workspace.steps : [];
  const fallbackPaths = Array.isArray(workspace.fallbackPaths) ? workspace.fallbackPaths : [];
  const handoff = Array.isArray(workspace.handoff) ? workspace.handoff : [];
  const blockedRules = Array.isArray(workspace.blockedRules) ? workspace.blockedRules : [];
  currentSprint.innerHTML = `
    <section class="v2-current-sprint-hero ${escapeHtml(workspace.level || "blocked")}">
      <div>
        <span class="caption">CURRENT SPRINT</span>
        <h3>${escapeHtml(sprint.id || "P0-1")} · ${escapeHtml(sprint.title || workspace.headline || "当前 Sprint")}</h3>
        <p>${escapeHtml(workspace.summary || sprint.acceptance || "")}</p>
        <small>${escapeHtml(workspace.rule || "")}</small>
      </div>
      <aside class="${escapeHtml(workspace.level || "blocked")}">
        <span>${escapeHtml(blocker.label || "当前卡点")}</span>
        <strong>${escapeHtml(blocker.evidence || sprint.evidence || "")}</strong>
        <p>目标账号：${escapeHtml(target.accountName || "固定对标账号")} / ${escapeHtml(platformText(target.platform))}</p>
        <a href="${escapeHtml(blocker.href || sprint.href || "#")}">${escapeHtml(blocker.action || sprint.nextAction || "处理当前卡点")}</a>
      </aside>
    </section>
    <section class="v2-current-sprint-metrics">
      ${metrics.map((item) => `
        <article class="${escapeHtml(item.status || "blocked")}">
          <span>${escapeHtml(item.label || "")}</span>
          <strong>${escapeHtml(item.value || "0")}</strong>
        </article>
      `).join("")}
    </section>
    <section class="v2-current-sprint-body">
      <article class="v2-current-sprint-panel">
        <div class="v2-current-sprint-panel-head">
          <span class="caption">ACCEPTANCE STEPS</span>
          <h3>5 项验收现在卡在哪</h3>
        </div>
        <div class="v2-current-sprint-steps">
          ${steps.map((step) => `
            <a class="${escapeHtml(step.status || "blocked")}" href="${escapeHtml(step.href || "#")}">
              <em>${String(step.index || 1).padStart(2, "0")}</em>
              <div>
                <strong>${escapeHtml(step.label || "验收项")}</strong>
                <span>${escapeHtml(step.statusLabel || singleMaterialStatusText(step.status))}</span>
                <p>${escapeHtml(step.evidence || "")}</p>
              </div>
              <b>${escapeHtml(step.action || "去处理")}</b>
            </a>
          `).join("")}
        </div>
      </article>
      <article class="v2-current-sprint-panel">
        <div class="v2-current-sprint-panel-head">
          <span class="caption">REAL INPUT REQUIREMENT</span>
          <h3>运营要补的真实字段</h3>
        </div>
        <div class="v2-current-sprint-fields">
          ${fields.map((field) => `
            <section>
              <b>${escapeHtml(field.label || "字段")}</b>
              <p>${escapeHtml(field.requirement || "")}</p>
            </section>
          `).join("")}
        </div>
        ${taskSheet?.version ? `
          <div class="v2-current-sprint-task-sheet">
            <div class="v2-current-sprint-task-sheet-head">
              <div>
                <span class="caption">REAL MATERIAL TASK SHEET</span>
                <b>${escapeHtml(taskSheet.title || "真实素材补录任务单")}</b>
                <p>${escapeHtml(taskSheet.summary || "复制空白格式后，补真实链接、字幕或结构观察再导入。")}</p>
              </div>
              <a href="${escapeHtml(taskSheet.href || "#")}">去内容池填写</a>
            </div>
            <div class="v2-current-sprint-task-sheet-table" aria-label="P0-1 真实素材补录任务单格式">
              <code>${escapeHtml(taskSheet.header || "")}</code>
              ${(Array.isArray(taskSheet.blankRows) ? taskSheet.blankRows : []).map((row) => `<code>${escapeHtml(row)}</code>`).join("")}
            </div>
            <div class="v2-current-sprint-task-sheet-fields">
              ${(Array.isArray(taskSheet.fields) ? taskSheet.fields : []).map((field) => `
                <span><strong>${escapeHtml(field.label || "字段")}</strong>${escapeHtml(field.meaning || "")}</span>
              `).join("")}
            </div>
            <div class="v2-current-sprint-task-sheet-rules">
              ${(Array.isArray(taskSheet.rules) ? taskSheet.rules : []).map((rule) => `<em>${escapeHtml(rule)}</em>`).join("")}
            </div>
          </div>
        ` : ""}
      </article>
    </section>
    <section class="v2-current-sprint-bottom">
      <article>
        <b>可走的采集替代路径</b>
        <div class="v2-current-sprint-paths">
          ${fallbackPaths.map((path) => `
            <a class="${path.recommended ? "recommended" : ""}" href="${escapeHtml(path.href || "#")}">
              <span>${escapeHtml(path.label || "路径")}</span>
              <strong>${escapeHtml(path.title || path.when || "")}</strong>
              <p>${escapeHtml(path.input || path.when || "")}</p>
              <em>${escapeHtml(path.action || "去处理")}</em>
            </a>
          `).join("")}
        </div>
      </article>
      <article>
        <b>补完后的接力顺序</b>
        ${handoff.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </article>
      <article class="blocked">
        <b>不计入验收</b>
        ${blockedRules.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </article>
    </section>
  `;
}

function renderMasterPlan() {
  if (!masterPlan) return;
  const plan = v2Dashboard?.v2MasterPlan || v2Data.v2MasterPlan;
  if (!plan?.version) {
    masterPlan.innerHTML = `
      <article class="v2-master-empty">
        <strong>等待大版本作战计划</strong>
        <p>连接 V2 API 后，这里会把最终目标、当前卡点、开发包和采集替代方案合成一个可执行入口。</p>
      </article>
    `;
    return;
  }
  const currentGap = plan.currentGap || {};
  const workstreams = Array.isArray(plan.workstreams) ? plan.workstreams : [];
  const experience = Array.isArray(plan.operatorExperience) ? plan.operatorExperience : [];
  const dataFallbacks = Array.isArray(plan.dataFallbacks) ? plan.dataFallbacks : [];
  const versionGates = Array.isArray(plan.versionGates) ? plan.versionGates : [];
  masterPlan.innerHTML = `
    <section class="v2-master-hero">
      <div>
        <span class="caption">BIG VERSION DIRECTION</span>
        <h3>${escapeHtml(plan.headline || "下一大版本规划")}</h3>
        <p>${escapeHtml(plan.finalTarget || "")}</p>
        <small>${escapeHtml(plan.currentReality || "")}</small>
      </div>
      <aside class="${escapeHtml(currentGap.level || "blocked")}">
        <span>${escapeHtml(currentGap.label || "当前卡点")}</span>
        <strong>${escapeHtml(currentGap.title || plan.nextAction || "处理下一步")}</strong>
        <p>${escapeHtml(currentGap.evidence || "")}</p>
        <a href="${escapeHtml(currentGap.href || plan.nextHref || "#")}">${escapeHtml(currentGap.action || plan.nextAction || "去处理")}</a>
      </aside>
    </section>
    <section class="v2-master-section">
      <div class="v2-master-section-head">
        <span class="caption">RELEASE WORKSTREAMS</span>
        <h3>大版本开发包</h3>
        <p>每个开发包都必须有真实数据证据、运营入口和验收标准。</p>
      </div>
      <div class="v2-master-workstreams">
        ${workstreams.map((item) => `
          <article class="${escapeHtml(item.status || "needs_work")}">
            <div>
              <span>${escapeHtml(item.id || "")}</span>
              <em>${escapeHtml(item.statusLabel || releaseStatusText(item.status))}</em>
            </div>
            <strong>${escapeHtml(item.title || "")}</strong>
            <p>${escapeHtml(item.scope || "")}</p>
            <small><b>验收：</b>${escapeHtml(item.acceptance || "")}</small>
            <small><b>证据：</b>${escapeHtml(item.evidence || "")}</small>
            <a href="${escapeHtml(item.href || "#")}">${escapeHtml(item.nextAction || "查看入口")}</a>
          </article>
        `).join("")}
      </div>
    </section>
    <section class="v2-master-split">
      <div class="v2-master-section compact">
        <div class="v2-master-section-head">
          <span class="caption">OPERATING UX</span>
          <h3>目标体验</h3>
        </div>
        <div class="v2-master-experience">
          ${experience.map((item) => `
            <article>
              <span>${escapeHtml(item.step || "")}</span>
              <strong>${escapeHtml(item.title || "")}</strong>
              <p><b>运营：</b>${escapeHtml(item.operatorAction || "")}</p>
              <p><b>系统：</b>${escapeHtml(item.systemAction || "")}</p>
              <a href="${escapeHtml(item.href || "#")}">进入</a>
            </article>
          `).join("")}
        </div>
      </div>
      <div class="v2-master-section compact">
        <div class="v2-master-section-head">
          <span class="caption">DATA FALLBACKS</span>
          <h3>采集替代方案</h3>
        </div>
        <div class="v2-master-fallbacks">
          ${dataFallbacks.map((item) => `
            <article>
              <span>${escapeHtml(item.layer || "")}</span>
              <div>
                <strong>${escapeHtml(item.name || "")}</strong>
                <p>${escapeHtml(item.current || "")}</p>
                <small>${escapeHtml(item.fallback || "")}</small>
              </div>
            </article>
          `).join("")}
        </div>
      </div>
    </section>
    ${versionGates.length ? `
      <div class="v2-master-gates">
        <b>大版本验收红线</b>
        ${versionGates.map((gate) => `<span>${escapeHtml(gate)}</span>`).join("")}
      </div>
    ` : ""}
  `;
}

function renderProductCharter() {
  if (!productCharter) return;
  const charter = v2Dashboard?.v2ProductCharter || v2Data.v2ProductCharter;
  if (!charter?.version) {
    productCharter.innerHTML = `
      <article class="v2-charter-empty">
        <strong>等待产品章程数据</strong>
        <p>连接 V2 API 后，这里会用真实状态生成最终目标、当前事实、开发焦点、数据兜底和验收红线。</p>
      </article>
    `;
    return;
  }
  const focus = charter.focus || {};
  const facts = Array.isArray(charter.currentFacts) ? charter.currentFacts : [];
  const releasePackages = Array.isArray(charter.releasePackages) ? charter.releasePackages : [];
  const dataFallbacks = Array.isArray(charter.dataFallbacks) ? charter.dataFallbacks : [];
  const guardrails = Array.isArray(charter.guardrails) ? charter.guardrails : [];
  const nonGoals = Array.isArray(charter.nonGoals) ? charter.nonGoals : [];
  productCharter.innerHTML = `
    <section class="v2-charter-hero ${escapeHtml(charter.level || "blocked")}">
      <div>
        <span class="caption">FINAL TARGET</span>
        <h3>${escapeHtml(charter.headline || "V2 大版本产品章程")}</h3>
        <p>${escapeHtml(charter.finalTarget || "")}</p>
        <small>${escapeHtml(charter.currentReality || "")}</small>
      </div>
      <aside class="${escapeHtml(focus.status || charter.level || "blocked")}">
        <span>${escapeHtml(focus.id || "NEXT")}</span>
        <strong>${escapeHtml(focus.title || charter.nextAction || "处理下一步")}</strong>
        <p>${escapeHtml(focus.why || focus.evidence || "")}</p>
        <a href="${escapeHtml(focus.href || charter.nextHref || "#")}">${escapeHtml(focus.action || charter.nextAction || "去处理")}</a>
      </aside>
    </section>
    <section class="v2-charter-facts">
      ${facts.map((item) => `
        <article class="${escapeHtml(item.status || "neutral")}">
          <span>${escapeHtml(item.label || "")}</span>
          <strong>${escapeHtml(item.value || "")}</strong>
          <p>${escapeHtml(item.meaning || "")}</p>
        </article>
      `).join("")}
    </section>
    <section class="v2-charter-grid">
      <article class="v2-charter-panel">
        <div class="v2-charter-panel-head">
          <span class="caption">BUILD PACKAGES</span>
          <h3>大版本开发包</h3>
        </div>
        <div class="v2-charter-package-list">
          ${releasePackages.map((item) => `
            <a class="${escapeHtml(item.status || "needs_work")}" href="${escapeHtml(item.href || "#")}">
              <span>${escapeHtml(item.id || "")}</span>
              <div>
                <strong>${escapeHtml(item.title || "")}</strong>
                <p>${escapeHtml(item.acceptance || item.scope || "")}</p>
                <small>${escapeHtml(item.evidence || item.statusLabel || "")}</small>
              </div>
            </a>
          `).join("")}
        </div>
      </article>
      <article class="v2-charter-panel">
        <div class="v2-charter-panel-head">
          <span class="caption">DATA CONTINUITY</span>
          <h3>数据采集替代方案</h3>
        </div>
        <div class="v2-charter-fallback-list">
          ${dataFallbacks.map((item) => `
            <article>
              <span>${escapeHtml(item.layer || "")}</span>
              <div>
                <strong>${escapeHtml(item.name || "")}</strong>
                <p>${escapeHtml(item.when || item.current || "")}</p>
                <small>${escapeHtml(item.fallback || item.risk || "")}</small>
              </div>
            </article>
          `).join("")}
        </div>
      </article>
    </section>
    <section class="v2-charter-bottom">
      <article>
        <b>验收红线</b>
        ${guardrails.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </article>
      <article>
        <b>当前不做</b>
        ${nonGoals.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </article>
    </section>
  `;
}

function renderObjectiveAudit() {
  if (!objectiveAudit) return;
  const audit = v2Dashboard?.v2ObjectiveAudit || v2Data.v2ObjectiveAudit;
  if (!audit?.version) {
    objectiveAudit.innerHTML = `
      <article class="v2-objective-empty">
        <strong>等待目标完成审计</strong>
        <p>连接 V2 API 后，这里会逐项检查产品功能、体验、最终目标、采集替代方案和大版本开发是否真的有证据支撑。</p>
      </article>
    `;
    return;
  }
  const items = Array.isArray(audit.items) ? audit.items : [];
  objectiveAudit.innerHTML = `
    <section class="v2-objective-hero ${escapeHtml(audit.level || "in_progress")}">
      <div>
        <span class="caption">COMPLETION AUDIT</span>
        <h3>${escapeHtml(audit.headline || "目标完成审计")}</h3>
        <p>${escapeHtml(audit.summary || "")}</p>
        <small>${escapeHtml(audit.rule || "")}</small>
      </div>
      <aside>
        <span>${Number(audit.partialCount || 0)}/${Number(audit.totalCount || 0)} 项已有进展</span>
        <strong>${escapeHtml(audit.completionStatement || "当前不能标记为完成。")}</strong>
        <p>${Number(audit.blockedCount || 0)} 项仍被真实数据或闭环验收阻塞。</p>
      </aside>
    </section>
    <section class="v2-objective-list" aria-label="目标完成逐项审计">
      ${items.map((item) => `
        <article class="${escapeHtml(item.status || "not_complete")}">
          <div class="v2-objective-row-head">
            <span>${escapeHtml(item.id || "")}</span>
            <div>
              <strong>${escapeHtml(item.requirement || "未命名目标")}</strong>
              <em>${escapeHtml(item.statusLabel || objectiveStatusText(item.status))}</em>
            </div>
            <a href="${escapeHtml(item.href || "#")}">${escapeHtml(item.nextAction || "查看下一步")}</a>
          </div>
          <div class="v2-objective-row-body">
            <section>
              <b>当前证据</b>
              <p>${escapeHtml(item.evidence || "暂无证据。")}</p>
            </section>
            <section>
              <b>还差什么</b>
              <p>${escapeHtml(item.gap || "等待补充验收标准。")}</p>
            </section>
          </div>
        </article>
      `).join("")}
    </section>
  `;
}

function objectiveStatusText(status) {
  return {
    ready: "已完成",
    planned: "已规划",
    partially_implemented: "部分实现",
    blocked: "阻塞",
    not_complete: "未完成",
  }[status] || "待判断";
}

function renderObjectivePlan() {
  if (!objectivePlan) return;
  const plan = v2Dashboard?.v2ObjectiveImplementationPlan || v2Data.v2ObjectiveImplementationPlan;
  if (!plan?.version) {
    objectivePlan.innerHTML = `
      <article class="v2-objective-plan-empty">
        <strong>等待目标实施排期</strong>
        <p>连接 V2 API 后，这里会把目标审计转换成开发包、依赖关系、验收证据和下一步入口。</p>
      </article>
    `;
    return;
  }
  const sprint = plan.currentSprint || {};
  const rows = Array.isArray(plan.rows) ? plan.rows : [];
  const sequence = Array.isArray(plan.sequence) ? plan.sequence : [];
  objectivePlan.innerHTML = `
    <section class="v2-objective-plan-hero ${escapeHtml(plan.level || "blocked")}">
      <div>
        <span class="caption">IMPLEMENTATION FROM AUDIT</span>
        <h3>${escapeHtml(plan.headline || "从目标审计到开发排期")}</h3>
        <p>${escapeHtml(plan.summary || "")}</p>
        <small>${escapeHtml(plan.rule || "")}</small>
      </div>
      <aside class="${escapeHtml(sprint.status || "blocked")}">
        <span>${escapeHtml(sprint.id || "SPRINT")}</span>
        <strong>${escapeHtml(sprint.title || "当前 Sprint")}</strong>
        <p>${escapeHtml(sprint.evidence || sprint.acceptance || "")}</p>
        <a href="${escapeHtml(sprint.href || "#")}">${escapeHtml(sprint.nextAction || "处理当前 Sprint")}</a>
      </aside>
    </section>
    ${sequence.length ? `
      <section class="v2-objective-sequence">
        <b>推进顺序</b>
        ${sequence.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </section>
    ` : ""}
    <section class="v2-objective-plan-list" aria-label="目标审计对应开发排期">
      ${rows.map((item) => `
        <article class="${escapeHtml(item.packageStatus || item.auditStatus || "not_complete")}">
          <div class="v2-objective-plan-head">
            <span>${escapeHtml(item.stage || "待排期")}</span>
            <div>
              <strong>${escapeHtml(item.objective || "未命名目标")}</strong>
              <em>${escapeHtml(item.packageId || "未分包")}${item.releaseId ? ` / ${escapeHtml(item.releaseId)}` : ""} · ${escapeHtml(item.auditStatusLabel || objectiveStatusText(item.auditStatus))}</em>
            </div>
            <a href="${escapeHtml(item.href || "#")}">${escapeHtml(item.nextAction || "去处理")}</a>
          </div>
          <div class="v2-objective-plan-grid">
            <section>
              <b>交付物</b>
              <p>${escapeHtml(item.deliverable || "")}</p>
            </section>
            <section>
              <b>验收证据</b>
              <p>${escapeHtml(item.acceptance || "")}</p>
            </section>
            <section>
              <b>当前证据</b>
              <p>${escapeHtml(item.evidence || "")}</p>
            </section>
            <section>
              <b>缺口 / 依赖</b>
              <p>${escapeHtml(item.gap || "")}</p>
              ${(item.dependencies || []).length ? `<div>${item.dependencies.map((dep) => `<span>${escapeHtml(dep)}</span>`).join("")}</div>` : ""}
            </section>
          </div>
          <small>负责人：${escapeHtml(item.owner || "待定")}</small>
        </article>
      `).join("")}
    </section>
  `;
}

function renderAcceptanceBoard() {
  if (!acceptanceBoard) return;
  const board = v2Dashboard?.v2AcceptanceBoard || v2Data.v2AcceptanceBoard;
  if (!board?.version) {
    acceptanceBoard.innerHTML = `
      <article class="v2-acceptance-empty">
        <strong>等待大版本验收数据</strong>
        <p>连接 V2 API 后，这里会按真实数据检查 R1-R4 是否达到可验收状态。</p>
      </article>
    `;
    return;
  }
  const rows = Array.isArray(board.rows) ? board.rows : [];
  const gates = Array.isArray(board.gates) ? board.gates : [];
  const maturityGaps = Array.isArray(board.maturityGaps) ? board.maturityGaps.slice(0, 4) : [];
  acceptanceBoard.innerHTML = `
    <section class="v2-acceptance-hero ${escapeHtml(board.level || "blocked")}">
      <div>
        <span class="caption">ACCEPTANCE STATUS</span>
        <h3>${escapeHtml(board.headline || "V2 大版本验收总表")}</h3>
        <p>${escapeHtml(board.summary || "")}</p>
      </div>
      <aside>
        <span>${Number(board.overallPercent || 0)}%</span>
        <strong>${Number(board.readyChecks || 0)}/${Number(board.totalChecks || 0)} 项满足</strong>
        <p>${Number(board.blockedReleaseCount || 0)} 个版本仍有缺口</p>
        <a href="${escapeHtml(board.nextHref || "#")}">${escapeHtml(board.nextAction || "处理下一项缺口")}</a>
      </aside>
    </section>
    <section class="v2-acceptance-table" aria-label="R1 到 R4 大版本验收状态">
      ${rows.map((row) => {
        const readyLabels = Array.isArray(row.readyLabels) ? row.readyLabels : [];
        const gapLabels = Array.isArray(row.gapLabels) ? row.gapLabels : [];
        const primaryGap = row.primaryGap || {};
        return `
          <article class="${escapeHtml(row.status || "needs_work")}">
            <div class="v2-acceptance-row-head">
              <span>${escapeHtml(row.id || "")}</span>
              <div>
                <strong>${escapeHtml(row.title || "")}</strong>
                <small>${escapeHtml(row.statusLabel || releaseStatusText(row.status))} · ${Number(row.percent || 0)}% · ${Number(row.readyCount || 0)}/${Number(row.totalCount || 0)} 项</small>
              </div>
              <a href="${escapeHtml(row.nextHref || "#")}">${escapeHtml(row.nextAction || "处理")}</a>
            </div>
            <div class="v2-release-meter" aria-label="${escapeHtml(row.title || "")} 验收进度">
              <i style="width:${Math.max(0, Math.min(100, Number(row.percent || 0)))}%"></i>
            </div>
            <div class="v2-acceptance-row-body">
              <div>
                <b>已满足</b>
                ${readyLabels.length ? readyLabels.map((label) => `<span>${escapeHtml(label)}</span>`).join("") : "<em>暂无</em>"}
              </div>
              <div class="gaps">
                <b>缺口</b>
                ${gapLabels.length ? gapLabels.map((label) => `<span>${escapeHtml(label)}</span>`).join("") : "<em>暂无</em>"}
              </div>
              <div class="primary-gap">
                <b>当前证据</b>
                <p>${escapeHtml(primaryGap.evidence || "该版本当前没有阻塞缺口。")}</p>
              </div>
            </div>
          </article>
        `;
      }).join("")}
    </section>
    ${gates.length ? `
      <section class="v2-acceptance-gates">
        <b>验收红线</b>
        ${gates.map((gate) => `<span>${escapeHtml(gate)}</span>`).join("")}
      </section>
    ` : ""}
    ${maturityGaps.length ? `
      <section class="v2-acceptance-maturity">
        <div>
          <span class="caption">AFTER ACCEPTANCE</span>
          <strong>即使 R1-R4 全绿，仍要继续补的目标系统缺口</strong>
        </div>
        <div>
          ${maturityGaps.map((gap) => `
            <a href="${escapeHtml(gap.href || "#")}">
              <b>${escapeHtml(gap.area || "成熟度缺口")}</b>
              <span>${escapeHtml(gap.nextAction || "查看下一步")}</span>
            </a>
          `).join("")}
        </div>
      </section>
    ` : ""}
  `;
}

function renderReleaseRoadmap() {
  if (!releaseRoadmap) return;
  const roadmapData = v2Dashboard?.v2ReleaseRoadmap || v2Data.v2ReleaseRoadmap;
  if (!roadmapData?.version) {
    releaseRoadmap.innerHTML = `
      <article class="v2-release-roadmap-empty">
        <strong>等待发布计划数据</strong>
        <p>连接 V2 API 后，这里会显示 R1-R4 的发布顺序、依赖关系、阻塞证据和发布红线。</p>
      </article>
    `;
    return;
  }
  const primary = roadmapData.primary || {};
  const milestones = Array.isArray(roadmapData.milestones) ? roadmapData.milestones : [];
  const releasePolicy = Array.isArray(roadmapData.releasePolicy) ? roadmapData.releasePolicy : [];
  const executionLinks = Array.isArray(roadmapData.executionLinks) ? roadmapData.executionLinks : [];
  releaseRoadmap.innerHTML = `
    <section class="v2-release-roadmap-hero ${escapeHtml(roadmapData.level || "blocked")}">
      <div>
        <span class="caption">SHIP SEQUENCE</span>
        <h3>${escapeHtml(roadmapData.headline || "V2 大版本发布计划")}</h3>
        <p>${escapeHtml(roadmapData.summary || "")}</p>
        <div class="v2-release-roadmap-stats">
          <span><b>${Number(roadmapData.overallPercent || 0)}%</b>总验收</span>
          <span><b>${Number(roadmapData.readyReleaseCount || 0)}</b>可发布</span>
          <span><b>${Number(roadmapData.blockedReleaseCount || 0)}</b>有阻塞</span>
        </div>
      </div>
      <aside class="${escapeHtml(primary.status || "needs_work")}">
        <span>${escapeHtml(primary.id || "NEXT")}</span>
        <strong>${escapeHtml(primary.title || "等待下一版本")}</strong>
        <p>${escapeHtml(primary.target || "先处理真实输入和生产闭环依赖。")}</p>
        <a href="${escapeHtml(roadmapData.nextHref || primary.href || "#")}">${escapeHtml(roadmapData.nextAction || primary.nextAction || "处理下一版本缺口")}</a>
      </aside>
    </section>
    <section class="v2-release-roadmap-grid" aria-label="V2 R1 到 R4 发布里程碑">
      ${milestones.map((item, index) => {
        const dependencies = Array.isArray(item.dependencies) ? item.dependencies : [];
        const blockers = Array.isArray(item.blockers) ? item.blockers : [];
        const shipCriteria = Array.isArray(item.shipCriteria) ? item.shipCriteria : [];
        return `
          <article class="${escapeHtml(item.status || "needs_work")}">
            <div class="v2-release-card-head">
              <div>
                <span>${String(index + 1).padStart(2, "0")}</span>
                <em>${escapeHtml(item.id || "")}</em>
              </div>
              <small>${escapeHtml(item.statusLabel || releaseStatusText(item.status))} · ${Number(item.percent || 0)}%</small>
            </div>
            <strong>${escapeHtml(item.title || "")}</strong>
            <p>${escapeHtml(item.target || "")}</p>
            <div class="v2-release-meter" aria-label="${escapeHtml(item.title || "")} 发布进度">
              <i style="width:${Math.max(0, Math.min(100, Number(item.percent || 0)))}%"></i>
            </div>
            <div class="v2-release-dependencies">
              <b>依赖</b>
              ${dependencies.length ? dependencies.map((dep) => `
                <span class="${dep.ready ? "ready" : "blocked"}">${escapeHtml(dep.id || "")} ${dep.ready ? "已满足" : `${Number(dep.percent || 0)}%`}</span>
              `).join("") : "<em>无前置依赖</em>"}
            </div>
            <div class="v2-release-blockers">
              <b>阻塞证据</b>
              ${blockers.length ? blockers.map((blocker) => `
                <a href="${escapeHtml(blocker.href || item.href || "#")}">
                  <span>${escapeHtml(blocker.label || "验收缺口")}</span>
                  <small>${escapeHtml(blocker.evidence || blocker.action || "")}</small>
                </a>
              `).join("") : "<em>暂无阻塞</em>"}
            </div>
            <details class="v2-release-criteria">
              <summary>查看发布门槛</summary>
              <div>
                ${shipCriteria.length ? shipCriteria.map((label) => `<span>${escapeHtml(label)}</span>`).join("") : "<em>暂无门槛数据</em>"}
              </div>
            </details>
            <a class="v2-release-next" href="${escapeHtml(item.href || "#")}">${escapeHtml(item.nextAction || "处理该版本")}</a>
          </article>
        `;
      }).join("")}
    </section>
    <section class="v2-release-roadmap-bottom">
      ${releasePolicy.length ? `
        <div class="v2-release-policy">
          <b>发布红线</b>
          ${releasePolicy.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
        </div>
      ` : ""}
      ${executionLinks.length ? `
        <div class="v2-release-execution-links">
          <b>对应执行入口</b>
          ${executionLinks.map((item) => `
            <a href="${escapeHtml(item.href || "#")}">
              <span>${escapeHtml(item.priority || "P1")}</span>
              <strong>${escapeHtml(item.title || item.action || "去处理")}</strong>
            </a>
          `).join("")}
        </div>
      ` : ""}
    </section>
  `;
}

function renderExecutionQueue() {
  if (!executionQueue) return;
  const queue = v2Dashboard?.v2ExecutionQueue || v2Data.v2ExecutionQueue;
  if (!queue?.version) {
    executionQueue.innerHTML = `
      <article class="v2-execution-empty">
        <strong>等待执行队列</strong>
        <p>连接 V2 API 后，这里会把验收缺口转换成按依赖排序的下一步动作。</p>
      </article>
    `;
    return;
  }
  const primary = queue.primary || {};
  const items = Array.isArray(queue.items) ? queue.items : [];
  executionQueue.innerHTML = `
    <section class="v2-execution-hero ${escapeHtml(queue.level || "actionable")}">
      <div>
        <span class="caption">QUEUE LOGIC</span>
        <h3>${escapeHtml(queue.headline || "下一步执行队列")}</h3>
        <p>${escapeHtml(queue.summary || "")}</p>
        <small>${escapeHtml(queue.rule || "")}</small>
      </div>
      <aside>
        <span>${escapeHtml(primary.priority || "P0")}</span>
        <strong>${escapeHtml(primary.title || "等待下一步")}</strong>
        <p>${escapeHtml(primary.why || "")}</p>
        <a href="${escapeHtml(primary.href || "#")}">${escapeHtml(primary.action || "去处理")}</a>
      </aside>
    </section>
    <section class="v2-execution-list">
      ${items.map((item, index) => `
        <article class="${escapeHtml(item.status || "waiting")}">
          <div class="v2-execution-index">
            <span>${String(index + 1).padStart(2, "0")}</span>
            <em>${escapeHtml(item.priority || "P1")}</em>
          </div>
          <div class="v2-execution-body">
            <strong>${escapeHtml(item.title || "待处理动作")}</strong>
            <p><b>为什么先做：</b>${escapeHtml(item.why || "")}</p>
            <p><b>当前证据：</b>${escapeHtml(item.evidence || "")}</p>
            <div class="v2-execution-unlocks">
              ${(item.unlocks || []).map((label) => `<span>${escapeHtml(label)}</span>`).join("")}
            </div>
          </div>
          <div class="v2-execution-action">
            <small>${escapeHtml(item.owner || "运营")}</small>
            <a href="${escapeHtml(item.href || "#")}">${escapeHtml(item.action || "去处理")}</a>
          </div>
        </article>
      `).join("")}
    </section>
  `;
}

function renderWorkflowOverview() {
  if (!workflowOverview) return;
  const overview = v2Dashboard?.workflowOverview || v2Data.workflowOverview;
  if (!overview) {
    workflowOverview.innerHTML = `
      <article class="v2-workflow-summary blocked">
        <span>等待数据</span>
        <strong>还不能判断今日生产闭环</strong>
        <p>连接 V2 API 后，这里会展示采集、选题、输入、生成、审核和复盘的状态。</p>
      </article>
    `;
    return;
  }
  const steps = Array.isArray(overview.steps) ? overview.steps : [];
  workflowOverview.innerHTML = `
    <article class="v2-workflow-summary ${escapeHtml(overview.level || "in_progress")}">
      <span>${workflowLevelText(overview.level)}</span>
      <strong>${escapeHtml(overview.summary || "今日流程待判断")}</strong>
      <p>${escapeHtml(overview.nextAction || "查看下一步动作")}</p>
      <a href="${escapeHtml(overview.nextHref || "#")}">执行下一步</a>
    </article>
    <div class="v2-workflow-steps">
      ${steps.map((step, index) => `
        <article class="v2-workflow-step ${escapeHtml(step.status || "waiting")}">
          <div>
            <span>${String(index + 1).padStart(2, "0")}</span>
            <em>${escapeHtml(step.statusLabel || "待处理")}</em>
          </div>
          <strong>${escapeHtml(step.label || "未命名步骤")}</strong>
          <p>${escapeHtml(step.evidence || "暂无证据")}</p>
          <a href="${escapeHtml(step.href || "#")}">${escapeHtml(step.action || "去处理")}</a>
        </article>
      `).join("")}
    </div>
  `;
}

function renderRealDataLoopAudit() {
  if (!realDataLoopAudit) return;
  const audit = v2Dashboard?.realDataLoopAudit;
  const lanes = Array.isArray(audit?.lanes) ? audit.lanes : [];
  if (!audit?.version) {
    realDataLoopAudit.innerHTML = `
      <article class="v2-real-loop-empty">
        <strong>等待真实数据闭环体检</strong>
        <p>连接 V2 API 后，这里会检查采集/导入、对标素材、结构证据、脚本产出和复盘回流。</p>
      </article>
    `;
    return;
  }
  realDataLoopAudit.innerHTML = `
    <article class="v2-real-loop-summary ${escapeHtml(audit.level || "blocked")}">
      <div>
        <span>${escapeHtml(audit.levelLabel || realLoopLevelText(audit.level))}</span>
        <strong>${escapeHtml(audit.summary || "等待闭环判断")}</strong>
        <p>${escapeHtml(audit.rule || "按真实数据判断，不用模拟状态填充。")}</p>
      </div>
      <aside>
        <span><b>${audit.counts?.ready || 0}</b>已跑通</span>
        <span><b>${audit.counts?.partial || 0}</b>部分可用</span>
        <span><b>${audit.counts?.blocked || 0}</b>未跑通</span>
      </aside>
      <a href="${escapeHtml(audit.nextHref || "#")}">${escapeHtml(audit.nextAction || "处理下一步")}</a>
    </article>
    <div class="v2-real-loop-lanes">
      ${lanes.map((lane, index) => `
        <a class="${escapeHtml(lane.status || "blocked")}" href="${escapeHtml(lane.href || "#")}">
          <div>
            <span>${String(index + 1).padStart(2, "0")}</span>
            <em>${escapeHtml(lane.statusLabel || realLoopStatusText(lane.status))}</em>
          </div>
          <strong>${escapeHtml(lane.title || "未命名链路")}</strong>
          <p>${escapeHtml(lane.evidence || "暂无证据")}</p>
          <small>目标：${escapeHtml(lane.target || "待明确")}</small>
          <b>${escapeHtml(lane.action || "去处理")}</b>
        </a>
      `).join("")}
    </div>
  `;
}

function renderSingleMaterialLoop() {
  if (!singleMaterialLoop) return;
  const loop = v2Dashboard?.singleMaterialLoop;
  const firstBenchmark = v2Dashboard?.firstBenchmarkMaterialPlan;
  const steps = Array.isArray(loop?.steps) ? loop.steps : [];
  if (!loop?.version) {
    singleMaterialLoop.innerHTML = `
      <article class="v2-single-material-empty">
        <strong>等待单条真实素材追踪</strong>
        <p>连接 V2 API 后，这里会显示 1 条真实内容池素材从入库到脚本生成的处理状态。</p>
      </article>
    `;
    return;
  }
  const source = loop.source || {};
  const excludedSamples = Array.isArray(loop.excludedSamples) ? loop.excludedSamples : [];
  singleMaterialLoop.innerHTML = `
    ${renderP01AcceptanceBoard(loop, firstBenchmark)}
    <article class="v2-single-material-summary ${escapeHtml(loop.level || "empty")}">
      <div>
        <span>${escapeHtml(loop.levelLabel || singleMaterialLevelText(loop.level))}</span>
        <strong>${escapeHtml(loop.summary || "等待素材闭环判断")}</strong>
        <p>${escapeHtml(loop.rule || "只追踪真实素材，不使用模拟样例。")}</p>
      </div>
      ${source.id ? `
        <aside>
          <b>${escapeHtml(source.title || "未命名素材")}</b>
          <span>${escapeHtml(platformText(source.platform))} / ${escapeHtml(source.accountName || "未知账号")}</span>
          <em>${source.selected ? "已加入生成" : "未加入生成"} · ${source.structured ? "已结构化" : "未结构化"}</em>
          <small>${source.linkedScript ? `已生成脚本 #${escapeHtml(source.linkedScript.id)}：${escapeHtml(source.linkedScript.title || "未命名脚本")}` : "还没有候选脚本读取这条素材"}</small>
        </aside>
      ` : `
        <aside>
          <b>暂无真实素材</b>
          <span>先从固定对标账号补 1 条链接、正文或字幕。</span>
          <em>不会用模拟数据占位</em>
        </aside>
      `}
      <a href="${escapeHtml(loop.nextHref || "#")}">${escapeHtml(loop.nextAction || "处理下一步")}</a>
    </article>
    ${!source.id ? renderFirstRealMaterialGuide(loop) : ""}
    ${loop.excludedCount ? `
      <div class="v2-single-material-excluded">
        <strong>已排除 ${Number(loop.excludedCount || 0)} 条非运营素材</strong>
        <p>测试、验证、示例和 example.com 链接不会被算作真实跑通证据。</p>
        ${excludedSamples.map((item) => `<span>#${escapeHtml(item.id)} ${escapeHtml(item.title || "未命名")}：${escapeHtml(item.reason || "非运营素材")}</span>`).join("")}
      </div>
    ` : ""}
    <div class="v2-single-material-steps">
      ${steps.map((step, index) => `
        <a class="${escapeHtml(step.status || "blocked")}" href="${escapeHtml(step.href || "#")}">
          <span>${String(index + 1).padStart(2, "0")}</span>
          <em>${escapeHtml(step.statusLabel || singleMaterialStatusText(step.status))}</em>
          <strong>${escapeHtml(step.label || "未命名步骤")}</strong>
          <p>${escapeHtml(step.evidence || "暂无证据")}</p>
          <b>${escapeHtml(step.action || "去处理")}</b>
        </a>
      `).join("")}
    </div>
  `;
}

function renderP01AcceptanceBoard(loop = {}, firstBenchmark = {}) {
  if (!loop?.version && !firstBenchmark?.version) return "";
  const benchmarkSteps = Array.isArray(firstBenchmark?.steps) ? firstBenchmark.steps : [];
  const materialSteps = Array.isArray(loop?.steps) ? loop.steps : [];
  const sourceSteps = benchmarkSteps.length ? benchmarkSteps : materialSteps;
  const counts = firstBenchmark?.counts || {};
  const target = firstBenchmark?.targetAccount || {};
  const source = loop?.source || {};
  const linkedScript = source?.linkedScript;
  const doneCount = sourceSteps.filter((step) => step.status === "done").length;
  const totalCount = sourceSteps.length || 5;
  const blockedStep = sourceSteps.find((step) => step.status === "blocked") || sourceSteps.find((step) => step.status === "waiting") || {};
  const ready = firstBenchmark?.level === "ready" || loop?.level === "ready";
  const nextHref = blockedStep.href || firstBenchmark?.nextHref || loop?.nextHref || "#";
  const nextAction = blockedStep.action || firstBenchmark?.nextAction || loop?.nextAction || "处理下一步";
  const stageMap = [
    { key: "import", label: "导入", benchmarkKey: "import", materialKey: "imported" },
    { key: "text", label: "文本", benchmarkKey: "text", materialKey: "text" },
    { key: "select", label: "加入", benchmarkKey: "select", materialKey: "selected" },
    { key: "structure", label: "结构", benchmarkKey: "structure", materialKey: "structured" },
    { key: "generate", label: "脚本读取", benchmarkKey: "generate", materialKey: "generation" },
  ];
  const stageItems = stageMap.map((stage) => {
    const step = sourceSteps.find((item) => item.key === stage.benchmarkKey || item.key === stage.materialKey) || {};
    return {
      ...stage,
      status: step.status || "waiting",
      statusLabel: step.statusLabel || singleMaterialStatusText(step.status),
      evidence: step.evidence || "等待上一步",
      href: step.href || nextHref,
      action: step.action || "去处理",
    };
  });
  return `
    <article class="v2-p01-acceptance-board ${escapeHtml(ready ? "ready" : "blocked")}">
      <div class="v2-p01-acceptance-head">
        <div>
          <span>P0-1 END TO END</span>
          <strong>${escapeHtml(ready ? "首条真实素材已跑通到脚本输入" : "首条真实素材还没有跑通到脚本输入")}</strong>
          <p>${escapeHtml(firstBenchmark?.summary || loop?.summary || "用一条真实对标素材验证完整链路。")}</p>
        </div>
        <a href="${escapeHtml(nextHref)}">${escapeHtml(nextAction)}</a>
      </div>
      <div class="v2-p01-acceptance-facts">
        <span><b>目标账号</b>${escapeHtml(target.accountName || source.accountName || "固定对标账号")}</span>
        <span><b>已完成</b>${doneCount}/${totalCount}</span>
        <span><b>素材</b>${Number(counts.imported || (source.id ? 1 : 0))}</span>
        <span><b>结构</b>${Number(counts.structured || (source.structured ? 1 : 0))}</span>
        <span><b>脚本证据</b>${linkedScript ? `#${escapeHtml(linkedScript.id)}` : "未读取"}</span>
      </div>
      <div class="v2-p01-acceptance-stages">
        ${stageItems.map((stage, index) => `
          <a class="${escapeHtml(stage.status || "waiting")}" href="${escapeHtml(stage.href || "#")}">
            <em>${String(index + 1).padStart(2, "0")}</em>
            <strong>${escapeHtml(stage.label)}</strong>
            <span>${escapeHtml(stage.statusLabel || singleMaterialStatusText(stage.status))}</span>
            <p>${escapeHtml(stage.evidence || "暂无证据")}</p>
            <b>${escapeHtml(stage.action || "去处理")}</b>
          </a>
        `).join("")}
      </div>
      <small>验收口径：必须是真实内容池素材，不接受账号名、热点词、example.com、测试或示例数据作为跑通证据。</small>
    </article>
  `;
}

function renderFirstRealMaterialGuide(loop) {
  const href = firstRealMaterialImportHref(loop);
  const acceptance = loop?.acceptance || {};
  const minimumEvidence = Array.isArray(acceptance.minimumEvidence) ? acceptance.minimumEvidence : [];
  const fallbackPaths = Array.isArray(acceptance.fallbackPaths) ? acceptance.fallbackPaths : [];
  const blockedRules = Array.isArray(acceptance.blockedRules) ? acceptance.blockedRules : [];
  return `
    <article class="v2-first-real-guide">
      <div>
        <span>FIRST REAL MATERIAL</span>
        <strong>${escapeHtml(acceptance.title || "先导入 1 条真实对标视频 / 笔记")}</strong>
        <p>${escapeHtml(acceptance.summary || "这一步不是继续补模拟数据，而是让系统真正跑通：真实链接或正文入库，然后补字幕、生成结构摘要，再生成候选脚本。")}</p>
      </div>
      <dl>
        ${(minimumEvidence.length ? minimumEvidence : [
          "真实作品链接，或可结构化的字幕 / 正文 / 备注",
          "账号名、为什么值得参考、开头/节奏/CTA 观察",
          "候选脚本输入证据能看到这条素材",
        ]).map((item, index) => `<div><dt>${index === 0 ? "必须有" : index === 1 ? "建议补" : "完成证据"}</dt><dd>${escapeHtml(item)}</dd></div>`).join("")}
      </dl>
      ${fallbackPaths.length ? `
        <div class="v2-first-real-paths">
          ${fallbackPaths.map((path) => `
            <a href="${escapeHtml(path.href || href)}">
              <b>${escapeHtml(path.label || "替代路径")}</b>
              <span>${escapeHtml(path.description || "按这条路径补齐真实素材。")}</span>
              <em>${escapeHtml(path.action || "去处理")}</em>
            </a>
          `).join("")}
        </div>
      ` : ""}
      ${blockedRules.length ? `
        <div class="v2-first-real-rules">
          <b>不计入验收</b>
          ${blockedRules.map((rule) => `<span>${escapeHtml(rule)}</span>`).join("")}
        </div>
      ` : ""}
      <a href="${escapeHtml(href)}">去导入首条真实素材</a>
    </article>
  `;
}

function firstRealMaterialImportHref(loop) {
  const params = new URLSearchParams({
    v: "first-real-material-v3",
    importPlatform: "douyin",
    importMode: "single",
    importTitle: "真实对标视频/笔记",
    importAccount: "固定对标账号",
    importNote: "请填写真实作品链接，并粘贴字幕、正文或结构观察。不要填写模板占位行。",
  });
  const taskHref = loop?.nextHref || "";
  if (taskHref.includes("benchmarkTaskId=")) {
    const taskParams = new URLSearchParams(taskHref.split("?")[1]?.split("#")[0] || "");
    const taskId = taskParams.get("benchmarkTaskId");
    if (taskId) params.set("benchmarkTaskId", taskId);
  }
  return `./content-pool.html?${params.toString()}#manual-import`;
}

function renderFirstBenchmarkPlan() {
  if (!firstBenchmarkPlan) return;
  const plan = v2Dashboard?.firstBenchmarkMaterialPlan;
  if (!plan?.version) {
    firstBenchmarkPlan.innerHTML = `
      <article class="v2-first-benchmark-empty">
        <strong>等待真实账号素材计划</strong>
        <p>连接 V2 API 后，这里会根据固定对标账号任务生成首条真实素材跑通计划。</p>
      </article>
    `;
    return;
  }
  const target = plan.targetAccount || {};
  const counts = plan.counts || {};
  const steps = Array.isArray(plan.steps) ? plan.steps : [];
  const evidence = Array.isArray(plan.evidenceRequired) ? plan.evidenceRequired : [];
  const fallbackPaths = Array.isArray(plan.fallbackPaths) ? plan.fallbackPaths : [];
  const blockedRules = Array.isArray(plan.blockedRules) ? plan.blockedRules : [];
  const operatorGuide = plan.operatorGuide || {};
  firstBenchmarkPlan.innerHTML = `
    <article class="v2-first-benchmark-summary ${escapeHtml(plan.level || "blocked")}">
      <div>
        <span>${escapeHtml(plan.levelLabel || "待判断")}</span>
        <strong>${escapeHtml(plan.headline || "首条真实账号素材跑通计划")}</strong>
        <p>${escapeHtml(plan.summary || "先用一个固定对标账号跑通真实素材到脚本生成。")}</p>
        <small>${escapeHtml(plan.rule || "只用真实账号近期内容作为证据。")}</small>
      </div>
      <aside>
        <b>${escapeHtml(target.accountName || "未选择账号")}</b>
        <span>${escapeHtml(platformText(target.platform))} / ${escapeHtml(target.category || "未分类")}</span>
        <em>${escapeHtml(target.statusLabel || "待更新")}</em>
        ${target.whyTrack ? `<p>${escapeHtml(target.whyTrack)}</p>` : ""}
      </aside>
      <a href="${escapeHtml(plan.nextHref || "#")}">${escapeHtml(plan.nextAction || "处理下一步")}</a>
    </article>
    <div class="v2-first-benchmark-counts">
      <span><b>已导入</b>${Number(counts.imported || 0)}</span>
      <span><b>有文本</b>${Number(counts.withText || 0)}</span>
      <span><b>已加入</b>${Number(counts.selected || 0)}</span>
      <span><b>已结构化</b>${Number(counts.structured || 0)}</span>
      <span><b>可生成</b>${Number(counts.ready || 0)}/${Number(counts.target || 1)}</span>
    </div>
    <div class="v2-first-benchmark-steps">
      ${steps.map((step, index) => `
        <a class="${escapeHtml(step.status || "blocked")}" href="${escapeHtml(step.href || "#")}">
          <span>${String(index + 1).padStart(2, "0")}</span>
          <em>${escapeHtml(step.statusLabel || singleMaterialStatusText(step.status))}</em>
          <strong>${escapeHtml(step.label || "未命名步骤")}</strong>
          <p>${escapeHtml(step.evidence || "暂无证据")}</p>
          <b>${escapeHtml(step.action || "去处理")}</b>
        </a>
      `).join("")}
    </div>
    ${operatorGuide.version ? firstBenchmarkOperatorGuideHtml(operatorGuide) : ""}
    <div class="v2-first-benchmark-evidence">
      <article>
        <b>跑通需要的证据</b>
        ${evidence.length ? evidence.map((item) => `<span>${escapeHtml(item)}</span>`).join("") : "<span>至少提供 1 条真实链接或可结构化正文。</span>"}
      </article>
      <article>
        <b>可用替代路径</b>
        <div class="v2-first-benchmark-paths">
          ${fallbackPaths.length ? fallbackPaths.map((path) => `
            <a href="${escapeHtml(path.href || plan.nextHref || "#")}">
              <strong>${escapeHtml(path.label || "替代路径")}</strong>
              <p>${escapeHtml(path.description || "按这条路径补齐真实素材。")}</p>
              <em>${escapeHtml(path.action || "去处理")}</em>
            </a>
          `).join("") : `<a href="${escapeHtml(plan.nextHref || "#")}"><strong>人工导入</strong><p>自动采集不稳定时，先补链接、字幕或正文。</p><em>去处理</em></a>`}
        </div>
      </article>
      <article class="rules">
        <b>不计入跑通</b>
        ${blockedRules.length ? blockedRules.map((rule) => `<span>${escapeHtml(rule)}</span>`).join("") : "<span>示例、测试和空链接都不算真实素材。</span>"}
      </article>
    </div>
  `;
}

function firstBenchmarkOperatorGuideHtml(guide) {
  const fields = Array.isArray(guide.requiredFields) ? guide.requiredFields : [];
  const runOrder = Array.isArray(guide.runOrder) ? guide.runOrder : [];
  const doneDefinition = Array.isArray(guide.doneDefinition) ? guide.doneDefinition : [];
  return `
    <section class="v2-first-benchmark-guide">
      <div class="v2-first-benchmark-guide-head">
        <div>
          <span>P0-1 OPERATOR GUIDE</span>
          <strong>${escapeHtml(guide.title || "先补 1 条真实账号素材")}</strong>
          <p>${escapeHtml(guide.summary || "按导入、文本、加入生成、结构摘要、脚本读取的顺序跑通。")}</p>
        </div>
        <a href="${escapeHtml(guide.primaryHref || "#")}">${escapeHtml(guide.primaryAction || "去补真实素材")}</a>
      </div>
      <div class="v2-first-benchmark-guide-grid">
        <article>
          <b>当前卡点</b>
          <p>${escapeHtml(guide.currentBlocker || "等待真实素材")}</p>
        </article>
        <article>
          <b>必填字段</b>
          ${fields.map((field) => `<span><strong>${escapeHtml(field.label || "字段")}</strong>${escapeHtml(field.requirement || "按真实素材填写")}</span>`).join("")}
        </article>
        <article>
          <b>完成定义</b>
          ${doneDefinition.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
        </article>
      </div>
      <div class="v2-first-benchmark-run-order">
        ${runOrder.map((item, index) => `
          <a href="${escapeHtml(item.href || "#")}">
            <em>${String(index + 1).padStart(2, "0")}</em>
            <strong>${escapeHtml(item.label || "执行步骤")}</strong>
            <p>${escapeHtml(item.action || "按当前步骤处理")}</p>
          </a>
        `).join("")}
      </div>
    </section>
  `;
}

function renderWorkdayOpeningReminder() {
  if (!workdayOpeningReminderPanel) return;
  const reminder = v2Dashboard?.workdayOpeningReminder;
  const priorities = Array.isArray(reminder?.priorities) ? reminder.priorities : [];
  const handoffs = Array.isArray(v2Dashboard?.operationHandoffs) ? v2Dashboard.operationHandoffs : [];
  if (!reminder?.version || !priorities.length) {
    workdayOpeningReminderPanel.innerHTML = `
      <article class="opening-reminder-card ready">
        <div>
          <span>OPENING CHECK</span>
          <strong>暂无高优先级遗留项</strong>
          <p>可以按今日工作流继续采集、选题、生成和审核。</p>
        </div>
        <a href="./v2.html?v=opening-reminder-v1">查看工作台</a>
      </article>
      ${handoffs.length ? handoffListHtml(handoffs) : ""}
    `;
    return;
  }
  workdayOpeningReminderPanel.innerHTML = `
    <article class="opening-reminder-card ${escapeHtml(reminder.level || "warning")}">
      <div class="opening-reminder-main">
        <span>OPENING CHECK</span>
        <strong>${escapeHtml(reminder.headline || "开工提醒")}</strong>
        <p>${escapeHtml(reminder.summary || "先处理上一轮未闭环项。")}</p>
        <small>${escapeHtml(reminder.rule || "")}</small>
      </div>
      <div class="opening-reminder-side">
        <div class="opening-reminder-counts">
          <span><b>${reminder.priorityCount || 0}</b>优先项</span>
          <span><b>${reminder.blockerCount || 0}</b>高优先级</span>
        </div>
        <div class="opening-reminder-list">
          ${priorities.slice(0, 3).map((item) => `
            <a href="${escapeHtml(item.href || "#")}">
              <em>${escapeHtml(item.statusLabel || dailyReviewStatusText(item.status))}</em>
              <strong>${escapeHtml(item.title || "遗留事项")}</strong>
              <span>${escapeHtml(item.action || "去处理")}</span>
            </a>
          `).join("")}
        </div>
        <div class="opening-reminder-actions">
          <a class="opening-reminder-primary" href="${escapeHtml(reminder.nextHref || "./collection-center.html?v=opening-reminder-v1#daily-review")}">${escapeHtml(reminder.nextAction || "处理第一项")}</a>
          <button type="button" data-save-handoff>保存交接记录</button>
        </div>
      </div>
    </article>
    ${handoffs.length ? handoffListHtml(handoffs) : ""}
  `;
}

function handoffListHtml(items) {
  return `
    <div class="handoff-list">
      <div class="handoff-list-head">
        <strong>最近交接记录</strong>
        <span>${items.length} 条</span>
      </div>
      ${items.slice(0, 3).map((item) => {
        const priorities = item.payload?.nextDayPriorities || [];
        return `
          <article>
            <div>
              <strong>${escapeHtml(item.summary || "运营交接")}</strong>
              <span>${escapeHtml(formatDate(item.createdAt))}</span>
            </div>
            <div class="handoff-process-meta">
              <em>${escapeHtml(item.processStatusLabel || handoffProcessStatusText(item.processStatus))}</em>
              <span>负责人：${escapeHtml(item.owner || "运营")}</span>
            </div>
            <p>${escapeHtml(item.note || `优先项 ${priorities.length} 个`)}</p>
            ${item.processNote ? `<p>处理备注：${escapeHtml(item.processNote)}</p>` : ""}
            <div class="handoff-actions">
              <button type="button" data-copy-handoff="${escapeHtml(item.id)}">复制交接文本</button>
              ${item.processStatus !== "processing" && item.processStatus !== "done" ? `<button type="button" data-process-handoff="processing" data-handoff-id="${escapeHtml(item.id)}">开始处理</button>` : ""}
              ${item.processStatus !== "done" ? `<button type="button" data-process-handoff="done" data-handoff-id="${escapeHtml(item.id)}">标记已处理</button>` : ""}
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function renderStatus() {
  if (!statusGrid) return;
  if (v2Dashboard) {
    const history = v2Dashboard.historyStats || {};
    const stats = v2Dashboard.stats || {};
    const items = [
      ["热榜数据", `${sourceCount("抖音总热榜")} 条`, `${sourceDesc("抖音总热榜")}；热榜作为每日候选源保留`],
      ["今日对标素材", `真实 ${stats.operationalContentSources || 0} / 总 ${stats.contentSources || 0} 条`, `${stats.selectedContentSources || 0} 条真实素材已加入生成工作流；排除 ${stats.excludedContentSources || 0} 条非运营素材；历史素材 ${history.contentSources || 0} 条`],
      ["今日结构处理", `${stats.contentStructures || 0} 条`, `今日真实素材结构 ${stats.contentStructures || 0} 条；历史结构 ${history.contentStructures || 0} 条`],
      ["今日脚本", `${stats.scripts || 0} 条`, `今天生成的候选脚本；历史脚本 ${history.scripts || 0} 条在脚本库复盘`],
      ["商品活动", `${stats.brandProducts || 0} 条`, `${stats.selectedBrandProducts || 0} 条已加入生成输入，跨工作日复用`],
      ["今日采集任务", `${stats.collectionTasks || 0} 条`, `${stats.failedCollectionTasks || 0} 条失败；历史任务 ${history.collectionTasks || 0} 条`],
    ];
    statusGrid.innerHTML = items.map(([label, value, desc]) => `
      <article class="v2-status-card">
        <span>${label}</span>
        <strong>${value}</strong>
        <p>${desc}</p>
      </article>
    `).join("");
    return;
  }
  const fetchedAt = v2Meta.hotRunFetchedAt ? formatDate(v2Meta.hotRunFetchedAt) : "暂无";
  const items = [
    ["热榜数据", `${v2Meta.hotRunItemCount || v2Hot.length || 0} 条`, `最近采集：${fetchedAt}`],
    ["对标结构", `${v2Benchmarks.length} 条`, "固定池可用，真实内容待导入"],
    ["结构处理", `${v2Processing.length} 条`, "字幕结构化仍需产品化"],
    ["人工导入", "0 条", "采集不稳定时的正式替代入口"],
    ["商品活动", "0 条", "脚本生成需要明确商品权益"],
    ["历史脚本", `${v2Scripts.length} 条`, "应进入脚本库，不污染今日工作台"],
  ];
  statusGrid.innerHTML = items.map(([label, value, desc]) => `
    <article class="v2-status-card">
      <span>${label}</span>
      <strong>${value}</strong>
      <p>${desc}</p>
    </article>
  `).join("");
}

function renderTopicRecommendations() {
  if (!topicList) return;
  const topics = v2Dashboard?.topicRecommendations || [];
  if (!v2Dashboard) {
    topicList.innerHTML = `
      <article class="v2-topic-card muted">
        <div>
          <span>等待真实数据</span>
          <strong>连接 V2 API 后展示今日推荐选题</strong>
          <p>推荐会读取热点、对标结构、商品活动和高表现模板。</p>
        </div>
      </article>
    `;
    return;
  }
  topicList.innerHTML = topics.length
    ? topics.map((topic, index) => `
      <article class="v2-topic-card ${topic.adopted ? "adopted" : ""}">
        <div class="v2-topic-score">
          <span>推荐度</span>
          <strong>${topic.score || 0}</strong>
        </div>
        <div class="v2-topic-main">
          <span>选题 ${index + 1}</span>
          <strong>${escapeHtml(topic.title || "未命名选题")}</strong>
          <p>${escapeHtml(topic.angle || "待补选题角度")}</p>
          <div class="v2-topic-source">
            <em>热点：${escapeHtml(topic.sourceHot || "无")}</em>
            <em>结构：${escapeHtml(topic.sourceStructure || "无")}</em>
            <em>商品：${escapeHtml(topic.sourceProduct || "无")}</em>
            <em>模板：${escapeHtml(topic.sourceTemplate || "无")}</em>
          </div>
          <div class="v2-topic-reasons">
            ${(topic.reasons || []).map((reason) => `<span>${escapeHtml(reason)}</span>`).join("")}
            ${topic.adopted ? "<span>已采用为本轮输入</span>" : ""}
          </div>
        </div>
        <div class="v2-topic-actions">
          <button type="button" data-adopt-topic="${escapeHtml(topic.id || "")}" ${topic.adopted ? "disabled" : ""}>${topic.adopted ? "已采用" : "采用选题"}</button>
          <a href="${escapeHtml(topic.href || "./index.html")}">${escapeHtml(topic.adopted ? "去生成脚本" : (topic.nextAction || "去处理"))}</a>
        </div>
      </article>
    `).join("")
    : `
      <article class="v2-topic-card muted">
        <div>
          <span>暂无推荐</span>
          <strong>先补热点、结构摘要或商品活动</strong>
          <p>推荐选题依赖真实输入，不会用纯模拟数据填充。</p>
        </div>
        <a href="./content-pool.html?v=topic-recommendations-v1">去补素材</a>
      </article>
    `;
}

async function adoptTopicRecommendation(button) {
  const topicId = button.dataset.adoptTopic;
  const topic = (v2Dashboard?.topicRecommendations || []).find((item) => item.id === topicId);
  if (!topic) return;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "采用中...";
  try {
    const response = await fetch(`${V2_API_BASE}/api/v2/topic-recommendations/adopt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandName: v2Brand.name || v2Dashboard?.brand?.name, topic }),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    if (v2GenerateStatus) {
      v2GenerateStatus.textContent = `已采用选题：${topic.title}。本轮输入包已确认，可生成脚本。`;
      v2GenerateStatus.className = "ok";
    }
    await loadV2Dashboard();
  } catch (error) {
    if (v2GenerateStatus) {
      v2GenerateStatus.textContent = `采用选题失败：${error.message}`;
      v2GenerateStatus.className = "warning";
    }
    button.disabled = false;
    button.textContent = originalText;
  }
}

function renderTasks() {
  if (!taskList) return;
  const tasks = v2Dashboard?.tasks || [
    { priority: "high", title: "把单页 MVP 拆成 6 个模块，先解决入口混乱。", description: "等待 V2 API 返回真实待办。", actionLabel: "等待接口", href: "#" },
    { priority: "high", title: "把人工导入做成正式入口，应对平台采集不稳定。", description: "等待 V2 API 返回真实待办。", actionLabel: "等待接口", href: "#" },
  ];
  taskList.innerHTML = tasks.map((task) => `
    <article class="v2-task-row ${task.status || ""}">
      <div>
        <span>${priorityText(task.priority)}</span>
        ${typeof task.count === "number" && task.count > 0 ? `<em>${task.count}</em>` : ""}
      </div>
      <strong>${escapeHtml(task.title)}</strong>
      <p>${escapeHtml(task.description || "")}</p>
      ${task.href ? `<a href="${escapeHtml(task.href)}">${escapeHtml(task.actionLabel || "去处理")}</a>` : ""}
    </article>
  `).join("");
}

function renderOutputs() {
  if (!outputList) return;
  const reviewQueue = v2Dashboard?.reviewQueue || [];
  const outputs = v2Dashboard ? (reviewQueue.length ? reviewQueue : (v2Dashboard.latestScripts || [])).slice(0, 8) : v2Scripts.slice(0, 5);
  const pendingCount = v2Dashboard?.stats?.newScripts || reviewQueue.length || 0;
  const header = v2Dashboard
    ? `
      <article class="v2-output-explain ${pendingCount ? "action_required" : "ready"}">
        <strong>${pendingCount ? `待审核脚本 ${pendingCount} 条` : "今日暂无待审核脚本"}</strong>
        <p>${pendingCount ? "这里就是上方“今日生产闭环”的审核采用步骤：运营在这里把候选脚本标记为采用、待改或弃用。" : "新生成脚本审核完后，下一步是回填发布链接和表现数据。"}</p>
        <a href="${pendingCount ? "./script-library.html?v=review-queue-v1&status=new" : "./script-library.html?v=review-queue-v1"}">${pendingCount ? "打开完整待审核列表" : "去脚本库复盘"}</a>
      </article>
    `
    : "";
  outputList.innerHTML = outputs.length
    ? `${header}${outputs.map((item) => `
      <article class="v2-output-row ${escapeHtml(item.reviewStatus || item.review_status || "new")}">
        <div class="v2-output-head">
          <div>
            <strong>${escapeHtml(item.title || "未命名脚本")}</strong>
            <p>${escapeHtml(item.hot || item.sourceTrendKeyword || "品牌日常选题")} · ${escapeHtml(item.pattern || item.sourcePattern || "门店种草")}</p>
          </div>
          <span>${reviewStatusText(item.reviewStatus || item.review_status || "new")}</span>
        </div>
        ${item.hook ? `<p class="v2-output-hook">${escapeHtml(item.hook)}</p>` : ""}
        ${reviewNoteHtml(item)}
        ${item.id ? `
          <div class="v2-generated-actions v2-output-actions" data-v2-review-row="${item.id}">
            <label class="review-note-input">
              <span>审核原因</span>
              <textarea data-review-note="${item.id}" rows="2" placeholder="写清楚为什么采用、待改或弃用">${escapeHtml(item.reviewNote || item.review_note || "")}</textarea>
            </label>
            <div class="review-note-suggestions">
              ${reviewSuggestionButtons(item.id)}
            </div>
            <button type="button" data-v2-review="adopted" data-script-id="${item.id}">采用</button>
            <button type="button" data-v2-review="needs_edit" data-script-id="${item.id}">待改</button>
            <button type="button" data-v2-review="rejected" data-script-id="${item.id}">弃用</button>
            <small>${escapeHtml(reviewStatusText(item.reviewStatus || item.review_status || "new"))}</small>
          </div>
        ` : `<small>缺少脚本 ID，请进入脚本库处理。</small>`}
      </article>
    `).join("")}`
    : `<article class="v2-output-row"><strong>今天还没有生成脚本</strong><p>这里不再展示历史脚本。需要看旧脚本、采用状态和表现数据，请进入脚本库复盘。</p><a href="./script-library.html?v=workday-scope-v1">查看历史脚本库</a></article>`;
}

function renderReadiness() {
  if (!readinessCard) return;
  const readiness = v2Dashboard?.generationReadiness;
  const r2Verifier = v2Dashboard?.r2InputVerifier;
  const r2Plan = v2Dashboard?.r2DailyExecutionPlan;
  const workflow = v2Dashboard?.currentWorkflow || {};
  const adoptedTopic = (workflow.adoptedTopics || [])[0];
  if (!readiness) {
    readinessCard.innerHTML = `
      <div class="v2-readiness-main blocked">
        <span>WAITING</span>
        <strong>还不能判断生成准备度</strong>
        <p>需要先连接本地 API，读取已确认素材、结构摘要和商品活动。</p>
      </div>
    `;
    return;
  }
  const checks = readiness.checks || [];
  readinessCard.innerHTML = `
    <div class="v2-readiness-main ${readiness.level || "partial"}">
      <span>${readiness.ready ? "READY" : "NEEDS INPUT"}</span>
      <strong>${escapeHtml(readiness.summary || "等待输入")}</strong>
      <p>${adoptedTopic ? `已采用选题：${escapeHtml(adoptedTopic.title)}` : `下一步：${escapeHtml(readiness.nextAction || "补齐输入")}`}</p>
      <a class="v2-readiness-action" href="${escapeHtml(readiness.generateUrl || "./index.html")}">
        ${readiness.ready ? "去生成候选脚本" : "去脚本流程确认素材"}
      </a>
      ${adoptedTopic ? `<small class="v2-adopted-topic-line">来源：${escapeHtml(adoptedTopic.sourceHot || "无热点")} / ${escapeHtml(adoptedTopic.sourceStructure || "无结构")} / ${escapeHtml(adoptedTopic.sourceProduct || "无商品")}</small>` : ""}
    </div>
    <div class="v2-readiness-checks">
      ${checks.map((item) => `
        <article class="${item.ready ? "ready" : item.optional ? "optional" : "missing"}">
          <span>${item.ready ? "已就绪" : item.optional ? "可选" : "缺少"}</span>
          <strong>${escapeHtml(item.label)}</strong>
          <p>${escapeHtml(item.value || "")}</p>
          <small>${escapeHtml(item.action || "")}</small>
        </article>
      `).join("")}
    </div>
    ${renderR2InputVerifierMini(r2Verifier)}
    ${renderR2DailyExecutionPlan(r2Plan)}
  `;
}

function renderR2DailyExecutionPlan(plan) {
  if (!plan?.version) return "";
  const actions = Array.isArray(plan.actions) ? plan.actions : [];
  const slots = Array.isArray(plan.slots) ? plan.slots : [];
  return `
    <div class="v2-r2-daily-plan ${escapeHtml(plan.level || "blocked")}">
      <div class="v2-r2-daily-plan-head">
        <div>
          <span>R2 DAILY PLAN</span>
          <strong>${escapeHtml(plan.title || "R2 今日执行计划")}</strong>
          <p>${escapeHtml(plan.summary || "先补真实输入，再进入脚本生成。")}</p>
        </div>
        <a href="${escapeHtml(plan.nextHref || "./content-pool.html#manual-import")}">${escapeHtml(plan.nextAction || "去补素材")}</a>
      </div>
      <div class="v2-r2-daily-plan-meter">
        <span><b>已完成</b>${Number(plan.actual || 0)}/${Number(plan.target || 3)}</span>
        <span><b>还缺</b>${Number(plan.missing || 0)} 条</span>
        <span><b>空槽</b>${slots.filter((slot) => slot.status === "empty").length} 个</span>
      </div>
      <div class="v2-r2-daily-actions">
        ${actions.map((item) => `
          <a class="${escapeHtml(item.status || "blocked")}" href="${escapeHtml(item.href || "#")}">
            <span>${Number(item.step || 0)}</span>
            <strong>${escapeHtml(item.label || "执行步骤")}</strong>
            <p>${escapeHtml(item.detail || "")}</p>
          </a>
        `).join("")}
      </div>
      <div class="v2-r2-daily-slots">
        ${slots.map((slot) => `
          <a class="${escapeHtml(slot.status || "empty")}" href="${escapeHtml(slot.href || "#")}">
            <span>${escapeHtml(slot.statusLabel || "待补")}</span>
            <strong>${slot.slot}. ${escapeHtml(slot.title || "补真实素材")}</strong>
            <p>${escapeHtml(slot.hint || "补齐真实链接、字幕和结构摘要。")}</p>
          </a>
        `).join("")}
      </div>
      <small>${escapeHtml(plan.rule || "空槽不代表已有素材。")}</small>
    </div>
  `;
}

function renderR2InputVerifierMini(verifier) {
  if (!verifier?.version) return "";
  const checks = Array.isArray(verifier.checks) ? verifier.checks : [];
  const counts = verifier.counts || {};
  return `
    <div class="v2-r2-verifier ${escapeHtml(verifier.level || "blocked")}">
      <div>
        <span>R2 INPUT THICKNESS</span>
        <strong>${escapeHtml(verifier.levelLabel || "输入厚度待判断")}</strong>
        <p>${escapeHtml(verifier.summary || "判断今天生成脚本前的真实输入是否足够厚。")}</p>
      </div>
      <aside>
        <b>必填 ${Number(counts.requiredPassed || 0)}/${Number(counts.requiredTotal || 0)}</b>
        <a href="${escapeHtml(verifier.nextHref || "./index.html#stepGenerate")}">${escapeHtml(verifier.nextAction || "补输入")}</a>
      </aside>
      <div class="v2-r2-verifier-checks">
        ${checks.map((check) => `
          <a class="${escapeHtml(check.status || "blocked")}" href="${escapeHtml(check.href || "#")}">
            <span>${escapeHtml(check.statusLabel || "待判断")}</span>
            <strong>${escapeHtml(check.label || "输入项")}</strong>
            <p>${Number(check.actual || 0)}/${Number(check.target || 0)}</p>
          </a>
        `).join("")}
      </div>
    </div>
  `;
}

function renderReviewInsights() {
  if (!reviewInsights) return;
  const insights = v2Dashboard?.reviewInsights;
  if (!insights) {
    reviewInsights.innerHTML = "";
    return;
  }
  const totals = insights.totals || {};
  const bestScripts = insights.bestScripts || [];
  const templates = insights.templates || [];
  const nextActions = insights.nextActions || [];
  const learningSignals = insights.learningSignals || {};
  const noteLearning = learningSignals.noteLearning || {};
  const noteCategories = noteLearning.categories || [];
  reviewInsights.innerHTML = `
    <div class="v2-insight-head">
      <div>
        <span class="caption">REVIEW LEARNING</span>
        <h3>复盘洞察</h3>
        <p>发布表现会反哺下一轮生成：优先复用高表现脚本的开头、结构和 CTA。</p>
      </div>
      <div class="v2-insight-stats">
        <span>已发布 ${insights.publishedCount || 0}</span>
        <span>模板 ${insights.templateCount || 0}</span>
        <span>线索 ${totals.leads || 0}</span>
        <span>原因覆盖 ${noteLearning.coverage || 0}%</span>
      </div>
    </div>
    <div class="v2-insight-grid">
      <article>
        <strong>表现最好</strong>
        ${bestScripts.length ? bestScripts.map((item) => `
          <p>${escapeHtml(item.title)} <em>播放 ${item.performance?.views || 0} / 线索 ${item.performance?.leads || 0}</em></p>
        `).join("") : "<p>还没有发布表现。</p>"}
      </article>
      <article>
        <strong>可复用模板</strong>
        ${templates.length ? templates.map((item) => `<p>${escapeHtml(item.title)} <em>${escapeHtml(item.sourcePattern || "结构待补")}</em></p>`).join("") : "<p>还没有模板。</p>"}
      </article>
      <article>
        <strong>下一轮建议</strong>
        ${nextActions.map((action) => `<p>${escapeHtml(action)}</p>`).join("")}
      </article>
      <article>
        <strong>审核原因学习</strong>
        <p>${escapeHtml(noteLearning.summary || "审核原因越完整，下一轮生成越能复用和避坑。")}</p>
        ${noteCategories.length ? noteCategories.slice(0, 3).map((item) => `<p>${escapeHtml(item.label)} <em>${Number(item.total || 0)} 条</em></p>`).join("") : "<p>先给已审核脚本补原因。</p>"}
      </article>
    </div>
  `;
}

function renderV2GenerateButton(pending = false) {
  if (!v2GenerateScriptsBtn) return;
  const target = currentV2ScriptTarget();
  const ready = Boolean(v2Dashboard?.generationReadiness?.ready);
  v2GenerateScriptsBtn.textContent = pending ? `正在生成 ${target} 条...` : `生成 ${target} 条候选脚本`;
  v2GenerateScriptsBtn.disabled = pending || !ready;
  if (v2GenerateStatus && !pending && !ready && v2GenerateStatus.className !== "ok") {
    v2GenerateStatus.textContent = v2Dashboard?.generationReadiness?.nextAction || "请先补齐生成输入。";
    v2GenerateStatus.className = "warning";
  }
}

function currentV2ScriptTarget() {
  const value = Number(v2ScriptTarget?.value || 2);
  if (!Number.isFinite(value)) return 2;
  return Math.max(1, Math.min(Math.round(value), 5));
}

async function generateV2Scripts() {
  if (!v2GenerateScriptsBtn || !v2GenerateStatus || !v2GeneratedList) return;
  const readiness = v2Dashboard?.generationReadiness;
  if (!readiness?.ready) {
    v2GenerateStatus.textContent = readiness?.nextAction || "请先补齐生成输入。";
    v2GenerateStatus.className = "warning";
    return;
  }
  const target = currentV2ScriptTarget();
  if (v2ScriptTarget) v2ScriptTarget.value = String(target);
  renderV2GenerateButton(true);
  v2GenerateStatus.className = "";
  v2GenerateStatus.textContent = "正在调用 Codex CLI 生成脚本，通常需要 30-120 秒...";
  v2GeneratedList.innerHTML = "";
  try {
    const response = await fetch(`${V2_API_BASE}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandName: v2Brand.name || v2Dashboard?.brand?.name, target }),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    const result = data.result || {};
    const scripts = result.scripts || [];
    const generator = result.generator || {};
    v2GenerateStatus.textContent = generator.usedFallback
      ? `生成完成：${scripts.length} 条。本次 Codex 失败，已使用本地兜底：${generator.error || "未返回原因"}`
      : `生成完成：${scripts.length} 条，已写入脚本库。`;
    v2GenerateStatus.className = generator.usedFallback ? "warning" : "ok";
    renderV2GeneratedScripts(scripts);
    await loadV2Dashboard();
  } catch (error) {
    v2GenerateStatus.textContent = `生成失败：${error.message}`;
    v2GenerateStatus.className = "warning";
  } finally {
    renderV2GenerateButton(false);
  }
}

function renderV2GeneratedScripts(scripts) {
  if (!v2GeneratedList) return;
  v2GeneratedList.innerHTML = scripts.length
    ? scripts.map((script, index) => {
      const quality = script.quality || {};
      const scores = quality.scores || {};
      const inputStructures = script.input_structures || script.inputStructures || [];
      const inputProducts = script.input_products || script.inputProducts || [];
      const inputTemplates = script.input_templates || script.inputTemplates || [];
      const reviewStatus = script.reviewStatus || script.review_status || "new";
      const scriptId = script.id;
      const scoreItems = [
        ["可拍", scores.shootable],
        ["开头", scores.hook],
        ["品牌", scores.brandFit],
        ["转化", scores.conversion],
        ["合规", scores.compliance],
      ].filter(([, value]) => typeof value === "number");
      return `
        <article class="v2-generated-card">
          <div class="v2-generated-card-head">
            <div>
              <strong>${index + 1}. ${escapeHtml(script.title || "未命名脚本")}</strong>
              <p>${escapeHtml(script.hook || "未返回开头")}</p>
            </div>
            ${quality.overall ? `<span>质量分 ${quality.overall}</span>` : `<span>待评分</span>`}
          </div>
          <div class="v2-generated-evidence">
            <span>审核 ${reviewStatusText(reviewStatus)}</span>
            <span>结构 ${inputStructures.length} 条</span>
            <span>商品 ${inputProducts.length} 条</span>
            <span>模板 ${inputTemplates.length} 条</span>
          </div>
          ${scriptId ? `
            <div class="v2-generated-actions" data-v2-review-row="${scriptId}">
              <label class="review-note-input">
                <span>审核原因</span>
                <textarea data-review-note="${scriptId}" rows="2" placeholder="写清楚为什么采用、待改或弃用">${escapeHtml(script.reviewNote || script.review_note || "")}</textarea>
              </label>
              <div class="review-note-suggestions">
                ${reviewSuggestionButtons(scriptId)}
              </div>
              <button type="button" data-v2-review="adopted" data-script-id="${scriptId}">采用</button>
              <button type="button" data-v2-review="needs_edit" data-script-id="${scriptId}">待改</button>
              <button type="button" data-v2-review="rejected" data-script-id="${scriptId}">弃用</button>
              <small>${escapeHtml(reviewStatusText(reviewStatus))}</small>
            </div>
            <div class="v2-publish-mini" data-v2-publish-row="${scriptId}">
              <label>
                <span>发布链接</span>
                <input type="url" placeholder="https://v.douyin.com/..." data-v2-publish-url="${scriptId}" />
              </label>
              <label>
                <span>播放</span>
                <input type="number" min="0" placeholder="0" data-v2-publish-views="${scriptId}" />
              </label>
              <label>
                <span>点赞</span>
                <input type="number" min="0" placeholder="0" data-v2-publish-likes="${scriptId}" />
              </label>
              <label>
                <span>线索</span>
                <input type="number" min="0" placeholder="0" data-v2-publish-leads="${scriptId}" />
              </label>
              <label class="v2-template-mini">
                <input type="checkbox" data-v2-publish-template="${scriptId}" />
                <span>沉淀为模板</span>
              </label>
              <button type="button" data-v2-publish data-script-id="${scriptId}">保存发布表现</button>
              <small>发布后会自动标记为已采用。</small>
            </div>
          ` : `<div class="v2-generated-actions"><small>缺少脚本 ID，请到脚本库复核。</small></div>`}
          ${scoreItems.length ? `<div class="quality-scores">${scoreItems.map(([label, value]) => `<em>${label} ${value}</em>`).join("")}</div>` : ""}
          <details class="script-detail">
            <summary>查看可拍分镜脚本</summary>
            ${v2ShootingScriptHtml(script)}
          </details>
        </article>
      `;
    }).join("")
    : `<article class="v2-generated-card"><strong>还没有生成结果</strong><p>生成成功后会显示在这里，并同步进入脚本库。</p></article>`;
}

async function reviewV2GeneratedScript(button) {
  const scriptId = button.dataset.scriptId;
  const reviewStatus = button.dataset.v2Review;
  if (!scriptId || !reviewStatus) return;
  const statusTarget = v2GenerateStatus || document.getElementById("v2WorkdayMessage");
  const reviewNote = reviewNoteForScript(scriptId, reviewStatus);
  button.disabled = true;
  if (statusTarget) {
    statusTarget.className = "";
    statusTarget.textContent = `正在标记脚本为：${reviewStatusText(reviewStatus)}...`;
  }
  try {
    const response = await fetch(`${V2_API_BASE}/api/v2/script-candidates/${scriptId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewStatus, reviewNote }),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    const row = document.querySelector(`[data-v2-review-row="${scriptId}"]`);
    if (row) {
      row.querySelectorAll("button").forEach((item) => {
        item.disabled = false;
        item.classList.toggle("active", item.dataset.v2Review === reviewStatus);
      });
      const label = row.querySelector("small");
      if (label) label.textContent = reviewStatusText(data.item?.reviewStatus || reviewStatus);
      const noteInput = row.querySelector(`[data-review-note="${scriptId}"]`);
      if (noteInput && data.item?.reviewNote) noteInput.value = data.item.reviewNote;
      const notePreview = row.parentElement?.querySelector("[data-review-note-preview]");
      if (notePreview) notePreview.textContent = data.item?.reviewNote || reviewNote;
    }
    if (statusTarget) {
      statusTarget.textContent = `已标记：${reviewStatusText(data.item?.reviewStatus || reviewStatus)}，脚本库已同步。`;
      statusTarget.className = "ok";
    }
    await loadV2Dashboard();
  } catch (error) {
    if (statusTarget) {
      statusTarget.textContent = `审核失败：${error.message}`;
      statusTarget.className = "warning";
    }
    button.disabled = false;
  }
}

function reviewNoteForScript(scriptId, reviewStatus) {
  const input = document.querySelector(`[data-review-note="${scriptId}"]`);
  return (input?.value || "").trim() || defaultReviewNote(reviewStatus);
}

function reviewNoteHtml(item) {
  const note = item.reviewNote || item.review_note || "";
  if (!note) return "";
  return `<p class="review-note-preview">审核原因：<span data-review-note-preview="${item.id || ""}">${escapeHtml(note)}</span></p>`;
}

function reviewSuggestionButtons(scriptId) {
  const suggestions = [
    ["可拍执行清楚", "运营采用：分镜可执行，口播和字幕能直接进入拍摄。"],
    ["开头弱待改", "运营待改：前 3 秒吸引力不足，需要重写开头和冲突点。"],
    ["转化弱待改", "运营待改：商品权益和 CTA 不够具体，需要补进店/团购动作。"],
    ["品牌不贴合", "运营弃用：热点或表达不贴合当前品牌和门店活动。"],
  ];
  return suggestions.map(([label, value]) => `
    <button type="button" data-review-suggestion="${escapeHtml(value)}" data-review-suggestion-target="${scriptId}">${escapeHtml(label)}</button>
  `).join("");
}

function applyReviewSuggestion(button) {
  const targetId = button.dataset.reviewSuggestionTarget;
  const input = targetId ? document.querySelector(`[data-review-note="${targetId}"]`) : null;
  if (input) input.value = button.dataset.reviewSuggestion || "";
}

function defaultReviewNote(reviewStatus) {
  return {
    adopted: "运营采用：结构清晰，可进入发布或模板复盘。",
    needs_edit: "运营待改：需要优化开头、镜头执行或转化 CTA。",
    rejected: "运营弃用：不适合当前品牌/活动，后续降低相似结构权重。",
    new: "",
  }[reviewStatus] || "";
}

async function publishV2GeneratedScript(button) {
  const scriptId = button.dataset.scriptId;
  if (!scriptId || !v2GenerateStatus) return;
  const publishUrl = v2GeneratedList?.querySelector(`[data-v2-publish-url="${scriptId}"]`)?.value.trim() || "";
  const views = Number(v2GeneratedList?.querySelector(`[data-v2-publish-views="${scriptId}"]`)?.value || 0);
  const likes = Number(v2GeneratedList?.querySelector(`[data-v2-publish-likes="${scriptId}"]`)?.value || 0);
  const leads = Number(v2GeneratedList?.querySelector(`[data-v2-publish-leads="${scriptId}"]`)?.value || 0);
  const isTemplate = Boolean(v2GeneratedList?.querySelector(`[data-v2-publish-template="${scriptId}"]`)?.checked);
  if (!publishUrl && !views && !likes && !leads && !isTemplate) {
    v2GenerateStatus.textContent = "请至少填写发布链接、表现数据或勾选模板。";
    v2GenerateStatus.className = "warning";
    return;
  }
  button.disabled = true;
  v2GenerateStatus.className = "";
  v2GenerateStatus.textContent = "正在保存发布表现...";
  try {
    const response = await fetch(`${V2_API_BASE}/api/v2/script-candidates/${scriptId}/publish-result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publishUrl,
        isTemplate: isTemplate || views >= 1000 || likes >= 50 || leads > 0,
        performance: { views, likes, comments: 0, shares: 0, leads },
      }),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    const row = v2GeneratedList?.querySelector(`[data-v2-publish-row="${scriptId}"]`);
    if (row) {
      row.classList.add("saved");
      const label = row.querySelector("small");
      if (label) label.textContent = `已保存：播放 ${data.item?.performance?.views || views} / 点赞 ${data.item?.performance?.likes || likes} / 线索 ${data.item?.performance?.leads || leads}`;
    }
    const reviewRow = v2GeneratedList?.querySelector(`[data-v2-review-row="${scriptId}"]`);
    if (reviewRow) {
      const label = reviewRow.querySelector("small");
      if (label) label.textContent = reviewStatusText(data.item?.reviewStatus || "adopted");
      reviewRow.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item.dataset.v2Review === "adopted"));
    }
    v2GenerateStatus.textContent = "发布表现已保存，脚本库已同步。";
    v2GenerateStatus.className = "ok";
    await loadV2Dashboard();
  } catch (error) {
    v2GenerateStatus.textContent = `发布表现保存失败：${error.message}`;
    v2GenerateStatus.className = "warning";
    button.disabled = false;
  }
}

function renderBoundaries() {
  if (!boundaryGrid) return;
  const workflow = v2Dashboard?.currentWorkflow;
  const items = [
    {
      title: "今日工作流",
      status: "刷新后默认清空",
      evidence: `当前输入：${workflow ? `${workflow.hotCount} 热点 + ${workflow.benchmarkCount} 对标 + ${workflow.manualSourceCount || 0} 人工素材` : v2Data.confirmation ? `${v2Data.confirmation.hotCount} 热点 + ${v2Data.confirmation.benchmarkCount} 对标` : "无"}`,
      rule: "只展示运营当天正在选择、确认、生成的内容。",
      actions: ["选择素材", "确认输入", "生成本次脚本"],
    },
    {
      title: "历史资产",
      status: "进入脚本库",
      evidence: `已入库脚本：${v2Dashboard?.stats?.scripts ?? v2Scripts.length} 条`,
      rule: "历史脚本、历史字幕和结构摘要不能自动污染今日工作台。",
      actions: ["查看脚本库", "标记采用", "引用为模板"],
    },
    {
      title: "数据源状态",
      status: "首页可见",
      evidence: `热榜最近采集：${sourceLastAt("抖音总热榜") || (v2Meta.hotRunFetchedAt ? formatDate(v2Meta.hotRunFetchedAt) : "暂无")}`,
      rule: "采集失败、登录态失效、旧数据都要明确标记。",
      actions: ["查看采集状态", "手动重跑", "切换人工导入"],
    },
    {
      title: "生成任务",
      status: "生命周期管理",
      evidence: `${v2Dashboard?.stats?.structureSummaries ?? v2Processing.length} 条结构分析记录`,
      rule: "待确认、生成中、失败、低质量、已入库要分开显示。",
      actions: ["结构分析", "质量评分", "低分改写"],
    },
  ];
  boundaryGrid.innerHTML = items.map((item) => `
    <article class="v2-boundary-card">
      <div>
        <strong>${item.title}</strong>
        <span>${item.status}</span>
      </div>
      <p>${item.rule}</p>
      <small>${item.evidence}</small>
      <div>${item.actions.map((action) => `<em>${action}</em>`).join("")}</div>
    </article>
  `).join("");
}

function renderFeatures() {
  if (!featureGrid) return;
  featureGrid.innerHTML = features.map(([title, desc, tags]) => `
    <article class="v2-feature-card">
      <strong>${title}</strong>
      <p>${desc}</p>
      <div>${tags.map((tag) => `<span>${tag}</span>`).join("")}</div>
    </article>
  `).join("");
}

function renderSources() {
  if (!sourceGrid) return;
  const matrix = v2Dashboard?.dataSourceMatrix;
    const matrixSources = Array.isArray(matrix?.sources) ? matrix.sources : [];
  if (matrixSources.length) {
    const hub = v2Dashboard?.collectionGuaranteeHub;
    const switcher = v2Dashboard?.collectionFallbackSwitcher;
    const switcherPaths = Array.isArray(switcher?.paths) ? switcher.paths : [];
    const hubLanes = Array.isArray(hub?.laneCards) ? hub.laneCards.slice(0, 5) : [];
    const hubRules = Array.isArray(hub?.switchRules) ? hub.switchRules : [];
    const firstRule = hubRules[0] || {};
    const actionFlow = v2Dashboard?.collectionActionFlow;
    const actionSteps = Array.isArray(actionFlow?.steps) ? actionFlow.steps.slice(0, 3) : [];
    sourceGrid.innerHTML = `
      ${hub?.version ? `
        <article class="v2-source-hub ${escapeHtml(hub.mode || "needs_input")}">
          <div class="v2-source-hub-main">
            <span>${escapeHtml(hub.modeLabel || "采集保障")}</span>
            <strong>${escapeHtml(hub.summary || "等待采集保障判断")}</strong>
            <p>${escapeHtml(hub.activeStep?.reason || hub.activeFallback?.evidence || "根据真实数据源状态选择下一步。")}</p>
            <small>切换规则 ${hubRules.length} 条；当前责任：${escapeHtml(firstRule.owner || "运营")} / ${escapeHtml(firstRule.sla || "当天处理")}</small>
            <a href="${escapeHtml(hub.nextHref || "./collection-center.html?v=homepage-guarantee-hub-v1")}">${escapeHtml(hub.nextAction || "打开采集任务中心")}</a>
          </div>
          <div class="v2-source-hub-side">
            <div class="v2-source-hub-counts">
              <article><span>就绪</span><strong>${hub.counts?.readySources || 0}</strong></article>
              <article><span>兜底</span><strong>${hub.counts?.fallbackSources || 0}</strong></article>
              <article><span>待处理</span><strong>${hub.counts?.waitingSources || 0}</strong></article>
            </div>
            <div class="v2-source-hub-lanes">
              ${hubLanes.map((lane) => `
                <a class="${escapeHtml(lane.status || "waiting")}" href="${escapeHtml(lane.href || "./collection-center.html?v=homepage-guarantee-hub-v1")}">
                  <em>${escapeHtml(lane.layer || "-")}</em>
                  <strong>${escapeHtml(lane.title || "未命名链路")}</strong>
                  <span>${escapeHtml(lane.statusLabel || dataSourceStatusText(lane.status))}</span>
                </a>
              `).join("")}
            </div>
          </div>
        </article>
      ` : ""}
      ${switcher?.version && switcherPaths.length ? `
        <article class="v2-source-switcher ${escapeHtml(switcher.level || "waiting")}">
          <div class="v2-source-switcher-head">
            <div>
              <span>${escapeHtml(fallbackSwitcherLevelText(switcher.level))}</span>
              <strong>${escapeHtml(switcher.summary || "选择一条替代路径补齐真实素材。")}</strong>
              <p>自动采集不稳定时，首页直接给运营四条路径：人工链接/正文、旧字幕项目、第三方表格、固定对标号补录。选完后仍要入库、结构化，再进入脚本生成。</p>
            </div>
            <a href="${escapeHtml(switcher.primaryHref || "./collection-center.html?v=homepage-fallback-switcher-v1#fallback-switcher")}">${escapeHtml(switcher.primaryAction || "执行推荐路径")}</a>
          </div>
          <div class="v2-source-switcher-paths">
            ${switcherPaths.map((path) => `
              <a class="${escapeHtml(path.status || "available")}" href="${escapeHtml(path.href || "#")}">
                <div>
                  <span>${escapeHtml(path.label || "兜底路径")}</span>
                  <em>${escapeHtml(path.status === "recommended" ? "推荐" : "可选")}</em>
                </div>
                <strong>${escapeHtml(path.title || "补齐真实素材")}</strong>
                <p>${escapeHtml(path.when || "自动采集不可用时。")}</p>
                <small><b>输入：</b>${escapeHtml(path.input || "标题、链接或正文。")}</small>
                <small><b>后续：</b>${escapeHtml(path.output || "入库后结构化。")}</small>
              </a>
            `).join("")}
          </div>
          ${(switcher.rules || []).length ? `
            <div class="v2-source-switcher-rules">
              ${(switcher.rules || []).map((rule) => `<span>${escapeHtml(rule)}</span>`).join("")}
            </div>
          ` : ""}
        </article>
      ` : ""}
      ${actionSteps.length ? `
        <article class="v2-source-action-flow">
          <div>
            <span>今日采集任务流</span>
            <strong>${escapeHtml(actionFlow.nextAction || "按顺序处理数据源")}</strong>
            <p>${escapeHtml(actionFlow.summary || "公开热榜打底，失败立即切人工/第三方兜底。")}</p>
          </div>
          <div class="v2-source-action-steps">
            ${actionSteps.map((step, index) => `
              <a class="${escapeHtml(step.status || "waiting")}" href="${escapeHtml(step.href || "./collection-center.html")}">
                <em>${String(index + 1).padStart(2, "0")}</em>
                <strong>${escapeHtml(step.title || "处理数据源")}</strong>
                <span>${escapeHtml(step.statusLabel || dataSourceStatusText(step.status))}</span>
              </a>
            `).join("")}
          </div>
        </article>
      ` : ""}
      <article class="v2-source-summary ${escapeHtml(matrix.level || "needs_input")}">
        <div>
          <span>${dataSourceLevelText(matrix.level)}</span>
          <strong>${escapeHtml(matrix.summary || "待判断数据源状态")}</strong>
        </div>
        <p>可用来源 ${matrix.usableCount || 0} 个 / 完全就绪 ${matrix.readyCount || 0} 个 / 待处理 ${matrix.blockedCount || 0} 个。</p>
        <a href="./collection-center.html?v=homepage-source-matrix-v1">打开采集任务中心</a>
      </article>
      ${matrixSources.map((source) => `
        <article class="v2-source-card ${escapeHtml(source.status || "waiting")}">
          <div>
            <strong>${escapeHtml(source.layer || "-")} 层 · ${escapeHtml(source.title || "未命名来源")}</strong>
            <span>${escapeHtml(source.statusLabel || dataSourceStatusText(source.status))}</span>
          </div>
          <p>${escapeHtml(source.evidence || "暂无证据")}</p>
          <small>产出：${escapeHtml(source.output || "待明确")}</small>
          <small>风险：${escapeHtml(source.risk || "待复核")}</small>
          <a href="${escapeHtml(source.href || "./collection-center.html")}">${escapeHtml(source.nextAction || "去处理")}</a>
        </article>
      `).join("")}
    `;
    return;
  }
  sourceGrid.innerHTML = dataSources.map(([title, source, status, desc]) => `
    <article class="v2-source-card">
      <div>
        <strong>${title}</strong>
        <span>${status}</span>
      </div>
      <p>${source}</p>
      <small>${desc}</small>
    </article>
  `).join("");
}

function fallbackSwitcherLevelText(value) {
  return {
    fallback: "建议切兜底",
    waiting: "等待补数据",
    ready: "兜底就绪",
  }[value] || "替代方案";
}

function renderDailyReview() {
  if (!v2DailyReviewPanel) return;
  const review = v2Dashboard?.collectionDailyReview;
  const checkpoints = Array.isArray(review?.checkpoints) ? review.checkpoints : [];
  const priorities = Array.isArray(review?.nextDayPriorities) ? review.nextDayPriorities : [];
  if (!review?.version) {
    v2DailyReviewPanel.innerHTML = `<article class="daily-review-loading">等待 V2 API 生成日终采集复盘。</article>`;
    return;
  }
  v2DailyReviewPanel.innerHTML = `
    <article class="daily-review-card ${escapeHtml(review.level || "warning")}">
      <div class="daily-review-head">
        <div>
          <span>DAILY REVIEW</span>
          <strong>${escapeHtml(review.levelLabel || "日终复盘")}</strong>
          <p>${escapeHtml(review.summary || "根据今日真实采集和生产状态生成复盘。")}</p>
        </div>
        <a href="./collection-center.html?v=daily-review-v1#daily-review">打开采集复盘</a>
      </div>
      <div class="daily-review-counts">
        <span><b>${review.counts?.done || 0}</b>已闭环</span>
        <span><b>${review.counts?.open || 0}</b>未闭环</span>
        <span><b>${review.counts?.warning || 0}</b>需复核</span>
        <span><b>${review.counts?.blockers || 0}</b>高优先级</span>
      </div>
      <div class="daily-review-checkpoints">
        ${checkpoints.slice(0, 6).map((item) => `
          <a class="${escapeHtml(item.status || "open")}" href="${escapeHtml(item.href || "#")}">
            <em>${escapeHtml(item.statusLabel || dailyReviewStatusText(item.status))}</em>
            <strong>${escapeHtml(item.title || "复盘项")}</strong>
            <span>${escapeHtml(item.evidence || "")}</span>
          </a>
        `).join("")}
      </div>
      ${priorities.length ? `
        <div class="daily-review-priorities">
          <b>明日优先处理</b>
          ${priorities.slice(0, 3).map((item) => `<a href="${escapeHtml(item.href || "#")}">${escapeHtml(item.title || "处理缺口")}：${escapeHtml(item.action || "去处理")}</a>`).join("")}
        </div>
      ` : ""}
    </article>
  `;
}

function renderImports() {
  if (!importList) return;
  const items = v2Dashboard?.contentSources || [];
  importList.innerHTML = items.length
    ? items.map((item) => {
      const isExcluded = item.isOperationalReal === false;
      const workflowBadge = isExcluded ? "不计入生成" : (item.selected ? "已加入工作流" : "内容池素材");
      const workflowAction = isExcluded
        ? (item.selected
          ? `<button type="button" data-content-source-id="${item.id}" data-selected="false">移出历史选中标记</button>`
          : `<button type="button" disabled title="测试/示例素材不能加入真实生成工作流">不能加入真实生成</button>`)
        : `<button type="button" data-content-source-id="${item.id}" data-selected="${item.selected ? "false" : "true"}">${item.selected ? "移出生成工作流" : "加入生成工作流"}</button>`;
      return `
      <article class="v2-import-row ${isExcluded ? "not-operational-real" : ""}">
        <div class="v2-import-row-head">
          <strong>${escapeHtml(item.title)}</strong>
          <div class="v2-import-badges">
            <span class="${!isExcluded && item.selected ? "selected" : ""}">${workflowBadge}</span>
            <span class="v2-real-badge ${isExcluded ? "excluded" : "real"}">${escapeHtml(item.realMaterialStatusLabel || (isExcluded ? "不计入真实闭环" : "真实运营素材"))}</span>
          </div>
        </div>
        <p>${platformText(item.platform)} · ${escapeHtml(item.accountName || "未填账号")} · ${statusText(item.status)}</p>
        <small>${escapeHtml(item.rawText ? "已带字幕/文本" : item.url || "无链接")}</small>
        ${isExcluded ? `<div class="v2-real-notice"><strong>不作为真实跑通证据</strong><span>${escapeHtml(item.realMaterialReason || "命中非运营素材规则")}</span></div>` : ""}
        ${structureSummaryHtml(item.structure)}
        <div class="v2-import-actions">
          ${workflowAction}
          <button type="button" data-structure-source-id="${item.id}">
            ${item.structure ? "重新生成结构摘要" : "生成结构摘要"}
          </button>
        </div>
      </article>
    `;
    }).join("")
    : `<article class="v2-import-row"><strong>还没有人工导入素材</strong><p>可以先导入对标视频链接或手工字幕。</p></article>`;
  importList.querySelectorAll("[data-content-source-id]").forEach((button) => {
    button.addEventListener("click", () => toggleContentSourceSelection(button));
  });
  importList.querySelectorAll("[data-structure-source-id]").forEach((button) => {
    button.addEventListener("click", () => structureContentSource(button));
  });
}

function renderProducts() {
  if (!productList) return;
  const items = v2Dashboard?.brandProducts || [];
  productList.innerHTML = items.length
    ? items.map((item) => `
      <article class="v2-product-row">
        <div class="v2-import-row-head">
          <strong>${escapeHtml(item.productName)}</strong>
          <span class="${item.selected ? "selected" : ""}">${item.selected ? "已加入生成" : "商品库"}</span>
        </div>
        <p>${escapeHtml(item.productGroup || "未分组")} · ${escapeHtml(item.storeScope || "门店范围待补")}</p>
        <small>${escapeHtml(item.activityRules || "活动规则待补")}</small>
        <div class="v2-structure-preview">
          <strong>可说权益</strong>
          <div>${(item.sellingPoints || []).slice(0, 4).map((point) => `<span>${escapeHtml(point)}</span>`).join("")}</div>
          ${item.priceNote ? `<small>${escapeHtml(item.priceNote)}</small>` : ""}
        </div>
        <div class="v2-import-actions">
          <button type="button" data-brand-product-id="${item.id}" data-selected="${item.selected ? "false" : "true"}">
            ${item.selected ? "移出生成输入" : "加入生成输入"}
          </button>
        </div>
      </article>
    `).join("")
    : `<article class="v2-product-row"><strong>还没有商品活动</strong><p>先添加今天可以说的商品、权益和限制。</p></article>`;
  productList.querySelectorAll("[data-brand-product-id]").forEach((button) => {
    button.addEventListener("click", () => toggleBrandProductSelection(button));
  });
}

function structureSummaryHtml(structureRecord) {
  if (!structureRecord?.structure) {
    return `<div class="v2-structure-preview pending">还没有结构摘要。先生成摘要，再把这条素材用于高质量脚本生成。</div>`;
  }
  const structure = structureRecord.structure;
  const parts = Array.isArray(structure.usable_parts) ? structure.usable_parts.slice(0, 3) : [];
  const risks = Array.isArray(structure.risk_notes) ? structure.risk_notes.slice(0, 2) : [];
  return `
    <div class="v2-structure-preview">
      <strong>${escapeHtml(structure.script_pattern || structure.hook_angle || "已生成结构摘要")}</strong>
      <p>${escapeHtml(structure.status_note || structure.codex_note || "结构摘要已入库。")}</p>
      <div>${parts.map((part) => `<span>${escapeHtml(part)}</span>`).join("")}</div>
      ${risks.length ? `<small>风险：${risks.map(escapeHtml).join(" / ")}</small>` : ""}
    </div>
  `;
}

function renderQualityPipeline() {
  if (!qualityPipeline) return;
  qualityPipeline.innerHTML = qualitySteps.map(([title, desc], index) => `
    <article>
      <span>${index + 1}</span>
      <strong>${title}</strong>
      <p>${desc}</p>
    </article>
  `).join("");
}

function renderRoadmap() {
  const board = v2Dashboard?.developmentBoard || v2Data.developmentBoard;
  if (developmentBoard) {
    developmentBoard.innerHTML = board?.version
      ? developmentBoardHtml(board)
      : `
        <article class="v2-development-empty">
          <strong>等待真实开发看板</strong>
          <p>连接 V2 API 后，这里会用 R1-R4 真实验收状态和成熟度缺口生成下一大版本开发顺序。</p>
        </article>
      `;
  }
  if (!roadmap) return;
  if (board?.version) {
    roadmap.innerHTML = "";
    return;
  }
  roadmap.innerHTML = roadmapItems.map(([version, title, desc]) => `
    <article>
      <span>${version}</span>
      <strong>${title}</strong>
      <p>${desc}</p>
    </article>
  `).join("");
}

function developmentBoardHtml(board) {
  const releases = board.releaseCards || [];
  const focusItems = board.focusItems || [];
  const implementationPlan = board.implementationPlan || {};
  return `
    <section class="v2-development-hero">
      <div>
        <span class="caption">DEVELOPMENT BOARD</span>
        <h3>${escapeHtml(board.headline || "下一大版本开发看板")}</h3>
        <p>${escapeHtml(board.summary || "")}</p>
      </div>
      <aside>
        <span>${escapeHtml(board.currentStage?.id || "MVP")}</span>
        <strong>${escapeHtml(board.currentStage?.title || "当前阶段")}</strong>
        <p>${escapeHtml(board.currentStage?.evidence || "")}</p>
      </aside>
      <aside class="next">
        <span>${escapeHtml(board.nextRelease?.id || "NEXT")}</span>
        <strong>${escapeHtml(board.nextRelease?.title || "下一版本")}</strong>
        <p>当前进度 ${Number(board.nextRelease?.percent || 0)}%</p>
        <a href="${escapeHtml(board.nextRelease?.href || "#")}">${escapeHtml(board.nextRelease?.nextAction || "查看下一步")}</a>
      </aside>
    </section>
    ${board.rules?.length ? `
      <div class="v2-development-rules">
        ${board.rules.map((rule) => `<span>${escapeHtml(rule)}</span>`).join("")}
      </div>
    ` : ""}
    <div class="v2-development-releases">
      ${releases.map((release) => `
        <article class="${escapeHtml(release.status || "needs_work")}">
          <div class="v2-release-topline">
            <span>${escapeHtml(release.id || "")}</span>
            <em>${escapeHtml(release.statusLabel || releaseStatusText(release.status))}</em>
          </div>
          <strong>${escapeHtml(release.title || "")}</strong>
          <div class="v2-release-meter" aria-label="${escapeHtml(release.title || "")} 开发进度">
            <i style="width:${Math.max(0, Math.min(100, Number(release.percent || 0)))}%"></i>
          </div>
          <small>${release.readyCount || 0}/${release.totalCount || 0} 项已满足 · ${release.percent || 0}%</small>
          <p><b>${escapeHtml(release.blockingGap || "下一步")}</b>：${escapeHtml(release.evidence || "")}</p>
          <a href="${escapeHtml(release.nextHref || "#")}">${escapeHtml(release.nextAction || "查看下一步")}</a>
        </article>
      `).join("")}
    </div>
    <div class="v2-development-focus">
      ${focusItems.map((item) => `
        <article>
          <span>${escapeHtml(item.priority || "P1")}</span>
          <strong>${escapeHtml(item.area || "待处理缺口")}</strong>
          <p><b>当前：</b>${escapeHtml(item.current || "")}</p>
          <p><b>目标：</b>${escapeHtml(item.target || "")}</p>
          <a href="${escapeHtml(item.href || "#")}">${escapeHtml(item.nextAction || "去处理")}</a>
        </article>
      `).join("")}
    </div>
    ${implementationPlan.version ? implementationPlanHtml(implementationPlan) : ""}
  `;
}

function implementationPlanHtml(plan) {
  const current = plan.currentPackage || {};
  const packages = Array.isArray(plan.packages) ? plan.packages : [];
  const gates = Array.isArray(plan.gates) ? plan.gates : [];
  return `
    <section class="v2-implementation-plan">
      <div class="v2-implementation-head">
        <div>
          <span class="caption">IMPLEMENTATION PLAN</span>
          <h3>${escapeHtml(plan.headline || "大版本实施计划")}</h3>
          <p>${escapeHtml(plan.summary || "按当前真实数据生成下一版本任务包。")}</p>
          <small>${escapeHtml(plan.cadence || "按任务包推进。")}</small>
        </div>
        <aside class="${escapeHtml(current.status || "needs_work")}">
          <span>${escapeHtml(current.id || "NEXT")}</span>
          <strong>${escapeHtml(current.title || "当前优先任务包")}</strong>
          <p>${escapeHtml(current.evidence || "")}</p>
          <a href="${escapeHtml(current.href || "#")}">${escapeHtml(current.nextAction || "处理当前任务包")}</a>
        </aside>
      </div>
      <div class="v2-implementation-packages">
        ${packages.map((item) => `
          <article class="${escapeHtml(item.status || "needs_work")}">
            <div class="v2-implementation-package-head">
              <span>${escapeHtml(item.id || "")}</span>
              <em>${escapeHtml(item.statusLabel || releaseStatusText(item.status))}</em>
            </div>
            <strong>${escapeHtml(item.title || "未命名任务包")}</strong>
            <p>${escapeHtml(item.scope || "")}</p>
            <small><b>负责人：</b>${escapeHtml(item.owner || "待定")}</small>
            <small><b>验收：</b>${escapeHtml(item.acceptance || "")}</small>
            <div class="v2-implementation-subtasks">
              ${(item.tasks || []).map((task) => `
                <a class="${escapeHtml(task.status || "waiting")}" href="${escapeHtml(task.href || item.href || "#")}">
                  <em>${escapeHtml(task.statusLabel || singleMaterialStatusText(task.status))}</em>
                  <span>${escapeHtml(task.label || "待处理")}</span>
                </a>
              `).join("")}
            </div>
            <a href="${escapeHtml(item.href || "#")}">${escapeHtml(item.nextAction || "查看任务入口")}</a>
          </article>
        `).join("")}
      </div>
      ${gates.length ? `
        <div class="v2-implementation-gates">
          <b>大版本验收红线</b>
          ${gates.map((gate) => `<span>${escapeHtml(gate)}</span>`).join("")}
        </div>
      ` : ""}
    </section>
  `;
}

function renderTargetSystemPlan() {
  if (!targetSystemPlan) return;
  const plan = v2Dashboard?.targetSystemPlan || v2Data.targetSystemPlan;
  if (!plan?.version) {
    targetSystemPlan.innerHTML = `
      <article class="v2-target-empty">
        <strong>等待真实目标系统蓝图</strong>
        <p>连接 V2 API 后，这里会展示最终目标、运营体验、功能包和数据采集替代方案。</p>
      </article>
    `;
    return;
  }
  const capabilities = plan.capabilities || [];
  const experienceFlow = plan.experienceFlow || [];
  const dataAlternatives = plan.dataAlternatives || [];
  const releasePlan = plan.releasePlan || [];
  const principles = plan.principles || [];
  targetSystemPlan.innerHTML = `
    <section class="v2-target-hero">
      <div>
        <span class="caption">TARGET SYSTEM PLAN</span>
        <h3>${escapeHtml(plan.headline || "目标系统蓝图")}</h3>
        <p>${escapeHtml(plan.target || "")}</p>
        <small>${escapeHtml(plan.currentState || "")}</small>
      </div>
      <aside>
        <span>${Number(plan.completedReleaseCount || 0)}/${Number(plan.totalReleaseCount || 0)} 个版本可验收</span>
        <strong>下一步：${escapeHtml(plan.nextAction || "继续补齐大版本缺口")}</strong>
        <a href="${escapeHtml(plan.nextHref || "#")}">执行下一步</a>
      </aside>
    </section>
    <section class="v2-target-section">
      <div class="v2-target-section-head">
        <span class="caption">CAPABILITY PACKS</span>
        <h3>目标系统需要具备的 4 个能力包</h3>
      </div>
      <div class="v2-target-capabilities">
        ${capabilities.map((item) => `
          <article>
            <span>${escapeHtml(item.id || "")}</span>
            <strong>${escapeHtml(item.title || "")}</strong>
            <p><b>目标：</b>${escapeHtml(item.target || "")}</p>
            <p><b>当前：</b>${escapeHtml(item.current || "")}</p>
            <small>${escapeHtml(item.acceptance || "")}</small>
            <a href="${escapeHtml(item.href || "#")}">查看入口</a>
          </article>
        `).join("")}
      </div>
    </section>
    <section class="v2-target-section">
      <div class="v2-target-section-head">
        <span class="caption">OPERATING EXPERIENCE</span>
        <h3>运营一天应该怎么使用</h3>
      </div>
      <div class="v2-target-flow">
        ${experienceFlow.map((item, index) => `
          <article>
            <span>${escapeHtml(item.step || String(index + 1))}</span>
            <strong>${escapeHtml(item.title || "")}</strong>
            <p><b>运营做：</b>${escapeHtml(item.operatorAction || "")}</p>
            <p><b>系统做：</b>${escapeHtml(item.systemAction || "")}</p>
            <a href="${escapeHtml(item.href || "#")}">去这个环节</a>
          </article>
        `).join("")}
      </div>
    </section>
    <section class="v2-target-section">
      <div class="v2-target-section-head">
        <span class="caption">DATA ALTERNATIVES</span>
        <h3>数据采集替代方案：四层保障</h3>
      </div>
      <div class="v2-target-data">
        ${dataAlternatives.map((item) => `
          <article>
            <span>${escapeHtml(item.layer || "")}</span>
            <div>
              <strong>${escapeHtml(item.name || "")}</strong>
              <p><b>使用场景：</b>${escapeHtml(item.useWhen || "")}</p>
              <p><b>当前：</b>${escapeHtml(item.current || "")}</p>
              <small><b>兜底：</b>${escapeHtml(item.fallback || "")}</small>
              <em>${escapeHtml(item.risk || "")}</em>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
    <section class="v2-target-section compact">
      <div class="v2-target-section-head">
        <span class="caption">RELEASE PACKAGE</span>
        <h3>大版本拆包和当前验收状态</h3>
      </div>
      <div class="v2-target-release-row">
        ${releasePlan.map((item) => `
          <article>
            <span>${escapeHtml(item.id || "")}</span>
            <strong>${escapeHtml(item.title || "")}</strong>
            <div class="v2-release-meter"><i style="width:${Math.max(0, Math.min(100, Number(item.percent || 0)))}%"></i></div>
            <small>${escapeHtml(item.statusLabel || "")} · ${Number(item.percent || 0)}%</small>
            <a href="${escapeHtml(item.href || "#")}">${escapeHtml(item.nextAction || "查看")}</a>
          </article>
        `).join("")}
      </div>
      ${principles.length ? `
        <div class="v2-target-principles">
          ${principles.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
        </div>
      ` : ""}
    </section>
  `;
}

function renderExperienceGapBoard() {
  if (!experienceGapBoard) return;
  const board = v2Dashboard?.v2ExperienceGapBoard || v2Data.v2ExperienceGapBoard;
  if (!board?.version) {
    experienceGapBoard.innerHTML = `
      <article class="v2-experience-empty">
        <strong>等待目标体验缺口数据</strong>
        <p>连接 V2 API 后，这里会按角色检查运营、内容负责人、采集维护和品牌负责人离目标体验还差什么。</p>
      </article>
    `;
    return;
  }
  const primary = board.primary || {};
  const items = Array.isArray(board.items) ? board.items : [];
  const principles = Array.isArray(board.principles) ? board.principles.slice(0, 4) : [];
  experienceGapBoard.innerHTML = `
    <section class="v2-experience-hero ${escapeHtml(board.level || "blocked")}">
      <div>
        <span class="caption">EXPERIENCE GAP</span>
        <h3>${escapeHtml(board.headline || "目标体验缺口检查")}</h3>
        <p>${escapeHtml(board.summary || "")}</p>
      </div>
      <aside class="${escapeHtml(primary.status || "blocked")}">
        <span>${Number(board.readyCount || 0)}/${Number(board.totalCount || 0)} 个角色体验可用</span>
        <strong>${escapeHtml(primary.role || "当前优先角色")}</strong>
        <p>${escapeHtml(primary.blocker || primary.current || "继续按角色体验补齐缺口。")}</p>
        <a href="${escapeHtml(primary.href || "#")}">${escapeHtml(primary.nextAction || "处理体验缺口")}</a>
      </aside>
    </section>
    <section class="v2-experience-grid">
      ${items.map((item) => `
        <article class="${escapeHtml(item.status || "blocked")}">
          <div class="v2-experience-card-head">
            <span>${escapeHtml(item.role || "角色")}</span>
            <em>${escapeHtml(item.statusLabel || (item.status === "ready" ? "体验可用" : "体验缺口"))}</em>
          </div>
          <strong>${escapeHtml(item.target || "")}</strong>
          <p><b>当前：</b>${escapeHtml(item.current || "")}</p>
          ${item.blocker ? `<p class="gap"><b>缺口：</b>${escapeHtml(item.blocker)}</p>` : ""}
          <div class="v2-experience-evidence">
            ${(item.evidence || []).map((evidence) => `<span>${escapeHtml(evidence)}</span>`).join("")}
          </div>
          <small>负责人：${escapeHtml(item.owner || item.role || "待定")}</small>
          <a href="${escapeHtml(item.href || "#")}">${escapeHtml(item.nextAction || "去处理")}</a>
        </article>
      `).join("")}
    </section>
    ${principles.length ? `
      <section class="v2-experience-principles">
        <b>体验建设原则</b>
        ${principles.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </section>
    ` : ""}
  `;
}

function renderProductBlueprint() {
  if (!productBlueprint) return;
  const visionMap = v2Dashboard?.productVisionMap || v2Data.productVisionMap;
  const releaseReadiness = v2Dashboard?.releaseReadiness || v2Data.releaseReadiness;
  const readinessReleases = releaseReadiness?.releases || [];
  const maturityGaps = releaseReadiness?.maturityGaps || [];
  const visionHeroHtml = visionMap ? `
    <section class="v2-vision-hero">
      <div>
        <span class="caption">TARGET SYSTEM</span>
        <h3>${escapeHtml(visionMap.headline || "目标系统地图")}</h3>
        <p>${escapeHtml(visionMap.finalTarget || "")}</p>
      </div>
      <aside>
        <span>${escapeHtml(visionMap.currentLevel || "MVP")}</span>
        <strong>${escapeHtml(visionMap.notDoneYet || "当前还不是最终系统。")}</strong>
        <p>${escapeHtml(visionMap.currentSummary || "")}</p>
        <a href="${escapeHtml((visionMap.stages || [])[0]?.href || "#")}">${escapeHtml(visionMap.nextAction || "查看下一步")}</a>
      </aside>
    </section>
  ` : "";
  const visionMetricsHtml = visionMap?.targetMetrics?.length ? `
    <div class="v2-vision-metrics">
      ${visionMap.targetMetrics.map((metric) => `
        <article>
          <span>${escapeHtml(metric.label || "")}</span>
          <strong>${escapeHtml(metric.current || "")}</strong>
          <p>${escapeHtml(metric.target || "")}</p>
        </article>
      `).join("")}
    </div>
  ` : "";
  const visionStagesHtml = visionMap?.stages?.length ? `
    <div class="v2-blueprint-section v2-vision-stage-section">
      <div>
        <span class="caption">MATURITY MAP</span>
        <h3>目标版本地图：从 MVP 到目标系统</h3>
        <p>每一档都用当前数据解释“现在是什么、下一步补什么”，避免把原型验收误解成最终完成。</p>
      </div>
      <div class="v2-vision-stages">
        ${visionMap.stages.map((stage) => `
          <article class="${escapeHtml(stage.status || "future")}">
            <div>
              <span>${escapeHtml(stage.id || "")}</span>
              <em>${escapeHtml(stage.statusLabel || "")}</em>
            </div>
            <strong>${escapeHtml(stage.title || "")}</strong>
            <p><b>当前证据：</b>${escapeHtml(stage.evidence || "")}</p>
            <p><b>目标：</b>${escapeHtml(stage.target || "")}</p>
            <a href="${escapeHtml(stage.href || "#")}">${escapeHtml(stage.action || "查看下一步")}</a>
          </article>
        `).join("")}
      </div>
    </div>
  ` : "";
  const roles = visionMap?.roles || blueprintRoles.map(([role, job, entry]) => ({
    role,
    today: job,
    targetExperience: job,
    entry,
  }));
  const dataStrategy = visionMap?.dataStrategy || blueprintDataLanes.map(([lane, name, current, role]) => ({
    lane,
    name,
    current,
    role,
    fallback: "按四层数据保障方案兜底。",
  }));
  const releaseHtml = readinessReleases.length
    ? `
      <div class="v2-release-summary">
        <strong>版本验收看板</strong>
        <p>${escapeHtml(releaseReadiness.summary || "按真实数据计算版本状态。")}</p>
      </div>
      <div class="v2-release-lanes readiness">
        ${readinessReleases.map((release) => `
          <article class="${escapeHtml(release.status || "in_progress")}">
            <div class="v2-release-topline">
              <span>${escapeHtml(release.id || "")}</span>
              <em>${escapeHtml(release.statusLabel || releaseStatusText(release.status))}</em>
            </div>
            <strong>${escapeHtml(release.title || "未命名版本")}</strong>
            <p>${escapeHtml(release.goal || "")}</p>
            <div class="v2-release-meter" aria-label="${escapeHtml(release.title || "")} 验收进度">
              <i style="width:${Math.max(0, Math.min(100, Number(release.percent || 0)))}%"></i>
            </div>
            <small>已满足 ${release.readyCount || 0}/${release.totalCount || 0} 项 · ${release.percent || 0}%</small>
            <div class="v2-release-checks">
              ${(release.checks || []).map((check) => `
                <div class="${check.ready ? "ready" : "gap"}">
                  <b>${check.ready ? "已满足" : "缺口"}</b>
                  <span>${escapeHtml(check.label || "")}</span>
                  <p>${escapeHtml(check.evidence || "")}</p>
                </div>
              `).join("")}
            </div>
            <a href="${escapeHtml(release.nextHref || release.href || "#")}">${escapeHtml(release.nextAction || "查看下一步")}</a>
          </article>
        `).join("")}
      </div>
      ${maturityGaps.length ? `
        <div class="v2-maturity-panel">
          <div class="v2-maturity-head">
            <span class="caption">NEXT MATURITY</span>
            <strong>下一档成熟度缺口</strong>
            <p>${escapeHtml(releaseReadiness.maturitySummary || "原型验收通过后，还要继续补齐目标系统能力。")}</p>
          </div>
          <div class="v2-maturity-grid">
            ${maturityGaps.map((gap) => `
              <article>
                <strong>${escapeHtml(gap.area || "未命名缺口")}</strong>
                <p><b>当前：</b>${escapeHtml(gap.current || "")}</p>
                <p><b>目标：</b>${escapeHtml(gap.target || "")}</p>
                <a href="${escapeHtml(gap.href || "#")}">${escapeHtml(gap.nextAction || "查看下一步")}</a>
              </article>
            `).join("")}
          </div>
        </div>
      ` : ""}
    `
    : `
      <div class="v2-release-lanes">
        ${blueprintReleases.map(([version, title, scope, accept]) => `
          <article>
            <span>${escapeHtml(version)}</span>
            <strong>${escapeHtml(title)}</strong>
            <p>${escapeHtml(scope)}</p>
            <small>${escapeHtml(accept)}</small>
          </article>
        `).join("")}
      </div>
    `;
  productBlueprint.innerHTML = `
    ${visionHeroHtml}
    ${visionMetricsHtml || `
      <div class="v2-blueprint-goals">
        ${blueprintGoals.map(([label, title, desc]) => `
          <article>
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(title)}</strong>
            <p>${escapeHtml(desc)}</p>
          </article>
        `).join("")}
      </div>
    `}
    ${visionStagesHtml}
    <div class="v2-blueprint-section">
      <div>
        <span class="caption">ROLE EXPERIENCE</span>
        <h3>角色体验：每个人每天要完成什么</h3>
      </div>
      <div class="v2-blueprint-roles">
        ${roles.map((item) => `
          <article>
            <strong>${escapeHtml(item.role || "")}</strong>
            <p>${escapeHtml(item.today || "")}</p>
            ${item.targetExperience ? `<small>${escapeHtml(item.targetExperience)}</small>` : ""}
            <em>${escapeHtml(item.entry || "")}</em>
          </article>
        `).join("")}
      </div>
    </div>
    <div class="v2-blueprint-section">
      <div>
        <span class="caption">DATA GUARANTEE</span>
        <h3>数据保障：不把生产押在单一爬虫上</h3>
      </div>
      <div class="v2-data-lanes">
        ${dataStrategy.map((lane) => `
          <article>
            <span>${escapeHtml(lane.lane || "")}</span>
            <div>
              <strong>${escapeHtml(lane.name || "")}</strong>
              <em>${escapeHtml(lane.current || "")}</em>
              <p>${escapeHtml(lane.role || "")}</p>
              <small>${escapeHtml(lane.fallback || "")}</small>
            </div>
          </article>
        `).join("")}
      </div>
    </div>
    <div class="v2-blueprint-section">
      <div>
        <span class="caption">BIG RELEASE</span>
        <h3>大版本拆包：先闭环，再增厚，再提质，再保障</h3>
      </div>
      ${releaseHtml}
    </div>
  `;
}

function releaseStatusText(value) {
  return {
    ready: "可验收",
    in_progress: "推进中",
    needs_work: "缺口较多",
  }[value] || "待判断";
}

function renderSpecs() {
  if (!specGrid) return;
  const manifest = v2Dashboard?.v2BuildManifest || v2Data.v2BuildManifest;
  if (manifest?.version) {
    specGrid.innerHTML = buildManifestHtml(manifest);
    return;
  }
  specGrid.innerHTML = specItems.map(([title, value, desc]) => `
    <article class="v2-spec-card">
      <strong>${title}</strong>
      <p>${value}</p>
      <span>${desc}</span>
    </article>
  `).join("");
}

function buildManifestHtml(manifest) {
  const sprint = manifest.currentSprint || {};
  const modules = Array.isArray(manifest.modules) ? manifest.modules : [];
  const dataContracts = Array.isArray(manifest.dataContracts) ? manifest.dataContracts : [];
  const apiContracts = Array.isArray(manifest.apiContracts) ? manifest.apiContracts : [];
  const fallbackContracts = Array.isArray(manifest.fallbackContracts) ? manifest.fallbackContracts : [];
  const sprintChecks = Array.isArray(manifest.sprintChecks) ? manifest.sprintChecks : [];
  const qualityGates = Array.isArray(manifest.qualityGates) ? manifest.qualityGates : [];
  const evidence = manifest.releaseEvidence || {};
  return `
    <section class="v2-build-manifest">
      <article class="v2-build-hero ${escapeHtml(sprint.status || "blocked")}">
        <div>
          <span class="caption">BUILD MANIFEST</span>
          <h3>${escapeHtml(manifest.headline || "V2 大版本 Build Manifest")}</h3>
          <p>${escapeHtml(manifest.summary || "")}</p>
          <small>${escapeHtml(evidence.summary || "")}</small>
        </div>
        <aside>
          <span>${escapeHtml(sprint.id || "SPRINT")}</span>
          <strong>${escapeHtml(sprint.title || "当前 Sprint")}</strong>
          <p>${escapeHtml(sprint.acceptance || "")}</p>
          <a href="${escapeHtml(sprint.href || "#")}">${escapeHtml(sprint.nextAction || "处理当前 Sprint")}</a>
        </aside>
      </article>
      <div class="v2-build-facts">
        <span><b>${Number(manifest.todayFacts?.scripts || 0)}</b>今日脚本</span>
        <span><b>${Number(manifest.todayFacts?.contentSources || 0)}</b>今日素材</span>
        <span><b>${Number(manifest.todayFacts?.contentStructures || 0)}</b>今日结构</span>
        <span><b>${Number(manifest.todayFacts?.historyScripts || 0)}</b>历史脚本</span>
        <span><b>${Number(manifest.fallbackPathCount || 0)}</b>兜底路径</span>
      </div>
      <section class="v2-build-section">
        <div class="v2-build-section-head">
          <span class="caption">MODULE CONTRACTS</span>
          <h3>模块边界和当前证据</h3>
        </div>
        <div class="v2-build-modules">
          ${modules.map((item) => `
            <a class="${escapeHtml(item.status || "needs_work")}" href="${escapeHtml(item.entry || "#")}">
              <span>${escapeHtml(item.id || "")}</span>
              <div>
                <strong>${escapeHtml(item.name || "")}</strong>
                <p>${escapeHtml(item.contract || "")}</p>
                <small>${escapeHtml(item.owner || "运营")} · ${escapeHtml(item.evidence || item.statusLabel || "等待证据")}</small>
              </div>
            </a>
          `).join("")}
        </div>
      </section>
      <section class="v2-build-split">
        <article class="v2-build-section compact">
          <div class="v2-build-section-head">
            <span class="caption">DATA MODEL</span>
            <h3>核心数据契约</h3>
          </div>
          <div class="v2-build-contract-list">
            ${dataContracts.map((item) => `
              <div>
                <strong>${escapeHtml(item.name || "")}</strong>
                <p>${escapeHtml(item.purpose || "")}</p>
                <span>${escapeHtml(item.owner || "")}</span>
              </div>
            `).join("")}
          </div>
        </article>
        <article class="v2-build-section compact">
          <div class="v2-build-section-head">
            <span class="caption">API SURFACE</span>
            <h3>关键接口</h3>
          </div>
          <div class="v2-build-api-list">
            ${apiContracts.map((item) => `
              <div>
                <span>${escapeHtml(item.method || "GET")}</span>
                <strong>${escapeHtml(item.path || "")}</strong>
                <p>${escapeHtml(item.purpose || "")}</p>
              </div>
            `).join("")}
          </div>
        </article>
      </section>
      <section class="v2-build-split">
        <article class="v2-build-section compact">
          <div class="v2-build-section-head">
            <span class="caption">SPRINT ACCEPTANCE</span>
            <h3>当前 Sprint 验收测试</h3>
          </div>
          <div class="v2-build-checks">
            ${sprintChecks.map((item) => `
              <a class="${escapeHtml(item.status || "blocked")}" href="${escapeHtml(item.href || "#")}">
                <span>${escapeHtml(item.id || "")}</span>
                <strong>${escapeHtml(item.label || "")}</strong>
                <p>${escapeHtml(item.evidence || "")}</p>
                <b>${escapeHtml(item.action || "去处理")}</b>
              </a>
            `).join("")}
          </div>
        </article>
        <article class="v2-build-section compact">
          <div class="v2-build-section-head">
            <span class="caption">DATA FALLBACKS</span>
            <h3>替代采集链路</h3>
          </div>
          <div class="v2-build-fallback-list">
            ${fallbackContracts.map((item) => `
              <div>
                <span>${escapeHtml(item.layer || "")}</span>
                <strong>${escapeHtml(item.name || "")}</strong>
                <p>${escapeHtml(item.trigger || "")}</p>
                <small>${escapeHtml(item.fallback || item.risk || "")}</small>
              </div>
            `).join("")}
          </div>
        </article>
      </section>
      <div class="v2-build-gates">
        <b>工程红线</b>
        ${qualityGates.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </div>
    </section>
  `;
}

async function loadV2Dashboard() {
  try {
    const response = await fetch(`${V2_API_BASE}/api/v2/dashboard`);
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    v2Dashboard = data;
    if (apiMode) {
      apiMode.textContent = "V2 API 驱动";
      apiMode.className = "ok";
    }
    if (brandName) brandName.textContent = data.brand?.name || v2Brand.name || "未配置品牌";
    if (brandMeta) {
      const scopeText = data.workday?.scope === "today" ? "今日工作日" : "全量预览";
      brandMeta.textContent = `${data.workday?.date || ""} · ${scopeText} · ${workdayStatusText(data.workday?.status)} · ${data.version || ""}`;
    }
    if (v2WorkdayScope) {
      v2WorkdayScope.textContent = data.workday?.rule || "今日口径：读取当天数据。";
    }
    if (v2WorkdayMessage) {
      v2WorkdayMessage.textContent = data.workday?.note || "今日工作日已打开。";
      v2WorkdayMessage.className = data.workday?.status === "closed" ? "warning" : "ok";
    }
    renderModules();
    renderProductCharter();
    renderCurrentSprint();
    renderObjectiveAudit();
    renderObjectivePlan();
    renderMasterPlan();
    renderAcceptanceBoard();
    renderReleaseRoadmap();
    renderExecutionQueue();
    renderWorkflowOverview();
    renderRealDataLoopAudit();
    renderSingleMaterialLoop();
    renderFirstBenchmarkPlan();
    renderWorkdayOpeningReminder();
    renderStatus();
    renderTopicRecommendations();
    renderTasks();
    renderOutputs();
    renderReadiness();
    renderReviewInsights();
    renderV2GenerateButton();
    renderBoundaries();
    renderSources();
    renderDailyReview();
    renderImports();
    renderProducts();
    renderTargetSystemPlan();
    renderExperienceGapBoard();
    renderProductBlueprint();
    renderRoadmap();
    renderSpecs();
  } catch (error) {
    if (apiMode) {
      apiMode.textContent = `静态数据预览：${error.message}`;
      apiMode.className = "warning";
    }
  }
}

async function resetTodayWorkday() {
  if (!resetWorkdayBtn || !v2WorkdayMessage) return;
  const originalText = resetWorkdayBtn.textContent;
  resetWorkdayBtn.disabled = true;
  v2WorkdayMessage.textContent = "正在开启新一轮今日工作流：会清空今日选择，不删除历史脚本。";
  v2WorkdayMessage.className = "warning";
  try {
    const response = await fetch(`${V2_API_BASE}/api/v2/workday/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: "已开启新一轮今日工作流，历史脚本保留在脚本库。" }),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    await loadV2Dashboard();
    const reminder = v2Dashboard?.workdayOpeningReminder;
    v2WorkdayMessage.textContent = reminder?.priorityCount
      ? `今日工作流已重置；开工先处理 ${reminder.priorityCount} 个遗留优先项：${reminder.nextAction || "查看开工提醒"}。`
      : "今日工作流已重置：素材选择、今日素材勾选和商品选择已清空，历史脚本未删除。";
    v2WorkdayMessage.className = reminder?.blockerCount ? "warning" : "ok";
  } catch (error) {
    v2WorkdayMessage.textContent = `开启失败：${error.message}`;
    v2WorkdayMessage.className = "warning";
  } finally {
    resetWorkdayBtn.disabled = false;
    resetWorkdayBtn.textContent = originalText;
  }
}

async function saveOperationHandoff(button) {
  if (!v2WorkdayMessage) return;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "保存中...";
  v2WorkdayMessage.textContent = "正在保存运营交接记录...";
  v2WorkdayMessage.className = "warning";
  try {
    const response = await fetch(`${V2_API_BASE}/api/v2/operation-handoffs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: "由开工提醒保存：用于下一轮采集、对标账号和审核交接。" }),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    v2WorkdayMessage.textContent = `交接记录已保存：${data.item?.summary || "运营交接"}`;
    v2WorkdayMessage.className = "ok";
    await loadV2Dashboard();
  } catch (error) {
    v2WorkdayMessage.textContent = `交接记录保存失败：${error.message}`;
    v2WorkdayMessage.className = "warning";
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function updateOperationHandoffProcess(button) {
  if (!v2WorkdayMessage) return;
  const id = button.dataset.handoffId;
  const processStatus = button.dataset.processHandoff;
  if (!id || !processStatus) return;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "更新中...";
  v2WorkdayMessage.textContent = "正在更新交接处理状态...";
  v2WorkdayMessage.className = "warning";
  try {
    const response = await fetch(`${V2_API_BASE}/api/v2/operation-handoffs/${encodeURIComponent(id)}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        processStatus,
        owner: "运营",
        processNote: processStatus === "done" ? "已由 V2 工作台标记处理完成。" : "已由 V2 工作台接手处理。",
      }),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    v2WorkdayMessage.textContent = `交接状态已更新：${data.item?.processStatusLabel || handoffProcessStatusText(processStatus)}`;
    v2WorkdayMessage.className = "ok";
    await loadV2Dashboard();
  } catch (error) {
    v2WorkdayMessage.textContent = `交接状态更新失败：${error.message}`;
    v2WorkdayMessage.className = "warning";
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function copyOperationHandoff(button) {
  if (!v2WorkdayMessage) return;
  const id = button.dataset.copyHandoff;
  if (!id) return;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "复制中...";
  v2WorkdayMessage.textContent = "正在读取交接归档文本...";
  v2WorkdayMessage.className = "warning";
  try {
    const response = await fetch(`${V2_API_BASE}/api/v2/operation-handoffs/${encodeURIComponent(id)}`);
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    const archiveText = data.item?.archiveText || "";
    if (!archiveText) {
      throw new Error("交接文本为空");
    }
    try {
      await copyTextToClipboard(archiveText);
      v2WorkdayMessage.textContent = "交接文本已复制，可粘贴到飞书文档或日报。";
      v2WorkdayMessage.className = "ok";
    } catch (copyError) {
      showHandoffCopyFallback(button, archiveText);
      v2WorkdayMessage.textContent = "浏览器限制了自动复制，交接文本已展开，可手动全选复制。";
      v2WorkdayMessage.className = "warning";
    }
  } catch (error) {
    v2WorkdayMessage.textContent = `复制交接文本失败：${error.message}`;
    v2WorkdayMessage.className = "warning";
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function showHandoffCopyFallback(button, text) {
  const article = button.closest("article");
  if (!article) return;
  article.querySelector(".handoff-copy-fallback")?.remove();
  const wrapper = document.createElement("div");
  wrapper.className = "handoff-copy-fallback";
  wrapper.innerHTML = `
    <strong>交接文本</strong>
    <textarea rows="8" readonly>${escapeHtml(text)}</textarea>
  `;
  article.appendChild(wrapper);
  wrapper.querySelector("textarea")?.select();
}

async function copyTextToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch (clipboardError) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "readonly");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) throw clipboardError;
  }
}

async function closeTodayWorkday() {
  if (!closeWorkdayBtn || !v2WorkdayMessage) return;
  const originalText = closeWorkdayBtn.textContent;
  closeWorkdayBtn.disabled = true;
  v2WorkdayMessage.textContent = "正在结束今日工作日...";
  v2WorkdayMessage.className = "warning";
  try {
    const response = await fetch(`${V2_API_BASE}/api/v2/workday/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: "今日工作日已结束，等待复盘和下一轮工作流。" }),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    const review = data.dailyReview || {};
    v2WorkdayMessage.textContent = review.summary
      ? `今日工作日已结束：${review.summary}`
      : "今日工作日已结束。仍可查看脚本库和复盘数据。";
    v2WorkdayMessage.className = "warning";
    await loadV2Dashboard();
  } catch (error) {
    v2WorkdayMessage.textContent = `结束失败：${error.message}`;
    v2WorkdayMessage.className = "warning";
  } finally {
    closeWorkdayBtn.disabled = false;
    closeWorkdayBtn.textContent = originalText;
  }
}

async function saveContentSource() {
  if (!saveContentSourceBtn || !importMessage) return;
  const title = document.getElementById("contentTitle")?.value.trim() || "";
  const platform = document.getElementById("contentPlatform")?.value || "douyin";
  const url = document.getElementById("contentUrl")?.value.trim() || "";
  const accountName = document.getElementById("contentAccount")?.value.trim() || "";
  const rawText = document.getElementById("contentRawText")?.value.trim() || "";
  importMessage.className = "v2-import-message";
  if (!title || (!url && !rawText)) {
    importMessage.textContent = "请至少填写标题，并填写链接或字幕/备注。";
    importMessage.classList.add("warning");
    return;
  }
  saveContentSourceBtn.disabled = true;
  importMessage.textContent = "正在导入...";
  try {
    const response = await fetch(`${V2_API_BASE}/api/v2/content-sources`, {
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
      }),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    importMessage.textContent = `已导入：${data.item.title}`;
    importMessage.classList.add("ok");
    ["contentTitle", "contentUrl", "contentAccount", "contentRawText"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    await loadV2Dashboard();
    renderSinglePreview();
  } catch (error) {
    importMessage.textContent = `导入失败：${error.message}`;
    importMessage.classList.add("warning");
  } finally {
    saveContentSourceBtn.disabled = false;
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
    const response = await fetch(`${V2_API_BASE}/api/v2/content-sources/preview`, {
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
    status: data.status || (data.importable ? "ready" : "blocked"),
    statusLabel: data.statusLabel || (data.importable ? "可导入真实素材" : "暂不能导入"),
    titleReady: Boolean(data.titleReady),
    hasUrl: Boolean(data.hasUrl),
    hasText: Boolean(data.hasText),
    warnings: data.warnings || [],
    blockingWarnings: data.blockingWarnings || [],
    nextAction: data.nextAction || "",
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
  const blockingWarnings = warnings.filter((warning) => (
    warning === "缺少标题"
    || warning === "缺少链接或字幕/正文"
    || warning === "链接格式不完整"
    || warning.startsWith("非运营素材：")
  ));
  return {
    importable: blockingWarnings.length === 0,
    status: blockingWarnings.length ? "blocked" : "ready",
    statusLabel: blockingWarnings.length ? "暂不能导入" : "本地判断可导入",
    titleReady: Boolean(payload.title),
    hasUrl: Boolean(payload.url),
    hasText: Boolean(payload.rawText || payload.note),
    warnings,
    blockingWarnings,
    nextAction: blockingWarnings.length ? "补齐标题、真实链接或可结构化文本" : "等待服务端预检确认后导入内容池",
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
    <div class="single-preview-metrics">
      ${metrics.map(([label, value]) => `<span><b>${escapeHtml(label)}</b>${escapeHtml(value)}</span>`).join("")}
    </div>
    ${(preview.warnings || []).length ? `<small>检查项：${preview.warnings.map(escapeHtml).join(" / ")}</small>` : `<small>${escapeHtml(preview.rule || "预检通过后再导入内容池。")}</small>`}
  `;
  updateSingleImportButton(preview);
}

function updateSingleImportButton(preview) {
  if (!saveContentSourceBtn) return;
  if (!preview) {
    saveContentSourceBtn.disabled = false;
    saveContentSourceBtn.textContent = "导入到对标内容池";
    return;
  }
  saveContentSourceBtn.disabled = !preview.importable;
  saveContentSourceBtn.textContent = preview.importable ? "导入真实素材" : "暂不能导入";
}

function localNonOperationalReason(text) {
  const normalized = String(text || "").toLowerCase();
  if (normalized.includes("example.com") || normalized.includes("/example")) return "示例链接";
  const keywords = ["测试", "验证", "示例", "test", "demo", "placeholder", "replace-video", "fallback-test"];
  const hit = keywords.find((keyword) => normalized.includes(keyword.toLowerCase()));
  return hit ? `命中非运营素材关键词：${hit}` : "";
}

async function saveBrandProduct() {
  if (!saveBrandProductBtn || !productMessage) return;
  const productName = document.getElementById("productName")?.value.trim() || "";
  const productGroup = document.getElementById("productGroup")?.value.trim() || "";
  const sellingPoints = document.getElementById("productSellingPoints")?.value.trim() || "";
  const storeScope = document.getElementById("productStoreScope")?.value.trim() || "";
  const activityRules = document.getElementById("productActivityRules")?.value.trim() || "";
  const priceNote = document.getElementById("productPriceNote")?.value.trim() || "";
  productMessage.className = "v2-import-message";
  if (!productName || (!sellingPoints && !activityRules)) {
    productMessage.textContent = "请填写商品/活动名，并至少填写卖点或活动规则。";
    productMessage.classList.add("warning");
    return;
  }
  saveBrandProductBtn.disabled = true;
  productMessage.textContent = "正在保存商品活动...";
  try {
    const response = await fetch(`${V2_API_BASE}/api/v2/brand-products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productName,
        productGroup,
        sellingPoints,
        storeScope,
        activityRules,
        priceNote,
        selected: true,
      }),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    productMessage.textContent = `已保存并加入生成：${data.item.productName}`;
    productMessage.classList.add("ok");
    ["productName", "productGroup", "productSellingPoints", "productStoreScope", "productActivityRules", "productPriceNote"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    await loadV2Dashboard();
  } catch (error) {
    productMessage.textContent = `保存失败：${error.message}`;
    productMessage.classList.add("warning");
  } finally {
    saveBrandProductBtn.disabled = false;
  }
}

async function batchContentSources() {
  if (!batchContentSourceBtn || !importMessage) return;
  const batchText = document.getElementById("contentBatchText")?.value.trim() || "";
  const platform = document.getElementById("contentPlatform")?.value || "douyin";
  const accountName = document.getElementById("contentAccount")?.value.trim() || "";
  importMessage.className = "v2-import-message";
  if (batchResult) batchResult.innerHTML = "";
  if (!batchText) {
    importMessage.textContent = "请先在批量导入框里粘贴素材，每行一条。";
    importMessage.classList.add("warning");
    return;
  }
  batchContentSourceBtn.disabled = true;
  importMessage.textContent = "正在批量导入...";
  try {
    const response = await fetch(`${V2_API_BASE}/api/v2/content-sources/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform, accountName, batchText }),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    const skipped = Number(data.skipped || 0);
    importMessage.textContent = `批量导入完成：识别为 ${formatBatchFormat(data.format)}，成功 ${data.success} 条，失败 ${data.failed} 条${skipped ? `，跳过非运营素材 ${skipped} 条` : ""}。`;
    importMessage.classList.add(data.failed || skipped ? "warning" : "ok");
    renderBatchImportResult(data.results || []);
    if (data.success) {
      const textarea = document.getElementById("contentBatchText");
      if (textarea) textarea.value = "";
    }
    await loadV2Dashboard();
  } catch (error) {
    importMessage.textContent = `批量导入失败：${error.message}`;
    importMessage.classList.add("warning");
  } finally {
    batchContentSourceBtn.disabled = false;
  }
}

async function loadBatchTemplate() {
  if (!batchTemplatePanel) return;
  try {
    const response = await fetch(`${V2_API_BASE}/api/v2/content-sources/batch-template`);
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    batchTemplateData = data;
    renderBatchTemplate(data);
  } catch (error) {
    batchTemplatePanel.className = "batch-template-panel compact warning";
    batchTemplatePanel.innerHTML = `
      <div>
        <strong>第三方表格模板加载失败</strong>
        <p>可先手动使用：标题 / 链接 / 账号 / 平台 / 字幕 / 备注。失败原因：${escapeHtml(error.message)}</p>
      </div>
    `;
  }
}

function renderBatchTemplate(template) {
  if (!batchTemplatePanel) return;
  const vendors = Array.isArray(template.vendors) ? template.vendors : [];
  const fieldGroups = Array.isArray(template.fieldGroups) ? template.fieldGroups : [];
  const requiredGroup = fieldGroups.find((group) => group.key === "required") || fieldGroups[0] || {};
  const fieldText = (requiredGroup.fields || []).map((field) => field.label || field.key).join(" / ");
  batchTemplatePanel.className = "batch-template-panel compact";
  batchTemplatePanel.innerHTML = `
    <div class="batch-template-head">
      <div>
        <span>TEMPLATE</span>
        <strong>第三方表格模板</strong>
        <p>适配 ${escapeHtml(vendors.join(" / ") || "灰豚 / 蝉妈妈 / 飞瓜 / 飞书表格")}；最低字段：${escapeHtml(fieldText || "链接或字幕/正文")}。</p>
      </div>
      <div class="batch-template-actions">
        <button type="button" data-template-action="copy">复制模板</button>
        <button type="button" data-template-action="fill">填入模板</button>
      </div>
    </div>
    <code>${escapeHtml(template.recommendedHeader || "标题\t链接\t账号\t平台\t字幕\t备注")}</code>
    <small>${escapeHtml((template.rules || [])[1] || "预检不写库，正式导入前请替换示例行。")}</small>
  `;
}

async function handleBatchTemplateAction(action) {
  if (!batchTemplateData) {
    await loadBatchTemplate();
  }
  if (!batchTemplateData) return;
  const text = batchTemplateData.templateText || batchTemplateData.recommendedHeader || "";
  if (action === "copy") {
    try {
      await navigator.clipboard.writeText(text);
      importMessage.textContent = "字段模板已复制。粘贴到飞书表格后替换示例行，再复制回来导入。";
      importMessage.className = "v2-import-message ok";
    } catch (error) {
      importMessage.textContent = `复制失败：${error.message}。可点击“填入模板”后手动复制。`;
      importMessage.className = "v2-import-message warning";
    }
    return;
  }
  if (action === "fill") {
    const textarea = document.getElementById("contentBatchText");
    if (textarea && text) {
      textarea.value = text;
      textarea.focus();
    }
    importMessage.textContent = "已填入模板示例。示例行不会自动入库，导入前请替换为真实数据。";
    importMessage.className = "v2-import-message ok";
  }
}

function renderBatchImportResult(results) {
  if (!batchResult) return;
  if (!results.length) {
    batchResult.innerHTML = "";
    return;
  }
  batchResult.innerHTML = `
    <div class="v2-batch-result-head">
      <strong>导入明细</strong>
      <span>失败/跳过行可修改后再次导入真实素材</span>
    </div>
    ${results.slice(0, 12).map((result) => `
      <article class="${result.ok ? "ok" : result.skipped ? "skipped" : "failed"}">
        <span>第 ${result.line} 行</span>
        <strong>${result.ok ? escapeHtml(result.item?.title || "已导入") : escapeHtml(result.skipped ? (result.error || "已跳过非运营素材") : (result.error || "导入失败"))}</strong>
        <p>${escapeHtml(result.input || "")}</p>
      </article>
    `).join("")}
    ${results.length > 12 ? `<small>仅显示前 12 行，完整结果已由接口返回。</small>` : ""}
  `;
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
      <strong>${result.skipped ? escapeHtml(result.title || result.item?.title || "已跳过非运营素材") : (result.ok ? escapeHtml(result.item?.title || result.source?.title || "处理完成") : escapeHtml(result.error || "处理失败"))}</strong>
      <p>${result.skipped ? escapeHtml(`已跳过：${result.reason || result.error || "不计入真实闭环"}`) : (result.ok ? "已进入下一步工作流。" : escapeHtml(result.title || ""))}</p>
    </article>
  `).join("");
}

function formatBatchFormat(format) {
  return {
    csv: "CSV 表格",
    tsv: "表格粘贴",
    line: "逐行文本",
  }[format] || "批量文本";
}

async function bulkSelectContentSources() {
  if (!bulkSelectContentSourcesBtn || !importMessage) return;
  bulkSelectContentSourcesBtn.disabled = true;
  if (bulkResult) bulkResult.innerHTML = "";
  importMessage.className = "v2-import-message";
  importMessage.textContent = "正在把最近未加入的素材批量加入生成工作流...";
  try {
    const response = await fetch(`${V2_API_BASE}/api/v2/content-sources/bulk-select`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "unselected_recent", limit: 10 }),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    const skipped = Number(data.skipped || 0);
    importMessage.textContent = data.success
      ? `已加入真实生成工作流：${data.success} 条${skipped ? `；跳过非运营素材 ${skipped} 条` : ""}。下一步可以批量生成结构摘要。`
      : `没有真实素材可加入；已跳过非运营素材 ${skipped} 条。`;
    importMessage.classList.add(data.success ? "ok" : "warning");
    renderBulkActionResult(data.results || []);
    await loadV2Dashboard();
  } catch (error) {
    importMessage.textContent = `批量加入失败：${error.message}`;
    importMessage.classList.add("warning");
  } finally {
    bulkSelectContentSourcesBtn.disabled = false;
  }
}

async function bulkStructureContentSources() {
  if (!bulkStructureContentSourcesBtn || !importMessage) return;
  bulkStructureContentSourcesBtn.disabled = true;
  if (bulkResult) bulkResult.innerHTML = "";
  importMessage.className = "v2-import-message";
  importMessage.textContent = "正在为已加入工作流且未结构化的素材生成摘要，默认最多处理 3 条...";
  try {
    const response = await fetch(`${V2_API_BASE}/api/v2/content-sources/bulk-structure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "selected_without_structure", limit: 3 }),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    const skipped = Number(data.skipped || 0);
    importMessage.textContent = data.success
      ? `结构摘要完成：成功 ${data.success} 条，失败 ${data.failed} 条${skipped ? `，跳过非运营素材 ${skipped} 条` : ""}。脚本生成会读取已结构化的真实素材。`
      : `没有真实素材可结构化；失败 ${data.failed || 0} 条，跳过非运营素材 ${skipped} 条。`;
    importMessage.classList.add(data.failed || skipped ? "warning" : "ok");
    renderBulkActionResult(data.results || [], "没有已加入且待结构化的素材。");
    await loadV2Dashboard();
  } catch (error) {
    importMessage.textContent = `批量结构化失败：${error.message}`;
    importMessage.classList.add("warning");
  } finally {
    bulkStructureContentSourcesBtn.disabled = false;
  }
}

async function toggleBrandProductSelection(button) {
  if (!productMessage) return;
  const id = button.dataset.brandProductId;
  const selected = button.dataset.selected === "true";
  if (!id) return;
  button.disabled = true;
  productMessage.className = "v2-import-message";
  productMessage.textContent = selected ? "正在加入生成输入..." : "正在移出生成输入...";
  try {
    const response = await fetch(`${V2_API_BASE}/api/v2/brand-products/${id}/select`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selected }),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    productMessage.textContent = selected ? `已加入：${data.item.productName}` : `已移出：${data.item.productName}`;
    productMessage.classList.add("ok");
    await loadV2Dashboard();
  } catch (error) {
    productMessage.textContent = `操作失败：${error.message}`;
    productMessage.classList.add("warning");
    button.disabled = false;
  }
}

async function toggleContentSourceSelection(button) {
  if (!importMessage) return;
  const id = button.dataset.contentSourceId;
  const selected = button.dataset.selected === "true";
  if (!id) return;
  button.disabled = true;
  importMessage.className = "v2-import-message";
  importMessage.textContent = selected ? "正在加入生成工作流..." : "正在移出生成工作流...";
  try {
    const response = await fetch(`${V2_API_BASE}/api/v2/content-sources/${id}/select`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selected }),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    importMessage.textContent = selected ? `已加入：${data.item.title}` : `已移出：${data.item.title}`;
    importMessage.classList.add("ok");
    await loadV2Dashboard();
  } catch (error) {
    importMessage.textContent = `操作失败：${error.message}`;
    importMessage.classList.add("warning");
    button.disabled = false;
  }
}

async function structureContentSource(button) {
  if (!importMessage) return;
  const id = button.dataset.structureSourceId;
  if (!id) return;
  button.disabled = true;
  importMessage.className = "v2-import-message";
  importMessage.textContent = "正在生成结构摘要，Codex CLI 可能需要 30-90 秒...";
  try {
    const response = await fetch(`${V2_API_BASE}/api/v2/content-sources/${id}/structure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    const fallbackText = data.structure?.error ? `，Codex 失败，已用本地规则兜底：${data.structure.error}` : "";
    importMessage.textContent = `已生成结构摘要：${data.source.title}${fallbackText}`;
    importMessage.classList.add(data.structure?.error ? "warning" : "ok");
    await loadV2Dashboard();
  } catch (error) {
    importMessage.textContent = `结构化失败：${error.message}`;
    importMessage.classList.add("warning");
    button.disabled = false;
  }
}

function sourceByName(name) {
  return (v2Dashboard?.dataSources || []).find((source) => source.name === name);
}

function sourceCount(name) {
  return sourceByName(name)?.count ?? 0;
}

function sourceLastAt(name) {
  const value = sourceByName(name)?.lastSuccessAt;
  return value ? formatDate(value) : "";
}

function sourceDesc(name) {
  const source = sourceByName(name);
  if (!source) return "等待接口数据";
  return source.lastSuccessAt ? `最近成功：${formatDate(source.lastSuccessAt)}` : source.fallback || "暂无最近成功记录";
}

function dataSourceLevelText(value) {
  return {
    healthy: "数据源健康",
    usable_with_fallback: "可生产，需兜底",
    needs_input: "需补数据源",
  }[value] || "待判断";
}

function dataSourceStatusText(value) {
  return {
    ready: "已就绪",
    usable: "可使用",
    fallback: "需兜底",
    waiting: "待处理",
  }[value] || "待判断";
}

function priorityText(value) {
  if (value === "high") return "高优先级";
  if (value === "medium") return "中优先级";
  return "待处理";
}

function workflowLevelText(value) {
  return {
    blocked: "需要处理",
    in_progress: "进行中",
    complete: "已闭环",
  }[value] || "待判断";
}

function realLoopLevelText(value) {
  return {
    ready: "真实闭环可用",
    partial: "真实闭环部分可用",
    blocked: "真实闭环未跑通",
  }[value] || "待判断";
}

function realLoopStatusText(value) {
  return {
    ready: "已跑通",
    partial: "部分可用",
    blocked: "未跑通",
  }[value] || "待判断";
}

function singleMaterialLevelText(value) {
  return {
    ready: "单条素材闭环可生成",
    partial: "单条素材部分就绪",
    blocked: "单条素材未就绪",
    empty: "缺少真实素材",
  }[value] || "待判断";
}

function singleMaterialStatusText(value) {
  return {
    done: "已完成",
    waiting: "等待",
    blocked: "未完成",
  }[value] || "待判断";
}

function dailyReviewStatusText(value) {
  return {
    done: "已闭环",
    warning: "需复核",
    open: "未闭环",
  }[value] || "待判断";
}

function workdayStatusText(value) {
  return {
    open: "进行中",
    closed: "已结束",
  }[value] || value || "未知状态";
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
    subtitle_done: "已带字幕",
    subtitle_pending: "待提字幕",
    structure_done: "已结构化",
    selected: "已选择",
    failed: "失败",
  }[value] || value || "未知状态";
}

function reviewStatusText(value) {
  return {
    new: "新脚本",
    adopted: "已采用",
    rejected: "已弃用",
    needs_edit: "待修改",
  }[value] || value || "未知";
}

function handoffProcessStatusText(value) {
  return {
    pending: "待处理",
    processing: "处理中",
    done: "已处理",
    archived: "已归档",
  }[value] || value || "待处理";
}

function v2ShootingScriptHtml(item) {
  const shots = parseV2OutlineShots(item.outline || "");
  const shotRows = shots.length
    ? shots.map((shot, shotIndex) => `
      <article class="shot-row" aria-label="第 ${shotIndex + 1} 段分镜">
        <header class="shot-row-head">
          <div>
            <span class="shot-time">${escapeHtml(shot.time || "未标注时间")}</span>
            <strong>第 ${shotIndex + 1} 段</strong>
          </div>
          <span class="shot-order">SHOT ${String(shotIndex + 1).padStart(2, "0")}</span>
        </header>
        <div class="shot-fields">
          <div class="shot-field shot-field-camera">
            <b class="shot-field-label">镜头</b>
            <p class="shot-field-body">${escapeHtml(shot.shot || "待补充镜头动作")}</p>
          </div>
          <div class="shot-field shot-field-voice">
            <b class="shot-field-label">口播</b>
            <p class="shot-field-body">${escapeHtml(shot.voiceover || "待补充口播")}</p>
          </div>
          <div class="shot-field shot-field-subtitle">
            <b class="shot-field-label">字幕</b>
            <p class="shot-field-body">${escapeHtml(shot.subtitle || "待补充字幕")}</p>
          </div>
        </div>
      </article>
    `).join("")
    : `<article class="shot-row empty-shot"><span>暂无分镜，需重新生成。</span></article>`;
  const notes = [
    item.riskNotes || "发布前复核价格、活动权益和平台合规口径",
    item.fitReason || "确认和本次素材包、品牌商品匹配后再拍摄",
  ].filter(Boolean);
  return `
    <div class="shot-guide">
      <b>按拍摄顺序执行</b>
      <span>这是本次生成结果的正文；确认采用后会同步进入脚本库复盘。</span>
    </div>
    <div class="shot-list" aria-label="可拍分镜正文">${shotRows}</div>
    <div class="script-detail-meta">
      <div class="script-detail-meta-title">辅助信息：来源与拍摄前复核</div>
      <div class="script-source-grid">
        <p class="script-source"><b>来源热点</b>${escapeHtml(item.sourceTrendKeyword || "品牌日常选题")}</p>
        <p class="script-source"><b>对标结构</b>${escapeHtml(item.sourceBenchmarkAccount || "未记录账号")} / ${escapeHtml(item.sourcePattern || "门店种草")}</p>
      </div>
      <div class="note-title">拍摄前复核</div>
      <div class="note-list">${notes.map((note) => `<span>${escapeHtml(note)}</span>`).join("")}</div>
    </div>
  `;
}

function parseV2OutlineShots(outline) {
  if (!outline) return [];
  return outline.split("\n").filter(Boolean).map((line) => {
    const parts = line.split("｜");
    return {
      time: parts[0] || "",
      shot: (parts.find((part) => part.startsWith("镜头：")) || "").replace("镜头：", ""),
      voiceover: (parts.find((part) => part.startsWith("口播：")) || "").replace("口播：", ""),
      subtitle: (parts.find((part) => part.startsWith("字幕：")) || "").replace("字幕：", ""),
    };
  });
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
