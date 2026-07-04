function loadProducts() {
  const container = document.getElementById("productList");

  if (!container) return;

  container.innerHTML = "";

  PRODUCTS.forEach(product => {
    if (!product.status) return;

    container.innerHTML += `
      <article class="product-card">
        <div class="product-image-wrap">
          <a href="product.html?id=${product.id}">
            <img 
              src="images/${product.image || "placeholder.png"}" 
              alt="${product.name}"
              onerror="this.onerror=null; this.src='images/placeholder.png';"
            >
          </a>
        </div>

        <div class="product-card-body">
          <p class="product-subtitle">${product.subtitle || ""}｜${product.weight || ""}</p>

          <h2>${product.name}</h2>

          <p class="product-desc">${product.description || ""}</p>

          <div class="product-card-bottom">
            <strong>NT$ ${Number(product.price).toLocaleString()}</strong>
            <a href="product.html?id=${product.id}" class="product-btn">查看詳情</a>
          </div>

          <div class="product-buy-row">
            <div class="product-list-qty" data-product-id="${product.id}">
              <button type="button" class="list-qty-minus">−</button>
              <span class="list-qty-number">1</span>
              <button type="button" class="list-qty-plus">＋</button>
            </div>

            <button 
              type="button" 
              class="product-add-btn" 
              data-product-id="${product.id}"
            >
              加入購物車
            </button>
          </div>
        </div>
      </article>
    `;
  });

  if (container.innerHTML === "") {
    container.innerHTML = "<p>目前尚無上架商品。</p>";
  }

  setupProductListActions();
}

function setupProductListActions() {
  const productCards = document.querySelectorAll(".product-card");

  productCards.forEach(card => {
    const minusBtn = card.querySelector(".list-qty-minus");
    const plusBtn = card.querySelector(".list-qty-plus");
    const qtyNumber = card.querySelector(".list-qty-number");
    const addBtn = card.querySelector(".product-add-btn");

    let quantity = 1;

    if (minusBtn) {
      minusBtn.addEventListener("click", function () {
        if (quantity > 1) {
          quantity -= 1;
          qtyNumber.textContent = quantity;
        }
      });
    }

    if (plusBtn) {
      plusBtn.addEventListener("click", function () {
        quantity += 1;
        qtyNumber.textContent = quantity;
      });
    }

    if (addBtn) {
      addBtn.addEventListener("click", function () {
        const productId = this.dataset.productId;
        const product = PRODUCTS.find(item => item.id === productId);

        if (!product) return;

        peanutAddToCart(product, quantity);

        quantity = 1;
        qtyNumber.textContent = quantity;
      });
    }
  });
}

loadProducts();
