// admin/assets/js/pages/products.js
// 商品列表頁：讀取 Supabase products 表，顯示商品、縮圖、庫存、商品狀態、前台顯示狀態與編輯入口。

const productsTableBody = document.getElementById("productsTableBody");
const productStatusText = document.getElementById("productStatusText");
const totalProductsEl = document.getElementById("totalProducts");
const activeProductsEl = document.getElementById("activeProducts");
const lowStockProductsEl = document.getElementById("lowStockProducts");
const refreshProductsBtn = document.getElementById("refreshProductsBtn");

const STATUS_LABELS = {
  draft: "草稿",
  active: "已上架",
  paused: "暫停販售",
  sold_out: "售完",
  archived: "下架"
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatPrice(price) {
  return `NT$ ${Number(price || 0).toLocaleString()}`;
}

function getProductImageSrc(image) {
  if (!image) return "";

  const imageText = String(image).trim();

  if (imageText.startsWith("http://") || imageText.startsWith("https://")) {
    return imageText;
  }

  if (imageText.startsWith("images/")) {
    return `../../${imageText}`;
  }

  if (imageText.startsWith("/")) {
    return imageText;
  }

  return `../../images/${imageText}`;
}

function getStatusLabel(status) {
  return STATUS_LABELS[status] || status || "-";
}

function renderSummary(products) {
  const total = products.length;
  const active = products.filter((product) => product.status === "active").length;

  const lowStock = products.filter((product) => {
    return Number(product.stock || 0) <= Number(product.safety_stock || 0);
  }).length;

  totalProductsEl.textContent = total;
  activeProductsEl.textContent = active;
  lowStockProductsEl.textContent = lowStock;
}

function renderProductImage(product) {
  const imageUrl = getProductImageSrc(product.cover_image);

  if (!imageUrl) {
    return `
      <div class="product-thumb product-thumb-empty">
        <span>無圖</span>
      </div>
    `;
  }

  return `
    <div class="product-thumb">
      <img
        src="${escapeHtml(imageUrl)}"
        alt="${escapeHtml(product.name)}"
        onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';"
      >
      <span class="product-thumb-fallback">無圖</span>
    </div>
  `;
}

function renderStatusSelect(product) {
  const currentStatus = product.status || "draft";

  return `
    <select
      class="product-status-select status-select-${escapeHtml(currentStatus)}"
      data-action="change-status"
      data-id="${escapeHtml(product.id)}"
      data-current-status="${escapeHtml(currentStatus)}"
      aria-label="商品狀態"
    >
      <option value="draft" ${currentStatus === "draft" ? "selected" : ""}>草稿</option>
      <option value="active" ${currentStatus === "active" ? "selected" : ""}>已上架</option>
      <option value="paused" ${currentStatus === "paused" ? "selected" : ""}>暫停販售</option>
      <option value="sold_out" ${currentStatus === "sold_out" ? "selected" : ""}>售完</option>
      <option value="archived" ${currentStatus === "archived" ? "selected" : ""}>下架</option>
    </select>
  `;
}

function renderProducts(products) {
  if (!products.length) {
    productsTableBody.innerHTML = `<tr><td colspan="10">目前沒有商品資料。</td></tr>`;
    return;
  }

  productsTableBody.innerHTML = products.map((product) => {
    const isLowStock = Number(product.stock || 0) <= Number(product.safety_stock || 0);
    const editUrl = `product-editor.html?id=${encodeURIComponent(product.id)}`;

    return `
      <tr>
        <td>${renderProductImage(product)}</td>

        <td>${escapeHtml(product.sku)}</td>

        <td>
          <strong>${escapeHtml(product.name)}</strong>
          ${isLowStock ? `<div class="admin-warning-text">庫存偏低</div>` : ""}
        </td>

        <td>${escapeHtml(product.category || "-")}</td>
        <td>${escapeHtml(product.weight || "-")}</td>
        <td>${formatPrice(product.price)}</td>
        <td>${Number(product.stock || 0)}</td>
        <td>${Number(product.safety_stock || 0)}</td>

        <td>
          ${renderStatusSelect(product)}
        </td>

        <td>
          <div class="product-actions">
            <button
              type="button"
              class="${product.is_visible ? "product-visible" : "product-hidden"}"
              data-action="toggle-visible"
              data-id="${escapeHtml(product.id)}"
              data-visible="${product.is_visible ? "true" : "false"}"
            >
              ${product.is_visible ? "顯示" : "不顯示"}
            </button>

            <a class="product-edit-btn" href="${editUrl}">編輯</a>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

async function toggleProductVisible(productId, currentVisible) {
  if (!window.supabaseClient) {
    productStatusText.textContent = "Supabase 尚未設定";
    return;
  }

  const nextVisible = !currentVisible;

  productStatusText.textContent = "更新前台顯示狀態中...";

  const { error } = await window.supabaseClient
    .from("products")
    .update({
      is_visible: nextVisible
    })
    .eq("id", productId);

  if (error) {
    console.error("更新前台顯示狀態失敗：", error);
    productStatusText.textContent = "更新前台顯示狀態失敗";
    return;
  }

  productStatusText.textContent = "前台顯示狀態已更新";

  await loadProducts();
}

async function updateProductStatus(productId, nextStatus, selectElement) {
  if (!window.supabaseClient) {
    productStatusText.textContent = "Supabase 尚未設定";
    return;
  }

  if (!productId || !nextStatus) return;

  const previousStatus = selectElement.dataset.currentStatus || "draft";

  if (previousStatus === nextStatus) return;

  selectElement.disabled = true;
  productStatusText.textContent = "更新商品狀態中...";

  const { error } = await window.supabaseClient
    .from("products")
    .update({
      status: nextStatus
    })
    .eq("id", productId);

  selectElement.disabled = false;

  if (error) {
    console.error("更新商品狀態失敗：", error);
    productStatusText.textContent = "更新商品狀態失敗";

    selectElement.value = previousStatus;
    return;
  }

  productStatusText.textContent = `商品狀態已更新為「${getStatusLabel(nextStatus)}」`;

  await loadProducts();
}

async function loadProducts() {
  if (!window.supabaseClient) {
    productStatusText.textContent = "Supabase 尚未設定";

    productsTableBody.innerHTML = `
      <tr>
        <td colspan="10">請先設定 admin/assets/js/services/supabase-config.js。</td>
      </tr>
    `;

    return;
  }

  productStatusText.textContent = "讀取中...";

  const { data, error } = await window.supabaseClient
    .from("products")
    .select("*")
    .order("sku", { ascending: true });

  if (error) {
    console.error("讀取商品失敗：", error);
    productStatusText.textContent = "讀取失敗";

    productsTableBody.innerHTML = `
      <tr>
        <td colspan="10">商品資料讀取失敗，請檢查 Supabase 設定。</td>
      </tr>
    `;

    return;
  }

  const products = data || [];

  renderSummary(products);
  renderProducts(products);

  productStatusText.textContent = `共 ${products.length} 筆商品`;
}

// 事件：重新整理商品
refreshProductsBtn?.addEventListener("click", loadProducts);

// 事件：前台顯示 / 不顯示切換
productsTableBody?.addEventListener("click", (event) => {
  const visibleButton = event.target.closest("[data-action='toggle-visible']");

  if (!visibleButton) return;

  const productId = visibleButton.dataset.id;
  const currentVisible = visibleButton.dataset.visible === "true";

  if (!productId) return;

  toggleProductVisible(productId, currentVisible);
});

// 事件：商品狀態下拉切換
productsTableBody?.addEventListener("change", (event) => {
  const statusSelect = event.target.closest("[data-action='change-status']");

  if (!statusSelect) return;

  const productId = statusSelect.dataset.id;
  const nextStatus = statusSelect.value;

  updateProductStatus(productId, nextStatus, statusSelect);
});

loadProducts();