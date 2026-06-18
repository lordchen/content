const SIMPLE_AGENT_SUBPATH = window.SIMPLE_AGENT_SUBPATH || "/content-agent";
const SIMPLE_API_BASE = (() => {
  if (window.SIMPLE_API_BASE) return window.SIMPLE_API_BASE.replace(/\/$/, "");
  const isLocal = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";
  if (isLocal) return "http://127.0.0.1:8771";
  const currentPath = window.location.pathname;
  const match = currentPath.match(/^(\/[^/]+)\//);
  const publicBase = match ? match[1] : SIMPLE_AGENT_SUBPATH;
  return publicBase;
})();

const pagePath = window.location.pathname;
const materialPreviewState = { excel: [], feishu: [] };
const materialUiState = {
  query: "",
  platform: "",
  status: "",
  selectedIds: new Set(),
  toastTimer: 0,
};
let simpleMaterialItems = [];
let simpleCampaignItems = [];
let editingCampaignId = null;
let simpleAgentUser = null;
let simpleScriptLibrary = { configured: false, url: "", tableId: "", error: "" };
let pendingRegenerateRequest = null;
let simpleScriptItems = [];
let todayScriptItems = [];
let generationCampaignItems = [];
let generationMaterialItems = [];
const generationPickerState = {
  campaignQuery: "",
  campaignStatus: "",
  materialQuery: "",
  materialPlatform: "",
  materialTag: "",
  materialQuality: "",
  materialStatus: "",
  materialUsableOnly: false,
  activeMaterialPlatform: "",
};
const pendingScriptReviews = new Set();
const pendingScriptRegenerations = new Set();
const scriptActionMessages = new Map();
const PROMPT_CONFIG_STORAGE_KEY = "simpleAgentPromptConfig:v1";
const PROMPT_CONFIG_FIELDS = ["systemPrompt", "generationPrompt", "qualityFormat", "qualitySamples", "avoidRules", "manualFeedback"];

async function initSimpleAgentPage() {
  const authenticated = await requireSimpleAgentLogin();
  if (!authenticated) return;
  if (pagePath.includes("simple-agent-materials")) initMaterialsPage();
  if (pagePath.includes("simple-agent-campaigns")) initCampaignsPage();
  if (pagePath.includes("simple-agent-generate")) initGeneratePage();
  if (pagePath.includes("simple-agent-scripts")) initScriptLibraryPage();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSimpleAgentPage);
} else {
  initSimpleAgentPage();
}

async function requireSimpleAgentLogin() {
  try {
    const data = await apiJson("/api/simple-agent/session");
    if (data.authenticated) {
      simpleAgentUser = data.user;
      renderSimpleAgentUserBar();
      renderSimpleAgentUserMenu();
      return true;
    }
  } catch (error) {
    // Render the login panel below.
  }
  renderSimpleAgentLogin();
  return false;
}

function renderSimpleAgentUserBar() {
  const shell = document.querySelector(".simple-agent-shell");
  if (!shell || document.getElementById("simpleAgentUserBar")) return;
  const bar = document.createElement("div");
  bar.id = "simpleAgentUserBar";
  bar.className = "simple-agent-user-bar";
  bar.innerHTML = `
    <span>${escapeHtml(simpleAgentUser?.displayName || simpleAgentUser?.username || "已登录")}</span>
    ${isSimpleAgentAdmin() ? `<span class="simple-admin-badge">管理员全量视图</span>` : ""}
    <button type="button" data-simple-agent-logout>退出</button>
  `;
  shell.appendChild(bar);
  bar.querySelector("[data-simple-agent-logout]")?.addEventListener("click", logoutSimpleAgent);
}

function renderSimpleAgentUserMenu() {
  if (!simpleAgentUser) return;
  const displayName = simpleAgentUser.displayName || simpleAgentUser.username || "已登录用户";
  const username = simpleAgentUser.username || "";
  const isAdmin = isSimpleAgentAdmin();
  const roleLabel = isAdmin ? "管理员" : "普通用户";
  const scopeLabel = isAdmin ? "全量数据" : "仅本人数据";
  const menuHtml = `
    <div class="simple-user-menu" data-simple-user-menu>
      <button class="simple-user-trigger" type="button" data-simple-user-trigger aria-haspopup="true" aria-expanded="false">
        <span class="simple-user-avatar" aria-hidden="true"></span>
        <span class="simple-user-text">
          <strong>${escapeHtml(displayName)}</strong>
          <small>${escapeHtml(roleLabel)} · ${escapeHtml(scopeLabel)}</small>
        </span>
        <i aria-hidden="true"></i>
      </button>
      <section class="simple-user-popover" role="menu" aria-label="当前用户">
        <div class="simple-user-popover-head">
          <span class="simple-user-avatar" aria-hidden="true"></span>
          <div>
            <strong>${escapeHtml(displayName)}</strong>
            <small>${escapeHtml(username)}</small>
          </div>
        </div>
        <dl>
          <div><dt>角色</dt><dd>${escapeHtml(roleLabel)}</dd></div>
          <div><dt>数据范围</dt><dd>${escapeHtml(scopeLabel)}</dd></div>
        </dl>
        <button type="button" data-simple-agent-logout>退出登录</button>
      </section>
    </div>
  `;
  const sidebarHtml = `
    <div class="simple-user-menu simple-user-menu-sidebar" data-simple-user-menu>
      <button class="simple-sidebar-user" type="button" data-simple-user-trigger aria-haspopup="true" aria-expanded="false">
        <span class="simple-user-avatar" aria-hidden="true"></span>
        <span>
          <strong>${escapeHtml(displayName)}</strong>
          <small>${escapeHtml(roleLabel)} · ${escapeHtml(scopeLabel)}</small>
        </span>
        <b aria-hidden="true"></b>
      </button>
      <section class="simple-user-popover" role="menu" aria-label="当前用户">
        <div class="simple-user-popover-head">
          <span class="simple-user-avatar" aria-hidden="true"></span>
          <div>
            <strong>${escapeHtml(displayName)}</strong>
            <small>${escapeHtml(username)}</small>
          </div>
        </div>
        <dl>
          <div><dt>角色</dt><dd>${escapeHtml(roleLabel)}</dd></div>
          <div><dt>数据范围</dt><dd>${escapeHtml(scopeLabel)}</dd></div>
        </dl>
        <button type="button" data-simple-agent-logout>退出登录</button>
      </section>
    </div>
  `;

  document.querySelectorAll(".material-user-avatar, .campaign-avatar, .campaign-user-select").forEach((node) => {
    node.outerHTML = menuHtml;
  });
  document.querySelectorAll(".material-sidebar-footer, .campaign-design-team").forEach((node) => {
    node.innerHTML = sidebarHtml;
  });

  bindSimpleAgentUserMenus();
}

function bindSimpleAgentUserMenus() {
  document.querySelectorAll("[data-simple-user-trigger]").forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      const targetMenu = trigger.closest("[data-simple-user-menu]");
      document.querySelectorAll("[data-simple-user-menu].open").forEach((item) => {
        if (item !== targetMenu) item.classList.remove("open");
      });
      if (targetMenu) {
        const open = targetMenu.classList.toggle("open");
        targetMenu.querySelector("[data-simple-user-trigger]")?.setAttribute("aria-expanded", open ? "true" : "false");
      }
    });
  });
  document.querySelectorAll("[data-simple-agent-logout]").forEach((button) => {
    button.addEventListener("click", logoutSimpleAgent);
  });
  if (!document.body.dataset.simpleUserMenuBound) {
    document.body.dataset.simpleUserMenuBound = "true";
    document.addEventListener("click", () => {
      document.querySelectorAll("[data-simple-user-menu].open").forEach((item) => {
        item.classList.remove("open");
        item.querySelector("[data-simple-user-trigger]")?.setAttribute("aria-expanded", "false");
      });
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      document.querySelectorAll("[data-simple-user-menu].open").forEach((item) => {
        item.classList.remove("open");
        item.querySelector("[data-simple-user-trigger]")?.setAttribute("aria-expanded", "false");
      });
    });
  }
}

function isSimpleAgentAdmin() {
  return simpleAgentUser?.role === "admin";
}

function ownerBadgeHtml(item) {
  if (!isSimpleAgentAdmin()) return "";
  const owner = item?.owner || {};
  const label = owner.displayName || owner.username || "未知账号";
  return `<small class="simple-owner-badge">归属：${escapeHtml(label)}</small>`;
}

function ownerCellHtml(item) {
  const owner = item?.owner || {};
  const label = owner.displayName || owner.username || "未知账号";
  const username = owner.username && owner.username !== label ? owner.username : "";
  return `
    <span class="material-owner-cell">
      <strong>${escapeHtml(label)}</strong>
      ${username ? `<small>${escapeHtml(username)}</small>` : ""}
    </span>
  `;
}

function renderSimpleAgentLogin(message = "") {
  document.body.innerHTML = `
    <main class="simple-login-page">
      <section class="simple-login-shell">
        <article class="simple-login-visual" aria-hidden="true">
          <div class="simple-login-brand">
            <span>CA</span>
            <div>
              <strong>内容生产 Agent</strong>
              <small>Content Ops Workbench</small>
            </div>
          </div>
          <div class="simple-login-visual-copy">
            <span class="caption">V1 BETA</span>
            <h2>素材、活动、脚本在同一个运营工作台流转。</h2>
            <p>登录后进入当前账号的数据视图，管理员可查看全量素材、品牌活动和脚本库。</p>
          </div>
          <div class="simple-login-proof">
            <span><strong>4</strong>核心页面</span>
            <span><strong>6</strong>内测账号</span>
            <span><strong>1</strong>飞书脚本库</span>
          </div>
        </article>
        <section class="simple-login-panel">
          <span class="caption">SIMPLE AGENT V1 BETA</span>
          <h1>登录内容生产 Agent</h1>
          <p>内测版需要登录后使用素材库、品牌活动和脚本生成。</p>
          <label>账号<input id="simpleLoginUsername" type="text" value="admin" autocomplete="username" /></label>
          <label>密码
            <span class="simple-password-row">
              <input id="simpleLoginPassword" type="password" value="" autocomplete="current-password" placeholder="请输入内测密码" />
              <button id="toggleSimpleLoginPassword" class="secondary-action" type="button">显示</button>
            </span>
          </label>
          <button id="simpleLoginSubmit" class="confirm-action" type="button">登录</button>
          <p class="v2-import-message ${message ? "warning" : ""}" id="simpleLoginMessage">${escapeHtml(message || "默认内测账号：admin；密码见发布说明或启动环境变量。")}</p>
        </section>
      </section>
    </main>
  `;
  document.getElementById("simpleLoginSubmit")?.addEventListener("click", loginSimpleAgent);
  document.getElementById("toggleSimpleLoginPassword")?.addEventListener("click", toggleSimpleLoginPassword);
  document.getElementById("simpleLoginPassword")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") loginSimpleAgent();
  });
}

function toggleSimpleLoginPassword() {
  const input = document.getElementById("simpleLoginPassword");
  const button = document.getElementById("toggleSimpleLoginPassword");
  if (!input || !button) return;
  const nextType = input.type === "password" ? "text" : "password";
  input.type = nextType;
  button.textContent = nextType === "password" ? "显示" : "隐藏";
}

async function loginSimpleAgent() {
  const username = valueOf("simpleLoginUsername");
  const password = valueOf("simpleLoginPassword");
  setMessage("simpleLoginMessage", "", "正在登录...");
  try {
    await apiJson("/api/simple-agent/login", { method: "POST", body: JSON.stringify({ username, password }) });
    window.location.reload();
  } catch (error) {
    setMessage("simpleLoginMessage", "warning", `登录失败：${error.message}`);
  }
}

async function logoutSimpleAgent() {
  try {
    await apiJson("/api/simple-agent/logout", { method: "POST", body: JSON.stringify({}) });
  } finally {
    window.location.reload();
  }
}

function confirmSimpleAgentAction({
  title = "确认操作",
  message = "请确认是否继续。",
  detail = "",
  confirmText = "确认",
  cancelText = "取消",
  danger = false,
} = {}) {
  let modal = document.getElementById("simpleAgentConfirmModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "simpleAgentConfirmModal";
    modal.className = "simple-modal simple-confirm-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="simple-modal-backdrop" data-confirm-cancel></div>
      <section class="simple-modal-panel simple-confirm-panel" role="dialog" aria-modal="true" aria-labelledby="simpleAgentConfirmTitle">
        <div class="simple-modal-head">
          <div>
            <span class="caption" id="simpleAgentConfirmCaption">CONFIRM</span>
            <h2 id="simpleAgentConfirmTitle"></h2>
          </div>
          <button type="button" data-confirm-cancel aria-label="关闭"></button>
        </div>
        <div class="simple-confirm-body">
          <p id="simpleAgentConfirmMessage"></p>
          <div class="simple-confirm-detail" id="simpleAgentConfirmDetail" hidden></div>
        </div>
        <div class="simple-confirm-actions">
          <button class="secondary-action" type="button" data-confirm-cancel></button>
          <button class="confirm-action" type="button" data-confirm-ok></button>
        </div>
      </section>
    `;
    document.body.appendChild(modal);
  }

  modal.querySelector("#simpleAgentConfirmCaption").textContent = danger ? "DANGER ACTION" : "CONFIRM";
  modal.querySelector("#simpleAgentConfirmTitle").textContent = title;
  modal.querySelector("#simpleAgentConfirmMessage").textContent = message;
  const detailNode = modal.querySelector("#simpleAgentConfirmDetail");
  detailNode.textContent = detail;
  detailNode.hidden = !detail;
  const okButton = modal.querySelector("[data-confirm-ok]");
  const cancelButtons = modal.querySelectorAll("[data-confirm-cancel]");
  okButton.textContent = confirmText;
  okButton.classList.toggle("danger", Boolean(danger));
  cancelButtons.forEach((button) => {
    if (button.matches("button")) button.textContent = cancelText;
  });

  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");

  return new Promise((resolve) => {
    const finish = (value) => {
      modal.classList.remove("active");
      modal.setAttribute("aria-hidden", "true");
      okButton.removeEventListener("click", onConfirm);
      cancelButtons.forEach((button) => button.removeEventListener("click", onCancel));
      document.removeEventListener("keydown", onKeyDown);
      resolve(value);
    };
    const onConfirm = () => finish(true);
    const onCancel = () => finish(false);
    const onKeyDown = (event) => {
      if (event.key === "Escape") finish(false);
    };
    okButton.addEventListener("click", onConfirm, { once: true });
    cancelButtons.forEach((button) => button.addEventListener("click", onCancel, { once: true }));
    document.addEventListener("keydown", onKeyDown);
  });
}

function initMaterialsPage() {
  initMaterialTabs();
  initImportMethodTabs();
  document.getElementById("saveAccount")?.addEventListener("click", saveAccount);
  document.getElementById("previewBatchMaterials")?.addEventListener("click", previewBatchMaterials);
  document.getElementById("confirmBatchMaterials")?.addEventListener("click", () => openConfirmImportDialog("excel"));
  document.getElementById("previewFeishuDoc")?.addEventListener("click", previewFeishuDoc);
  document.getElementById("saveFeishuDoc")?.addEventListener("click", () => openConfirmImportDialog("feishu"));
  document.getElementById("excelFileInput")?.addEventListener("change", handleExcelFileChange);
  document.getElementById("excelFileName")?.addEventListener("click", () => document.getElementById("excelFileInput")?.click());
  document.getElementById("materialSearchInput")?.addEventListener("input", (event) => {
    materialUiState.query = event.target.value.trim();
    syncMaterialSearchInputs(event.target);
    renderMaterials(simpleMaterialItems);
  });
  document.getElementById("materialGlobalSearch")?.addEventListener("input", (event) => {
    materialUiState.query = event.target.value.trim();
    syncMaterialSearchInputs(event.target);
    renderMaterials(simpleMaterialItems);
  });
  document.getElementById("materialPlatformFilter")?.addEventListener("change", (event) => {
    materialUiState.platform = event.target.value;
    renderMaterials(simpleMaterialItems);
  });
  document.getElementById("materialStatusFilter")?.addEventListener("change", (event) => {
    materialUiState.status = event.target.value;
    renderMaterials(simpleMaterialItems);
  });
  document.getElementById("materialFilterReset")?.addEventListener("click", resetMaterialFilters);
  document.getElementById("materialList")?.addEventListener("click", (event) => {
    const focusButton = event.target.closest("[data-focus-material-input]");
    if (focusButton) {
      document.getElementById("batchMaterials")?.focus();
      return;
    }
    if (event.target.id === "selectAllMaterials") {
      toggleAllVisibleMaterials(event.target.checked);
      return;
    }
    const rowCheckbox = event.target.closest("[data-material-row-select]");
    if (rowCheckbox) {
      toggleMaterialRowSelection(rowCheckbox.dataset.materialRowSelect, rowCheckbox.checked);
      return;
    }
    const previewButton = event.target.closest("[data-material-preview]");
    if (previewButton) {
      event.preventDefault();
      event.stopPropagation();
      openMaterialPreviewModal(previewButton.dataset.materialPreview);
      return;
    }
    const drawerButton = event.target.closest("[data-material-drawer]");
    if (drawerButton) {
      event.preventDefault();
      event.stopPropagation();
      openMaterialDetailDrawer(drawerButton.dataset.materialDrawer);
      return;
    }
    const action = event.target.closest("[data-material-view]");
    if (action) {
      event.preventDefault();
      event.stopPropagation();
      openMaterialViewModal(action.dataset.materialView);
      return;
    }
    const tagButton = event.target.closest("[data-material-tags]");
    if (tagButton) {
      event.preventDefault();
      event.stopPropagation();
      openMaterialTagModal(tagButton.dataset.materialTags);
      return;
    }
    const saveTagsButton = event.target.closest("[data-save-material-tags]");
    if (saveTagsButton) {
      event.preventDefault();
      event.stopPropagation();
      saveMaterialTags(saveTagsButton.dataset.saveMaterialTags);
      return;
    }
    const downloadButton = event.target.closest("[data-material-download]");
    if (downloadButton) {
      event.preventDefault();
      event.stopPropagation();
      downloadMaterialVideo(downloadButton.dataset.materialDownload, downloadButton);
      return;
    }
    const button = event.target.closest("[data-material-select]");
    if (button) toggleMaterial(button.dataset.materialSelect, button.dataset.selected === "true");
  });
  document.getElementById("materialTagModal")?.addEventListener("click", (event) => {
    const closeButton = event.target.closest("[data-close-modal]");
    if (closeButton) closeModal(closeButton.dataset.closeModal);
    const saveTagsButton = event.target.closest("[data-save-material-tags]");
    if (saveTagsButton) saveMaterialTags(saveTagsButton.dataset.saveMaterialTags);
  });
  document.getElementById("materialViewModal")?.addEventListener("click", (event) => {
    const closeButton = event.target.closest("[data-close-modal]");
    if (closeButton) closeModal(closeButton.dataset.closeModal);
  });
  document.getElementById("materialPreviewModal")?.addEventListener("click", (event) => {
    const closeButton = event.target.closest("[data-close-modal]");
    if (closeButton) closeModal(closeButton.dataset.closeModal);
  });
  document.getElementById("materialConfirmDialog")?.addEventListener("click", (event) => {
    const closeButton = event.target.closest("[data-close-modal]");
    if (closeButton) closeModal(closeButton.dataset.closeModal);
    const confirmButton = event.target.closest("[data-confirm-import]");
    if (confirmButton) runConfirmedImport(confirmButton.dataset.confirmImport);
  });
  document.querySelectorAll("[data-close-drawer='materialDetailDrawer']").forEach((button) => {
    button.addEventListener("click", closeMaterialDetailDrawer);
  });
  loadMaterials();
}

function initImportMethodTabs() {
  const tabContainer = document.querySelector("[aria-label='表格导入方式']");
  const tabButtons = [...document.querySelectorAll("[data-import-method-tab]")];
  const panels = [...document.querySelectorAll("[data-import-method-panel]")];
  if (!tabButtons.length || !panels.length) return;
  const activate = (name) => {
    tabButtons.forEach((button) => button.classList.toggle("active", button.dataset.importMethodTab === name));
    panels.forEach((panel) => panel.classList.toggle("active", panel.dataset.importMethodPanel === name));
  };
  tabContainer?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-import-method-tab]");
    if (!button) return;
    event.preventDefault();
    activate(button.dataset.importMethodTab);
    history.replaceState(null, "", button.dataset.importMethodTab === "feishuTable" ? "#feishu-table" : "#excel");
  });
  const activateFromHash = () => activate(window.location.hash.replace("#", "") === "feishu-table" ? "feishuTable" : "excel");
  activateFromHash();
  window.addEventListener("hashchange", activateFromHash);
}

function initCampaignTabs() {
  const tabContainer = document.querySelector("[aria-label='品牌信息录入方式']");
  const tabButtons = [...document.querySelectorAll("[data-campaign-tab]")];
  const panels = [...document.querySelectorAll("[data-campaign-panel]")];
  if (!tabButtons.length || !panels.length) return;
  const activate = (name) => {
    tabButtons.forEach((button) => button.classList.toggle("active", button.dataset.campaignTab === name));
    panels.forEach((panel) => panel.classList.toggle("active", panel.dataset.campaignPanel === name));
  };
  tabContainer?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-campaign-tab]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    activate(button.dataset.campaignTab);
  });
  activate("campaign");
}

function initCampaignRecordTabs() {
  const tabContainer = document.querySelector("[aria-label='已录入记录类型']");
  const tabButtons = [...document.querySelectorAll("[data-campaign-record-tab]")];
  const panels = [...document.querySelectorAll("[data-campaign-record-panel]")];
  const createActions = [...document.querySelectorAll("[data-record-create-action]")];
  if (!tabButtons.length || !panels.length) return;
  const activate = (name) => {
    tabButtons.forEach((button) => button.classList.toggle("active", button.dataset.campaignRecordTab === name));
    panels.forEach((panel) => panel.classList.toggle("active", panel.dataset.campaignRecordPanel === name));
    createActions.forEach((button) => button.classList.toggle("active", button.dataset.recordCreateAction === name));
    activateCampaignInputTab(name);
  };
  tabButtons.forEach((button) => button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    activate(button.dataset.campaignRecordTab);
  }));
  activate("campaign");
}

function initMaterialTabs() {
  const tabContainer = document.querySelector(".simple-material-tabs");
  const tabButtons = [...document.querySelectorAll("[data-material-tab]")];
  const panels = [...document.querySelectorAll("[data-material-panel]")];
  if (!tabButtons.length || !panels.length) return;
  let currentTab = "";
  const activate = (name) => {
    currentTab = name;
    tabButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.materialTab === name);
    });
    panels.forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.materialPanel === name);
    });
  };
  tabContainer?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-material-tab]");
    if (!button) return;
    event.preventDefault();
    activate(button.dataset.materialTab);
    history.replaceState(null, "", `#${button.dataset.materialTab}`);
  });
  window.addEventListener("hashchange", () => {
    const next = materialTabFromHash(window.location.hash.replace("#", ""));
    activate(next);
  });
  const hash = window.location.hash.replace("#", "");
  activate(materialTabFromHash(hash));
  window.setInterval(() => {
    const next = materialTabFromHash(window.location.hash.replace("#", ""));
    if (next !== currentTab) activate(next);
  }, 150);
}

function materialTabFromHash(hash) {
  return {
    batchMaterials: "links",
    feishuDocLink: "feishu",
    accountName: "account",
    materialTitle: "links",
    materialUrl: "links",
    excel: "feishu",
    "feishu-table": "feishu",
    single: "links",
    links: "links",
    feishu: "feishu",
    account: "account",
  }[hash] || "links";
}

function initGeneratePage() {
  initGenerationTaskPanel();
  initPromptConfigModal();
  bindScriptWorktableActions();
  initPromptTabs();
  seedPromptControls();
  loadGenerationInputs();
}

function initGenerationTaskPanel() {
  const card = document.querySelector(".generate-config-card");
  if (!card) return;
  card.addEventListener("change", syncGenerationChoiceState);
  card.addEventListener("input", handleGenerationPickerInput);
  card.addEventListener("click", handleGenerationPickerClick);
  document.getElementById("generationMaterialTabs")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-generation-platform-tab]");
    if (!button) return;
    event.preventDefault();
    generationPickerState.activeMaterialPlatform = button.dataset.generationPlatformTab || "";
    generationPickerState.materialPlatform = generationPickerState.activeMaterialPlatform;
    setValue("generationMaterialPlatform", generationPickerState.materialPlatform);
    renderGenerationMaterials(generationMaterialItems);
  });
  document.querySelector("[data-run-generation-from-summary]")?.addEventListener("click", runSimpleGeneration);
  document.querySelector("[data-clear-generation-selection]")?.addEventListener("click", clearGenerationSelection);
  document.querySelector("[data-close-material-input-preview]")?.addEventListener("click", closeMaterialInputPreviewDrawer);
}

function initPromptConfigModal() {
  const panel = document.getElementById("promptConfigPanel");
  const body = document.getElementById("promptConfigModalBody");
  if (panel && body && !body.children.length) {
    panel.classList.add("prompt-config-slim");
    panel.querySelector(".material-card-head")?.remove();
    panel.querySelector(".quality-control-stack")?.remove();
    panel.querySelector(".simple-quality-note")?.remove();
    const shell = document.createElement("div");
    shell.className = "prompt-config-workspace";
    shell.innerHTML = `
      <aside class="prompt-config-brief" aria-label="提示词配置说明">
        <span>配置范围</span>
        <strong>控制生成口径，不改变业务数据</strong>
        <p>这里保存的是生成服务读取的角色、结构、样例和风险边界。商品、价格、渠道和素材仍以当前输入包为准。</p>
        <ul>
          <li><b></b>角色和语气</li>
          <li><b></b>脚本结构</li>
          <li><b></b>样例参考</li>
          <li><b></b>风险禁用项</li>
        </ul>
      </aside>
      <section class="prompt-config-editor" aria-label="提示词编辑"></section>
    `;
    shell.querySelector(".prompt-config-editor")?.appendChild(panel);
    body.appendChild(shell);
  }
  document.getElementById("openPromptConfig")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openPromptConfigModal();
  });
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("#openPromptConfig");
    if (!trigger) return;
    event.preventDefault();
    event.stopPropagation();
    openPromptConfigModal();
  });
  document.getElementById("savePromptConfig")?.addEventListener("click", savePromptConfig);
  document.getElementById("promptConfigModal")?.addEventListener("click", (event) => {
    const closeButton = event.target.closest("[data-close-modal='promptConfigModal']");
    if (closeButton && event.currentTarget.contains(closeButton)) closeModal("promptConfigModal");
  });
}

function openPromptConfigModal() {
  const modal = document.getElementById("promptConfigModal");
  modal?.classList.add("active");
  modal?.setAttribute("aria-hidden", "false");
}

function handleGenerationPickerInput(event) {
  const target = event.target;
  if (!target?.id) return;
  if (target.id === "generationCampaignSearch") generationPickerState.campaignQuery = target.value.trim();
  if (target.id === "generationMaterialSearch") generationPickerState.materialQuery = target.value.trim();
  if (target.id === "generationMaterialUsableOnly") generationPickerState.materialUsableOnly = target.checked;
  if (target.id === "generationCampaignSearch" || target.id === "generationCampaignStatus") renderGenerationCampaigns(generationCampaignItems);
  if (target.id.startsWith("generationMaterial")) renderGenerationMaterials(generationMaterialItems);
}

function handleGenerationPickerClick(event) {
  const previewButton = event.target.closest("[data-generation-material-preview], #generationMaterials [data-material-preview]");
  if (previewButton) {
    event.preventDefault();
    openMaterialInputPreview(previewButton.dataset.generationMaterialPreview || previewButton.dataset.materialPreview);
    return;
  }
  const selectAll = event.target.closest("[data-generation-select-visible-materials]");
  if (selectAll) {
    event.preventDefault();
    setVisibleMaterialsChecked(true);
    return;
  }
  const clearVisible = event.target.closest("[data-generation-clear-visible-materials]");
  if (clearVisible) {
    event.preventDefault();
    setVisibleMaterialsChecked(false);
  }
}

function syncGenerationChoiceState(event) {
  const target = event.target;
  if (!target) return;
  if (target.id === "generationCampaignStatus") {
    generationPickerState.campaignStatus = target.value;
    renderGenerationCampaigns(generationCampaignItems);
    return;
  }
  if (target.id === "generationMaterialPlatform") {
    generationPickerState.materialPlatform = target.value;
    generationPickerState.activeMaterialPlatform = target.value;
    renderGenerationMaterials(generationMaterialItems);
    return;
  }
  if (target.id === "generationMaterialTag") {
    generationPickerState.materialTag = target.value;
    renderGenerationMaterials(generationMaterialItems);
    return;
  }
  if (target.id === "generationMaterialQuality") {
    generationPickerState.materialQuality = target.value;
    renderGenerationMaterials(generationMaterialItems);
    return;
  }
  if (target.id === "generationMaterialStatus") {
    generationPickerState.materialStatus = target.value;
    renderGenerationMaterials(generationMaterialItems);
    return;
  }
  const input = target.closest("#generationCampaigns input[type='checkbox'], #generationMaterials input[type='checkbox']");
  if (!input) return;
  const row = input.closest(".generation-selectable-row");
  row?.classList.toggle("selected", input.checked);
  if (row?.dataset.generationCampaignRow) {
    const item = generationCampaignItems.find((entry) => String(entry.id) === String(input.value));
    if (item) item.selected = input.checked;
  }
  if (row?.dataset.generationMaterialRow) {
    const item = generationMaterialItems.find((entry) => String(entry.id) === String(input.value));
    if (item) item.selected = input.checked;
  }
  updateSelectedInputSummary();
  updateGenerationPickerCounts();
}

function initScriptLibraryPage() {
  bindScriptWorktableActions();
  loadScriptLibraryPage();
}

function bindScriptWorktableActions() {
  const handleScriptActionClick = (event) => {
    const tabButton = event.target.closest("[data-script-preview-tab]");
    if (tabButton) {
      switchScriptPreviewTab(tabButton.dataset.scriptPreviewTab);
      return;
    }
    const previewButton = event.target.closest("[data-script-preview]");
    if (previewButton) {
      openScriptPreview(previewButton.dataset.scriptPreview);
      return;
    }
    const reviewButton = event.target.closest("[data-script-review]");
    if (reviewButton) {
      if (reviewButton.dataset.status === "rejected") {
        confirmScriptReject(reviewButton.dataset.scriptReview, reviewButton);
        return;
      }
      reviewScript(reviewButton.dataset.scriptReview, reviewButton.dataset.status, reviewButton.dataset.sample === "true", reviewButton);
      return;
    }
    const regenerateButton = event.target.closest("[data-script-regenerate]");
    if (regenerateButton) openRegenerateModal(regenerateButton.dataset.scriptRegenerate, regenerateButton);
  };
  document.getElementById("simpleScriptOutputs")?.addEventListener("click", handleScriptActionClick);
  document.getElementById("scriptPreviewDrawer")?.addEventListener("click", handleScriptActionClick);
  document.getElementById("confirmRegenerateScript")?.addEventListener("click", confirmRegenerateScript);
  document.getElementById("scriptRegenerateModal")?.addEventListener("click", (event) => {
    const closeButton = event.target.closest("[data-close-modal]");
    if (closeButton) closeModal(closeButton.dataset.closeModal);
  });
  document.querySelector("[data-script-preview-close]")?.addEventListener("click", () => closeScriptPreview());
}

async function confirmScriptReject(id, button) {
  const item = simpleScriptItems.find((script) => String(script.id) === String(id));
  const title = item?.title || item?.topic || "这条脚本";
  const confirmed = await confirmSimpleAgentAction({
    title: "弃用脚本",
    message: `确认弃用「${title}」？`,
    detail: "弃用后脚本仍保留在历史脚本库，但不会作为优质样例或推荐脚本使用。",
    confirmText: "确认弃用",
    danger: true,
  });
  if (!confirmed) return;
  reviewScript(id, "rejected", false, button);
}

function initPromptTabs() {
  const tabs = Array.from(document.querySelectorAll("[data-prompt-tab]"));
  if (!tabs.length) return;
  const activate = (name = "system") => {
    tabs.forEach((button) => {
      button.classList.toggle("active", button.dataset.promptTab === name);
      button.setAttribute("aria-selected", button.dataset.promptTab === name ? "true" : "false");
    });
    document.querySelectorAll("[data-prompt-panel]").forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.promptPanel === name);
    });
  };
  tabs.forEach((button) => {
    button.addEventListener("click", () => activate(button.dataset.promptTab));
  });
  activate(tabs.find((button) => button.classList.contains("active"))?.dataset.promptTab || "system");
}

function seedPromptControls() {
  const defaults = {
    systemPrompt: "你是本地生活/品牌团购短视频脚本策划。只输出可拍、可审核、可执行的短视频脚本，不编造价格、库存和活动权益。",
    generationPrompt: "先读取商品活动、素材字幕和脚本模板；学习素材结构，不复制原句。每条脚本必须有开头钩子、镜头动作、口播、字幕和 CTA。",
    qualityFormat: "输出为分镜脚本，包含：镜头、画面动作、口播、字幕、CTA。",
    qualitySamples: "优先学习优质样例的开头节奏、利益点顺序、场景转场和转化结构，不复刻原视频表达。",
    avoidRules: "不承诺最低价，不使用绝对化表述，不写未经确认的价格/库存/赠品，不搬运原视频文案。",
  };
  Object.entries(defaults).forEach(([id, text]) => {
    const node = document.getElementById(id);
    if (node && !node.value) node.value = text;
  });
  loadPromptConfig();
}

function loadPromptConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(PROMPT_CONFIG_STORAGE_KEY) || "{}");
    if (!saved || typeof saved !== "object") return;
    PROMPT_CONFIG_FIELDS.forEach((id) => {
      if (typeof saved[id] === "string") setValue(id, saved[id]);
    });
  } catch (error) {
    console.warn("load prompt config failed", error);
  }
}

function savePromptConfig() {
  const values = {};
  PROMPT_CONFIG_FIELDS.forEach((id) => {
    values[id] = valueOf(id);
  });
  localStorage.setItem(PROMPT_CONFIG_STORAGE_KEY, JSON.stringify(values));
  setMessage("promptConfigMessage", "success", "提示词配置已保存，本次和后续生成都会读取。");
  const button = document.getElementById("savePromptConfig");
  if (!button) return;
  const original = button.textContent;
  button.textContent = "已保存";
  button.disabled = true;
  window.setTimeout(() => {
    button.textContent = original || "保存配置";
    button.disabled = false;
  }, 1200);
}

function initCampaignsPage() {
  initCampaignTabs();
  initCampaignRecordTabs();
  bindCampaignModalButtons();
  document.addEventListener("click", handleCampaignModalOpen);
  document.getElementById("campaignInputModal")?.addEventListener("click", (event) => {
    const closeButton = event.target.closest("[data-close-modal]");
    if (closeButton) closeModal(closeButton.dataset.closeModal);
  });
  document.getElementById("saveCampaign")?.addEventListener("click", saveCampaign);
  document.getElementById("saveMatrixAccount")?.addEventListener("click", saveMatrixAccount);
  document.getElementById("campaignList")?.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-campaign-edit]");
    if (editButton) {
      openCampaignEditModal(editButton.dataset.campaignEdit);
      return;
    }
    const deleteButton = event.target.closest("[data-campaign-delete]");
    if (deleteButton) {
      deleteCampaign(deleteButton.dataset.campaignDelete);
    }
  });
  loadCampaigns();
}

function bindCampaignModalButtons() {
  document.querySelectorAll("[data-open-campaign-modal]").forEach((button) => {
    button.dataset.modalBound = "true";
    button.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      openCampaignInputModal(button.dataset.openCampaignModal);
    };
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openCampaignInputModal(button.dataset.openCampaignModal);
    });
  });
}

function handleCampaignModalOpen(event) {
  const button = event.target.closest("[data-open-campaign-modal]");
  if (!button) return;
  event.preventDefault();
  openCampaignInputModal(button.dataset.openCampaignModal);
}

function openCampaignInputModal(tabName = "campaign") {
  const modal = document.getElementById("campaignInputModal");
  if (!modal) return;
  if (tabName === "campaign") resetCampaignEditState();
  activateCampaignInputTab(tabName === "matrix" ? "matrix" : "campaign");
  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");
}

window.openCampaignInputModal = openCampaignInputModal;

function activateCampaignInputTab(name) {
  const tabName = name === "matrix" ? "matrix" : "campaign";
  document.querySelectorAll("[data-campaign-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.campaignTab === tabName);
  });
  document.querySelectorAll("[data-campaign-panel]").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.campaignPanel === tabName);
  });
  if (!editingCampaignId) {
    const title = document.getElementById("campaignInputModalTitle");
    if (title) title.textContent = tabName === "matrix" ? "新增品牌矩阵号" : "新增品牌活动商品";
  }
}

async function apiJson(path, options = {}) {
  const response = await fetch(`${SIMPLE_API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    credentials: "include",
    ...options,
  });
  const data = await response.json();
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return data;
}

async function loadMaterials() {
    setStatus("simpleAgentStatus", "pending", "正在读取素材库...");
  renderMaterialLoadingState();
  try {
    const data = await apiJson("/api/simple-agent/materials");
    setStatus("simpleAgentStatus", "online", `${data.stats.adminScope ? "管理员全量素材库" : "素材库"}已连接：${data.stats.total} 条素材`);
    renderMaterialStats(data.stats);
    renderMaterials(data.items || []);
    renderAccounts(data.accounts || []);
  } catch (error) {
    setStatus("simpleAgentStatus", "offline", `读取失败：${error.message}`);
    showMaterialToast("error", "素材库读取失败", error.message);
  }
}

function renderMaterialStats(stats = {}) {
  const node = document.getElementById("materialStats");
  if (!node) return;
  const total = stats.total || 0;
  const learned = stats.learned || 0;
  const selected = stats.selected || 0;
  const accounts = stats.accounts || 0;
  const pending = Number(stats.pending || stats.processing || Math.max(total - learned, 0));
  const duplicate = Number(stats.duplicate || stats.duplicates || 0);
  node.innerHTML = `
    <div class="material-overview-copy">
      <span class="material-overview-icon" aria-hidden="true"><i></i></span>
      <div>
        <span class="caption">MATERIAL OPERATIONS</span>
        <h2>素材资产总览</h2>
        <p>集中管理视频、文案和参考账号，筛选后可直接进入脚本生成输入包。</p>
      </div>
    </div>
    <div class="material-overview-metrics">
      ${materialMetricCard(["全部素材", total, "当前账号可见素材", "blue"])}
      ${materialMetricCard(["已入库", learned || total, "可用于脚本生成", "green"])}
      ${materialMetricCard(["解析中", pending, pending ? "等待视频或字幕处理" : "暂无排队任务", pending ? "amber" : "green"])}
      ${materialMetricCard(["本次使用", selected || 0, "已加入生成输入", "indigo"])}
      ${materialMetricCard(["重复素材", duplicate, duplicate ? "已标记重复链接" : "未发现重复", duplicate ? "amber" : "slate"])}
      ${materialMetricCard(["参考账号", accounts, "长期跟踪账号", "cyan"])}
    </div>
  `;
}

function renderMaterials(items) {
  simpleMaterialItems = items || [];
  const node = document.getElementById("materialList");
  if (!node) return;
  const visibleItems = filteredMaterialItems();
  reconcileSelectedMaterials();
  document.getElementById("materialLibraryCount") && (document.getElementById("materialLibraryCount").textContent = String(visibleItems.length));
  node.innerHTML = items.length ? materialTable(visibleItems) : materialEmptyState();
  updateMaterialToolbarState(visibleItems);
  bindMaterialRecordActions();
  renderMaterialProcessingState();
}

function bindMaterialRecordActions() {
  document.querySelectorAll("[data-material-view]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openMaterialViewModal(button.dataset.materialView);
    });
  });
  document.querySelectorAll("[data-material-tags]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openMaterialTagModal(button.dataset.materialTags);
    });
  });
  bindTagSuggestionButtons(document);
}

function materialMetricCard([label, value, note, tone = "blue"]) {
  return `
    <article class="material-kpi-card tone-${escapeHtml(tone)}">
      <span><i aria-hidden="true"></i>${escapeHtml(label)}</span>
      <strong>${Number(value || 0).toLocaleString("zh-CN")}</strong>
      ${note ? `<p>${escapeHtml(note)}</p>` : ""}
    </article>
  `;
}

function filteredMaterialItems() {
  const query = materialUiState.query.toLowerCase();
  return simpleMaterialItems.filter((item) => {
    const searchable = [
      item.title,
      item.url,
      item.sourceOriginalUrl,
      item.accountName,
      item.category,
      item.rawText,
      ...(item.tags || []),
    ].join(" ").toLowerCase();
    const platformOk = !materialUiState.platform || item.platform === materialUiState.platform;
    const statusOk = !materialUiState.status || item.status === materialUiState.status;
    const queryOk = !query || searchable.includes(query);
    return platformOk && statusOk && queryOk;
  });
}

function syncMaterialSearchInputs(source) {
  ["materialSearchInput", "materialGlobalSearch"].forEach((id) => {
    const input = document.getElementById(id);
    if (input && input !== source) input.value = materialUiState.query;
  });
}

function resetMaterialFilters() {
  materialUiState.query = "";
  materialUiState.platform = "";
  materialUiState.status = "";
  ["materialSearchInput", "materialGlobalSearch", "materialPlatformFilter", "materialStatusFilter"].forEach((id) => {
    const input = document.getElementById(id);
    if (input) input.value = "";
  });
  renderMaterials(simpleMaterialItems);
}

function reconcileSelectedMaterials() {
  const existing = new Set(simpleMaterialItems.map((item) => String(item.id)));
  [...materialUiState.selectedIds].forEach((id) => {
    if (!existing.has(id)) materialUiState.selectedIds.delete(id);
  });
}

function updateMaterialToolbarState(visibleItems = filteredMaterialItems()) {
  const count = materialUiState.selectedIds.size;
  const selectedCount = document.getElementById("selectedMaterialCount");
  if (selectedCount) selectedCount.textContent = String(count);
  const bulkActions = document.getElementById("materialBulkActions");
  if (bulkActions) bulkActions.classList.toggle("active", count > 0);
  document.querySelectorAll("#materialBulkActions button").forEach((button) => {
    button.disabled = count === 0;
  });
  const selectAll = document.getElementById("selectAllMaterials");
  if (selectAll) {
    const visibleIds = visibleItems.map((item) => String(item.id));
    const allSelected = Boolean(visibleIds.length) && visibleIds.every((id) => materialUiState.selectedIds.has(id));
    selectAll.checked = allSelected;
    selectAll.indeterminate = !allSelected && visibleIds.some((id) => materialUiState.selectedIds.has(id));
  }
}

function toggleMaterialRowSelection(id, selected) {
  if (selected) materialUiState.selectedIds.add(String(id));
  else materialUiState.selectedIds.delete(String(id));
  renderMaterials(simpleMaterialItems);
}

function toggleAllVisibleMaterials(selected) {
  filteredMaterialItems().forEach((item) => {
    if (selected) materialUiState.selectedIds.add(String(item.id));
    else materialUiState.selectedIds.delete(String(item.id));
  });
  renderMaterials(simpleMaterialItems);
}

function renderMaterialLoadingState() {
  const node = document.getElementById("materialList");
  if (!node) return;
  node.innerHTML = `
    <div class="material-skeleton-table">
      ${Array.from({ length: 5 }).map(() => `
        <div>
          <span></span><strong></strong><em></em><b></b>
        </div>
      `).join("")}
    </div>
  `;
}

function renderMaterialProcessingState() {
  const node = document.getElementById("materialProcessingState");
  if (!node) return;
  const processing = simpleMaterialItems.filter((item) => {
    const summary = processingSummary(item.processing || {});
    return item.status === "pending" || item.status === "pending_text" || summary?.level === "pending";
  }).slice(0, 3);
  node.hidden = !processing.length;
  node.innerHTML = processing.length ? `
    <strong>解析中状态</strong>
    <div>
      ${processing.map((item, index) => `
        <span>${escapeHtml(item.title)} <b>${Math.min(82, 28 + index * 18)}%</b></span>
      `).join("")}
    </div>
  ` : "";
}

function materialEmptyState(title = "还没有素材", note = "录入视频链接后，会在这里形成可搜索、可筛选、可复用的长期素材库。") {
  return `
    <article class="material-empty-state">
      <div></div>
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(note)}</p>
      <button class="confirm-action" type="button" data-focus-material-input>录入素材</button>
    </article>
  `;
}

function materialDuration(item) {
  const knownDuration = Number(item.durationSeconds || item.duration || 0);
  if (knownDuration > 0) return formatMaterialDuration(knownDuration);
  const processing = item.processing || {};
  const parse = processing.parse || {};
  const subtitle = processing.subtitle || {};
  const download = processing.download || {};
  const duration = parse.duration || parse.durationSeconds || parse.videoDuration || subtitle.duration || subtitle.durationSeconds || subtitle.videoDuration || download.duration || download.durationSeconds || processing.duration || processing.durationSeconds || "";
  if (duration) return formatMaterialDuration(duration);
  return item.videoPreviewUrl ? "可预览" : "待下载";
}

function formatMaterialDuration(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.includes(":")) return raw;
  const numeric = Number(raw);
  if (!Number.isFinite(numeric) || numeric <= 0) return "";
  const seconds = Math.round(numeric > 1000 ? numeric / 1000 : numeric);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function materialThumbHtml(item, large = false) {
  const hasVideo = Boolean(item.videoPreviewUrl);
  const hasText = Boolean((item.rawText || "").trim());
  const meta = hasVideo ? materialDuration(item) : hasText ? "已提取" : "待下载";
  const className = ["material-thumb", large ? "large" : "", hasVideo ? "video" : hasText ? "text" : "pending"].filter(Boolean).join(" ");
  return `
    <button class="${className}" type="button" data-material-preview="${item.id}" aria-label="预览 ${escapeHtml(item.title || "素材")}">
      <span class="material-thumb-icon" aria-hidden="true"></span>
      <span class="material-thumb-meta">${escapeHtml(meta)}</span>
    </button>
  `;
}

function shortUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return String(url || "").slice(0, 24);
  }
}

function platformBadgeHtml(platform) {
  const label = {
    douyin: "抖音",
    xhs: "小红书",
    third_party: "第三方",
  }[platform] || platform || "未知";
  return `<span class="material-platform-badge ${escapeHtml(platform || "unknown")}">${escapeHtml(label)}</span>`;
}

function materialTypeLabel(item) {
  if (item.videoPreviewUrl) return "视频";
  if ((item.rawText || "").trim()) return "文案";
  return "待处理";
}

function materialTable(items) {
  if (!items.length) return materialEmptyState("没有匹配的素材", "调整搜索词、平台或状态筛选后再试。");
  const visibleIds = items.map((item) => String(item.id));
  const allSelected = Boolean(visibleIds.length) && visibleIds.every((id) => materialUiState.selectedIds.has(id));
  return `
    <div class="simple-material-records material-records-table">
      <table>
        <thead>
          <tr>
            <th class="check-col"><input id="selectAllMaterials" type="checkbox" ${allSelected ? "checked" : ""} /></th>
            <th>预览</th>
            <th>标题</th>
            <th>平台</th>
            <th>类型</th>
            <th>时长</th>
            <th>归属用户</th>
            <th>状态</th>
            <th>入库时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>${items.map(materialRow).join("")}</tbody>
      </table>
    </div>
    <div class="simple-material-detail" id="materialDetail"></div>
  `;
}

function materialRow(item) {
  const processing = processingSummary(item.processing || {});
  const status = materialStatusLabel(item.status);
  const duration = materialDuration(item);
  const originalUrl = item.sourceOriginalUrl || item.url || "";
  const selected = materialUiState.selectedIds.has(String(item.id));
  return `
    <tr class="${selected ? "selected" : ""}">
      <td class="check-col">
        <input type="checkbox" data-material-row-select="${item.id}" ${selected ? "checked" : ""} />
      </td>
      <td>
        ${materialThumbHtml(item)}
      </td>
      <td>
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.category || "未分类")}${originalUrl ? ` / ${escapeHtml(shortUrl(originalUrl))}` : ""}</small>
      </td>
      <td>${platformBadgeHtml(item.platform)}</td>
      <td><span class="material-type-chip">${escapeHtml(materialTypeLabel(item))}</span></td>
      <td><span class="material-duration-label">${escapeHtml(duration)}</span></td>
      <td>${ownerCellHtml(item)}</td>
      <td><span class="simple-record-status ${processing?.level || "pending"}">${escapeHtml(processing?.text || status)}</span></td>
      <td>${escapeHtml(formatDateTime(item.createdAt))}</td>
      <td>
        <div class="simple-record-actions">
          <button type="button" data-material-preview="${item.id}">预览</button>
          <button type="button" data-material-download="${item.id}" ${originalUrl ? "" : "disabled"}>下载本地</button>
          <button type="button" data-material-select="${item.id}" data-selected="${item.selected ? "false" : "true"}">
            ${item.selected ? "移出" : "加入"}
          </button>
          <button type="button" data-material-drawer="${item.id}">详情</button>
        </div>
      </td>
    </tr>
  `;
}

async function downloadMaterialVideo(id, button) {
  if (!id || !button) return;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "下载中";
  try {
    const data = await apiJson(`/api/simple-agent/materials/${id}/download`, { method: "POST", body: JSON.stringify({}) });
    const bytes = Number(data.download?.bytes || 0);
    const sizeText = bytes ? `，${formatFileSize(bytes)}` : "";
    showMaterialToast("success", "视频已下载", `已保存到本地素材目录${sizeText}。`);
    await loadMaterials();
  } catch (error) {
    button.disabled = false;
    button.textContent = originalText || "下载本地";
    showMaterialToast("error", "下载失败", error.message);
  }
}

function formatFileSize(bytes) {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return "";
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))}KB`;
  return `${(value / 1024 / 1024).toFixed(1)}MB`;
}

function materialTagEditorHtml(item, options = {}) {
  const suggested = suggestMaterialTags(item);
  const wrapInDetails = options.wrapInDetails !== false;
  const content = `
    <div class="simple-tag-editor-box">
      <div>
        <strong>标签逻辑</strong>
        <p>标签来自分享文案 #话题、Excel/飞书标签字段，也可以在这里人工补充。生成脚本时会用它判断素材结构和可复用角度。</p>
      </div>
      <label>分类<input id="materialCategory-${item.id}" type="text" value="${escapeHtml(item.category || "")}" placeholder="例如：省钱技巧 / 门店种草 / 转化话术" /></label>
      <label>标签<input id="materialTags-${item.id}" type="text" value="${escapeHtml((item.tags || []).join(", "))}" placeholder="例如：省钱, 门店场景, 转化CTA" /></label>
      <div class="simple-tag-suggestions">
        ${suggested.map((tag) => `<button type="button" data-tag-suggestion="${escapeHtml(tag)}" data-target-tags="materialTags-${item.id}">${escapeHtml(tag)}</button>`).join("") || "<span>暂无自动建议</span>"}
      </div>
      <button type="button" class="secondary-action" data-save-material-tags="${item.id}">保存标签</button>
      <p class="v2-import-message" id="materialTagsMessage-${item.id}">可手动输入多个标签，用逗号隔开。</p>
    </div>
  `;
  if (!wrapInDetails) return content;
  return `
    <details class="simple-material-tag-editor">
      <summary>编辑标签</summary>
      ${content}
    </details>
  `;
}

function openMaterialTagModal(id) {
  const item = simpleMaterialItems.find((entry) => String(entry.id) === String(id));
  const modal = document.getElementById("materialTagModal");
  const body = document.getElementById("materialTagModalBody");
  if (!item || !modal || !body) return;
  body.innerHTML = `
    <div class="simple-modal-context">
      <strong>${escapeHtml(item.title)}</strong>
      <p>${escapeHtml(item.accountName || "未识别账号")} / ${escapeHtml(item.platform)} / ${escapeHtml(item.category || "未分类")}</p>
    </div>
    ${materialTagEditorHtml(item, { wrapInDetails: false })}
  `;
  bindTagSuggestionButtons(body);
  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  if (modal.classList.contains("campaign-design-drawer")) {
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
    resetCampaignEditState();
    setMessage("campaignMessage", "", "填写后点击确认保存。");
    setMessage("matrixAccountMessage", "", "填写后点击确认保存。");
    return;
  }
  modal.classList.remove("active");
  modal.setAttribute("aria-hidden", "true");
}

function suggestMaterialTags(item) {
  const text = [
    item.title,
    item.category,
    item.rawText,
    item.note,
    ...(item.tags || []),
  ].join(" ");
  const rules = [
    ["开头钩子", /开头|前三秒|钩子|吸引|注意/],
    ["省钱", /省钱|便宜|优惠|折扣|券|团购/],
    ["门店场景", /门店|到店|探店|试穿|线下/],
    ["商品卖点", /轻便|百搭|透气|显瘦|舒适|耐穿|新品/],
    ["转化CTA", /下单|领取|点击|进店|预约|核销|购买/],
    ["口播结构", /口播|字幕|镜头|分镜|表达/],
  ];
  const current = new Set(item.tags || []);
  rules.forEach(([tag, pattern]) => {
    if (pattern.test(text)) current.add(tag);
  });
  return [...current].slice(0, 8);
}

function renderMaterialTagEditor(id) {
  const item = simpleMaterialItems.find((entry) => String(entry.id) === String(id));
  if (!item) return;
  const node = document.getElementById(`materialTagEditor-${id}`);
  if (!node) return;
  const suggested = suggestMaterialTags(item);
  node.innerHTML = `
    <div class="simple-tag-editor-box">
      <div>
        <strong>标签逻辑</strong>
        <p>标签来自分享文案 #话题、Excel/飞书标签字段，也可以在这里人工补充。生成脚本时会用它判断素材结构和可复用角度。</p>
      </div>
      <label>分类<input id="materialCategory-${id}" type="text" value="${escapeHtml(item.category || "")}" placeholder="例如：省钱技巧 / 门店种草 / 转化话术" /></label>
      <label>标签<input id="materialTags-${id}" type="text" value="${escapeHtml((item.tags || []).join(", "))}" placeholder="例如：省钱, 门店场景, 转化CTA" /></label>
      <div class="simple-tag-suggestions">
        ${suggested.map((tag) => `<button type="button" data-tag-suggestion="${escapeHtml(tag)}" data-target-tags="materialTags-${id}">${escapeHtml(tag)}</button>`).join("") || "<span>暂无自动建议</span>"}
      </div>
      <button type="button" class="secondary-action" data-save-material-tags="${id}">保存标签</button>
      <p class="v2-import-message" id="materialTagsMessage-${id}">可手动输入多个标签，用逗号隔开。</p>
    </div>
  `;
  bindTagSuggestionButtons(node);
}

function bindTagSuggestionButtons(root) {
  root.querySelectorAll("[data-tag-suggestion]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.targetTags);
      if (!input) return;
      const tags = new Set(input.value.split(/[,，、]/).map((tag) => tag.trim()).filter(Boolean));
      tags.add(button.dataset.tagSuggestion);
      input.value = [...tags].join(", ");
    });
  });
}

async function saveMaterialTags(id) {
  const messageId = `materialTagsMessage-${id}`;
  setMessage(messageId, "", "正在保存标签...");
  try {
    await apiJson(`/api/simple-agent/materials/${id}/tags`, {
      method: "POST",
      body: JSON.stringify({
        category: valueOf(`materialCategory-${id}`),
        tags: valueOf(`materialTags-${id}`),
      }),
    });
    setMessage(messageId, "ok", "标签已保存。");
    closeModal("materialTagModal");
    await loadMaterials();
  } catch (error) {
    setMessage(messageId, "warning", `保存失败：${error.message}`);
  }
}

function openMaterialViewModal(id) {
  const item = simpleMaterialItems.find((entry) => String(entry.id) === String(id));
  const modal = document.getElementById("materialViewModal");
  const body = document.getElementById("materialViewModalBody");
  if (!item || !modal || !body) return;
  const videoUrl = item.videoPreviewUrl ? `${SIMPLE_API_BASE}${item.videoPreviewUrl}` : "";
  const sourceOriginalUrl = item.sourceOriginalUrl || item.url || "";
  body.innerHTML = `
    <div class="simple-modal-context">
      <strong>${escapeHtml(item.title)}</strong>
      <p>${escapeHtml(item.accountName || "未识别账号")} / ${escapeHtml(item.platform)} / ${escapeHtml(formatDateTime(item.createdAt))}</p>
    </div>
    <div class="simple-material-inline-detail">
      ${videoUrl ? `<video controls src="${videoUrl}"></video>` : `<p>还没有可预览的视频。</p>`}
      <div>
        <div class="simple-tags compact">${(item.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("") || "<span>未打标签</span>"}</div>
        <div class="simple-material-script">
          <b>原始链接</b>
          <p>${sourceOriginalUrl ? `<a href="${escapeHtml(sourceOriginalUrl)}" target="_blank" rel="noreferrer">${escapeHtml(sourceOriginalUrl)}</a>` : "未保存原始链接。"}</p>
          ${item.url && item.url !== sourceOriginalUrl ? `<b>规范链接</b><p><a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.url)}</a></p>` : ""}
        </div>
        <div class="simple-material-script">
          <b>字幕/脚本素材</b>
          <p>${escapeHtml(item.rawText || "还没有提取到字幕。")}</p>
        </div>
      </div>
    </div>
  `;
  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");
}

function materialStatusLabel(status) {
  return {
    learned: "已学习",
    reusable: "可复用",
    pending_text: "待补字幕",
    pending: "处理中",
    failed: "处理失败",
  }[status] || "已入库";
}

function processingSummary(processing) {
  if (!processing || !processing.mode) return null;
  const download = processing.download || {};
  const subtitle = processing.subtitle || {};
  const warnings = processing.warnings || [];
  const parts = [];
  if (download.status === "success") parts.push("视频已下载");
  if (subtitle.status === "success") parts.push("字幕已提取");
  if (warnings.length) return { level: "warning", text: `处理有失败：${warnings[0]}` };
  if (parts.length) return { level: "ok", text: parts.join(" / ") };
  return { level: "pending", text: "已保存，等待处理结果" };
}

function renderAccounts(items) {
  const node = document.getElementById("accountList");
  if (!node) return;
  node.innerHTML = items.length ? `
    <div class="material-account-table">
      ${items.map(accountRowHtml).join("")}
    </div>
  ` : materialAccountEmptyState();
}

function accountRowHtml(item) {
  const patterns = (item.patterns || []).slice(0, 4).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
  const platform = {
    douyin: "抖音",
    xhs: "小红书",
    third_party: "第三方",
  }[item.platform] || item.platform || "未知";
  return `
    <article class="material-account-row">
      <div class="material-account-main">
        <span class="material-account-platform ${escapeHtml(item.platform || "unknown")}">${escapeHtml(platform)}</span>
        <div>
          <strong>${escapeHtml(item.accountName)}</strong>
          <small>${escapeHtml(item.category || "未分类")}${item.accountUrl ? ` / ${escapeHtml(shortUrl(item.accountUrl))}` : ""}</small>
        </div>
      </div>
      <div class="material-account-patterns">${patterns || "<span>待补结构</span>"}</div>
      <p>${escapeHtml(item.whyTrack || "待补充为什么参考。")}</p>
      <div class="material-account-meta">
        ${ownerCellHtml(item)}
        <span class="simple-record-status ok">${escapeHtml(item.status || "active")}</span>
      </div>
    </article>
  `;
}

function materialAccountEmptyState() {
  return `
    <article class="material-account-empty">
      <strong>还没有参考账号</strong>
      <p>先保存长期要看的达人、门店号或品牌号。</p>
    </article>
  `;
}

async function saveAccount() {
  const payload = {
    accountName: valueOf("accountName"),
    platform: valueOf("accountPlatform"),
    accountUrl: valueOf("accountUrl"),
    category: valueOf("accountCategory"),
    whyTrack: valueOf("accountWhy"),
    patterns: valueOf("accountPatterns"),
  };
  setMessage("accountMessage", "", "正在保存参考账号...");
  try {
    const data = await apiJson("/api/simple-agent/accounts", { method: "POST", body: JSON.stringify(payload) });
    setMessage("accountMessage", "ok", `已保存参考账号：${data.item.accountName}`);
    ["accountName", "accountUrl", "accountCategory", "accountWhy", "accountPatterns"].forEach(clearValue);
    await loadMaterials();
  } catch (error) {
    setMessage("accountMessage", "warning", `保存失败：${error.message}`);
  }
}

function renderPreviewList(targetId, rows) {
  const node = document.getElementById(targetId);
  if (!node) return;
  node.innerHTML = rows.length ? rows.map((row) => `
    <article class="${row.duplicate ? "duplicate" : ""}" data-preview-row="${escapeHtml(row.line || "")}">
      <div class="material-preview-row-main">
        <span class="material-preview-thumb">${escapeHtml(row.platform || "视频")}</span>
        <div>
          <strong>${escapeHtml(row.title || "未填标题")}</strong>
          <p>${escapeHtml(row.url || "缺少链接")}</p>
          <small>${escapeHtml([row.accountName, row.platform, row.category, row.tags].filter(Boolean).join(" / ") || "待补分类标签")}</small>
        </div>
      </div>
      ${row.duplicate ? `<small class="duplicate-note">${escapeHtml(row.duplicateReason || "已存在，将跳过重复下载")}</small>` : ""}
      ${row.note ? `<small>${escapeHtml(row.note)}</small>` : ""}
    </article>
  `).join("") : "";
}

function updateExcelFileName() {
  const input = document.getElementById("excelFileInput");
  const fileName = input?.files?.[0]?.name || "未选择文件";
  const node = document.getElementById("excelFileName");
  if (node) {
    node.textContent = fileName;
    node.classList.toggle("has-file", Boolean(input?.files?.[0]));
  }
}

function handleExcelFileChange() {
  updateExcelFileName();
  if (document.getElementById("excelFileInput")?.files?.[0]) previewExcelFile();
}

async function previewBatchMaterials() {
  setMessage("batchMessage", "", "正在解析链接列表...");
  try {
    const data = await apiJson("/api/simple-agent/materials/batch-preview", {
      method: "POST",
      body: JSON.stringify({ batchText: valueOf("batchMaterials"), selected: true }),
    });
    materialPreviewState.excel = data.rows || [];
    renderPreviewList("batchPreviewList", materialPreviewState.excel);
    document.getElementById("confirmBatchMaterials").disabled = !materialPreviewState.excel.length;
    setMessage("batchMessage", materialPreviewState.excel.length ? "ok" : "warning", `已解析 ${data.total} 条，请确认后再下载入库。`);
    if (materialPreviewState.excel.length) openPreviewRowsModal("excel");
    showMaterialToast(materialPreviewState.excel.length ? "success" : "warning", "链接识别完成", `识别到 ${data.total} 条素材。`);
  } catch (error) {
    setMessage("batchMessage", "warning", `预览失败：${error.message}`);
    showMaterialToast("error", "预览失败", error.message);
  }
}

async function previewFeishuDoc() {
  const payload = {
    feishuUrl: valueOf("feishuDocLink"),
    platform: "douyin",
    selected: true,
  };
  setMessage("feishuDocMessage", "", "正在读取飞书多维表格链接列表...");
  try {
    const data = await apiJson("/api/simple-agent/materials/feishu-base-preview", { method: "POST", body: JSON.stringify(payload) });
    materialPreviewState.feishu = data.rows || [];
    renderPreviewList("feishuPreviewList", materialPreviewState.feishu);
    document.getElementById("saveFeishuDoc").disabled = !materialPreviewState.feishu.length;
    setMessage("feishuDocMessage", materialPreviewState.feishu.length ? "ok" : "warning", `已读取 ${data.total} 条，请确认后再下载入库。`);
    if (materialPreviewState.feishu.length) openPreviewRowsModal("feishu");
    showMaterialToast(materialPreviewState.feishu.length ? "success" : "warning", "表格读取完成", `读取到 ${data.total} 条素材。`);
  } catch (error) {
    setMessage("feishuDocMessage", "warning", `读取失败：${error.message}`);
    showMaterialToast("error", "读取失败", error.message);
  }
}

async function previewExcelFile() {
  const input = document.getElementById("excelFileInput");
  const file = input?.files?.[0];
  if (!file) return;
  setMessage("feishuDocMessage", "", "正在读取 Excel 文件...");
  try {
    const dataUrl = await readFileAsDataUrl(file);
    const data = await apiJson("/api/simple-agent/materials/excel-preview", {
      method: "POST",
      body: JSON.stringify({
        filename: file.name,
        dataUrl,
        platform: "douyin",
      }),
    });
    materialPreviewState.feishu = data.rows || [];
    renderPreviewList("feishuPreviewList", materialPreviewState.feishu);
    document.getElementById("saveFeishuDoc").disabled = !materialPreviewState.feishu.length;
    setMessage("feishuDocMessage", materialPreviewState.feishu.length ? "ok" : "warning", `Excel 已读取 ${data.total} 条，请确认后再下载入库。`);
    if (materialPreviewState.feishu.length) openPreviewRowsModal("feishu");
    showMaterialToast(materialPreviewState.feishu.length ? "success" : "warning", "Excel 读取完成", `读取到 ${data.total} 条素材。`);
  } catch (error) {
    setMessage("feishuDocMessage", "warning", `Excel 读取失败：${error.message}`);
    showMaterialToast("error", "Excel 读取失败", error.message);
  }
}

async function confirmPreviewImport(kind) {
  const rows = materialPreviewState[kind] || [];
  const messageId = kind === "feishu" ? "feishuDocMessage" : "batchMessage";
  const listId = kind === "feishu" ? "feishuPreviewList" : "batchPreviewList";
  const confirmId = kind === "feishu" ? "saveFeishuDoc" : "confirmBatchMaterials";
  if (!rows.length) {
    setMessage(messageId, "warning", "请先预览链接列表。");
    return;
  }
  setMessage(messageId, "", `正在处理 ${rows.length} 条视频，请稍等...`);
  try {
    const data = await apiJson("/api/simple-agent/materials/process-batch", {
      method: "POST",
      body: JSON.stringify({ rows, selected: true }),
    });
    const skippedText = data.skipped ? `，跳过重复 ${data.skipped} 条` : "";
    setMessage(messageId, data.failed ? "warning" : "ok", `处理完成：新增 ${data.success} 条${skippedText}，失败 ${data.failed} 条`);
    materialPreviewState[kind] = [];
    renderPreviewList(listId, []);
    document.getElementById(confirmId).disabled = true;
    if (kind === "excel") clearValue("batchMaterials");
    if (kind === "feishu") ["feishuDocLink"].forEach(clearValue);
    await loadMaterials();
    showMaterialToast(data.failed ? "warning" : "success", "入库完成", `新增 ${data.success} 条，跳过 ${data.skipped || 0} 条，失败 ${data.failed} 条。`);
  } catch (error) {
    setMessage(messageId, "warning", `处理失败：${error.message}`);
    showMaterialToast("error", "入库失败", error.message);
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

function openPreviewRowsModal(kind) {
  const rows = materialPreviewState[kind] || [];
  const modal = document.getElementById("materialPreviewModal");
  const body = document.getElementById("materialPreviewModalBody");
  if (!modal || !body || !rows.length) return;
  const first = rows[0] || {};
  const duplicates = rows.filter((row) => row.duplicate).length;
  body.innerHTML = `
    <div class="material-preview-layout">
      <div class="material-preview-player">
        <div>
          <strong>${escapeHtml(first.title || "待识别素材")}</strong>
          <span>${escapeHtml(first.platform || "视频素材")}</span>
        </div>
      </div>
      <aside class="material-preview-meta">
        <h3>预览结果</h3>
        <dl>
          <div><dt>识别数量</dt><dd>${rows.length}</dd></div>
          <div><dt>重复素材</dt><dd>${duplicates}</dd></div>
          <div><dt>入库方式</dt><dd>${kind === "excel" ? "链接录入" : "表格导入"}</dd></div>
          <div><dt>目标库</dt><dd>长期视频素材库</dd></div>
        </dl>
        <section>
          <strong>AI 摘要</strong>
          <p>${escapeHtml(first.note || first.title || "将根据标题、链接、账号和标签生成可学习素材摘要。")}</p>
        </section>
        <section>
          <strong>脚本片段</strong>
          <p>${escapeHtml(first.rawText || first.url || "确认入库后会下载视频并提取字幕。")}</p>
        </section>
        <section class="material-risk-check">
          <span class="${duplicates ? "warning" : "ok"}">${duplicates ? "检测到重复素材" : "未发现重复"}</span>
          <span class="ok">链接格式已识别</span>
          <span>水印检查入库时执行</span>
        </section>
        <div class="material-action-row">
          <button class="confirm-action" type="button" data-open-confirm-import="${kind}">下载入库</button>
          <button class="secondary-action" type="button" data-close-modal="materialPreviewModal">稍后处理</button>
        </div>
      </aside>
    </div>
  `;
  body.querySelector("[data-open-confirm-import]")?.addEventListener("click", (event) => {
    closeModal("materialPreviewModal");
    openConfirmImportDialog(event.currentTarget.dataset.openConfirmImport);
  });
  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");
}

function openMaterialPreviewModal(id) {
  const item = simpleMaterialItems.find((entry) => String(entry.id) === String(id));
  const modal = document.getElementById("materialPreviewModal");
  const body = document.getElementById("materialPreviewModalBody");
  if (!item || !modal || !body) return;
  const videoUrl = item.videoPreviewUrl ? `${SIMPLE_API_BASE}${item.videoPreviewUrl}` : "";
  const processing = processingSummary(item.processing || {});
  body.innerHTML = `
    <div class="material-preview-layout">
      <div class="material-preview-player">
        ${videoUrl ? `<video controls src="${videoUrl}"></video>` : `<div><strong>暂无视频预览</strong><span>可查看链接和字幕信息</span></div>`}
      </div>
      <aside class="material-preview-meta">
        <h3>${escapeHtml(item.title)}</h3>
        <dl>
          <div><dt>平台</dt><dd>${escapeHtml(item.platform || "未知")}</dd></div>
          <div><dt>达人</dt><dd>${escapeHtml(item.accountName || "未识别")}</dd></div>
          <div><dt>状态</dt><dd>${escapeHtml(processing?.text || materialStatusLabel(item.status))}</dd></div>
          <div><dt>创建时间</dt><dd>${escapeHtml(formatDateTime(item.createdAt))}</dd></div>
        </dl>
        <section>
          <strong>AI 摘要</strong>
          <p>${escapeHtml((item.learningSummary?.usableParts || []).join("；") || item.note || "暂无摘要。")}</p>
        </section>
        <section>
          <strong>脚本片段</strong>
          <p>${escapeHtml(item.rawText || "还没有提取到字幕。")}</p>
        </section>
        <section class="material-risk-check">
          <span class="${processing?.level === "warning" ? "warning" : "ok"}">${escapeHtml(processing?.level === "warning" ? "存在处理告警" : "基础检查通过")}</span>
          <span>${escapeHtml(item.videoPreviewUrl ? "视频可预览" : "视频待补")}</span>
          <span>${escapeHtml(item.sourceOriginalUrl ? "原始链接已保存" : "原始链接待补")}</span>
        </section>
        <div class="material-action-row">
          <button class="confirm-action" type="button" data-material-drawer="${item.id}">查看详情</button>
          <button class="secondary-action" type="button" data-close-modal="materialPreviewModal">关闭</button>
        </div>
      </aside>
    </div>
  `;
  body.querySelector("[data-material-drawer]")?.addEventListener("click", (event) => {
    closeModal("materialPreviewModal");
    openMaterialDetailDrawer(event.currentTarget.dataset.materialDrawer);
  });
  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");
}

function openConfirmImportDialog(kind) {
  const rows = materialPreviewState[kind] || [];
  const modal = document.getElementById("materialConfirmDialog");
  const body = document.getElementById("materialConfirmBody");
  if (!modal || !body) return;
  if (!rows.length) {
    showMaterialToast("warning", "请先预览", "没有可入库的素材。");
    return;
  }
  const duplicates = rows.filter((row) => row.duplicate).length;
  body.innerHTML = `
    <div class="material-confirm-content">
      <div class="material-confirm-summary">
        <span>入库数量</span>
        <strong>${rows.length}</strong>
        <p>目标素材库：长期视频素材库</p>
      </div>
      <label>
        重复素材处理
        <select>
          <option>跳过重复素材（推荐）</option>
          <option>保留全部</option>
          <option>覆盖旧素材</option>
        </select>
      </label>
      <div class="material-confirm-progress">
        <span class="ok">识别链接</span>
        <span class="${duplicates ? "warning" : "ok"}">${duplicates ? `重复 ${duplicates} 条` : "重复检查通过"}</span>
        <span>等待下载入库</span>
      </div>
      <div class="material-action-row">
        <button class="confirm-action" type="button" data-confirm-import="${kind}">确认入库</button>
        <button class="secondary-action" type="button" data-close-modal="materialConfirmDialog">取消</button>
      </div>
    </div>
  `;
  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");
}

async function runConfirmedImport(kind) {
  const button = document.querySelector(`[data-confirm-import="${CSS.escape(kind)}"]`);
  if (button) {
    button.disabled = true;
    button.textContent = "入库中...";
  }
  showMaterialToast("info", "正在入库", "正在解析视频信息、下载并保存素材。");
  closeModal("materialConfirmDialog");
  await confirmPreviewImport(kind);
}

async function toggleMaterial(id, selected) {
  try {
    await apiJson(`/api/simple-agent/materials/${id}/select`, { method: "POST", body: JSON.stringify({ selected }) });
    await loadMaterials();
    showMaterialToast("success", "操作完成", selected ? "已加入本次生成。" : "已移出本次生成。");
  } catch (error) {
    setStatus("simpleAgentStatus", "offline", `操作失败：${error.message}`);
    showMaterialToast("error", "操作失败", error.message);
  }
}

function openMaterialDetailDrawer(id) {
  const item = simpleMaterialItems.find((entry) => String(entry.id) === String(id));
  const drawer = document.getElementById("materialDetailDrawer");
  const body = document.getElementById("materialDetailDrawerBody");
  const title = document.getElementById("materialDrawerTitle");
  if (!item || !drawer || !body) return;
  const processing = processingSummary(item.processing || {});
  const tags = (item.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("") || "<span>未打标签</span>";
  const sourceOriginalUrl = item.sourceOriginalUrl || item.url || "";
  if (title) title.textContent = item.title || "素材详情";
  body.innerHTML = `
    <section class="material-drawer-preview">
      ${materialThumbHtml(item, true)}
      <div>
        ${platformBadgeHtml(item.platform)}
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.accountName || "未识别达人")} / ${escapeHtml(formatDateTime(item.createdAt))}</p>
      </div>
    </section>
    <section class="material-drawer-tabs">
      <button class="active" type="button">详情</button>
      <button type="button">脚本片段</button>
      <button type="button">AI 摘要</button>
      <button type="button">使用记录</button>
    </section>
    <section class="material-drawer-block">
      <h3>基础信息</h3>
      <dl>
        <div><dt>状态</dt><dd>${escapeHtml(processing?.text || materialStatusLabel(item.status))}</dd></div>
        <div><dt>品牌/活动</dt><dd>${escapeHtml(item.category || "待关联")}</dd></div>
        <div><dt>素材类型</dt><dd>${escapeHtml(item.materialType || "video")}</dd></div>
        <div><dt>使用次数</dt><dd>${escapeHtml(item.useCount || 0)}</dd></div>
      </dl>
    </section>
    <section class="material-drawer-block">
      <h3>链接</h3>
      <p>${sourceOriginalUrl ? `<a href="${escapeHtml(sourceOriginalUrl)}" target="_blank" rel="noreferrer">${escapeHtml(sourceOriginalUrl)}</a>` : "未保存原始链接。"}</p>
    </section>
    <section class="material-drawer-block">
      <h3>标签</h3>
      <div class="simple-tags compact">${tags}</div>
    </section>
    <section class="material-drawer-block">
      <h3>转写文本 / 脚本片段</h3>
      <p>${escapeHtml(item.rawText || "还没有提取到字幕。")}</p>
    </section>
    <section class="material-drawer-block">
      <h3>AI 摘要</h3>
      <p>${escapeHtml((item.learningSummary?.usableParts || []).join("；") || item.note || "暂无摘要。")}</p>
    </section>
    <section class="material-drawer-block">
      <h3>使用历史</h3>
      <p>最近使用：${escapeHtml(item.lastUsedAt ? formatDateTime(item.lastUsedAt) : "暂无")}；总使用 ${escapeHtml(item.useCount || 0)} 次。</p>
    </section>
    <section class="material-drawer-block">
      <h3>操作记录</h3>
      <p>创建于 ${escapeHtml(formatDateTime(item.createdAt))}；更新于 ${escapeHtml(formatDateTime(item.updatedAt))}。</p>
    </section>
    <div class="material-drawer-actions">
      <button class="confirm-action" type="button" data-material-select="${item.id}" data-selected="${item.selected ? "false" : "true"}">${item.selected ? "移出本次" : "加入本次"}</button>
      <button class="secondary-action" type="button" data-material-tags="${item.id}">编辑标签</button>
    </div>
  `;
  body.querySelector("[data-material-preview]")?.addEventListener("click", (event) => openMaterialPreviewModal(event.currentTarget.dataset.materialPreview));
  body.querySelector("[data-material-select]")?.addEventListener("click", (event) => toggleMaterial(event.currentTarget.dataset.materialSelect, event.currentTarget.dataset.selected === "true"));
  body.querySelector("[data-material-tags]")?.addEventListener("click", (event) => openMaterialTagModal(event.currentTarget.dataset.materialTags));
  drawer.classList.add("active");
  drawer.setAttribute("aria-hidden", "false");
  document.getElementById("materialDrawerScrim")?.classList.add("active");
}

function closeMaterialDetailDrawer() {
  const drawer = document.getElementById("materialDetailDrawer");
  drawer?.classList.remove("active");
  drawer?.setAttribute("aria-hidden", "true");
  document.getElementById("materialDrawerScrim")?.classList.remove("active");
}

function showMaterialToast(state, title, message) {
  const stack = document.getElementById("materialToastStack");
  if (!stack) return;
  window.clearTimeout(materialUiState.toastTimer);
  const normalized = state === "error" ? "error" : state === "warning" ? "warning" : state === "info" ? "info" : "success";
  stack.innerHTML = `
    <article class="material-toast ${normalized}">
      <div>
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(message || "")}</p>
      </div>
      <button type="button" aria-label="关闭提示">关闭</button>
    </article>
  `;
  stack.querySelector("button")?.addEventListener("click", () => { stack.innerHTML = ""; });
  materialUiState.toastTimer = window.setTimeout(() => {
    stack.innerHTML = "";
  }, 4200);
}

async function loadCampaigns() {
  setStatus("campaignStatus", "pending", "正在读取品牌活动...");
  try {
    const [campaigns, matrixAccounts] = await Promise.all([
      apiJson("/api/simple-agent/campaigns"),
      apiJson("/api/simple-agent/matrix-accounts"),
    ]);
    setStatus("campaignStatus", "online", `${campaigns.stats.adminScope ? "管理员全量品牌活动" : "品牌活动"}已连接：${campaigns.stats.total} 条，矩阵号 ${matrixAccounts.stats.total || 0} 个`);
    simpleCampaignItems = campaigns.items || [];
    renderCampaignStats({ ...campaigns.stats, matrixTotal: matrixAccounts.stats.total || 0 });
    renderCampaignChecklist(simpleCampaignItems);
    renderCampaigns(simpleCampaignItems);
    renderMatrixAccounts(matrixAccounts.items || []);
  } catch (error) {
    setStatus("campaignStatus", "offline", `读取失败：${error.message}`);
  }
}

function renderCampaignStats(stats = {}) {
  const node = document.getElementById("campaignStats");
  const statusNode = document.getElementById("campaignStatus");
  if (!node && statusNode) {
    statusNode.textContent = `活动 ${stats.total || 0} / 本次 ${stats.selected || 0} / 有效 ${stats.active || 0} / 矩阵号 ${stats.matrixTotal || 0}`;
    return;
  }
  if (!node) return;
  node.innerHTML = [
    ["▣", "活动", stats.total || 0],
    ["▣", "本次", stats.selected || 0],
    ["✓", "有效", stats.active || 0],
    ["♙", "矩阵号", stats.matrixTotal || 0],
  ].map(campaignDesignMetricCard).join("");
}

function campaignDesignMetricCard([icon, label, value]) {
  return `<article><span>${escapeHtml(icon)}</span><small>${escapeHtml(label)}</small><strong>${Number(value || 0).toLocaleString("zh-CN")}</strong></article>`;
}

function renderCampaignChecklist(items) {
  const node = document.getElementById("campaignChecklist");
  if (!node) return;
  const selected = items.filter((item) => item.selected);
  const current = selected[0] || {};
  const checks = [
    ["商品信息", Boolean(current.productName)],
    ["活动规则", Boolean(current.activityRules)],
    ["价格边界", hasPriceBoundary(current.priceNote)],
    ["渠道范围", Boolean(current.channelScope)],
  ];
  node.innerHTML = checks.map(([label, ok]) => `<span class="${ok ? "ok" : "warning"}">${label}：${ok ? "已填写" : "待补"}</span>`).join("");
}

function hasPriceBoundary(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  if (/待补|不承诺最低价|不承诺|无最低价|不保证|未知|未填写|待确认/.test(text)) return false;
  if (/[¥￥]\s*\d|\d+\s*(元|块|rmb|RMB)/.test(text)) return true;
  if (/(最低|最高|上限|下限|不低于|不高于|区间|范围|封顶|起|到|至|[-~])\s*\d/.test(text)) return true;
  if (/\d+\s*[-~至到]\s*\d+/.test(text)) return true;
  return false;
}

function renderCampaigns(items) {
  const node = document.getElementById("campaignList");
  if (!node) return;
  const totalNode = document.getElementById("campaignPaginationTotal");
  if (totalNode) totalNode.textContent = `共 ${items.length} 条`;
  node.innerHTML = items.length ? campaignRecordTable(items) : emptyState("还没有品牌活动", "先录入主打商品和活动边界。");
}

function renderMatrixAccounts(items) {
  const node = document.getElementById("matrixAccountList");
  if (!node) return;
  node.innerHTML = items.length ? matrixAccountRecordTable(items) : emptyState("还没有品牌矩阵号", "先录入官方号、门店号、导购号或达人合作号。");
}

function campaignRecordTable(items) {
  return `
    <div class="simple-material-records campaign-design-table campaign-records-table">
      <table>
        <thead>
          <tr>
            <th>商品活动</th>
            <th>卖点</th>
            <th>活动规则</th>
            <th>价格边界</th>
            <th>状态</th>
            <th>归属用户</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item, index) => campaignRecordRow({ ...item, __index: index })).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function campaignRecordRow(item) {
  const points = (item.sellingPoints || []).slice(0, 4).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
  const owner = item.owner || {};
  const ownerLabel = owner.displayName || item.ownerName || "V1 内测管理员";
  const ownerUser = owner.username || item.ownerUsername || "admin";
  const statusText = item.selected ? "本次使用" : statusLabelForCampaign(item.status);
  const statusClass = item.selected ? "ok" : campaignStatusClass(item.status);
  return `
    <tr class="${item.selected ? "selected" : ""}">
      <td>
        <span class="campaign-product-cell">
          <span>
            <strong>${escapeHtml(item.productName || item.campaignName)}</strong>
            <small>${escapeHtml(item.brandName)} / ${escapeHtml(item.channelScope || "渠道待补")}</small>
          </span>
        </span>
      </td>
      <td><div class="simple-tags compact">${points || "<span>卖点待补</span>"}</div></td>
      <td>${escapeHtml(item.activityRules || "待补")}</td>
      <td>${escapeHtml(item.priceNote || "待补")}</td>
      <td><span class="simple-record-status ${statusClass}">${escapeHtml(statusText)}</span></td>
      <td><span class="campaign-owner"><strong>${escapeHtml(ownerLabel)}</strong><small>${escapeHtml(ownerUser)}</small></span></td>
      <td>
        <div class="simple-record-actions">
          <button type="button" data-campaign-edit="${item.id}">修改</button>
          <button class="danger" type="button" data-campaign-delete="${item.id}">删除</button>
        </div>
      </td>
    </tr>
  `;
}

function campaignStatusClass(status) {
  if (status === "expired") return "expired";
  if (status === "draft") return "draft";
  return "active";
}

function statusLabelForCampaign(status) {
  if (status === "expired") return "已失效";
  if (status === "draft") return "草稿";
  return "有效";
}

function matrixAccountRecordTable(items) {
  return `
    <div class="simple-material-records material-records-table campaign-records-table matrix-records-table">
      <table>
        <thead>
          <tr>
            <th>账号</th>
            <th>平台/类型</th>
            <th>内容标签</th>
            <th>账号定位</th>
            <th>链接</th>
            <th>状态</th>
            <th>归属用户</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(matrixAccountRecordRow).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function matrixAccountRecordRow(item) {
  const tags = (item.patterns || []).slice(0, 5).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
  const accountUrl = item.accountUrl ? `<a href="${escapeHtml(item.accountUrl)}" target="_blank" rel="noreferrer">${escapeHtml(item.accountUrl)}</a>` : "待补";
  return `
    <tr>
      <td><strong>${escapeHtml(item.accountName)}</strong></td>
      <td><small>${escapeHtml(item.platform)} / ${escapeHtml(item.category || "账号类型待补")}</small></td>
      <td><div class="simple-tags compact">${tags || "<span>内容标签待补</span>"}</div></td>
      <td>${escapeHtml(item.whyTrack || "待补")}</td>
      <td>${accountUrl}</td>
      <td><span class="simple-record-status">${escapeHtml(item.status || "active")}</span></td>
      <td>${ownerCellHtml(item)}</td>
    </tr>
  `;
}

function matrixAccountCard(item) {
  const tags = (item.patterns || []).slice(0, 5).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
  return `
    <article class="simple-item">
      <div class="simple-item-head">
        <div>
          <strong>${escapeHtml(item.accountName)}</strong>
          <small>${escapeHtml(item.platform)} / ${escapeHtml(item.category || "账号类型待补")}</small>
          ${ownerBadgeHtml(item)}
        </div>
        <span>${escapeHtml(item.status || "active")}</span>
      </div>
      <div class="simple-tags">${tags || "<span>内容标签待补</span>"}</div>
      <p><b>链接：</b>${item.accountUrl ? `<a href="${escapeHtml(item.accountUrl)}" target="_blank" rel="noreferrer">${escapeHtml(item.accountUrl)}</a>` : "待补"}</p>
      <p><b>定位：</b>${escapeHtml(item.whyTrack || "待补")}</p>
    </article>
  `;
}

function campaignCard(item, pickMode = false) {
  const points = (item.sellingPoints || []).slice(0, 4).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
  const checkbox = pickMode ? `<input type="checkbox" value="${item.id}" ${item.selected ? "checked" : ""} />` : "";
  return `
    <article class="simple-item ${item.selected ? "selected" : ""}">
      <div class="simple-item-head">
        <div>
          <strong>${checkbox}${escapeHtml(item.productName || item.campaignName)}</strong>
          <small>${escapeHtml(item.brandName)} / ${escapeHtml(item.channelScope || "渠道待补")}</small>
          ${ownerBadgeHtml(item)}
        </div>
        <span>${item.selected ? "本次使用" : item.status}</span>
      </div>
      <div class="simple-tags">${points || "<span>卖点待补</span>"}</div>
      <p><b>活动：</b>${escapeHtml(item.activityRules || "待补")}</p>
      <p><b>价格：</b>${escapeHtml(item.priceNote || "待补")}</p>
      ${pickMode ? "" : `<button type="button" data-campaign-select="${item.id}" data-selected="${item.selected ? "false" : "true"}">${item.selected ? "移出本次生成" : "加入本次生成"}</button>`}
    </article>
  `;
}

async function saveCampaign() {
  const [validFrom, validTo] = splitDateRange(valueOf("campaignDateRange"));
  const priceMin = valueOf("campaignPriceMin");
  const priceMax = valueOf("campaignPriceMax");
  const combinedPrice = [priceMin ? `最低 ${priceMin}` : "", priceMax ? `最高 ${priceMax}` : ""].filter(Boolean).join(" - ");
  const payload = {
    brandName: valueOf("campaignBrand"),
    campaignName: valueOf("campaignName"),
    productName: valueOf("campaignProduct"),
    sellingPoints: valueOf("campaignSellingPoints"),
    activityRules: valueOf("campaignRules"),
    priceNote: combinedPrice || valueOf("campaignPrice"),
    channelScope: valueOf("campaignChannel"),
    validFrom,
    validTo,
    selected: true,
  };
  const isEditing = Boolean(editingCampaignId);
  setMessage("campaignMessage", "", isEditing ? "正在保存修改..." : "正在保存品牌活动...");
  try {
    const path = isEditing ? `/api/simple-agent/campaigns/${editingCampaignId}` : "/api/simple-agent/campaigns";
    const method = isEditing ? "PUT" : "POST";
    const data = await apiJson(path, { method, body: JSON.stringify(payload) });
    setMessage("campaignMessage", "ok", isEditing ? `已保存修改：${data.item.productName || data.item.campaignName}` : `已保存并加入生成：${data.item.productName || data.item.campaignName}`);
    clearCampaignForm();
    resetCampaignEditState();
    await loadCampaigns();
  } catch (error) {
    setMessage("campaignMessage", "warning", `保存失败：${error.message}`);
  }
}

async function saveMatrixAccount() {
  const category = valueOf("matrixAccountCategory");
  const payload = {
    accountName: valueOf("matrixAccountName"),
    platform: valueOf("matrixPlatform"),
    accountUrl: valueOf("matrixAccountUrl"),
    category: category ? `品牌矩阵号 / ${category}` : "品牌矩阵号",
    whyTrack: valueOf("matrixAccountWhy") || "品牌矩阵号",
    patterns: valueOf("matrixAccountPatterns"),
  };
  setMessage("matrixAccountMessage", "", "正在保存品牌矩阵号...");
  try {
    const data = await apiJson("/api/simple-agent/accounts", { method: "POST", body: JSON.stringify(payload) });
    setMessage("matrixAccountMessage", "ok", `已保存矩阵号：${data.item.accountName}`);
    ["matrixAccountName", "matrixAccountUrl", "matrixAccountCategory", "matrixAccountWhy", "matrixAccountPatterns"].forEach(clearValue);
    await loadCampaigns();
  } catch (error) {
    setMessage("matrixAccountMessage", "warning", `保存失败：${error.message}`);
  }
}

async function toggleCampaign(id, selected) {
  try {
    await apiJson(`/api/simple-agent/campaigns/${id}/select`, { method: "POST", body: JSON.stringify({ selected }) });
    await loadCampaigns();
  } catch (error) {
    setStatus("campaignStatus", "offline", `操作失败：${error.message}`);
  }
}

function openCampaignEditModal(id) {
  const item = simpleCampaignItems.find((campaign) => String(campaign.id) === String(id));
  if (!item) return;
  editingCampaignId = item.id;
  setValue("campaignBrand", item.brandName || "");
  setValue("campaignName", item.campaignName || "");
  setValue("campaignProduct", item.productName || "");
  setValue("campaignDateRange", [item.validFrom, item.validTo].filter(Boolean).join("-"));
  setValue("campaignSellingPoints", (item.sellingPoints || []).join(", "));
  setValue("campaignRules", item.activityRules || "");
  setValue("campaignPrice", item.priceNote || "");
  setValue("campaignPriceMin", "");
  setValue("campaignPriceMax", "");
  setValue("campaignChannel", item.channelScope || "");
  const title = document.getElementById("campaignInputModalTitle");
  if (title) title.textContent = "修改品牌活动商品";
  const saveButton = document.getElementById("saveCampaign");
  if (saveButton) saveButton.textContent = "保存修改";
  setMessage("campaignMessage", "", "正在修改已录入的品牌活动。");
  activateCampaignInputTab("campaign");
  const modal = document.getElementById("campaignInputModal");
  modal?.classList.add("active");
  modal?.setAttribute("aria-hidden", "false");
}

async function deleteCampaign(id) {
  const item = simpleCampaignItems.find((campaign) => String(campaign.id) === String(id));
  const label = item?.productName || item?.campaignName || "这条品牌活动";
  const confirmed = await confirmSimpleAgentAction({
    title: "删除品牌活动",
    message: `确认删除「${label}」？`,
    detail: "删除后这条活动不会再出现在品牌活动列表和生成输入选择里。",
    confirmText: "确认删除",
    danger: true,
  });
  if (!confirmed) return;
  try {
    await apiJson(`/api/simple-agent/campaigns/${id}`, { method: "DELETE" });
    await loadCampaigns();
  } catch (error) {
    setStatus("campaignStatus", "offline", `删除失败：${error.message}`);
  }
}

function resetCampaignEditState() {
  editingCampaignId = null;
  const title = document.getElementById("campaignInputModalTitle");
  if (title) title.textContent = "新增品牌活动商品";
  const saveButton = document.getElementById("saveCampaign");
  if (saveButton) saveButton.textContent = "确认保存";
}

function clearCampaignForm() {
  ["campaignName", "campaignProduct", "campaignDateRange", "campaignSellingPoints", "campaignRules", "campaignPrice", "campaignPriceMin", "campaignPriceMax", "campaignChannel", "campaignOwnerDraft"].forEach(clearValue);
}

async function loadGenerationInputs() {
  setStatus("generateStatus", "pending", "正在读取生成输入...");
  try {
    const [materials, campaigns, templates] = await Promise.all([
      apiJson("/api/simple-agent/materials"),
      apiJson("/api/simple-agent/campaigns"),
      apiJson("/api/simple-agent/templates"),
    ]);
    setStatus("generateStatus", "online", `可用输入：素材 ${materials.stats.selected} 条，活动 ${campaigns.stats.selected} 条`);
    renderCampaignChecklist(campaigns.items || []);
    renderGenerationCampaigns(campaigns.items || []);
    renderGenerationMaterials(materials.items || []);
    renderTemplates(templates.items || []);
    await loadTodayScriptOutputs();
  } catch (error) {
    setStatus("generateStatus", "offline", `读取失败：${error.message}`);
  }
}

async function loadTodayScriptOutputs() {
  if (!document.getElementById("simpleScriptOutputs") || pagePath.includes("simple-agent-scripts")) return;
  try {
    const outputs = await apiJson("/api/simple-agent/scripts?limit=100");
    simpleScriptLibrary = outputs.library || { configured: false, url: "", tableId: "", error: "" };
    todayScriptItems = filterTodayScripts(outputs.items || outputs.outputs || []);
    renderScriptLibrarySummary(todayScriptItems);
    renderScriptOutputs(todayScriptItems);
  } catch (error) {
    todayScriptItems = [];
    renderScriptLibrarySummary([]);
    renderScriptOutputs([]);
    setMessage("generationMessage", "warning", `今日脚本读取失败：${error.message}`);
  }
}

async function loadScriptLibraryPage() {
  setStatus("scriptLibraryStatus", "pending", "正在读取脚本库...");
  try {
    const outputs = await apiJson("/api/simple-agent/scripts");
    simpleScriptLibrary = outputs.library || { configured: false, url: "", tableId: "", error: "" };
    const items = outputs.items || outputs.outputs || [];
    setStatus("scriptLibraryStatus", "online", `脚本库已连接：${items.length} 条脚本`);
    renderScriptLibrarySummary(items);
    renderScriptOutputs(items);
  } catch (error) {
    setStatus("scriptLibraryStatus", "offline", `读取失败：${error.message}`);
    renderScriptOutputs([]);
  }
}

async function refreshScriptWorkbench() {
  if (pagePath.includes("simple-agent-scripts")) {
    await loadScriptLibraryPage();
    return;
  }
  await loadGenerationInputs();
}

function renderGenerationCampaigns(items) {
  const node = document.getElementById("generationCampaigns");
  if (!node) return;
  generationCampaignItems = items || [];
  const visible = filteredGenerationCampaigns();
  node.innerHTML = visible.length ? generationCampaignPickerTable(visible) : emptyState("没有匹配的商品活动", "调整搜索词或状态筛选后再试。");
  updateGenerationPickerCounts();
  updateSelectedInputSummary();
}

function renderGenerationMaterials(items) {
  const node = document.getElementById("generationMaterials");
  if (!node) return;
  generationMaterialItems = items || [];
  renderGenerationMaterialFilters(generationMaterialItems);
  renderGenerationMaterialTabs(generationMaterialItems);
  const visible = filteredGenerationMaterials();
  node.innerHTML = visible.length ? generationMaterialPickerTable(visible) : emptyState("没有匹配的参考素材", "调整搜索词、平台、标签或状态筛选后再试。");
  updateGenerationPickerCounts();
  updateSelectedInputSummary();
}

function filteredGenerationCampaigns() {
  const query = generationPickerState.campaignQuery.toLowerCase();
  const status = generationPickerState.campaignStatus;
  return generationCampaignItems.filter((item) => {
    const haystack = [
      item.productName,
      item.campaignName,
      item.brandName,
      item.channelScope,
      item.activityRules,
      item.priceNote,
      ...(item.sellingPoints || []),
      item.owner?.displayName,
      item.owner?.username,
    ].join(" ").toLowerCase();
    const itemStatus = item.selected ? "selected" : (item.status || "active");
    return (!query || haystack.includes(query)) && (!status || itemStatus === status);
  });
}

function filteredGenerationMaterials() {
  const query = generationPickerState.materialQuery.toLowerCase();
  const platform = generationPickerState.materialPlatform;
  const tag = generationPickerState.materialTag;
  const quality = generationPickerState.materialQuality;
  const status = generationPickerState.materialStatus;
  return generationMaterialItems.filter((item) => {
    const tags = materialTags(item);
    const score = materialQualityScore(item);
    const processing = processingSummary(item.processing || {});
    const itemStatus = item.selected ? "selected" : normalizedGenerationMaterialStatus(item, processing);
    const haystack = [
      item.title,
      item.hook,
      item.accountName,
      item.category,
      item.rawText,
      item.summary,
      item.note,
      item.platform,
      ...tags,
    ].join(" ").toLowerCase();
    const qualityMatch = !quality
      || (quality === "high" && score >= 85)
      || (quality === "mid" && score >= 70 && score < 85)
      || (quality === "low" && score < 70);
    const usableMatch = !generationPickerState.materialUsableOnly || itemStatus === "ready" || itemStatus === "selected";
    return (!query || haystack.includes(query))
      && (!platform || item.platform === platform)
      && (!tag || tags.includes(tag))
      && qualityMatch
      && (!status || itemStatus === status)
      && usableMatch;
  });
}

function generationCampaignPickerTable(items) {
  return `
    <table>
      <thead>
        <tr>
          <th class="generation-check-col">选中</th>
          <th>商品活动</th>
          <th>品牌 / 渠道</th>
          <th>卖点</th>
          <th>活动规则</th>
          <th>价格边界</th>
          <th>状态</th>
          <th>归属用户</th>
        </tr>
      </thead>
      <tbody>${items.map(generationCampaignRow).join("")}</tbody>
    </table>
  `;
}

function generationCampaignRow(item) {
  const points = (item.sellingPoints || []).slice(0, 4);
  const title = item.productName || item.campaignName || "未命名活动";
  const statusText = item.selected ? "本次使用" : statusLabelForCampaign(item.status);
  const statusClass = item.selected ? "ok" : campaignStatusClass(item.status);
  const priceReady = hasPriceBoundary(item.priceNote);
  return `
    <tr class="generation-selectable-row ${item.selected ? "selected" : ""}" data-generation-campaign-row="${escapeHtml(item.id)}">
      <td class="generation-check-col">
        <label class="generation-check">
          <input type="checkbox" value="${escapeHtml(item.id)}" ${item.selected ? "checked" : ""} />
          <span></span>
        </label>
      </td>
      <td>
        <span class="generation-title-cell">
          <strong>${escapeHtml(title)}</strong>
          <small>${escapeHtml(item.campaignName || "活动名称待补")}</small>
        </span>
      </td>
      <td>
        <span class="generation-stack-cell">
          <strong>${escapeHtml(item.brandName || "品牌待补")}</strong>
          <small>${escapeHtml(item.channelScope || "渠道待补")}</small>
        </span>
      </td>
      <td><div class="generation-chip-list">${points.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("") || "<span>卖点待补</span>"}</div></td>
      <td><span class="generation-compact-text">${escapeHtml(item.activityRules || "待补")}</span></td>
      <td><span class="generation-boundary ${priceReady ? "ok" : "warning"}">${escapeHtml(priceReady ? item.priceNote : "待补")}</span></td>
      <td><span class="simple-record-status ${statusClass}">${escapeHtml(statusText)}</span></td>
      <td>${ownerCellHtml(item)}</td>
    </tr>
  `;
}

function generationMaterialPickerTable(items) {
  const visibleIds = items.map((item) => String(item.id));
  const allSelected = visibleIds.length && visibleIds.every((id) => generationMaterialItems.find((item) => String(item.id) === id)?.selected);
  return `
    <div class="generation-batch-strip">
      <span>当前筛选 ${items.length} 条</span>
      <button type="button" data-generation-select-visible-materials>全选当前结果</button>
      <button type="button" data-generation-clear-visible-materials>取消当前结果</button>
    </div>
    <table>
      <thead>
        <tr>
          <th class="generation-check-col"><span class="generation-mini-check ${allSelected ? "checked" : ""}"></span></th>
          <th>质量评分</th>
          <th>标题 / Hook 预览</th>
          <th>脚本片段</th>
          <th>平台</th>
          <th>标签</th>
          <th>时长</th>
          <th>状态</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>${items.map(generationMaterialRow).join("")}</tbody>
    </table>
  `;
}

function generationMaterialRow(item) {
  const title = item.title || item.url || "未命名素材";
  const hook = item.hook || firstTextLine(item.rawText) || item.summary || "暂无 hook 预览";
  const script = generationMaterialScriptSnippet(item);
  const tags = materialTags(item).slice(0, 3);
  const score = materialQualityScore(item);
  const processing = processingSummary(item.processing || {});
  const statusKey = item.selected ? "selected" : normalizedGenerationMaterialStatus(item, processing);
  const statusText = generationMaterialStatusText(statusKey, item, processing);
  return `
    <tr class="generation-selectable-row ${item.selected ? "selected" : ""}" data-generation-material-row="${escapeHtml(item.id)}">
      <td class="generation-check-col">
        <label class="generation-check">
          <input type="checkbox" value="${escapeHtml(item.id)}" ${item.selected ? "checked" : ""} />
          <span></span>
        </label>
      </td>
      <td><span class="generation-quality-score ${score >= 85 ? "high" : score >= 70 ? "mid" : "low"}">${score}</span></td>
      <td>
        <span class="generation-material-title-cell">
          ${materialThumbHtml(item)}
          <span>
            <strong title="${escapeHtml(title)}">${escapeHtml(title)}</strong>
            <small title="${escapeHtml(hook)}">${escapeHtml(hook)}</small>
          </span>
        </span>
      </td>
      <td><span class="generation-compact-text" title="${escapeHtml(script)}">${escapeHtml(script)}</span></td>
      <td>${platformBadgeHtml(item.platform)}</td>
      <td><div class="generation-chip-list">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("") || "<span>未打标签</span>"}</div></td>
      <td><span class="material-duration-label">${escapeHtml(materialDuration(item))}</span></td>
      <td><span class="simple-record-status ${statusKey === "ready" || statusKey === "selected" ? "ok" : statusKey === "duplicate" ? "warning" : "pending"}">${escapeHtml(statusText)}</span></td>
      <td>
        <div class="generation-row-actions">
          <button type="button" data-generation-material-preview="${escapeHtml(item.id)}">预览</button>
        </div>
      </td>
    </tr>
  `;
}

function renderGenerationMaterialFilters(items) {
  const platformSelect = document.getElementById("generationMaterialPlatform");
  const tagSelect = document.getElementById("generationMaterialTag");
  if (platformSelect) {
    const current = platformSelect.value;
    const platforms = Array.from(new Set(items.map((item) => item.platform).filter(Boolean)));
    platformSelect.innerHTML = `<option value="">全部平台</option>${platforms.map((platform) => `<option value="${escapeHtml(platform)}">${escapeHtml(platformBadgeText(platform))}</option>`).join("")}`;
    platformSelect.value = platforms.includes(current) ? current : "";
    generationPickerState.materialPlatform = platformSelect.value;
  }
  if (tagSelect) {
    const current = tagSelect.value;
    const tags = Array.from(new Set(items.flatMap((item) => materialTags(item)))).slice(0, 24);
    tagSelect.innerHTML = `<option value="">全部标签</option>${tags.map((tag) => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`).join("")}`;
    tagSelect.value = tags.includes(current) ? current : "";
    generationPickerState.materialTag = tagSelect.value;
  }
}

function renderGenerationMaterialTabs(items) {
  const node = document.getElementById("generationMaterialTabs");
  if (!node) return;
  const counts = items.reduce((acc, item) => {
    const key = item.platform || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const tabs = [
    ["", "全部", items.length],
    ...Object.entries(counts).map(([key, count]) => [key, platformBadgeText(key), count]),
  ];
  node.innerHTML = tabs.map(([key, label, count]) => `
    <button type="button" class="${generationPickerState.activeMaterialPlatform === key ? "active" : ""}" data-generation-platform-tab="${escapeHtml(key)}">${escapeHtml(label)} <span>${count}</span></button>
  `).join("");
}

function updateGenerationPickerCounts() {
  const campaign = document.getElementById("generationCampaignCount");
  const material = document.getElementById("generationMaterialCount");
  if (campaign) {
    const selected = generationCampaignItems.filter((item) => item.selected).length;
    campaign.textContent = `${selected} / ${generationCampaignItems.length}`;
  }
  if (material) {
    const selected = generationMaterialItems.filter((item) => item.selected).length;
    material.textContent = `${selected} / ${generationMaterialItems.length}`;
  }
}

function updateSelectedInputSummary() {
  const summary = document.getElementById("selectedInputSummary");
  if (!summary) return;
  const selectedCampaigns = generationCampaignItems.filter((item) => item.selected);
  const selectedMaterials = generationMaterialItems.filter((item) => item.selected);
  const campaign = selectedCampaigns[0];
  const missingPrice = !campaign || !hasPriceBoundary(campaign.priceNote);
  const missingChannel = !campaign || !String(campaign.channelScope || "").trim();
  const missingRules = !campaign || !String(campaign.activityRules || "").trim();
  const blockers = [
    !campaign ? "未选择活动" : "",
    !selectedMaterials.length ? "未选择素材" : "",
  ].filter(Boolean);
  const warnings = [
    missingPrice ? "缺价格边界" : "",
    missingChannel ? "缺渠道范围" : "",
    missingRules ? "缺活动规则" : "",
  ].filter(Boolean);
  const overview = document.getElementById("selectedInputOverview");
  const campaignNode = document.getElementById("selectedSummaryCampaign");
  const materialsNode = document.getElementById("selectedSummaryMaterials");
  const checksNode = document.getElementById("selectedSummaryChecks");
  if (overview) overview.textContent = campaign ? `已选 ${selectedCampaigns.length} 个活动，${selectedMaterials.length} 条参考素材` : `已选 0 个活动，${selectedMaterials.length} 条参考素材`;
  if (campaignNode) {
    campaignNode.innerHTML = campaign ? `
      <span class="selected-summary-label">已选活动</span>
      <strong>${escapeHtml(campaign.productName || campaign.campaignName || "未命名活动")}</strong>
      <small>${escapeHtml(campaign.brandName || "品牌待补")} · ${escapeHtml(campaign.activityRules || "活动规则待补")}</small>
    ` : `
      <span class="selected-summary-label">已选活动</span>
      <strong>尚未选择</strong>
      <small>请选择一个商品活动作为生成输入。</small>
    `;
  }
  if (materialsNode) {
    materialsNode.innerHTML = `
      <span class="selected-summary-label">参考素材</span>
      <strong>${selectedMaterials.length} 条</strong>
      <small>${selectedMaterials.slice(0, 3).map((item) => escapeHtml(item.title || "未命名素材")).join(" / ") || "至少选择 1 条参考素材"}</small>
    `;
  }
  if (checksNode) {
    checksNode.innerHTML = `
      ${summaryCheckHtml(!missingRules, "活动规则")}
      ${summaryCheckHtml(!missingPrice, "价格边界")}
      ${summaryCheckHtml(!missingChannel, "渠道范围")}
      ${summaryCheckHtml(Boolean(selectedMaterials.length), "参考素材")}
    `;
  }
  const buttons = [
    document.getElementById("runSimpleGeneration"),
    document.querySelector("[data-run-generation-from-summary]"),
  ].filter(Boolean);
  buttons.forEach((button) => {
    button.disabled = Boolean(blockers.length);
    button.title = blockers.length ? `暂不能生成：${blockers.join("、")}` : warnings.length ? `可生成，但建议补充：${warnings.join("、")}` : "输入完整，可以生成";
  });
  summary.classList.toggle("blocked", Boolean(blockers.length || warnings.length));
  summary.classList.toggle("ready", !blockers.length);
}

function summaryCheckHtml(ok, label) {
  return `<span class="${ok ? "ok" : "warning"}">${ok ? "✓" : "!"} ${escapeHtml(label)}${ok ? "已填写" : "待补"}</span>`;
}

function setVisibleMaterialsChecked(checked) {
  const visible = filteredGenerationMaterials();
  const visibleIds = new Set(visible.map((item) => String(item.id)));
  generationMaterialItems.forEach((item) => {
    if (visibleIds.has(String(item.id))) item.selected = checked;
  });
  renderGenerationMaterials(generationMaterialItems);
}

function clearGenerationSelection() {
  generationCampaignItems.forEach((item) => { item.selected = false; });
  generationMaterialItems.forEach((item) => { item.selected = false; });
  renderGenerationCampaigns(generationCampaignItems);
  renderGenerationMaterials(generationMaterialItems);
}

function materialTags(item) {
  return Array.isArray(item.tags) ? item.tags.filter(Boolean) : String(item.tags || "").split(/[,，、]/).map((tag) => tag.trim()).filter(Boolean);
}

function materialQualityScore(item) {
  const explicit = Number(item.qualityScore || item.score || item.quality || 0);
  if (explicit > 0) return Math.max(1, Math.min(99, Math.round(explicit)));
  let score = 68;
  if (item.videoPreviewUrl) score += 8;
  if ((item.rawText || "").trim()) score += 8;
  if (materialTags(item).length) score += 5;
  if (item.selected) score += 4;
  const processing = processingSummary(item.processing || {});
  if (processing?.level === "warning") score -= 8;
  return Math.max(52, Math.min(92, score));
}

function normalizedGenerationMaterialStatus(item, processing) {
  if (String(item.status || "").includes("duplicate")) return "duplicate";
  if (processing?.level === "warning") return "duplicate";
  if (processing?.level === "pending" || item.status === "pending" || item.status === "pending_text") return "pending";
  return "ready";
}

function generationMaterialStatusText(statusKey, item, processing) {
  if (statusKey === "selected") return "已选";
  if (statusKey === "duplicate") return "重复";
  if (statusKey === "pending") return processing?.text || materialStatusLabel(item.status);
  return "可用";
}

function platformBadgeText(platform) {
  return {
    douyin: "抖音",
    xhs: "小红书",
    third_party: "第三方",
    bilibili: "B 站",
    kuaishou: "快手",
  }[platform] || platform || "未知";
}

function firstTextLine(value) {
  return String(value || "").split(/\n+/).map((line) => line.trim()).find(Boolean) || "";
}

function generationMaterialScriptSnippet(item) {
  return firstTextLine(item.scriptSnippet || item.rawText || item.summary || item.note) || "暂无脚本片段";
}

function openMaterialInputPreview(id) {
  const item = generationMaterialItems.find((entry) => String(entry.id) === String(id));
  const drawer = document.getElementById("materialInputPreviewDrawer");
  const title = document.getElementById("materialInputPreviewTitle");
  const body = document.getElementById("materialInputPreviewBody");
  if (!item || !drawer || !title || !body) return;
  const tags = materialTags(item);
  const videoUrl = item.videoPreviewUrl ? `${SIMPLE_API_BASE}${item.videoPreviewUrl}` : "";
  title.textContent = item.title || "未命名素材";
  body.innerHTML = `
    <section class="material-input-preview-media">
      ${videoUrl ? `<video controls src="${escapeHtml(videoUrl)}"></video>` : materialThumbHtml(item, true)}
    </section>
    <section class="material-input-preview-section">
      <h4>基础信息</h4>
      <dl>
        <div><dt>平台</dt><dd>${escapeHtml(platformBadgeText(item.platform))}</dd></div>
        <div><dt>账号</dt><dd>${escapeHtml(item.accountName || "账号待补")}</dd></div>
        <div><dt>时长</dt><dd>${escapeHtml(materialDuration(item))}</dd></div>
        <div><dt>质量评分</dt><dd>${escapeHtml(materialQualityScore(item))}</dd></div>
      </dl>
    </section>
    <section class="material-input-preview-section">
      <h4>脚本片段</h4>
      <p>${escapeHtml(generationMaterialScriptSnippet(item))}</p>
    </section>
    <section class="material-input-preview-section">
      <h4>AI 摘要</h4>
      <p>${escapeHtml(item.summary || item.note || (item.learningSummary?.usableParts || []).join("；") || "暂无摘要。")}</p>
    </section>
    <section class="material-input-preview-section">
      <h4>标签</h4>
      <div class="generation-chip-list">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("") || "<span>未打标签</span>"}</div>
    </section>
    <section class="material-input-preview-section">
      <h4>为什么适合本次生成</h4>
      <p>${escapeHtml(materialFitReason(item))}</p>
    </section>
    <div class="material-input-preview-actions">
      <button class="secondary-action" type="button" data-close-material-input-preview>关闭</button>
      <button class="confirm-action" type="button" data-material-preview-select="${escapeHtml(item.id)}">${item.selected ? "已选中" : "选为参考"}</button>
    </div>
  `;
  body.querySelector("[data-close-material-input-preview]")?.addEventListener("click", closeMaterialInputPreviewDrawer);
  body.querySelector("[data-material-preview-select]")?.addEventListener("click", () => {
    item.selected = true;
    renderGenerationMaterials(generationMaterialItems);
    openMaterialInputPreview(item.id);
  });
  drawer.classList.remove("collapsed");
  drawer.classList.add("active");
}

function closeMaterialInputPreviewDrawer() {
  const drawer = document.getElementById("materialInputPreviewDrawer");
  drawer?.classList.add("collapsed");
  drawer?.classList.remove("active");
}

function materialFitReason(item) {
  const tags = materialTags(item);
  if (tags.length) return `标签包含 ${tags.slice(0, 3).join("、")}，可作为本次脚本的结构和表达参考。`;
  if ((item.rawText || "").trim()) return "已提取脚本/字幕，适合参考开头、节奏和转化话术。";
  if (item.videoPreviewUrl) return "已下载视频，可用于观察镜头节奏和画面信息。";
  return "已入库但信息仍待补充，建议预览后再决定是否用于生成。";
}

function renderTemplates(items) {
  const node = document.getElementById("generationTemplate");
  if (!node) return;
  node.innerHTML = items.map((item) => `<option value="${item.id}" ${item.isDefault ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("");
}

async function runSimpleGeneration() {
  const campaignIds = checkedValues("#generationCampaigns input[type='checkbox']");
  const materialIds = checkedValues("#generationMaterials input[type='checkbox']");
  const payload = {
    topic: valueOf("generationTopic"),
    targetCount: Number(valueOf("generationCount") || 3),
    qualityLevel: valueOf("generationQuality"),
    generationStrategy: valueOf("generationStrategy"),
    outputMode: valueOf("generationOutput"),
    templateId: valueOf("generationTemplate"),
    campaignIds,
    materialIds,
    systemPrompt: valueOf("systemPrompt"),
    generationPrompt: valueOf("generationPrompt"),
    formatTemplateNote: valueOf("qualityFormat"),
    qualitySamples: valueOf("qualitySamples"),
    avoidRules: valueOf("avoidRules"),
    manualFeedback: valueOf("manualFeedback"),
  };
  setMessage("generationMessage", "", "正在调用脚本生成服务...");
  try {
    const data = await apiJson("/api/simple-agent/generate", { method: "POST", body: JSON.stringify(payload) });
    setMessage("generationMessage", "ok", `已生成 ${data.outputs.length} 条脚本，输入快照已保存。`);
    todayScriptItems = mergeScriptItems(data.outputs || [], todayScriptItems).filter(isTodayScript);
    renderScriptLibrarySummary(todayScriptItems);
    renderScriptOutputs(todayScriptItems);
  } catch (error) {
    setMessage("generationMessage", "warning", `生成失败：${error.message}`);
  }
}

function filterTodayScripts(items = []) {
  return (items || []).filter(isTodayScript);
}

function isTodayScript(item) {
  const raw = item?.createdAt || item?.generatedAt;
  if (!raw) return false;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
}

function mergeScriptItems(primary = [], secondary = []) {
  const seen = new Set();
  return [...primary, ...secondary].filter((item) => {
    const key = String(item?.id || "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function renderScriptOutputs(items) {
  const node = document.getElementById("simpleScriptOutputs");
  if (!node) return;
  simpleScriptItems = items || [];
  if (!items.length) {
    const emptyTitle = pagePath.includes("simple-agent-scripts") ? "脚本库暂无脚本" : "今天还没有生成脚本";
    const emptyNote = pagePath.includes("simple-agent-scripts") ? "生成页采用后的历史脚本会在这里沉淀。" : "配置输入后点击生成脚本，本区域会保留今天生成的结果。";
    node.innerHTML = emptyState(emptyTitle, emptyNote);
    renderScriptPreview(items[0]);
    return;
  }
  node.innerHTML = `
    <div class="generate-script-table">
      <table>
        <thead>
          <tr>
            <th class="generate-check-col"><input type="checkbox" /></th>
            <th>质量评分</th>
            <th>脚本标题/主题</th>
            <th>脚本概述</th>
            <th>时长</th>
            <th>状态</th>
            <th>生成时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(scriptTableRow).join("")}
        </tbody>
      </table>
    </div>
  `;
  const currentVisible = document.getElementById("scriptPreviewDrawer")?.classList.contains("active");
  const currentId = document.getElementById("scriptPreviewDrawer")?.dataset.scriptId;
  if (currentVisible && currentId) renderScriptPreview(items.find((item) => String(item.id) === String(currentId)) || items[0]);
}

function scriptTableRow(item) {
  const isPending = pendingScriptReviews.has(String(item.id));
  const isRegenerating = pendingScriptRegenerations.has(String(item.id));
  const adoptedSynced = item.feishuSyncStatus === "synced";
  const controlsDisabled = isPending || isRegenerating;
  const score = Number(item.qualityScore || 0);
  const status = item.reviewStatus || "new";
  const title = item.title || item.hook || `脚本 #${item.id}`;
  return `
    <tr class="simple-script-card ${status} ${item.isQualitySample ? "sample" : ""}" data-script-row="${item.id}">
      <td class="generate-check-col"><input type="checkbox" /></td>
      <td><span class="generate-score ${scriptScoreClass(score)}">${escapeHtml(score || "-")}</span></td>
      <td>
        <div class="generate-script-title-cell">
          <strong>${escapeHtml(title)}</strong>
          <small>${escapeHtml(item.campaignName || item.topic || "世界环球服")}</small>
        </div>
      </td>
      <td><p class="script-hook">${escapeHtml(item.hook || item.qualityNotes || "待补充脚本概述")}</p></td>
      <td>${escapeHtml(scriptDuration(item))}</td>
      <td>${scriptStatusPill(item)}</td>
      <td>${escapeHtml(formatDateTime(item.createdAt || item.generatedAt))}</td>
      <td>
        <div class="simple-actions generate-row-actions">
          <span class="script-action-line primary-line">
            <button type="button" data-script-preview="${item.id}">预览</button>
            <button class="primary-script-action" type="button" data-script-review="${item.id}" data-status="adopted" ${controlsDisabled || adoptedSynced ? "disabled" : ""}>${isPending ? "同步中" : adoptedSynced ? "已同步" : "采用"}</button>
          </span>
          <span class="script-action-line secondary-line">
            ${status === "needs_edit"
              ? `<button type="button" data-script-regenerate="${item.id}" ${controlsDisabled ? "disabled" : ""}>${isRegenerating ? "重生成中" : "待改"}</button>`
              : `<button type="button" data-script-regenerate="${item.id}" data-mark-needs-edit="true" ${controlsDisabled ? "disabled" : ""}>${isRegenerating ? "重生成中" : "待改"}</button>`}
            <button class="danger" type="button" data-script-review="${item.id}" data-status="rejected" ${controlsDisabled ? "disabled" : ""}>弃用</button>
            <button type="button" data-script-review="${item.id}" data-status="adopted" data-sample="true" data-synced="${adoptedSynced ? "true" : "false"}" ${controlsDisabled || item.isQualitySample ? "disabled" : ""}>${isPending ? (adoptedSynced ? "样例中" : "同步样例") : item.isQualitySample ? "已样例" : "样例"}</button>
          </span>
        </div>
        <div class="script-card-message-slot">${scriptActionMessageHtml(item.id)}${scriptFeishuSyncHtml(item)}</div>
      </td>
    </tr>
  `;
}

function scriptScoreClass(score) {
  if (score >= 85) return "high";
  if (score >= 70) return "mid";
  return "low";
}

function scriptDuration(item) {
  return item.duration || item.scriptDuration || "00:15";
}

function scriptStatusLabel(status) {
  return {
    new: "待复盘",
    adopted: "已采用",
    needs_edit: "待改",
    rejected: "弃用",
  }[status || "new"] || status || "待复盘";
}

function scriptStatusPill(item) {
  const status = item.reviewStatus || "new";
  const label = item.isQualitySample ? "样例" : scriptStatusLabel(status);
  return `<span class="script-state-pill ${escapeHtml(status)} ${item.isQualitySample ? "sample" : ""}">${escapeHtml(label)}</span>`;
}

function renderScriptLibrarySummary(items = []) {
  const node = document.getElementById("scriptLibrarySummary");
  if (!node) return;
  if (!pagePath.includes("simple-agent-scripts") && !items.length) {
    node.innerHTML = `<span class="simple-script-library-link warning">今日暂无生成</span>`;
    return;
  }
  const counts = items.reduce((acc, item) => {
    const status = item.reviewStatus || "new";
    acc[status] = (acc[status] || 0) + 1;
    if (item.isQualitySample) acc.samples += 1;
    if (item.feishuSyncStatus === "synced") acc.synced += 1;
    return acc;
  }, { total: items.length, new: 0, adopted: 0, needs_edit: 0, rejected: 0, samples: 0, synced: 0 });
  const metrics = [
    ["全部", counts.total],
    ["待复盘", counts.new],
    ["已采用", counts.adopted],
    ["待改", counts.needs_edit],
    ["弃用", counts.rejected],
    ["样例", counts.samples],
    ["飞书", counts.synced],
  ];
  node.innerHTML = `
    <div class="simple-script-status-counts">
      ${metrics.map(([label, value]) => `<span><b>${value}</b>${label}</span>`).join("")}
    </div>
    ${scriptLibraryLinkHtml()}
  `;
}

function scriptLibraryLinkHtml() {
  if (simpleScriptLibrary?.configured && simpleScriptLibrary.url) {
    return `<a class="simple-script-library-link" href="${escapeHtml(simpleScriptLibrary.url)}" target="_blank" rel="noopener">打开飞书脚本库</a>`;
  }
  return `<span class="simple-script-library-link warning" title="${escapeHtml(simpleScriptLibrary?.error || "飞书脚本库未配置")}">飞书未配置</span>`;
}

function scriptActionMessageHtml(id) {
  const message = scriptActionMessages.get(String(id));
  if (!message) return "";
  return `<span class="simple-action-message ${escapeHtml(message.state || "")}">${escapeHtml(message.text)}</span>`;
}

function scriptFeishuSyncHtml(item) {
  if (item.feishuSyncStatus === "synced") {
    return `<span class="simple-action-message ok">已同步飞书</span>`;
  }
  if (item.feishuSyncStatus === "failed") {
    const error = item.feishuSyncError || "请检查脚本库配置和 lark-cli 授权";
    const libraryMissing = !simpleScriptLibrary?.configured && /未配置飞书脚本库|SIMPLE_AGENT_SCRIPT_LIBRARY/.test(error);
    if (libraryMissing) return "";
    return `<span class="simple-action-message warning">飞书同步失败：${escapeHtml(error)}</span>`;
  }
  return "";
}

function openScriptPreview(id) {
  const item = simpleScriptItems.find((entry) => String(entry.id) === String(id));
  if (!item) return;
  renderScriptPreview(item);
  const drawer = document.getElementById("scriptPreviewDrawer");
  if (!drawer) return;
  document.querySelector(".generate-design-shell")?.classList.remove("preview-collapsed");
  drawer.classList.add("active");
  drawer.classList.remove("collapsed");
  drawer.dataset.scriptId = String(item.id);
}

function closeScriptPreview() {
  const drawer = document.getElementById("scriptPreviewDrawer");
  if (!drawer) return;
  drawer.classList.remove("active");
  drawer.classList.add("collapsed");
  document.querySelector(".generate-design-shell")?.classList.add("preview-collapsed");
  delete drawer.dataset.scriptId;
}

function renderScriptPreview(item) {
  const titleNode = document.getElementById("scriptPreviewTitle");
  const body = document.getElementById("scriptPreviewBody");
  if (!body) return;
  if (!item) {
    if (titleNode) titleNode.textContent = "选择脚本查看详情";
    body.innerHTML = `<article class="generate-preview-empty"><strong>脚本预览</strong><p>点击脚本库中的预览按钮后，在这里查看脚本正文、质量建议和操作。</p></article>`;
    return;
  }
  if (titleNode) titleNode.textContent = item.title || item.hook || `脚本 #${item.id}`;
  const isPending = pendingScriptReviews.has(String(item.id));
  const isRegenerating = pendingScriptRegenerations.has(String(item.id));
  const adoptedSynced = item.feishuSyncStatus === "synced";
  const controlsDisabled = isPending || isRegenerating;
  body.innerHTML = `
    <article class="generate-preview-summary simple-script-card">
      <div class="generate-preview-title-row">
        <h3>${escapeHtml(item.title || item.hook || `脚本 #${item.id}`)}</h3>
        ${scriptStatusPill(item)}
      </div>
      <p>${escapeHtml(item.campaignName || item.topic || "世界环球服")}，${escapeHtml(item.ownerName || "V1 内测管理员")}，${escapeHtml(formatDateTime(item.createdAt || item.generatedAt))}，脚本时长：${escapeHtml(scriptDuration(item))}</p>
    </article>
    <section class="generate-preview-tabs">
      <button class="active" type="button" data-script-preview-tab="content">脚本内容</button>
      <button type="button" data-script-preview-tab="analysis">脚本分析</button>
      <button type="button" data-script-preview-tab="materials">素材引用</button>
      <button type="button" data-script-preview-tab="history">生成记录</button>
    </section>
    <section class="generate-preview-panel active" data-script-preview-panel="content">
      <section class="generate-preview-script">
        <h4>${escapeHtml(item.hook || "脚本正文")}</h4>
        <div class="generate-preview-readable-script">${scriptReadableHtml(item.scriptBody || "暂无脚本正文")}</div>
      </section>
    </section>
    <section class="generate-preview-panel" data-script-preview-panel="analysis">
      ${scriptAnalysisHtml(item)}
    </section>
    <section class="generate-preview-panel" data-script-preview-panel="materials">
      ${scriptMaterialsHtml(item)}
    </section>
    <section class="generate-preview-panel" data-script-preview-panel="history">
      ${scriptHistoryHtml(item)}
    </section>
    <section class="generate-preview-insights preview-inline-insights">
      <article>
        <strong>风险检测</strong>
        ${qualityCheckSummaryHtml(item)}
      </article>
      <article>
        <strong>AI 质量建议</strong>
        <p>${escapeHtml(item.qualityNotes || "暂无质量建议。")}</p>
      </article>
    </section>
    <template data-legacy-preview-script>
    <section class="generate-preview-script">
      <h4>${escapeHtml(item.hook || "脚本正文")}</h4>
      <div class="generate-preview-readable-script">${scriptReadableHtml(item.scriptBody || "暂无脚本正文")}</div>
    </section>
    <section class="generate-preview-insights">
      <article>
        <strong>风险检测</strong>
        <dl>
          <div><dt>违规词检测</dt><dd>通过</dd></div>
          <div><dt>授权风险</dt><dd>${escapeHtml(item.feishuSyncStatus === "failed" ? "需检查同步" : "低风险")}</dd></div>
          <div><dt>过度营销</dt><dd>通过</dd></div>
        </dl>
      </article>
      <article>
        <strong>AI 质量建议</strong>
        <p>${escapeHtml(item.qualityNotes || "暂无质量建议。")}</p>
      </article>
    </section>
    </template>
    <div class="generate-preview-actions simple-actions">
      <button class="primary-script-action" type="button" data-script-review="${item.id}" data-status="adopted" ${controlsDisabled || adoptedSynced ? "disabled" : ""}>${isPending ? "同步中..." : adoptedSynced ? "已同步" : "采用并入飞书"}</button>
      ${item.reviewStatus === "needs_edit"
        ? `<button type="button" data-script-regenerate="${item.id}" ${controlsDisabled ? "disabled" : ""}>${isRegenerating ? "重新生成中..." : "待改并重生成"}</button>`
        : `<button type="button" data-script-regenerate="${item.id}" data-mark-needs-edit="true" ${controlsDisabled ? "disabled" : ""}>${isRegenerating ? "重新生成中..." : "待改并重生成"}</button>`}
      <button class="danger" type="button" data-script-review="${item.id}" data-status="rejected" ${controlsDisabled ? "disabled" : ""}>弃用</button>
      <button type="button" data-script-review="${item.id}" data-status="adopted" data-sample="true" data-synced="${adoptedSynced ? "true" : "false"}" ${controlsDisabled || item.isQualitySample ? "disabled" : ""}>${item.isQualitySample ? "已是优质样例" : "标为优质样例"}</button>
    </div>
    <div class="script-card-message-slot">${scriptActionMessageHtml(item.id)}${scriptFeishuSyncHtml(item)}</div>
  `;
}

function switchScriptPreviewTab(name = "content") {
  const drawer = document.getElementById("scriptPreviewDrawer");
  if (!drawer) return;
  drawer.querySelectorAll("[data-script-preview-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.scriptPreviewTab === name);
  });
  drawer.querySelectorAll("[data-script-preview-panel]").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.scriptPreviewPanel === name);
  });
  drawer.querySelector(".preview-inline-insights")?.classList.toggle("hidden", name !== "content");
}

function scriptAnalysisHtml(item) {
  return `
    <section class="generate-preview-insights stacked">
      <article>
        <strong>结构分析</strong>
        <p>${escapeHtml(item.qualityNotes || "脚本采用问题切入、产品展示、规则说明和行动引导的结构，适合短视频快速转化。")}</p>
      </article>
      <article>
        <strong>规则自检</strong>
        ${qualityCheckDetailHtml(item)}
      </article>
      <article>
        <strong>优化建议</strong>
        ${qualityCheckSuggestionHtml(item)}
      </article>
    </section>
  `;
}

function scriptQualityChecks(item) {
  return item?.output?.qualityChecks || {};
}

function qualityCheckStatusLabel(status) {
  return { pass: "通过", warning: "需复核", fail: "高风险" }[status] || "未检查";
}

function qualityCheckSummaryHtml(item) {
  const checks = scriptQualityChecks(item);
  const risks = Array.isArray(checks.riskItems) ? checks.riskItems : [];
  if (!checks.version) {
    return `<dl><div><dt>规则自检</dt><dd>旧脚本暂无自检</dd></div><div><dt>价格承诺</dt><dd>${escapeHtml((item.scriptBody || "").includes("最低") ? "需复核" : "低风险")}</dd></div></dl>`;
  }
  return `
    <dl>
      <div><dt>自检状态</dt><dd>${escapeHtml(qualityCheckStatusLabel(checks.status))}</dd></div>
      <div><dt>风险数量</dt><dd>${risks.length}</dd></div>
      <div><dt>检查版本</dt><dd>${escapeHtml(checks.version)}</dd></div>
    </dl>
  `;
}

function qualityCheckDetailHtml(item) {
  const checks = scriptQualityChecks(item);
  const risks = Array.isArray(checks.riskItems) ? checks.riskItems : [];
  if (!checks.version) return `<p>旧脚本暂无规则自检。下一次生成后会自动记录缺价格边界、未确认价格、绝对化表达、素材复制等检查结果。</p>`;
  if (!risks.length) return `<p>${escapeHtml(checks.summary || "规则自检通过。")}</p>`;
  return `
    <div class="quality-check-list">
      ${risks.map((risk) => `
        <article class="${escapeHtml(risk.level || "warning")}">
          <strong>${escapeHtml(risk.label || risk.code || "需复核")}</strong>
          <p>${escapeHtml(risk.suggestion || "请人工复核。")}</p>
        </article>
      `).join("")}
    </div>
  `;
}

function qualityCheckSuggestionHtml(item) {
  const checks = scriptQualityChecks(item);
  const suggestions = Array.isArray(checks.suggestions) ? checks.suggestions : [];
  if (suggestions.length) return `<ul>${suggestions.map((text) => `<li>${escapeHtml(text)}</li>`).join("")}</ul>`;
  return `<p>${escapeHtml(item.manualFeedback || "可继续强化前三秒利益点，并确保活动规则、库存和价格边界按真实页面为准。")}</p>`;
}

function scriptMaterialsHtml(item) {
  const materialIds = Array.isArray(item.materialIds) ? item.materialIds : [];
  const materialNames = Array.isArray(item.materialTitles) ? item.materialTitles : [];
  const rows = materialNames.length ? materialNames : materialIds.map((id) => `素材 #${id}`);
  return `
    <section class="generate-preview-reference-list">
      <article>
        <strong>引用活动</strong>
        <p>${escapeHtml(item.campaignName || item.topic || "暂无活动快照")}</p>
      </article>
      <article>
        <strong>参考素材</strong>
        ${rows.length ? `<ul>${rows.map((name) => `<li>${escapeHtml(name)}</li>`).join("")}</ul>` : `<p>暂无素材引用记录。生成时选择的素材会在这里展示。</p>`}
      </article>
      <article>
        <strong>输入快照</strong>
        <p>脚本时长：${escapeHtml(scriptDuration(item))}；生成时间：${escapeHtml(formatDateTime(item.createdAt || item.generatedAt))}</p>
      </article>
    </section>
  `;
}

function scriptHistoryHtml(item) {
  const log = item.generationLog || {};
  const snapshot = log.requestSnapshot || {};
  const rules = snapshot.qualityRules || {};
  const hasLog = Boolean(log.id);
  return `
    <section class="generate-preview-timeline">
      <article>
        <span></span>
        <div>
          <strong>生成调用</strong>
          <p>${escapeHtml(hasLog ? `${generationLogStatusLabel(log.status)} · ${log.generator || "生成器待记录"} / ${log.provider || "provider 待记录"}` : "旧脚本暂无生成日志")}</p>
        </div>
      </article>
      <article>
        <span></span>
        <div>
          <strong>Prompt 版本</strong>
          <p>${escapeHtml(log.promptVersion || "未记录")} ${log.latencyMs ? ` / ${log.latencyMs}ms` : ""}</p>
        </div>
      </article>
      <article>
        <span></span>
        <div>
          <strong>输入包</strong>
          <p>${escapeHtml(`活动 ${Array.isArray(snapshot.campaignIds) ? snapshot.campaignIds.length : 0} 个 / 素材 ${Array.isArray(snapshot.materialIds) ? snapshot.materialIds.length : 0} 条 / ${snapshot.outputMode || "输出方式未记录"}`)}</p>
        </div>
      </article>
      <article>
        <span></span>
        <div>
          <strong>人工干预</strong>
          <p>${escapeHtml(rules.manualFeedback || "本次没有额外人工反馈。")}</p>
        </div>
      </article>
      <article>
        <span></span>
        <div>
          <strong>结果状态</strong>
          <p>${escapeHtml(log.error ? `失败：${log.error}` : `脚本状态：${scriptStatusLabel(item.reviewStatus || "new")}${item.isQualitySample ? " / 优质样例" : ""}`)}</p>
        </div>
      </article>
    </section>
  `;
}

function generationLogStatusLabel(status) {
  return {
    running: "调用中",
    success: "调用成功",
    failed: "调用失败",
  }[status] || status || "状态未记录";
}

function scriptReadableHtml(value) {
  const blocks = String(value || "")
    .split(/\n{2,}|\n(?=\s*\d+\s*[-–—~至]\s*\d+s?)/i)
    .map((block) => block.trim())
    .filter(Boolean);
  if (!blocks.length) return `<p>暂无脚本正文</p>`;
  return blocks.map((block) => {
    const timeMatch = block.match(/^(\s*\d+\s*[-–—~至]\s*\d+s?[^|｜：:]*[|｜：:]?)/i);
    const content = timeMatch ? block.slice(timeMatch[0].length).trim() : block;
    return `
      <article class="generate-readable-block">
        ${timeMatch ? `<span>${escapeHtml(timeMatch[1].replace(/[|｜：:]$/, "").trim())}</span>` : ""}
        <p>${escapeHtml(content || block)}</p>
      </article>
    `;
  }).join("");
}

function scriptActionScope(button) {
  return button?.closest(".simple-script-card") || button?.closest("[data-script-row]") || button?.closest(".generate-preview-drawer");
}

function setScriptControlsDisabled(button, disabled) {
  scriptActionScope(button)?.querySelectorAll("[data-script-review], [data-script-regenerate]").forEach((item) => { item.disabled = disabled; });
}

async function reviewScript(id, status, sample, sourceButton) {
  const key = String(id);
  if (pendingScriptReviews.has(key)) return;
  pendingScriptReviews.add(key);
  const button = sourceButton || document.querySelector(`[data-script-review="${CSS.escape(key)}"][data-status="${CSS.escape(status)}"]`);
  const originalText = button?.textContent || "";
  const alreadySynced = button?.dataset.synced === "true";
  if (button) {
    button.textContent = sample ? (alreadySynced ? "加入样例中..." : "同步并加入中...") : (status === "adopted" ? "同步中..." : "更新中...");
    setScriptControlsDisabled(button, true);
  }
  try {
    const activeMessage = sample
      ? (alreadySynced ? "正在加入优质样例库..." : "正在写入飞书并加入优质样例库...")
      : (status === "adopted" ? "正在采用并同步飞书脚本库..." : "正在更新审核状态...");
    setScriptActionMessage(key, "", activeMessage);
    const result = await apiJson(`/api/simple-agent/scripts/${id}/review`, {
      method: "POST",
      body: JSON.stringify({ reviewStatus: status, isQualitySample: sample, reviewNote: sample ? "已标记为优质样例" : "" }),
    });
    const skippedSync = result.item?.feishuSync?.skipped;
    const successMessage = sample
      ? (skippedSync ? "已加入优质样例库，飞书已有记录，本次未重复写入。" : "已写入飞书，并加入优质样例库。")
      : (status === "adopted" ? "已采用，并已写入飞书脚本库。" : "审核状态已更新。");
    setScriptActionMessage(key, "ok", successMessage);
    pendingScriptReviews.delete(key);
    await refreshScriptWorkbench();
  } catch (error) {
    setScriptActionMessage(key, "warning", `复盘失败：${error.message}`);
    if (button) {
      button.textContent = originalText;
      setScriptControlsDisabled(button, false);
    }
  }
  pendingScriptReviews.delete(key);
}

async function regenerateScript(id, sourceButton) {
  const key = String(id);
  if (pendingScriptRegenerations.has(key)) return;
  pendingScriptRegenerations.add(key);
  const button = sourceButton || document.querySelector(`[data-script-regenerate="${CSS.escape(key)}"]`);
  const originalText = button?.textContent || "";
  const shouldMarkNeedsEdit = button?.dataset.markNeedsEdit === "true";
  const feedback = (sourceButton?.dataset.regenerateFeedback || "").trim() || "基于待改状态重新生成";
  if (button) {
    button.textContent = "重新生成中...";
    setScriptControlsDisabled(button, true);
  }
  try {
    setScriptActionMessage(key, "", shouldMarkNeedsEdit ? "正在标记待改并重新生成..." : "正在根据待改反馈重新生成...");
    if (shouldMarkNeedsEdit) {
      await apiJson(`/api/simple-agent/scripts/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ reviewStatus: "needs_edit", reviewNote: feedback }),
      });
    }
    await apiJson(`/api/simple-agent/scripts/${id}/regenerate`, {
      method: "POST",
      body: JSON.stringify({ reviewNote: feedback }),
    });
    setScriptActionMessage(key, "ok", "已重新生成 1 条脚本。");
    pendingScriptRegenerations.delete(key);
    await refreshScriptWorkbench();
  } catch (error) {
    setScriptActionMessage(key, "warning", `重新生成失败：${error.message}`);
    if (button) {
      button.textContent = originalText;
      setScriptControlsDisabled(button, false);
    }
  }
  pendingScriptRegenerations.delete(key);
}

function openRegenerateModal(id, sourceButton) {
  const modal = document.getElementById("scriptRegenerateModal");
  const body = document.getElementById("scriptRegenerateContext");
  const input = document.getElementById("scriptRegenerateFeedback");
  if (!modal || !body || !input) {
    regenerateScript(id, sourceButton);
    return;
  }
  const card = sourceButton?.closest(".simple-script-card") || sourceButton?.closest("[data-script-row]") || sourceButton?.closest(".generate-preview-drawer");
  const title = card?.querySelector(".simple-item-head strong, .generate-script-title-cell strong, .generate-preview-summary h3, #scriptPreviewTitle")?.textContent?.trim() || `脚本 #${id}`;
  const hook = card?.querySelector(".script-hook")?.textContent?.trim() || "";
  pendingRegenerateRequest = { id, sourceButton };
  body.innerHTML = `
    <strong>${escapeHtml(title)}</strong>
    ${hook ? `<p>${escapeHtml(hook)}</p>` : ""}
  `;
  input.value = "";
  setValue("scriptRegenerateIssue", "");
  setValue("scriptRegenerateFocus", "");
  setValue("scriptRegenerateIntensity", "中改：保留活动信息，重排结构和表达");
  input.placeholder = [
    "可选填：",
    "例如：保留活动规则和价格边界，开头更像真实探店，不要太像广告。",
    "如果上面已选择问题和改写重点，这里可以只补充具体偏好。",
  ].join("\n");
  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");
  input.focus();
}

function confirmRegenerateScript() {
  const request = pendingRegenerateRequest;
  const input = document.getElementById("scriptRegenerateFeedback");
  const message = document.getElementById("scriptRegenerateMessage");
  const feedback = buildRegenerateFeedback(input?.value || "");
  if (!request) return;
  if (!feedback) {
    if (message) {
      message.className = "v2-import-message warning";
      message.textContent = "请先写清楚这次希望怎么改。";
    }
    return;
  }
  request.sourceButton.dataset.regenerateFeedback = feedback;
  closeModal("scriptRegenerateModal");
  pendingRegenerateRequest = null;
  regenerateScript(request.id, request.sourceButton);
}

function buildRegenerateFeedback(customText = "") {
  const issue = valueOf("scriptRegenerateIssue");
  const focus = valueOf("scriptRegenerateFocus");
  const intensity = valueOf("scriptRegenerateIntensity");
  const extra = String(customText || "").trim();
  const parts = [
    issue ? `主要问题：${issue}` : "",
    focus ? `改写重点：${focus}` : "",
    intensity ? `修改强度：${intensity}` : "",
    extra ? `补充说明：${extra}` : "",
    "保留边界：品牌、商品、活动规则、价格边界和渠道范围必须沿用已确认信息，不要新增未经确认内容。",
  ].filter(Boolean);
  if (!issue && !focus && !extra) return "";
  return parts.join("\n");
}

function setScriptActionMessage(id, state, text) {
  scriptActionMessages.set(String(id), { state, text });
  renderInlineScriptActionMessage(id);
}

function renderInlineScriptActionMessage(id) {
  const card = document.querySelector(`[data-script-review="${CSS.escape(String(id))}"], [data-script-regenerate="${CSS.escape(String(id))}"]`)?.closest(".simple-script-card, [data-script-row], .generate-preview-drawer");
  if (!card) return;
  const slot = card.querySelector(".script-card-message-slot") || card.querySelector(".simple-actions");
  if (!slot) return;
  slot.querySelector(".simple-action-message")?.remove();
  slot.insertAdjacentHTML("beforeend", scriptActionMessageHtml(id));
}

function metricCard([label, value, note]) {
  return `<article><span>${escapeHtml(label)}</span><strong>${value}</strong><p>${escapeHtml(note)}</p></article>`;
}

function emptyState(title, note) {
  return `<article class="simple-empty"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(note)}</p></article>`;
}

function valueOf(id) {
  return document.getElementById(id)?.value.trim() || "";
}

function extractFirstUrl(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/https?:\/\/[^\s<>'"，。！？；、]+/i);
  return normalizeVideoUrl(match ? match[0].replace(/[.,;:!?)]}，。！？；：、）】》]+$/g, "") : raw);
}

function normalizeVideoUrl(value) {
  const raw = String(value || "").trim();
  const lower = raw.toLowerCase();
  if (lower.includes("douyin.com") || lower.includes("iesdouyin.com")) {
    const modalMatch = raw.match(/[?&]modal_id=(\d{15,20})/);
    if (modalMatch) return `https://www.iesdouyin.com/share/video/${modalMatch[1]}/`;
    const videoMatch = raw.match(/\/video\/(\d{15,20})/);
    if (videoMatch && !lower.includes("/share/video/")) return `https://www.iesdouyin.com/share/video/${videoMatch[1]}/`;
  }
  return raw;
}

function extractShareTitle(value) {
  const match = String(value || "").match(/《([^》]{1,120})》/);
  return match ? match[1].trim() : "";
}

function extractShareTags(value) {
  return Array.from(String(value || "").matchAll(/#\s*([^#\s，。！？；、]+)/g))
    .map((match) => match[1].trim())
    .filter(Boolean);
}

function detectPlatformFromUrl(value) {
  const raw = String(value || "").toLowerCase();
  if (raw.includes("douyin.com")) return "douyin";
  if (raw.includes("xiaohongshu.com") || raw.includes("xhslink.com")) return "xhs";
  return "douyin";
}

function clearValue(id) {
  const node = document.getElementById(id);
  if (node) node.value = "";
}

function setValue(id, value) {
  const node = document.getElementById(id);
  if (node) node.value = value;
}

function setStatus(id, state, message) {
  const node = document.getElementById(id);
  if (!node) return;
  node.textContent = message;
  node.className = `api-status ${state}`;
}

function setMessage(id, state, message) {
  const node = document.getElementById(id);
  if (!node) return;
  node.textContent = message;
  node.className = `v2-import-message ${state}`;
}

function checkedValues(selector) {
  return Array.from(document.querySelectorAll(selector)).filter((item) => item.checked).map((item) => item.value);
}

function splitDateRange(value) {
  const parts = String(value || "").split(/[-~至到]/).map((item) => item.trim()).filter(Boolean);
  return [parts[0] || "", parts[1] || ""];
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16).replace("T", " ");
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
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
