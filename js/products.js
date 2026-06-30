async function loadProducts() {
  const container = document.getElementById("productList");

  try {
    const response = await fetch(API_URL);
    const products = await response.json();
    console.log(products);

    container.innerHTML = "";

    products.forEach(product => {
      const status = String(product.status).trim().toUpperCase();

      if (status !== "TRUE") return;

      container.innerHTML += `
        <div class="product-detail">
          <img src="images/${product.cover_image || "placeholder.jpg"}" alt="${product.name}">

          <div>
            <h2>${product.name}</h2>
            <p>${product.description}</p>

            <ul>
              <li>重量：${product.weight}</li>
              <li>售價：NT$ ${product.price}</li>
              <li>${product.subtitle}</li>
            </ul>
          </div>
        </div>
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
