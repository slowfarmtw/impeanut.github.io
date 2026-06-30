async function loadProducts() {
  const container = document.getElementById("productList");

  const CACHE_KEY = "products_cache";
  const CACHE_TIME_KEY = "products_cache_time";
  const CACHE_DURATION = 60 * 60 * 1000; // 1小時

  container.innerHTML = "<p class='loading-text'>商品載入中...</p>";

  try {
    const cachedData = localStorage.getItem(CACHE_KEY);
    const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
    const now = Date.now();

    if (cachedData && cachedTime && now - Number(cachedTime) < CACHE_DURATION) {
      renderProducts(JSON.parse(cachedData));
      return;
    }

    const response = await fetch(API_URL);
    const products = await response.json();

    localStorage.setItem(CACHE_KEY, JSON.stringify(products));
    localStorage.setItem(CACHE_TIME_KEY, String(now));

    renderProducts(products);

  } catch (err) {
    container.innerHTML = "<p class='loading-text'>商品載入失敗，請稍後再試。</p>";
    console.error(err);
  }
}

function renderProducts(products) {
  const container = document.getElementById("productList");

  container.innerHTML = "";

  products.forEach(product => {
    container.innerHTML += `
      <div class="product-detail">
        <img 
          src="images/${product.cover_image || "placeholder.jpg"}" 
          alt="${product.name}"
          loading="lazy"
          decoding="async"
        >

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
    container.innerHTML = "<p class='loading-text'>目前尚無上架商品。</p>";
  }
}

loadProducts();
