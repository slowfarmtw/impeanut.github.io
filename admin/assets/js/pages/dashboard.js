const PRODUCT_STORAGE_KEY = "brandOSProducts";

let annualTarget = 1000000;
let defaultLowStockThreshold = 20;
let currentRevenue = 0;
let dashboardOrders = [];
let dashboardProducts = [];

const quotes = [
  "今天的一包花生，可能就是一位客人第一次認識花生一生。",
  "品牌不是一天成功，而是每天都前進一點。",
  "每一次整理資料，都是在替未來的公司打地基。",
  "把流程做好，未來的團隊就能跑得更遠。",
  "精品品牌不是做給所有人，而是做到讓喜歡的人願意一直回來。"
];

function getFallbackProducts() {
  return JSON.parse(localStorage.getItem(PRODUCT_STORAGE_KEY)) || [];
}

function formatPrice(value) {
  return `NT$ ${Number(value || 0).toLocaleString()}`;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setProgress(id, value) {
  const el = document.getElementById(id);
  if (el) el.style.width = `${Math.max(0, Math.min(Number(value || 0), 100))}%`;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 11) return "早安，揚！";
  if (hour < 18) return "午安，揚！";
  return "晚上好，揚！";
}

function isOrderCancelled(order) {
  return (order.order_status || "new") === "cancelled";
}

function getRevenueOrders(orders) {
  return orders.filter((order) => {
    const paymentStatus = order.payment_status || "unpaid";
    return paymentStatus === "paid" && paymentStatus !== "refunded" && !isOrderCancelled(order);
  });
}

function calcDashboardMetrics(orders) {
  const activeOrders = orders.filter((order) => !isOrderCancelled(order));
  const revenueOrders = getRevenueOrders(orders);
  const revenue = revenueOrders.reduce((sum, order) => {
    return sum + Number(order.total_amount || 0);
  }, 0);

  const percent = annualTarget > 0
    ? Math.min(Number(((revenue / annualTarget) * 100).toFixed(1)), 100)
    : 0;

  const remain = Math.max(annualTarget - revenue, 0);

  return {
    revenue,
    percent,
    remain,
    paidOrderCount: revenueOrders.length,
    todayOrders: activeOrders.filter(isOrderCreatedToday),
    pendingPaymentCount: activeOrders.filter((order) => {
      return (order.payment_status || "unpaid") !== "paid";
    }).length,
    pendingShippingCount: activeOrders.filter((order) => {
      const paymentStatus = order.payment_status || "unpaid";
      const shippingStatus = order.shipping_status || "not_shipped";
      return paymentStatus === "paid" && shippingStatus !== "shipped" && shippingStatus !== "delivered";
    }).length,
    problemOrderCount: orders.filter((order) => {
      return order.order_status === "problem";
    }).length
  };
}

function isOrderCreatedToday(order) {
  const date = new Date(order.created_at);

  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function isProductVisible(product) {
  return product.is_visible !== false && product.status !== "archived" && product.status !== "deleted";
}

function isProductLive(product) {
  const status = product.status || "";
  return isProductVisible(product) && (status === "active" || status === "published" || status === "上架");
}

function isProductDraft(product) {
  const status = product.status || "";
  return status === "draft" || status === "草稿" || product.is_visible === false;
}

function hasProductCover(product) {
  return Boolean(product.cover_image || product.coverUrl);
}

function hasSeoData(product) {
  return Boolean(product.slug || product.subtitle || product.description);
}

function getProductSafetyStock(product) {
  return Number(product.safety_stock ?? defaultLowStockThreshold);
}
async function loadDashboardSettings() {
  if (!window.supabaseClient) {
    console.warn("Supabase 尚未設定，Dashboard 使用預設營運目標與低庫存門檻。");
    return;
  }

  const { data, error } = await window.supabaseClient
    .from("system_settings")
    .select("annual_revenue_target, low_stock_threshold")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Dashboard 讀取系統設定失敗：", error);
    return;
  }

  if (!data) return;

  annualTarget = Number(data.annual_revenue_target || 1000000);
  defaultLowStockThreshold = Number(data.low_stock_threshold ?? 20);
}


function renderHero(metrics = calcDashboardMetrics(dashboardOrders)) {
  const today = new Date().toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long"
  });

  currentRevenue = metrics.revenue;

  setText("todayText", today);
  setText("greetingText", getGreeting());
  setText("missionRevenue", formatPrice(metrics.revenue));
  setText("missionPercent", `${metrics.percent}%`);
  setText("yearRevenue", formatPrice(metrics.revenue));
  setText("goalPercent", `${metrics.percent}%`);
  setText("goalRemain", `距離年度目標還差 ${formatPrice(metrics.remain)}`);
  setProgress("goalBar", metrics.percent);
}

function calcHealth(products) {
  const total = products.length || 1;

  const productHealth = Math.round(
    (products.filter((product) => {
      return product.name && product.sku && product.category && Number(product.price || 0) > 0;
    }).length / total) * 100
  );

  const imageHealth = Math.round(
    (products.filter(hasProductCover).length / total) * 100
  );

  const seoHealth = Math.round(
    (products.filter(hasSeoData).length / total) * 100
  );

  const overall = Math.round((productHealth + imageHealth + seoHealth) / 3);

  return { productHealth, imageHealth, seoHealth, overall };
}

function renderKpis(products, metrics = calcDashboardMetrics(dashboardOrders)) {
  const liveProducts = products.filter(isProductLive);
  const featuredProducts = products.filter((product) => product.is_featured === true || product.featured === true);
  const lowStockProducts = products.filter((product) => {
    return Number(product.stock || 0) <= getProductSafetyStock(product);
  });

  setText("totalRevenue", formatPrice(metrics.revenue));
  setText("productCount", products.length);
  setText("liveProductCount", liveProducts.length);
  setText("featuredProductCount", featuredProducts.length);
  setText("lowStockCount", lowStockProducts.length);

  setText("todayOrderCount", metrics.todayOrders.length);
  setText("pendingPaymentCount", metrics.pendingPaymentCount);
  setText("pendingShippingCount", metrics.pendingShippingCount);
  setText("problemOrderCount", metrics.problemOrderCount);
}

function renderBrandBrief(products) {
  const lowStockProducts = products.filter((product) => {
    return Number(product.stock || 0) <= getProductSafetyStock(product);
  });
  const draftProducts = products.filter(isProductDraft);
  const noImageProducts = products.filter((product) => !hasProductCover(product));

  const items = [
    `目前 Brand OS 已建立 ${products.length} 件商品。`,
    lowStockProducts.length
      ? `有 ${lowStockProducts.length} 件商品庫存低於安全庫存，建議確認。`
      : "目前沒有低庫存商品。",
    draftProducts.length
      ? `有 ${draftProducts.length} 件商品仍是草稿或未顯示狀態。`
      : "所有商品狀態看起來都很穩定。",
    noImageProducts.length
      ? `有 ${noImageProducts.length} 件商品尚未上傳封面圖片。`
      : "所有商品都已經有封面圖片。"
  ];

  const list = document.getElementById("brandBriefList");
  if (list) list.innerHTML = items.map(item => `<li>${item}</li>`).join("");
}

function renderHealth(products) {
  const health = calcHealth(products);

  setText("brandHealthScore", `${health.overall}%`);
  setText("productHealthText", `${health.productHealth}%`);
  setText("imageHealthText", `${health.imageHealth}%`);
  setText("seoHealthText", `${health.seoHealth}%`);

  setProgress("productHealthBar", health.productHealth);
  setProgress("imageHealthBar", health.imageHealth);
  setProgress("seoHealthBar", health.seoHealth);
}

function renderTopProducts(products) {
  const sorted = [...products]
    .filter(isProductVisible)
    .sort((a, b) => {
      return new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0);
    })
    .slice(0, 5);

  const list = document.getElementById("topProductsList");
  if (!list) return;

  if (!sorted.length) {
    list.innerHTML = "<li>尚未建立商品。</li>";
    return;
  }

  list.innerHTML = sorted.map(product => `
    <li>
      <a href="pages/product-editor.html?id=${product.id}">
        ${product.name || "未命名商品"}
      </a>
      <span>｜庫存 ${Number(product.stock || 0)}｜${product.weight || "未填重量"}</span>
    </li>
  `).join("");
}

function renderLowStock(products) {
  const lowStockProducts = products
    .filter((product) => Number(product.stock || 0) <= getProductSafetyStock(product))
    .sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0));

  const list = document.getElementById("lowStockList");
  if (!list) return;

  if (!lowStockProducts.length) {
    list.innerHTML = "<li>目前沒有低庫存商品。</li>";
    return;
  }

  list.innerHTML = lowStockProducts.map(product => `
    <li>
      <strong>${product.name || "未命名商品"}</strong>
      剩下 ${Number(product.stock || 0)} 件
      <span>｜安全庫存 ${getProductSafetyStock(product)}</span>
    </li>
  `).join("");
}

function renderQuote() {
  const quote = quotes[new Date().getDate() % quotes.length];
  setText("dailyQuote", quote);
}

async function loadDashboardOrders() {
  if (!window.supabaseClient) {
    console.warn("Supabase 尚未設定，Dashboard 先使用 0 元累積營業額。提供 assets/js/services/supabase-config.js 後會自動讀取 orders。");
    return [];
  }

  const { data, error } = await window.supabaseClient
    .from("orders")
    .select("id, total_amount, payment_status, order_status, shipping_status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Dashboard 讀取訂單失敗：", error);
    return [];
  }

  return data || [];
}

async function loadDashboardProducts() {
  if (!window.supabaseClient) {
    console.warn("Supabase 尚未設定，Dashboard 商品資料先使用 localStorage fallback。");
    return getFallbackProducts();
  }

  const { data, error } = await window.supabaseClient
    .from("products")
    .select("id, sku, name, slug, category, subtitle, description, weight, price, cost, stock, safety_stock, cover_image, status, is_featured, is_visible, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Dashboard 讀取商品失敗：", error);
    return getFallbackProducts();
  }

  return data || [];
}

async function initDashboard() {
  await loadDashboardSettings();

  [dashboardOrders, dashboardProducts] = await Promise.all([
    loadDashboardOrders(),
    loadDashboardProducts()
  ]);

  const metrics = calcDashboardMetrics(dashboardOrders);

  renderHero(metrics);
  renderKpis(dashboardProducts, metrics);
  renderBrandBrief(dashboardProducts);
  renderHealth(dashboardProducts);
  renderTopProducts(dashboardProducts);
  renderLowStock(dashboardProducts);
  renderQuote();
}

initDashboard();
