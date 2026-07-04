function getProductIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function getCart() {
  return JSON.parse(localStorage.getItem("peanutCart")) || [];
}

function saveCart(cart) {
  localStorage.setItem("peanutCart", JSON.stringify(cart));
  window.dispatchEvent(new Event("peanutCartUpdated"));

if (typeof peanutOpenCartDrawer === "function") {

  peanutOpenCartDrawer();

}
}

function addToCart(product, quantity) {
  const cart = getCart();

  const existingItem = cart.find(item => item.id === product.id);

  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      weight: product.weight,
      quantity: quantity
    });
  }

  saveCart(cart);
}

function loadProductDetail() {
  const container = document.getElementById("productDetail");

  if (!container) return;

  const productId = getProductIdFromUrl();
  const product = PRODUCTS.find(item => item.id === productId);

  if (!product) {
    container.innerHTML = `
      <div class="product-not-found">
        <h1>找不到商品</h1>
        <p>這個商品可能已經下架，或網址輸入錯誤。</p>
        <a href="products.html" class="product-btn">回產品介紹</a>
      </div>
    `;
    return;
  }

  document.title = `${product.name}｜花生一生`;

  container.innerHTML = `
    <div class="product-detail-layout">
      <div class="product-detail-image">
        <img 
          src="images/${product.image || "placeholder.png"}" 
          alt="${product.name}"
          onerror="this.src='images/placeholder.png'"
        >
      </div>

      <div class="product-detail-info">
        <p class="section-label">PRODUCT</p>
        <h1>${product.name}</h1>

        <p class="product-detail-subtitle">
          ${product.subtitle || ""}｜${product.weight || ""}
        </p>

        <p class="product-detail-description">
          ${product.description || ""}
        </p>

        <div class="product-detail-price">
          NT$ ${product.price}
        </div>

        <div class="product-detail-actions">
          <button class="quantity-btn" type="button" id="decreaseQty">－</button>
          <span class="quantity-number" id="quantityNumber">1</span>
          <button class="quantity-btn" type="button" id="increaseQty">＋</button>
        </div>

        <button class="primary-btn" type="button" id="addToCartBtn">
          加入購物車
        </button>

        <p class="cart-message" id="cartMessage"></p>

        <div class="product-detail-note">
          <h3>商品資訊</h3>
          <ul>
            <li>規格：${product.weight || "依商品標示"}</li>
            <li>風味：${product.subtitle || "自然花生香"}</li>
            <li>保存：請放置陰涼乾燥處，開封後請儘早食用。</li>
          </ul>
        </div>
      </div>
    </div>
  `;

  let quantity = 1;

  const quantityNumber = document.getElementById("quantityNumber");
  const increaseQty = document.getElementById("increaseQty");
  const decreaseQty = document.getElementById("decreaseQty");
  const addToCartBtn = document.getElementById("addToCartBtn");
  const cartMessage = document.getElementById("cartMessage");

  increaseQty.addEventListener("click", function () {
    quantity += 1;
    quantityNumber.textContent = quantity;
  });

  decreaseQty.addEventListener("click", function () {
    if (quantity > 1) {
      quantity -= 1;
      quantityNumber.textContent = quantity;
    }
  });

  addToCartBtn.addEventListener("click", function () {
    addToCart(product, quantity);

    cartMessage.innerHTML = '已加入購物車。<a href="cart.html">查看購物車</a>';

    setTimeout(function () {
      cartMessage.textContent = "";
    }, 2000);
  });
}

loadProductDetail();
