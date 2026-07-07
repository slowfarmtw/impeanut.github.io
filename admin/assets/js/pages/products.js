const products = [
  {
    name: "原味烘焙花生",
    desc: "80g｜日常泡茶零食",
    category: "烘焙花生",
    price: 100,
    stock: 230,
    status: "上架",
    icon: "🥜"
  },
  {
    name: "花生糖",
    desc: "150g｜節慶伴手禮",
    category: "花生糖",
    price: 150,
    stock: 88,
    status: "上架",
    icon: "🍬"
  },
  {
    name: "原味花生醬",
    desc: "250g｜無糖少添加",
    category: "花生醬",
    price: 250,
    stock: 36,
    status: "草稿",
    icon: "🥄"
  }
];

const tableBody = document.getElementById("productTableBody");
const searchInput = document.getElementById("productSearch");
const statusFilter = document.getElementById("statusFilter");

function formatPrice(price) {
  return `NT$ ${Number(price).toLocaleString()}`;
}

function getStatusClass(status) {
  if (status === "上架") return "status-live";
  if (status === "草稿") return "status-draft";
  return "status-stop";
}

function renderProducts() {
  const keyword = searchInput.value.trim();
  const status = statusFilter.value;

  const filteredProducts = products.filter(product => {
    const matchKeyword =
      product.name.includes(keyword) ||
      product.category.includes(keyword) ||
      product.status.includes(keyword);

    const matchStatus = status === "all" || product.status === status;

    return matchKeyword && matchStatus;
  });

  tableBody.innerHTML = filteredProducts.map(product => `
    <tr>
      <td>
        <div class="product-info">
          <div class="product-thumb">${product.icon}</div>
          <div>
            <div class="product-name">${product.name}</div>
            <div class="product-desc">${product.desc}</div>
          </div>
        </div>
      </td>
      <td>${product.category}</td>
      <td>${formatPrice(product.price)}</td>
      <td>${product.stock}</td>
      <td>
        <span class="status-badge ${getStatusClass(product.status)}">
          ${product.status}
        </span>
      </td>
      <td>
        <button class="action-btn">編輯</button>
      </td>
    </tr>
  `).join("");
}

searchInput.addEventListener("input", renderProducts);
statusFilter.addEventListener("change", renderProducts);

renderProducts();
