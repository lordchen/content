const realData = window.CONTENTWORK_DATA || {};
const API_BASE = "http://127.0.0.1:8771";
const initialScriptTarget = Math.max(1, Math.min(5, (realData.scripts || []).length || 3));
const initialScriptParams = new URLSearchParams(window.location.search);
const initialBenchmarkTaskId = initialScriptParams.get("benchmarkTaskId") || "";
const state = {
  scriptTarget: initialScriptTarget,
  selectedHot: new Set(realData.selections?.selectedHot || []),
  selectedBenchmark: new Set(realData.selections?.selectedBenchmark || []),
  confirmation: realData.confirmation || null,
  generatedScripts: [],
  generatedProcessingRows: [],
  generator: null,
  processActionMessage: null,
  scriptsStale: false,
  generatedTarget: initialScriptTarget,
  v2Dashboard: null,
  v2DashboardError: "",
  structureInputIds: new Set(),
  structureInputTouched: false,
  targetBenchmarkTaskId: initialBenchmarkTaskId,
  weights: {
    trend: 35,
    benchmark: 45,
    brand: 55,
  },
  apiOnline: false,
};
const brandData = realData.brand || {
  name: "adidas阿迪达斯团购号",
  audience: "本地团购用户",
  platform: "抖音",
  duration: 15,
  tones: ["口语化", "营销属性", "泛娱乐", "剧情"],
};

const fallbackHotVideos = Array.from({ length: 20 }, (_, index) => {
  const data = [
    ["直击高考首日", "高考节点", 92],
    ["高考作文", "全民讨论", 89],
    ["夏天就要Seawalk", "夏日穿搭", 86],
    ["哈兰德入驻抖音", "运动热点", 85],
    ["100个美丽中国打卡点名单发布", "本地打卡", 82],
    ["AI写的高考作文你打几分", "AI反差", 79],
    ["黑熊NPC把漂流玩成了整活局", "整活表达", 77],
    ["谢娜官宣个人巡回演唱会", "演唱会穿搭", 75],
    ["专家辟谣外卖用的是人造大米", "真假辨别", 73],
    ["一起为高考静音", "品牌好感", 72],
    ["成何体统2现代婚礼夯爆了", "情侣场景", 71],
    ["看到高考作文的我belike", "剧情开头", 70],
    ["金榜题名高考顺利", "节点祝福", 68],
    ["第一位走出考场的学生", "即时热点", 66],
    ["高考语文默写", "轻娱乐", 64],
    ["名家点评高考作文题", "观点表达", 63],
    ["真考琵琶行了", "梗表达", 61],
    ["全抖音为2026高考加油", "节点氛围", 60],
    ["哈兰德首条视频评论区爆了", "体育流量", 58],
    ["夏天逛街穿什么", "类目补充", 56],
  ][index];
  return {
    id: `hot-${String(index + 1).padStart(2, "0")}`,
    title: data[0],
    topic: data[1],
    score: data[2],
    source: index < 19 ? "抖音热榜" : "类目补充",
  };
});

const fallbackBenchmarkVideos = Array.from({ length: 10 }, (_, index) => {
  const data = [
    ["阿迪达斯官方旗舰店", "新品发布", "商品露出 + 活动节奏"],
    ["阿迪达斯官方旗舰店", "品牌活动", "明星/赛事节点 + 门店承接"],
    ["本地团购服饰账号A", "限时优惠", "前3秒利益点 + 到店理由"],
    ["本地团购服饰账号A", "门店探店", "门头/货架/试穿 + 团购口播"],
    ["本地团购服饰账号A", "导购口播", "问题开头 + 价格锚点 + CTA"],
    ["球鞋穿搭账号B", "球鞋上脚", "上脚镜头 + 场景穿搭"],
    ["球鞋穿搭账号B", "热点嫁接", "热词开头 + 商品转场"],
    ["球鞋穿搭账号B", "情侣穿搭", "双人场景 + 套装搭配"],
    ["同城商场活动号", "商场活动", "活动节点 + 同城到店"],
    ["同城商场活动号", "打卡推荐", "本地打卡 + 门店转化"],
  ][index];
  return {
    id: `bench-${String(index + 1).padStart(2, "0")}`,
    account: data[0],
    pattern: data[1],
    summary: data[2],
    source: "对标账号",
  };
});

const hotVideos = (realData.hotVideos && realData.hotVideos.length ? realData.hotVideos : fallbackHotVideos).slice(0, 20);
const benchmarkVideos = (realData.benchmarkVideos && realData.benchmarkVideos.length ? realData.benchmarkVideos : fallbackBenchmarkVideos).slice(0, 10);
const storedProcessingRows = realData.processingRows || [];
const storedScripts = realData.scripts || [];

const stages = [
  ["1 选素材", "热点 + 对标结构"],
  ["2 确认包", "锁定本次输入"],
  ["3 生成脚本", "分镜 / 口播 / 字幕"],
  ["4 入库复用", "沉淀脚本包"],
];

const scriptTemplates = [
  ["夏天就要Seawalk", "球鞋上脚", "夏天逛街最怕鞋闷，今天直接试一双适合出门的。"],
  ["哈兰德入驻抖音", "运动穿搭", "大家都在刷哈兰德，普通人能抄的是这套运动感。"],
  ["100个美丽中国打卡点名单发布", "门店打卡", "别总想着远方打卡，本地商场也能拍出状态感。"],
  ["AI写的高考作文你打几分", "反差开头", "AI能写作文，但选鞋这件事还得真实上脚。"],
  ["黑熊NPC把漂流玩成了整活局", "门店整活", "门店员工今天不讲参数，直接给你整一套出街搭配。"],
  ["谢娜官宣个人巡回演唱会", "演唱会穿搭", "演唱会季来了，能走能拍的鞋比门票更先准备。"],
  ["专家辟谣外卖用的是人造大米", "真假优惠", "买鞋也一样，别只看夸张话术，要看真实活动规则。"],
  ["成何体统2现代婚礼夯爆了", "情侣球鞋", "情侣穿搭不用太复杂，一双同风格球鞋就够明显。"],
  ["一起为高考静音", "品牌好感", "这几天活动声音小一点，但好看的鞋可以慢慢试。"],
  ["看到高考作文的我belike", "导购剧情", "选鞋比写作文还纠结？导购直接给你两套答案。"],
  ["夏天逛街穿什么", "同城到店", "周末逛商场，不知道穿什么就先从鞋开始换。"],
  ["高考作文", "轻剧情", "今天不写作文，写一条15秒到店穿搭小抄。"],
];

const brandCardName = document.querySelector(".brand-card strong");
const brandCardMeta = document.querySelector(".brand-card span");
const ruleList = document.querySelector(".rule-list");
if (brandCardName) brandCardName.textContent = brandData.name;
if (brandCardMeta) brandCardMeta.textContent = `${brandData.audience} · ${brandData.duration || 15}s · ${brandData.platform || "抖音"}优先`;
if (ruleList) ruleList.innerHTML = (brandData.tones || []).map((tone) => `<span>${tone}</span>`).join("");

const hotVideoList = document.getElementById("hotVideoList");
const benchmarkVideoList = document.getElementById("benchmarkVideoList");
const hotCounter = document.getElementById("hotCounter");
const benchmarkCounter = document.getElementById("benchmarkCounter");
const processingCounter = document.getElementById("processingCounter");
const scriptCounter = document.getElementById("scriptCounter");
const processingList = document.getElementById("processingList");
const scriptList = document.getElementById("scriptList");
const scriptTarget = document.getElementById("scriptTarget");
const generateBtn = document.getElementById("generateBtn");
const confirmSelectionBtn = document.getElementById("confirmSelection");
const apiStatus = document.getElementById("apiStatus");
const confirmationCard = document.getElementById("confirmationCard");
const generationReadinessPanel = document.getElementById("generationReadinessPanel");
const stepNav = document.getElementById("stepNav");
const generationNotice = document.getElementById("generationNotice");
const aiChatPrompt = document.getElementById("aiChatPrompt");
const aiChatImages = document.getElementById("aiChatImages");
const aiChatResult = document.getElementById("aiChatResult");
const textImagePrompt = document.getElementById("textImagePrompt");
const textImageResult = document.getElementById("textImageResult");
const refImagePrompt = document.getElementById("refImagePrompt");
const refImagePaths = document.getElementById("refImagePaths");
const refImageResult = document.getElementById("refImageResult");

document.getElementById("selectRecommended")?.addEventListener("click", () => {
  state.selectedHot = new Set(hotVideos.slice(0, 1).map((item) => item.id));
  state.selectedBenchmark = new Set(benchmarkVideos.slice(0, 1).map((item) => item.id));
  render();
  persistAllVisibleSelections();
});

document.getElementById("clearSelection")?.addEventListener("click", () => {
  state.selectedHot.clear();
  state.selectedBenchmark.clear();
    state.confirmation = null;
    state.generator = null;
    render();
  persistAllVisibleSelections();
});

confirmSelectionBtn?.addEventListener("click", () => confirmCurrentSelection());
generateBtn?.addEventListener("click", () => generateRealDataScripts());
document.getElementById("minusScript")?.addEventListener("click", () => setScriptTarget(state.scriptTarget - 1));
document.getElementById("plusScript")?.addEventListener("click", () => setScriptTarget(state.scriptTarget + 1));
scriptTarget?.addEventListener("change", () => setScriptTarget(Number(scriptTarget.value || 10)));
document.getElementById("askCodexBtn")?.addEventListener("click", () => askCodex());
document.getElementById("fillScriptPromptBtn")?.addEventListener("click", () => fillPromptFromScript());
document.getElementById("generateImageBtn")?.addEventListener("click", () => generateTextImage());
document.getElementById("editImageBtn")?.addEventListener("click", () => generateReferenceImage());
scriptList?.addEventListener("click", (event) => {
  if (event.target.closest("[data-jump-generate]")) {
    document.getElementById("stepGenerate")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const reviewButton = event.target.closest("[data-script-review]");
  if (reviewButton) {
    reviewScript(reviewButton);
    return;
  }
  const rewriteButton = event.target.closest("[data-script-rewrite]");
  if (rewriteButton) {
    rewriteScript(rewriteButton);
  }
});
generationReadinessPanel?.addEventListener("click", (event) => {
  const groupButton = event.target.closest("[data-structure-group-action]");
  if (groupButton) {
    applyStructureGroupAction(groupButton);
    return;
  }
  const removeButton = event.target.closest("[data-input-source-remove]");
  if (removeButton) {
    removeInputSource(removeButton);
    return;
  }
});
generationReadinessPanel?.addEventListener("change", (event) => {
  const inputCheckbox = event.target.closest("[data-structure-input-id]");
  if (inputCheckbox) {
    toggleStructureInput(inputCheckbox);
  }
});

function setScriptTarget(value) {
  const previousTarget = state.scriptTarget;
  state.scriptTarget = Math.max(1, Math.min(5, value));
  if (scriptTarget) scriptTarget.value = state.scriptTarget;
  if (state.confirmation && previousTarget !== state.scriptTarget) {
    const visibleScriptCount = state.generatedScripts.length || storedScripts.length || 0;
    const visibleResultTarget = state.generatedScripts.length ? state.generatedTarget : storedScripts.length;
    if (visibleScriptCount && visibleResultTarget !== state.scriptTarget) {
      state.scriptsStale = true;
      state.generator = null;
    }
  }
  renderGenerateButton();
  renderScripts();
  renderStepNav();
}

function render() {
  if (scriptTarget) scriptTarget.value = state.scriptTarget;
  renderStepNav();
  renderGenerationReadiness();
  renderConfirmation();
  renderVideos();
  renderProcessing();
  renderScripts();
  renderGenerateButton();
}

async function loadGenerationReadiness() {
  if (!generationReadinessPanel) return;
  let timeout = 0;
  try {
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const options = controller ? { signal: controller.signal } : {};
    timeout = controller ? window.setTimeout(() => controller.abort(), 8000) : 0;
    const response = await fetch(`${API_BASE}/api/v2/dashboard`, options);
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    state.v2Dashboard = data;
    state.v2DashboardError = "";
    syncDefaultStructureInputs(data);
    renderGenerationReadiness();
    renderGenerateButton();
  } catch (error) {
    state.v2DashboardError = error.name === "AbortError" ? "生成前检查请求超时，请确认本地 API 服务可用后刷新页面。" : error.message;
    renderGenerationReadiness();
    renderGenerateButton();
  } finally {
    if (timeout) window.clearTimeout(timeout);
  }
}

function syncDefaultStructureInputs(data) {
  if (state.structureInputTouched) return;
  const selectedSources = generationScopedStructureSources(data)
    .map((item) => Number(item.id))
    .filter(Boolean);
  state.structureInputIds = new Set(selectedSources);
}

function generationScopedStructureSources(data = state.v2Dashboard) {
  const sources = (data?.selectedContentSources || []).filter((item) => item.selected && item.structure);
  if (!state.targetBenchmarkTaskId) return sources;
  return sources.filter((item) => String(item.benchmarkTask?.id || item.benchmarkUpdateTaskId || "") === String(state.targetBenchmarkTaskId));
}

function toggleStructureInput(input) {
  const sourceId = Number(input.dataset.structureInputId);
  if (!sourceId) return;
  state.structureInputTouched = true;
  if (input.checked) {
    state.structureInputIds.add(sourceId);
  } else {
    state.structureInputIds.delete(sourceId);
  }
  renderGenerationReadiness();
  renderGenerateButton();
}

function applyStructureGroupAction(button) {
  const action = button.dataset.structureGroupAction;
  const groupKey = button.dataset.structureGroupKey;
  if (!action || !groupKey) return;
  const sources = currentSelectedContentSources();
  const groupItems = sources.filter((item) => structureGroupKey(item) === groupKey && item.structure);
  state.structureInputTouched = true;
  groupItems.forEach((item) => {
    const sourceId = Number(item.id);
    if (!sourceId) return;
    if (action === "select") {
      state.structureInputIds.add(sourceId);
    } else if (action === "unselect") {
      state.structureInputIds.delete(sourceId);
    }
  });
  renderGenerationReadiness();
  renderGenerateButton();
}

function currentSelectedContentSources() {
  const sources = state.v2Dashboard?.selectedContentSources || [];
  return sources.filter((item) => item.selected);
}

async function removeInputSource(button) {
  const sourceId = Number(button.dataset.inputSourceRemove);
  if (!sourceId) return;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "移出中...";
  try {
    const response = await fetch(`${API_BASE}/api/v2/content-sources/${sourceId}/select`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selected: false }),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    setApiStatus("online", `已移出结构素材：${data.item?.title || sourceId}`);
    await loadGenerationReadiness();
  } catch (error) {
    setApiStatus("offline", `移出失败：${error.message}`);
    button.disabled = false;
    button.textContent = originalText;
  }
}

function renderGenerationReadiness() {
  if (!generationReadinessPanel) return;
  if (state.v2DashboardError) {
    generationReadinessPanel.innerHTML = `
      <div class="readiness-main blocked">
        <span>读取失败</span>
        <strong>无法读取生成前检查</strong>
        <p>${escapeHtml(state.v2DashboardError)}</p>
      </div>
    `;
    return;
  }
  if (!state.v2Dashboard?.generationReadiness) {
    generationReadinessPanel.innerHTML = `<div class="readiness-loading">正在读取生成前检查...</div>`;
    return;
  }
  const readiness = state.v2Dashboard.generationReadiness;
  const workflow = state.v2Dashboard.currentWorkflow || {};
  const stats = state.v2Dashboard.stats || {};
  const firstBenchmarkPlan = state.v2Dashboard.firstBenchmarkMaterialPlan || {};
  const r2Verifier = state.v2Dashboard.r2InputVerifier || {};
  const products = state.v2Dashboard.brandProducts || [];
  const selectedProduct = products.find((item) => item.selected);
  const sources = state.v2Dashboard.selectedContentSources || [];
  const selectedSources = sources.filter((item) => item.selected);
  const scopedSources = generationScopedStructureSources();
  const targetTask = findTargetBenchmarkTask();
  const structuredSourceCount = selectedSources.filter((item) => item.structure).length;
  const adoptedTopic = (workflow.adoptedTopics || [])[0];
  const learningSignals = state.v2Dashboard.reviewInsights?.learningSignals || {};
  const reuseSignal = (learningSignals.reuseSignals || [])[0];
  const avoidSignal = (learningSignals.avoidSignals || [])[0];
  generationReadinessPanel.innerHTML = `
    <div class="readiness-main ${readiness.level}">
      <span>${readiness.ready ? "READY" : "CHECK"}</span>
      <strong>${escapeHtml(readiness.summary || "生成前检查")}</strong>
      <p>本次生成会读取：${workflow.hotCount || 0} 条热点、${workflow.benchmarkCount || 0} 条对标、${workflow.structuredManualSourceCount || 0} 条结构摘要、${workflow.selectedProductCount || 0} 条商品活动、${workflow.templateCount || 0} 条高表现模板${adoptedTopic ? "，并使用已采用推荐选题" : ""}。</p>
      <p>真实素材口径：今日真实素材 ${stats.operationalContentSources || 0} 条，已排除测试/示例素材 ${stats.excludedContentSources || 0} 条；被排除素材不会进入本次生成输入。</p>
      <small>${escapeHtml(reuseSignal ? `复盘学习：优先复用「${reuseSignal.label}」；${avoidSignal ? `谨慎使用「${avoidSignal.label}」。` : "暂无明确避坑信号。"}` : "复盘学习：还需要更多采用、发布和模板反馈。")}</small>
    </div>
    ${renderScopedBenchmarkHandoff(targetTask, scopedSources)}
    ${renderP01ScriptGate(targetTask, scopedSources)}
    ${renderRealInputGate(firstBenchmarkPlan, readiness)}
    ${renderR2InputVerifier(r2Verifier)}
    <div class="readiness-check-grid">
      ${(readiness.checks || []).map((check) => `
        <article class="${check.ready ? "ready" : check.optional ? "optional" : "missing"}">
          <span>${check.ready ? "已就绪" : check.optional ? "可选" : "缺失"}</span>
          <strong>${escapeHtml(check.label)}</strong>
          <p>${escapeHtml(check.value || "")}</p>
          <small>${escapeHtml(check.ready ? "会进入本次生成证据链" : check.action || "")}</small>
        </article>
      `).join("")}
    </div>
    <div class="generation-evidence-grid">
      <article>
        <b>采用选题</b>
        <strong>${escapeHtml(adoptedTopic?.title || "未采用推荐选题")}</strong>
        <p>${escapeHtml(adoptedTopic ? `${adoptedTopic.sourceHot || "无热点"} / ${adoptedTopic.sourceStructure || "无结构"} / ${adoptedTopic.sourceProduct || "无商品"}` : "可在 V2 工作台的今日推荐选题中采用一条。")}</p>
        <a href="./v2.html?v=adopted-topic-evidence-v1">回到 V2 工作台</a>
      </article>
      <article>
        <b>商品活动</b>
        <strong>${escapeHtml(selectedProduct?.productName || "未加入商品活动")}</strong>
        <p>${escapeHtml(selectedProduct ? `${selectedProduct.productGroup || "未分组"} / ${selectedProduct.storeScope || "门店范围待补"}` : "去品牌商品中心加入生成输入。")}</p>
        <a href="./brand-center.html?v=brand-center-v1">维护商品活动</a>
      </article>
      <article>
        <b>结构摘要</b>
        <strong>${selectedSources.length} 条真实素材已加入 / ${structuredSourceCount} 条已有结构摘要</strong>
        <p>${escapeHtml(selectedSources.length ? "下方只列出本次生成会读取的真实对标输入；非运营素材不进入输入包。" : "当前没有真实素材进入生成。去对标内容池导入真实视频/笔记并结构化。")}</p>
        <a href="./content-pool.html?v=brand-center-v1">维护对标内容</a>
      </article>
    </div>
    ${renderBenchmarkTaskInputStatus(state.v2Dashboard.benchmarkUpdateTasks?.items || [], selectedSources)}
    ${renderInputSourceList(selectedSources)}
  `;
}

function renderP01ScriptGate(task, scopedSources = []) {
  const verifier = state.v2Dashboard?.p01AcceptanceVerifier || {};
  const target = verifier.targetAccount || task || {};
  const candidateDetails = Array.isArray(verifier.candidateSourcesDetail) ? verifier.candidateSourcesDetail : [];
  const scopedIds = new Set(scopedSources.map((item) => Number(item.id)).filter(Boolean));
  const checkedIds = new Set(Array.from(state.structureInputIds).map(Number).filter(Boolean));
  const checkedScoped = Array.from(scopedIds).filter((id) => checkedIds.has(id));
  const linkedCandidate = candidateDetails.find((item) => item.linkedScript?.id);
  const canAdvanceScriptStep = checkedScoped.length > 0;
  const status = linkedCandidate ? "passed" : canAdvanceScriptStep ? "ready" : "blocked";
  const title = linkedCandidate
    ? `P0-1 已有候选脚本读取 sourceId #${linkedCandidate.sourceId}`
    : canAdvanceScriptStep
      ? `本次生成会读取 P0-1 目标账号 sourceId：${checkedScoped.map((id) => `#${id}`).join("、")}`
      : "本次生成不会推进 P0-1 第 5 步";
  const body = linkedCandidate
    ? `脚本 #${linkedCandidate.linkedScript.id} 已在 input_structure_json 里引用目标素材。`
    : canAdvanceScriptStep
      ? "生成成功后，候选脚本必须在“查看生成依据”里显示这些 sourceId，P0-1 第 5 步才可能通过。"
      : "当前没有勾选目标账号的 structure_done 素材。即使点击生成，也不能作为 P0-1 候选脚本读取素材的验收证据。";
  const actionHref = canAdvanceScriptStep
    ? "./script-library.html?v=p01-script-gate-v1"
    : (task?.importHref || task?.href || `./content-pool.html?v=p01-script-gate-v1&benchmarkTaskId=${encodeURIComponent(state.targetBenchmarkTaskId || target.taskId || "")}#manual-import`);
  return `
    <div class="p01-script-gate ${escapeHtml(status)}">
      <div>
        <span>P0-1 SCRIPT GATE</span>
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(body)}</p>
      </div>
      <div class="p01-script-gate-facts">
        <span><b>目标账号</b>${escapeHtml(target.accountName || "固定对标账号")}</span>
        <span><b>可读结构</b>${scopedIds.size}</span>
        <span><b>本次勾选</b>${checkedScoped.length}</span>
        <span><b>已被脚本读取</b>${linkedCandidate ? `#${linkedCandidate.sourceId}` : "无"}</span>
      </div>
      <div class="p01-script-gate-actions">
        <a href="${escapeHtml(actionHref)}">${escapeHtml(canAdvanceScriptStep ? "去脚本库复核 sourceId" : "回内容池补结构素材")}</a>
        <button type="button" data-structure-group-action="select" data-structure-group-key="task-${escapeHtml(state.targetBenchmarkTaskId || target.taskId || "")}" ${scopedIds.size ? "" : "disabled"}>勾选 P0-1 目标账号结构</button>
      </div>
      <small>验收口径：P0-1 第 5 步只看候选脚本的 input_structure_json 是否引用目标素材 sourceId。</small>
    </div>
  `;
}

function renderR2InputVerifier(verifier = {}) {
  if (!verifier.version) return "";
  const checks = Array.isArray(verifier.checks) ? verifier.checks : [];
  const counts = verifier.counts || {};
  return `
    <div class="r2-input-verifier ${escapeHtml(verifier.level || "blocked")}">
      <div class="r2-input-verifier-head">
        <div>
          <span>${escapeHtml(verifier.levelLabel || "R2 输入厚度")}</span>
          <strong>${escapeHtml(verifier.summary || "检查真实输入是否足够支撑高质量脚本。")}</strong>
          <p>${escapeHtml(verifier.qualityGate || "生成按钮只看关键输入；这里判断脚本质量风险。")}</p>
        </div>
        <a href="${escapeHtml(verifier.nextHref || "#")}">${escapeHtml(verifier.nextAction || "补输入")}</a>
      </div>
      <div class="r2-input-verifier-counts">
        <span><b>必填达标</b>${Number(counts.requiredPassed || 0)}/${Number(counts.requiredTotal || 0)}</span>
        <span><b>总达标</b>${Number(counts.passed || 0)}/${Number(counts.total || checks.length || 0)}</span>
        <span><b>可生成</b>${verifier.canGenerate ? "是" : "否"}</span>
      </div>
      <div class="r2-input-verifier-checks">
        ${checks.map((check) => `
          <a class="${escapeHtml(check.status || "blocked")}" href="${escapeHtml(check.href || "#")}">
            <span>${escapeHtml(check.statusLabel || "待判断")}</span>
            <strong>${escapeHtml(check.label || "输入项")}</strong>
            <p>${Number(check.actual || 0)}/${Number(check.target || 0)} · ${escapeHtml(check.evidence || "")}</p>
          </a>
        `).join("")}
      </div>
      <small>${escapeHtml(verifier.rule || "")}</small>
    </div>
  `;
}

function findTargetBenchmarkTask() {
  if (!state.targetBenchmarkTaskId) return null;
  const tasks = state.v2Dashboard?.benchmarkUpdateTasks?.items || [];
  return tasks.find((task) => String(task.id) === String(state.targetBenchmarkTaskId)) || null;
}

function renderScopedBenchmarkHandoff(task, scopedSources = []) {
  if (!state.targetBenchmarkTaskId) return "";
  const structuredCount = scopedSources.length;
  const checkedCount = scopedSources.filter((item) => state.structureInputIds.has(Number(item.id))).length;
  const title = task?.accountName || `对标任务 #${state.targetBenchmarkTaskId}`;
  const status = task?.generationReadiness?.ready ? "ready" : "blocked";
  const summary = task?.generationReadiness?.summary || (structuredCount
    ? "已从内容池接力到脚本流程，本页默认只读取这个账号任务下的结构素材。"
    : "已从内容池接力到脚本流程，但这个账号任务还没有可读取的结构素材。");
  return `
    <div class="scoped-benchmark-handoff ${escapeHtml(status)}">
      <div>
        <span>P0-1 INPUT HANDOFF</span>
        <strong>${escapeHtml(title)} 的结构输入已定向到本次生成</strong>
        <p>${escapeHtml(summary)}</p>
      </div>
      <div class="scoped-benchmark-handoff-facts">
        <span><b>任务 ID</b>${escapeHtml(state.targetBenchmarkTaskId)}</span>
        <span><b>可读结构</b>${structuredCount}</span>
        <span><b>本次勾选</b>${checkedCount}</span>
      </div>
      <div class="scoped-benchmark-handoff-actions">
        <button type="button" data-structure-group-action="select" data-structure-group-key="task-${escapeHtml(state.targetBenchmarkTaskId)}" ${structuredCount ? "" : "disabled"}>只读取该账号结构</button>
        <a href="./content-pool.html?v=script-handoff-v1&benchmarkTaskId=${encodeURIComponent(state.targetBenchmarkTaskId)}#benchmark-task-${encodeURIComponent(state.targetBenchmarkTaskId)}">回内容池补这个账号</a>
      </div>
    </div>
  `;
}

function renderRealInputGate(plan = {}, readiness = {}) {
  if (!plan?.version) return "";
  const target = plan.targetAccount || {};
  const counts = plan.counts || {};
  const blocked = plan.level !== "ready";
  const actionHref = plan.nextHref || "./content-pool.html?v=real-input-gate-v1#benchmark-update";
  const actionLabel = plan.nextAction || "去补真实对标素材";
  return `
    <div class="real-input-gate ${escapeHtml(blocked ? "blocked" : "ready")}">
      <div class="real-input-gate-main">
        <div>
          <span>${blocked ? "P0-1 GATE" : "P0-1 READY"}</span>
          <strong>${escapeHtml(blocked ? "首条真实账号素材还没跑通，暂不建议生成脚本" : "首条真实账号素材已具备生成输入")}</strong>
          <p>${escapeHtml(plan.summary || readiness.summary || "生成前必须先确认真实素材、结构摘要和商品活动。")}</p>
        </div>
        <a href="${escapeHtml(actionHref)}">${escapeHtml(actionLabel)}</a>
      </div>
      <div class="real-input-gate-facts">
        <span><b>目标账号</b>${escapeHtml(target.accountName || "固定对标账号")}</span>
        <span><b>已导入</b>${Number(counts.imported || 0)}</span>
        <span><b>有文本</b>${Number(counts.withText || 0)}</span>
        <span><b>已结构化</b>${Number(counts.structured || 0)}</span>
        <span><b>可生成</b>${Number(counts.ready || 0)}/${Number(counts.target || 1)}</span>
      </div>
      <small>${blocked ? "这个闸门不会伪造数据：只有真实素材完成入库、字幕/正文、加入生成和结构摘要后，才允许作为脚本生成输入。" : "可以继续确认素材包并生成候选脚本。"}</small>
    </div>
  `;
}

function renderBenchmarkTaskInputStatus(tasks = [], selectedSources = []) {
  if (!tasks.length) {
    return `
      <div class="benchmark-task-input-panel empty">
        <div>
          <span>BENCHMARK ACCOUNT INPUT</span>
          <strong>还没有固定对标账号任务</strong>
          <p>先去对标内容池维护固定账号池，再生成每日账号更新任务。</p>
        </div>
        <a href="./content-pool.html?v=script-benchmark-task-empty-v1">维护固定账号池</a>
      </div>
    `;
  }
  const readyCount = tasks.filter((task) => task.generationReadiness?.ready).length;
  return `
    <div class="benchmark-task-input-panel">
      <div class="benchmark-task-input-head">
        <div>
          <span>BENCHMARK ACCOUNT INPUT</span>
          <strong>固定对标账号生成输入状态</strong>
          <p>${readyCount}/${tasks.length} 个账号已具备可生成输入；未就绪账号不会自动进入本次结构输入包。</p>
        </div>
        <a href="./content-pool.html?v=script-benchmark-task-input-v1#benchmark-update">回内容池补账号素材</a>
      </div>
      <div class="benchmark-task-input-list">
        ${tasks.map((task) => benchmarkTaskInputCard(task, selectedSources)).join("")}
      </div>
    </div>
  `;
}

function benchmarkTaskInputCard(task, selectedSources = []) {
  const readiness = task.generationReadiness || {};
  const counts = readiness.counts || {};
  const blockers = Array.isArray(readiness.blockers) ? readiness.blockers : [];
  const groupKey = `task-${task.id}`;
  const taskSources = selectedSources.filter((item) => structureGroupKey(item) === groupKey && item.structure);
  const checkedCount = taskSources.filter((item) => state.structureInputIds.has(Number(item.id))).length;
  const href = task.href || `./content-pool.html?v=script-benchmark-task-input-v1#benchmark-task-${task.id}`;
  const importHref = task.importHref || href;
  return `
    <article class="${readiness.ready ? "ready" : "blocked"}">
      <div class="benchmark-task-input-card-head">
        <div>
          <span>${escapeHtml(task.statusLabel || "待处理")}</span>
          <strong>${escapeHtml(task.accountName || "未命名对标账号")}</strong>
          <p>${escapeHtml(readiness.summary || task.statusReason || "等待补齐账号近期内容。")}</p>
        </div>
        <em>${escapeHtml(readiness.statusLabel || "待检查")}</em>
      </div>
      <div class="benchmark-task-input-counts">
        <span><b>素材</b>${counts.total || 0}</span>
        <span><b>有文本</b>${counts.withText || 0}</span>
        <span><b>已加入</b>${counts.selected || 0}</span>
        <span><b>已结构化</b>${counts.structured || 0}</span>
      </div>
      <div class="benchmark-task-input-package">
        <span><b>本次输入包</b>${checkedCount}/${taskSources.length} 条结构已勾选</span>
        <small>${taskSources.length ? "这个账号已有结构素材可被本次生成读取。" : "这个账号还没有可勾选的结构素材。"}</small>
      </div>
      ${blockers.length ? `<div class="benchmark-task-input-blockers">${blockers.map((blocker) => `<span>${escapeHtml(blocker)}</span>`).join("")}</div>` : ""}
      <div class="benchmark-task-input-actions">
        <a href="${escapeHtml(readiness.ready ? href : importHref)}">${escapeHtml(readiness.ready ? "查看可生成输入" : readiness.nextAction || "补齐账号素材")}</a>
        <button type="button" data-structure-group-action="select" data-structure-group-key="${escapeHtml(groupKey)}" ${taskSources.length ? "" : "disabled"}>勾选该账号结构</button>
        <button type="button" data-structure-group-action="unselect" data-structure-group-key="${escapeHtml(groupKey)}" ${taskSources.length ? "" : "disabled"}>取消该账号结构</button>
      </div>
    </article>
  `;
}

function renderInputSourceList(sources) {
  if (!sources.length) {
    return `
      <div class="input-source-panel empty">
        <div>
          <span>STRUCTURE INPUT</span>
          <strong>暂无结构素材进入本次生成</strong>
          <p>脚本可以生成，但质量会更依赖热点和固定对标账号池。建议先去对标内容池导入 3-10 条近期视频/笔记并生成结构摘要。</p>
        </div>
        <a href="./content-pool.html?v=input-source-empty-v1">去对标内容池补素材</a>
      </div>
    `;
  }
  const groups = groupInputSourcesByTask(sources);
  return `
    <div class="input-source-panel">
      <div class="input-source-head">
        <div>
          <span>STRUCTURE INPUT</span>
          <strong>本次生成会读取的对标结构素材</strong>
          <p>已勾选 ${state.structureInputIds.size} 条结构作为本次输入包。下面按对标账号更新任务分组，运营可以一键读取某个账号本次采集到的结构。</p>
        </div>
        <a href="./content-pool.html?v=input-source-list-v1">管理内容池</a>
      </div>
      <div class="input-source-list">
        ${groups.map((group) => inputSourceGroup(group)).join("")}
      </div>
    </div>
  `;
}

function groupInputSourcesByTask(sources) {
  const map = new Map();
  sources.forEach((item) => {
    const key = structureGroupKey(item);
    if (!map.has(key)) {
      map.set(key, {
        key,
        task: item.benchmarkTask || null,
        accountName: item.benchmarkTask?.accountName || item.accountName || "未绑定对标任务",
        items: [],
      });
    }
    map.get(key).items.push(item);
  });
  return Array.from(map.values()).sort((a, b) => {
    if (a.task && !b.task) return -1;
    if (!a.task && b.task) return 1;
    return (a.accountName || "").localeCompare(b.accountName || "", "zh-Hans-CN");
  });
}

function structureGroupKey(item) {
  const taskId = item.benchmarkTask?.id || item.benchmarkUpdateTaskId;
  if (taskId) return `task-${taskId}`;
  return `loose-${item.accountName || item.platform || "unknown"}`;
}

function inputSourceGroup(group) {
  const structuredItems = group.items.filter((item) => item.structure);
  const selectedCount = structuredItems.filter((item) => state.structureInputIds.has(Number(item.id))).length;
  const task = group.task;
  const status = task?.statusLabel || (task ? "任务状态待同步" : "未绑定任务");
  const title = task ? `${task.accountName} · 对标更新任务 #${task.id}` : `${group.accountName} · 手工/历史素材`;
  const meta = task
    ? `目标 ${task.targetCount || 0} 条 / 已导入 ${task.importedCount || 0} 条 / 已结构化 ${task.structuredCount || 0} 条`
    : `${group.items.length} 条素材 / ${structuredItems.length} 条已有结构`;
  const whyTrack = task?.whyTrack ? `<p>${escapeHtml(task.whyTrack)}</p>` : "";
  return `
    <section class="input-source-group">
      <div class="input-source-group-head">
        <div>
          <span>${escapeHtml(status)}</span>
          <strong>${escapeHtml(title)}</strong>
          <p>${escapeHtml(meta)}；本组已勾选 ${selectedCount}/${structuredItems.length} 条结构。</p>
          ${whyTrack}
        </div>
        <div class="input-source-group-actions">
          <button type="button" data-structure-group-action="select" data-structure-group-key="${escapeHtml(group.key)}" ${structuredItems.length ? "" : "disabled"}>勾选本任务结构</button>
          <button type="button" data-structure-group-action="unselect" data-structure-group-key="${escapeHtml(group.key)}" ${structuredItems.length ? "" : "disabled"}>取消本任务结构</button>
          <a href="./content-pool.html?v=script-input-task-v1">回内容池处理</a>
        </div>
      </div>
      <div class="input-source-group-list">
        ${group.items.map((item) => inputSourceCard(item)).join("")}
      </div>
    </section>
  `;
}

function inputSourceCard(item) {
  const structure = item.structure?.structure || {};
  const usableParts = Array.isArray(structure.usable_parts) ? structure.usable_parts.slice(0, 2) : [];
  const risks = Array.isArray(structure.risk_notes) ? structure.risk_notes.slice(0, 2) : [];
  const hasStructure = Boolean(item.structure);
  const checked = hasStructure && state.structureInputIds.has(Number(item.id)) ? "checked" : "";
  const taskLabel = item.benchmarkTask
    ? `来自对标任务 #${item.benchmarkTask.id} / ${item.benchmarkTask.accountName}`
    : "未绑定对标更新任务";
  return `
    <article class="${hasStructure ? "ready" : "missing"}">
      <div class="input-source-card-head">
        <div>
          <span>${escapeHtml(platformLabel(item.platform))} / ${escapeHtml(item.accountName || "未知来源")}</span>
          <strong>${escapeHtml(item.title || "未命名素材")}</strong>
          <small>${escapeHtml(taskLabel)}</small>
        </div>
        <em>${hasStructure ? "会进入生成" : "已加入但未结构化"}</em>
      </div>
      ${hasStructure ? `
        <label class="input-source-toggle">
          <input type="checkbox" data-structure-input-id="${item.id}" ${checked} />
          <span>${checked ? "本次会读取这条结构" : "本次不读取这条结构"}</span>
        </label>
      ` : ""}
      <p>${escapeHtml(hasStructure ? (structure.script_pattern || structure.hook_angle || "已生成结构摘要") : "还没有结构摘要；请先生成结构摘要，否则脚本生成无法稳定复用这条素材。")}</p>
      ${usableParts.length ? `<div class="input-source-tags">${usableParts.map((part) => `<span>${escapeHtml(part)}</span>`).join("")}</div>` : ""}
      ${risks.length ? `<small>风险：${risks.map(escapeHtml).join(" / ")}</small>` : ""}
      <div class="input-source-actions">
        ${hasStructure ? "" : `<a href="./content-pool.html?v=input-source-structure-v1">去结构化</a>`}
        <button type="button" data-input-source-remove="${item.id}">移出本次生成</button>
      </div>
    </article>
  `;
}

function platformLabel(value) {
  return {
    douyin: "抖音",
    xhs: "小红书",
    manual: "手工素材",
    third_party: "第三方",
  }[value] || value || "未知平台";
}

function renderGenerateButton() {
  const selectedTotal = state.selectedHot.size + state.selectedBenchmark.size;
  const readiness = state.v2Dashboard?.generationReadiness;
  if (confirmSelectionBtn) {
    confirmSelectionBtn.textContent = state.confirmation ? "1. 已锁定素材包" : "1. 锁定本次素材包";
    confirmSelectionBtn.disabled = !selectedTotal;
  }
  if (!generateBtn) return;
  if (state.generator?.pending) {
    generateBtn.textContent = `正在生成 ${state.scriptTarget} 条...`;
    generateBtn.disabled = true;
    return;
  }
  if (!state.confirmation) {
    generateBtn.textContent = "2. 先锁定后生成";
    generateBtn.disabled = true;
    return;
  }
  const structureInputCount = state.structureInputIds.size;
  generateBtn.textContent = readiness?.ready === false ? "2. 关键输入缺失" : `2. 生成 ${state.scriptTarget} 条脚本 · 结构 ${structureInputCount} 条`;
  generateBtn.disabled = readiness?.ready === false;
}

function renderConfirmation() {
  if (!confirmationCard) return;
  if (!state.confirmation) {
    confirmationCard.innerHTML = `
      <strong>素材包待确认</strong>
      <span>左侧勾选会先保存为草稿。确认素材包后，脚本生成只使用这批固定输入。</span>
    `;
    return;
  }
  const hotText = (state.confirmation.hotTitles || []).join("、") || `${state.confirmation.hotCount} 条热点`;
  const benchmarkText = (state.confirmation.benchmarkTitles || []).join("、") || `${state.confirmation.benchmarkCount} 条对标`;
  confirmationCard.innerHTML = `
    <strong>已确认素材包：${state.confirmation.hotCount} 条热点 + ${state.confirmation.benchmarkCount} 条对标</strong>
    <div class="input-flow">
      <div>
        <b>热点输入（${state.confirmation.hotCount} 条）</b>
        ${state.confirmation.hotCount ? renderConfirmedList(state.confirmation.hotTitles) : "<span>未选择，使用品牌日常选题兜底</span>"}
      </div>
      <div>
        <b>对标结构（${state.confirmation.benchmarkCount} 条）</b>
        ${state.confirmation.benchmarkCount ? renderConfirmedList(state.confirmation.benchmarkTitles) : "<span>未选择，使用品牌自有结构兜底</span>"}
      </div>
      <span>生成关系：确认素材包 → Codex 选题/结构分析 → 按脚本数量生成 → 写入脚本列表</span>
    </div>
  `;
}

function renderConfirmedList(items) {
  return `
    <ol class="confirmed-list">
      ${(items || []).map((item) => `<li>${item}</li>`).join("")}
    </ol>
  `;
}

function renderStepNav() {
  if (!stepNav) return;
  const selectedTotal = state.selectedHot.size + state.selectedBenchmark.size;
  const scriptCount = state.generatedScripts.length || storedScripts.length || 0;
  const steps = [
    ["1", "选素材", selectedTotal ? `${selectedTotal} 条已选` : "未选择"],
    ["2", "选品牌", brandData.name || "未选择"],
    ["3", "生成脚本", state.confirmation ? "输入已确认" : "待确认"],
    ["4", "脚本列表", scriptCount ? `${scriptCount} 条脚本` : "待生成"],
  ];
  stepNav.innerHTML = steps
    .map(([index, title, desc]) => `
      <article class="step-pill">
        <strong>${index}</strong>
        <span>${title}</span>
        <small>${desc}</small>
      </article>
    `)
    .join("");
}

function renderVideos() {
  if (!hotVideoList || !benchmarkVideoList || !hotCounter || !benchmarkCounter) return;
  hotCounter.textContent = `${state.selectedHot.size}/20 已选`;
  benchmarkCounter.textContent = `${state.selectedBenchmark.size}/10 已选`;

  hotVideoList.innerHTML = hotVideos.map((item) => videoRow(item, "hot")).join("");
  benchmarkVideoList.innerHTML = benchmarkVideos.map((item) => benchmarkRow(item)).join("");

  document.querySelectorAll("[data-hot-id]").forEach((input) => {
    input.addEventListener("change", (event) => {
      const id = event.target.dataset.hotId;
      toggleSet(state.selectedHot, id, event.target.checked);
      syncSelection("hot", hotVideos.find((item) => item.id === id), event.target.checked);
    });
  });
  document.querySelectorAll("[data-benchmark-id]").forEach((input) => {
    input.addEventListener("change", (event) => {
      const id = event.target.dataset.benchmarkId;
      toggleSet(state.selectedBenchmark, id, event.target.checked);
      syncSelection("benchmark", benchmarkVideos.find((item) => item.id === id), event.target.checked);
    });
  });
}

function videoRow(item) {
  const checked = state.selectedHot.has(item.id) ? "checked" : "";
  return `
    <label class="video-row">
      <input type="checkbox" data-hot-id="${item.id}" ${checked} />
      <span>
        <span class="video-title">${item.title}</span>
        <span class="video-meta">
          <span class="pill hot">${item.source}</span>
          <span class="pill">${item.topic}</span>
        </span>
      </span>
      <span class="score">${item.score}</span>
    </label>
  `;
}

function benchmarkRow(item) {
  const checked = state.selectedBenchmark.has(item.id) ? "checked" : "";
  return `
    <label class="video-row">
      <input type="checkbox" data-benchmark-id="${item.id}" ${checked} />
      <span>
        <span class="video-title">${item.account}</span>
        <span class="video-meta">
          <span class="pill benchmark">${item.pattern}</span>
          <span class="pill">${item.summary}</span>
        </span>
      </span>
      <span class="score">${item.id.replace("bench-", "#")}</span>
    </label>
  `;
}

function toggleSet(targetSet, id, checked) {
  if (checked) {
    targetSet.add(id);
  } else {
    targetSet.delete(id);
  }
  state.confirmation = null;
  state.generatedScripts = [];
  state.generatedProcessingRows = [];
  state.generator = null;
  render();
}

function syncSelection(sourceType, item, selected) {
  if (!item) return;
  const title = sourceType === "hot" ? item.title : `${item.account} / ${item.pattern}`;
  persistSelection({
    sourceType,
    sourceId: item.id,
    title,
    selected,
    payload: item,
  });
}

async function persistSelection(selection) {
  try {
    const response = await fetch(`${API_BASE}/api/selections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brandName: brandData.name,
        ...selection,
      }),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    setApiStatus("online", "已保存到本地库");
  } catch (error) {
    setApiStatus("offline", "保存服务未连接，仅页面预览");
  }
}

function persistAllVisibleSelections() {
  hotVideos.forEach((item) => syncSelection("hot", item, state.selectedHot.has(item.id)));
  benchmarkVideos.forEach((item) => syncSelection("benchmark", item, state.selectedBenchmark.has(item.id)));
}

async function checkApiStatus() {
  try {
    const response = await fetch(`${API_BASE}/api/health`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    state.apiOnline = true;
    setApiStatus("online", "保存服务已连接");
  } catch (error) {
    state.apiOnline = false;
    setApiStatus("offline", "保存服务未连接，仅页面预览");
  }
}

function setApiStatus(status, text) {
  if (!apiStatus) return;
  apiStatus.textContent = text;
  apiStatus.className = `api-status ${status}`;
}

async function confirmCurrentSelection() {
  if (!state.selectedHot.size && !state.selectedBenchmark.size) {
    setApiStatus("offline", "请先选择热点或对标视频");
    return;
  }
  setApiStatus("online", "正在确认素材包...");
  try {
    const response = await fetch(`${API_BASE}/api/confirm-selection`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandName: brandData.name }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
  const hotTitles = hotVideos.filter((item) => state.selectedHot.has(item.id)).map((item) => item.title);
    const benchmarkTitles = benchmarkVideos
      .filter((item) => state.selectedBenchmark.has(item.id))
      .map((item) => `${item.account} / ${item.pattern}`);
    state.confirmation = {
      id: data.result.confirmationId,
      hotCount: data.result.hotCount,
      benchmarkCount: data.result.benchmarkCount,
      createdAt: data.result.createdAt,
      hotTitles,
      benchmarkTitles,
    };
    state.generatedScripts = [];
    state.generatedProcessingRows = [];
    state.generator = null;
    state.scriptsStale = true;
    setApiStatus("online", `已确认素材包：${data.result.hotCount}+${data.result.benchmarkCount}`);
    render();
    loadGenerationReadiness();
  } catch (error) {
    setApiStatus("offline", `确认失败：${error.message}`);
  }
}

async function generateRealDataScripts() {
  if (!state.confirmation) {
    setApiStatus("offline", "请先确认素材包，再生成脚本");
    return;
  }
  setApiStatus("online", "正在生成可拍脚本...");
  state.generator = { name: "codex_cli", pending: true, usedFallback: false, error: "" };
  state.generatedScripts = [];
  state.generatedTarget = state.scriptTarget;
  state.scriptsStale = false;
  renderGenerateButton();
  renderScripts();
  try {
    const response = await fetch(`${API_BASE}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brandName: brandData.name,
        target: state.scriptTarget,
        structureSourceIds: Array.from(state.structureInputIds),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    state.generatedScripts = data.result.scripts || [];
    state.generatedTarget = data.result.scriptCount || state.generatedScripts.length || state.scriptTarget;
    state.generatedProcessingRows = buildGeneratedProcessingRows();
    state.generator = data.result.generator || null;
    state.scriptsStale = false;
    if (state.generator?.usedFallback) {
      setApiStatus("offline", "Codex CLI 失败，已用本地规则兜底");
    } else {
      setApiStatus("online", `Codex CLI 已生成：${data.result.scriptCount}条脚本，读取结构 ${data.result.inputStructureCount || 0} 条`);
    }
    renderStepNav();
    renderProcessing();
    renderScripts();
    loadGenerationReadiness();
  } catch (error) {
    state.generator = null;
    setApiStatus("offline", `生成失败：${error.message}`);
    renderGenerateButton();
    renderGenerationNotice();
  }
}

async function reviewScript(button) {
  const scriptId = button.dataset.scriptId;
  const reviewStatus = button.dataset.scriptReview;
  if (!scriptId || !reviewStatus) return;
  button.disabled = true;
  setApiStatus("pending", "正在更新脚本审核状态...");
  try {
    const response = await fetch(`${API_BASE}/api/v2/script-candidates/${scriptId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewStatus, reviewNote: defaultReviewNote(reviewStatus) }),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    setApiStatus("online", `脚本已标记为：${reviewStatusText(reviewStatus)}`);
    window.location.reload();
  } catch (error) {
    setApiStatus("offline", `审核状态更新失败：${error.message}`);
    button.disabled = false;
  }
}

function defaultReviewNote(reviewStatus) {
  return {
    adopted: "运营采用：结构清晰，可进入发布或模板复盘。",
    needs_edit: "运营待改：需要优化开头、镜头执行或转化 CTA。",
    rejected: "运营弃用：不适合当前品牌/活动，后续降低相似结构权重。",
    new: "",
  }[reviewStatus] || "";
}

async function rewriteScript(button) {
  const scriptId = button.dataset.scriptId;
  if (!scriptId) return;
  button.disabled = true;
  setApiStatus("pending", "正在自动改写脚本...");
  try {
    const response = await fetch(`${API_BASE}/api/v2/script-candidates/${scriptId}/rewrite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    const item = data.item || {};
    const plan = item.rewritePlan || item.diagnosisUsed || {};
    const suffix = plan.focus ? `：${plan.focus}` : "";
    setApiStatus("online", `已生成自动改写版本 #${item.id || ""}${suffix}`);
    window.location.reload();
  } catch (error) {
    setApiStatus("offline", `自动改写失败：${error.message}`);
    button.disabled = false;
  }
}

function buildGeneratedProcessingRows() {
  const selectedHot = hotVideos.filter((item) => state.selectedHot.has(item.id));
  const selectedBenchmark = benchmarkVideos.filter((item) => state.selectedBenchmark.has(item.id));
  return [
    ...selectedHot.map((item) => ({
      label: "热点结构",
      title: item.title,
      sourceType: "hot",
      sourceId: item.id,
      status: "waiting",
      topic: item.topic,
      available: "热点词、热度排序、品牌嫁接角度",
      stateNote: "真实热榜已入库；无视频链接，字幕待接入",
      generator: "codex_cli",
    })),
    ...selectedBenchmark.map((item) => ({
      label: "对标结构",
      title: `${item.account} / ${item.pattern}`,
      sourceType: "benchmark",
      sourceId: item.id,
      status: "waiting",
      topic: item.pattern,
      available: "账号类型、内容结构、转化方式",
      stateNote: `真实对标账号池已入库；固定视频链接待补充 / ${item.summary}`,
      generator: "codex_cli",
    })),
  ];
}

function renderProcessing() {
  if (!processingList) return;
  if (state.generatedProcessingRows.length) {
    renderProcessingRows(state.generatedProcessingRows);
    return;
  }
  if (!state.confirmation && !storedProcessingRows.length) {
    renderProcessingRows([]);
    return;
  }
  const selectedHot = hotVideos.filter((item) => state.selectedHot.has(item.id));
  const selectedBenchmark = benchmarkVideos.filter((item) => state.selectedBenchmark.has(item.id));
  const generatedRows = [
    ...selectedHot.map((item) => ({
      label: "热点视频",
      title: item.title,
      sourceType: "hot",
      sourceId: item.id,
      status: "waiting",
      topic: item.topic,
      available: "热点词、热度排序、品牌嫁接角度",
      stateNote: "真实热榜已入库；无视频链接，字幕待接入",
      generator: "codex_cli",
    })),
    ...selectedBenchmark.map((item) => ({
      label: "对标视频",
      title: item.account,
      sourceType: "benchmark",
      sourceId: item.id,
      status: "waiting",
      topic: item.pattern,
      available: "账号类型、内容结构、转化方式",
      stateNote: `真实对标账号池已入库；固定视频链接待补充 / ${item.summary}`,
      generator: "codex_cli",
    })),
  ];
  const rows = storedProcessingRows.length ? storedProcessingRows : generatedRows;

  renderProcessingRows(rows);
}

function renderProcessingRows(rows) {
  if (processingCounter) {
    processingCounter.textContent = rows.length ? `${rows.length} 条分析` : "待分析";
  }
  const notice = state.processActionMessage
    ? `<div class="process-action-notice ${state.processActionMessage.type}">${state.processActionMessage.text}</div>`
    : "";
  processingList.innerHTML = rows.length
    ? notice + rows.map((rawRow) => {
      const row = normalizeProcessRow(rawRow);
      const statusText = row.status === "done" ? "可直接使用" : "缺视频链接";
      const generatorText = row.generator === "codex_cli" ? "Codex CLI" : row.generator === "local_fallback" ? "本地兜底" : "";
      const availablePreview = truncateText(row.available, 88);
      const statePreview = truncateText(row.stateNote, 72);
      const influenceText = row.sourceType === "hot"
        ? "影响脚本开头、热点嫁接角度和标题关键词"
        : "影响脚本结构、镜头顺序和转化口播";
      return `
      <article class="process-row" data-source-type="${row.sourceType}" data-source-id="${row.sourceId}">
        <div class="process-main">
          <div class="process-title-line">
            <strong>${row.title}</strong>
            <span class="pill">${row.label}</span>
            ${row.topic ? `<span class="pill benchmark">${row.topic}</span>` : ""}
            ${generatorText ? `<span class="pill hot">${generatorText}</span>` : ""}
          </div>
          <div class="process-actions">
            <button type="button" data-process-action="use">加入本次生成</button>
            <button type="button" data-process-action="inspect">看完整分析</button>
            <button type="button" data-process-action="subtitle">补视频链接提字幕</button>
          </div>
          <p class="process-role"><b>这条分析会影响脚本：</b>${influenceText}</p>
          <p class="process-available"><b>系统会读取：</b>${availablePreview}</p>
        </div>
        <div class="process-state">
          <span class="status ${row.status}">${statusText}</span>
          <small>${statePreview}</small>
        </div>
      </article>
    `;
    }).join("")
    : `<article class="process-row"><span class="status waiting">待确认</span><span>锁定素材包后，这里会展示 Codex 对每条素材的选题分析。</span></article>`;
  bindProcessActionButtons();
}

function normalizeProcessRow(row) {
  const summary = row.summary || "";
  const summaryParts = summary.split("/").map((part) => part.trim()).filter(Boolean);
  const sourceType = row.sourceType || (row.label?.includes("热点") ? "hot" : "benchmark");
  const matched = findSourceItem(sourceType, row.sourceId, row.title);
  const availableFromSummary = summaryParts.find((part) => part.startsWith("可用"))?.replace(/^可用[:：]\s*/, "");
  const topicFromSummary = summaryParts.find((part) => !part.startsWith("可用") && !part.includes("入库") && !part.includes("链接"));
  return {
    ...row,
    sourceType,
    sourceId: row.sourceId || matched?.id || "",
    label: row.label || (sourceType === "hot" ? "热点结构" : "对标结构"),
    topic: row.topic || matched?.topic || matched?.pattern || topicFromSummary || "",
    available: row.available || availableFromSummary || (sourceType === "hot" ? "热点词、热度排序、品牌嫁接角度" : "账号类型、内容结构、转化方式"),
    stateNote: row.stateNote || summaryParts[0] || (row.status === "done" ? "结构摘要已入库" : "无视频链接，字幕待接入"),
    generator: row.generator || "",
  };
}

function findSourceItem(sourceType, sourceId, title) {
  if (sourceType === "hot") {
    return hotVideos.find((item) => item.id === sourceId || item.title === title);
  }
  return benchmarkVideos.find((item) => {
    const rowTitle = `${item.account} / ${item.pattern}`;
    return item.id === sourceId || item.account === title || rowTitle === title;
  });
}

function truncateText(value, maxLength) {
  const text = String(value || "");
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function bindProcessActionButtons() {
  if (!processingList) return;
  processingList.querySelectorAll("[data-process-action]").forEach((button) => {
    button.addEventListener("click", () => handleProcessAction(button));
  });
}

function handleProcessAction(button) {
  const row = button.closest(".process-row");
  if (!row) return;
  const action = button.dataset.processAction;
  const sourceType = row.dataset.sourceType;
  const sourceId = row.dataset.sourceId;
  const title = row.querySelector("strong")?.textContent || "这条素材";
  const available = row.querySelector(".process-available")?.textContent.replace(/^可用[:：]\s*/, "") || "当前结构信息";

  if (action === "use") {
    if (!sourceId) {
      setProcessActionMessage("warning", "这条素材来自历史入库记录，缺少原始素材 ID，不能直接改选。");
      return;
    }
    if (sourceType === "hot") {
      state.selectedHot.add(sourceId);
      syncSelection("hot", hotVideos.find((item) => item.id === sourceId), true);
    } else {
      state.selectedBenchmark.add(sourceId);
      syncSelection("benchmark", benchmarkVideos.find((item) => item.id === sourceId), true);
    }
    state.confirmation = null;
    state.generatedScripts = [];
    state.generator = null;
    setProcessActionMessage("ok", `已把「${title}」加入本次生成输入。请重新锁定素材包后再生成脚本。`);
    render();
    return;
  }

  if (action === "inspect") {
    setProcessActionMessage("ok", `「${title}」的 Codex 分析：${available}。`);
    return;
  }

  if (action === "subtitle") {
    setProcessActionMessage("warning", `「${title}」目前只有热榜/结构信息，没有具体视频链接。补充抖音/小红书视频链接后，才能提取字幕并更新分析。`);
  }
}

function setProcessActionMessage(type, text) {
  state.processActionMessage = { type, text };
  setApiStatus(type === "ok" ? "online" : "offline", text);
  renderProcessing();
}

function linesToArray(value) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function setAiResult(target, type, html) {
  if (!target) return;
  target.className = `ai-result ${type}`;
  target.innerHTML = html;
}

async function postAi(path, payload) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok || data.ok === false) {
    const details = typeof data.details === "string" ? data.details : JSON.stringify(data.details || {});
    throw new Error(`${data.error || `HTTP ${response.status}`}${details && details !== "{}" ? `：${details}` : ""}`);
  }
  return data.result;
}

async function askCodex() {
  if (!aiChatPrompt || !aiChatImages || !aiChatResult) return;
  setAiResult(aiChatResult, "pending", "正在调用 Codex CLI，对话通常需要 30-120 秒。");
  try {
    const result = await postAi("/api/ai/chat", {
      prompt: aiChatPrompt.value,
      images: linesToArray(aiChatImages.value),
      cwd: "/Users/lei/Documents/contentwork",
      sandbox: "read-only",
      timeoutSeconds: 180,
    });
    setAiResult(aiChatResult, "ok", `<strong>Codex 返回：</strong><pre>${escapeHtml(result.answer || "无返回内容")}</pre>`);
    setApiStatus("online", "Codex 对话调用成功");
  } catch (error) {
    setAiResult(aiChatResult, "error", `<strong>Codex 调用失败</strong><span>${escapeHtml(error.message)}</span>`);
    setApiStatus("offline", "Codex 对话调用失败");
  }
}

function fillPromptFromScript() {
  if (!aiChatPrompt || !textImagePrompt || !aiChatResult) return;
  const script = state.generatedScripts[0] || storedScripts[0];
  if (!script) {
    setAiResult(aiChatResult, "error", "还没有可用脚本，先生成脚本后再提取画面提示词。");
    return;
  }
  const title = script.title || "短视频脚本";
  const hook = script.hook || "";
  const source = script.source_trend_keyword || script.hot || "当前热点";
  const prompt = `请把下面短视频脚本改写成 1 条可用于文生图的首帧画面提示词。要求：竖屏9:16，真实手机拍摄感，适合抖音本地团购，不要出现未授权明星或平台Logo。\n标题：${title}\n热点：${source}\n开头：${hook}`;
  aiChatPrompt.value = prompt;
  textImagePrompt.value = `竖屏9:16短视频首帧，${brandData.name}，${source}热点借势，门店运动鞋试穿场景，真实手机拍摄质感，本地团购内容封面，干净构图，人物自然，不出现未授权明星和平台Logo。`;
  setAiResult(aiChatResult, "ok", "已把第一条脚本转成 Codex 对话提示词，并同步填入文生图提示词。");
}

async function generateTextImage() {
  if (!textImagePrompt || !textImageResult) return;
  setAiResult(textImageResult, "pending", "正在调用 OpenAI 图片接口生成图片。");
  try {
    const result = await postAi("/api/ai/images/generate", {
      prompt: textImagePrompt.value,
      size: "1024x1536",
      quality: "auto",
      outputFormat: "png",
      n: 1,
    });
    renderImages(textImageResult, result);
    setApiStatus("online", "文生图生成成功");
  } catch (error) {
    setAiResult(textImageResult, "error", `<strong>文生图失败</strong><span>${escapeHtml(error.message)}</span>`);
    setApiStatus("offline", "文生图失败");
  }
}

async function generateReferenceImage() {
  if (!refImagePrompt || !refImagePaths || !refImageResult) return;
  const images = linesToArray(refImagePaths.value);
  if (!images.length) {
    setAiResult(refImageResult, "error", "请先填写至少 1 张本地参考图路径。");
    return;
  }
  setAiResult(refImageResult, "pending", "正在调用 OpenAI 参考图生图接口。");
  try {
    const result = await postAi("/api/ai/images/edit", {
      prompt: refImagePrompt.value,
      images,
      size: "1024x1536",
      quality: "auto",
      outputFormat: "png",
      n: 1,
    });
    renderImages(refImageResult, result);
    setApiStatus("online", "参考图生图成功");
  } catch (error) {
    setAiResult(refImageResult, "error", `<strong>参考图生图失败</strong><span>${escapeHtml(error.message)}</span>`);
    setApiStatus("offline", "参考图生图失败");
  }
}

function renderImages(target, result) {
  const cards = (result.images || []).map((image) => `
    <figure>
      <img src="${API_BASE}${image.url}" alt="生成图片" />
      <figcaption>${image.path}</figcaption>
    </figure>
  `).join("");
  setAiResult(target, "ok", `${cards}<span>模型：${result.model || "openai_images"}</span>`);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderScripts() {
  if (!scriptList || !scriptCounter) return;
  renderGenerationNotice();
  if (state.generator?.pending) {
    scriptCounter.textContent = `正在生成 ${state.scriptTarget} 条`;
    scriptList.innerHTML = `
      <article class="script-card empty-state">
        <div class="script-title">正在生成 ${state.scriptTarget} 条脚本</div>
        <p>系统已经收到本次点击，正在调用 Codex CLI。完成后这里会替换成 ${state.scriptTarget} 条可拍脚本。</p>
      </article>
    `;
    return;
  }
  if (state.scriptsStale) {
    scriptCounter.textContent = "待生成";
    scriptList.innerHTML = `
      <article class="script-card empty-state">
        <div class="script-title">当前脚本不是 ${state.scriptTarget} 条的新结果</div>
        <p>你已经把数量改成 ${state.scriptTarget} 条。请点击第 3 步的“2. 生成 ${state.scriptTarget} 条脚本”，脚本列表才会刷新成新的数量。</p>
        <button class="secondary-action" type="button" data-jump-generate>回到第 3 步生成脚本</button>
      </article>
    `;
    return;
  }
  if (state.generatedScripts.length) {
    renderScriptCards(state.generatedScripts, state.generator?.usedFallback ? "本地兜底" : "Codex CLI");
    return;
  }
  const availableStoredScripts = storedScripts.slice(0, state.scriptTarget);
  if (availableStoredScripts.length) {
    const label = availableStoredScripts.some((item) => item.generator === "codex_cli") ? "Codex CLI" : "真实导出";
    renderScriptCards(availableStoredScripts, label);
    return;
  }

  const selectedHot = hotVideos.filter((item) => state.selectedHot.has(item.id));
  const selectedBenchmarks = benchmarkVideos.filter((item) => state.selectedBenchmark.has(item.id));
  const sourceHot = selectedHot.length ? selectedHot : hotVideos.slice(0, 3);
  const sourceBench = selectedBenchmarks.length ? selectedBenchmarks : benchmarkVideos.slice(0, 2);
  const scripts = Array.from({ length: state.scriptTarget }, (_, index) => {
    const template = scriptTemplates[index % scriptTemplates.length];
    const hot = sourceHot[index % sourceHot.length];
    const bench = sourceBench[index % sourceBench.length];
    return {
      title: template[2],
      hot: hot.title,
      pattern: bench.pattern,
      account: bench.account,
      score: Math.min(98, 62 + state.weights.brand * 0.2 + state.weights.benchmark * 0.18 + state.weights.trend * 0.12 + index),
    };
  });

  scriptCounter.textContent = `${scripts.length} 条`;
  scriptList.innerHTML = scripts.map((item, index) => `
    <article class="script-card">
      <div class="script-title">${index + 1}. ${item.title}</div>
      <p>来源热点：${item.hot}</p>
      <p>对标结构：${item.account} / ${item.pattern}</p>
      <div class="script-meta">
        <span class="pill hot">综合分 ${Math.round(item.score)}</span>
        <span class="pill benchmark">15s</span>
        <span class="pill risk">需合规复核</span>
      </div>
    </article>
  `).join("");
}

function renderGenerationNotice() {
  if (!generationNotice) return;
  if (!state.generator) {
    generationNotice.innerHTML = "";
    generationNotice.className = "generation-notice";
    return;
  }
  if (state.generator.pending) {
    generationNotice.className = "generation-notice ok";
    generationNotice.innerHTML = `<strong>正在调用 Codex CLI 生成脚本。</strong><span>通常需要 30-120 秒，请等待返回结果。</span>`;
    return;
  }
  if (state.generator.usedFallback) {
    generationNotice.className = "generation-notice warning";
    generationNotice.innerHTML = `
      <strong>Codex CLI 调用失败，已使用本地规则兜底。</strong>
      <span>${state.generator.error || "未返回具体错误"}</span>
    `;
    return;
  }
  generationNotice.className = "generation-notice ok";
  generationNotice.innerHTML = `<strong>本次脚本由 Codex CLI 生成。</strong><span>已写入本地脚本库。</span>`;
}

function renderScriptCards(scripts, label) {
  scriptCounter.textContent = `${scripts.length} 条`;
  scriptList.innerHTML = scripts.map((item, index) => {
    const hotSource = item.hot || item.source_trend_keyword || "品牌日常选题";
    const patternSource = item.pattern || item.source_pattern || "门店种草";
    const accountSource = item.account || item.source_benchmark_account || brandData.name;
    const quality = item.quality || {};
    const inputStructures = item.input_structures || item.inputStructures || [];
    const inputProducts = item.input_products || item.inputProducts || [];
    const inputTemplates = item.input_templates || item.inputTemplates || [];
    const inputFeedback = item.input_feedback || item.inputFeedback || [];
    const inputTopics = item.input_topics || item.inputTopics || [];
    const scriptId = item.id;
    return `
    <article class="script-card">
      <div class="script-list-head">
        <div>
          <div class="script-title">${index + 1}. ${item.title}</div>
          <p class="script-hook">${item.hook}</p>
        </div>
        <span class="pill hot">${label}</span>
      </div>
      <div class="script-brief">
        <span>热点：${hotSource}</span>
        <span>结构：${patternSource}</span>
        <span>${brandData.duration || 15}s</span>
      </div>
      <div class="script-lineage">
        <span>来自上方分析</span>
        <strong>热点《${hotSource}》</strong>
        <span>→</span>
        <span>套用结构</span>
        <strong>${accountSource} / ${patternSource}</strong>
        <span>→</span>
        <span>生成这条脚本</span>
      </div>
      ${inputTopics.length ? `
        <div class="script-topic-source">
          <span>采用选题</span>
          <strong>${inputTopics.map((topic) => escapeHtml(topic.title || "未命名选题")).join("、")}</strong>
        </div>
      ` : ""}
      ${scriptQualityHtml(quality, inputStructures, inputProducts, inputTemplates, inputFeedback)}
      ${scriptInputEvidenceHtml(inputStructures, inputProducts, inputTemplates, inputFeedback, inputTopics)}
      ${scriptWorkflowHtml(item, scriptId)}
      <details class="script-detail">
        <summary>查看分镜脚本</summary>
        ${shootingScriptHtml(item)}
      </details>
      <div class="script-meta">
        ${quality.overall ? `<span class="pill hot">质量分 ${quality.overall}</span>` : ""}
        <span class="pill benchmark">${brandData.duration || 15}s</span>
        <span class="pill risk">需合规复核</span>
      </div>
    </article>
  `;
  }).join("");
}

function scriptInputEvidenceHtml(inputStructures = [], inputProducts = [], inputTemplates = [], inputFeedback = [], inputTopics = []) {
  const hasEvidence = inputStructures.length || inputProducts.length || inputTemplates.length || inputFeedback.length || inputTopics.length;
  if (!hasEvidence) return "";
  return `
    <details class="script-input-detail">
      <summary>查看生成依据</summary>
      <div class="script-input-grid">
        ${inputTopics.length ? evidenceSectionHtml("采用选题", inputTopics.map((topic) => ({
          title: topic.title || "未命名选题",
          meta: [topic.sourceHot, topic.sourceStructure, topic.sourceProduct].filter(Boolean).join(" / "),
          body: topic.angle || topic.sourceTemplate || "",
        }))) : ""}
        ${inputStructures.length ? evidenceSectionHtml("结构素材", inputStructures.map((item) => {
          const structure = item.structure || {};
          const usable = Array.isArray(structure.usable_parts) ? structure.usable_parts.slice(0, 2).join(" / ") : "";
          const sourceId = item.sourceId || item.source_id || item.id || "";
          return {
            title: item.title || "未命名结构",
            meta: `${sourceId ? `sourceId #${sourceId} / ` : ""}${platformLabel(item.platform)} / ${item.accountName || "未知来源"}`,
            badge: sourceId ? `P0-1 验收读取 sourceId #${sourceId}` : "",
            body: structure.script_pattern || structure.hook_angle || usable || "已读取结构摘要",
          };
        })) : ""}
        ${inputProducts.length ? evidenceSectionHtml("商品活动", inputProducts.map((item) => ({
          title: item.productName || "未命名商品",
          meta: [item.productGroup, item.storeScope].filter(Boolean).join(" / "),
          body: item.activityRules || item.priceNote || (Array.isArray(item.sellingPoints) ? item.sellingPoints.slice(0, 2).join(" / ") : ""),
        }))) : ""}
        ${inputTemplates.length ? evidenceSectionHtml("高表现模板", inputTemplates.map((item) => ({
          title: item.title || "未命名模板",
          meta: item.sourcePattern || item.source_pattern || "历史脚本库模板",
          body: item.hook || item.fitReason || item.fit_reason || "",
        }))) : ""}
        ${inputFeedback.length ? evidenceSectionHtml("复盘信号", inputFeedback.map((item) => ({
          title: item.label || item.pattern || item.title || "复盘信号",
          meta: item.type === "avoid" ? "避开" : "复用",
          body: item.action || item.evidence || "",
        }))) : ""}
      </div>
    </details>
  `;
}

function evidenceSectionHtml(title, items) {
  return `
    <section class="script-input-section">
      <h4>${escapeHtml(title)}</h4>
      ${items.map((item) => `
        <article>
          <strong>${escapeHtml(item.title || "未命名输入")}</strong>
          ${item.badge ? `<em>${escapeHtml(item.badge)}</em>` : ""}
          ${item.meta ? `<span>${escapeHtml(item.meta)}</span>` : ""}
          ${item.body ? `<p>${escapeHtml(item.body)}</p>` : ""}
        </article>
      `).join("")}
    </section>
  `;
}

function scriptWorkflowHtml(item, scriptId) {
  const qualityStatus = item.qualityStatus || item.quality_status || "unscored";
  const reviewStatus = item.reviewStatus || item.review_status || "new";
  const reviewNote = item.reviewNote || item.review_note || "";
  const quality = item.quality || {};
  const rewritePlan = rewritePlanFromQuality(quality);
  const rewriteDiff = rewriteDiffFromQuality(quality);
  const canOperate = Boolean(scriptId);
  return `
    <div class="script-workflow">
      <div>
        <span>质量：${qualityStatusText(qualityStatus)}</span>
        <span>审核：${reviewStatusText(reviewStatus)}</span>
        ${reviewNote ? `<small>${escapeHtml(reviewNote)}</small>` : ""}
      </div>
      ${canOperate ? `
        <div class="script-actions">
          <button type="button" data-script-review="adopted" data-script-id="${scriptId}">采用</button>
          <button type="button" data-script-review="needs_edit" data-script-id="${scriptId}">待改</button>
          <button type="button" data-script-review="rejected" data-script-id="${scriptId}">弃用</button>
          <button type="button" data-script-rewrite data-script-id="${scriptId}">自动改写</button>
        </div>
        ${rewritePlan ? `
          <div class="script-rewrite-plan">
            <b>自动改写将优先解决：${escapeHtml(rewritePlan.focus)}</b>
            <span>${escapeHtml(rewritePlan.fixes.join("；"))}</span>
          </div>
        ` : ""}
        ${rewriteDiff ? rewriteDiffHtml(rewriteDiff) : ""}
      ` : `<small>历史静态脚本缺少 ID，刷新数据后可操作。</small>`}
    </div>
  `;
}

function rewritePlanFromQuality(quality) {
  const diagnosis = quality?.diagnosis || {};
  const weakItems = Array.isArray(diagnosis.weakDimensions) ? diagnosis.weakDimensions : [];
  const focus = diagnosis.rewriteFocus || weakItems[0]?.dimension || "";
  const prompt = diagnosis.rewritePrompt || weakItems[0]?.action || "";
  const fixes = weakItems.slice(0, 3).map((item) => {
    const label = item.dimension || "待改";
    const action = item.action || item.reason || "";
    return action ? `${label}：${action}` : label;
  });
  if (!focus && !prompt && !fixes.length) return null;
  return {
    focus: focus || "增强可拍性和合规口径",
    fixes: fixes.length ? fixes : [prompt],
  };
}

function rewriteDiffFromQuality(quality) {
  const diff = quality?.rewriteDiff;
  if (!diff || typeof diff !== "object") return null;
  const changedSegments = Array.isArray(diff.changedSegments) ? diff.changedSegments : [];
  const removedRiskWords = Array.isArray(diff.removedRiskWords) ? diff.removedRiskWords : [];
  const generator = quality?.rewriteGenerator || {};
  return {
    summary: diff.summary || "",
    focus: diff.focus || "",
    oldHook: diff.oldHook || "",
    newHook: diff.newHook || "",
    changedSegments,
    removedRiskWords,
    generatorName: generator.name || "",
    usedFallback: Boolean(generator.usedFallback),
    generatorError: generator.error || "",
  };
}

function rewriteDiffHtml(diff) {
  return `
    <details class="script-rewrite-diff">
      <summary>查看改写前后变化</summary>
      <div class="rewrite-diff-grid">
        <section>
          <b>改写方式</b>
          <p>${escapeHtml(diff.generatorName || "diagnosis_rewrite")}${diff.usedFallback ? " / 本地兜底" : " / Codex CLI"}</p>
          ${diff.generatorError ? `<small>失败原因：${escapeHtml(diff.generatorError)}</small>` : ""}
        </section>
        <section>
          <b>改动段落</b>
          ${diff.changedSegments.length ? diff.changedSegments.map((item) => `<em>${escapeHtml(item)}</em>`).join("") : "<p>未检测到明显段落变化。</p>"}
        </section>
        <section>
          <b>开头变化</b>
          <p><strong>原：</strong>${escapeHtml(diff.oldHook || "无")}</p>
          <p><strong>新：</strong>${escapeHtml(diff.newHook || "无")}</p>
        </section>
        ${diff.removedRiskWords.length ? `
          <section>
            <b>已移除风险词</b>
            ${diff.removedRiskWords.map((word) => `<em>${escapeHtml(word)}</em>`).join("")}
          </section>
        ` : ""}
      </div>
    </details>
  `;
}

function qualityStatusText(value) {
  return {
    passed: "通过",
    needs_rewrite: "需改写",
    blocked: "阻塞",
    unscored: "未评分",
  }[value] || value;
}

function reviewStatusText(value) {
  return {
    new: "新脚本",
    adopted: "已采用",
    rejected: "已弃用",
    needs_edit: "待修改",
  }[value] || value;
}

function scriptQualityHtml(quality, inputStructures, inputProducts, inputTemplates, inputFeedback = []) {
  const evidenceItems = [
    ["结构", inputStructures.length],
    ["商品", inputProducts.length],
    ["模板", inputTemplates.length],
    ["复盘", inputFeedback.length],
  ];
  if (!quality?.overall && !evidenceItems.some(([, count]) => count)) return "";
  const reasons = Array.isArray(quality.reasons) ? quality.reasons : [];
  const scores = quality.scores || {};
  const scoreItems = [
    ["可拍", scores.shootable],
    ["开头", scores.hook],
    ["品牌", scores.brandFit],
    ["转化", scores.conversion],
    ["合规", scores.compliance],
  ].filter(([, value]) => typeof value === "number");
  const diagnosis = normalizeQualityDiagnosis(quality, inputStructures, inputProducts, inputTemplates);
  return `
    <div class="script-quality">
      <div>
        <strong>${quality.overall ? `质量分 ${quality.overall}` : "质量待评分"}</strong>
        <span>${evidenceItems.map(([label, count]) => `${label} ${count} 条`).join(" / ")}</span>
      </div>
      ${inputTemplates.length ? `<div class="template-evidence">参考高表现模板：${inputTemplates.map((template) => escapeHtml(template.title || "未命名模板")).join("、")}</div>` : ""}
      ${inputFeedback.length ? `<div class="feedback-evidence">读取复盘反馈：${inputFeedback.slice(0, 3).map(feedbackSignalLabel).join("；")}</div>` : ""}
      ${scoreItems.length ? `<div class="quality-scores">${scoreItems.map(([label, value]) => `<em>${label} ${value}</em>`).join("")}</div>` : ""}
      ${reasons.length ? `<p>${reasons.map(escapeHtml).join(" / ")}</p>` : ""}
      ${qualityDiagnosisHtml(diagnosis)}
    </div>
  `;
}

function normalizeQualityDiagnosis(quality, inputStructures = [], inputProducts = [], inputTemplates = []) {
  const diagnosis = quality?.diagnosis || {};
  const scores = quality?.scores || {};
  const weakDimensions = Array.isArray(diagnosis.weakDimensions) ? diagnosis.weakDimensions : [];
  const strongDimensions = Array.isArray(diagnosis.strongDimensions) ? diagnosis.strongDimensions : [];
  const inputImpact = Array.isArray(diagnosis.inputImpact) ? diagnosis.inputImpact : [];
  if (diagnosis.summary || weakDimensions.length || strongDimensions.length || inputImpact.length) {
    return diagnosis;
  }
  const inferredWeak = [];
  if (scores.conversion && scores.conversion < 78) inferredWeak.push({ dimension: "转化", action: "补明确 CTA、团购权益和到店动作。" });
  if (scores.hook && scores.hook < 78) inferredWeak.push({ dimension: "开头", action: "把前 3 秒改成用户问题或热点反差。" });
  if (scores.compliance && scores.compliance < 78) inferredWeak.push({ dimension: "合规", action: "把价格、库存和优惠改成以门店当天为准。" });
  return {
    summary: (quality?.reasons || [])[0] || "基础质量可用，发布前复核商品和活动口径。",
    strongDimensions: [
      inputStructures.length ? "结构输入充足" : "",
      inputProducts.length ? "商品口径可用" : "",
      inputTemplates.length ? "模板可复用" : "",
    ].filter(Boolean),
    weakDimensions: inferredWeak,
    inputImpact: [
      inputStructures.length ? `结构素材贡献：读取 ${inputStructures.length} 条。` : "结构素材缺口：没有结构摘要。",
      inputProducts.length ? `商品活动贡献：读取 ${inputProducts.length} 条。` : "商品活动缺口：缺少真实权益。",
      inputTemplates.length ? `模板贡献：参考 ${inputTemplates.length} 条。` : "",
    ].filter(Boolean),
    rewriteFocus: inferredWeak[0]?.dimension || "增强细节",
    rewritePrompt: inferredWeak[0]?.action || "保留当前结构，补真实镜头、商品权益和门店复核口径。",
  };
}

function qualityDiagnosisHtml(diagnosis) {
  if (!diagnosis) return "";
  const weakItems = Array.isArray(diagnosis.weakDimensions) ? diagnosis.weakDimensions : [];
  const strongItems = Array.isArray(diagnosis.strongDimensions) ? diagnosis.strongDimensions : [];
  const inputImpact = Array.isArray(diagnosis.inputImpact) ? diagnosis.inputImpact : [];
  return `
    <div class="quality-diagnosis">
      <div class="quality-diagnosis-head">
        <span>QUALITY DIAGNOSIS</span>
        <strong>${escapeHtml(diagnosis.summary || "质量诊断待补充")}</strong>
      </div>
      <div class="quality-diagnosis-grid">
        <section>
          <b>强项</b>
          ${strongItems.length ? strongItems.map((item) => `<em>${escapeHtml(typeof item === "string" ? item : item.dimension || item.label || "")}</em>`).join("") : "<p>暂无明显强项，需要更多输入支撑。</p>"}
        </section>
        <section>
          <b>弱项 / 改写方向</b>
          ${weakItems.length ? weakItems.map((item) => `<p><strong>${escapeHtml(item.dimension || "待改")}</strong>${escapeHtml(item.action || item.reason || "")}</p>`).join("") : `<p><strong>${escapeHtml(diagnosis.rewriteFocus || "保持结构")}</strong>${escapeHtml(diagnosis.rewritePrompt || "补真实镜头和商品权益。")}</p>`}
        </section>
        <section>
          <b>输入影响</b>
          ${inputImpact.length ? inputImpact.map((item) => `<p>${escapeHtml(item)}</p>`).join("") : "<p>暂无输入影响说明。</p>"}
        </section>
      </div>
      <div class="quality-rewrite-hint">
        <b>建议改写</b>
        <span>${escapeHtml(diagnosis.rewritePrompt || "补齐真实镜头、商品权益和发布前复核口径。")}</span>
      </div>
    </div>
  `;
}

function feedbackSignalLabel(item) {
  const type = item.type === "avoid" ? "避开" : "复用";
  const label = item.label || item.pattern || item.title || "未命名信号";
  const action = item.action || item.evidence || "";
  return `${type}「${escapeHtml(label)}」${action ? `：${escapeHtml(action)}` : ""}`;
}

function shootingScriptHtml(item) {
  const shots = item.shots || parseOutlineShots(item.outline || "");
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
  const notes = item.shooting_notes || ["竖屏拍摄", "前3秒必须出现热点词", "商品露出不要超过真实活动承诺", "发布前复核价格和门店权益"];
  return `
    <div class="shot-guide">
      <b>按拍摄顺序执行</b>
      <span>每张卡片对应一段拍摄任务。运营先看时间段，再看镜头怎么拍、口播说什么、屏幕打什么字。</span>
    </div>
    <div class="shot-list" aria-label="可拍分镜正文">${shotRows}</div>
    <div class="script-detail-meta">
      <div class="script-detail-meta-title">辅助信息：来源与拍摄前复核</div>
      <div class="script-source-grid">
        <p class="script-source"><b>来源热点</b>${escapeHtml(item.hot || item.source_trend_keyword || "品牌日常选题")}</p>
        <p class="script-source"><b>对标结构</b>${escapeHtml(item.account || item.source_benchmark_account || brandData.name)} / ${escapeHtml(item.pattern || item.source_pattern || "门店种草")}</p>
      </div>
      <div class="note-title">拍摄前复核</div>
      <div class="note-list">${notes.map((note) => `<span>${escapeHtml(note)}</span>`).join("")}</div>
    </div>
  `;
}

function parseOutlineShots(outline) {
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

render();
checkApiStatus();
loadGenerationReadiness();
