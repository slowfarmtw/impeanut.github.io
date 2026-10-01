// js/products.js
// 前台商品列表：直接讀 Supabase products，讓後台商品管理可以同步更新前台商品頁。

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

function getProductDisplayImage(product, image) {
  // 原味花生糖採用網站內已確認的產品形象照，不受後台舊 placeholder 影響。
  if (String(product?.name || "").includes("原味花生糖")) {
    return "images/products/peanut-candy-original-cutout.webp";
  }

  return getProductImageSrc(image);
}

function normalizeProduct(product) {
  const image = product.cover_image || product.image || "placeholder.png";
  const imageSrc = getProductDisplayImage(product, image);

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
    category: product.category || "",
    status: product.status || "",
    is_visible: product.is_visible
  };
}

function isProductVisible(product) {
  if (product.is_visible === false) return false;
  if (product.status === "archived" || product.status === "deleted") return false;
  return true;
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
    image_src: getProductDisplayImage(product, product.cover_image || product.image),
    weight: product.weight || ""
  };
}

function renderProductCard(product) {
  const imageSrc = product.image_src || getProductDisplayImage(product, product.cover_image || product.image);
  const productUrl = `product.html?id=${encodeURIComponent(product.id)}`;
  const subtitleParts = [
    product.subtitle,
    product.weight
  ].filter(Boolean);

  return `
    <article class="product-card">
      <a class="product-image-wrap" href="${productUrl}" aria-label="查看 ${escapeHtml(product.name)}">
        <img
          src="${escapeHtml(imageSrc)}"
          alt="${escapeHtml(product.name)}"
          onerror="this.onerror=null; this.src='images/products/placeholder.png';"
        >
      </a>

      <div class="product-card-body">
        <h2><a href="${productUrl}">${escapeHtml(product.name)}</a></h2>

        ${subtitleParts.length ? `<p class="product-subtitle">${escapeHtml(subtitleParts.join("｜"))}</p>` : ""}

        <p class="product-desc">${escapeHtml(product.description)}</p>

        <div class="product-card-bottom">
          <strong>${formatPrice(product.price)}</strong>
          <a href="${productUrl}" class="product-btn">查看商品</a>
        </div>
      </div>
    </article>
  `;
}

async function fetchProductsFromSupabase() {
  if (!window.supabaseClient) {
    throw new Error("Supabase 尚未設定，請確認 products.html 已載入 supabase-config.js");
  }

  const { data, error } = await window.supabaseClient
    .from("products")
    .select("id, sku, name, slug, category, subtitle, description, ingredients, weight, price, cost, stock, safety_stock, cover_image, status, is_featured, is_visible, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data || [])
    .map(normalizeProduct)
    .filter(isProductVisible);
}

async function loadProducts() {
  const container = document.getElementById("productList");

  if (!container) return;

  container.innerHTML = "<p>商品載入中...</p>";

  try {
    const products = await fetchProductsFromSupabase();

    if (!products.length) {
      container.innerHTML = "<p>目前尚無上架商品。</p>";
      return;
    }

    container.innerHTML = products.map(renderProductCard).join("");
  } catch (error) {
    console.error("商品載入失敗：", error);
    container.innerHTML = "<p>商品載入失敗，請稍後再試。</p>";
  }
}

function addProductToCart(product, quantity) {
  const cartProduct = getCartProductPayload(product);

  if (typeof peanutAddToCart === "function") {
    peanutAddToCart(cartProduct, quantity);
    return;
  }

  const cart = JSON.parse(localStorage.getItem("peanutCart")) || [];
  const existingItem = cart.find((item) => {
    return item.id === cartProduct.id || item.product_id === cartProduct.product_id;
  });

  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    cart.push({
      ...cartProduct,
      quantity
    });
  }

  localStorage.setItem("peanutCart", JSON.stringify(cart));
  alert("已加入購物車");
}

function setupProductListActions(products) {
  const productCards = document.querySelectorAll(".product-card");

  productCards.forEach((card) => {
    const minusBtn = card.querySelector(".list-qty-minus");
    const plusBtn = card.querySelector(".list-qty-plus");
    const qtyNumber = card.querySelector(".list-qty-number");
    const addBtn = card.querySelector(".product-add-btn");

    let quantity = 1;

    minusBtn?.addEventListener("click", () => {
      if (quantity <= 1) return;

      quantity -= 1;
      if (qtyNumber) qtyNumber.textContent = quantity;
    });

    plusBtn?.addEventListener("click", () => {
      quantity += 1;
      if (qtyNumber) qtyNumber.textContent = quantity;
    });

    addBtn?.addEventListener("click", function () {
      const productId = this.dataset.productId;
      const product = products.find((item) => item.id === productId || item.product_id === productId);

      if (!product) {
        alert("找不到商品資料，請重新整理後再試。");
        return;
      }

      addProductToCart(product, quantity);

      quantity = 1;
      if (qtyNumber) qtyNumber.textContent = quantity;
    });
  });
}

loadProducts();
