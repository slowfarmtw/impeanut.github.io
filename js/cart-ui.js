const PEANUT_CART_KEY = "peanutCart";

function peanutGetCartItemImageSrc(image) {
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

function peanutGetCartProductImageSource(item) {
  return item.image_src || peanutGetCartItemImageSrc(item.cover_image || item.image);
}

function peanutGetCart() {
  return JSON.parse(localStorage.getItem(PEANUT_CART_KEY)) || [];
}

function peanutSaveCart(cart) {
  localStorage.setItem(PEANUT_CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event("peanutCartUpdated"));
}

function peanutFormatPrice(price) {
  return `NT$ ${Number(price).toLocaleString()}`;
}

function peanutGetCartTotal(cart) {
  return cart.reduce((sum, item) => {
    return sum + Number(item.price) * Number(item.quantity);
  }, 0);
}

function peanutGetCartCount(cart) {
  return cart.reduce((sum, item) => {
    return sum + Number(item.quantity);
  }, 0);
}

function peanutAddToCart(product, quantity = 1) {
  const cart = peanutGetCart();
  const existingItem = cart.find(item => {
    return item.id === product.id || item.product_id === product.id || item.id === product.product_id;
  });

  if (existingItem) {
    existingItem.quantity += Number(quantity);
    existingItem.image = existingItem.image || product.image || product.cover_image || "placeholder.png";
    existingItem.image_src = existingItem.image_src || product.image_src || peanutGetCartItemImageSrc(product.cover_image || product.image);
    existingItem.cover_image = existingItem.cover_image || product.cover_image || product.image || "";
  } else {
    cart.push({
      id: product.id,
      product_id: product.product_id || product.id,
      name: product.name || product.product_name || "未命名商品",
      product_name: product.product_name || product.name || "未命名商品",
      sku: product.sku || "",
      price: Number(product.price),
      image: product.image || product.cover_image || "placeholder.png",
      image_src: product.image_src || peanutGetCartItemImageSrc(product.cover_image || product.image),
      cover_image: product.cover_image || product.image || "",
      weight: product.weight || "",
      quantity: Number(quantity)
    });
  }

  peanutSaveCart(cart);
  peanutShowCartToast(`${product.name} 已加入購物車`);
  peanutOpenCartDrawer();
}

function peanutUpdateCartQuantity(productId, change) {
  const cart = peanutGetCart();
  const item = cart.find(item => item.id === productId || item.product_id === productId);

  if (!item) return;

  item.quantity += change;

  if (item.quantity <= 0) {
    const newCart = cart.filter(item => item.id !== productId && item.product_id !== productId);
    peanutSaveCart(newCart);
    return;
  }

  peanutSaveCart(cart);
}

function peanutRemoveCartItem(productId) {
  const cart = peanutGetCart();
  const newCart = cart.filter(item => item.id !== productId && item.product_id !== productId);
  peanutSaveCart(newCart);
}

function peanutCreateFloatingCart() {
  if (document.getElementById("floatingCart")) return;

  const cartHtml = `
    <div class="floating-cart" id="floatingCart">
      <button class="floating-cart-button" id="floatingCartButton">
        <span class="floating-cart-icon">🛒</span>
        <span>購物車</span>
        <strong id="floatingCartCount">0</strong>
      </button>
    </div>

    <div class="cart-drawer-overlay" id="cartDrawerOverlay"></div>

    <aside class="cart-drawer" id="cartDrawer">
      <div class="cart-drawer-header">
        <div>
          <p class="section-label">購物清單</p>
          <h2>購物車</h2>
        </div>
        <button class="cart-drawer-close" id="cartDrawerClose">×</button>
      </div>

      <div class="cart-drawer-body" id="cartDrawerBody"></div>

      <div class="cart-drawer-footer" id="cartDrawerFooter"></div>
    </aside>

    <div class="cart-toast" id="cartToast"></div>
  `;

  document.body.insertAdjacentHTML("beforeend", cartHtml);

  document.getElementById("floatingCartButton").addEventListener("click", peanutOpenCartDrawer);
  document.getElementById("cartDrawerClose").addEventListener("click", peanutCloseCartDrawer);
  document.getElementById("cartDrawerOverlay").addEventListener("click", peanutCloseCartDrawer);

  peanutRenderFloatingCart();
}

function peanutRenderFloatingCart() {
  const cart = peanutGetCart();

  const floatingCart = document.getElementById("floatingCart");
  const countTarget = document.getElementById("floatingCartCount");
  const body = document.getElementById("cartDrawerBody");
  const footer = document.getElementById("cartDrawerFooter");

  if (!floatingCart || !countTarget || !body || !footer) return;

  const count = peanutGetCartCount(cart);
  const total = peanutGetCartTotal(cart);

  countTarget.textContent = count;

  if (count > 0) {
    floatingCart.classList.add("show");
  } else {
    floatingCart.classList.remove("show");
    peanutCloseCartDrawer();
  }

  if (cart.length === 0) {
    body.innerHTML = `
      <div class="drawer-empty">
        <h3>購物車目前是空的</h3>
        <p>可以先到產品介紹選擇想購買的商品。</p>
        <a href="products.html">前往產品介紹</a>
      </div>
    `;

    footer.innerHTML = "";
    return;
  }

  body.innerHTML = cart.map(item => {
    const subtotal = Number(item.price) * Number(item.quantity);

    return `
      <div class="drawer-cart-item">
        <div class="drawer-cart-image">
          <img 
            src="${peanutGetCartProductImageSource(item)}" 
            alt="${item.name}"
            onerror="this.onerror=null; this.src='images/placeholder.png';"
          >
        </div>

        <div class="drawer-cart-info">
          <h3>${item.name}</h3>
          <p>${item.weight || ""}</p>
          <strong>${peanutFormatPrice(item.price)}</strong>

          <div class="drawer-qty">
            <button data-action="minus" data-id="${item.id}">−</button>
            <span>${item.quantity}</span>
            <button data-action="plus" data-id="${item.id}">＋</button>
          </div>
        </div>

        <div class="drawer-cart-subtotal">
          <strong>${peanutFormatPrice(subtotal)}</strong>
          <button data-action="remove" data-id="${item.id}">移除</button>
        </div>
      </div>
    `;
  }).join("");

  footer.innerHTML = `
    <div class="drawer-total">
      <span>商品小計</span>
      <strong>${peanutFormatPrice(total)}</strong>
    </div>

    <a href="checkout.html" class="drawer-checkout-btn">前往結帳</a>
    <a href="cart.html" class="drawer-cart-link">查看完整購物車</a>
  `;

  body.querySelectorAll("button[data-action]").forEach(button => {
    button.addEventListener("click", function () {
      const action = this.dataset.action;
      const id = this.dataset.id;

      if (action === "plus") peanutUpdateCartQuantity(id, 1);
      if (action === "minus") peanutUpdateCartQuantity(id, -1);
      if (action === "remove") peanutRemoveCartItem(id);
    });
  });
}

function peanutOpenCartDrawer() {
  const cart = peanutGetCart();

  if (cart.length === 0) return;

  document.getElementById("cartDrawer")?.classList.add("open");
  document.getElementById("cartDrawerOverlay")?.classList.add("show");
}

function peanutCloseCartDrawer() {
  document.getElementById("cartDrawer")?.classList.remove("open");
  document.getElementById("cartDrawerOverlay")?.classList.remove("show");
}

let peanutToastTimer = null;

function peanutShowCartToast(message) {
  const toast = document.getElementById("cartToast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(peanutToastTimer);

  peanutToastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

window.addEventListener("peanutCartUpdated", peanutRenderFloatingCart);

document.addEventListener("DOMContentLoaded", function () {
  peanutCreateFloatingCart();
});
