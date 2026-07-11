

(function () {
  const supabase = window.supabaseClient;

  const elements = {
    period: document.getElementById("analyticsPeriod"),
    refreshButton: document.getElementById("refreshAnalyticsButton"),
    status: document.getElementById("analyticsStatus"),
    revenue: document.getElementById("analyticsRevenue"),
    revenueCompare: document.getElementById("analyticsRevenueCompare"),
    orders: document.getElementById("analyticsOrders"),
    ordersCompare: document.getElementById("analyticsOrdersCompare"),
    averageOrderValue: document.getElementById("analyticsAverageOrderValue"),
    averageOrderCompare: document.getElementById("analyticsAverageOrderCompare"),
    newCustomers: document.getElementById("analyticsNewCustomers"),
    newCustomersCompare: document.getElementById("analyticsNewCustomersCompare"),
    revenueTrendChart: document.getElementById("revenueTrendChart"),
    orderStatusSummary: document.getElementById("orderStatusSummary"),
    topProductsTableBody: document.getElementById("topProductsTableBody"),
    customerCount: document.getElementById("analyticsCustomerCount"),
    repeatCustomers: document.getElementById("analyticsRepeatCustomers"),
    repeatRate: document.getElementById("analyticsRepeatRate"),
    topCustomer: document.getElementById("analyticsTopCustomer"),
    paymentMethodSummary: document.getElementById("paymentMethodSummary"),
    deliveryMethodSummary: document.getElementById("deliveryMethodSummary")
  };

  const cancelledStatuses = new Set(["cancelled", "canceled", "已取消"]);

  function formatCurrency(value) {
    return `NT$ ${Math.round(Number(value || 0)).toLocaleString("zh-TW")}`;
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString("zh-TW");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getOrderDate(order) {
    return new Date(order.created_at || order.order_date || 0);
  }

  function getOrderTotal(order) {
    return Number(order.total || order.total_amount || order.grand_total || 0);
  }

  function getOrderStatus(order) {
    return String(order.order_status || order.status || "未設定").trim();
  }

  function isValidOrder(order) {
    return !cancelledStatuses.has(getOrderStatus(order).toLowerCase());
  }

  function getCustomerKey(order) {
    return String(
      order.customer_email ||
        order.email ||
        order.customer_phone ||
        order.phone ||
        order.customer_name ||
        order.name ||
        ""
    )
      .trim()
      .toLowerCase();
  }

  function getCustomerName(order) {
    return (
      order.customer_name ||
      order.name ||
      order.customer_email ||
      order.email ||
      order.customer_phone ||
      order.phone ||
      "未命名顧客"
    );
  }

  function getPaymentMethod(order) {
    return String(order.payment_method || order.payment_type || "未設定").trim();
  }

  function getDeliveryMethod(order) {
    return String(order.delivery_method || order.shipping_method || "未設定").trim();
  }

  function getDateRange(periodValue) {
    const now = new Date();
    const end = new Date(now);

    if (periodValue === "all") {
      return {
        currentStart: null,
        currentEnd: end,
        previousStart: null,
        previousEnd: null
      };
    }

    const days = Number(periodValue || 30);
    const currentStart = new Date(now);
    currentStart.setHours(0, 0, 0, 0);
    currentStart.setDate(currentStart.getDate() - days + 1);

    const previousEnd = new Date(currentStart);
    previousEnd.setMilliseconds(-1);

    const previousStart = new Date(currentStart);
    previousStart.setDate(previousStart.getDate() - days);

    return {
      currentStart,
      currentEnd: end,
      previousStart,
      previousEnd
    };
  }

  function filterByRange(orders, start, end) {
    if (!start) return [...orders];

    return orders.filter((order) => {
      const date = getOrderDate(order);
      return date >= start && date <= end;
    });
  }

  function summarizeOrders(orders) {
    const validOrders = orders.filter(isValidOrder);
    const revenue = validOrders.reduce((sum, order) => sum + getOrderTotal(order), 0);
    const orderCount = validOrders.length;
    const averageOrderValue = orderCount ? revenue / orderCount : 0;

    const customers = new Map();
    validOrders.forEach((order) => {
      const key = getCustomerKey(order);
      if (!key) return;

      if (!customers.has(key)) {
        customers.set(key, {
          name: getCustomerName(order),
          orders: 0,
          revenue: 0
        });
      }

      const customer = customers.get(key);
      customer.orders += 1;
      customer.revenue += getOrderTotal(order);
    });

    return {
      validOrders,
      revenue,
      orderCount,
      averageOrderValue,
      customers
    };
  }

  function setCompare(element, currentValue, previousValue, formatter = formatNumber) {
    element.classList.remove("is-positive", "is-negative");

    if (!Number.isFinite(previousValue) || previousValue === 0) {
      element.textContent = previousValue === 0 && currentValue > 0
        ? `較前期增加 ${formatter(currentValue)}`
        : "較前期 —";

      if (currentValue > 0) element.classList.add("is-positive");
      return;
    }

    const difference = currentValue - previousValue;
    const percentage = (difference / previousValue) * 100;
    const direction = percentage >= 0 ? "增加" : "減少";

    element.textContent = `較前期${direction} ${Math.abs(percentage).toFixed(1)}%`;
    element.classList.add(percentage >= 0 ? "is-positive" : "is-negative");
  }

  function renderKpis(currentSummary, previousSummary, newCustomerCount, previousNewCustomerCount, compareEnabled) {
    elements.revenue.textContent = formatCurrency(currentSummary.revenue);
    elements.orders.textContent = formatNumber(currentSummary.orderCount);
    elements.averageOrderValue.textContent = formatCurrency(currentSummary.averageOrderValue);
    elements.newCustomers.textContent = formatNumber(newCustomerCount);

    if (!compareEnabled) {
      [
        elements.revenueCompare,
        elements.ordersCompare,
        elements.averageOrderCompare,
        elements.newCustomersCompare
      ].forEach((element) => {
        element.textContent = "全部期間";
        element.classList.remove("is-positive", "is-negative");
      });
      return;
    }

    setCompare(elements.revenueCompare, currentSummary.revenue, previousSummary.revenue, formatCurrency);
    setCompare(elements.ordersCompare, currentSummary.orderCount, previousSummary.orderCount);
    setCompare(
      elements.averageOrderCompare,
      currentSummary.averageOrderValue,
      previousSummary.averageOrderValue,
      formatCurrency
    );
    setCompare(elements.newCustomersCompare, newCustomerCount, previousNewCustomerCount);
  }

  function renderTrend(orders, periodValue) {
    if (!orders.length) {
      elements.revenueTrendChart.innerHTML = '<p class="analytics-empty">尚無趨勢資料。</p>';
      return;
    }

    const grouped = new Map();
    orders.filter(isValidOrder).forEach((order) => {
      const date = getOrderDate(order);
      if (Number.isNaN(date.getTime())) return;

      const key = date.toISOString().slice(0, 10);
      if (!grouped.has(key)) grouped.set(key, { revenue: 0, orders: 0 });

      const item = grouped.get(key);
      item.revenue += getOrderTotal(order);
      item.orders += 1;
    });

    let points = [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date, ...value }));

    if (periodValue === "365" || (periodValue === "all" && points.length > 90)) {
      const monthly = new Map();
      points.forEach((point) => {
        const key = point.date.slice(0, 7);
        if (!monthly.has(key)) monthly.set(key, { revenue: 0, orders: 0 });
        const item = monthly.get(key);
        item.revenue += point.revenue;
        item.orders += point.orders;
      });

      points = [...monthly.entries()].map(([date, value]) => ({ date, ...value }));
    }

    if (!points.length) {
      elements.revenueTrendChart.innerHTML = '<p class="analytics-empty">尚無趨勢資料。</p>';
      return;
    }

    const width = Math.max(620, points.length * 58);
    const height = 300;
    const padding = { top: 24, right: 24, bottom: 48, left: 62 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const maxRevenue = Math.max(...points.map((point) => point.revenue), 1);
    const xStep = points.length === 1 ? 0 : chartWidth / (points.length - 1);

    const coordinates = points.map((point, index) => {
      const x = padding.left + index * xStep;
      const y = padding.top + chartHeight - (point.revenue / maxRevenue) * chartHeight;
      return { ...point, x, y };
    });

    const linePath = coordinates
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");

    const areaPath = `${linePath} L ${coordinates.at(-1).x} ${padding.top + chartHeight} L ${coordinates[0].x} ${padding.top + chartHeight} Z`;

    const gridLines = [0, 0.25, 0.5, 0.75, 1]
      .map((ratio) => {
        const y = padding.top + chartHeight - ratio * chartHeight;
        const label = formatCurrency(maxRevenue * ratio).replace("NT$ ", "");
        return `
          <line class="analytics-chart-grid-line" x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}"></line>
          <text class="analytics-chart-label" x="${padding.left - 10}" y="${y + 4}" text-anchor="end">${label}</text>
        `;
      })
      .join("");

    const labelInterval = Math.max(1, Math.ceil(points.length / 8));
    const labels = coordinates
      .map((point, index) => {
        if (index % labelInterval !== 0 && index !== coordinates.length - 1) return "";
        const label = point.date.length === 7 ? point.date.replace("-", "/") : point.date.slice(5).replace("-", "/");
        return `<text class="analytics-chart-label" x="${point.x}" y="${height - 16}" text-anchor="middle">${label}</text>`;
      })
      .join("");

    const dots = coordinates
      .map((point) => `
        <circle class="analytics-chart-point" cx="${point.x}" cy="${point.y}" r="5">
          <title>${point.date}｜${formatCurrency(point.revenue)}｜${point.orders} 筆訂單</title>
        </circle>
      `)
      .join("");

    elements.revenueTrendChart.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" aria-hidden="true">
        ${gridLines}
        <path class="analytics-chart-area" d="${areaPath}"></path>
        <path class="analytics-chart-line" d="${linePath}"></path>
        ${dots}
        ${labels}
      </svg>
    `;
  }

  function renderOrderStatuses(orders) {
    const counts = new Map();
    orders.forEach((order) => {
      const status = getOrderStatus(order);
      counts.set(status, (counts.get(status) || 0) + 1);
    });

    if (!counts.size) {
      elements.orderStatusSummary.innerHTML = '<p class="analytics-empty">尚無訂單狀態資料。</p>';
      return;
    }

    elements.orderStatusSummary.innerHTML = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([status, count]) => `
        <div class="analytics-status-item">
          <div class="analytics-status-row">
            <span class="analytics-status-name">${escapeHtml(status)}</span>
            <span class="analytics-status-count">${formatNumber(count)} 筆</span>
          </div>
        </div>
      `)
      .join("");
  }

  function renderProgressSummary(container, values) {
    const counts = new Map();
    values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));

    if (!counts.size) {
      container.innerHTML = '<p class="analytics-empty">尚無資料。</p>';
      return;
    }

    const maxCount = Math.max(...counts.values(), 1);
    container.innerHTML = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => {
        const percentage = (count / maxCount) * 100;
        return `
          <div class="analytics-progress-item">
            <div class="analytics-progress-row">
              <span class="analytics-progress-name">${escapeHtml(name)}</span>
              <span class="analytics-progress-count">${formatNumber(count)} 筆</span>
            </div>
            <div class="analytics-progress-track" aria-hidden="true">
              <div class="analytics-progress-bar" style="width: ${percentage}%"></div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function renderCustomers(summary) {
    const customers = [...summary.customers.values()];
    const repeatCustomers = customers.filter((customer) => customer.orders > 1);
    const repeatRate = customers.length ? (repeatCustomers.length / customers.length) * 100 : 0;
    const topCustomer = customers.sort((a, b) => b.revenue - a.revenue)[0];

    elements.customerCount.textContent = formatNumber(customers.length);
    elements.repeatCustomers.textContent = formatNumber(repeatCustomers.length);
    elements.repeatRate.textContent = `${repeatRate.toFixed(1)}%`;
    elements.topCustomer.textContent = topCustomer
      ? `${topCustomer.name}｜${formatCurrency(topCustomer.revenue)}`
      : "—";
  }

  function renderTopProducts(orderItems, validOrderIds) {
    const products = new Map();

    orderItems
      .filter((item) => validOrderIds.has(String(item.order_id)))
      .forEach((item) => {
        const key = String(item.product_id || item.sku || item.product_name || item.name || "unknown");
        const name = item.product_name || item.name || "未命名商品";
        const quantity = Math.max(1, Number(item.quantity || 1));
        const unitPrice = Number(item.unit_price || item.price || 0);
        const subtotal = Number(item.subtotal || item.line_total || unitPrice * quantity);

        if (!products.has(key)) {
          products.set(key, { name, quantity: 0, revenue: 0 });
        }

        const product = products.get(key);
        product.quantity += quantity;
        product.revenue += subtotal;
      });

    const rows = [...products.values()]
      .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
      .slice(0, 10);

    if (!rows.length) {
      elements.topProductsTableBody.innerHTML = `
        <tr>
          <td colspan="3" class="analytics-empty-cell">尚無商品銷售資料。</td>
        </tr>
      `;
      return;
    }

    elements.topProductsTableBody.innerHTML = rows
      .map((product) => `
        <tr>
          <td>${escapeHtml(product.name)}</td>
          <td>${formatNumber(product.quantity)}</td>
          <td>${formatCurrency(product.revenue)}</td>
        </tr>
      `)
      .join("");
  }

  function calculateNewCustomers(allOrders, currentOrders, currentStart, currentEnd) {
    const firstOrderByCustomer = new Map();

    allOrders
      .filter(isValidOrder)
      .forEach((order) => {
        const key = getCustomerKey(order);
        if (!key) return;

        const date = getOrderDate(order);
        const current = firstOrderByCustomer.get(key);
        if (!current || date < current) firstOrderByCustomer.set(key, date);
      });

    const currentKeys = new Set(currentOrders.map(getCustomerKey).filter(Boolean));
    let count = 0;

    currentKeys.forEach((key) => {
      const firstOrderDate = firstOrderByCustomer.get(key);
      if (!firstOrderDate) return;

      if (!currentStart || (firstOrderDate >= currentStart && firstOrderDate <= currentEnd)) {
        count += 1;
      }
    });

    return count;
  }

  function setStatus(message, type = "") {
    elements.status.textContent = message;
    elements.status.classList.remove("is-success", "is-error");
    if (type) elements.status.classList.add(type);
  }

  async function fetchAnalyticsData() {
    const [ordersResult, itemsResult] = await Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: true }),
      supabase.from("order_items").select("*")
    ]);

    if (ordersResult.error) throw ordersResult.error;
    if (itemsResult.error) throw itemsResult.error;

    return {
      orders: ordersResult.data || [],
      orderItems: itemsResult.data || []
    };
  }

  async function loadAnalytics() {
    if (!supabase) {
      setStatus("Supabase 尚未載入，無法讀取品牌分析資料。", "is-error");
      return;
    }

    elements.refreshButton.disabled = true;
    elements.refreshButton.textContent = "更新中…";
    setStatus("正在讀取品牌數據…");

    try {
      const { orders, orderItems } = await fetchAnalyticsData();
      const periodValue = elements.period.value;
      const range = getDateRange(periodValue);
      const currentOrders = filterByRange(orders, range.currentStart, range.currentEnd);
      const previousOrders = range.previousStart
        ? filterByRange(orders, range.previousStart, range.previousEnd)
        : [];

      const currentSummary = summarizeOrders(currentOrders);
      const previousSummary = summarizeOrders(previousOrders);
      const currentNewCustomers = calculateNewCustomers(
        orders,
        currentSummary.validOrders,
        range.currentStart,
        range.currentEnd
      );
      const previousNewCustomers = range.previousStart
        ? calculateNewCustomers(
            orders,
            previousSummary.validOrders,
            range.previousStart,
            range.previousEnd
          )
        : 0;

      renderKpis(
        currentSummary,
        previousSummary,
        currentNewCustomers,
        previousNewCustomers,
        Boolean(range.previousStart)
      );
      renderTrend(currentOrders, periodValue);
      renderOrderStatuses(currentOrders);
      renderCustomers(currentSummary);
      renderProgressSummary(
        elements.paymentMethodSummary,
        currentSummary.validOrders.map(getPaymentMethod)
      );
      renderProgressSummary(
        elements.deliveryMethodSummary,
        currentSummary.validOrders.map(getDeliveryMethod)
      );

      const validOrderIds = new Set(
        currentSummary.validOrders.map((order) => String(order.id))
      );
      renderTopProducts(orderItems, validOrderIds);

      const updatedTime = new Intl.DateTimeFormat("zh-TW", {
        hour: "2-digit",
        minute: "2-digit"
      }).format(new Date());

      setStatus(`品牌數據已更新｜${updatedTime}`, "is-success");
    } catch (error) {
      console.error("品牌分析資料載入失敗：", error);
      setStatus(`品牌分析資料載入失敗：${error.message || "請稍後再試。"}`, "is-error");
    } finally {
      elements.refreshButton.disabled = false;
      elements.refreshButton.textContent = "更新數據";
    }
  }

  elements.period?.addEventListener("change", loadAnalytics);
  elements.refreshButton?.addEventListener("click", loadAnalytics);

  loadAnalytics();
})();