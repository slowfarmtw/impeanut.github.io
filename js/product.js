async function loadProducts() {

    const container = document.getElementById("productList");

    try {

        const response = await fetch(API_URL);

        const products = await response.json();

        container.innerHTML = "";

        products.forEach(product => {

            if (product.status !== "TRUE") return;

            container.innerHTML += `
                <div class="product-detail">
                    <img src="images/${product.cover_image}" alt="${product.name}">

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

    } catch (err) {

        container.innerHTML = "<p>商品載入失敗</p>";

        console.error(err);

    }

}

loadProducts();
