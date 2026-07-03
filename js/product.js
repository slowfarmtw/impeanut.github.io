function getProductIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
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
          <button class="quantity-btn" type="button">－</button>
          <span class="quantity-number">1</span>
          <button class="quantity-btn" type="button">＋</button>
        </div>

        <button class="primary-btn" type="button">
          加入購物車
        </button>

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
}

loadProductDetail();
