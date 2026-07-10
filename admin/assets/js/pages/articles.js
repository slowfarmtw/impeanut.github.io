

// admin/assets/js/pages/articles.js
// 品牌內容管理：讀取 Supabase posts，管理 SEO 文章、花生研究室、最新消息與品牌內容。

const articlesTableBody = document.getElementById("articlesTableBody");
const articlesStatusText = document.getElementById("articlesStatusText");
const refreshArticlesBtn = document.getElementById("refreshArticlesBtn");

const articleCategoryFilter = document.getElementById("articleCategoryFilter");
const articleTypeFilter = document.getElementById("articleTypeFilter");
const articleStatusFilter = document.getElementById("articleStatusFilter");

const totalArticlesCount = document.getElementById("totalArticlesCount");
const publishedArticlesCount = document.getElementById("publishedArticlesCount");
const draftArticlesCount = document.getElementById("draftArticlesCount");
const seoArticlesCount = document.getElementById("seoArticlesCount");

let articles = [];
let filteredArticles = [];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDateTime(value) {
  if (!value) return "未設定";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "未設定";

  return date.toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getStatusText(status) {
  if (status === "published") return "已發布";
  if (status === "draft") return "草稿";
  if (status === "archived") return "封存";
  return status || "未設定";
}

function getTypeText(type) {
  const typeMap = {
    seo_article: "SEO 文章",
    research: "花生研究室",
    news: "最新消息",
    brand: "品牌故事",
    report: "檢驗報告",
    faq: "常見問題",
    general: "一般文章"
  };

  return typeMap[type] || type || "未設定";
}

function renderStatus(status) {
  const text = getStatusText(status);
  const className = status === "published" ? "status-success" : "status-muted";

  return `<span class="status-pill ${className}">${escapeHtml(text)}</span>`;
}

function updateStats() {
  const total = articles.length;
  const published = articles.filter((article) => article.status === "published").length;
  const draft = articles.filter((article) => article.status === "draft").length;
  const seo = articles.filter((article) => article.content_type === "seo_article").length;

  if (totalArticlesCount) totalArticlesCount.textContent = total;
  if (publishedArticlesCount) publishedArticlesCount.textContent = published;
  if (draftArticlesCount) draftArticlesCount.textContent = draft;
  if (seoArticlesCount) seoArticlesCount.textContent = seo;
}

function updateCategoryFilterOptions() {
  if (!articleCategoryFilter) return;

  const currentValue = articleCategoryFilter.value;
  const categories = [...new Set(articles.map((article) => article.category).filter(Boolean))];

  articleCategoryFilter.innerHTML = `
    <option value="all">全部分類</option>
    ${categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}
  `;

  articleCategoryFilter.value = categories.includes(currentValue) ? currentValue : "all";
}

function applyFilters() {
  const selectedCategory = articleCategoryFilter?.value || "all";
  const selectedType = articleTypeFilter?.value || "all";
  const selectedStatus = articleStatusFilter?.value || "all";

  filteredArticles = articles.filter((article) => {
    const matchCategory = selectedCategory === "all" || article.category === selectedCategory;
    const matchType = selectedType === "all" || article.content_type === selectedType;
    const matchStatus = selectedStatus === "all" || article.status === selectedStatus;

    return matchCategory && matchType && matchStatus;
  });

  renderTable();
}

function renderTable() {
  if (!articlesTableBody) return;

  if (!filteredArticles.length) {
    articlesTableBody.innerHTML = `
      <tr>
        <td colspan="8">目前沒有符合條件的品牌內容。</td>
      </tr>
    `;
    return;
  }

  articlesTableBody.innerHTML = filteredArticles.map((article) => {
    const previewUrl = article.id
      ? `../../article.html?id=${encodeURIComponent(article.id)}${article.slug ? `&slug=${encodeURIComponent(article.slug)}` : ""}`
      : "#";

    return `
      <tr>
        <td>
          <strong>${escapeHtml(article.title || "未命名文章")}</strong>
          <br>
          <small>${escapeHtml(article.slug || "尚未設定 slug")}</small>
        </td>
        <td>${escapeHtml(article.category || "未分類")}</td>
        <td>${escapeHtml(getTypeText(article.content_type))}</td>
        <td>${renderStatus(article.status)}</td>
        <td>${article.is_featured ? "是" : "否"}</td>
        <td>${formatDateTime(article.published_at)}</td>
        <td>${formatDateTime(article.updated_at || article.created_at)}</td>
        <td>
          <a href="article-editor.html?id=${encodeURIComponent(article.id)}" class="table-action">編輯</a>
          ${article.id ? `<a href="${previewUrl}" class="table-action" target="_blank" rel="noopener">預覽</a>` : ""}
        </td>
      </tr>
    `;
  }).join("");
}

async function loadArticles() {
  if (!window.supabaseClient) {
    articlesStatusText.textContent = "Supabase 尚未設定";
    return;
  }

  articlesStatusText.textContent = "品牌內容讀取中...";

  const { data, error } = await window.supabaseClient
    .from("posts")
    .select("id, title, slug, category, content_type, excerpt, cover_image, seo_title, seo_description, seo_keywords, status, is_featured, published_at, created_at, updated_at, canonical_url, meta_robots")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("品牌內容讀取失敗：", error);
    articlesStatusText.textContent = `品牌內容讀取失敗：${error.message}`;

    if (articlesTableBody) {
      articlesTableBody.innerHTML = `
        <tr>
          <td colspan="8">品牌內容讀取失敗。</td>
        </tr>
      `;
    }

    return;
  }

  articles = data || [];
  filteredArticles = [...articles];

  updateStats();
  updateCategoryFilterOptions();
  applyFilters();

  articlesStatusText.textContent = `共 ${articles.length} 筆品牌內容`;
}

refreshArticlesBtn?.addEventListener("click", loadArticles);
articleCategoryFilter?.addEventListener("change", applyFilters);
articleTypeFilter?.addEventListener("change", applyFilters);
articleStatusFilter?.addEventListener("change", applyFilters);

loadArticles();