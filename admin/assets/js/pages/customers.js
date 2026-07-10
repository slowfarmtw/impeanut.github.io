// admin/assets/js/pages/customers.js
// 顧客管理頁：從 Supabase orders 表整理顧客資料，顯示回購、累積消費、需關注顧客，並支援搜尋、篩選、排序與 CSV 匯出。

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

function getCustomerKey(order) {
  const phone = String(order.customer_phone || order.shipping_phone || "").trim();
  const email = String(order.customer_email || "").trim().toLowerCase();
  const name = String(order.customer_name || order.shipping_name || "未命名顧客").trim();

  if (phone) return `phone:${phone}`;
  if (email) return `email:${email}`;
  return `name:${name}`;
}

function isRevenueOrder(order) {
  const paymentStatus = order.payment_status || "unpaid";
  const orderStatus = order.order_status || "new";

  return paymentStatus === "paid" && orderStatus !== "cancelled" && paymentStatus !== "refunded";
}

function buildCustomersFromOrders(orders) {
  const customerMap = new Map();

  orders.forEach((order) => {
    const key = getCustomerKey(order);
    const name = order.customer_name || order.shipping_name || "未命名顧客";
    const phone = order.customer_phone || order.shipping_phone || "";
    const email = order.customer_email || "";
    const createdAt = order.created_at || "";
    const currentRevenue = isRevenueOrder(order) ? Number(order.total_amount || 0) : 0;
    const isProblem = order.order_status === "problem";

    if (!customerMap.has(key)) {
      customerMap.set(key, {
        key,
        name,
        phone,
        email,
        orderCount: 0,
        revenue: 0,
        latestOrderAt: createdAt,
        latestOrderId: order.id,
        hasProblemOrder: false,
        orders: []
      });
    }

    const customer = customerMap.get(key);
    customer.orderCount += 1;
    customer.revenue += currentRevenue;
    customer.hasProblemOrder = customer.hasProblemOrder || isProblem;
    customer.orders.push(order);

    const latestDate = new Date(customer.latestOrderAt);
    const currentDate = new Date(createdAt);

    if (!customer.latestOrderAt || currentDate > latestDate) {
      customer.latestOrderAt = createdAt;
      customer.latestOrderId = order.id;
    }

    if (!customer.name || customer.name === "未命名顧客") customer.name = name;
    if (!customer.phone && phone) customer.phone = phone;
    if (!customer.email && email) customer.email = email;
  });

  return Array.from(customerMap.values());
}

function getCustomerTag(customer) {
  if (customer.hasProblemOrder) return { label: "需關注", className: "problem" };
  if (customer.revenue >= 3000 || customer.orderCount >= 3) return { label: "高價值", className: "vip" };
  if (customer.orderCount > 1) return { label: "回購", className: "vip" };
  return { label: "一般", className: "" };
}

function getFilteredCustomers() {
  const keyword = (customerSearchInput?.value || "").trim().toLowerCase();
  const type = customerTypeFilter?.value || "all";
  const sort = customerSortSelect?.value || "latest";

  let customers = allCustomers.filter((customer) => {
    const searchText = [customer.name, customer.phone, customer.email]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchKeyword = keyword ? searchText.includes(keyword) : true;

    let matchType = true;
    if (type === "repeat") matchType = customer.orderCount > 1;
    if (type === "vip") matchType = customer.revenue >= 3000 || customer.orderCount >= 3;
    if (type === "problem") matchType = customer.hasProblemOrder;

    return matchKeyword && matchType;
  });

  customers = [...customers].sort((a, b) => {
    if (sort === "revenue") return b.revenue - a.revenue;
    if (sort === "orders") return b.orderCount - a.orderCount;
    return new Date(b.latestOrderAt) - new Date(a.latestOrderAt);
  });

  return customers;
}

function renderSummary(customers) {
  const repeatCount = customers.filter((customer) => customer.orderCount > 1).length;
  const problemCount = customers.filter((customer) => customer.hasProblemOrder).length;
  const revenue = customers.reduce((sum, customer) => sum + Number(customer.revenue || 0), 0);

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
    customersTableBody.innerHTML = `
      <tr>
        <td colspan="8">${getEmptyText()}</td>
      </tr>
    `;
    return;
  }

  customersTableBody.innerHTML = customers.map((customer) => {
    const tag = getCustomerTag(customer);

    return `
      <tr>
        <td><strong class="customer-name">${escapeHtml(customer.name || "-")}</strong></td>
        <td>${escapeHtml(customer.phone || "-")}</td>
        <td>${escapeHtml(customer.email || "-")}</td>
        <td>${customer.orderCount}</td>
        <td>${formatPrice(customer.revenue)}</td>
        <td>${formatDateTime(customer.latestOrderAt)}</td>
        <td><span class="customer-tag ${tag.className}">${tag.label}</span></td>
        <td>
          <button
            type="button"
            class="customer-action-btn"
            data-action="view-orders"
            data-key="${escapeHtml(customer.key)}"
          >
            查看訂單
          </button>
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
            <p class="customer-mobile-phone">${escapeHtml(customer.phone || "-")}</p>
            <p class="customer-mobile-email">${escapeHtml(customer.email || "-")}</p>
          </div>

          <div class="customer-mobile-total">${formatPrice(customer.revenue)}</div>
        </div>

        <div class="customer-mobile-grid">
          <div class="customer-mobile-item">
            <span>訂單數</span>
            <strong>${customer.orderCount}</strong>
          </div>

          <div class="customer-mobile-item">
            <span>最近下單</span>
            <strong>${formatDateTime(customer.latestOrderAt)}</strong>
          </div>

          <div class="customer-mobile-item">
            <span>狀態</span>
            <strong>${tag.label}</strong>
          </div>
        </div>

        <button
          type="button"
          class="customer-action-btn"
          data-action="view-orders"
          data-key="${escapeHtml(customer.key)}"
        >
          查看訂單
        </button>
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

  if (customers.length === allCustomers.length) {
    customersStatusText.textContent = `共 ${customers.length} 位顧客`;
  } else {
    customersStatusText.textContent = `共 ${allCustomers.length} 位顧客，篩選後 ${customers.length} 位`;
  }
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
  const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
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
      電話: customer.phone || "",
      Email: customer.email || "",
      訂單數: customer.orderCount,
      累積消費: customer.revenue,
      最近下單: formatDateTime(customer.latestOrderAt),
      顧客狀態: tag.label,
      是否有問題訂單: customer.hasProblemOrder ? "是" : "否"
    };
  });

  const csvContent = convertRowsToCsv(rows);
  downloadCsv(`花生一生_顧客列表_${getTodayDateString()}.csv`, csvContent);

  if (customersStatusText) {
    customersStatusText.textContent = `已匯出 ${customers.length} 位顧客`;
  }
}

function resetFilters() {
  if (customerSearchInput) customerSearchInput.value = "";
  if (customerTypeFilter) customerTypeFilter.value = "all";
  if (customerSortSelect) customerSortSelect.value = "latest";

  renderCustomers();
}

function viewCustomerOrders(customerKey) {
  const customer = allCustomers.find((item) => item.key === customerKey);
  if (!customer || !customer.orders.length) return;

  const latestOrder = customer.orders
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

  window.location.href = `order-detail.html?id=${encodeURIComponent(latestOrder.id)}`;
}

function showSupabaseNotConfigured() {
  if (customersStatusText) customersStatusText.textContent = "Supabase 尚未設定";

  if (customersTableBody) {
    customersTableBody.innerHTML = `
      <tr>
        <td colspan="8">請先設定 admin/assets/js/services/supabase-config.js。</td>
      </tr>
    `;
  }

  if (customersMobileList) {
    customersMobileList.innerHTML = `<p class="customers-empty-text">請先設定 Supabase。</p>`;
  }
}

function showLoadError() {
  if (customersStatusText) customersStatusText.textContent = "讀取失敗";

  if (customersTableBody) {
    customersTableBody.innerHTML = `
      <tr>
        <td colspan="8">顧客資料讀取失敗，請檢查 Supabase orders 資料表。</td>
      </tr>
    `;
  }

  if (customersMobileList) {
    customersMobileList.innerHTML = `<p class="customers-empty-text">顧客資料讀取失敗。</p>`;
  }
}

async function loadCustomers() {
  if (!window.supabaseClient) {
    showSupabaseNotConfigured();
    return;
  }

  if (customersStatusText) customersStatusText.textContent = "讀取顧客資料中...";

  const { data, error } = await window.supabaseClient
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("讀取顧客資料失敗：", error);
    showLoadError();
    return;
  }

  allCustomers = buildCustomersFromOrders(data || []);
  renderCustomers();
}

refreshCustomersBtn?.addEventListener("click", loadCustomers);
exportCustomersBtn?.addEventListener("click", exportCustomers);
customerSearchInput?.addEventListener("input", renderCustomers);
customerTypeFilter?.addEventListener("change", renderCustomers);
customerSortSelect?.addEventListener("change", renderCustomers);
resetCustomerFiltersBtn?.addEventListener("click", resetFilters);

customersTableBody?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action='view-orders']");
  if (!button) return;

  viewCustomerOrders(button.dataset.key);
});

customersMobileList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action='view-orders']");
  if (!button) return;

  viewCustomerOrders(button.dataset.key);
});

loadCustomers();
