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

function getCart() {
  return JSON.parse(localStorage.getItem("peanutCart")) || [];
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
    const subtotal = item.price * item.quantity;
    total += subtotal;

    return `
      <div class="cart-item">
        <div class="cart-item-image">
          <img 
            src="${getCartProductImageSource(item)}" 
            alt="${item.name}"
            onerror="this.src='images/placeholder.png'"
          >
        </div>

        <div class="cart-item-info">
          <h2>${item.name}</h2>
          <p>${item.weight || ""}</p>
          <strong>${formatPrice(item.price)}</strong>
        </div>

        <div class="cart-item-quantity">
          <button type="button" onclick="changeQuantity('${item.id}', -1)">－</button>
          <span>${item.quantity}</span>
          <button type="button" onclick="changeQuantity('${item.id}', 1)">＋</button>
        </div>

        <div class="cart-item-subtotal">
          <strong>${formatPrice(subtotal)}</strong>
          <button type="button" onclick="removeItem('${item.id}')">移除</button>
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
