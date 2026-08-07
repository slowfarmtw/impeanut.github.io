// admin/assets/js/pages/order-create.js
// 新增銷售紀錄：建立 orders + order_items，統一記錄賣貨便、現場、親友與社群私訊訂單。
// 商品明細會從 Supabase products 讀取，避免手動輸入造成品項名稱不一致。

const orderCreateForm = document.getElementById("orderCreateForm");
const orderItemsList = document.getElementById("orderItemsList");
const addItemBtn = document.getElementById("addItemBtn");
const copyCustomerBtn = document.getElementById("copyCustomerBtn");
const orderTotalAmount = document.getElementById("orderTotalAmount");
const submitOrderBtn = document.getElementById("submitOrderBtn");
const submitStatusText = document.getElementById("submitStatusText");

const orderSource = document.getElementById("orderSource");
const orderDate = document.getElementById("orderDate");
const externalOrderField = document.getElementById("externalOrderField");
const externalOrderNumber = document.getElementById("externalOrderNumber");
const paymentMethod = document.getElementById("paymentMethod");
const paymentStatus = document.getElementById("paymentStatus");
const settlementStatus = document.getElementById("settlementStatus");
const settledAmount = document.getElementById("settledAmount");
const customerName = document.getElementById("customerName");
const customerPhone = document.getElementById("customerPhone");
const customerEmail = document.getElementById("customerEmail");
const findCustomerBtn = document.getElementById("findCustomerBtn");
const setGuestCustomerBtn = document.getElementById("setGuestCustomerBtn");
const customerMatchCard = document.getElementById("customerMatchCard");
const fulfillmentMethod = document.getElementById("fulfillmentMethod");
const pickupStoreField = document.getElementById("pickupStoreField");
const pickupStore = document.getElementById("pickupStore");
const shippingAddressField = document.getElementById("shippingAddressField");
const receiverName = document.getElementById("receiverName");
const receiverPhone = document.getElementById("receiverPhone");
const shippingAddress = document.getElementById("shippingAddress");
const customerNote = document.getElementById("customerNote");
const adminNote = document.getElementById("adminNote");

let availableProducts = [];

const SOURCE_DEFAULTS = {
  myship: { fulfillment: "myship", payment: "myship_collection" },
  onsite: { fulfillment: "onsite", payment: "cash" },
  friends_family: { fulfillment: "meetup", payment: "cash" },
  social: { fulfillment: "myship", payment: "myship_collection" },
  other: { fulfillment: "other", payment: "other" }
};

function toLocalDateTimeValue(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function getSourceLabel(value) {
  return orderSource?.querySelector(`option[value="${value}"]`)?.textContent?.trim() || value;
}

function updateSourceFields() {
  const source = orderSource?.value || "myship";
  const defaults = SOURCE_DEFAULTS[source] || SOURCE_DEFAULTS.other;

  if (fulfillmentMethod) fulfillmentMethod.value = defaults.fulfillment;
  if (paymentMethod) paymentMethod.value = defaults.payment;
  if (externalOrderField) externalOrderField.hidden = source !== "myship";

  updateFulfillmentFields();
}

function updateFulfillmentFields() {
  const method = fulfillmentMethod?.value || "other";

  if (pickupStoreField) pickupStoreField.hidden = method !== "myship";
  if (shippingAddressField) shippingAddressField.hidden = method !== "shipping";
}

function updateSettlementFields() {
  const isSettled = settlementStatus?.value === "settled";

  if (settledAmount) {
    settledAmount.disabled = !isSettled;
    if (!isSettled) settledAmount.value = "";
  }
}

function setCustomerMatchMessage(html, tone = "") {
  if (!customerMatchCard) return;

  customerMatchCard.hidden = false;
  customerMatchCard.className = `customer-match-card field-full ${tone}`.trim();
  customerMatchCard.innerHTML = html;
}

async function findExistingCustomer() {
  const targetPhone = normalizePhone(customerPhone?.value);

  if (!targetPhone) {
    setCustomerMatchMessage("請先輸入顧客電話；沒有資料時可直接按「設為散客」。", "is-neutral");
    return;
  }

  if (targetPhone.length < 8) {
    setCustomerMatchMessage("電話位數不足，請確認後再比對。", "is-warning");
    return;
  }

  findCustomerBtn.disabled = true;
  findCustomerBtn.textContent = "比對中…";

  try {
    const { data, error } = await window.supabaseClient
      .from("orders")
      .select("customer_name, customer_phone, customer_email, shipping_name, shipping_phone, total_amount, created_at, order_status")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) throw error;

    const matches = (data || []).filter((order) => {
      return [order.customer_phone, order.shipping_phone].some((phone) => normalizePhone(phone) === targetPhone);
    });

    if (!matches.length) {
      setCustomerMatchMessage("查無既有顧客，儲存後會以這支電話建立新的顧客紀錄。", "is-neutral");
      return;
    }

    const latest = matches[0];
    const revenue = matches
      .filter((order) => order.order_status !== "cancelled")
      .reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
    const matchedName = latest.customer_name || latest.shipping_name || "未命名顧客";

    if (customerName && !customerName.value.trim()) customerName.value = matchedName;
    if (customerEmail && !customerEmail.value.trim() && latest.customer_email) customerEmail.value = latest.customer_email;

    setCustomerMatchMessage(
      `<strong>找到既有顧客：${escapeHtml(matchedName)}</strong><span>${matches.length} 筆訂單・累計 ${formatPrice(revenue)}・已自動帶入可用資料</span>`,
      "is-match"
    );
  } catch (error) {
    console.error("比對顧客失敗：", error);
    setCustomerMatchMessage("目前無法比對顧客，仍可繼續建立銷售紀錄。", "is-warning");
  } finally {
    findCustomerBtn.disabled = false;
    findCustomerBtn.textContent = "比對顧客";
  }
}

function setGuestCustomer() {
  if (customerName) customerName.value = "散客";
  if (customerPhone) customerPhone.value = "";
  if (customerEmail) customerEmail.value = "";
  if (receiverName) receiverName.value = "";
  if (receiverPhone) receiverPhone.value = "";
  setCustomerMatchMessage("這筆會記為散客，不會建立可辨識的個人顧客資料。", "is-neutral");
}

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
  const sourceText = getSourceLabel(orderSource?.value || "other");
  const adminNoteText = adminNote?.value.trim() || "";

  const noteParts = [
    `【訂單來源】${sourceText}`,
    adminNoteText ? `【內部備註】${adminNoteText}` : ""
  ].filter(Boolean);

  return noteParts.join("\n");
}

function buildOrderPayload(total) {
  const customerNameValue = customerName?.value.trim() || "散客";
  const paymentStatusValue = paymentStatus?.value || "unpaid";
  const settlementStatusValue = settlementStatus?.value || "unsettled";
  const isSettled = settlementStatusValue === "settled";

  return {
    order_number: generateOrderNumber(),
    order_source: orderSource?.value || "other",
    order_date: orderDate?.value ? new Date(orderDate.value).toISOString() : new Date().toISOString(),
    external_order_number: externalOrderNumber?.value.trim() || null,
    fulfillment_method: fulfillmentMethod?.value || "other",
    pickup_store: pickupStore?.value.trim() || null,
    customer_name: customerNameValue,
    customer_phone: customerPhone?.value.trim() || "",
    customer_email: customerEmail?.value.trim() || null,
    shipping_name: receiverName?.value.trim() || (customerNameValue === "散客" ? "" : customerNameValue),
    shipping_phone: receiverPhone?.value.trim() || customerPhone?.value.trim() || "",
    shipping_address: shippingAddress?.value.trim() || "",
    shipping_method: fulfillmentMethod?.selectedOptions?.[0]?.textContent?.trim() || "手動建立",
    subtotal: total,
    shipping_fee: 0,
    total_amount: total,
    payment_method: paymentMethod?.value || "bank_transfer",
    payment_status: paymentStatusValue,
    payment_reference: null,
    order_status: "new",
    packing_status: "not_started",
    shipping_status: "not_shipped",
    customer_note: customerNote?.value.trim() || null,
    internal_note: buildInternalNote(),
    accounting_note: null,
    workshop_note: null,
    settlement_status: settlementStatusValue,
    settled_amount: isSettled ? Number(settledAmount?.value || total) : null,
    settled_at: isSettled ? new Date().toISOString() : null,
    paid_at: paymentStatusValue === "paid" ? new Date().toISOString() : null,
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
  submitOrderBtn.textContent = isSubmitting ? "建立中..." : "建立銷售紀錄";
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
  if (submitStatusText) submitStatusText.textContent = "正在建立銷售紀錄...";

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

    window.alert("銷售紀錄建立成功。");
    window.location.href = `order-detail.html?id=${encodeURIComponent(orderData.id)}`;
  } catch (error) {
    console.error("建立銷售紀錄失敗：", error);

    if (submitStatusText) {
      submitStatusText.textContent = "建立失敗，請檢查 Supabase 欄位設定。";
    }

    window.alert(`建立銷售紀錄失敗：${error.message || "未知錯誤"}`);
  } finally {
    setSubmitting(false);
  }
}

addItemBtn?.addEventListener("click", addItemRow);
copyCustomerBtn?.addEventListener("click", copyCustomerToReceiver);
findCustomerBtn?.addEventListener("click", findExistingCustomer);
setGuestCustomerBtn?.addEventListener("click", setGuestCustomer);
orderSource?.addEventListener("change", updateSourceFields);
fulfillmentMethod?.addEventListener("change", updateFulfillmentFields);
settlementStatus?.addEventListener("change", updateSettlementFields);
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

if (orderDate && !orderDate.value) orderDate.value = toLocalDateTimeValue();
updateSourceFields();
updateSettlementFields();
loadProductsForOrderCreate();
calculateTotal();
