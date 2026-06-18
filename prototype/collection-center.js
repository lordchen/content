const COLLECTION_API_BASE = "http://127.0.0.1:8771";

const collectionStatus = document.getElementById("collectionApiStatus");
const collectionTaskList = document.getElementById("collectionTaskList");
const collectionPlanList = document.getElementById("collectionPlanList");
const collectionHubPanel = document.getElementById("collectionHubPanel");
const collectionGuaranteePanel = document.getElementById("collectionGuaranteePanel");
const collectionFallbackSwitcherPanel = document.getElementById("collectionFallbackSwitcherPanel");
const collectionP01PackagePanel = document.getElementById("collectionP01PackagePanel");
const collectionP01VerifierPanel = document.getElementById("collectionP01VerifierPanel");
const dataSourceMatrixPanel = document.getElementById("dataSourceMatrixPanel");
const collectionActionFlowPanel = document.getElementById("collectionActionFlowPanel");
const collectionFallbackDeskPanel = document.getElementById("collectionFallbackDeskPanel");
const collectionTracePanel = document.getElementById("collectionTracePanel");
const collectionDailyReviewPanel = document.getElementById("collectionDailyReviewPanel");
const collectionHandoffList = document.getElementById("collectionHandoffList");
const categoryQueries = document.getElementById("categoryQueries");

document.addEventListener("click", (event) => {
  const runButton = event.target.closest("[data-run-collection]");
  if (runButton) runCollectionTask(runButton);
  const refreshVerifierButton = event.target.closest("[data-refresh-p01-verifier]");
  if (refreshVerifierButton) refreshP01Verifier(refreshVerifierButton);
  const copyHandoffButton = event.target.closest("[data-copy-handoff]");
  if (copyHandoffButton) copyCollectionHandoff(copyHandoffButton);
  const processHandoffButton = event.target.closest("[data-process-handoff]");
  if (processHandoffButton) updateCollectionHandoffProcess(processHandoffButton);
});
collectionPlanList?.addEventListener("click", (event) => {
  const saveButton = event.target.closest("[data-save-schedule]");
  if (saveButton) {
    saveCollectionSchedule(saveButton);
    return;
  }
  const runButton = event.target.closest("[data-run-schedule]");
  if (runButton) runCollectionSchedule(runButton);
});

loadCollectionGuarantee();
loadCollectionSchedules();
loadCollectionTasks();

async function loadCollectionGuarantee(options = {}) {
  if (!collectionGuaranteePanel) return;
  const { reason = "", button = null } = options;
  if (reason === "p01_recheck" && collectionP01VerifierPanel) {
    collectionP01VerifierPanel.innerHTML = `
      <article class="collection-guarantee-loading">
        <strong>正在重新读取 P0-1 库表证据...</strong>
        <p>这次复核只请求 dashboard，不写入素材、不生成脚本。系统会重新判断 sourceId、文本、selected、structure_done 和候选脚本引用。</p>
      </article>
    `;
  }
  if (button) {
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.textContent = "复核中...";
  }
  try {
    const response = await fetch(`${COLLECTION_API_BASE}/api/v2/dashboard`);
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    renderCollectionGuaranteeHub(data.collectionGuaranteeHub);
    renderCollectionFallbackSwitcher(data.collectionFallbackSwitcher);
    renderCollectionP01Package(data.firstBenchmarkMaterialPlan, data.collectionFallbackSwitcher);
    renderCollectionP01Verifier(data.p01AcceptanceVerifier);
    renderCollectionGuarantee(data.collectionStrategy);
    renderDataSourceMatrix(data.dataSourceMatrix);
    renderCollectionActionFlow(data.collectionActionFlow);
    renderCollectionFallbackDesk(data.collectionFallbackDesk);
    renderCollectionFallbackTrace(data.collectionFallbackTrace);
    renderCollectionDailyReview(data.collectionDailyReview);
    renderCollectionHandoffs(data.operationHandoffs || []);
    if (reason === "p01_recheck" && collectionStatus) {
      const verifier = data.p01AcceptanceVerifier || {};
      collectionStatus.className = "api-status online";
      collectionStatus.textContent = `P0-1 已复核：${verifier.levelLabel || "待判断"}，${verifier.counts?.passed || 0}/${verifier.counts?.total || 5} 项通过`;
    }
  } catch (error) {
    collectionGuaranteePanel.innerHTML = `
      <article class="collection-guarantee-loading failed">
        <strong>采集保障读取失败</strong>
        <p>${escapeHtml(error.message)}</p>
      </article>
    `;
    if (collectionHubPanel) {
      collectionHubPanel.innerHTML = `
        <article class="collection-guarantee-loading failed">
          <strong>采集保障中枢读取失败</strong>
          <p>${escapeHtml(error.message)}</p>
        </article>
      `;
    }
    if (collectionP01VerifierPanel) {
      collectionP01VerifierPanel.innerHTML = `
        <article class="collection-guarantee-loading failed">
          <strong>P0-1 验收器读取失败</strong>
          <p>${escapeHtml(error.message)}</p>
        </article>
      `;
    }
    if (dataSourceMatrixPanel) {
      dataSourceMatrixPanel.innerHTML = `
        <article class="collection-guarantee-loading failed">
          <strong>数据源状态读取失败</strong>
          <p>${escapeHtml(error.message)}</p>
        </article>
      `;
    }
    if (collectionFallbackSwitcherPanel) {
      collectionFallbackSwitcherPanel.innerHTML = `
        <article class="collection-guarantee-loading failed">
          <strong>采集替代方案读取失败</strong>
          <p>${escapeHtml(error.message)}</p>
        </article>
      `;
    }
    if (collectionActionFlowPanel) {
      collectionActionFlowPanel.innerHTML = `
        <article class="collection-guarantee-loading failed">
          <strong>任务流读取失败</strong>
          <p>${escapeHtml(error.message)}</p>
        </article>
      `;
    }
    if (collectionP01PackagePanel) {
      collectionP01PackagePanel.innerHTML = `
        <article class="collection-guarantee-loading failed">
          <strong>P0-1 补录包读取失败</strong>
          <p>${escapeHtml(error.message)}</p>
        </article>
      `;
    }
    if (collectionFallbackDeskPanel) {
      collectionFallbackDeskPanel.innerHTML = `
        <article class="collection-guarantee-loading failed">
          <strong>兜底执行台读取失败</strong>
          <p>${escapeHtml(error.message)}</p>
        </article>
      `;
    }
    if (collectionTracePanel) {
      collectionTracePanel.innerHTML = `
        <article class="collection-guarantee-loading failed">
          <strong>兜底追溯链路读取失败</strong>
          <p>${escapeHtml(error.message)}</p>
        </article>
      `;
    }
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = button.dataset.originalText || "重新读取库表证据";
      delete button.dataset.originalText;
    }
  }
}

function refreshP01Verifier(button) {
  loadCollectionGuarantee({ reason: "p01_recheck", button });
}

function renderCollectionP01Package(plan, switcher) {
  if (!collectionP01PackagePanel) return;
  const target = plan?.targetAccount || {};
  const readiness = plan?.readiness || {};
  const counts = plan?.counts || {};
  const steps = Array.isArray(plan?.steps) ? plan.steps : [];
  const fallbackPaths = Array.isArray(switcher?.paths) ? switcher.paths : [];
  const benchmarkPath = fallbackPaths.find((path) => path.key === "benchmark_account");
  const paths = benchmarkPath
    ? [benchmarkPath, ...fallbackPaths.filter((path) => path.key !== "benchmark_account")]
    : fallbackPaths;
  if (!plan?.version) {
    collectionP01PackagePanel.innerHTML = `
      <article class="collection-guarantee-loading">
        <strong>暂无 P0-1 补录包</strong>
        <p>先读取 V2 首页的首条真实账号素材计划，再把采集替代路径收束到当前账号。</p>
      </article>
    `;
    return;
  }
  collectionP01PackagePanel.innerHTML = `
    <article class="collection-p01-primary ${escapeHtml(plan.level || "blocked")}">
      <div>
        <span>${escapeHtml(plan.levelLabel || "P0-1")}</span>
        <strong>${escapeHtml(target.accountName || "固定对标账号")}：今天先补 1 条真实近期内容</strong>
        <p>${escapeHtml(plan.summary || readiness.summary || "用真实链接、字幕或第三方表格补齐首条对标素材。")}</p>
      </div>
      <a href="${escapeHtml(plan.nextHref || benchmarkPath?.href || "./content-pool.html#manual-import")}">${escapeHtml(plan.nextAction || benchmarkPath?.action || "导入这个账号近期内容")}</a>
    </article>
    <div class="collection-p01-metrics">
      <span><b>目标账号</b>${escapeHtml(target.accountName || "未指定")}</span>
      <span><b>今日导入</b>${Number(counts.imported || 0)}</span>
      <span><b>有文本</b>${Number(counts.withText || 0)}</span>
      <span><b>已结构化</b>${Number(counts.structured || 0)}</span>
      <span><b>可生成</b>${Number(counts.ready || 0)}/${Number(counts.target || readiness.targetCount || 1)}</span>
    </div>
    <div class="collection-p01-paths">
      ${paths.map((path) => `
        <a class="${escapeHtml(path.status || "available")} ${path.key === "benchmark_account" ? "primary" : ""}" href="${escapeHtml(path.href || "#")}">
          <span>${escapeHtml(path.label || "兜底路径")}</span>
          <strong>${escapeHtml(path.title || "补齐真实素材")}</strong>
          <p>${escapeHtml(path.when || "自动采集不可用时。")}</p>
          <em>${escapeHtml(path.action || "去处理")}</em>
        </a>
      `).join("")}
    </div>
    <div class="collection-p01-steps">
      ${steps.map((step, index) => `
        <article class="${escapeHtml(step.status || "waiting")}">
          <em>${String(index + 1).padStart(2, "0")}</em>
          <strong>${escapeHtml(step.label || "步骤")}</strong>
          <p>${escapeHtml(step.evidence || step.action || "")}</p>
        </article>
      `).join("")}
    </div>
    <div class="collection-p01-rules">
      ${(plan.blockedRules || []).map((rule) => `<span>${escapeHtml(rule)}</span>`).join("")}
    </div>
  `;
}

function renderCollectionP01Verifier(verifier) {
  if (!collectionP01VerifierPanel) return;
  const checks = Array.isArray(verifier?.checks) ? verifier.checks : [];
  const candidateDetails = Array.isArray(verifier?.candidateSourcesDetail) ? verifier.candidateSourcesDetail : [];
  const counts = verifier?.counts || {};
  const target = verifier?.targetAccount || {};
  if (!verifier?.version) {
    collectionP01VerifierPanel.innerHTML = `
      <article class="collection-guarantee-loading">
        <strong>暂无 P0-1 验收器</strong>
        <p>等待后端返回逐项验收证据，确认真实素材是否进入候选脚本输入。</p>
      </article>
    `;
    return;
  }
  collectionP01VerifierPanel.innerHTML = `
    <article class="collection-p01-verifier ${escapeHtml(verifier.level || "blocked")}">
      <div class="collection-p01-verifier-head">
        <div>
          <span>${escapeHtml(verifier.levelLabel || "P0-1 验收")}</span>
          <strong>${escapeHtml(target.accountName || "固定对标账号")}真实闭环验收器</strong>
          <p>${escapeHtml(verifier.summary || "逐项校验真实素材、文本、加入生成、结构摘要和候选脚本读取证据。")}</p>
        </div>
        <div class="collection-p01-verifier-actions">
          <a href="${escapeHtml(verifier.nextHref || "#")}">${escapeHtml(verifier.nextAction || "处理下一步")}</a>
          <button type="button" data-refresh-p01-verifier>重新读取库表证据</button>
        </div>
      </div>
      <div class="collection-p01-verifier-recheck">
        <b>复核口径</b>
        <span>点击复核只重新读取真实库表，不创建素材、不生成脚本、不把示例/测试/占位数据计入验收。</span>
      </div>
      <div class="collection-p01-verifier-counts">
        <span><b>已通过</b>${Number(counts.passed || 0)}/${Number(counts.total || checks.length || 0)}</span>
        <span><b>等待</b>${Number(counts.waiting || 0)}</span>
        <span><b>阻塞</b>${Number(counts.blocked || 0)}</span>
        <span><b>真实候选素材</b>${Number(counts.candidateSources || 0)}</span>
        <span><b>排除素材</b>${Number(counts.excluded || 0)}</span>
      </div>
      <div class="collection-p01-verifier-checks">
        ${checks.map((check, index) => `
          <article class="${escapeHtml(check.status || "blocked")}">
            <div>
              <em>${String(index + 1).padStart(2, "0")}</em>
              <span>${escapeHtml(check.statusLabel || check.status || "待判断")}</span>
            </div>
            <strong>${escapeHtml(check.label || "验收项")}</strong>
            <p>${escapeHtml(check.evidence || "")}</p>
            ${check.sourceId ? `<small>sourceId: ${escapeHtml(check.sourceId)}</small>` : ""}
            <a href="${escapeHtml(check.href || "#")}">${escapeHtml(check.action || "查看")}</a>
          </article>
        `).join("")}
      </div>
      ${p01CandidateSourcesHtml(candidateDetails, target)}
      ${Array.isArray(verifier.excludedSamples) && verifier.excludedSamples.length ? `
        <div class="collection-p01-verifier-excluded">
          <b>不计入验收的素材</b>
          ${verifier.excludedSamples.map((item) => `<span>#${escapeHtml(item.sourceId)} ${escapeHtml(item.title || "未命名")}：${escapeHtml(item.reason || "")}</span>`).join("")}
        </div>
      ` : ""}
      <p class="collection-p01-verifier-rule">${escapeHtml(verifier.rule || "")}</p>
    </article>
  `;
}

function p01CandidateSourcesHtml(items = [], target = {}) {
  if (!items.length) {
    return `
      <div class="collection-p01-candidates empty">
        <div>
          <span>SOURCE TRACE</span>
          <strong>当前没有可追踪的真实素材 sourceId</strong>
          <p>目标账号「${escapeHtml(target.accountName || "固定对标账号")}」还没有真实运营素材入库。补真实链接、字幕或第三方表格后，这里会逐条显示 sourceId 当前卡点。</p>
        </div>
      </div>
    `;
  }
  return `
    <div class="collection-p01-candidates">
      <div class="collection-p01-candidates-head">
        <div>
          <span>SOURCE TRACE</span>
          <strong>${items.length} 条真实素材逐条追踪</strong>
          <p>每条素材必须走完：入库、文本、加入生成、结构摘要、候选脚本引用。这里显示当前 sourceId 卡在哪一步。</p>
        </div>
      </div>
      <div class="collection-p01-candidate-list">
        ${items.map((item) => `
          <article class="${escapeHtml(item.nextStatus || "needs_text")}">
            <div class="collection-p01-candidate-main">
              <b>#${escapeHtml(item.sourceId || "待核对")}</b>
              <div>
                <strong>${escapeHtml(item.title || "未命名素材")}</strong>
                <p>${escapeHtml(item.accountName || target.accountName || "固定对标账号")}</p>
              </div>
              <em>${escapeHtml(item.nextLabel || "待处理")}</em>
            </div>
            <div class="collection-p01-candidate-facts">
              <span>文本 ${Number(item.textLength || 0)} 字</span>
              <span>${item.selected ? "已加入生成" : "未加入生成"}</span>
              <span>${item.structured ? "structure_done" : (item.structureStatus || "未结构化")}</span>
              <span>${item.linkedScript?.id ? `脚本 #${escapeHtml(item.linkedScript.id)}` : "未被脚本引用"}</span>
            </div>
            <p>${escapeHtml(item.nextEvidence || "等待下一步处理。")}</p>
            <a href="${escapeHtml(item.nextHref || "#")}">${escapeHtml(item.nextAction || "处理这条素材")}</a>
          </article>
        `).join("")}
      </div>
    </div>
  `;
}

function renderCollectionGuaranteeHub(hub) {
  if (!collectionHubPanel) return;
  const lanes = Array.isArray(hub?.laneCards) ? hub.laneCards : [];
  const rules = Array.isArray(hub?.switchRules) ? hub.switchRules : [];
  const principles = Array.isArray(hub?.principles) ? hub.principles : [];
  const decision = hub?.decisionEngine || {};
  if (!hub?.version) {
    collectionHubPanel.innerHTML = `
      <article class="collection-guarantee-loading">
        <strong>暂无采集保障中枢数据</strong>
        <p>先读取 dashboard，系统会把采集状态、数据源矩阵和兜底任务流汇总成一个决策入口。</p>
      </article>
    `;
    return;
  }
  collectionHubPanel.innerHTML = `
    <article class="collection-hub-primary ${escapeHtml(hub.mode || "needs_input")}">
      <div>
        <span>${escapeHtml(hub.modeLabel || "待判断")}</span>
        <strong>${escapeHtml(hub.summary || "等待采集保障判断")}</strong>
        <p>${escapeHtml(hub.activeStep?.reason || hub.activeFallback?.evidence || "根据真实数据源状态选择下一步。")}</p>
      </div>
      <a href="${escapeHtml(hub.nextHref || "#")}">${escapeHtml(hub.nextAction || "执行下一步")}</a>
    </article>
    ${decision.version ? collectionDecisionEngineHtml(decision) : ""}
    <div class="collection-hub-counts">
      <article><span>就绪来源</span><strong>${hub.counts?.readySources || 0}</strong></article>
      <article><span>可用来源</span><strong>${hub.counts?.usableSources || 0}</strong></article>
      <article><span>需兜底</span><strong>${hub.counts?.fallbackSources || 0}</strong></article>
      <article><span>待处理</span><strong>${hub.counts?.waitingSources || 0}</strong></article>
    </div>
    <div class="collection-hub-layout">
      <section>
        <b>四层数据链路</b>
        <div class="collection-hub-lanes">
          ${lanes.map((lane) => collectionHubLane(lane)).join("")}
        </div>
      </section>
      <section>
        <b>失败切换规则</b>
        <div class="collection-hub-rules">
          ${rules.map((rule) => `
            <article>
              <strong>${escapeHtml(rule.from || "来源")}</strong>
              <p>${escapeHtml(rule.when || "触发条件")}</p>
              <em>切到：${escapeHtml(rule.to || "兜底链路")}</em>
              <div class="collection-hub-rule-meta">
                <span>负责人：${escapeHtml(rule.owner || "运营")}</span>
                <span>SLA：${escapeHtml(rule.sla || "当天处理")}</span>
              </div>
              <small>${escapeHtml(rule.handoff || rule.evidence || "按规则完成交接。")}</small>
            </article>
          `).join("")}
        </div>
      </section>
    </div>
    <div class="collection-hub-principles">
      ${principles.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
    </div>
  `;
}

function renderCollectionFallbackSwitcher(switcher) {
  if (!collectionFallbackSwitcherPanel) return;
  const paths = Array.isArray(switcher?.paths) ? switcher.paths : [];
  if (!switcher?.version || !paths.length) {
    collectionFallbackSwitcherPanel.innerHTML = `
      <article class="collection-guarantee-loading">
        <strong>暂无采集替代方案</strong>
        <p>读取 dashboard 后，这里会把人工链接、旧字幕项目、第三方表格和固定对标号补录变成可点击路径。</p>
      </article>
    `;
    return;
  }
  collectionFallbackSwitcherPanel.innerHTML = `
    <article class="collection-switcher-primary ${escapeHtml(switcher.level || "waiting")}">
      <div>
        <span>${escapeHtml(fallbackSwitcherLevelText(switcher.level))}</span>
        <strong>${escapeHtml(switcher.summary || "选择一条兜底链路继续生产。")}</strong>
        <p>目标不是继续重跑不稳定采集，而是尽快补齐真实素材、字幕/正文和结构摘要。</p>
      </div>
      <a href="${escapeHtml(switcher.primaryHref || "#")}">${escapeHtml(switcher.primaryAction || "执行推荐路径")}</a>
    </article>
    <div class="collection-switcher-grid">
      ${paths.map((path) => collectionFallbackPathCard(path)).join("")}
    </div>
    <div class="collection-switcher-rules">
      ${(switcher.rules || []).map((rule) => `<span>${escapeHtml(rule)}</span>`).join("")}
    </div>
  `;
}

function collectionFallbackPathCard(path) {
  return `
    <article class="collection-switcher-card ${escapeHtml(path.status || "available")}">
      <div class="collection-switcher-card-head">
        <span>${escapeHtml(path.label || "兜底路径")}</span>
        <em>${escapeHtml(path.status === "recommended" ? "推荐" : "可选")}</em>
      </div>
      <strong>${escapeHtml(path.title || "补齐真实素材")}</strong>
      <dl>
        <div>
          <dt>适用场景</dt>
          <dd>${escapeHtml(path.when || "自动采集不可用时。")}</dd>
        </div>
        <div>
          <dt>需要输入</dt>
          <dd>${escapeHtml(path.input || "标题、链接或正文。")}</dd>
        </div>
        <div>
          <dt>进入系统后</dt>
          <dd>${escapeHtml(path.output || "入库后结构化。")}</dd>
        </div>
      </dl>
      <a href="${escapeHtml(path.href || "#")}">${escapeHtml(path.action || "去处理")}</a>
    </article>
  `;
}

function collectionDecisionEngineHtml(decision) {
  const cards = Array.isArray(decision.cards) ? decision.cards : [];
  return `
    <section class="collection-decision-engine ${escapeHtml(decision.status || "waiting")}">
      <div class="collection-decision-main">
        <div>
          <span>${escapeHtml(decision.label || "当前推荐")}</span>
          <strong>${escapeHtml(decision.summary || "按真实数据状态选择采集链路。")}</strong>
        </div>
        <a href="${escapeHtml(decision.href || "#")}">${escapeHtml(decision.action || "执行推荐动作")}</a>
      </div>
      <div class="collection-decision-grid">
        <article>
          <b>触发条件</b>
          <p>${escapeHtml(decision.trigger || "根据采集任务和数据源状态判断。")}</p>
        </article>
        <article>
          <b>切换到</b>
          <p>${escapeHtml(decision.switchTo || "人工/第三方兜底链路")}</p>
        </article>
        <article>
          <b>完成标准</b>
          <p>${escapeHtml(decision.completion || "补齐真实素材并完成结构摘要。")}</p>
        </article>
      </div>
      ${cards.length ? `
        <div class="collection-decision-cards">
          ${cards.map((card) => `
            <a href="${escapeHtml(card.href || "#")}">
              <span>${escapeHtml(card.label || "待处理")}</span>
              <strong>${escapeHtml(card.title || "决策动作")}</strong>
              <p>${escapeHtml(card.body || "按当前状态处理。")}</p>
              <em>${escapeHtml(card.action || "去处理")}</em>
            </a>
          `).join("")}
        </div>
      ` : ""}
    </section>
  `;
}

function collectionHubLane(lane) {
  return `
    <article class="collection-hub-lane ${escapeHtml(lane.status || "waiting")}">
      <div>
        <span>${escapeHtml(lane.layer || "-")} 层</span>
        <em>${escapeHtml(lane.statusLabel || dataSourceStatusText(lane.status))}</em>
      </div>
      <strong>${escapeHtml(lane.title || "未命名链路")}</strong>
      <p>${escapeHtml(lane.evidence || "暂无证据")}</p>
      <a href="${escapeHtml(lane.href || "#")}">${escapeHtml(lane.action || "去处理")}</a>
    </article>
  `;
}

function renderCollectionDailyReview(review) {
  if (!collectionDailyReviewPanel) return;
  const checkpoints = Array.isArray(review?.checkpoints) ? review.checkpoints : [];
  const priorities = Array.isArray(review?.nextDayPriorities) ? review.nextDayPriorities : [];
  if (!review?.version) {
    collectionDailyReviewPanel.innerHTML = `
      <article class="daily-review-loading">
        <strong>暂无日终复盘</strong>
        <p>系统会根据真实采集、对标账号更新、结构摘要、脚本审核和发布回填生成复盘。</p>
      </article>
    `;
    return;
  }
  collectionDailyReviewPanel.innerHTML = `
    <article class="daily-review-card ${escapeHtml(review.level || "warning")}">
      <div class="daily-review-head">
        <div>
          <span>${escapeHtml(review.levelLabel || "日终复盘")}</span>
          <strong>${escapeHtml(review.summary || "等待复盘判断")}</strong>
          <p>${escapeHtml(review.closeAdvice || "按未闭环项处理后再结束今日工作日。")}</p>
        </div>
        <a href="./v2.html?v=daily-review-v1">回到 V2 首页</a>
      </div>
      <div class="daily-review-counts">
        <span><b>${review.counts?.done || 0}</b>已闭环</span>
        <span><b>${review.counts?.open || 0}</b>未闭环</span>
        <span><b>${review.counts?.warning || 0}</b>需复核</span>
        <span><b>${review.counts?.blockers || 0}</b>高优先级</span>
      </div>
      <div class="daily-review-checkpoints">
        ${checkpoints.map((item) => `
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
          ${priorities.slice(0, 5).map((item) => `<a href="${escapeHtml(item.href || "#")}">${escapeHtml(item.title || "处理缺口")}：${escapeHtml(item.action || "去处理")}</a>`).join("")}
        </div>
      ` : ""}
    </article>
  `;
}

function renderCollectionHandoffs(items) {
  if (!collectionHandoffList) return;
  if (!items.length) {
    collectionHandoffList.innerHTML = `
      <div class="handoff-list-head">
        <strong>最近交接记录</strong>
        <span>暂无</span>
      </div>
      <article>
        <div>
          <strong>还没有保存过交接记录</strong>
          <span>等待保存</span>
        </div>
        <p>在 V2 首页开工提醒卡片点击“保存交接记录”后，这里会显示快照。</p>
      </article>
    `;
    return;
  }
  collectionHandoffList.innerHTML = `
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
  `;
}

async function updateCollectionHandoffProcess(button) {
  const id = button.dataset.handoffId;
  const processStatus = button.dataset.processHandoff;
  if (!id || !processStatus) return;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "更新中...";
  setCollectionStatus("pending", "正在更新交接处理状态...");
  try {
    const response = await fetch(`${COLLECTION_API_BASE}/api/v2/operation-handoffs/${encodeURIComponent(id)}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        processStatus,
        owner: "运营",
        processNote: processStatus === "done" ? "已由采集任务中心标记处理完成。" : "已由采集任务中心接手处理。",
      }),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    setCollectionStatus("online", `交接状态已更新：${data.item?.processStatusLabel || handoffProcessStatusText(processStatus)}`);
    await loadCollectionGuarantee();
  } catch (error) {
    setCollectionStatus("offline", `交接状态更新失败：${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function copyCollectionHandoff(button) {
  const id = button.dataset.copyHandoff;
  if (!id) return;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "复制中...";
  setCollectionStatus("pending", "正在读取交接归档文本...");
  try {
    const response = await fetch(`${COLLECTION_API_BASE}/api/v2/operation-handoffs/${encodeURIComponent(id)}`);
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
      setCollectionStatus("online", "交接文本已复制，可粘贴到飞书文档或日报。");
    } catch (copyError) {
      showHandoffCopyFallback(button, archiveText);
      setCollectionStatus("offline", "浏览器限制了自动复制，交接文本已展开，可手动全选复制。");
    }
  } catch (error) {
    setCollectionStatus("offline", `复制交接文本失败：${error.message}`);
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

function renderCollectionGuarantee(strategy) {
  if (!collectionGuaranteePanel) return;
  const lanes = Array.isArray(strategy?.lanes) ? strategy.lanes : [];
  if (!lanes.length) {
    collectionGuaranteePanel.innerHTML = `
      <article class="collection-guarantee-loading">
        <strong>暂无采集保障数据</strong>
        <p>先运行一次采集任务，或保存每日采集计划。</p>
      </article>
    `;
    return;
  }
  collectionGuaranteePanel.innerHTML = `
    <div class="collection-guarantee-summary ${escapeHtml(strategy.level || "needs_input")}">
      <span>${guaranteeLevelText(strategy.level)}</span>
      <strong>${escapeHtml(strategy.summary || "待判断今日采集保障")}</strong>
      <p>${escapeHtml(strategy.nextAction || "先补齐至少一个可用数据源。")}</p>
    </div>
    <div class="collection-guarantee-grid">
      ${lanes.map((lane) => collectionGuaranteeLane(lane)).join("")}
    </div>
  `;
}

function renderDataSourceMatrix(matrix) {
  if (!dataSourceMatrixPanel) return;
  const sources = Array.isArray(matrix?.sources) ? matrix.sources : [];
  if (!sources.length) {
    dataSourceMatrixPanel.innerHTML = `
      <article class="collection-guarantee-loading">
        <strong>暂无数据源状态</strong>
        <p>先运行采集任务，或导入人工/第三方素材。</p>
      </article>
    `;
    return;
  }
  dataSourceMatrixPanel.innerHTML = `
    <div class="data-source-summary ${escapeHtml(matrix.level || "needs_input")}">
      <span>${dataSourceLevelText(matrix.level)}</span>
      <strong>${escapeHtml(matrix.summary || "待判断数据源状态")}</strong>
      <p>可用来源 ${matrix.usableCount || 0} 个 / 完全就绪 ${matrix.readyCount || 0} 个 / 待处理 ${matrix.blockedCount || 0} 个。</p>
    </div>
    <div class="data-source-rules">
      ${(matrix.rules || []).map((rule) => `<span>${escapeHtml(rule)}</span>`).join("")}
    </div>
    <div class="data-source-grid">
      ${sources.map((source) => dataSourceCard(source)).join("")}
    </div>
  `;
}

function dataSourceCard(source) {
  return `
    <article class="data-source-card ${escapeHtml(source.status || "waiting")}">
      <div class="data-source-card-head">
        <span>${escapeHtml(source.layer || "-")} 层</span>
        <em>${escapeHtml(source.statusLabel || dataSourceStatusText(source.status))}</em>
      </div>
      <strong>${escapeHtml(source.title || "未命名数据源")}</strong>
      <small>${escapeHtml(source.role || "数据来源")} / ${escapeHtml(platformText(source.sourcePlatform) || source.sourcePlatform || "未知平台")} / ${escapeHtml(automationText(source.automation))}</small>
      <dl>
        <div>
          <dt>当前证据</dt>
          <dd>${escapeHtml(source.evidence || "暂无证据")}</dd>
        </div>
        <div>
          <dt>能产出什么</dt>
          <dd>${escapeHtml(source.output || "待明确")}</dd>
        </div>
        <div>
          <dt>风险边界</dt>
          <dd>${escapeHtml(source.risk || "待复核")}</dd>
        </div>
      </dl>
      <a href="${escapeHtml(source.href || "#")}">${escapeHtml(source.nextAction || "去处理")}</a>
    </article>
  `;
}

function renderCollectionActionFlow(flow) {
  if (!collectionActionFlowPanel) return;
  const steps = Array.isArray(flow?.steps) ? flow.steps : [];
  if (!steps.length) {
    collectionActionFlowPanel.innerHTML = `
      <article class="collection-guarantee-loading">
        <strong>暂无任务流</strong>
        <p>先运行采集任务或导入素材，系统会根据真实状态生成执行顺序。</p>
      </article>
    `;
    return;
  }
  collectionActionFlowPanel.innerHTML = `
    <article class="collection-action-summary">
      <span>今日下一步</span>
      <strong>${escapeHtml(flow.nextAction || "继续处理数据源")}</strong>
      <p>${escapeHtml(flow.summary || "按数据源状态执行采集保障。")}</p>
      <a href="${escapeHtml(flow.nextHref || "#")}">执行下一步</a>
    </article>
    <div class="collection-action-flow">
      ${steps.map((step, index) => collectionActionStep(step, index)).join("")}
    </div>
  `;
}

function collectionActionStep(step, index) {
  return `
    <article class="collection-action-step ${escapeHtml(step.status || "waiting")}">
      <div class="collection-action-index">
        <span>${String(index + 1).padStart(2, "0")}</span>
        <em>${escapeHtml(step.statusLabel || collectionActionStatusText(step.status))}</em>
      </div>
      <div class="collection-action-body">
        <strong>${escapeHtml(step.title || "未命名任务")}</strong>
        <p>${escapeHtml(step.reason || "暂无原因")}</p>
        <small>${step.sourceLayer ? `${escapeHtml(step.sourceLayer)} 层 / ` : ""}${escapeHtml(step.sourceTitle || "系统任务")} / ${escapeHtml(step.owner || "运营")}</small>
      </div>
      <a href="${escapeHtml(step.href || "#")}">${escapeHtml(step.action || "去处理")}</a>
    </article>
  `;
}

function renderCollectionFallbackDesk(desk) {
  if (!collectionFallbackDeskPanel) return;
  const cards = Array.isArray(desk?.cards) ? desk.cards : [];
  const primary = desk?.primary || {};
  if (!primary.title && !cards.length) {
    collectionFallbackDeskPanel.innerHTML = `
      <article class="collection-guarantee-loading">
        <strong>暂无兜底动作</strong>
        <p>当前没有失败来源；如果要提升质量，可以继续导入对标内容并结构化。</p>
      </article>
    `;
    return;
  }
  collectionFallbackDeskPanel.innerHTML = `
    <article class="collection-fallback-primary ${escapeHtml(primary.status || desk?.level || "waiting")}">
      <div>
        <span>${escapeHtml(primary.statusLabel || fallbackDeskLevelText(desk?.level))}</span>
        <strong>${escapeHtml(primary.title || "当前兜底动作")}</strong>
        <p>${escapeHtml(primary.evidence || desk?.summary || "按当前数据源状态执行下一步。")}</p>
      </div>
      <a href="${escapeHtml(primary.href || "#")}">${escapeHtml(primary.action || "执行下一步")}</a>
    </article>
    <div class="collection-fallback-rules">
      ${(desk?.rules || []).map((rule) => `<span>${escapeHtml(rule)}</span>`).join("")}
    </div>
    <div class="collection-fallback-desk-grid">
      ${cards.map((card) => collectionFallbackCard(card)).join("")}
    </div>
  `;
}

function collectionFallbackCard(card) {
  return `
    <article class="collection-fallback-card ${escapeHtml(card.status || "waiting")}">
      <div class="collection-fallback-card-head">
        <span>${escapeHtml(card.sourceLayer ? `${card.sourceLayer} 层` : card.type || "兜底")}</span>
        <em>${escapeHtml(card.statusLabel || dataSourceStatusText(card.status))}</em>
      </div>
      <strong>${escapeHtml(card.title || "待处理来源")}</strong>
      <p>${escapeHtml(card.evidence || "暂无当前证据")}</p>
      <dl>
        <div>
          <dt>风险边界</dt>
          <dd>${escapeHtml(card.risk || "按数据质量复核")}</dd>
        </div>
        <div>
          <dt>完成标准</dt>
          <dd>${escapeHtml(card.completion || "完成后回到生成前检查")}</dd>
        </div>
      </dl>
      <div class="collection-fallback-card-action">
        <small>${escapeHtml(card.owner || "运营")}</small>
        <a href="${escapeHtml(card.href || "#")}">${escapeHtml(card.action || "去处理")}</a>
      </div>
    </article>
  `;
}

function renderCollectionFallbackTrace(trace) {
  if (!collectionTracePanel) return;
  const items = Array.isArray(trace?.items) ? trace.items : [];
  if (!trace?.version) {
    collectionTracePanel.innerHTML = `
      <article class="collection-guarantee-loading">
        <strong>暂无追溯数据</strong>
        <p>当采集失败或启用人工/第三方兜底后，这里会展示从失败证据到导入结构化的完整链路。</p>
      </article>
    `;
    return;
  }
  collectionTracePanel.innerHTML = `
    <article class="collection-trace-summary ${escapeHtml(trace.level || "empty")}">
      <div>
        <span>${collectionTraceLevelText(trace.level)}</span>
        <strong>${escapeHtml(trace.summary || "等待追溯链路")}</strong>
        <p>追溯任务 ${trace.counts?.traces || 0} 条 / 待导入 ${trace.counts?.waitingImport || 0} 条 / 已结构化 ${trace.counts?.structured || 0} 条。</p>
      </div>
      <a href="./content-pool.html?v=collection-trace-v1#manual-import">去对标内容池补录</a>
    </article>
    <div class="collection-trace-rules">
      ${(trace.rules || []).map((rule) => `<span>${escapeHtml(rule)}</span>`).join("")}
    </div>
    <div class="collection-trace-list">
      ${items.length ? items.map((item) => collectionTraceCard(item)).join("") : `
        <article class="collection-trace-card empty">
          <strong>暂无需要追溯的兜底任务</strong>
          <p>当前没有采集失败或人工兜底任务。</p>
        </article>
      `}
    </div>
  `;
}

function collectionTraceCard(item) {
  const artifacts = Array.isArray(item.artifacts) ? item.artifacts : [];
  const sources = Array.isArray(item.matchedSources) ? item.matchedSources : [];
  const steps = Array.isArray(item.steps) ? item.steps : [];
  return `
    <article class="collection-trace-card ${escapeHtml(item.status || "waiting_import")}">
      <div class="collection-trace-head">
        <div>
          <span>${escapeHtml(item.statusLabel || collectionTraceStatusText(item.status))}</span>
          <strong>${escapeHtml(item.title || "采集兜底任务")}</strong>
          <p>${escapeHtml(item.error || item.rule || "按追溯链路检查兜底进度。")}</p>
        </div>
        <a href="${escapeHtml(item.nextHref || item.manualImport?.href || "#")}">${escapeHtml(item.nextAction || "去处理")}</a>
      </div>
      <div class="collection-trace-steps">
        ${steps.map((step, index) => `
          <article class="${escapeHtml(step.status || "waiting")}">
            <em>${String(index + 1).padStart(2, "0")}</em>
            <strong>${escapeHtml(step.label || "步骤")}</strong>
            <p>${escapeHtml(step.detail || "")}</p>
          </article>
        `).join("")}
      </div>
      ${artifacts.length ? `
        <div class="collection-trace-artifacts">
          <b>失败证据 / 采集产物</b>
          ${artifacts.map((artifact) => `
            <span>
              <em>${artifact.type === "screenshot" ? "截图" : "JSON"}</em>
              ${escapeHtml(artifact.query ? `${artifact.query} / ${artifact.status} / ` : "")}${escapeHtml(artifact.path)}
            </span>
          `).join("")}
        </div>
      ` : ""}
      ${sources.length ? `
        <div class="collection-trace-sources">
          <b>匹配到的内容池素材</b>
          ${sources.map((source) => `
            <a href="./content-pool.html?v=collection-trace-v1#content-source-${source.id}">
              <strong>${escapeHtml(source.title || "未命名素材")}</strong>
              <span>${escapeHtml(platformText(source.platform))} / ${source.selected ? "已加入工作流" : "未加入"} / ${(source.structure || {}).status === "structure_done" ? "已结构化" : "待结构化"}</span>
            </a>
          `).join("")}
        </div>
      ` : `
        <div class="collection-trace-manual">
          <b>待人工导入</b>
          <p>${escapeHtml(item.manualImport?.note || "采集任务失败，改用人工导入补充素材。")}</p>
          <a href="${escapeHtml(item.manualImport?.href || "#")}">带入对标内容池</a>
        </div>
      `}
    </article>
  `;
}

function collectionGuaranteeLane(lane) {
  const manualUrl = manualImportUrl({
    taskType: lane.taskType,
    sourcePlatform: lane.taskType === "xhs_placeholder" ? "xhs" : lane.sourcePlatform,
    strategy: lane.strategy,
    error: lane.evidence,
  });
  const canRun = lane.taskType !== "third_party_import";
  return `
    <article class="collection-guarantee-lane ${escapeHtml(lane.status || "waiting")}">
      <div class="collection-guarantee-lane-head">
        <span>${escapeHtml(lane.role || "数据来源")}</span>
        <em>${escapeHtml(lane.statusLabel || "待处理")}</em>
      </div>
      <strong>${escapeHtml(lane.title || "未命名来源")}</strong>
      <p>${escapeHtml(lane.evidence || "暂无状态")}</p>
      <small>计划 ${escapeHtml(lane.scheduleTime || "未设置")} / ${escapeHtml(lane.owner || "运营")}</small>
      <div class="collection-guarantee-action">
        <b>${escapeHtml(lane.recommendedAction || lane.fallbackAction || "按计划处理")}</b>
        ${canRun ? `<button type="button" data-run-collection="${escapeHtml(lane.taskType)}">运行一次</button>` : `<a href="${manualUrl}">去导入</a>`}
      </div>
    </article>
  `;
}

async function loadCollectionSchedules() {
  if (!collectionPlanList) return;
  try {
    const response = await fetch(`${COLLECTION_API_BASE}/api/v2/collection-schedules`);
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    renderCollectionSchedules(data.items || []);
  } catch (error) {
    collectionPlanList.innerHTML = `
      <article class="collection-plan-card failed">
        <strong>采集计划读取失败</strong>
        <p>${escapeHtml(error.message)}</p>
      </article>
    `;
  }
}

function renderCollectionSchedules(items) {
  if (!collectionPlanList) return;
  collectionPlanList.innerHTML = items.length
    ? items.map((item) => collectionScheduleCard(item)).join("")
    : `<article class="collection-plan-card"><strong>暂无采集计划</strong><p>需要先建立每日采集节奏。</p></article>`;
}

function collectionScheduleCard(item) {
  return `
    <article class="collection-plan-card ${item.enabled ? "" : "disabled"}">
      <div class="collection-plan-head">
        <div>
          <span class="caption">${strategyText(item.strategy)}</span>
          <strong>${taskTypeText(item.taskType)}</strong>
          <p>${platformText(item.sourcePlatform)} / ${item.enabled ? "已启用" : "已暂停"}</p>
        </div>
        <label class="collection-plan-toggle">
          <input type="checkbox" data-schedule-enabled="${item.id}" ${item.enabled ? "checked" : ""} />
          <span>${item.enabled ? "启用" : "暂停"}</span>
        </label>
      </div>
      <div class="collection-plan-fields">
        <label>
          <span>建议时间</span>
          <input type="time" data-schedule-time="${item.id}" value="${escapeHtml(item.scheduleTime || "09:30")}" />
        </label>
        <label>
          <span>关键词 / 范围</span>
          <input type="text" data-schedule-queries="${item.id}" value="${escapeHtml(item.queries || "")}" placeholder="最多 3 个词，逗号分隔" />
        </label>
        <label>
          <span>负责人</span>
          <input type="text" data-schedule-owner="${item.id}" value="${escapeHtml(item.owner || "运营")}" />
        </label>
      </div>
      <div class="collection-plan-note">
        <b>失败兜底</b>
        <textarea rows="2" data-schedule-fallback="${item.id}">${escapeHtml(item.fallbackAction || "")}</textarea>
      </div>
      <p>${escapeHtml(item.note || "")}</p>
      <div class="collection-plan-actions">
        <button type="button" data-save-schedule="${item.id}">保存计划</button>
        <button type="button" data-run-schedule="${item.id}" ${item.enabled ? "" : "disabled"}>按计划运行一次</button>
      </div>
    </article>
  `;
}

async function saveCollectionSchedule(button) {
  const id = button.dataset.saveSchedule;
  if (!id) return;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "保存中...";
  try {
    const payload = {
      enabled: Boolean(document.querySelector(`[data-schedule-enabled="${id}"]`)?.checked),
      scheduleTime: document.querySelector(`[data-schedule-time="${id}"]`)?.value || "",
      queries: document.querySelector(`[data-schedule-queries="${id}"]`)?.value || "",
      owner: document.querySelector(`[data-schedule-owner="${id}"]`)?.value || "运营",
      fallbackAction: document.querySelector(`[data-schedule-fallback="${id}"]`)?.value || "",
    };
    const response = await fetch(`${COLLECTION_API_BASE}/api/v2/collection-schedules/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    setCollectionStatus("online", `采集计划已保存：${taskTypeText(data.item.taskType)}`);
    await loadCollectionSchedules();
  } catch (error) {
    setCollectionStatus("offline", `采集计划保存失败：${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function runCollectionSchedule(button) {
  const id = button.dataset.runSchedule;
  if (!id) return;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "运行中...";
  setCollectionStatus("pending", "正在按计划运行采集任务...");
  try {
    const response = await fetch(`${COLLECTION_API_BASE}/api/v2/collection-schedules/${id}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    const statusText = data.task.status === "success" ? "采集成功" : "需要人工处理";
    setCollectionStatus(data.task.status === "success" ? "online" : "offline", `${statusText}：${taskTypeText(data.task.taskType)}`);
    await loadCollectionGuarantee();
    await loadCollectionTasks();
  } catch (error) {
    setCollectionStatus("offline", `按计划运行失败：${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function loadCollectionTasks() {
  setCollectionStatus("pending", "正在读取采集任务...");
  try {
    const response = await fetch(`${COLLECTION_API_BASE}/api/v2/collection-tasks?limit=30`);
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    setCollectionStatus("online", `采集任务已连接：${data.items.length} 条`);
    renderCollectionTasks(data.items || []);
  } catch (error) {
    setCollectionStatus("offline", `采集任务读取失败：${error.message}`);
  }
}

async function runCollectionTask(button) {
  const taskType = button.dataset.runCollection;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "任务运行中...";
  setCollectionStatus("pending", "采集任务运行中，请等待结果。");
  try {
    const payload = { taskType };
    if (taskType === "douyin_category") {
      payload.queries = categoryQueries?.value || "";
    }
    const response = await fetch(`${COLLECTION_API_BASE}/api/v2/collection-tasks/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    const statusText = data.item.status === "success" ? "采集成功" : "采集失败";
    setCollectionStatus(data.item.status === "success" ? "online" : "offline", `${statusText}：${taskTypeText(data.item.taskType)}`);
    await loadCollectionGuarantee();
    await loadCollectionTasks();
  } catch (error) {
    setCollectionStatus("offline", `采集任务失败：${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function renderCollectionTasks(items) {
  if (!collectionTaskList) return;
  collectionTaskList.innerHTML = items.length
    ? items.map((item) => collectionTaskCard(item)).join("")
    : `<article class="collection-task-card empty-state"><strong>暂无采集任务</strong><p>先运行一次热榜采集，系统会在这里记录结果。</p></article>`;
}

function collectionTaskCard(item) {
  const output = item.output || {};
  const preview = output.stderr || output.stdout || "";
  const artifacts = Array.isArray(output.artifacts) ? output.artifacts : [];
  const fallbackActions = Array.isArray(output.fallbackActions) ? output.fallbackActions : [];
  const fallbackItems = fallbackActions.length ? fallbackActions : defaultFallbackActions(item);
  const importUrl = manualImportUrl(item);
  return `
    <article class="collection-task-card ${item.status}">
      <div class="collection-task-head">
        <div>
          <strong>${taskTypeText(item.taskType)}</strong>
          <p>${strategyText(item.strategy)} / ${item.sourcePlatform}</p>
        </div>
        <span class="collection-status ${item.status}">${statusText(item.status)}</span>
      </div>
      <div class="collection-task-meta">
        <span>开始：${formatDate(item.startedAt)}</span>
        <span>结束：${item.finishedAt ? formatDate(item.finishedAt) : "运行中"}</span>
        <span>命令：${escapeHtml(item.command)}</span>
      </div>
      ${item.error ? `<div class="collection-error"><b>失败原因</b><span>${escapeHtml(item.error)}</span></div>` : ""}
      ${item.status === "failed" ? `
        <div class="collection-fallback-actions">
          <b>建议动作</b>
          ${fallbackItems.map((action) => `<span>${escapeHtml(action)}</span>`).join("")}
          <a href="${importUrl}">带入对标内容池</a>
        </div>
      ` : ""}
      ${artifacts.length ? `
        <div class="collection-artifacts">
          <b>采集产物</b>
          ${artifacts.map((artifact) => `
            <span>
              <em>${artifact.type === "screenshot" ? "截图" : "JSON"}</em>
              ${escapeHtml(artifact.query ? `${artifact.query} / ${artifact.status} / ` : "")}${escapeHtml(artifact.path)}
            </span>
          `).join("")}
        </div>
      ` : ""}
      ${preview ? `<details><summary>查看输出</summary><pre>${escapeHtml(preview)}</pre></details>` : ""}
    </article>
  `;
}

function defaultFallbackActions(item) {
  if (item.taskType === "douyin_category") {
    return ["暂停登录态采集", "稍后最多 3 个词重试", "人工导入对标链接或字幕"];
  }
  if (item.taskType === "xhs_placeholder") {
    return ["人工导入小红书链接", "粘贴笔记文本或字幕", "导入第三方数据表"];
  }
  return ["查看失败输出", "手动重跑采集", "人工导入对标链接或字幕"];
}

function manualImportUrl(item) {
  const platform = item.sourcePlatform || (item.taskType === "xhs_placeholder" ? "xhs" : "manual");
  const title = item.taskType === "xhs_placeholder" ? "小红书人工导入素材" : `${taskTypeText(item.taskType)}失败补录`;
  const note = item.error || "采集任务失败，改用人工导入补充素材。";
  const params = new URLSearchParams({
    importPlatform: platform,
    importTitle: title,
    importAccount: strategyText(item.strategy),
    importNote: note,
  });
  return `./content-pool.html?v=content-fallback-v1&${params.toString()}#manual-import`;
}

function setCollectionStatus(state, message) {
  if (!collectionStatus) return;
  collectionStatus.textContent = message;
  collectionStatus.className = `api-status ${state}`;
}

function taskTypeText(value) {
  return {
    douyin_hot: "抖音总热榜采集",
    douyin_category: "抖音类目小批量采集",
    xhs_placeholder: "小红书占位任务",
    third_party_import: "第三方表格兜底",
  }[value] || value || "未知任务";
}

function strategyText(value) {
  return {
    stable_hot_api: "稳定热榜接口",
    login_state_browser: "登录态浏览器",
    manual_import: "人工/第三方导入",
    third_party_import: "第三方表格导入",
  }[value] || value || "未知策略";
}

function platformText(value) {
  return {
    douyin: "抖音",
    xhs: "小红书",
    manual: "人工",
    third_party: "第三方数据",
  }[value] || value || "未知平台";
}

function statusText(value) {
  return {
    running: "运行中",
    success: "成功",
    failed: "失败",
  }[value] || value || "未知";
}

function fallbackSwitcherLevelText(value) {
  return {
    fallback: "建议切兜底",
    waiting: "可补强输入",
    ready: "兜底可选",
  }[value] || "替代方案";
}

function guaranteeLevelText(value) {
  return {
    healthy: "保障正常",
    usable_with_fallback: "可生产，需兜底",
    needs_input: "需补数据",
  }[value] || "待判断";
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

function collectionActionStatusText(value) {
  return {
    done: "已完成",
    ready: "可执行",
    run: "需运行",
    fallback: "切兜底",
    waiting: "待处理",
    blocked: "有缺项",
  }[value] || "待处理";
}

function dailyReviewStatusText(value) {
  return {
    done: "已闭环",
    warning: "需复核",
    open: "未闭环",
  }[value] || "待判断";
}

function fallbackDeskLevelText(value) {
  return {
    ready: "可进入生成",
    fallback: "优先兜底",
    waiting: "待补数据",
  }[value] || "待处理";
}

function collectionTraceLevelText(value) {
  return {
    needs_import: "待补录",
    trace_ready: "已闭环",
    imported: "已导入",
    empty: "无追溯项",
  }[value] || "待追溯";
}

function collectionTraceStatusText(value) {
  return {
    waiting_import: "等待导入",
    imported: "已导入",
    selected: "已加入工作流",
    structured: "已结构化",
  }[value] || "待追溯";
}

function automationText(value) {
  return {
    auto_stable: "稳定自动",
    login_state_limited: "登录态小批量",
    human_in_loop: "人工参与",
    table_import: "表格导入",
    manual_first: "人工优先",
    mixed: "混合链路",
    feedback_loop: "复盘学习",
  }[value] || value || "未标注";
}

function handoffProcessStatusText(value) {
  return {
    pending: "待处理",
    processing: "处理中",
    done: "已处理",
    archived: "已归档",
  }[value] || value || "待处理";
}

function formatDate(value) {
  if (!value) return "";
  return value.replace("T", " ").replace(/\.\d+/, "").replace("+00:00", "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
