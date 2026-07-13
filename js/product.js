const productDetail = document.getElementById("productDetail");

function getProductIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
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

function getProductImageSrc(image) {
  if (!image) return "images/products/placeholder.png";

  const imageText = String(image).trim();

  if (imageText.startsWith("http://") || imageText.startsWith("https://")) {
    return imageText;
  }

  if (imageText.startsWith("images/")) {
    return imageText;
  }

  if (imageText.startsWith("/")) {
    return imageText;
  }

  return `images/${imageText}`;
}

function normalizeProduct(product) {
  const image = product.cover_image || product.image || "placeholder.png";
  const imageSrc = getProductImageSrc(image);

  return {
    ...product,
    id: product.id,
    product_id: product.id,
    name: product.name || "未命名商品",
    product_name: product.name || "未命名商品",
    sku: product.sku || "",
    price: Number(product.price || 0),
    image,
    image_src: imageSrc,
    cover_image: image,
    weight: product.weight || "",
    subtitle: product.subtitle || "",
    description: product.description || "",
    ingredients: product.ingredients || "",
    category: product.category || "",
    status: product.status || "",
    is_visible: product.is_visible
  };
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function isProductVisible(product) {
  if (!product) return false;
  if (product.is_visible === false) return false;
  if (product.status === "archived" || product.status === "deleted") return false;
  return true;
}

function renderList(items) {
  if (!items) return "<p>內容整理中。</p>";

  if (Array.isArray(items)) {
    if (items.length === 0) return "<p>內容整理中。</p>";
    return `
      <ul>
        ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    `;
  }

  const text = String(items).trim();
  if (!text) return "<p>內容整理中。</p>";

  const lines = text
    .split(/\n|、|，/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (!lines.length) return `<p>${escapeHtml(text)}</p>`;

  return `
    <ul>
      ${lines.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
    </ul>
  `;
}

function getCartProductPayload(product) {
  return {
    id: product.id,
    product_id: product.id,
    name: product.name,
    product_name: product.name,
    sku: product.sku || "",
    price: Number(product.price || 0),
    image: product.cover_image || product.image || "placeholder.png",
    image_src: product.image_src || getProductImageSrc(product.cover_image || product.image),
    cover_image: product.cover_image || product.image || "",
    weight: product.weight || ""
  };
}

function trackProductView(product) {
  const eventParams = {
    currency: "TWD",
    value: Number(product.price || 0),
    items: [
      {
        item_id: product.sku || String(product.id || ""),
        item_name: product.name || "未命名商品",
        item_category: product.category || "未分類",
        price: Number(product.price || 0),
        quantity: 1
      }
    ]
  };

  let attempts = 0;
  const maxAttempts = 20;

  const sendViewItem = function () {
    attempts += 1;

    if (window.peanutAnalytics?.track) {
      window.peanutAnalytics.track("view_item", eventParams);
      return;
    }

    if (attempts < maxAttempts) {
      window.setTimeout(sendViewItem, 250);
    } else {
      console.warn("GA4 尚未就緒，view_item 事件未送出。");
    }
  };

  sendViewItem();
}

function trackAddToCart(product, quantity) {
  const safeQuantity = Math.max(1, Number(quantity || 1));
  const unitPrice = Number(product.price || 0);
  const eventParams = {
    currency: "TWD",
    value: unitPrice * safeQuantity,
    items: [
      {
        item_id: product.sku || String(product.id || ""),
        item_name: product.name || "未命名商品",
        item_category: product.category || "未分類",
        price: unitPrice,
        quantity: safeQuantity
      }
    ]
  };

  let attempts = 0;
  const maxAttempts = 20;

  const sendAddToCart = function () {
    attempts += 1;

    if (window.peanutAnalytics?.track) {
      window.peanutAnalytics.track("add_to_cart", eventParams);
      return;
    }

    if (attempts < maxAttempts) {
      window.setTimeout(sendAddToCart, 250);
    } else {
      console.warn("GA4 尚未就緒，add_to_cart 事件未送出。");
    }
  };

  sendAddToCart();
}

async function fetchProductFromSupabase(productId) {
  if (!window.supabaseClient) {
    throw new Error("Supabase 尚未設定，請確認 product.html 已載入 supabase-config.js");
  }

  let query = window.supabaseClient
    .from("products")
    .select("id, sku, name, slug, category, subtitle, description, ingredients, weight, price, cost, stock, safety_stock, cover_image, status, is_featured, is_visible, created_at, updated_at")
    .limit(1);

  if (isUuid(productId)) {
    query = query.eq("id", productId);
  } else {
    query = query.or(`sku.eq.${productId},slug.eq.${productId}`);
  }

  const { data, error } = await query;

  if (error) throw error;

  const product = data?.[0];
  if (!product || !isProductVisible(product)) return null;

  return normalizeProduct(product);
}

function renderProductNotFound() {
  productDetail.innerHTML = `
    <section class="section">
      <div class="empty-cart">
        <h2>找不到商品</h2>
        <p>這個商品可能已下架或連結有誤。</p>
        <a href="products.html" class="primary-link-btn">回產品介紹</a>
      </div>
    </section>
  `;
}

function renderProductDetailContent(product) {
  const imageSrc = product.image_src || getProductImageSrc(product.cover_image || product.image);
  const subtitleParts = [product.subtitle, product.weight].filter(Boolean);
  const introText = product.description || "內容整理中。";

  productDetail.innerHTML = `
    <section class="product-detail-page">
      <div class="product-top-card">
        <div class="product-top-image">
          <img
            src="${escapeHtml(imageSrc)}"
            alt="${escapeHtml(product.name)}"
            onerror="this.onerror=null; this.src='images/products/placeholder.png';"
          >
        </div>

        <div class="product-top-info">
          <p class="section-label">商品資訊</p>
          <h1>${escapeHtml(product.name)}</h1>
          <p class="product-detail-subtitle">${escapeHtml(subtitleParts.join("｜"))}</p>

          <p class="product-detail-desc">
            ${escapeHtml(product.description || "")}
          </p>

          <p class="product-detail-price">${formatPrice(product.price)}</p>

          <div class="quantity-control">
            <button type="button" id="qtyMinus">−</button>
            <span id="qtyNumber">1</span>
            <button type="button" id="qtyPlus">＋</button>
          </div>

          <button type="button" class="add-cart-btn" id="addToCartBtn">
            加入購物車
          </button>
        </div>
      </div>

      <div class="product-info-panel">
        <section class="product-info-section">
          <h2>產品介紹</h2>
          <p>${escapeHtml(introText)}</p>
        </section>

        <section class="product-info-section">
          <h2>主要成分</h2>
          <p>${escapeHtml(product.ingredients || "內容整理中。")}</p>
        </section>

        <section class="product-info-section">
          <h2>風味特色</h2>
          ${renderList(product.subtitle)}
        </section>

        <section class="product-info-section">
          <h2>規格資訊</h2>
          <ul class="product-spec-list">
            <li>品名：${escapeHtml(product.name)}</li>
            <li>分類：${escapeHtml(product.category || "未分類")}</li>
            <li>規格：${escapeHtml(product.weight || "依包裝標示")}</li>
            <li>售價：${formatPrice(product.price)}</li>
          </ul>
        </section>
      </div>
    </section>
  `;

  setupProductQuantity(product);
}

async function renderProductDetail() {
  if (!productDetail) return;

  const productId = getProductIdFromUrl();

  if (!productId) {
    renderProductNotFound();
    return;
  }

  productDetail.innerHTML = `<p class="loading-text">商品載入中...</p>`;

  try {
    const product = await fetchProductFromSupabase(productId);

    if (!product) {
      renderProductNotFound();
      return;
    }

    renderProductDetailContent(product);
    trackProductView(product);
  } catch (error) {
    console.error("商品詳情載入失敗：", error);
    productDetail.innerHTML = `
      <section class="section">
        <div class="empty-cart">
          <h2>商品載入失敗</h2>
          <p>請稍後重新整理頁面，或回產品介紹重新進入。</p>
          <a href="products.html" class="primary-link-btn">回產品介紹</a>
        </div>
      </section>
    `;
  }
}

function setupProductQuantity(product) {
  let quantity = 1;

  const minusBtn = document.getElementById("qtyMinus");
  const plusBtn = document.getElementById("qtyPlus");
  const qtyNumber = document.getElementById("qtyNumber");
  const addBtn = document.getElementById("addToCartBtn");

  minusBtn?.addEventListener("click", function () {
    if (quantity > 1) {
      quantity -= 1;
      qtyNumber.textContent = quantity;
    }
  });

  plusBtn?.addEventListener("click", function () {
    quantity += 1;
    qtyNumber.textContent = quantity;
  });

  addBtn?.addEventListener("click", function () {
    const cartProduct = getCartProductPayload(product);

    if (typeof peanutAddToCart === "function") {
      peanutAddToCart(cartProduct, quantity);
    } else {
      const cart = JSON.parse(localStorage.getItem("peanutCart")) || [];
      const existingItem = cart.find((item) => {
        return item.id === cartProduct.id || item.product_id === cartProduct.product_id;
      });

      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        cart.push({
          ...cartProduct,
          quantity: quantity
        });
      }

      localStorage.setItem("peanutCart", JSON.stringify(cart));
      window.dispatchEvent(new Event("peanutCartUpdated"));
      alert("已加入購物車");
    }

    trackAddToCart(product, quantity);

    quantity = 1;
    qtyNumber.textContent = quantity;
  });
}

renderProductDetail();
