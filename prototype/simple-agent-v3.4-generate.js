const API_BASE = (() => {
  if (window.SIMPLE_API_BASE) return window.SIMPLE_API_BASE.replace(/\/$/, "");
  const local = window.location.protocol === "file:" || ["127.0.0.1", "localhost"].includes(window.location.hostname);
  if (local) return "http://127.0.0.1:8771";
  const match = window.location.pathname.match(/^(\/[^/]+)\//);
  return match ? match[1] : "/content-agent";
})();

const state = {
  user: null,
  campaigns: [],
  materials: [],
  selectedMaterialIds: new Set(),
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
  const node = $("#generateMessage");
  if (!node) return;
  node.textContent = text;
  node.className = `v34-message ${tone}`.trim();
}

async function init() {
  bindEvents();
  await ensureSession();
  if (!state.user) return;
  renderUser();
  await loadInputs();
  await loadLatestResults();
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
        <p class="v34-muted">登录后查看 v3.4 新版脚本生成。</p>
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
    try {
      await apiJson("/api/simple-agent/login", {
        method: "POST",
        body: JSON.stringify({ username: $("#loginUser").value.trim(), password: $("#loginPass").value }),
      });
      window.location.reload();
    } catch (error) {
      $("#loginMessage").textContent = error.message || "登录失败";
      $("#loginMessage").className = "v34-message error";
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
  $("#openMaterialPicker")?.addEventListener("click", openMaterialPicker);
  $("#confirmMaterials")?.addEventListener("click", confirmMaterialPicker);
  $("#runGenerate")?.addEventListener("click", runGenerate);
  $$("[data-extra-prompt]").forEach((button) => button.addEventListener("click", () => {
    $("#extraInput").value = button.dataset.extraPrompt || "";
    $("#extraInput").focus();
  }));
  $$("[data-close-modal]").forEach((button) => button.addEventListener("click", () => closeModal(button.dataset.closeModal)));
  $("#materialPickerModal")?.addEventListener("click", (event) => {
    if (event.target.id === "materialPickerModal") closeModal("materialPickerModal");
  });
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

async function loadLatestResults() {
  try {
    const data = await apiJson("/api/simple-agent/scripts?limit=30");
    const items = data.items || [];
    if (!items.length) return;
    const latestJobId = items[0]?.jobId;
    const latestItems = latestJobId ? items.filter((item) => item.jobId === latestJobId) : items.slice(0, 3);
    renderResults(latestItems, { latest: true });
  } catch (error) {
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
        <td><span class="v34-material-name"><strong>${escapeHtml(item.title || "未命名素材")}</strong><small>${escapeHtml((item.tags || []).slice(0, 3).map((tag) => `#${tag}`).join(" ") || "未打标签")}</small></span></td>
        <td><span class="v34-platform ${normalizePlatform(item.platform)}">${escapeHtml(platformLabel(item.platform))}</span></td>
        <td>${escapeHtml((item.tags || []).slice(0, 3).join("，") || item.category || "-")}</td>
      </tr>
    `;
  }).join("") : `<tr><td colspan="4"><div class="v34-empty">暂无已加入脚本参考的素材，请先到素材库加入参考。</div></td></tr>`;
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
  const button = $("#runGenerate");
  button.disabled = true;
  button.textContent = "生成中...";
  setMessage("正在生成脚本，请稍等...", "");
  try {
    const data = await apiJson("/api/simple-agent/generate", {
      method: "POST",
      body: JSON.stringify({
        topic,
        targetCount: Number($("#countSelect").value || 3),
        outputMode: $("#styleSelect").value,
        qualityLevel: "high",
        campaignIds: [campaign.id],
        materialIds: materials.map((item) => item.id),
        manualFeedback: $("#extraInput").value.trim(),
        avoidRules: "不写全网最低，不承诺一定有货。",
      }),
    });
    renderResults(data.outputs || data.items || []);
    setMessage("脚本已生成。", "ok");
  } catch (error) {
    setMessage(error.message || "生成失败", "error");
  } finally {
    button.disabled = false;
    button.textContent = "生成脚本";
  }
}

function renderResults(items, options = {}) {
  if (!items.length) {
    $("#resultList").innerHTML = `<div class="v34-empty">没有返回脚本结果。</div>`;
    return;
  }
  $("#resultList").innerHTML = items.map((item, index) => `
    <article class="v34-result-card">
      <div class="v34-result-head">
        <h3>${escapeHtml(item.title || `脚本 ${index + 1}`)}</h3>
        <span class="v34-tag ok">${options.latest ? "最近生成" : "已生成"}</span>
      </div>
      ${scriptBodyHtml(item)}
      <div class="v34-result-actions">
        <button class="v34-btn primary" type="button">采用脚本</button>
        <button class="v34-btn" type="button">标记待改</button>
        <button class="v34-btn" type="button">重新生成</button>
      </div>
    </article>
  `).join("");
}

function scriptBodyHtml(item) {
  const scenes = extractScenes(item);
  if (!scenes.length) {
    return `<p class="v34-result-body">${escapeHtml(item.scriptBody || item.hook || JSON.stringify(item.output || item.outputJson || {}, null, 2))}</p>`;
  }
  return `
    <div class="v34-script-table" role="table" aria-label="分镜脚本">
      <div class="v34-script-row head" role="row">
        <span>时间</span>
        <span>镜头</span>
        <span>口播</span>
        <span>字幕</span>
      </div>
      ${scenes.map((scene) => `
        <div class="v34-script-row" role="row">
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
