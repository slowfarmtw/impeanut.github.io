

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
let articleCategories = [];

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
  const roots = articleCategories.filter((category) => !category.parent_id);
  const knownCategoryIds = new Set(articleCategories.map((category) => category.id));
  const categoryOptions = roots.flatMap((root) => {
    const children = articleCategories.filter((category) => category.parent_id === root.id);
    return [root, ...children];
  });
  const orphanOptions = articleCategories.filter((category) => category.parent_id && !knownCategoryIds.has(category.parent_id));
  const allOptions = [...categoryOptions, ...orphanOptions];
  const legacyCategories = [...new Set(articles
    .filter((article) => !article.category_id && article.category)
    .map((article) => article.category))];
  const hasUncategorized = articles.some((article) => !article.category_id && !article.category);

  articleCategoryFilter.innerHTML = `
    <option value="all">全部分類</option>
    ${allOptions.map((category) => {
      const isChild = Boolean(category.parent_id);
      const hiddenLabel = category.is_visible === false ? "（停用）" : "";
      return `<option value="${escapeHtml(category.id)}">${isChild ? "　└ " : ""}${escapeHtml(category.name)}${hiddenLabel}</option>`;
    }).join("")}
    ${legacyCategories.map((category) => `<option value="legacy:${escapeHtml(category)}">舊分類｜${escapeHtml(category)}</option>`).join("")}
    ${hasUncategorized ? '<option value="uncategorized">未分類</option>' : ""}
  `;

  const availableValues = [...articleCategoryFilter.options].map((option) => option.value);
  articleCategoryFilter.value = availableValues.includes(currentValue) ? currentValue : "all";
}

function getArticleCategoryRecord(article) {
  return article.post_categories || articleCategories.find((category) => category.id === article.category_id) || null;
}

function getArticleCategoryLabel(article) {
  const category = getArticleCategoryRecord(article);
  if (!category) return article.category || "未分類";
  const parent = category.parent_id
    ? articleCategories.find((item) => item.id === category.parent_id)
    : null;
  return parent ? `${parent.name} ＞ ${category.name}` : category.name;
}

function getSelectedCategoryIds(selectedCategory) {
  const selected = articleCategories.find((category) => category.id === selectedCategory);
  if (!selected) return new Set();
  if (selected.parent_id) return new Set([selected.id]);
  return new Set([selected.id, ...articleCategories
    .filter((category) => category.parent_id === selected.id)
    .map((category) => category.id)]);
}

function applyFilters() {
  const selectedCategory = articleCategoryFilter?.value || "all";
  const selectedType = articleTypeFilter?.value || "all";
  const selectedStatus = articleStatusFilter?.value || "all";
  const selectedCategoryIds = getSelectedCategoryIds(selectedCategory);

  filteredArticles = articles.filter((article) => {
    let matchCategory = selectedCategory === "all";
    if (selectedCategory === "uncategorized") {
      matchCategory = !article.category_id && !article.category;
    } else if (selectedCategory.startsWith("legacy:")) {
      matchCategory = !article.category_id && article.category === selectedCategory.slice(7);
    } else if (selectedCategory !== "all") {
      matchCategory = selectedCategoryIds.has(article.category_id);
      if (!matchCategory && !article.category_id) {
        const selectedNames = articleCategories
          .filter((category) => selectedCategoryIds.has(category.id))
          .map((category) => category.name);
        matchCategory = selectedNames.includes(article.category);
      }
    }
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
    const previewUrl = article.status === "published" && article.slug
      ? `../../articles/${encodeURIComponent(article.slug)}.html`
      : article.id ? `../../article.html?id=${encodeURIComponent(article.id)}${article.slug ? `&slug=${encodeURIComponent(article.slug)}` : ""}` : "#";

    return `
      <tr>
        <td data-label="文章">
          <div class="article-cell">
            <strong>${escapeHtml(article.title || "未命名文章")}</strong>
            <small>${escapeHtml(article.slug || "尚未設定 slug")}</small>
          </div>
        </td>
        <td data-label="分類" class="article-category-cell"><span class="article-category-path" title="${escapeHtml(getArticleCategoryLabel(article))}">${escapeHtml(getArticleCategoryLabel(article))}</span></td>
        <td data-label="類型">${escapeHtml(getTypeText(article.content_type))}</td>
        <td data-label="狀態">${renderStatus(article.status)}</td>
        <td data-label="主打">${article.is_featured ? "是" : "否"}</td>
        <td data-label="發布時間">${formatDateTime(article.published_at)}</td>
        <td data-label="更新時間">${formatDateTime(article.updated_at || article.created_at)}</td>
        <td data-label="操作" class="cell-actions">
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

  const categoryResult = await window.supabaseClient
    .from("post_categories")
    .select("id, name, slug, parent_id, sort_order, is_visible")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (categoryResult.error) {
    console.warn("文章分類讀取失敗，將使用舊分類欄位：", categoryResult.error);
    articleCategories = [];
  } else {
    articleCategories = categoryResult.data || [];
  }

  const { data, error } = await window.supabaseClient
    .from("posts")
    .select("id, title, slug, category, category_id, post_categories(id, name, slug, parent_id, is_visible), content_type, excerpt, cover_image, seo_title, seo_description, seo_keywords, status, is_featured, published_at, created_at, updated_at, canonical_url, meta_robots")
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
