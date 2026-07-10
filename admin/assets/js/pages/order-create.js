// admin/assets/js/pages/order-create.js
// 手動新增訂單：建立 orders + order_items，給 LINE、IG、電話、企業採購、親友代售等官網外訂單使用。
// 商品明細會從 Supabase products 讀取，避免手動輸入造成品項名稱不一致。

const orderCreateForm = document.getElementById("orderCreateForm");
const orderItemsList = document.getElementById("orderItemsList");
const addItemBtn = document.getElementById("addItemBtn");
const copyCustomerBtn = document.getElementById("copyCustomerBtn");
const orderTotalAmount = document.getElementById("orderTotalAmount");
const submitOrderBtn = document.getElementById("submitOrderBtn");
const submitStatusText = document.getElementById("submitStatusText");

const orderSource = document.getElementById("orderSource");
const paymentMethod = document.getElementById("paymentMethod");
const customerName = document.getElementById("customerName");
const customerPhone = document.getElementById("customerPhone");
const customerEmail = document.getElementById("customerEmail");
const receiverName = document.getElementById("receiverName");
const receiverPhone = document.getElementById("receiverPhone");
const shippingAddress = document.getElementById("shippingAddress");
const customerNote = document.getElementById("customerNote");
const adminNote = document.getElementById("adminNote");

let availableProducts = [];

function formatPrice(price) {
  return `NT$ ${Number(price || 0).toLocaleString()}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function generateOrderNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  const second = String(now.getSeconds()).padStart(2, "0");
  const random = Math.floor(Math.random() * 900 + 100);

  return `ORD-${year}${month}${day}-${hour}${minute}${second}${random}`;
}

function getItemRows() {
  if (!orderItemsList) return [];
  return Array.from(orderItemsList.querySelectorAll("[data-item-row]"));
}

function getProductById(productId) {
  return availableProducts.find((product) => product.id === productId) || null;
}

function getProductOptionsHtml() {
  if (!availableProducts.length) {
    return `<option value="">目前沒有可選商品</option>`;
  }

  return [
    `<option value="">請選擇商品</option>`,
    ...availableProducts.map((product) => {
      const labelParts = [
        product.name,
        product.weight,
        product.sku ? `SKU：${product.sku}` : "",
        formatPrice(product.price)
      ].filter(Boolean);

      return `<option value="${escapeHtml(product.id)}">${escapeHtml(labelParts.join("｜"))}</option>`;
    })
  ].join("");
}

function refreshProductSelectOptions() {
  getItemRows().forEach((row) => {
    const select = row.querySelector(".item-product-select");
    if (!select) return;

    const selectedValue = select.value;
    select.innerHTML = getProductOptionsHtml();
    select.value = selectedValue;

    if (selectedValue) {
      fillProductRow(row, selectedValue);
    }
  });
}

function fillProductRow(row, productId) {
  const product = getProductById(productId);
  const skuInput = row.querySelector(".item-sku");
  const weightInput = row.querySelector(".item-weight");
  const priceInput = row.querySelector(".item-price");

  if (!product) {
    if (skuInput) skuInput.value = "";
    if (weightInput) weightInput.value = "";
    if (priceInput) priceInput.value = "";
    calculateTotal();
    return;
  }

  if (skuInput) skuInput.value = product.sku || "";
  if (weightInput) weightInput.value = product.weight || "";
  if (priceInput) priceInput.value = Number(product.price || 0);

  calculateTotal();
}

function getOrderItems() {
  return getItemRows()
    .map((row) => {
      const productId = row.querySelector(".item-product-select")?.value || "";
      const product = getProductById(productId);
      const price = Number(row.querySelector(".item-price")?.value || product?.price || 0);
      const quantity = Number(row.querySelector(".item-quantity")?.value || 0);
      const subtotal = price * quantity;

      return {
        product_id: product?.id || null,
        product_name: product?.name || "",
        sku: product?.sku || "",
        weight: product?.weight || "",
        price,
        quantity,
        subtotal
      };
    })
    .filter((item) => item.product_id && item.product_name && item.price >= 0 && item.quantity > 0);
}

function calculateTotal() {
  let total = 0;

  getItemRows().forEach((row) => {
    const price = Number(row.querySelector(".item-price")?.value || 0);
    const quantity = Number(row.querySelector(".item-quantity")?.value || 0);
    const subtotal = price * quantity;
    const subtotalEl = row.querySelector("[data-item-subtotal]");

    total += subtotal;
    if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
  });

  if (orderTotalAmount) {
    orderTotalAmount.textContent = formatPrice(total);
  }

  return total;
}

function createItemRow() {
  const row = document.createElement("div");
  row.className = "order-item-row";
  row.dataset.itemRow = "";

  row.innerHTML = `
    <label class="field-group item-product-field">
      <span>選擇商品</span>
      <select class="item-product-select" required>
        ${getProductOptionsHtml()}
      </select>
    </label>

    <label class="field-group item-sku-field">
      <span>SKU</span>
      <input type="text" class="item-sku" readonly />
    </label>

    <label class="field-group item-weight-field">
      <span>重量</span>
      <input type="text" class="item-weight" readonly />
    </label>

    <label class="field-group item-price-field">
      <span>單價</span>
      <input type="number" class="item-price" min="0" step="1" readonly required />
    </label>

    <label class="field-group item-qty-field">
      <span>數量</span>
      <input type="number" class="item-quantity" min="1" step="1" value="1" required />
    </label>

    <div class="item-subtotal">
      <span>小計</span>
      <strong data-item-subtotal>NT$ 0</strong>
    </div>

    <button type="button" class="remove-item-btn" data-remove-item>移除</button>
  `;

  return row;
}

function addItemRow() {
  if (!orderItemsList) return;

  orderItemsList.appendChild(createItemRow());
  calculateTotal();
}

function removeItemRow(button) {
  const rows = getItemRows();
  const row = button.closest("[data-item-row]");

  if (!row) return;

  if (rows.length <= 1) {
    window.alert("至少需要保留一項商品。");
    return;
  }

  row.remove();
  calculateTotal();
}

function copyCustomerToReceiver() {
  if (receiverName && customerName) {
    receiverName.value = customerName.value.trim();
  }

  if (receiverPhone && customerPhone) {
    receiverPhone.value = customerPhone.value.trim();
  }
}

function buildInternalNote() {
  const sourceText = orderSource?.value || "官網外手動訂單";
  const adminNoteText = adminNote?.value.trim() || "";

  const noteParts = [
    `【訂單來源】${sourceText}`,
    adminNoteText ? `【內部備註】${adminNoteText}` : ""
  ].filter(Boolean);

  return noteParts.join("\n");
}

function buildOrderPayload(total) {
  return {
    order_number: generateOrderNumber(),
    customer_name: customerName?.value.trim() || "",
    customer_phone: customerPhone?.value.trim() || "",
    customer_email: customerEmail?.value.trim() || null,
    shipping_name: receiverName?.value.trim() || customerName?.value.trim() || "",
    shipping_phone: receiverPhone?.value.trim() || customerPhone?.value.trim() || "",
    shipping_address: shippingAddress?.value.trim() || "",
    shipping_method: "手動建立",
    subtotal: total,
    shipping_fee: 0,
    total_amount: total,
    payment_method: paymentMethod?.value || "bank_transfer",
    payment_status: "unpaid",
    payment_reference: null,
    order_status: "new",
    packing_status: "not_started",
    shipping_status: "not_shipped",
    customer_note: customerNote?.value.trim() || null,
    internal_note: buildInternalNote(),
    accounting_note: null,
    workshop_note: null,
    is_archived: false
  };
}

function buildOrderItemPayloads(orderId, items) {
  return items.map((item) => ({
    order_id: orderId,
    product_id: item.product_id,
    product_name: item.product_name,
    sku: item.sku,
    weight: item.weight,
    price: item.price,
    quantity: item.quantity,
    subtotal: item.subtotal
  }));
}

function setSubmitting(isSubmitting) {
  if (!submitOrderBtn) return;

  submitOrderBtn.disabled = isSubmitting;
  submitOrderBtn.textContent = isSubmitting ? "建立中..." : "建立手動訂單";
}

function validateOrder(items, total) {
  if (!window.supabaseClient) {
    window.alert("Supabase 尚未設定，無法建立訂單。");
    return false;
  }

  if (!availableProducts.length) {
    window.alert("目前沒有可選商品，請先確認 products 資料表是否有商品資料。");
    return false;
  }

  if (!items.length) {
    window.alert("請至少選擇一項商品，並確認數量正確。");
    return false;
  }

  if (total <= 0) {
    window.alert("訂單總金額需要大於 0。");
    return false;
  }

  return true;
}

async function loadProductsForOrderCreate() {
  if (!window.supabaseClient) {
    if (submitStatusText) submitStatusText.textContent = "Supabase 尚未設定，無法讀取商品。";
    refreshProductSelectOptions();
    return;
  }

  if (submitStatusText) submitStatusText.textContent = "正在讀取商品資料...";

  const { data, error } = await window.supabaseClient
    .from("products")
    .select("id, sku, name, weight, price, stock, status, is_visible, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("讀取商品資料失敗：", error);
    if (submitStatusText) submitStatusText.textContent = "商品資料讀取失敗，請檢查 products 資料表。";
    refreshProductSelectOptions();
    return;
  }

  availableProducts = (data || []).filter((product) => {
    const isVisible = product.is_visible !== false;
    const isNotArchived = product.status !== "archived" && product.status !== "deleted";
    return isVisible && isNotArchived;
  });

  refreshProductSelectOptions();
  calculateTotal();

  if (submitStatusText) {
    submitStatusText.textContent = availableProducts.length
      ? `已載入 ${availableProducts.length} 項商品，建立後付款狀態預設為未付款。`
      : "目前沒有可選商品，請先到商品管理新增商品。";
  }
}

async function createManualOrder(event) {
  event.preventDefault();

  const total = calculateTotal();
  const items = getOrderItems();

  if (!validateOrder(items, total)) return;

  setSubmitting(true);
  if (submitStatusText) submitStatusText.textContent = "正在建立手動訂單...";

  try {
    const orderPayload = buildOrderPayload(total);

    const { data: orderData, error: orderError } = await window.supabaseClient
      .from("orders")
      .insert(orderPayload)
      .select("*")
      .single();

    if (orderError) throw orderError;

    const orderItemsPayload = buildOrderItemPayloads(orderData.id, items);

    const { error: itemsError } = await window.supabaseClient
      .from("order_items")
      .insert(orderItemsPayload);

    if (itemsError) throw itemsError;

    if (submitStatusText) {
      submitStatusText.textContent = `訂單建立成功：${orderData.order_number || ""}`;
    }

    window.alert("手動訂單建立成功。");
    window.location.href = `order-detail.html?id=${encodeURIComponent(orderData.id)}`;
  } catch (error) {
    console.error("建立手動訂單失敗：", error);

    if (submitStatusText) {
      submitStatusText.textContent = "建立失敗，請檢查 Supabase 欄位設定。";
    }

    window.alert(`建立手動訂單失敗：${error.message || "未知錯誤"}`);
  } finally {
    setSubmitting(false);
  }
}

addItemBtn?.addEventListener("click", addItemRow);
copyCustomerBtn?.addEventListener("click", copyCustomerToReceiver);
orderCreateForm?.addEventListener("submit", createManualOrder);

orderItemsList?.addEventListener("input", (event) => {
  if (event.target.classList.contains("item-quantity")) {
    calculateTotal();
  }
});

orderItemsList?.addEventListener("change", (event) => {
  if (!event.target.classList.contains("item-product-select")) return;

  const row = event.target.closest("[data-item-row]");
  if (!row) return;

  fillProductRow(row, event.target.value);
});

orderItemsList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-item]");
  if (!button) return;

  removeItemRow(button);
});

loadProductsForOrderCreate();
calculateTotal();