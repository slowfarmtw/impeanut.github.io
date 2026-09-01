// 顧客管理頁：以 customers 為主資料，彙整有效購買、累積消費與顧客狀態。

const customersTableBody = document.getElementById("customersTableBody");
const customersMobileList = document.getElementById("customersMobileList");
const customersStatusText = document.getElementById("customersStatusText");

const totalCustomersEl = document.getElementById("totalCustomers");
const repeatCustomersEl = document.getElementById("repeatCustomers");
const customerRevenueEl = document.getElementById("customerRevenue");
const problemCustomersEl = document.getElementById("problemCustomers");

const refreshCustomersBtn = document.getElementById("refreshCustomersBtn");
const exportCustomersBtn = document.getElementById("exportCustomersBtn");
const customerSearchInput = document.getElementById("customerSearchInput");
const customerTypeFilter = document.getElementById("customerTypeFilter");
const customerSortSelect = document.getElementById("customerSortSelect");
const resetCustomerFiltersBtn = document.getElementById("resetCustomerFiltersBtn");

let allCustomers = [];

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

function isValidPurchase(order) {
  return (
    order.payment_status === "paid" &&
    order.order_status !== "cancelled" &&
    order.payment_status !== "refunded"
  );
}

function buildCustomerSummaries(customers, orders) {
  const ordersByCustomer = new Map();

  orders.forEach((order) => {
    if (!order.customer_id) return;
    if (!ordersByCustomer.has(order.customer_id)) ordersByCustomer.set(order.customer_id, []);
    ordersByCustomer.get(order.customer_id).push(order);
  });

  return customers.map((customer) => {
    const customerOrders = ordersByCustomer.get(customer.id) || [];
    const validOrders = customerOrders.filter(isValidPurchase);
    const latestOrder = [...customerOrders].sort(compareOrdersNewestFirst)[0];
    const latestPurchase = [...validOrders].sort(compareOrdersNewestFirst)[0];

    return {
      ...customer,
      orders: customerOrders,
      totalOrderCount: customerOrders.length,
      purchaseCount: validOrders.length,
      revenue: validOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0),
      latestOrderAt: latestOrder?.order_date || latestOrder?.created_at || null,
      latestPurchaseAt: latestPurchase?.order_date || latestPurchase?.created_at || null,
      hasProblemOrder: customerOrders.some((order) => order.order_status === "problem")
    };
  });
}

function compareOrdersNewestFirst(a, b) {
  const aDate = new Date(a.order_date || a.created_at).getTime();
  const bDate = new Date(b.order_date || b.created_at).getTime();
  return bDate - aDate;
}

function getCustomerTag(customer) {
  if (customer.needs_review || customer.hasProblemOrder) {
    return { label: "需關注", className: "problem" };
  }
  if (customer.revenue >= 3000 || customer.purchaseCount >= 3) {
    return { label: "高價值", className: "vip" };
  }
  if (customer.purchaseCount > 1) {
    return { label: "回購", className: "repeat" };
  }
  return { label: "一般", className: "" };
}

function getFilteredCustomers() {
  const keyword = (customerSearchInput?.value || "").trim().toLowerCase();
  const type = customerTypeFilter?.value || "all";
  const sort = customerSortSelect?.value || "latest";

  const filtered = allCustomers.filter((customer) => {
    const searchText = [
      customer.name,
      customer.primary_phone,
      customer.primary_email,
      ...(customer.tags || [])
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchKeyword = keyword ? searchText.includes(keyword) : true;
    let matchType = true;

    if (type === "repeat") matchType = customer.purchaseCount > 1;
    if (type === "vip") matchType = customer.revenue >= 3000 || customer.purchaseCount >= 3;
    if (type === "problem") matchType = customer.needs_review || customer.hasProblemOrder;

    return matchKeyword && matchType;
  });

  return [...filtered].sort((a, b) => {
    if (sort === "revenue") return b.revenue - a.revenue;
    if (sort === "orders") return b.purchaseCount - a.purchaseCount;

    const aDate = new Date(a.latestPurchaseAt || a.latestOrderAt || 0).getTime();
    const bDate = new Date(b.latestPurchaseAt || b.latestOrderAt || 0).getTime();
    return bDate - aDate;
  });
}

function renderSummary(customers) {
  const repeatCount = customers.filter((customer) => customer.purchaseCount > 1).length;
  const problemCount = customers.filter(
    (customer) => customer.needs_review || customer.hasProblemOrder
  ).length;
  const revenue = customers.reduce((sum, customer) => sum + customer.revenue, 0);

  totalCustomersEl.textContent = customers.length;
  repeatCustomersEl.textContent = repeatCount;
  customerRevenueEl.textContent = formatPrice(revenue);
  problemCustomersEl.textContent = problemCount;
}

function getEmptyText() {
  const hasFilter =
    (customerSearchInput?.value || "").trim() ||
    (customerTypeFilter?.value && customerTypeFilter.value !== "all");

  return hasFilter ? "目前沒有符合篩選條件的顧客。" : "目前沒有顧客資料。";
}

function renderCustomersTable(customers) {
  if (!customersTableBody) return;

  if (!customers.length) {
    customersTableBody.innerHTML = `<tr><td colspan="8">${getEmptyText()}</td></tr>`;
    return;
  }

  customersTableBody.innerHTML = customers.map((customer) => {
    const tag = getCustomerTag(customer);

    return `
      <tr>
        <td><strong class="customer-name">${escapeHtml(customer.name || "-")}</strong></td>
        <td>${escapeHtml(customer.primary_phone || "-")}</td>
        <td>${escapeHtml(customer.primary_email || "-")}</td>
        <td>${customer.purchaseCount}</td>
        <td>${formatPrice(customer.revenue)}</td>
        <td>${formatDateTime(customer.latestPurchaseAt)}</td>
        <td><span class="customer-tag ${tag.className}">${tag.label}</span></td>
        <td>
          <a class="customer-action-btn" href="customer-detail.html?id=${encodeURIComponent(customer.id)}">
            查看顧客
          </a>
        </td>
      </tr>
    `;
  }).join("");
}

function renderCustomersMobile(customers) {
  if (!customersMobileList) return;

  if (!customers.length) {
    customersMobileList.innerHTML = `<p class="customers-empty-text">${getEmptyText()}</p>`;
    return;
  }

  customersMobileList.innerHTML = customers.map((customer) => {
    const tag = getCustomerTag(customer);

    return `
      <article class="customer-mobile-card">
        <div class="customer-mobile-head">
          <div>
            <strong class="customer-mobile-name">${escapeHtml(customer.name || "-")}</strong>
            <p class="customer-mobile-phone">${escapeHtml(customer.primary_phone || "-")}</p>
            <p class="customer-mobile-email">${escapeHtml(customer.primary_email || "-")}</p>
          </div>
          <div class="customer-mobile-total">${formatPrice(customer.revenue)}</div>
        </div>

        <div class="customer-mobile-grid">
          <div class="customer-mobile-item">
            <span>有效購買</span>
            <strong>${customer.purchaseCount}</strong>
          </div>
          <div class="customer-mobile-item">
            <span>最近購買</span>
            <strong>${formatDateTime(customer.latestPurchaseAt)}</strong>
          </div>
          <div class="customer-mobile-item">
            <span>狀態</span>
            <strong>${tag.label}</strong>
          </div>
        </div>

        <a class="customer-action-btn" href="customer-detail.html?id=${encodeURIComponent(customer.id)}">
          查看顧客
        </a>
      </article>
    `;
  }).join("");
}

function renderCustomers() {
  const customers = getFilteredCustomers();

  renderSummary(customers);
  renderCustomersTable(customers);
  renderCustomersMobile(customers);

  if (!customersStatusText) return;
  customersStatusText.textContent = customers.length === allCustomers.length
    ? `共 ${customers.length} 位顧客`
    : `共 ${allCustomers.length} 位顧客，篩選後 ${customers.length} 位`;
}

function convertRowsToCsv(rows) {
  if (!rows.length) return "";

  const headers = Object.keys(rows[0]);
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => {
      const safeValue = String(row[header] ?? "").replaceAll('"', '""');
      return `"${safeValue}"`;
    }).join(","))
  ].join("\n");
}

function downloadCsv(filename, csvContent) {
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
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

function exportCustomers() {
  const customers = getFilteredCustomers();

  if (!customers.length) {
    window.alert("目前沒有可匯出的顧客資料。");
    return;
  }

  const rows = customers.map((customer) => {
    const tag = getCustomerTag(customer);
    return {
      顧客姓名: customer.name || "",
      電話: customer.primary_phone || "",
      Email: customer.primary_email || "",
      有效購買: customer.purchaseCount,
      全部訂單: customer.totalOrderCount,
      累積消費: customer.revenue,
      最近購買: formatDateTime(customer.latestPurchaseAt),
      顧客狀態: tag.label,
      顧客標籤: (customer.tags || []).join("、")
    };
  });

  downloadCsv(
    `花生一生_顧客列表_${getTodayDateString()}.csv`,
    convertRowsToCsv(rows)
  );
  customersStatusText.textContent = `已匯出 ${customers.length} 位顧客`;
}

function resetFilters() {
  if (customerSearchInput) customerSearchInput.value = "";
  if (customerTypeFilter) customerTypeFilter.value = "all";
  if (customerSortSelect) customerSortSelect.value = "latest";
  renderCustomers();
}

function showLoadError(message = "顧客資料讀取失敗。") {
  if (customersStatusText) customersStatusText.textContent = "讀取失敗";
  if (customersTableBody) {
    customersTableBody.innerHTML = `<tr><td colspan="8">${escapeHtml(message)}</td></tr>`;
  }
  if (customersMobileList) {
    customersMobileList.innerHTML = `<p class="customers-empty-text">${escapeHtml(message)}</p>`;
  }
}

async function loadCustomers() {
  if (!window.supabaseClient) {
    showLoadError("Supabase 尚未設定。");
    return;
  }

  customersStatusText.textContent = "讀取顧客資料中...";

  const [customersResult, ordersResult] = await Promise.all([
    window.supabaseClient.from("customers").select("*").order("created_at", { ascending: true }),
    window.supabaseClient
      .from("orders")
      .select("*")
      .not("customer_id", "is", null)
      .order("order_date", { ascending: false })
  ]);

  if (customersResult.error || ordersResult.error) {
    console.error("讀取顧客資料失敗：", customersResult.error || ordersResult.error);
    showLoadError("顧客資料讀取失敗，請稍後再試。");
    return;
  }

  allCustomers = buildCustomerSummaries(customersResult.data || [], ordersResult.data || []);
  renderCustomers();
}

refreshCustomersBtn?.addEventListener("click", loadCustomers);
exportCustomersBtn?.addEventListener("click", exportCustomers);
customerSearchInput?.addEventListener("input", renderCustomers);
customerTypeFilter?.addEventListener("change", renderCustomers);
customerSortSelect?.addEventListener("change", renderCustomers);
resetCustomerFiltersBtn?.addEventListener("click", resetFilters);

loadCustomers();
