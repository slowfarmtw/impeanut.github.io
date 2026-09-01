function getCartItemImageSrc(image) {
  if (!image) return "images/placeholder.png";

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

function getCartProductImageSource(item) {
  return item.image_src || getCartItemImageSrc(item.cover_image || item.image);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem("peanutCart") || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("購物車資料格式不正確，已忽略損壞資料。", error);
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem("peanutCart", JSON.stringify(cart));
}

function formatPrice(price) {
  return `NT$ ${Number(price).toLocaleString()}`;
}

function renderCart() {
  const container = document.getElementById("cartContent");

  if (!container) return;

  if (window.PEANUT_PURCHASE_MODE === "myship") {
    const heroLabel = document.querySelector(".page-hero .section-label");
    const heroTitle = document.querySelector(".page-hero h1");
    const heroDescription = document.querySelector(".page-hero h1 + p");

    if (heroLabel) heroLabel.textContent = "PURCHASE UPDATE";
    if (heroTitle) heroTitle.textContent = "購買方式已更新";
    if (heroDescription) heroDescription.textContent = "官網購物車暫停使用，訂購改由 7-ELEVEN 賣貨便完成。";

    container.innerHTML = `
      <div class="purchase-transition-card">
        <p class="section-label">7-ELEVEN 賣貨便</p>
        <h2>安心完成下單與取貨</h2>
        <p>花生一生目前統一由 7-ELEVEN 賣貨便提供商品選購、付款與配送服務。</p>
        <a href="order.html" class="primary-link-btn" data-purchase-link>前往 7-ELEVEN 賣貨便購買</a>
      </div>
    `;
    return;
  }

  const cart = getCart();

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="empty-cart">
        <div class="empty-cart-visual">
          <img src="images/products/placeholder.png" alt="花生一生原味烘焙花生">
          <span>從雲林元長，把花生香帶回家</span>
        </div>
        <h2>購物車目前是空的</h2>
        <p>挑一包來自雲林元長、用心挑選與乾烘焙的花生，放進今天的日常。</p>
        <a href="products.html" class="primary-link-btn">看看花生產品</a>
      </div>
    `;
    return;
  }

  let total = 0;

  const cartItemsHtml = cart.map(item => {
    const subtotal = Number(item.price) * Number(item.quantity);
    const itemId = escapeHtml(item.id || item.product_id || "");
    const itemName = escapeHtml(item.name || item.product_name || "未命名商品");
    const itemWeight = escapeHtml(item.weight || "");
    const imageSource = escapeHtml(getCartProductImageSource(item));
    const quantity = Math.max(1, Number(item.quantity) || 1);
    total += subtotal;

    return `
      <div class="cart-item">
        <div class="cart-item-image">
          <img 
            src="${imageSource}"
            alt="${itemName}"
            onerror="this.src='images/placeholder.png'"
          >
        </div>

        <div class="cart-item-info">
          <h2>${itemName}</h2>
          <p>${itemWeight}</p>
          <strong>${formatPrice(item.price)}</strong>
        </div>

        <div class="cart-item-quantity">
          <button type="button" data-cart-action="minus" data-id="${itemId}">－</button>
          <span>${quantity}</span>
          <button type="button" data-cart-action="plus" data-id="${itemId}">＋</button>
        </div>

        <div class="cart-item-subtotal">
          <strong>${formatPrice(subtotal)}</strong>
          <button type="button" data-cart-action="remove" data-id="${itemId}">移除</button>
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = `
    <div class="cart-layout">
      <div class="cart-list">
        ${cartItemsHtml}
      </div>

      <aside class="cart-summary">
        <h2>訂單摘要</h2>

        <div class="cart-summary-row">
          <span>商品小計</span>
          <strong>${formatPrice(total)}</strong>
        </div>

        <div class="cart-summary-row">
          <span>運費</span>
          <strong>尚未計算</strong>
        </div>

        <div class="cart-summary-total">
          <span>目前合計</span>
          <strong>${formatPrice(total)}</strong>
        </div>

        <a href="checkout.html" class="checkout-btn">下一步，填寫資料</a>

        <a href="products.html" class="continue-shopping">繼續選購</a>
      </aside>
    </div>
  `;

  container.querySelectorAll("button[data-cart-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const productId = button.dataset.id || "";
      if (button.dataset.cartAction === "minus") changeQuantity(productId, -1);
      if (button.dataset.cartAction === "plus") changeQuantity(productId, 1);
      if (button.dataset.cartAction === "remove") removeItem(productId);
    });
  });
}

function changeQuantity(productId, amount) {
  const cart = getCart();

  const item = cart.find(product => product.id === productId || product.product_id === productId);

  if (!item) return;

  item.quantity += amount;

  if (item.quantity <= 0) {
    const newCart = cart.filter(product => product.id !== productId && product.product_id !== productId);
    saveCart(newCart);
  } else {
    saveCart(cart);
  }

  renderCart();
}

function removeItem(productId) {
  const cart = getCart();
  const newCart = cart.filter(product => product.id !== productId && product.product_id !== productId);

  saveCart(newCart);
  renderCart();
}

renderCart();
