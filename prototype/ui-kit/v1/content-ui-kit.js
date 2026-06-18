(function () {
  const iconPaths = {
    grid: '<rect x="4" y="4" width="6" height="6" rx="1.5"></rect><rect x="14" y="4" width="6" height="6" rx="1.5"></rect><rect x="4" y="14" width="6" height="6" rx="1.5"></rect><rect x="14" y="14" width="6" height="6" rx="1.5"></rect>',
    layout: '<rect x="4" y="5" width="16" height="14" rx="2"></rect><path d="M9 5v14"></path><path d="M9 10h11"></path>',
    palette: '<path d="M12 4a8 8 0 0 0 0 16h1.2a1.8 1.8 0 0 0 1.3-3.05 1.45 1.45 0 0 1 1.03-2.47H17a3 3 0 0 0 3-3A7.5 7.5 0 0 0 12 4Z"></path><circle cx="8.5" cy="11" r=".8"></circle><circle cx="10.5" cy="8" r=".8"></circle><circle cx="14" cy="8" r=".8"></circle>',
    sliders: '<path d="M4 7h10"></path><path d="M18 7h2"></path><circle cx="16" cy="7" r="2"></circle><path d="M4 17h2"></path><path d="M10 17h10"></path><circle cx="8" cy="17" r="2"></circle>',
    table: '<rect x="4" y="5" width="16" height="14" rx="2"></rect><path d="M4 10h16"></path><path d="M10 5v14"></path>',
    modal: '<rect x="5" y="6" width="14" height="12" rx="2"></rect><path d="M8 10h8"></path><path d="M8 14h5"></path>',
    briefcase: '<path d="M9 7V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1"></path><rect x="4" y="7" width="16" height="12" rx="2"></rect><path d="M4 12h16"></path>',
    image: '<rect x="4" y="5" width="16" height="14" rx="2"></rect><circle cx="9" cy="10" r="1.5"></circle><path d="m7 17 4-4 3 3 2-2 2 3"></path>',
    megaphone: '<path d="M4 13V9h3l8-4v12l-8-4H4Z"></path><path d="M7 13l1.3 5H11"></path><path d="M18 9.5a3 3 0 0 1 0 3"></path>',
    doc: '<path d="M7 4h7l3 3v13H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"></path><path d="M14 4v4h4"></path><path d="M8 12h8"></path><path d="M8 16h6"></path>',
    library: '<path d="M5 5h4v14H5z"></path><path d="M10 5h4v14h-4z"></path><path d="m15 6 3-.8 3 12.8-3 .8z"></path>',
    chart: '<path d="M5 19V9"></path><path d="M12 19V5"></path><path d="M19 19v-7"></path>',
    paste: '<path d="M9 5h6"></path><path d="M10 4h4a2 2 0 0 1 2 2v1H8V6a2 2 0 0 1 2-2Z"></path><rect x="6" y="7" width="12" height="13" rx="2"></rect><path d="M9 12h6"></path><path d="M9 16h4"></path>',
    settings: '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.04.04-2.12 2.12-.04-.04a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.1 1.66V20h-3v-.06a1.8 1.8 0 0 0-1.1-1.66 1.8 1.8 0 0 0-1.98.36l-.04.04-2.12-2.12.04-.04A1.8 1.8 0 0 0 4.6 15 1.8 1.8 0 0 0 3 13.9H3v-3h.06a1.8 1.8 0 0 0 1.66-1.1 1.8 1.8 0 0 0-.36-1.98l-.04-.04 2.12-2.12.04.04a1.8 1.8 0 0 0 1.98.36 1.8 1.8 0 0 0 1.1-1.66V4h3v.06a1.8 1.8 0 0 0 1.1 1.66 1.8 1.8 0 0 0 1.98-.36l.04-.04 2.12 2.12-.04.04a1.8 1.8 0 0 0-.36 1.98 1.8 1.8 0 0 0 1.66 1.1H21v3h-.06A1.8 1.8 0 0 0 19.4 15Z"></path>',
    download: '<path d="M12 4v10"></path><path d="m8 10 4 4 4-4"></path><path d="M5 20h14"></path>',
    upload: '<path d="M12 20V10"></path><path d="m8 14 4-4 4 4"></path><path d="M5 4h14"></path>',
    search: '<circle cx="11" cy="11" r="6"></circle><path d="m16 16 4 4"></path>',
    eye: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path><circle cx="12" cy="12" r="3"></circle>',
    more: '<circle cx="5" cy="12" r="1"></circle><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle>',
    video: '<rect x="4" y="6" width="12" height="12" rx="2"></rect><path d="m16 10 4-2v8l-4-2"></path>',
    warning: '<path d="m12 4 9 16H3L12 4Z"></path><path d="M12 9v5"></path><path d="M12 17h.01"></path>',
    link: '<path d="M10 13a5 5 0 0 0 7.07 0l2-2a5 5 0 0 0-7.07-7.07l-1.15 1.15"></path><path d="M14 11a5 5 0 0 0-7.07 0l-2 2A5 5 0 0 0 12 20.07l1.15-1.15"></path>',
    play: '<path d="m9 7 8 5-8 5V7Z"></path>',
    close: '<path d="M6 6l12 12"></path><path d="M18 6 6 18"></path>'
  };

  const platformIcons = {
    douyin: '<svg viewBox="0 0 32 32" aria-hidden="true"><path class="dy-cyan" d="M18.4 6.4c.45 3.8 2.7 6.3 6.2 6.55v4.1a10.9 10.9 0 0 1-6.1-1.95v6.05c0 4.85-3.45 7.85-7.5 7.85-4.15 0-7.15-2.7-7.15-6.35 0-4.3 3.65-6.9 7.95-6.15v4.2c-1.9-.55-3.65.35-3.65 1.95 0 1.25 1.15 2.1 2.65 2.1 1.65 0 3.15-.95 3.15-3.55V6.4h4.45Z"></path><path class="dy-red" d="M20.15 5.2c.45 3.8 2.7 6.3 6.2 6.55v4.1a10.9 10.9 0 0 1-6.1-1.95v6.05c0 4.85-3.45 7.85-7.5 7.85-4.15 0-7.15-2.7-7.15-6.35 0-4.3 3.65-6.9 7.95-6.15v4.2c-1.9-.55-3.65.35-3.65 1.95 0 1.25 1.15 2.1 2.65 2.1 1.65 0 3.15-.95 3.15-3.55V5.2h4.45Z"></path><path class="dy-main" d="M19.25 5.8c.45 3.8 2.7 6.3 6.2 6.55v4.1a10.9 10.9 0 0 1-6.1-1.95v6.05c0 4.85-3.45 7.85-7.5 7.85-4.15 0-7.15-2.7-7.15-6.35 0-4.3 3.65-6.9 7.95-6.15v4.2c-1.9-.55-3.65.35-3.65 1.95 0 1.25 1.15 2.1 2.65 2.1 1.65 0 3.15-.95 3.15-3.55V5.8h4.45Z"></path></svg>',
    xhs: '<svg viewBox="0 0 32 32" aria-hidden="true"><path class="xhs-book" d="M8.2 7.2h15.6c1.1 0 2 .9 2 2v13.6c0 1.1-.9 2-2 2H8.2c-1.1 0-2-.9-2-2V9.2c0-1.1.9-2 2-2Z"></path><path class="xhs-line" d="M11.2 12h9.6"></path><path class="xhs-line" d="M11.2 16h7.6"></path><path class="xhs-line" d="M11.2 20h5.4"></path><path class="xhs-line" d="M22.1 12v8"></path></svg>',
    wechat: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M13.6 11.3c-4 0-7.2 2.5-7.2 5.7 0 1.7.9 3.2 2.4 4.2l-.6 2 2.5-1.2c.9.3 1.9.5 2.9.5 4 0 7.2-2.5 7.2-5.6s-3.2-5.6-7.2-5.6Z"></path><path d="M18.3 8.2c3.8.4 6.7 2.9 6.7 5.9 0 1.6-.8 3-2.1 4l.5 1.7-2.1-1c-.5.2-1 .3-1.6.4"></path><circle cx="11.2" cy="16.2" r=".6"></circle><circle cx="15.8" cy="16.2" r=".6"></circle></svg>',
    kuaishou: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="7" y="11" width="18" height="13" rx="3"></rect><circle cx="12.3" cy="17.5" r="2.1"></circle><circle cx="19.7" cy="17.5" r="2.1"></circle><path d="M12 11 9.8 7.8a2 2 0 0 1 3.3-2.2L16 9.6l2.9-4a2 2 0 0 1 3.3 2.2L20 11"></path></svg>',
    bilibili: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="6" y="10" width="20" height="14" rx="3"></rect><path d="m12 7 3 3"></path><path d="m20 7-3 3"></path><path d="M12 16v2"></path><path d="M20 16v2"></path><path d="M14 21h4"></path></svg>'
  };

  function hydrate(root = document) {
    root.querySelectorAll("[data-icon]").forEach((node) => {
      const name = node.dataset.icon;
      if (!iconPaths[name]) return;
      node.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${iconPaths[name]}</svg>`;
    });

    root.querySelectorAll("[data-platform]").forEach((node) => {
      const name = node.dataset.platform;
      if (!platformIcons[name]) return;
      node.innerHTML = platformIcons[name];
    });
  }

  window.ContentUiKitHydrate = hydrate;
  hydrate(document);

  const app = document.querySelector(".kit-app");
  const savedDensity = localStorage.getItem("content-ui-kit-density") || "standard";
  setDensity(savedDensity);

  function setDensity(density) {
    if (!app) return;
    const next = ["comfortable", "standard", "compact", "dense"].includes(density) ? density : "standard";
    app.dataset.density = next;
    document.body.dataset.density = next;
    localStorage.setItem("content-ui-kit-density", next);
    document.querySelectorAll("[data-density-option]").forEach((button) => {
      button.classList.toggle("active", button.dataset.densityOption === next);
    });
  }

  const modalMap = {
    appShell: document.getElementById("appShellModal"),
    edit: document.getElementById("editModal"),
    confirm: document.getElementById("confirmModal"),
    rich: document.getElementById("richModal")
  };

  function openModal(name) {
    const modal = modalMap[name];
    if (!modal) return;
    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeModal(modal) {
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
    if (!document.querySelector(".kit-modal.active")) {
      document.body.style.overflow = "";
    }
  }

  document.addEventListener("click", (event) => {
    const openButton = event.target.closest("[data-open-modal]");
    if (openButton) {
      const name = openButton.dataset.openModal;
      if (name === "toast") {
        showToast("这是组件库反馈样式");
        return;
      }
      openModal(name);
      return;
    }

    const densityButton = event.target.closest("[data-density-option]");
    if (densityButton) {
      setDensity(densityButton.dataset.densityOption);
      return;
    }

    const closeTarget = event.target.closest("[data-close-modal]");
    if (closeTarget) {
      const modal = closeTarget.closest(".kit-modal");
      if (modal) closeModal(modal);
      return;
    }

    const toastButton = event.target.closest("[data-toast]");
    if (toastButton) {
      showToast(toastButton.dataset.toast || "操作成功");
      const modal = toastButton.closest(".kit-modal");
      if (modal) closeModal(modal);
      return;
    }

    const richTab = event.target.closest("[data-rich-tab]");
    if (richTab) {
      const tabName = richTab.dataset.richTab;
      document.querySelectorAll("[data-rich-tab]").forEach((tab) => {
        tab.classList.toggle("active", tab === richTab);
      });
      document.querySelectorAll("[data-rich-panel]").forEach((panel) => {
        panel.classList.toggle("active", panel.dataset.richPanel === tabName);
      });
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    document.querySelectorAll(".kit-modal.active").forEach(closeModal);
  });

  let toastTimer = null;
  function showToast(message) {
    const toast = document.getElementById("kitToast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("active");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("active"), 2200);
  }
})();
