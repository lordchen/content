const LIBRARY_API_BASE = "http://127.0.0.1:8771";

const libraryStatus = document.getElementById("libraryApiStatus");
const libraryStats = document.getElementById("libraryStats");
const libraryList = document.getElementById("libraryList");
const libraryBulkBar = document.getElementById("libraryBulkBar");
const librarySelectedCount = document.getElementById("librarySelectedCount");
const libraryLearningPanel = document.getElementById("libraryLearningPanel");
const filterButtons = Array.from(document.querySelectorAll("[data-library-filter]"));

const initialLibraryParams = new URLSearchParams(window.location.search);
let currentFilter = initialLibraryParams.get("status") || "";
let currentItems = [];
const selectedScriptIds = new Set();

filterButtons.forEach((button) => {
  button.classList.toggle("active", (button.dataset.libraryFilter || "") === currentFilter);
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setLibraryFilter(button.dataset.libraryFilter || "");
  });
});

libraryLearningPanel?.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-learning-filter]");
  if (!actionButton) return;
  const filter = actionButton.dataset.learningFilter || "";
  const href = actionButton.dataset.learningHref || "";
  if (filter || href.includes("script-library.html")) {
    setLibraryFilter(filter);
  } else if (href) {
    window.location.href = href;
  }
});

function setLibraryFilter(filter) {
  currentFilter = filter || "";
  selectedScriptIds.clear();
  filterButtons.forEach((item) => item.classList.toggle("active", (item.dataset.libraryFilter || "") === currentFilter));
  if (window.history?.replaceState) {
    const params = new URLSearchParams(window.location.search);
    if (currentFilter) {
      params.set("status", currentFilter);
    } else {
      params.delete("status");
    }
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  }
  loadLibrary();
}

libraryList?.addEventListener("click", (event) => {
  const suggestionButton = event.target.closest("[data-library-review-suggestion]");
  if (suggestionButton) {
    applyLibraryReviewSuggestion(suggestionButton);
    return;
  }
  const selectControl = event.target.closest("[data-library-select]");
  if (selectControl) {
    syncSelectionFromCheckbox(selectControl);
    return;
  }
  const reviewButton = event.target.closest("[data-library-review]");
  if (reviewButton) {
    reviewLibraryScript(reviewButton);
    return;
  }
  const publishButton = event.target.closest("[data-library-publish]");
  if (publishButton) {
    publishLibraryScript(publishButton);
  }
});

libraryList?.addEventListener("change", (event) => {
  const selectControl = event.target.closest("[data-library-select]");
  if (selectControl) {
    syncSelectionFromCheckbox(selectControl);
  }
});

libraryBulkBar?.addEventListener("click", (event) => {
  const selectAllButton = event.target.closest("[data-library-select-all]");
  if (selectAllButton) {
    selectCurrentLibraryItems();
    return;
  }
  const clearButton = event.target.closest("[data-library-clear-selection]");
  if (clearButton) {
    selectedScriptIds.clear();
    renderLibrary(currentItems);
    updateBulkBar();
    return;
  }
  const bulkReviewButton = event.target.closest("[data-library-bulk-review]");
  if (bulkReviewButton) {
    reviewSelectedScripts(bulkReviewButton);
  }
});

loadLibrary();
loadReviewInsights();

async function loadLibrary() {
  setLibraryStatus("pending", "正在读取脚本库...");
  try {
    const response = await fetch(`${LIBRARY_API_BASE}/api/v2/script-library?status=${encodeURIComponent(currentFilter)}&limit=60`);
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    setLibraryStatus("online", `脚本库已连接：${data.items.length} 条`);
    currentItems = data.items || [];
    pruneSelection(currentItems);
    renderStats(data.stats || {});
    renderLibrary(currentItems);
    updateBulkBar();
  } catch (error) {
    setLibraryStatus("offline", `脚本库读取失败：${error.message}`);
  }
}

async function loadReviewInsights() {
  if (!libraryLearningPanel) return;
  try {
    const response = await fetch(`${LIBRARY_API_BASE}/api/v2/dashboard`);
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    renderReviewInsights(data.reviewInsights || {}, data.qualityLearningPlan || null);
  } catch (error) {
    libraryLearningPanel.innerHTML = `
      <div class="readiness-main blocked">
        <span>读取失败</span>
        <strong>复盘学习数据不可用</strong>
        <p>${escapeHtml(error.message)}</p>
      </div>
    `;
  }
}

function renderReviewInsights(insights, qualityPlan = null) {
  if (!libraryLearningPanel) return;
  const totals = insights.totals || {};
  const bestScripts = insights.bestScripts || [];
  const templates = insights.templates || [];
  const nextActions = insights.nextActions || [];
  const learningSignals = insights.learningSignals || {};
  const reuseSignals = learningSignals.reuseSignals || [];
  const avoidSignals = learningSignals.avoidSignals || [];
  const plan = qualityPlan || fallbackQualityLearningPlan(insights);
  const counts = plan.counts || {};
  const actionQueue = plan.actionQueue || [];
  const planReuseSignals = plan.reuseSignals || reuseSignals;
  const planAvoidSignals = plan.avoidSignals || avoidSignals;
  const noteLearning = plan.reviewNoteLearning || learningSignals.noteLearning || {};
  const noteCategories = noteLearning.categories || [];
  const best = bestScripts[0];
  libraryLearningPanel.innerHTML = `
    <div class="library-learning-head">
      <div>
        <span class="caption">QUALITY LEARNING CONTROL</span>
        <h3>质量学习控制面板</h3>
        <p>${escapeHtml(plan.summary || "把脚本审核、发布表现和模板标记变成下一轮生成可读取的输入。")}</p>
      </div>
      <a href="${escapeHtml(plan.nextHref || "./index.html?v=quality-learning-v1#stepGenerate")}">${escapeHtml(plan.nextAction || "带着复盘去生成")}</a>
    </div>
    <div class="learning-control-strip ${escapeHtml(plan.level || "partial")}">
      <div>
        <span>当前状态</span>
        <strong>${learningLevelText(plan.level)}</strong>
        <p>${escapeHtml(plan.generationImpact?.summary || "下一轮生成暂未读取到历史学习输入。")}</p>
      </div>
      <div>
        <span>生成会读取</span>
        <strong>${counts.templates || 0} 模板 / ${counts.reuseSignals || 0} 复用 / ${counts.avoidSignals || 0} 避坑 / ${counts.reviewNotesWithText || 0} 原因</strong>
        <p>${escapeHtml(plan.generationImpact?.rule || "依据审核状态、发布表现和模板标记形成学习信号。")}</p>
      </div>
    </div>
    <div class="library-learning-grid">
      <article>
        <span>已发布</span>
        <strong>${insights.publishedCount || 0}</strong>
        <p>有发布链接或表现数据的脚本</p>
      </article>
      <article>
        <span>优质模板</span>
        <strong>${insights.templateCount || 0}</strong>
        <p>后续生成会读取的模板</p>
      </article>
      <article>
        <span>播放 / 点赞 / 线索</span>
        <strong>${totals.views || 0} / ${totals.likes || 0} / ${totals.leads || 0}</strong>
        <p>当前已回填的表现总量</p>
      </article>
      <article>
        <span>审核原因覆盖</span>
        <strong>${counts.reviewNoteCoverage || 0}%</strong>
        <p>${escapeHtml(noteLearning.coverageLabel || "已审核脚本中写明原因的比例")}</p>
      </article>
    </div>
    <div class="learning-action-board">
      <article>
        <b>下一步先做什么</b>
        <div class="learning-action-list">
          ${actionQueue.length ? actionQueue.map((item) => learningActionHtml(item)).join("") : "<p>暂无待处理动作，可以进入下一轮生成。</p>"}
        </div>
      </article>
      <article>
        <b>学习规则</b>
        <ul>${(plan.rules || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </article>
    </div>
    <div class="library-learning-body">
      <article>
        <b>表现最好脚本</b>
        <strong>${escapeHtml(best?.title || "还没有可排序的发布脚本")}</strong>
        <p>${escapeHtml(best?.hook || "先回填发布表现，系统才能判断哪些结构值得复用。")}</p>
      </article>
      <article>
        <b>可复用模板</b>
        <p>${templates.length ? templates.map((item) => escapeHtml(item.title)).join("、") : "还没有模板。建议把高播放、高线索或可复用结构标记为模板。"}</p>
      </article>
      <article>
        <b>下一轮生成建议</b>
        <ul>${(nextActions.length ? nextActions : ["先回填至少 1 条发布表现。"]).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </article>
    </div>
    <div class="library-signal-grid">
      <article>
        <b>优先复用</b>
        ${signalListHtml(planReuseSignals, "还没有正向学习信号。先采用、发布或标记模板。")}
      </article>
      <article>
        <b>需要避开 / 改写</b>
        ${signalListHtml(planAvoidSignals, "还没有避坑信号。待改或弃用时补充原因。")}
      </article>
    </div>
    <div class="review-note-learning">
      <div>
        <b>审核原因主题</b>
        <p>${escapeHtml(noteLearning.summary || "审核原因越完整，下一轮生成的复用和避坑越稳定。")}</p>
      </div>
      <div class="review-note-category-list">
        ${noteCategories.length ? noteCategories.map((item) => `
          <span>
            <strong>${escapeHtml(item.label || "原因")}</strong>
            ${Number(item.total || 0)} 条 · 采用 ${Number(item.adopted || 0)} / 待改 ${Number(item.needsEdit || 0)} / 弃用 ${Number(item.rejected || 0)}
          </span>
        `).join("") : "<span><strong>暂无原因主题</strong>先给已审核脚本补原因。</span>"}
      </div>
    </div>
  `;
}

function fallbackQualityLearningPlan(insights) {
  const signals = insights.learningSignals || {};
  return {
    level: insights.templateCount || insights.publishedCount ? "partial" : "needs_review",
    summary: "当前接口未返回质量学习控制数据，先展示基础复盘洞察。",
    nextAction: "带着复盘去生成",
    nextHref: "./index.html?v=quality-learning-v1#stepGenerate",
    counts: {
      published: insights.publishedCount || 0,
      templates: insights.templateCount || 0,
      reuseSignals: (signals.reuseSignals || []).length,
      avoidSignals: (signals.avoidSignals || []).length,
    },
    generationImpact: {
      summary: "下一轮生成会读取优质模板和复盘反馈。",
      rule: "反馈来自当前 reviewInsights。",
    },
    actionQueue: [],
    rules: [],
  };
}

function learningLevelText(level) {
  return {
    ready: "可反哺生成",
    partial: "部分可用",
    needs_review: "先做审核",
    needs_publish: "缺发布表现",
    needs_templates: "缺模板沉淀",
    empty: "缺历史样本",
  }[level] || "部分可用";
}

function learningActionHtml(item) {
  const href = item.href || `./script-library.html?v=quality-learning-v1${item.filter ? `&status=${encodeURIComponent(item.filter)}` : ""}`;
  return `
    <div class="learning-action-item ${escapeHtml(item.priority || "medium")}">
      <div>
        <strong>${escapeHtml(item.title || "待处理动作")}</strong>
        <span>${Number(item.count || 0)} 条</span>
        <p>${escapeHtml(item.description || "")}</p>
      </div>
      <button type="button" data-learning-filter="${escapeHtml(item.filter || "")}" data-learning-href="${escapeHtml(href)}">${escapeHtml(item.action || "去处理")}</button>
    </div>
  `;
}

function signalListHtml(items, emptyText) {
  if (!items.length) return `<p>${escapeHtml(emptyText)}</p>`;
  return `
    <div class="library-signal-list">
      ${items.slice(0, 4).map((item) => `
        <span>
          <strong>${escapeHtml(item.label || "未命名信号")}</strong>
          <small>${escapeHtml(item.evidence || "")}</small>
          <em>${escapeHtml(item.action || "")}</em>
        </span>
      `).join("")}
    </div>
  `;
}

function renderStats(stats) {
  if (!libraryStats) return;
  const items = [
    ["总脚本", stats.total || 0],
    ["已采用", stats.adopted || 0],
    ["待改", stats.needsEdit || 0],
    ["弃用", stats.rejected || 0],
    ["已发布", stats.published || 0],
    ["模板", stats.templates || 0],
  ];
  libraryStats.innerHTML = items.map(([label, value]) => `
    <article>
      <span>${label}</span>
      <strong>${value}</strong>
    </article>
  `).join("");
}

function renderLibrary(items) {
  if (!libraryList) return;
  libraryList.innerHTML = items.length
    ? items.map((item) => libraryCardHtml(item)).join("")
    : `<article class="library-card"><strong>暂无脚本</strong><p>当前筛选条件下没有脚本。</p></article>`;
  updateBulkBar();
}

function libraryCardHtml(item) {
  const quality = item.quality || {};
  const performance = item.performance || {};
  const inputStructures = item.inputStructures || item.input_structures || [];
  const inputProducts = item.inputProducts || item.input_products || [];
  const inputTemplates = item.inputTemplates || item.input_templates || [];
  const inputFeedback = item.inputFeedback || item.input_feedback || [];
  const inputTopics = item.inputTopics || item.input_topics || [];
  const templateChecked = item.isTemplate ? "checked" : "";
  const selected = selectedScriptIds.has(String(item.id));
  return `
    <article class="library-card ${selected ? "selected" : ""}">
      <div class="library-card-head">
        <label class="library-select-control">
          <input type="checkbox" data-library-select="${item.id}" ${selected ? "checked" : ""} />
          <span>选择</span>
        </label>
        <div class="library-card-title">
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(item.hook || "无开头")}</p>
        </div>
        <span>${quality.overall ? `质量 ${quality.overall}` : "未评分"}</span>
      </div>
      <div class="library-tags">
        <em>审核：${reviewStatusText(item.reviewStatus)}</em>
        <em>质量：${qualityStatusText(item.qualityStatus)}</em>
        <em>改写：${item.rewriteCount || 0}</em>
        ${item.isTemplate ? "<em>优质模板</em>" : ""}
      </div>
      ${libraryQualityDiagnosisHtml(quality, inputStructures, inputProducts, inputTemplates)}
      <p class="library-source">热点：${escapeHtml(item.sourceTrendKeyword || "品牌日常")} / 结构：${escapeHtml(item.sourcePattern || "门店种草")}</p>
      ${inputTopics.length ? `<p class="library-source topic-source">采用选题：${inputTopics.map((topic) => escapeHtml(topic.title || "未命名选题")).join("、")}</p>` : ""}
      ${inputStructures.length ? `<p class="library-source structure-source">结构输入：${inputStructures.map((structure) => escapeHtml(structure.title || "未命名结构")).join("、")}</p>` : ""}
      ${inputProducts.length ? `<p class="library-source product-source">商品输入：${inputProducts.map((product) => escapeHtml(product.productName || "未命名商品")).join("、")}</p>` : ""}
      ${inputTemplates.length ? `<p class="library-source template-source">生成参考模板：${inputTemplates.map((template) => escapeHtml(template.title || "未命名模板")).join("、")}</p>` : ""}
      ${inputFeedback.length ? `<p class="library-source feedback-source">生成读取复盘：${inputFeedback.slice(0, 3).map(feedbackSignalLabel).join("；")}</p>` : ""}
      ${item.reviewNote ? `<p class="library-source review-note-source">审核原因：${escapeHtml(item.reviewNote)}</p>` : ""}
      ${libraryInputEvidenceHtml(inputStructures, inputProducts, inputTemplates, inputFeedback, inputTopics)}
      <div class="library-performance">
        <span>发布：${item.publishUrl ? `<a href="${escapeHtml(item.publishUrl)}" target="_blank">查看链接</a>` : "未发布"}</span>
        <span>播放 ${performance.views || 0}</span>
        <span>点赞 ${performance.likes || 0}</span>
        <span>评论 ${performance.comments || 0}</span>
        <span>分享 ${performance.shares || 0}</span>
        <span>线索 ${performance.leads || 0}</span>
      </div>
      <details class="script-detail">
        <summary>查看可拍分镜脚本</summary>
        ${libraryShootingScriptHtml(item)}
      </details>
      <div class="library-actions">
        <label class="review-note-input">
          <span>审核原因</span>
          <textarea data-library-review-note="${item.id}" rows="2" placeholder="写清楚为什么采用、待改或弃用">${escapeHtml(item.reviewNote || "")}</textarea>
        </label>
        <div class="review-note-suggestions">
          ${reviewSuggestionButtons(item.id)}
        </div>
        <button type="button" data-library-review="adopted" data-script-id="${item.id}">采用</button>
        <button type="button" data-library-review="needs_edit" data-script-id="${item.id}">待改</button>
        <button type="button" data-library-review="rejected" data-script-id="${item.id}">弃用</button>
      </div>
      <div class="library-publish">
        <label>
          <span>发布链接</span>
          <input type="url" placeholder="https://v.douyin.com/..." data-publish-url="${item.id}" value="${escapeHtml(item.publishUrl || "")}" />
        </label>
        <label>
          <span>播放</span>
          <input type="number" min="0" placeholder="0" data-publish-views="${item.id}" value="${performance.views || ""}" />
        </label>
        <label>
          <span>点赞</span>
          <input type="number" min="0" placeholder="0" data-publish-likes="${item.id}" value="${performance.likes || ""}" />
        </label>
        <label>
          <span>评论</span>
          <input type="number" min="0" placeholder="0" data-publish-comments="${item.id}" value="${performance.comments || ""}" />
        </label>
        <label>
          <span>线索</span>
          <input type="number" min="0" placeholder="0" data-publish-leads="${item.id}" value="${performance.leads || ""}" />
        </label>
        <label class="library-template-toggle">
          <input type="checkbox" data-publish-template="${item.id}" ${templateChecked} />
          <span>沉淀为模板</span>
        </label>
        <button type="button" data-library-publish data-script-id="${item.id}">保存发布表现</button>
      </div>
    </article>
  `;
}

function feedbackSignalLabel(item) {
  const type = item.type === "avoid" ? "避开" : "复用";
  const label = item.label || item.pattern || item.title || "未命名信号";
  const action = item.action || item.evidence || "";
  return `${type}「${escapeHtml(label)}」${action ? `：${escapeHtml(action)}` : ""}`;
}

function libraryInputEvidenceHtml(inputStructures = [], inputProducts = [], inputTemplates = [], inputFeedback = [], inputTopics = []) {
  const hasEvidence = inputStructures.length || inputProducts.length || inputTemplates.length || inputFeedback.length || inputTopics.length;
  if (!hasEvidence) return "";
  return `
    <details class="script-input-detail library-input-detail">
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

function platformLabel(value) {
  return {
    douyin: "抖音",
    xhs: "小红书",
    manual: "手工素材",
    third_party: "第三方",
  }[value] || value || "未知平台";
}

function libraryQualityDiagnosisHtml(quality, inputStructures = [], inputProducts = [], inputTemplates = []) {
  const diagnosis = normalizeLibraryQualityDiagnosis(quality, inputStructures, inputProducts, inputTemplates);
  if (!diagnosis) return "";
  const weakItems = Array.isArray(diagnosis.weakDimensions) ? diagnosis.weakDimensions : [];
  const strongItems = Array.isArray(diagnosis.strongDimensions) ? diagnosis.strongDimensions : [];
  return `
    <div class="quality-diagnosis library-quality-diagnosis">
      <div class="quality-diagnosis-head">
        <span>QUALITY DIAGNOSIS</span>
        <strong>${escapeHtml(diagnosis.summary || "质量诊断待补充")}</strong>
      </div>
      <div class="quality-diagnosis-grid">
        <section>
          <b>强项</b>
          ${strongItems.length ? strongItems.slice(0, 3).map((item) => `<em>${escapeHtml(typeof item === "string" ? item : item.dimension || item.label || "")}</em>`).join("") : "<p>暂无明显强项。</p>"}
        </section>
        <section>
          <b>改写方向</b>
          ${weakItems.length ? weakItems.slice(0, 2).map((item) => `<p><strong>${escapeHtml(item.dimension || "待改")}</strong>${escapeHtml(item.action || item.reason || "")}</p>`).join("") : `<p><strong>${escapeHtml(diagnosis.rewriteFocus || "保持结构")}</strong>${escapeHtml(diagnosis.rewritePrompt || "补真实镜头和商品权益。")}</p>`}
        </section>
        <section>
          <b>建议</b>
          <p>${escapeHtml(diagnosis.rewritePrompt || "发布前复核商品活动和门店口径。")}</p>
        </section>
      </div>
    </div>
  `;
}

function normalizeLibraryQualityDiagnosis(quality, inputStructures = [], inputProducts = [], inputTemplates = []) {
  if (!quality?.overall && !quality?.diagnosis) return null;
  const diagnosis = quality?.diagnosis || {};
  if (diagnosis.summary || diagnosis.weakDimensions || diagnosis.strongDimensions) return diagnosis;
  const scores = quality?.scores || {};
  const weakDimensions = [];
  if (scores.conversion && scores.conversion < 78) weakDimensions.push({ dimension: "转化", action: "补 CTA、团购权益和到店动作。" });
  if (scores.hook && scores.hook < 78) weakDimensions.push({ dimension: "开头", action: "改成用户问题或热点反差。" });
  return {
    summary: (quality?.reasons || [])[0] || "历史脚本质量可用，建议结合发布表现复核。",
    strongDimensions: [
      inputStructures.length ? "结构输入" : "",
      inputProducts.length ? "商品输入" : "",
      inputTemplates.length ? "模板输入" : "",
    ].filter(Boolean),
    weakDimensions,
    rewriteFocus: weakDimensions[0]?.dimension || "复核发布表现",
    rewritePrompt: weakDimensions[0]?.action || "结合播放、点赞和线索回填，判断是否沉淀为模板。",
  };
}

function syncSelectionFromCheckbox(checkbox) {
  const id = String(checkbox.dataset.librarySelect || "");
  if (!id) return;
  if (checkbox.checked) {
    selectedScriptIds.add(id);
  } else {
    selectedScriptIds.delete(id);
  }
  checkbox.closest(".library-card")?.classList.toggle("selected", checkbox.checked);
  updateBulkBar();
}

function selectCurrentLibraryItems() {
  currentItems.forEach((item) => selectedScriptIds.add(String(item.id)));
  renderLibrary(currentItems);
  updateBulkBar();
}

function pruneSelection(items) {
  const availableIds = new Set(items.map((item) => String(item.id)));
  Array.from(selectedScriptIds).forEach((id) => {
    if (!availableIds.has(id)) selectedScriptIds.delete(id);
  });
}

function updateBulkBar() {
  const selectedCount = selectedScriptIds.size;
  if (librarySelectedCount) {
    librarySelectedCount.textContent = `已选 ${selectedCount} 条`;
  }
  libraryBulkBar?.classList.toggle("has-selection", selectedCount > 0);
  document.querySelectorAll("[data-library-bulk-review], [data-library-clear-selection]").forEach((button) => {
    button.disabled = selectedCount === 0;
  });
  document.querySelectorAll("[data-library-select-all]").forEach((button) => {
    button.disabled = currentItems.length === 0;
  });
}

async function reviewLibraryScript(button) {
  const id = button.dataset.scriptId;
  const reviewStatus = button.dataset.libraryReview;
  if (!id || !reviewStatus) return;
  const reviewNote = libraryReviewNoteForScript(id, reviewStatus);
  button.disabled = true;
  try {
    const response = await fetch(`${LIBRARY_API_BASE}/api/v2/script-candidates/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewStatus, reviewNote }),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    selectedScriptIds.delete(String(id));
    await loadLibrary();
  } catch (error) {
    setLibraryStatus("offline", `审核失败：${error.message}`);
    button.disabled = false;
  }
}

function libraryReviewNoteForScript(id, reviewStatus) {
  const input = document.querySelector(`[data-library-review-note="${id}"]`);
  return (input?.value || "").trim() || defaultReviewNote(reviewStatus);
}

function reviewSuggestionButtons(scriptId) {
  const suggestions = [
    ["可拍执行清楚", "运营采用：分镜可执行，口播和字幕能直接进入拍摄。"],
    ["开头弱待改", "运营待改：前 3 秒吸引力不足，需要重写开头和冲突点。"],
    ["转化弱待改", "运营待改：商品权益和 CTA 不够具体，需要补进店/团购动作。"],
    ["品牌不贴合", "运营弃用：热点或表达不贴合当前品牌和门店活动。"],
  ];
  return suggestions.map(([label, value]) => `
    <button type="button" data-library-review-suggestion="${escapeHtml(value)}" data-library-review-suggestion-target="${scriptId}">${escapeHtml(label)}</button>
  `).join("");
}

function applyLibraryReviewSuggestion(button) {
  const targetId = button.dataset.libraryReviewSuggestionTarget;
  const input = targetId ? document.querySelector(`[data-library-review-note="${targetId}"]`) : null;
  if (input) input.value = button.dataset.libraryReviewSuggestion || "";
}

async function reviewSelectedScripts(button) {
  const reviewStatus = button.dataset.libraryBulkReview;
  const ids = Array.from(selectedScriptIds);
  if (!reviewStatus || !ids.length) return;
  const actionText = reviewStatusText(reviewStatus);
  setLibraryBulkDisabled(true);
  setLibraryStatus("pending", `正在批量标记 ${ids.length} 条为：${actionText}...`);
  const results = await Promise.allSettled(ids.map((id) => postReviewStatus(id, reviewStatus)));
  const succeededIds = ids.filter((_, index) => results[index].status === "fulfilled");
  const failedCount = results.length - succeededIds.length;
  succeededIds.forEach((id) => selectedScriptIds.delete(String(id)));
  await loadLibrary();
  if (failedCount) {
    const firstError = results.find((result) => result.status === "rejected")?.reason?.message || "未知错误";
    setLibraryStatus("offline", `批量审核完成：成功 ${succeededIds.length} 条，失败 ${failedCount} 条。首个失败原因：${firstError}`);
  } else {
    setLibraryStatus("online", `批量审核完成：${succeededIds.length} 条已标记为${actionText}`);
  }
  setLibraryBulkDisabled(false);
  updateBulkBar();
}

async function postReviewStatus(id, reviewStatus) {
  const response = await fetch(`${LIBRARY_API_BASE}/api/v2/script-candidates/${id}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reviewStatus, reviewNote: defaultReviewNote(reviewStatus) }),
  });
  const data = await response.json();
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return data;
}

function defaultReviewNote(reviewStatus) {
  return {
    adopted: "运营采用：结构清晰，可进入发布或模板复盘。",
    needs_edit: "运营待改：需要优化开头、镜头执行或转化 CTA。",
    rejected: "运营弃用：不适合当前品牌/活动，后续降低相似结构权重。",
    new: "",
  }[reviewStatus] || "";
}

function setLibraryBulkDisabled(disabled) {
  document.querySelectorAll("[data-library-bulk-review], [data-library-select-all], [data-library-clear-selection]").forEach((button) => {
    button.disabled = disabled;
  });
}

async function publishLibraryScript(button) {
  const id = button.dataset.scriptId;
  if (!id) return;
  const publishUrl = document.querySelector(`[data-publish-url="${id}"]`)?.value.trim() || "";
  const views = Number(document.querySelector(`[data-publish-views="${id}"]`)?.value || 0);
  const likes = Number(document.querySelector(`[data-publish-likes="${id}"]`)?.value || 0);
  const comments = Number(document.querySelector(`[data-publish-comments="${id}"]`)?.value || 0);
  const leads = Number(document.querySelector(`[data-publish-leads="${id}"]`)?.value || 0);
  const isTemplate = Boolean(document.querySelector(`[data-publish-template="${id}"]`)?.checked);
  button.disabled = true;
  try {
    const response = await fetch(`${LIBRARY_API_BASE}/api/v2/script-candidates/${id}/publish-result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publishUrl,
        isTemplate: isTemplate || views >= 1000 || likes >= 50 || leads > 0,
        performance: { views, likes, comments, shares: 0, leads },
      }),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    await loadLibrary();
  } catch (error) {
    setLibraryStatus("offline", `发布表现保存失败：${error.message}`);
    button.disabled = false;
  }
}

function setLibraryStatus(state, message) {
  if (!libraryStatus) return;
  libraryStatus.textContent = message;
  libraryStatus.className = `api-status ${state}`;
}

function qualityStatusText(value) {
  return {
    passed: "通过",
    needs_rewrite: "需改写",
    blocked: "阻塞",
    unscored: "未评分",
  }[value] || value || "未知";
}

function reviewStatusText(value) {
  return {
    new: "新脚本",
    adopted: "已采用",
    rejected: "已弃用",
    needs_edit: "待修改",
  }[value] || value || "未知";
}

function libraryShootingScriptHtml(item) {
  const shots = parseLibraryOutlineShots(item.outline || "");
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
    item.fitReason || "优先保留真实门店镜头和商品卖点",
  ].filter(Boolean);
  return `
    <div class="shot-guide">
      <b>按拍摄顺序执行</b>
      <span>脚本库展示的是已入库脚本正文；每张卡片对应一段拍摄动作、口播和字幕。</span>
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

function parseLibraryOutlineShots(outline) {
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
