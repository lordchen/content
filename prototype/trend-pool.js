const TREND_API_BASE = "http://127.0.0.1:8771";

const trendStatus = document.getElementById("trendApiStatus");
const trendRunCard = document.getElementById("trendRunCard");
const trendStats = document.getElementById("trendStats");
const trendList = document.getElementById("trendList");
const trendFilterButtons = Array.from(document.querySelectorAll("[data-trend-filter]"));

let currentTrendFilter = "";

trendFilterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentTrendFilter = button.dataset.trendFilter || "";
    trendFilterButtons.forEach((item) => item.classList.toggle("active", item === button));
    loadTrends();
  });
});

trendList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-trend-mark]");
  if (button) markTrend(button);
});

loadTrends();

async function loadTrends() {
  setTrendStatus("pending", "正在读取真实热榜...");
  try {
    const response = await fetch(`${TREND_API_BASE}/api/v2/trends?status=${encodeURIComponent(currentTrendFilter)}&limit=100`);
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    setTrendStatus("online", `热点池已连接：${data.items.length} 条`);
    renderTrendRun(data.run);
    renderTrendStats(data.stats || {});
    renderTrends(data.items || []);
  } catch (error) {
    setTrendStatus("offline", `热点池读取失败：${error.message}`);
  }
}

function renderTrendRun(run) {
  if (!trendRunCard) return;
  if (!run) {
    trendRunCard.innerHTML = `
      <article class="trend-run-empty">
        <strong>暂无热榜采集</strong>
        <p>请先到采集任务中心运行抖音总热榜采集。</p>
        <a href="./collection-center.html?v=trend-pool-v1">去采集任务</a>
      </article>
    `;
    return;
  }
  trendRunCard.innerHTML = `
    <article>
      <span>最近热榜批次</span>
      <strong>${run.platform || "douyin"} / ${run.itemCount || 0} 条</strong>
      <p>采集时间：${formatDate(run.fetchedAt || run.createdAt)}。这里展示的是已入库真实热榜，不是模拟数据。</p>
    </article>
  `;
}

function renderTrendStats(stats) {
  if (!trendStats) return;
  const items = [
    ["当前列表", stats.total || 0],
    ["已加入", stats.selected || 0],
    ["候选", stats.candidate || 0],
    ["观察", stats.watch || 0],
    ["不相关", stats.irrelevant || 0],
    ["屏蔽", stats.blocked || 0],
  ];
  trendStats.innerHTML = items.map(([label, value]) => `
    <article>
      <span>${label}</span>
      <strong>${value}</strong>
    </article>
  `).join("");
}

function renderTrends(items) {
  if (!trendList) return;
  trendList.innerHTML = items.length
    ? items.map((item) => trendCardHtml(item)).join("")
    : `<article class="trend-card"><strong>当前筛选没有热点</strong><p>换一个筛选条件，或先运行热榜采集。</p></article>`;
}

function trendCardHtml(item) {
  return `
    <article class="trend-card ${item.usageStatus}">
      <div class="trend-card-head">
        <div>
          <span class="trend-rank">#${item.rank || "-"}</span>
          <strong>${escapeHtml(item.keyword)}</strong>
          <p>${escapeHtml(item.reason || "等待运营判断")}</p>
        </div>
        <span class="trend-status ${item.usageStatus}">${usageStatusText(item.usageStatus)}</span>
      </div>
      <div class="trend-meta">
        <span>热度 ${formatNumber(item.hotValue || 0)}</span>
        <span>品牌相关 ${item.relevanceScore || 0}</span>
        <span>风险 ${riskText(item.riskLevel)}</span>
        <span>${platformText(item.platform)}</span>
      </div>
      ${item.operatorNote ? `<p class="trend-note">运营备注：${escapeHtml(item.operatorNote)}</p>` : ""}
      <div class="trend-actions">
        <button type="button" data-trend-mark="selected" data-trend-id="${item.id}">加入今日候选</button>
        <button type="button" data-trend-mark="watch" data-trend-id="${item.id}">设为观察</button>
        <button type="button" data-trend-mark="irrelevant" data-trend-id="${item.id}">标记不相关</button>
        <button type="button" data-trend-mark="blocked" data-trend-id="${item.id}">屏蔽风险</button>
      </div>
    </article>
  `;
}

async function markTrend(button) {
  const id = button.dataset.trendId;
  const usageStatus = button.dataset.trendMark;
  if (!id || !usageStatus) return;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "处理中...";
  try {
    const response = await fetch(`${TREND_API_BASE}/api/v2/trends/${id}/mark`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usageStatus, note: markNote(usageStatus) }),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    setTrendStatus("online", `已标记：${usageStatusText(usageStatus)} / ${data.item?.keyword || ""}`);
    await loadTrends();
  } catch (error) {
    setTrendStatus("offline", `标记失败：${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function markNote(value) {
  return {
    selected: "运营加入今日候选，脚本流程可读取。",
    watch: "运营暂时观察，不进入生成。",
    irrelevant: "运营判断与品牌当日内容不相关。",
    blocked: "运营判断存在风险，禁止进入生成。",
  }[value] || "";
}

function setTrendStatus(state, message) {
  if (!trendStatus) return;
  trendStatus.textContent = message;
  trendStatus.className = `api-status ${state}`;
}

function usageStatusText(value) {
  return {
    candidate: "候选",
    selected: "已加入",
    watch: "观察",
    irrelevant: "不相关",
    blocked: "屏蔽",
  }[value] || value || "未知";
}

function riskText(value) {
  return {
    low: "低",
    medium: "中",
    high: "高",
  }[value] || value || "未知";
}

function platformText(value) {
  return {
    douyin: "抖音",
    xhs: "小红书",
    manual: "手工",
    third_party: "第三方",
  }[value] || value || "未知平台";
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("zh-CN");
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "未知";
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
