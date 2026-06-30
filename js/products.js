async function loadProducts() {
  const container = document.getElementById("productList");

  try {
    const response = await fetch(API_URL);
    const products = await response.json();

    container.innerHTML = "";

    products.forEach(product => {
      container.innerHTML += `
        <article class="product-card">
          <div class="product-image-wrap">
            <img src="images/${product.cover_image || "placeholder.jpg"}" alt="${product.name}">
          </div>

          <div class="product-card-body">
            <p class="product-subtitle">${product.subtitle || ""}｜${product.weight || ""}</p>
            <h2>${product.name}</h2>
            <p class="product-desc">${product.description || ""}</p>

            <div class="product-card-bottom">
              <strong>NT$ ${product.price}</strong>
              <a href="product.html?id=${product.id}" class="product-btn">查看商品 →</a>
            </div>
          </div>
        </article>
      `;
    });

    if (container.innerHTML === "") {
      container.innerHTML = "<p>目前尚無上架商品。</p>";
    }

  } catch (err) {
    container.innerHTML = "<p>商品載入失敗</p>";
    console.error(err);
  }
}

loadProducts();
