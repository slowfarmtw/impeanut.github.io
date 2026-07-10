// admin/assets/js/pages/product-editor.js
// 商品新增/編輯頁：新增、修改 products 表資料，並串接 Supabase Storage 上傳商品圖片與圖片庫選擇。

const PRODUCT_IMAGE_BUCKET = "product-images";
const PRODUCT_IMAGE_FOLDER = "products";

const productForm = document.getElementById("productForm");
const editorTitle = document.getElementById("editorTitle");
const editorHint = document.getElementById("editorHint");
const saveProductBtn = document.getElementById("saveProductBtn");
const editorStatusText = document.getElementById("editorStatusText");

// 圖片相關元素
const coverImageInput = document.getElementById("coverImageInput");
const coverImageFile = document.getElementById("coverImageFile");
const chooseCoverImageBtn = document.getElementById("chooseCoverImageBtn");
const selectedCoverFileName = document.getElementById("selectedCoverFileName");
const uploadCoverImageBtn = document.getElementById("uploadCoverImageBtn");
const previewCoverImageBtn = document.getElementById("previewCoverImageBtn");
const coverPreviewImage = document.getElementById("coverPreviewImage");
const coverPreviewText = document.getElementById("coverPreviewText");

// 圖片庫相關元素
const openImageLibraryBtn = document.getElementById("openImageLibraryBtn");
const imageLibraryPanel = document.getElementById("imageLibraryPanel");
const imageLibraryGrid = document.getElementById("imageLibraryGrid");
const imageLibraryStatus = document.getElementById("imageLibraryStatus");

const params = new URLSearchParams(window.location.search);
let currentProductId = params.get("id");
let isEditMode = Boolean(currentProductId);

let imageLibraryLoaded = false;

function getFieldValue(name) {
  const field = productForm.elements[name];

  if (!field) return "";

  if (field.type === "checkbox") {
    return field.checked;
  }

  return field.value.trim();
}

function setFieldValue(name, value) {
  const field = productForm.elements[name];

  if (!field) return;

  if (field.type === "checkbox") {
    field.checked = Boolean(value);
    return;
  }

  field.value = value ?? "";
}

function getProductPayload() {
  return {
    sku: getFieldValue("sku"),
    name: getFieldValue("name"),
    slug: getFieldValue("slug") || null,
    category: getFieldValue("category") || null,
    subtitle: getFieldValue("subtitle") || null,
    description: getFieldValue("description") || null,
    ingredients: getFieldValue("ingredients") || null,
    weight: getFieldValue("weight") || null,

    price: Number(getFieldValue("price") || 0),
    cost: Number(getFieldValue("cost") || 0),
    stock: Number(getFieldValue("stock") || 0),
    safety_stock: Number(getFieldValue("safety_stock") || 0),

    cover_image: getFieldValue("cover_image") || null,

    status: getFieldValue("status") || "draft",
    is_featured: getFieldValue("is_featured"),
    is_visible: getFieldValue("is_visible")
  };
}

function fillForm(product) {
  Object.entries(product).forEach(([key, value]) => {
    setFieldValue(key, value);
  });

  if (product.cover_image) {
    updateCoverPreview(product.cover_image);
  }
}

function validatePayload(payload) {
  if (!payload.sku) return "請輸入 SKU。";
  if (!payload.name) return "請輸入商品名稱。";
  if (payload.price < 0) return "售價不可小於 0。";
  if (payload.cost < 0) return "成本不可小於 0。";
  if (payload.stock < 0) return "庫存不可小於 0。";
  if (payload.safety_stock < 0) return "安全庫存不可小於 0。";

  return "";
}

function setCreateModeText() {
  editorTitle.textContent = "新增商品";
  editorHint.textContent = "建立新的商品資料，儲存後會進入 products 資料表。";
  editorStatusText.textContent = "尚未儲存";
}

function setEditModeText() {
  editorTitle.textContent = "編輯商品";
  editorHint.textContent = "修改商品資料、價格、庫存、圖片與上架狀態。";
}

function updateCoverPreview(imageUrl) {
  if (!coverPreviewImage || !coverPreviewText) return;

  if (!imageUrl) {
    coverPreviewImage.hidden = true;
    coverPreviewImage.removeAttribute("src");
    coverPreviewText.hidden = false;
    coverPreviewText.textContent = "目前尚未設定圖片";
    return;
  }

  coverPreviewImage.src = imageUrl;
  coverPreviewImage.hidden = false;
  coverPreviewText.hidden = true;
}

function updateSelectedFileName() {
  if (!selectedCoverFileName || !coverImageFile) return;

  const file = coverImageFile.files?.[0];

  if (!file) {
    selectedCoverFileName.textContent = "目前尚未選擇圖片檔案";
    return;
  }

  selectedCoverFileName.textContent = `已選擇：${file.name}`;
}

function getSafeFileName(fileName) {
  const extension = fileName.split(".").pop()?.toLowerCase() || "jpg";

  const baseName = fileName
    .replace(/\.[^/.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return `${baseName || "product-image"}.${extension}`;
}

function buildStoragePath(file) {
  const sku = getFieldValue("sku") || "no-sku";

  const safeSku = sku
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const timestamp = Date.now();
  const safeFileName = getSafeFileName(file.name);

  return `${PRODUCT_IMAGE_FOLDER}/${safeSku}-${timestamp}-${safeFileName}`;
}

function getPublicImageUrl(filePath) {
  const { data } = window.supabaseClient.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .getPublicUrl(filePath);

  return data?.publicUrl || "";
}

function setCoverImageUrl(imageUrl, message = "圖片已更新，請記得儲存商品") {
  setFieldValue("cover_image", imageUrl);
  updateCoverPreview(imageUrl);
  editorStatusText.textContent = message;
  updateSelectedFileName();
}

async function uploadCoverImage() {
  if (!window.supabaseClient) {
    editorStatusText.textContent = "Supabase 尚未設定";
    return;
  }

  if (!coverImageFile?.files?.length) {
    editorStatusText.textContent = "請先按「上傳圖片」選擇圖片檔案";
    return;
  }

  const file = coverImageFile.files[0];

  if (!file.type.startsWith("image/")) {
    editorStatusText.textContent = "請選擇圖片檔案";
    return;
  }

  uploadCoverImageBtn.disabled = true;
  uploadCoverImageBtn.textContent = "上傳中...";
  editorStatusText.textContent = "圖片上傳中...";

  const filePath = buildStoragePath(file);

  const { error: uploadError } = await window.supabaseClient.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false
    });

  uploadCoverImageBtn.disabled = false;
  uploadCoverImageBtn.textContent = "上傳確認";

  if (uploadError) {
    console.error("圖片上傳失敗：", uploadError);

    const uploadErrorMessage = uploadError.message || "";

    if (uploadErrorMessage.includes("Duplicate")) {
      editorStatusText.textContent = "圖片上傳失敗：檔名重複，請重新選擇圖片或稍後再試。";
      return;
    }

    editorStatusText.textContent = `圖片上傳失敗：${uploadErrorMessage}`;
    return;
  }

  const publicUrl = getPublicImageUrl(filePath);

  if (!publicUrl) {
    editorStatusText.textContent = "圖片已上傳，但無法取得公開網址";
    return;
  }

  setCoverImageUrl(publicUrl, "圖片上傳成功，請記得儲存商品");

  // 上傳成功後，如果圖片庫已經打開，就同步刷新圖片庫內容
  if (imageLibraryLoaded) {
    await loadImageLibrary();
  }
}

function previewCoverImageFromInput() {
  const imageUrl = getFieldValue("cover_image");

  if (!imageUrl) {
    editorStatusText.textContent = "目前沒有圖片網址可預覽";
    updateCoverPreview("");
    return;
  }

  updateCoverPreview(imageUrl);
  editorStatusText.textContent = "圖片預覽已更新";
}

function previewSelectedLocalImage() {
  if (!coverImageFile?.files?.length) {
    updateSelectedFileName();
    return;
  }

  const file = coverImageFile.files[0];

  updateSelectedFileName();

  if (!file.type.startsWith("image/")) {
    editorStatusText.textContent = "請選擇圖片檔案";
    return;
  }

  const localUrl = URL.createObjectURL(file);
  updateCoverPreview(localUrl);
  editorStatusText.textContent = "已預覽本機圖片，尚未上傳。請按「上傳確認」完成上傳";
}

function renderImageLibrary(files) {
  if (!imageLibraryGrid) return;

  if (!files.length) {
    imageLibraryGrid.innerHTML = `
      <div class="image-library-empty">圖片庫目前沒有圖片。</div>
    `;
    return;
  }

  imageLibraryGrid.innerHTML = files.map((file) => {
    const filePath = `${PRODUCT_IMAGE_FOLDER}/${file.name}`;
    const publicUrl = getPublicImageUrl(filePath);

    return `
      <button
        type="button"
        class="image-library-item"
        data-image-url="${publicUrl}"
        title="${file.name}"
      >
        <img src="${publicUrl}" alt="${file.name}">
        <span>${file.name}</span>
      </button>
    `;
  }).join("");

  imageLibraryGrid.querySelectorAll(".image-library-item").forEach((button) => {
    button.addEventListener("click", () => {
      const imageUrl = button.dataset.imageUrl;

      if (!imageUrl) return;

      setCoverImageUrl(imageUrl, "已從圖庫選擇圖片，請記得儲存商品");

      imageLibraryGrid.querySelectorAll(".image-library-item").forEach((item) => {
        item.classList.remove("active");
      });

      button.classList.add("active");
    });
  });
}

async function loadImageLibrary() {
  if (!window.supabaseClient) {
    if (imageLibraryStatus) {
      imageLibraryStatus.textContent = "Supabase 尚未設定";
    }
    return;
  }

  if (!imageLibraryPanel || !imageLibraryGrid || !imageLibraryStatus) return;

  imageLibraryPanel.hidden = false;
  imageLibraryStatus.textContent = "圖片庫讀取中...";
  imageLibraryGrid.innerHTML = `
    <div class="image-library-empty">圖片庫讀取中...</div>
  `;

  const { data, error } = await window.supabaseClient.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .list(PRODUCT_IMAGE_FOLDER, {
      limit: 100,
      offset: 0,
      sortBy: {
        column: "created_at",
        order: "desc"
      }
    });

  if (error) {
    console.error("讀取圖片庫失敗：", error);
    imageLibraryStatus.textContent = `讀取失敗：${error.message}`;
    imageLibraryGrid.innerHTML = `
      <div class="image-library-empty">圖片庫讀取失敗。</div>
    `;
    return;
  }

  const imageFiles = (data || []).filter((file) => {
    return file.name && !file.name.endsWith("/");
  });

  renderImageLibrary(imageFiles);

  imageLibraryLoaded = true;
  imageLibraryStatus.textContent = `共 ${imageFiles.length} 張圖片`;
}

async function openImageLibrary() {
  if (!imageLibraryPanel) return;

  imageLibraryPanel.hidden = false;
  await loadImageLibrary();
}

async function loadProduct() {
  if (!window.supabaseClient) {
    editorStatusText.textContent = "Supabase 尚未設定";
    saveProductBtn.disabled = true;
    return;
  }

  if (!isEditMode) {
    setCreateModeText();
    updateCoverPreview(getFieldValue("cover_image"));
    updateSelectedFileName();
    return;
  }

  setEditModeText();
  editorStatusText.textContent = "讀取中...";

  const { data, error } = await window.supabaseClient
    .from("products")
    .select("*")
    .eq("id", currentProductId)
    .single();

  if (error) {
    console.error("讀取商品失敗：", error);
    editorStatusText.textContent = "讀取商品失敗";
    return;
  }

  fillForm(data);
  updateSelectedFileName();
  editorStatusText.textContent = "商品資料已載入";
}

async function saveProduct(event) {
  event.preventDefault();

  if (!window.supabaseClient) {
    editorStatusText.textContent = "Supabase 尚未設定";
    return;
  }

  const payload = getProductPayload();
  const validationMessage = validatePayload(payload);

  if (validationMessage) {
    editorStatusText.textContent = validationMessage;
    return;
  }

  saveProductBtn.disabled = true;
  saveProductBtn.textContent = "儲存中...";
  editorStatusText.textContent = "儲存中...";

  let result;

  if (isEditMode) {
    result = await window.supabaseClient
      .from("products")
      .update(payload)
      .eq("id", currentProductId)
      .select()
      .single();
  } else {
    result = await window.supabaseClient
      .from("products")
      .insert(payload)
      .select()
      .single();
  }

  saveProductBtn.disabled = false;
  saveProductBtn.textContent = "儲存商品";

  if (result.error) {
    console.error("儲存商品失敗：", result.error);

    const errorMessage = result.error.message || "";

    if (errorMessage.includes("products_sku_key")) {
      editorStatusText.textContent = "儲存失敗：這個 SKU 已經被使用，請更換 SKU，或回商品列表編輯原商品。";
      return;
    }

    if (errorMessage.includes("duplicate key")) {
      editorStatusText.textContent = "儲存失敗：資料重複，請檢查 SKU 或商品代號是否已存在。";
      return;
    }

    editorStatusText.textContent = `儲存失敗：${errorMessage}`;
    return;
  }

  editorStatusText.textContent = "儲存成功，商品資料已同步到前台";

  if (!isEditMode && result.data?.id) {
    currentProductId = result.data.id;
    isEditMode = true;
    window.history.replaceState({}, "", `product-editor.html?id=${currentProductId}`);
    setEditModeText();
  }
}

// 事件綁定
productForm?.addEventListener("submit", saveProduct);

chooseCoverImageBtn?.addEventListener("click", () => {
  coverImageFile?.click();
});

coverImageFile?.addEventListener("change", previewSelectedLocalImage);
uploadCoverImageBtn?.addEventListener("click", uploadCoverImage);
previewCoverImageBtn?.addEventListener("click", previewCoverImageFromInput);
coverImageInput?.addEventListener("change", previewCoverImageFromInput);
openImageLibraryBtn?.addEventListener("click", openImageLibrary);

loadProduct();