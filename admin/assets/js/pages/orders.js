// admin/assets/js/pages/orders.js
// 訂單管理頁：讀取 Supabase orders 表，顯示訂單、搜尋、篩選、手機卡片、流程狀態、封存狀態，並寫入 order_logs 操作紀錄。

const ordersTableBody = document.getElementById("ordersTableBody");
const ordersMobileList = document.getElementById("ordersMobileList");

const orderStatusText = document.getElementById("orderStatusText");
const totalOrdersEl = document.getElementById("totalOrders");
const paidOrdersEl = document.getElementById("paidOrders");
const pendingShippingOrdersEl = document.getElementById("pendingShippingOrders");
const problemOrdersEl = document.getElementById("problemOrders");
const refreshOrdersBtn = document.getElementById("refreshOrdersBtn");
const exportFilteredOrdersBtn = document.getElementById("exportFilteredOrdersBtn");
const exportTodayOrdersBtn = document.getElementById("exportTodayOrdersBtn");

const ordersPanelTitle = document.getElementById("ordersPanelTitle");
const activeOrdersViewBtn = document.getElementById("activeOrdersViewBtn");
const archivedOrdersViewBtn = document.getElementById("archivedOrdersViewBtn");

const orderSearchInput = document.getElementById("orderSearchInput");
const orderStatusFilter = document.getElementById("orderStatusFilter");
const orderDateFilter = document.getElementById("orderDateFilter");
const resetOrderFiltersBtn = document.getElementById("resetOrderFiltersBtn");

let currentOrdersView = "active";
let allOrders = [];

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

const PACKING_STATUS_LABELS = {
  not_started: "未開始",
  packing: "包裝中",
  packed: "已包裝"
};

const SHIPPING_STATUS_LABELS = {
  not_shipped: "未出貨",
  ready: "待出貨",
  shipped: "已出貨",
  delivered: "已送達"
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

function getLabel(map, value) {
  return map[value] || value || "-";
}

function getOrderSearchText(order) {
  return [
    order.order_number,
    order.customer_name,
    order.customer_phone,
    order.customer_email,
    order.shipping_name,
    order.shipping_phone,
    order.shipping_address,
    order.shipping_method,
    order.customer_note,
    order.internal_note,
    order.accounting_note,
    order.workshop_note
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isToday(date) {
  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function isThisMonth(date) {
  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

function isWithinLastDays(date, days) {
  const now = new Date();
  const start = new Date(now);

  start.setDate(now.getDate() - days);
  start.setHours(0, 0, 0, 0);

  return date >= start && date <= now;
}

function matchDateFilter(order, filterValue) {
  if (!filterValue || filterValue === "all") return true;

  const date = new Date(order.created_at);

  if (Number.isNaN(date.getTime())) return false;

  if (filterValue === "today") return isToday(date);
  if (filterValue === "7days") return isWithinLastDays(date, 7);
  if (filterValue === "month") return isThisMonth(date);

  return true;
}

function matchStatusFilter(order, filterValue) {
  if (!filterValue || filterValue === "all") return true;

  const paymentStatus = order.payment_status || "unpaid";
  const orderStatus = order.order_status || "new";
  const packingStatus = order.packing_status || "not_started";
  const shippingStatus = order.shipping_status || "not_shipped";

  const statusMap = {
    unpaid: paymentStatus !== "paid",
    paid: paymentStatus === "paid",
    packing_pending: packingStatus !== "packed",
    packed: packingStatus === "packed",
    shipping_pending: shippingStatus !== "shipped" && shippingStatus !== "delivered",
    shipped: shippingStatus === "shipped" || shippingStatus === "delivered",
    completed: orderStatus === "completed" || shippingStatus === "delivered",
    cancelled: orderStatus === "cancelled",
    problem: orderStatus === "problem"
  };

  return Boolean(statusMap[filterValue]);
}

function getFilteredOrders() {
  const keyword = (orderSearchInput?.value || "").trim().toLowerCase();
  const statusValue = orderStatusFilter?.value || "all";
  const dateValue = orderDateFilter?.value || "all";

  return allOrders.filter((order) => {
    const matchKeyword = keyword ? getOrderSearchText(order).includes(keyword) : true;
    const matchStatus = matchStatusFilter(order, statusValue);
    const matchDate = matchDateFilter(order, dateValue);

    return matchKeyword && matchStatus && matchDate;
  });
}

async function createOrderLog({ orderId, action, oldValue, newValue, note }) {
  if (!window.supabaseClient || !orderId || !action) return;

  const { error } = await window.supabaseClient
    .from("order_logs")
    .insert({
      order_id: orderId,
      action,
      old_value: oldValue ?? null,
      new_value: newValue ?? null,
      note: note || null
    });

  if (error) {
    console.warn("寫入訂單操作紀錄失敗：", error);
  }
}

function renderSummary(orders) {
  const total = orders.length;

  const paid = orders.filter((order) => {
    return order.payment_status === "paid";
  }).length;

  const pendingShipping = orders.filter((order) => {
    const shippingStatus = order.shipping_status || "not_shipped";

    return shippingStatus !== "shipped" && shippingStatus !== "delivered";
  }).length;

  const problem = orders.filter((order) => {
    return order.order_status === "problem";
  }).length;

  totalOrdersEl.textContent = total;
  paidOrdersEl.textContent = paid;
  pendingShippingOrdersEl.textContent = pendingShipping;
  problemOrdersEl.textContent = problem;
}

function updateViewUI() {
  const isArchivedView = currentOrdersView === "archived";

  ordersPanelTitle.textContent = isArchivedView ? "封存訂單" : "進行中訂單";

  activeOrdersViewBtn?.classList.toggle("active", !isArchivedView);
  archivedOrdersViewBtn?.classList.toggle("active", isArchivedView);
}

function renderSelect({
  classBase,
  classPrefix,
  action,
  id,
  currentValue,
  options,
  ariaLabel
}) {
  const optionsHtml = Object.entries(options).map(([value, label]) => {
    return `
      <option value="${escapeHtml(value)}" ${currentValue === value ? "selected" : ""}>
        ${escapeHtml(label)}
      </option>
    `;
  }).join("");

  return `
    <select
      class="${classBase} ${classPrefix}-${escapeHtml(currentValue)}"
      data-action="${escapeHtml(action)}"
      data-id="${escapeHtml(id)}"
      data-current-status="${escapeHtml(currentValue)}"
      aria-label="${escapeHtml(ariaLabel)}"
    >
      ${optionsHtml}
    </select>
  `;
}

function renderPaymentSelect(order) {
  return renderSelect({
    classBase: "order-status-select",
    classPrefix: "payment-select",
    action: "change-payment-status",
    id: order.id,
    currentValue: order.payment_status || "unpaid",
    options: PAYMENT_STATUS_LABELS,
    ariaLabel: "付款狀態"
  });
}

function renderOrderStatusSelect(order) {
  return renderSelect({
    classBase: "order-status-select",
    classPrefix: "order-select",
    action: "change-order-status",
    id: order.id,
    currentValue: order.order_status || "new",
    options: ORDER_STATUS_LABELS,
    ariaLabel: "訂單狀態"
  });
}

function renderPackingStatusSelect(order) {
  return renderSelect({
    classBase: "order-status-select",
    classPrefix: "packing-select",
    action: "change-packing-status",
    id: order.id,
    currentValue: order.packing_status || "not_started",
    options: PACKING_STATUS_LABELS,
    ariaLabel: "包裝狀態"
  });
}

function renderShippingStatusSelect(order) {
  return renderSelect({
    classBase: "order-status-select",
    classPrefix: "shipping-select",
    action: "change-shipping-status",
    id: order.id,
    currentValue: order.shipping_status || "not_shipped",
    options: SHIPPING_STATUS_LABELS,
    ariaLabel: "出貨狀態"
  });
}

function renderArchiveAction(order) {
  const isArchivedView = currentOrdersView === "archived";

  if (isArchivedView) {
    return `
      <button
        type="button"
        class="order-restore-btn"
        data-action="restore-order"
        data-id="${escapeHtml(order.id)}"
      >
        拉回
      </button>
    `;
  }

  return `
    <button
      type="button"
      class="order-archive-btn"
      data-action="archive-order"
      data-id="${escapeHtml(order.id)}"
    >
      封存
    </button>
  `;
}

function getEmptyText() {
  const isArchivedView = currentOrdersView === "archived";

  const hasFilter =
    (orderSearchInput?.value || "").trim() ||
    (orderStatusFilter?.value && orderStatusFilter.value !== "all") ||
    (orderDateFilter?.value && orderDateFilter.value !== "all");

  if (hasFilter) return "目前沒有符合篩選條件的訂單。";

  return isArchivedView ? "目前沒有封存訂單。" : "目前沒有進行中訂單。";
}

function renderOrdersTable(orders) {
  if (!ordersTableBody) return;

  if (!orders.length) {
    ordersTableBody.innerHTML = `
      <tr>
        <td colspan="10">${getEmptyText()}</td>
      </tr>
    `;
    return;
  }

  ordersTableBody.innerHTML = orders.map((order) => {
    return `
      <tr>
        <td>
          <strong>${escapeHtml(order.order_number || "-")}</strong>
        </td>

        <td>${escapeHtml(order.customer_name || "-")}</td>
        <td>${escapeHtml(order.customer_phone || "-")}</td>
        <td>${formatPrice(order.total_amount)}</td>

        <td>${renderPaymentSelect(order)}</td>
        <td>${renderOrderStatusSelect(order)}</td>
        <td>${renderPackingStatusSelect(order)}</td>
        <td>${renderShippingStatusSelect(order)}</td>

        <td>${formatDateTime(order.created_at)}</td>

        <td>
          <div class="order-actions">
            <button
              type="button"
              class="order-view-btn"
              data-action="view-order"
              data-id="${escapeHtml(order.id)}"
            >
              查看
            </button>

            ${renderArchiveAction(order)}
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function renderOrdersMobile(orders) {
  if (!ordersMobileList) return;

  if (!orders.length) {
    ordersMobileList.innerHTML = `
      <p class="orders-empty-text">${getEmptyText()}</p>
    `;
    return;
  }

  ordersMobileList.innerHTML = orders.map((order) => {
    return `
      <article class="order-mobile-card">
        <div class="order-mobile-head">
          <div>
            <strong class="order-mobile-id">
              ${escapeHtml(order.order_number || "-")}
            </strong>
            <p class="order-mobile-date">
              ${formatDateTime(order.created_at)}
            </p>
          </div>

          <div class="order-mobile-total">
            ${formatPrice(order.total_amount)}
          </div>
        </div>

        <div class="order-mobile-customer">
          ${escapeHtml(order.customer_name || "-")}
          <span>${escapeHtml(order.customer_phone || "-")}</span>
        </div>

        <div class="order-mobile-status-grid">
          <div class="order-mobile-status-item">
            <span>付款</span>
            ${renderPaymentSelect(order)}
          </div>

          <div class="order-mobile-status-item">
            <span>訂單</span>
            ${renderOrderStatusSelect(order)}
          </div>

          <div class="order-mobile-status-item">
            <span>包裝</span>
            ${renderPackingStatusSelect(order)}
          </div>

          <div class="order-mobile-status-item">
            <span>出貨</span>
            ${renderShippingStatusSelect(order)}
          </div>
        </div>

        <div class="order-mobile-actions">
          <button
            type="button"
            class="order-view-btn"
            data-action="view-order"
            data-id="${escapeHtml(order.id)}"
          >
            查看詳情
          </button>

          ${renderArchiveAction(order)}
        </div>
      </article>
    `;
  }).join("");
}

function renderOrders(orders) {
  renderOrdersTable(orders);
  renderOrdersMobile(orders);
}

function renderFilteredOrders() {
  const filteredOrders = getFilteredOrders();
  const isArchivedView = currentOrdersView === "archived";

  renderSummary(filteredOrders);
  renderOrders(filteredOrders);

  if (allOrders.length === filteredOrders.length) {
    orderStatusText.textContent = isArchivedView
      ? `共 ${filteredOrders.length} 筆封存訂單`
      : `共 ${filteredOrders.length} 筆進行中訂單`;

    return;
  }

  orderStatusText.textContent = isArchivedView
    ? `共 ${allOrders.length} 筆封存訂單，篩選後 ${filteredOrders.length} 筆`
    : `共 ${allOrders.length} 筆進行中訂單，篩選後 ${filteredOrders.length} 筆`;
}

function buildTimestampPayload(fieldName, nextStatus) {
  const payload = {};

  if (fieldName === "order_status") {
    if (nextStatus === "confirmed") payload.confirmed_at = new Date().toISOString();
    if (nextStatus === "preparing") payload.prepared_at = new Date().toISOString();
    if (nextStatus === "completed") payload.completed_at = new Date().toISOString();
    if (nextStatus === "cancelled") payload.cancelled_at = new Date().toISOString();
  }

  if (fieldName === "packing_status") {
    if (nextStatus === "packed") payload.packed_at = new Date().toISOString();
  }

  if (fieldName === "shipping_status") {
    if (nextStatus === "ready") payload.prepared_at = new Date().toISOString();
    if (nextStatus === "shipped") payload.shipped_at = new Date().toISOString();
    if (nextStatus === "delivered") payload.completed_at = new Date().toISOString();
  }

  return payload;
}

function getActionName(fieldName) {
  const actionMap = {
    payment_status: "update_payment_status",
    order_status: "update_order_status",
    packing_status: "update_packing_status",
    shipping_status: "update_shipping_status"
  };

  return actionMap[fieldName] || "update_order";
}

function getFieldLabel(fieldName) {
  const labelMap = {
    payment_status: "付款狀態",
    order_status: "訂單狀態",
    packing_status: "包裝狀態",
    shipping_status: "出貨狀態"
  };

  return labelMap[fieldName] || "訂單欄位";
}

async function updateOrderField({
  orderId,
  fieldName,
  nextStatus,
  selectElement,
  labelMap,
  loadingText,
  successPrefix
}) {
  if (!window.supabaseClient) {
    orderStatusText.textContent = "Supabase 尚未設定";
    return;
  }

  if (!orderId || !fieldName || !nextStatus) return;

  const previousStatus = selectElement.dataset.currentStatus || "";

  if (previousStatus === nextStatus) return;

  selectElement.disabled = true;
  orderStatusText.textContent = loadingText;

  const updatePayload = {
    [fieldName]: nextStatus,
    ...buildTimestampPayload(fieldName, nextStatus)
  };

  if (fieldName === "payment_status") {
    if (nextStatus === "paid") {
      updatePayload.paid_at = new Date().toISOString();
    }

    if (previousStatus === "paid" && nextStatus !== "paid") {
      updatePayload.paid_at = null;
    }
  }

  const { error } = await window.supabaseClient
    .from("orders")
    .update(updatePayload)
    .eq("id", orderId);

  selectElement.disabled = false;

  if (error) {
    console.error(`${successPrefix}失敗：`, error);
    orderStatusText.textContent = `${successPrefix}失敗`;
    selectElement.value = previousStatus;
    return;
  }

  const previousLabel = getLabel(labelMap, previousStatus);
  const nextLabel = getLabel(labelMap, nextStatus);
  const fieldLabel = getFieldLabel(fieldName);

  await createOrderLog({
    orderId,
    action: getActionName(fieldName),
    oldValue: {
      [fieldName]: previousStatus
    },
    newValue: {
      [fieldName]: nextStatus
    },
    note: `${fieldLabel}由「${previousLabel}」改為「${nextLabel}」`
  });

  orderStatusText.textContent = `${successPrefix}已更新為「${nextLabel}」`;

  await loadOrders();
}

async function archiveOrder(orderId) {
  if (!window.supabaseClient) {
    orderStatusText.textContent = "Supabase 尚未設定";
    return;
  }

  if (!orderId) return;

  const confirmed = window.confirm("確定要封存這筆訂單嗎？封存後會移到「封存訂單」。");

  if (!confirmed) return;

  orderStatusText.textContent = "封存訂單中...";

  const { error } = await window.supabaseClient
    .from("orders")
    .update({
      is_archived: true,
      archived_at: new Date().toISOString()
    })
    .eq("id", orderId);

  if (error) {
    console.error("封存訂單失敗：", error);
    orderStatusText.textContent = "封存訂單失敗";
    return;
  }

  await createOrderLog({
    orderId,
    action: "archive_order",
    oldValue: {
      is_archived: false
    },
    newValue: {
      is_archived: true
    },
    note: "訂單已封存"
  });

  orderStatusText.textContent = "訂單已封存";
  await loadOrders();
}

async function restoreOrder(orderId) {
  if (!window.supabaseClient) {
    orderStatusText.textContent = "Supabase 尚未設定";
    return;
  }

  if (!orderId) return;

  const confirmed = window.confirm("確定要把這筆訂單拉回進行中嗎？");

  if (!confirmed) return;

  orderStatusText.textContent = "拉回訂單中...";

  const { error } = await window.supabaseClient
    .from("orders")
    .update({
      is_archived: false,
      archived_at: null,
      order_status: "problem"
    })
    .eq("id", orderId);

  if (error) {
    console.error("拉回訂單失敗：", error);
    orderStatusText.textContent = "拉回訂單失敗";
    return;
  }

  await createOrderLog({
    orderId,
    action: "restore_order",
    oldValue: {
      is_archived: true
    },
    newValue: {
      is_archived: false,
      order_status: "problem"
    },
    note: "訂單已拉回進行中，並標記為問題訂單"
  });

  orderStatusText.textContent = "訂單已拉回進行中，狀態已標記為問題訂單";
  await loadOrders();
}

function showSupabaseNotConfigured() {
  orderStatusText.textContent = "Supabase 尚未設定";

  if (ordersTableBody) {
    ordersTableBody.innerHTML = `
      <tr>
        <td colspan="10">請先設定 admin/assets/js/services/supabase-config.js。</td>
      </tr>
    `;
  }

  if (ordersMobileList) {
    ordersMobileList.innerHTML = `
      <p class="orders-empty-text">請先設定 admin/assets/js/services/supabase-config.js。</p>
    `;
  }
}

function showLoadError() {
  orderStatusText.textContent = "讀取失敗";

  if (ordersTableBody) {
    ordersTableBody.innerHTML = `
      <tr>
        <td colspan="10">訂單資料讀取失敗，請檢查 Supabase orders 資料表。</td>
      </tr>
    `;
  }

  if (ordersMobileList) {
    ordersMobileList.innerHTML = `
      <p class="orders-empty-text">訂單資料讀取失敗，請檢查 Supabase orders 資料表。</p>
    `;
  }
}

async function loadOrders() {
  if (!window.supabaseClient) {
    showSupabaseNotConfigured();
    return;
  }

  updateViewUI();

  const isArchivedView = currentOrdersView === "archived";

  orderStatusText.textContent = isArchivedView
    ? "讀取封存訂單中..."
    : "讀取進行中訂單中...";

  const { data, error } = await window.supabaseClient
    .from("orders")
    .select("*")
    .eq("is_archived", isArchivedView)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("讀取訂單失敗：", error);
    showLoadError();
    return;
  }

  allOrders = data || [];
  renderFilteredOrders();
}

function handleOrderAction(event) {
  const viewButton = event.target.closest("[data-action='view-order']");
  const archiveButton = event.target.closest("[data-action='archive-order']");
  const restoreButton = event.target.closest("[data-action='restore-order']");

  if (viewButton) {
    const orderId = viewButton.dataset.id;
    if (!orderId) return;

    window.location.href = `order-detail.html?id=${encodeURIComponent(orderId)}`;
    return;
  }

  if (archiveButton) {
    const orderId = archiveButton.dataset.id;
    archiveOrder(orderId);
    return;
  }

  if (restoreButton) {
    const orderId = restoreButton.dataset.id;
    restoreOrder(orderId);
  }
}

function handleOrderStatusChange(event) {
  const select = event.target.closest("[data-action]");

  if (!select) return;

  const orderId = select.dataset.id;
  const nextStatus = select.value;
  const action = select.dataset.action;

  if (action === "change-payment-status") {
    updateOrderField({
      orderId,
      fieldName: "payment_status",
      nextStatus,
      selectElement: select,
      labelMap: PAYMENT_STATUS_LABELS,
      loadingText: "更新付款狀態中...",
      successPrefix: "付款狀態"
    });
  }

  if (action === "change-order-status") {
    updateOrderField({
      orderId,
      fieldName: "order_status",
      nextStatus,
      selectElement: select,
      labelMap: ORDER_STATUS_LABELS,
      loadingText: "更新訂單狀態中...",
      successPrefix: "訂單狀態"
    });
  }

  if (action === "change-packing-status") {
    updateOrderField({
      orderId,
      fieldName: "packing_status",
      nextStatus,
      selectElement: select,
      labelMap: PACKING_STATUS_LABELS,
      loadingText: "更新包裝狀態中...",
      successPrefix: "包裝狀態"
    });
  }

  if (action === "change-shipping-status") {
    updateOrderField({
      orderId,
      fieldName: "shipping_status",
      nextStatus,
      selectElement: select,
      labelMap: SHIPPING_STATUS_LABELS,
      loadingText: "更新出貨狀態中...",
      successPrefix: "出貨狀態"
    });
  }
}

function resetFilters() {
  if (orderSearchInput) orderSearchInput.value = "";
  if (orderStatusFilter) orderStatusFilter.value = "all";
  if (orderDateFilter) orderDateFilter.value = "all";

  renderFilteredOrders();
}

function getOrderExportRows(orders) {
  return orders.map((order) => {
    return {
      訂單編號: order.order_number || "",
      建立時間: formatDateTime(order.created_at),
      顧客姓名: order.customer_name || "",
      顧客電話: order.customer_phone || "",
      Email: order.customer_email || "",
      收件人: order.shipping_name || "",
      收件電話: order.shipping_phone || "",
      配送方式: order.shipping_method || "",
      配送地址: order.shipping_address || "",
      商品小計: Number(order.subtotal || 0),
      運費: Number(order.shipping_fee || 0),
      訂單金額: Number(order.total_amount || 0),
      付款方式: order.payment_method || "",
      付款狀態: getLabel(PAYMENT_STATUS_LABELS, order.payment_status || "unpaid"),
      訂單狀態: getLabel(ORDER_STATUS_LABELS, order.order_status || "new"),
      包裝狀態: getLabel(PACKING_STATUS_LABELS, order.packing_status || "not_started"),
      出貨狀態: getLabel(SHIPPING_STATUS_LABELS, order.shipping_status || "not_shipped"),
      顧客備註: order.customer_note || "",
      內部備註: order.internal_note || "",
      會計備註: order.accounting_note || "",
      工坊備註: order.workshop_note || ""
    };
  });
}

function convertRowsToCsv(rows) {
  if (!rows.length) return "";

  const headers = Object.keys(rows[0]);

  const csvRows = [
    headers.join(","),
    ...rows.map((row) => {
      return headers.map((header) => {
        const value = row[header] ?? "";
        const safeValue = String(value).replaceAll('"', '""');

        return `"${safeValue}"`;
      }).join(",");
    })
  ];

  return csvRows.join("\n");
}

function downloadCsv(filename, csvContent) {
  const bom = "\uFEFF";
  const blob = new Blob([bom + csvContent], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function exportOrdersCsv(orders, filenamePrefix) {
  if (!orders.length) {
    window.alert("目前沒有可匯出的訂單。");
    return;
  }

  const rows = getOrderExportRows(orders);
  const csvContent = convertRowsToCsv(rows);
  const dateString = getTodayDateString();

  downloadCsv(`${filenamePrefix}_${dateString}.csv`, csvContent);

  orderStatusText.textContent = `已匯出 ${orders.length} 筆訂單`;
}

function exportFilteredOrders() {
  const filteredOrders = getFilteredOrders();

  exportOrdersCsv(filteredOrders, "花生一生_目前列表訂單");
}

function exportTodayOrders() {
  const todayOrders = allOrders.filter((order) => {
    const date = new Date(order.created_at);

    if (Number.isNaN(date.getTime())) return false;

    return isToday(date);
  });

  exportOrdersCsv(todayOrders, "花生一生_今日訂單");
}

refreshOrdersBtn?.addEventListener("click", loadOrders);

activeOrdersViewBtn?.addEventListener("click", async () => {
  currentOrdersView = "active";
  await loadOrders();
});

archivedOrdersViewBtn?.addEventListener("click", async () => {
  currentOrdersView = "archived";
  await loadOrders();
});

orderSearchInput?.addEventListener("input", renderFilteredOrders);
orderStatusFilter?.addEventListener("change", renderFilteredOrders);
orderDateFilter?.addEventListener("change", renderFilteredOrders);
resetOrderFiltersBtn?.addEventListener("click", resetFilters);
exportFilteredOrdersBtn?.addEventListener("click", exportFilteredOrders);
exportTodayOrdersBtn?.addEventListener("click", exportTodayOrders);

ordersTableBody?.addEventListener("click", handleOrderAction);
ordersMobileList?.addEventListener("click", handleOrderAction);

ordersTableBody?.addEventListener("change", handleOrderStatusChange);
ordersMobileList?.addEventListener("change", handleOrderStatusChange);

loadOrders();