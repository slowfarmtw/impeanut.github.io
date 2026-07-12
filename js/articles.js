// js/articles.js
// 前台花生知識列表：讀取 Supabase posts，只顯示已發布內容。

const articleList = document.getElementById("articleList");
const categoryFilter = document.getElementById("articleCategoryFilter");
const subcategoryFilter = document.getElementById("articleSubcategoryFilter");

let frontArticles = [];
let frontCategories = [];
let activeCategoryId = "all";
let activeSubcategoryId = "all";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

function getArticleImageSrc(image) {
  if (!image) return "";

  const imageText = String(image).trim();

  if (imageText.startsWith("http://") || imageText.startsWith("https://")) return imageText;
  if (imageText.startsWith("images/")) return imageText;
  if (imageText.startsWith("/")) return imageText;

  return `images/${imageText}`;
}

function getTypeCategoryFallback(contentType) {
  const typeMap = {
    seo_article: "SEO 文章",
    research: "花生研究室",
    news: "最新消息",
    brand: "品牌故事",
    report: "檢驗報告",
    faq: "常見問題",
    general: "一般文章"
  };

  return typeMap[contentType] || "一般文章";
}

function getArticleCategory(article) {
  return article.post_categories?.name || article.category || getTypeCategoryFallback(article.content_type);
}

function getVisibleArticles() {
  if (activeSubcategoryId !== "all") return frontArticles.filter((article) => article.category_id === activeSubcategoryId);
  if (activeCategoryId === "all") return frontArticles;
  const allowedIds = new Set([activeCategoryId, ...frontCategories.filter((item) => item.parent_id === activeCategoryId).map((item) => item.id)]);
  return frontArticles.filter((article) => allowedIds.has(article.category_id));
}

function renderArticleCard(article) {
  const title = article.title || "未命名文章";
  const slug = article.slug || "";
  const category = getArticleCategory(article);
  const excerpt = article.excerpt || article.seo_description || "";
  const imageSrc = getArticleImageSrc(article.cover_image);
  const dateValue = article.published_at || article.created_at || "";
  const dateText = formatDate(dateValue);
  const articleId = article.id || "";
  const detailUrl = slug
    ? `articles/${encodeURIComponent(slug)}.html`
    : articleId ? `article.html?id=${encodeURIComponent(articleId)}` : "#";

  return `
    <article class="article-card">
      ${imageSrc ? `
        <a class="article-card-image" href="${detailUrl}" aria-label="閱讀 ${escapeHtml(title)}">
          <img
            src="${escapeHtml(imageSrc)}"
            alt="${escapeHtml(title)}"
            loading="lazy"
            onerror="this.onerror=null; this.src='images/articles/article-placeholder.jpg';"
          >
        </a>
      ` : `
        <a class="article-card-image" href="${detailUrl}" aria-label="閱讀 ${escapeHtml(title)}">
          <img
            src="images/articles/article-placeholder.jpg"
            alt="${escapeHtml(title)}"
            loading="lazy"
          >
        </a>
      `}

      <div class="article-card-body">
        <p class="article-category">${escapeHtml(category)}</p>
        <h2>
          <a href="${detailUrl}">${escapeHtml(title)}</a>
        </h2>
        ${dateText ? `<p class="article-date">${escapeHtml(dateText)}</p>` : ""}
        ${excerpt ? `<p class="article-excerpt">${escapeHtml(excerpt)}</p>` : ""}
        <a href="${detailUrl}" class="article-link">閱讀文章 →</a>
      </div>
    </article>
  `;
}

function renderArticles() {
  if (!articleList) return;

  const visibleArticles = getVisibleArticles();

  if (!visibleArticles.length) {
    articleList.innerHTML = `
      <div class="empty-articles">
        <h2>這個分類目前尚無文章</h2>
        <p>我們會慢慢整理更多花生知識與品牌紀錄。</p>
      </div>
    `;
    return;
  }

  articleList.innerHTML = visibleArticles.map(renderArticleCard).join("");
}

async function loadFrontArticles() {
  if (!articleList) return;

  if (!window.supabaseClient) {
    articleList.innerHTML = `
      <div class="empty-articles">
        <h2>文章系統尚未完成設定</h2>
        <p>請確認 Supabase 設定檔已正確載入。</p>
      </div>
    `;
    return;
  }

  articleList.innerHTML = `<p class="article-loading">文章載入中...</p>`;

  const { data, error } = await window.supabaseClient
    .from("posts")
    .select("id, title, slug, category, category_id, post_categories(name,slug,parent_id), content_type, excerpt, cover_image, seo_description, status, is_featured, published_at, created_at")
    .eq("status", "published")
    .order("is_featured", { ascending: false })
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("前台文章讀取失敗：", error);
    articleList.innerHTML = `
      <div class="empty-articles">
        <h2>文章暫時無法載入</h2>
        <p>請稍後再試。</p>
      </div>
    `;
    return;
  }

  frontArticles = data || [];
  renderArticles();
}

function renderCategoryButtons() {
  const roots = frontCategories.filter((item) => !item.parent_id);
  categoryFilter.innerHTML = `<button class="category-card ${activeCategoryId === "all" ? "active" : ""}" type="button" data-category-id="all">全部文章</button>` + roots.map((item) => `<button class="category-card ${activeCategoryId === item.id ? "active" : ""}" type="button" data-category-id="${item.id}">${escapeHtml(item.name)}</button>`).join("");
  categoryFilter.querySelectorAll("[data-category-id]").forEach((button) => button.onclick = () => { activeCategoryId = button.dataset.categoryId; activeSubcategoryId = "all"; renderCategoryButtons(); renderSubcategoryButtons(); renderArticles(); });
}

function renderSubcategoryButtons() {
  const children = frontCategories.filter((item) => item.parent_id === activeCategoryId);
  subcategoryFilter.hidden = !children.length;
  subcategoryFilter.innerHTML = children.length ? `<button class="category-card ${activeSubcategoryId === "all" ? "active" : ""}" type="button" data-subcategory-id="all">全部</button>` + children.map((item) => `<button class="category-card ${activeSubcategoryId === item.id ? "active" : ""}" type="button" data-subcategory-id="${item.id}">${escapeHtml(item.name)}</button>`).join("") : "";
  subcategoryFilter.querySelectorAll("[data-subcategory-id]").forEach((button) => button.onclick = () => { activeSubcategoryId = button.dataset.subcategoryId; renderSubcategoryButtons(); renderArticles(); });
}

async function loadCategories() {
  const { data, error } = await window.supabaseClient.from("post_categories").select("id,name,slug,parent_id,sort_order").eq("is_visible", true).order("sort_order").order("name");
  if (error) { console.warn("分類系統尚未啟用：", error); return; }
  frontCategories = data || [];
  const params = new URLSearchParams(location.search);
  const requested = params.get("category");
  const selected = frontCategories.find((item) => item.slug === requested);
  if (selected) activeCategoryId = selected.parent_id || selected.id;
  if (selected?.parent_id) activeSubcategoryId = selected.id;
  renderCategoryButtons(); renderSubcategoryButtons();
}

(async () => { await loadCategories(); await loadFrontArticles(); })();
