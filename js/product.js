const productDetail = document.getElementById("productDetail");

function getProductIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function formatPrice(price) {
  return `NT$ ${Number(price).toLocaleString()}`;
}

function renderList(items) {
  if (!items || items.length === 0) return "<p>內容整理中。</p>";

  return `
    <ul>
      ${items.map(item => `<li>${item}</li>`).join("")}
    </ul>
  `;
}

function renderProductDetail() {
  if (!productDetail) return;

  const productId = getProductIdFromUrl();
  const product = PRODUCTS.find(item => item.id === productId);

  if (!product) {
    productDetail.innerHTML = `
      <section class="section">
        <div class="empty-cart">
          <h2>找不到商品</h2>
          <p>這個商品可能已下架或連結有誤。</p>
          <a href="products.html" class="primary-link-btn">回產品介紹</a>
        </div>
      </section>
    `;
    return;
  }

  productDetail.innerHTML = `
    <section class="product-detail-page">

      <div class="product-top-card">

        <div class="product-top-image">
          <img 
            src="images/${product.image || "placeholder.png"}" 
            alt="${product.name}"
            onerror="this.onerror=null; this.src='images/placeholder.png';"
          >
        </div>

        <div class="product-top-info">
          <p class="section-label">PRODUCT</p>
          <h1>${product.name}</h1>
          <p class="product-detail-subtitle">${product.subtitle || ""}｜${product.weight || ""}</p>

          <p class="product-detail-desc">
            ${product.description || ""}
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

      <div class="product-info-sections">

        <section class="product-info-block">
          <h2>產品介紹</h2>
          <p>${product.detailIntro || product.description || "內容整理中。"}</p>
        </section>

        <section class="product-info-block">
          <h2>風味特色</h2>
          ${renderList(product.features)}
        </section>

        <section class="product-info-block">
          <h2>食用方法</h2>
          ${renderList(product.howToEat)}
        </section>

        <section class="product-info-block">
          <h2>保存方式</h2>
          ${renderList(product.storage)}
        </section>

        <section class="product-info-block">
          <h2>規格資訊</h2>
          <ul>
            <li>品名：${product.name}</li>
            <li>規格：${product.weight || "依包裝標示"}</li>
            <li>售價：${formatPrice(product.price)}</li>
          </ul>
        </section>

      </div>

    </section>
  `;

  setupProductQuantity(product);
}

function setupProductQuantity(product) {
  let quantity = 1;

  const minusBtn = document.getElementById("qtyMinus");
  const plusBtn = document.getElementById("qtyPlus");
  const qtyNumber = document.getElementById("qtyNumber");
  const addBtn = document.getElementById("addToCartBtn");

  minusBtn.addEventListener("click", function () {
    if (quantity > 1) {
      quantity -= 1;
      qtyNumber.textContent = quantity;
    }
  });

  plusBtn.addEventListener("click", function () {
    quantity += 1;
    qtyNumber.textContent = quantity;
  });

  addBtn.addEventListener("click", function () {
    if (typeof peanutAddToCart === "function") {
      peanutAddToCart(product, quantity);
    } else {
      const cart = JSON.parse(localStorage.getItem("peanutCart")) || [];
      const existingItem = cart.find(item => item.id === product.id);

      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        cart.push({
          id: product.id,
          name: product.name,
          price: Number(product.price),
          image: product.image,
          weight: product.weight,
          quantity: quantity
        });
      }

      localStorage.setItem("peanutCart", JSON.stringify(cart));
      window.dispatchEvent(new Event("peanutCartUpdated"));
      alert("已加入購物車");
    }

    quantity = 1;
    qtyNumber.textContent = quantity;
  });
}

renderProductDetail();
