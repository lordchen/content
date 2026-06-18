const BRAND_API_BASE = "http://127.0.0.1:8771";

const brandProductStatus = document.getElementById("brandProductStatus");
const brandProductSummary = document.getElementById("brandProductSummary");
const brandProductList = document.getElementById("brandProductList");
const productMessage = document.getElementById("productMessage");
const saveBrandProductBtn = document.getElementById("saveBrandProduct");

saveBrandProductBtn?.addEventListener("click", () => saveBrandProduct());
brandProductList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-brand-product-id]");
  if (button) toggleBrandProductSelection(button);
});

loadBrandProducts();

async function loadBrandProducts() {
  setBrandStatus("pending", "正在读取商品活动...");
  try {
    const response = await fetch(`${BRAND_API_BASE}/api/v2/brand-products`);
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    const items = data.items || [];
    const selected = items.filter((item) => item.selected).length;
    setBrandStatus("online", `商品活动已连接：${items.length} 条，${selected} 条已加入生成`);
    renderBrandProductSummary(items);
    renderBrandProducts(items);
  } catch (error) {
    setBrandStatus("offline", `商品活动读取失败：${error.message}`);
  }
}

function renderBrandProductSummary(items) {
  if (!brandProductSummary) return;
  const selected = items.filter((item) => item.selected).length;
  const active = items.filter((item) => item.status === "active").length;
  brandProductSummary.innerHTML = `
    <article>
      <span>商品活动</span>
      <strong>${items.length}</strong>
      <p>全部已入库活动</p>
    </article>
    <article>
      <span>生成输入</span>
      <strong>${selected}</strong>
      <p>会被脚本生成读取</p>
    </article>
    <article>
      <span>有效活动</span>
      <strong>${active}</strong>
      <p>状态为 active</p>
    </article>
  `;
}

function renderBrandProducts(items) {
  if (!brandProductList) return;
  brandProductList.innerHTML = items.length
    ? items.map((item) => brandProductCard(item)).join("")
    : `<article class="brand-product-card empty-state"><strong>还没有商品活动</strong><p>先添加今天可以说的商品、权益和限制。</p></article>`;
}

function brandProductCard(item) {
  const points = Array.isArray(item.sellingPoints) ? item.sellingPoints.slice(0, 5) : [];
  return `
    <article class="brand-product-card ${item.selected ? "selected" : ""}">
      <div class="brand-product-head">
        <div>
          <strong>${escapeHtml(item.productName)}</strong>
          <p>${escapeHtml(item.productGroup || "未分组")} / ${escapeHtml(item.storeScope || "门店范围待补")}</p>
        </div>
        <span>${item.selected ? "已加入生成" : "未加入"}</span>
      </div>
      <div class="brand-product-points">
        ${points.length ? points.map((point) => `<span>${escapeHtml(point)}</span>`).join("") : "<span>卖点待补</span>"}
      </div>
      <div class="brand-product-rules">
        <p><b>活动规则</b>${escapeHtml(item.activityRules || "活动规则待补")}</p>
        <p><b>合规说明</b>${escapeHtml(item.priceNote || "价格、库存和核销说明待补")}</p>
      </div>
      <div class="content-source-actions">
        <button type="button" data-brand-product-id="${item.id}" data-selected="${item.selected ? "false" : "true"}">
          ${item.selected ? "移出生成输入" : "加入生成输入"}
        </button>
      </div>
    </article>
  `;
}

async function saveBrandProduct() {
  if (!saveBrandProductBtn || !productMessage) return;
  const productName = document.getElementById("productName")?.value.trim() || "";
  const productGroup = document.getElementById("productGroup")?.value.trim() || "";
  const sellingPoints = document.getElementById("productSellingPoints")?.value.trim() || "";
  const storeScope = document.getElementById("productStoreScope")?.value.trim() || "";
  const activityRules = document.getElementById("productActivityRules")?.value.trim() || "";
  const priceNote = document.getElementById("productPriceNote")?.value.trim() || "";
  setProductMessage("", "正在准备保存...");
  if (!productName || (!sellingPoints && !activityRules)) {
    setProductMessage("warning", "请填写商品/活动名，并至少填写卖点或活动规则。");
    return;
  }
  saveBrandProductBtn.disabled = true;
  try {
    const response = await fetch(`${BRAND_API_BASE}/api/v2/brand-products`, {
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
    setProductMessage("ok", `已保存并加入生成：${data.item.productName}`);
    ["productName", "productGroup", "productSellingPoints", "productStoreScope", "productActivityRules", "productPriceNote"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    await loadBrandProducts();
  } catch (error) {
    setProductMessage("warning", `保存失败：${error.message}`);
  } finally {
    saveBrandProductBtn.disabled = false;
  }
}

async function toggleBrandProductSelection(button) {
  const id = button.dataset.brandProductId;
  const selected = button.dataset.selected === "true";
  if (!id) return;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "处理中...";
  setProductMessage("", selected ? "正在加入生成输入..." : "正在移出生成输入...");
  try {
    const response = await fetch(`${BRAND_API_BASE}/api/v2/brand-products/${id}/select`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selected }),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    setProductMessage("ok", selected ? `已加入：${data.item.productName}` : `已移出：${data.item.productName}`);
    await loadBrandProducts();
  } catch (error) {
    setProductMessage("warning", `操作失败：${error.message}`);
    button.disabled = false;
    button.textContent = originalText;
  }
}

function setBrandStatus(state, message) {
  if (!brandProductStatus) return;
  brandProductStatus.textContent = message;
  brandProductStatus.className = `api-status ${state}`;
}

function setProductMessage(state, message) {
  if (!productMessage) return;
  productMessage.textContent = message;
  productMessage.className = `v2-import-message ${state}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
