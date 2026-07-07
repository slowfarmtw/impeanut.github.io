const STORAGE_KEY = "brandOSProducts";

const defaultProducts = [
  {
    id: "p001",
    name: "原味烘焙花生",
    desc: "80g｜日常泡茶零食",
    category: "烘焙花生",
    price: 100,
    stock: 230,
    status: "上架",
    icon: "🥜",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "p002",
    name: "花生糖",
    desc: "150g｜節慶伴手禮",
    category: "花生糖",
    price: 150,
    stock: 88,
    status: "上架",
    icon: "🍬",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "p003",
    name: "原味花生醬",
    desc: "250g｜無糖少添加",
    category: "花生醬",
    price: 250,
    stock: 36,
    status: "草稿",
    icon: "🥄",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

let products = loadProducts();
let editingProductId = null;

const tableBody = document.getElementById("productTableBody");
const searchInput = document.getElementById("productSearch");
const statusFilter = document.getElementById("statusFilter");

const productModal = document.getElementById("productModal");
const openProductModal = document.getElementById("openProductModal");
const closeProductModal = document.getElementById("closeProductModal");
const cancelProductModal = document.getElementById("cancelProductModal");
const productForm = document.getElementById("productForm");
const modalTitle = document.getElementById("productModalTitle");

function loadProducts() {
  const savedProducts = JSON.parse(localStorage.getItem(STORAGE_KEY));

  if (!savedProducts || !Array.isArray(savedProducts)) {
    return defaultProducts;
  }

  return savedProducts.map(product => normalizeProduct(product));
}

function normalizeProduct(product) {
  return {
    id: product.id || createId(),
    name: product.name || "",
    desc: product.desc || "",
    category: product.category || "",
    price: Number(product.price) || 0,
    stock: Number(product.stock) || 0,
    status: product.status || "草稿",
    icon: product.icon || "🥜",
    createdAt: product.createdAt || new Date().toISOString(),
    updatedAt: product.updatedAt || new Date().toISOString()
  };
}

function saveProducts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
}

function createId() {
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

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

  if (filteredProducts.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6">目前沒有符合條件的商品。</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = filteredProducts.map(product => `
    <tr>
      <td>
        <div class="product-info">
          <div class="product-thumb">${product.icon}</div>
          <div>
            <div class="product-name">${product.name}</div>
            <div class="product-desc">${product.desc || "尚未填寫副標題"}</div>
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
        <div class="action-group">
          <button class="action-btn" onclick="editProduct('${product.id}')">編輯</button>
          <button class="action-btn delete-btn" onclick="deleteProduct('${product.id}')">刪除</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function openModal(mode = "create") {
  productModal.classList.remove("hidden");
  modalTitle.textContent = mode === "edit" ? "編輯商品" : "新增商品";
}

function closeModal() {
  productModal.classList.add("hidden");
  productForm.reset();
  editingProductId = null;
  modalTitle.textContent = "新增商品";
}

function fillForm(product) {
  document.getElementById("productName").value = product.name;
  document.getElementById("productDesc").value = product.desc;
  document.getElementById("productCategory").value = product.category;
  document.getElementById("productPrice").value = product.price;
  document.getElementById("productStock").value = product.stock;
  document.getElementById("productStatus").value = product.status;
}

function editProduct(id) {
  const product = products.find(item => item.id === id);

  if (!product) {
    alert("找不到這個商品。");
    return;
  }

  editingProductId = id;
  fillForm(product);
  openModal("edit");
}

function deleteProduct(id) {
  const product = products.find(item => item.id === id);

  if (!product) {
    alert("找不到這個商品。");
    return;
  }

  const confirmDelete = confirm(`確定要刪除「${product.name}」嗎？`);

  if (!confirmDelete) return;

  products = products.filter(item => item.id !== id);

  saveProducts();
  renderProducts();
}

function handleProductSubmit(event) {
  event.preventDefault();

  const now = new Date().toISOString();

  const formData = {
    name: document.getElementById("productName").value.trim(),
    desc: document.getElementById("productDesc").value.trim(),
    category: document.getElementById("productCategory").value.trim(),
    price: Number(document.getElementById("productPrice").value),
    stock: Number(document.getElementById("productStock").value),
    status: document.getElementById("productStatus").value,
    icon: "🥜",
    updatedAt: now
  };

  if (!formData.name || !formData.category) {
    alert("請填寫商品名稱與分類。");
    return;
  }

  if (editingProductId) {
    products = products.map(product => {
      if (product.id !== editingProductId) return product;

      return {
        ...product,
        ...formData
      };
    });
  } else {
    products.unshift({
      id: createId(),
      ...formData,
      createdAt: now
    });
  }

  saveProducts();
  renderProducts();
  closeModal();
}

openProductModal.addEventListener("click", () => openModal("create"));
closeProductModal.addEventListener("click", closeModal);
cancelProductModal.addEventListener("click", closeModal);
productForm.addEventListener("submit", handleProductSubmit);

productModal.addEventListener("click", event => {
  if (event.target === productModal) {
    closeModal();
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !productModal.classList.contains("hidden")) {
    closeModal();
  }
});

searchInput.addEventListener("input", renderProducts);
statusFilter.addEventListener("change", renderProducts);

saveProducts();
renderProducts();
