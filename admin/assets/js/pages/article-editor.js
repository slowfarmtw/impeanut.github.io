// admin/assets/js/pages/article-editor.js
// 品牌內容編輯器：新增 / 編輯 Supabase posts。

const params = new URLSearchParams(window.location.search);
let currentArticleId = params.get("id");
let isEditMode = Boolean(currentArticleId);

const articleEditorForm = document.getElementById("articleEditorForm");
const editorPageTitle = document.getElementById("editorPageTitle");
const articleEditorStatus = document.getElementById("articleEditorStatus");

const articleTitle = document.getElementById("articleTitle");
const articleSlug = document.getElementById("articleSlug");
const articleExcerpt = document.getElementById("articleExcerpt");
const articleContent = document.getElementById("articleContent");
const articleCategory = document.getElementById("articleCategory");
const articleContentType = document.getElementById("articleContentType");
const articleStatus = document.getElementById("articleStatus");
const articleIsFeatured = document.getElementById("articleIsFeatured");
const articlePublishedAt = document.getElementById("articlePublishedAt");
const articleCoverImage = document.getElementById("articleCoverImage");
const articleCoverPreview = document.getElementById("articleCoverPreview");
const articleSeoTitle = document.getElementById("articleSeoTitle");
const articleSeoDescription = document.getElementById("articleSeoDescription");
const articleSeoKeywords = document.getElementById("articleSeoKeywords");
const articleCanonicalUrl = document.getElementById("articleCanonicalUrl");
const articleMetaRobots = document.getElementById("articleMetaRobots");

function setEditorModeText() {
  if (editorPageTitle) {
    editorPageTitle.textContent = isEditMode ? "編輯品牌內容" : "新增品牌內容";
  }

  if (articleEditorStatus && !isEditMode) {
    articleEditorStatus.textContent = "請填寫文章內容與 SEO 設定。";
  }
}

function setEditorStatus(message) {
  if (articleEditorStatus) {
    articleEditorStatus.textContent = message;
  }
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function syncCategoryByContentType() {
  if (!articleCategory || !articleContentType) return;

  const categoryMap = {
    general: "一般文章",
    seo_article: "SEO 文章",
    research: "花生研究室",
    news: "最新消息",
    brand: "品牌故事",
    report: "檢驗報告",
    faq: "常見問題"
  };

  const nextCategory = categoryMap[articleContentType.value];

  if (nextCategory) {
    articleCategory.value = nextCategory;
  }
}

function toDatetimeLocalValue(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}

function fromDatetimeLocalValue(value) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

function getCurrentDatetimeLocalValue() {
  const now = new Date();
  const offsetDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}

function syncPublishedAtByStatus() {
  if (!articleStatus || !articlePublishedAt) return;

  if (articleStatus.value === "published" && !articlePublishedAt.value) {
    articlePublishedAt.value = getCurrentDatetimeLocalValue();
  }
}

function getImageSrc(image) {
  if (!image) return "";

  const imageText = String(image).trim();

  if (imageText.startsWith("http://") || imageText.startsWith("https://")) return imageText;
  if (imageText.startsWith("images/")) return `../../${imageText}`;
  if (imageText.startsWith("/")) return imageText;

  return `../../images/${imageText}`;
}

function updateCoverPreview() {
  if (!articleCoverPreview) return;

  const imageSrc = getImageSrc(articleCoverImage?.value || "");

  if (!imageSrc) {
    articleCoverPreview.innerHTML = `<span>尚未設定封面圖片</span>`;
    return;
  }

  articleCoverPreview.innerHTML = `
    <img src="${imageSrc}" alt="封面圖片預覽" loading="lazy" onerror="this.parentElement.innerHTML='<span>圖片讀取失敗，請確認路徑或網址</span>'">
  `;
}

function buildCanonicalUrl(slug) {
  if (!slug) return "";
  return `https://impeanut.com/articles/${slug}.html`;
}

function fillForm(article) {
  articleTitle.value = article.title || "";
  articleSlug.value = article.slug || "";
  articleExcerpt.value = article.excerpt || "";
  articleContent.value = article.content || "";
  articleCategory.value = article.category || "一般文章";
  articleContentType.value = article.content_type || "general";
  articleStatus.value = article.status || "draft";
  articleIsFeatured.checked = Boolean(article.is_featured);
  articlePublishedAt.value = toDatetimeLocalValue(article.published_at);
  articleCoverImage.value = article.cover_image || "";
  articleSeoTitle.value = article.seo_title || "";
  articleSeoDescription.value = article.seo_description || "";
  articleSeoKeywords.value = article.seo_keywords || "";
  articleCanonicalUrl.value = article.canonical_url || buildCanonicalUrl(article.slug || "");
  articleMetaRobots.value = article.meta_robots || "index,follow";

  updateCoverPreview();
}

function getPayload() {
  const slug = slugify(articleSlug.value);
  const now = new Date().toISOString();
  const status = articleStatus.value || "draft";

  if (status === "published" && !articlePublishedAt.value) {
    articlePublishedAt.value = getCurrentDatetimeLocalValue();
  }

  const publishedAt = fromDatetimeLocalValue(articlePublishedAt.value) || (status === "published" ? now : null);

  return {
    title: articleTitle.value.trim(),
    slug,
    category: articleCategory.value || "一般文章",
    content_type: articleContentType.value || "general",
    excerpt: articleExcerpt.value.trim(),
    content: articleContent.value.trim(),
    cover_image: articleCoverImage.value.trim(),
    seo_title: articleSeoTitle.value.trim() || articleTitle.value.trim(),
    seo_description: articleSeoDescription.value.trim() || articleExcerpt.value.trim(),
    seo_keywords: articleSeoKeywords.value.trim(),
    status,
    is_featured: articleIsFeatured.checked,
    published_at: publishedAt,
    canonical_url: articleCanonicalUrl.value.trim() || buildCanonicalUrl(slug),
    meta_robots: articleMetaRobots.value || "index,follow",
    updated_at: now
  };
}

async function loadArticle() {
  if (!isEditMode) return;

  if (!window.supabaseClient) {
    setEditorStatus("Supabase 尚未設定");
    return;
  }

  setEditorStatus("文章讀取中...");

  const { data, error } = await window.supabaseClient
    .from("posts")
    .select("*")
    .eq("id", currentArticleId)
    .single();

  if (error) {
    console.error("文章讀取失敗：", error);
    setEditorStatus(`文章讀取失敗：${error.message}`);
    return;
  }

  fillForm(data);
  setEditorStatus("文章已載入，可以開始編輯。");
}

async function saveArticle(event) {
  event.preventDefault();

  if (!window.supabaseClient) {
    setEditorStatus("Supabase 尚未設定");
    return;
  }

  const payload = getPayload();

  if (!payload.title) {
    setEditorStatus("請先輸入文章標題。");
    return;
  }

  if (!payload.slug) {
    setEditorStatus("請先輸入文章 slug。");
    return;
  }

  if (articleSlug) {
    articleSlug.value = payload.slug;
  }

  if (articleCanonicalUrl && !articleCanonicalUrl.value.trim()) {
    articleCanonicalUrl.value = payload.canonical_url;
  }

  setEditorStatus("儲存中...");

  const result = isEditMode
    ? await window.supabaseClient.from("posts").update(payload).eq("id", currentArticleId).select("id").single()
    : await window.supabaseClient.from("posts").insert(payload).select("id").single();

  if (result.error) {
    console.error("文章儲存失敗：", result.error);

    const errorMessage = result.error.message || "";

    if (errorMessage.includes("posts_slug_key") || errorMessage.includes("duplicate key")) {
      setEditorStatus("儲存失敗：這個 slug 已經被使用，請更換網址 slug，或回列表編輯原文章。");
      return;
    }

    setEditorStatus(`儲存失敗：${errorMessage}`);
    return;
  }

  if (!isEditMode && result.data?.id) {
    currentArticleId = result.data.id;
    isEditMode = true;
    window.history.replaceState({}, "", `article-editor.html?id=${currentArticleId}`);
    setEditorModeText();
  }

  setEditorStatus("儲存成功，品牌內容已同步到 Supabase。");
}

articleTitle?.addEventListener("blur", () => {
  if (!articleSlug.value.trim()) {
    articleSlug.value = slugify(articleTitle.value);
  }

  if (!articleSeoTitle.value.trim()) {
    articleSeoTitle.value = articleTitle.value.trim();
  }
});

articleSlug?.addEventListener("input", () => {
  articleSlug.value = slugify(articleSlug.value);
  articleCanonicalUrl.value = buildCanonicalUrl(articleSlug.value);
});

articleContentType?.addEventListener("change", syncCategoryByContentType);
articleStatus?.addEventListener("change", syncPublishedAtByStatus);

articleExcerpt?.addEventListener("blur", () => {
  if (!articleSeoDescription.value.trim()) {
    articleSeoDescription.value = articleExcerpt.value.trim();
  }
});

articleCoverImage?.addEventListener("input", updateCoverPreview);
articleEditorForm?.addEventListener("submit", saveArticle);

syncPublishedAtByStatus();
setEditorModeText();
loadArticle();