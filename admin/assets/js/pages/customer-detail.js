// 顧客詳情頁：顯示正式顧客資料、購買摘要、完整訂單紀錄，並維護內部備註與標籤。

const customerId = new URLSearchParams(window.location.search).get("id");

const customerTitle = document.getElementById("customerTitle");
const customerSubtitle = document.getElementById("customerSubtitle");
const customerStatus = document.getElementById("customerStatus");
const validPurchaseCount = document.getElementById("validPurchaseCount");
const totalOrderCount = document.getElementById("totalOrderCount");
const lifetimeValue = document.getElementById("lifetimeValue");
const averageOrderValue = document.getElementById("averageOrderValue");
const daysSincePurchase = document.getElementById("daysSincePurchase");
const lastPurchaseAt = document.getElementById("lastPurchaseAt");
const customerName = document.getElementById("customerName");
const customerPhone = document.getElementById("customerPhone");
const customerEmail = document.getElementById("customerEmail");
const firstPurchaseAt = document.getElementById("firstPurchaseAt");
const primarySource = document.getElementById("primarySource");
const knownContacts = document.getElementById("knownContacts");
const customerTagsInput = document.getElementById("customerTagsInput");
const customerInternalNote = document.getElementById("customerInternalNote");
const customerNoteForm = document.getElementById("customerNoteForm");
const saveCustomerNoteBtn = document.getElementById("saveCustomerNoteBtn");
const customerSaveStatus = document.getElementById("customerSaveStatus");
const customerOrdersStatus = document.getElementById("customerOrdersStatus");
const customerOrdersTableBody = document.getElementById("customerOrdersTableBody");
const customerOrdersMobile = document.getElementById("customerOrdersMobile");

let currentCustomer = null;
let currentOrders = [];
let currentIdentities = [];

const ORDER_SOURCE_LABELS = {
  website: "官網",
  myship: "賣貨便",
  onsite: "現場購買",
  friends_family: "親友訂購",
  social: "LINE／IG",
  other: "其他",
  manual_legacy: "舊手動訂單"
};

const PAYMENT_STATUS_LABELS = {
  unpaid: "未付款",
  checking: "確認中",
  paid: "已付款",
  refunded: "已退款",
  failed: "付款失敗"
};

const ORDER_STATUS_LABELS = {
  new: "新訂單",
  confirmed: "已確認",
  preparing: "備貨中",
  completed: "已完成",
  cancelled: "已取消",
  problem: "問題訂單"
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

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function isValidUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || "");
}

function isValidPurchase(order) {
  return (
    order.payment_status === "paid" &&
    order.order_status !== "cancelled" &&
    order.payment_status !== "refunded"
  );
}

function getOrderDate(order) {
  return order.order_date || order.created_at || null;
}

function compareOrdersNewestFirst(a, b) {
  return new Date(getOrderDate(b)).getTime() - new Date(getOrderDate(a)).getTime();
}

function getCustomerState(customer, orders, validOrders) {
  if (customer.needs_review || orders.some((order) => order.order_status === "problem")) {
    return { label: "需關注", className: "problem" };
  }

  const revenue = validOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  if (revenue >= 3000 || validOrders.length >= 3) {
    return { label: "高價值", className: "vip" };
  }
  if (validOrders.length > 1) return { label: "回購", className: "repeat" };
  return { label: "一般", className: "" };
}

function getPrimarySource(orders) {
  if (!orders.length) return "-";

  const sourceCounts = orders.reduce((counts, order) => {
    const source = order.order_source || "website";
    counts[source] = (counts[source] || 0) + 1;
    return counts;
  }, {});

  const [source] = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])[0];
  return ORDER_SOURCE_LABELS[source] || source;
}

function getDaysSince(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const diff = Date.now() - date.getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function renderKnownContacts(customer, identities) {
  const primaryPhone = normalizePhone(customer.primary_phone);
  const primaryEmail = normalizeEmail(customer.primary_email);

  const contacts = identities
    .filter((identity) => {
      if (identity.identity_type === "phone") return identity.identity_value !== primaryPhone;
      if (identity.identity_type === "email") return identity.identity_value !== primaryEmail;
      return false;
    })
    .map((identity) => identity.identity_value);

  knownContacts.textContent = contacts.length ? contacts.join("、") : "無";
}

function getItemsSummary(order) {
  const items = order.order_items || [];
  if (!items.length) return "未記錄商品";

  const labels = items.map((item) => `${item.product_name || "商品"} × ${item.quantity || 0}`);
  if (labels.length <= 2) return labels.join("、");
  return `${labels.slice(0, 2).join("、")}，另 ${labels.length - 2} 項`;
}

function renderCustomerSummary() {
  const validOrders = currentOrders.filter(isValidPurchase).sort(compareOrdersNewestFirst);
  const oldestValidOrder = [...validOrders].sort(
    (a, b) => new Date(getOrderDate(a)).getTime() - new Date(getOrderDate(b)).getTime()
  )[0];
  const latestValidOrder = validOrders[0];
  const revenue = validOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  const average = validOrders.length ? Math.round(revenue / validOrders.length) : 0;
  const state = getCustomerState(currentCustomer, currentOrders, validOrders);
  const days = getDaysSince(getOrderDate(latestValidOrder || {}));

  document.title = `${currentCustomer.name || "顧客詳情"}｜花生一生後台`;
  customerTitle.textContent = currentCustomer.name || "未命名顧客";
  customerSubtitle.textContent = [currentCustomer.primary_phone, currentCustomer.primary_email]
    .filter(Boolean)
    .join("　") || "尚未提供完整聯絡方式";
  customerStatus.textContent = state.label;
  customerStatus.className = `customer-detail-status ${state.className}`.trim();

  validPurchaseCount.textContent = validOrders.length;
  totalOrderCount.textContent = `全部訂單 ${currentOrders.length} 筆`;
  lifetimeValue.textContent = formatPrice(revenue);
  averageOrderValue.textContent = formatPrice(average);
  daysSincePurchase.textContent = days === null ? "-" : `${days} 天`;
  lastPurchaseAt.textContent = latestValidOrder
    ? formatDateTime(getOrderDate(latestValidOrder))
    : "尚無有效購買";

  customerName.textContent = currentCustomer.name || "-";
  customerPhone.textContent = currentCustomer.primary_phone || "-";
  customerEmail.textContent = currentCustomer.primary_email || "-";
  firstPurchaseAt.textContent = oldestValidOrder
    ? formatDateTime(getOrderDate(oldestValidOrder))
    : "-";
  primarySource.textContent = getPrimarySource(validOrders.length ? validOrders : currentOrders);
  renderKnownContacts(currentCustomer, currentIdentities);

  customerTagsInput.value = (currentCustomer.tags || []).join("、");
  customerInternalNote.value = currentCustomer.internal_note || "";
}

function renderOrders() {
  customerOrdersStatus.textContent = `共 ${currentOrders.length} 筆訂單，其中 ${currentOrders.filter(isValidPurchase).length} 筆為有效購買`;

  if (!currentOrders.length) {
    customerOrdersTableBody.innerHTML = "<tr><td colspan=\"8\">目前沒有訂單紀錄。</td></tr>";
    customerOrdersMobile.innerHTML = '<p class="customer-detail-empty">目前沒有訂單紀錄。</p>';
    return;
  }

  customerOrdersTableBody.innerHTML = currentOrders.map((order) => `
    <tr>
      <td>${formatDateTime(getOrderDate(order))}</td>
      <td><strong>${escapeHtml(order.order_number || "-")}</strong></td>
      <td>${escapeHtml(ORDER_SOURCE_LABELS[order.order_source] || order.order_source || "-")}</td>
      <td class="customer-order-items">${escapeHtml(getItemsSummary(order))}</td>
      <td>${formatPrice(order.total_amount)}</td>
      <td><span class="order-state ${escapeHtml(order.payment_status || "")}">${escapeHtml(PAYMENT_STATUS_LABELS[order.payment_status] || order.payment_status || "-")}</span></td>
      <td><span class="order-state ${escapeHtml(order.order_status || "")}">${escapeHtml(ORDER_STATUS_LABELS[order.order_status] || order.order_status || "-")}</span></td>
      <td><a class="customer-order-link" href="order-detail.html?id=${encodeURIComponent(order.id)}">查看訂單</a></td>
    </tr>
  `).join("");

  customerOrdersMobile.innerHTML = currentOrders.map((order) => `
    <article class="customer-order-card">
      <div class="customer-order-card__head">
        <div>
          <span>${formatDateTime(getOrderDate(order))}</span>
          <strong>${escapeHtml(order.order_number || "-")}</strong>
        </div>
        <b>${formatPrice(order.total_amount)}</b>
      </div>
      <p>${escapeHtml(getItemsSummary(order))}</p>
      <div class="customer-order-card__status">
        <span>${escapeHtml(PAYMENT_STATUS_LABELS[order.payment_status] || order.payment_status || "-")}</span>
        <span>${escapeHtml(ORDER_STATUS_LABELS[order.order_status] || order.order_status || "-")}</span>
      </div>
      <a class="customer-order-link" href="order-detail.html?id=${encodeURIComponent(order.id)}">查看訂單</a>
    </article>
  `).join("");
}

function parseTags(value) {
  return [...new Set(
    String(value || "")
      .split(/[，,、]/)
      .map((tag) => tag.trim())
      .filter(Boolean)
      .map((tag) => tag.slice(0, 40))
  )].slice(0, 20);
}

async function saveCustomerRecord(event) {
  event.preventDefault();
  if (!currentCustomer || !window.supabaseClient) return;

  const tags = parseTags(customerTagsInput.value);
  const internalNote = customerInternalNote.value.trim();

  saveCustomerNoteBtn.disabled = true;
  customerSaveStatus.textContent = "儲存中...";

  const { data, error } = await window.supabaseClient
    .from("customers")
    .update({ tags, internal_note: internalNote || null })
    .eq("id", currentCustomer.id)
    .select("*")
    .single();

  if (error) {
    console.error("儲存顧客紀錄失敗：", error);
    customerSaveStatus.textContent = "儲存失敗，請稍後再試";
    saveCustomerNoteBtn.disabled = false;
    return;
  }

  currentCustomer = data;
  customerTagsInput.value = tags.join("、");
  customerSaveStatus.textContent = "已儲存";
  saveCustomerNoteBtn.disabled = false;
}

function showFatalError(message) {
  customerTitle.textContent = "無法顯示顧客資料";
  customerSubtitle.textContent = message;
  customerStatus.textContent = "讀取失敗";
  customerStatus.className = "customer-detail-status problem";
  customerOrdersStatus.textContent = message;
  customerOrdersTableBody.innerHTML = `<tr><td colspan="8">${escapeHtml(message)}</td></tr>`;
  customerOrdersMobile.innerHTML = `<p class="customer-detail-empty">${escapeHtml(message)}</p>`;
  customerNoteForm.querySelectorAll("input, textarea, button").forEach((element) => {
    element.disabled = true;
  });
}

async function loadCustomerDetail() {
  if (!isValidUuid(customerId)) {
    showFatalError("顧客連結格式不正確，請返回顧客管理重新開啟。");
    return;
  }
  if (!window.supabaseClient) {
    showFatalError("Supabase 尚未設定。");
    return;
  }

  const [customerResult, ordersResult, identitiesResult] = await Promise.all([
    window.supabaseClient.from("customers").select("*").eq("id", customerId).maybeSingle(),
    window.supabaseClient
      .from("orders")
      .select("*")
      .eq("customer_id", customerId)
      .order("order_date", { ascending: false }),
    window.supabaseClient
      .from("customer_identities")
      .select("identity_type, identity_value")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: true })
  ]);

  const loadError = customerResult.error || ordersResult.error || identitiesResult.error;
  if (loadError) {
    console.error("讀取顧客詳情失敗：", loadError);
    showFatalError("顧客資料讀取失敗，請稍後再試。");
    return;
  }
  if (!customerResult.data) {
    showFatalError("找不到這位顧客，資料可能已被移除。");
    return;
  }

  currentCustomer = customerResult.data;
  currentOrders = (ordersResult.data || []).sort(compareOrdersNewestFirst);
  currentIdentities = identitiesResult.data || [];

  if (currentOrders.length) {
    const { data: items, error: itemsError } = await window.supabaseClient
      .from("order_items")
      .select("order_id, product_name, quantity")
      .in("order_id", currentOrders.map((order) => order.id))
      .order("created_at", { ascending: true });

    if (itemsError) {
      console.error("讀取顧客購買商品失敗：", itemsError);
    } else {
      const itemsByOrder = new Map();
      (items || []).forEach((item) => {
        if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
        itemsByOrder.get(item.order_id).push(item);
      });
      currentOrders.forEach((order) => {
        order.order_items = itemsByOrder.get(order.id) || [];
      });
    }
  }

  renderCustomerSummary();
  renderOrders();
}

customerNoteForm?.addEventListener("submit", saveCustomerRecord);
loadCustomerDetail();
