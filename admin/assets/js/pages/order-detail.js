// admin/assets/js/pages/order-detail.js
// 訂單詳情頁：讀取 orders 與 order_items，顯示顧客資料、配送資料、商品明細與備註，並支援流程狀態、備註編輯與 order_logs 操作紀錄。

const orderDetailTitle = document.getElementById("orderDetailTitle");
const orderDetailHint = document.getElementById("orderDetailHint");
const orderStatusText = document.getElementById("orderStatusText");
const orderCreatedAt = document.getElementById("orderCreatedAt");

const orderTotalAmount = document.getElementById("orderTotalAmount");
const orderPaymentMethod = document.getElementById("orderPaymentMethod");
const orderPaymentStatus = document.getElementById("orderPaymentStatus");
const orderPaidAt = document.getElementById("orderPaidAt");
const orderPackingStatus = document.getElementById("orderPackingStatus");
const orderShippingStatus = document.getElementById("orderShippingStatus");

const customerName = document.getElementById("customerName");
const customerPhone = document.getElementById("customerPhone");
const customerEmail = document.getElementById("customerEmail");

const shippingName = document.getElementById("shippingName");
const shippingPhone = document.getElementById("shippingPhone");
const shippingMethod = document.getElementById("shippingMethod");
const shippingAddress = document.getElementById("shippingAddress");

const orderItemsTableBody = document.getElementById("orderItemsTableBody");
const orderSubtotal = document.getElementById("orderSubtotal");
const orderShippingFee = document.getElementById("orderShippingFee");
const orderGrandTotal = document.getElementById("orderGrandTotal");

const customerNote = document.getElementById("customerNote");

const internalNoteInput = document.getElementById("internalNoteInput");
const accountingNoteInput = document.getElementById("accountingNoteInput");
const workshopNoteInput = document.getElementById("workshopNoteInput");

const saveInternalNoteBtn = document.getElementById("saveInternalNoteBtn");
const saveAccountingNoteBtn = document.getElementById("saveAccountingNoteBtn");
const saveWorkshopNoteBtn = document.getElementById("saveWorkshopNoteBtn");

const paymentStatusSelect = document.getElementById("paymentStatusSelect");
const orderStatusSelect = document.getElementById("orderStatusSelect");
const packingStatusSelect = document.getElementById("packingStatusSelect");
const shippingStatusSelect = document.getElementById("shippingStatusSelect");
const saveWorkflowBtn = document.getElementById("saveWorkflowBtn");
const printShippingBtn = document.getElementById("printShippingBtn");

const orderLogsPanel = document.getElementById("orderLogsPanel");
const orderLogsSummary = document.getElementById("orderLogsSummary");
const orderLogsToggleBtn = document.getElementById("orderLogsToggleBtn");
const orderLogsList = document.getElementById("orderLogsList");

const params = new URLSearchParams(window.location.search);
const orderId = params.get("id");

let currentOrder = null;

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

function setText(element, value, fallback = "-") {
  if (!element) return;
  element.textContent = value || fallback;
}

function setInputValue(element, value) {
  if (!element) return;
  element.value = value || "";
}

function setSelectValue(element, value) {
  if (!element) return;
  element.value = value || "";
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

function getWorkflowFieldLabel(fieldName) {
  const map = {
    payment_status: "付款狀態",
    order_status: "訂單狀態",
    packing_status: "包裝狀態",
    shipping_status: "出貨狀態"
  };

  return map[fieldName] || "訂單欄位";
}

function getWorkflowLabelMap(fieldName) {
  const map = {
    payment_status: PAYMENT_STATUS_LABELS,
    order_status: ORDER_STATUS_LABELS,
    packing_status: PACKING_STATUS_LABELS,
    shipping_status: SHIPPING_STATUS_LABELS
  };

  return map[fieldName] || {};
}

function getWorkflowActionName(fieldName) {
  const map = {
    payment_status: "update_payment_status",
    order_status: "update_order_status",
    packing_status: "update_packing_status",
    shipping_status: "update_shipping_status"
  };

  return map[fieldName] || "update_order_status";
}

function getNoteLabel(fieldName) {
  const map = {
    internal_note: "內部備註",
    accounting_note: "會計備註",
    workshop_note: "現場備註"
  };

  return map[fieldName] || "訂單備註";
}

function getNoteActionName(fieldName) {
  const map = {
    internal_note: "update_internal_note",
    accounting_note: "update_accounting_note",
    workshop_note: "update_workshop_note"
  };

  return map[fieldName] || "update_order_note";
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

function renderOrderLogs(logs, totalCount = 0) {
  if (!orderLogsList) return;

  if (!logs.length) {
    if (orderLogsSummary) {
      orderLogsSummary.textContent = "目前尚無操作紀錄。";
    }

    orderLogsList.innerHTML = `
      <div class="order-log-empty">目前尚無操作紀錄。</div>
    `;
    return;
  }

  const latestLog = logs[0];
  const latestText = `最新：${latestLog.note || latestLog.action || "訂單操作"}｜${formatDateTime(latestLog.created_at)}`;
  const countText = totalCount > 10
    ? `｜共 ${totalCount} 筆，展開後顯示最新 10 筆`
    : `｜共 ${totalCount || logs.length} 筆`;

  if (orderLogsSummary) {
    orderLogsSummary.textContent = `${latestText}${countText}`;
  }

  orderLogsList.innerHTML = logs.map((log) => {
    return `
      <div class="order-log-item">
        <div class="order-log-dot"></div>

        <div class="order-log-content">
          <div class="order-log-main">
            ${escapeHtml(log.note || log.action || "訂單操作")}
          </div>

          <div class="order-log-meta">
            <span>${formatDateTime(log.created_at)}</span>
            <span>${escapeHtml(log.action || "-")}</span>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

async function loadOrderLogs() {
  if (!orderLogsList) return;

  if (!window.supabaseClient || !orderId) {
    if (orderLogsSummary) {
      orderLogsSummary.textContent = "操作紀錄無法讀取。";
    }

    orderLogsList.innerHTML = `
      <div class="order-log-empty">操作紀錄無法讀取。</div>
    `;
    return;
  }

  const { data, error, count } = await window.supabaseClient
    .from("order_logs")
    .select("*", { count: "exact" })
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("讀取操作紀錄失敗：", error);

    if (orderLogsSummary) {
      orderLogsSummary.textContent = "操作紀錄讀取失敗。";
    }

    orderLogsList.innerHTML = `
      <div class="order-log-empty">操作紀錄讀取失敗。</div>
    `;
    return;
  }

  renderOrderLogs(data || [], count || 0);
}

function renderOrderItems(items) {
  if (!items.length) {
    orderItemsTableBody.innerHTML = `
      <tr>
        <td colspan="6">此訂單目前沒有商品明細。</td>
      </tr>
    `;
    return;
  }

  orderItemsTableBody.innerHTML = items.map((item) => {
    return `
      <tr>
        <td>
          <strong>${escapeHtml(item.product_name || "-")}</strong>
        </td>
        <td>${escapeHtml(item.sku || "-")}</td>
        <td>${escapeHtml(item.weight || "-")}</td>
        <td>${formatPrice(item.price)}</td>
        <td>${Number(item.quantity || 0)}</td>
        <td>${formatPrice(item.subtotal)}</td>
      </tr>
    `;
  }).join("");
}

function fillOrder(order) {
  currentOrder = order;

  const orderNumber = order.order_number || "-";

  orderDetailTitle.textContent = `訂單詳情｜${orderNumber}`;
  orderDetailHint.textContent = `查看 ${orderNumber} 的完整訂單資料、商品明細與備註。`;

  setText(orderStatusText, getLabel(ORDER_STATUS_LABELS, order.order_status));
  setText(orderCreatedAt, `建立時間：${formatDateTime(order.created_at)}`);

  setText(orderTotalAmount, formatPrice(order.total_amount));
  setText(orderPaymentMethod, `付款方式：${order.payment_method || "-"}`);
  setText(orderPaymentStatus, getLabel(PAYMENT_STATUS_LABELS, order.payment_status));
  setText(orderPaidAt, `付款時間：${formatDateTime(order.paid_at)}`);
  setText(orderPackingStatus, getLabel(PACKING_STATUS_LABELS, order.packing_status));
  setText(orderShippingStatus, `出貨狀態：${getLabel(SHIPPING_STATUS_LABELS, order.shipping_status)}`);

  setText(customerName, order.customer_name);
  setText(customerPhone, order.customer_phone);
  setText(customerEmail, order.customer_email);

  setText(shippingName, order.shipping_name);
  setText(shippingPhone, order.shipping_phone);
  setText(shippingMethod, order.shipping_method);
  setText(shippingAddress, order.shipping_address);

  setText(orderSubtotal, formatPrice(order.subtotal));
  setText(orderShippingFee, formatPrice(order.shipping_fee));
  setText(orderGrandTotal, formatPrice(order.total_amount));

  setText(customerNote, order.customer_note);

  setInputValue(internalNoteInput, order.internal_note);
  setInputValue(accountingNoteInput, order.accounting_note);
  setInputValue(workshopNoteInput, order.workshop_note);

  setSelectValue(paymentStatusSelect, order.payment_status || "unpaid");
  setSelectValue(orderStatusSelect, order.order_status || "new");
  setSelectValue(packingStatusSelect, order.packing_status || "not_started");
  setSelectValue(shippingStatusSelect, order.shipping_status || "not_shipped");
}

function buildWorkflowTimestampPayload(payload) {
  const now = new Date().toISOString();

  if (!currentOrder) return payload;

  if (payload.payment_status === "paid" && currentOrder.payment_status !== "paid") {
    payload.paid_at = now;
  }

  if (currentOrder.payment_status === "paid" && payload.payment_status !== "paid") {
    payload.paid_at = null;
  }

  if (payload.order_status === "confirmed" && currentOrder.order_status !== "confirmed") {
    payload.confirmed_at = now;
  }

  if (payload.order_status === "preparing" && currentOrder.order_status !== "preparing") {
    payload.prepared_at = now;
  }

  if (payload.order_status === "completed" && currentOrder.order_status !== "completed") {
    payload.completed_at = now;
  }

  if (payload.order_status === "cancelled" && currentOrder.order_status !== "cancelled") {
    payload.cancelled_at = now;
  }

  if (payload.packing_status === "packed" && currentOrder.packing_status !== "packed") {
    payload.packed_at = now;
  }

  if (payload.shipping_status === "ready" && currentOrder.shipping_status !== "ready") {
    payload.prepared_at = now;
  }

  if (payload.shipping_status === "shipped" && currentOrder.shipping_status !== "shipped") {
    payload.shipped_at = now;
  }

  if (payload.shipping_status === "delivered" && currentOrder.shipping_status !== "delivered") {
    payload.completed_at = now;
  }

  return payload;
}

function getChangedWorkflowFields(payload) {
  if (!currentOrder) return [];

  return Object.entries(payload)
    .filter(([fieldName, nextValue]) => {
      const previousValue = currentOrder[fieldName] || "";
      return previousValue !== nextValue;
    })
    .map(([fieldName, nextValue]) => {
      return {
        fieldName,
        previousValue: currentOrder[fieldName] || "",
        nextValue
      };
    });
}

async function writeWorkflowLogs(changedFields) {
  for (const item of changedFields) {
    const labelMap = getWorkflowLabelMap(item.fieldName);
    const fieldLabel = getWorkflowFieldLabel(item.fieldName);
    const previousLabel = getLabel(labelMap, item.previousValue);
    const nextLabel = getLabel(labelMap, item.nextValue);

    await createOrderLog({
      orderId,
      action: getWorkflowActionName(item.fieldName),
      oldValue: {
        [item.fieldName]: item.previousValue
      },
      newValue: {
        [item.fieldName]: item.nextValue
      },
      note: `${fieldLabel}由「${previousLabel}」改為「${nextLabel}」`
    });
  }
}

async function updateWorkflowStatus() {
  if (!orderId) {
    orderStatusText.textContent = "缺少訂單 ID";
    return;
  }

  if (!window.supabaseClient) {
    orderStatusText.textContent = "Supabase 尚未設定";
    return;
  }

  const payload = {
    payment_status: paymentStatusSelect.value,
    order_status: orderStatusSelect.value,
    packing_status: packingStatusSelect.value,
    shipping_status: shippingStatusSelect.value
  };

  const changedFields = getChangedWorkflowFields(payload);

  if (!changedFields.length) {
    orderStatusText.textContent = "流程狀態沒有變更";
    return;
  }

  const updatePayload = buildWorkflowTimestampPayload(payload);

  saveWorkflowBtn.disabled = true;
  const originalText = saveWorkflowBtn.textContent;
  saveWorkflowBtn.textContent = "儲存中...";
  orderStatusText.textContent = "流程狀態儲存中...";

  const { error } = await window.supabaseClient
    .from("orders")
    .update(updatePayload)
    .eq("id", orderId);

  saveWorkflowBtn.disabled = false;
  saveWorkflowBtn.textContent = originalText;

  if (error) {
    console.error("儲存流程狀態失敗：", error);
    orderStatusText.textContent = "流程狀態儲存失敗";
    return;
  }

  await writeWorkflowLogs(changedFields);

  orderStatusText.textContent = "流程狀態已儲存";

  await loadOrderDetail();
}

async function updateOrderNote(fieldName, value, button, successText) {
  if (!orderId) {
    orderStatusText.textContent = "缺少訂單 ID";
    return;
  }

  if (!window.supabaseClient) {
    orderStatusText.textContent = "Supabase 尚未設定";
    return;
  }

  if (!fieldName) return;

  const previousValue = currentOrder?.[fieldName] || "";
  const nextValue = value || "";

  if (previousValue === nextValue) {
    orderStatusText.textContent = `${getNoteLabel(fieldName)}沒有變更`;
    return;
  }

  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "儲存中...";
  orderStatusText.textContent = "備註儲存中...";

  const { error } = await window.supabaseClient
    .from("orders")
    .update({
      [fieldName]: nextValue || null
    })
    .eq("id", orderId);

  button.disabled = false;
  button.textContent = originalText;

  if (error) {
    console.error("儲存備註失敗：", error);
    orderStatusText.textContent = "備註儲存失敗";
    return;
  }

  await createOrderLog({
    orderId,
    action: getNoteActionName(fieldName),
    oldValue: {
      [fieldName]: previousValue
    },
    newValue: {
      [fieldName]: nextValue
    },
    note: `${getNoteLabel(fieldName)}已更新`
  });

  if (currentOrder) {
    currentOrder[fieldName] = nextValue || null;
  }

  orderStatusText.textContent = successText;

  await loadOrderLogs();
}

async function loadOrderDetail() {
  if (!orderId) {
    orderStatusText.textContent = "缺少訂單 ID";
    orderItemsTableBody.innerHTML = `
      <tr>
        <td colspan="6">網址缺少訂單 ID，請從訂單列表進入。</td>
      </tr>
    `;

    if (orderLogsSummary) {
      orderLogsSummary.textContent = "網址缺少訂單 ID。";
    }

    if (orderLogsList) {
      orderLogsList.innerHTML = `
        <div class="order-log-empty">網址缺少訂單 ID。</div>
      `;
    }

    return;
  }

  if (!window.supabaseClient) {
    orderStatusText.textContent = "Supabase 尚未設定";
    orderItemsTableBody.innerHTML = `
      <tr>
        <td colspan="6">請先設定 admin/assets/js/services/supabase-config.js。</td>
      </tr>
    `;

    if (orderLogsSummary) {
      orderLogsSummary.textContent = "Supabase 尚未設定。";
    }

    if (orderLogsList) {
      orderLogsList.innerHTML = `
        <div class="order-log-empty">Supabase 尚未設定。</div>
      `;
    }

    return;
  }

  orderStatusText.textContent = "讀取中...";

  const { data: order, error: orderError } = await window.supabaseClient
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (orderError) {
    console.error("讀取訂單失敗：", orderError);
    orderStatusText.textContent = "讀取訂單失敗";
    orderItemsTableBody.innerHTML = `
      <tr>
        <td colspan="6">讀取訂單失敗，請確認訂單是否存在。</td>
      </tr>
    `;

    if (orderLogsSummary) {
      orderLogsSummary.textContent = "訂單讀取失敗。";
    }

    if (orderLogsList) {
      orderLogsList.innerHTML = `
        <div class="order-log-empty">訂單讀取失敗，操作紀錄無法顯示。</div>
      `;
    }

    return;
  }

  fillOrder(order);

  const { data: items, error: itemsError } = await window.supabaseClient
    .from("order_items")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (itemsError) {
    console.error("讀取商品明細失敗：", itemsError);
    orderItemsTableBody.innerHTML = `
      <tr>
        <td colspan="6">商品明細讀取失敗。</td>
      </tr>
    `;
  } else {
    renderOrderItems(items || []);
  }

  await loadOrderLogs();
}

orderLogsToggleBtn?.addEventListener("click", () => {
  if (!orderLogsPanel) return;

  const isCollapsed = orderLogsPanel.classList.toggle("collapsed");

  orderLogsToggleBtn.textContent = isCollapsed
    ? "展開操作紀錄"
    : "收合操作紀錄";
});
printShippingBtn?.addEventListener("click", () => {
  window.print();
});

saveWorkflowBtn?.addEventListener("click", updateWorkflowStatus);

saveInternalNoteBtn?.addEventListener("click", () => {
  updateOrderNote(
    "internal_note",
    internalNoteInput.value.trim(),
    saveInternalNoteBtn,
    "內部備註已儲存"
  );
});

saveAccountingNoteBtn?.addEventListener("click", () => {
  updateOrderNote(
    "accounting_note",
    accountingNoteInput.value.trim(),
    saveAccountingNoteBtn,
    "會計備註已儲存"
  );
});

saveWorkshopNoteBtn?.addEventListener("click", () => {
  updateOrderNote(
    "workshop_note",
    workshopNoteInput.value.trim(),
    saveWorkshopNoteBtn,
    "現場備註已儲存"
  );
});

loadOrderDetail();