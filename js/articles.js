// js/articles.js
// 前台花生知識列表：讀取 Supabase posts，只顯示已發布內容。

const articleList = document.getElementById("articleList");
const categoryButtons = document.querySelectorAll(".category-card");

let frontArticles = [];
let activeCategory = "全部";

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
  return article.category || getTypeCategoryFallback(article.content_type);
}

function getVisibleArticles() {
  if (activeCategory === "全部") return frontArticles;

  return frontArticles.filter((article) => {
    return getArticleCategory(article) === activeCategory;
  });
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
  const detailUrl = articleId
    ? `article.html?id=${encodeURIComponent(articleId)}${slug ? `&slug=${encodeURIComponent(slug)}` : ""}`
    : "#";

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
    .select("id, title, slug, category, content_type, excerpt, cover_image, seo_description, status, is_featured, published_at, created_at")
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

function setupCategoryFilter() {
  categoryButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeCategory = button.dataset.category || "全部";

      categoryButtons.forEach((item) => item.classList.remove("active"));
      button.classList.add("active");

      renderArticles();

      if (articleList) {
        articleList.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }
    });
  });
}

setupCategoryFilter();
loadFrontArticles();
