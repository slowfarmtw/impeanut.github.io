// js/article.js
// 單篇文章詳情頁：優先依網址 id 從 Supabase posts 讀取文章內容，沒有 id 才用 slug。

const articleCategory = document.getElementById("articleCategory");
const articleTitle = document.getElementById("articleTitle");
const articleExcerpt = document.getElementById("articleExcerpt");
const articleDate = document.getElementById("articleDate");
const articleImageWrap = document.getElementById("articleImageWrap");
const articleCoverImage = document.getElementById("articleCoverImage");
const articleContent = document.getElementById("articleContent");

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

function getArticleParamsFromUrl() {
  const params = new URLSearchParams(window.location.search);

  return {
    id: params.get("id") || "",
    slug: params.get("slug") || ""
  };
}

function setMetaTag(name, content) {
  if (!content) return;

  let meta = document.querySelector(`meta[name="${name}"]`);

  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", name);
    document.head.appendChild(meta);
  }

  meta.setAttribute("content", content);
}

function setCanonical(url) {
  if (!url) return;

  let canonical = document.querySelector('link[rel="canonical"]');

  if (!canonical) {
    canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    document.head.appendChild(canonical);
  }

  canonical.setAttribute("href", url);
}

function convertTextToHtml(content) {
  if (!content) return "<p>這篇文章目前尚未填寫內容。</p>";

  const rawContent = String(content).trim();

  if (rawContent.includes("<p") || rawContent.includes("<h2") || rawContent.includes("<ul") || rawContent.includes("<ol") || rawContent.includes("<blockquote") || rawContent.includes("<figure") || rawContent.includes("<img")) {
    return rawContent;
  }

  return rawContent
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`)
    .join("");
}

function showError(title, message) {
  if (articleCategory) articleCategory.textContent = "文章未找到";
  if (articleTitle) articleTitle.textContent = title;
  if (articleExcerpt) articleExcerpt.textContent = message;
  if (articleDate) articleDate.textContent = "";
  if (articleImageWrap) articleImageWrap.hidden = true;

  if (articleContent) {
    articleContent.innerHTML = `
      <p class="article-error">${escapeHtml(message)}</p>
      <p class="article-error"><a href="knowledge.html">返回花生知識</a></p>
    `;
  }
}

function renderArticle(article) {
  const title = article.title || "未命名文章";
  const category = article.post_categories?.name || article.category || getTypeCategoryFallback(article.content_type);
  const excerpt = article.excerpt || article.seo_description || "";
  const dateText = formatDate(article.published_at || article.created_at);
  const imageSrc = getArticleImageSrc(article.cover_image);
  const canonicalUrl = article.canonical_url || `https://impeanut.com/article.html?id=${encodeURIComponent(article.id || "")}${article.slug ? `&slug=${encodeURIComponent(article.slug)}` : ""}`;
  const seoTitle = article.seo_title || `${title}｜花生一生`;
  const seoDescription = article.seo_description || excerpt || "花生一生品牌文章。";

  document.title = seoTitle;
  setMetaTag("description", seoDescription);
  setMetaTag("robots", article.meta_robots || "index,follow");
  setCanonical(canonicalUrl);

  if (articleCategory) articleCategory.textContent = category;
  if (articleTitle) articleTitle.textContent = title;
  if (articleExcerpt) articleExcerpt.textContent = excerpt || "";
  if (articleDate) articleDate.textContent = dateText ? `發布日期：${dateText}` : "";

  if (imageSrc && articleImageWrap && articleCoverImage) {
    articleCoverImage.src = imageSrc;
    articleCoverImage.alt = title;
    articleCoverImage.onerror = () => {
      articleImageWrap.hidden = true;
    };
    articleImageWrap.hidden = false;
  } else if (articleImageWrap) {
    articleImageWrap.hidden = true;
  }

  if (articleContent) {
    articleContent.innerHTML = convertTextToHtml(article.content);
  }
}

async function loadArticle() {
  const { id, slug } = getArticleParamsFromUrl();

  if (!id && !slug) {
    showError("找不到文章網址", "這篇文章缺少 id 或 slug，請從花生知識列表重新進入。");
    return;
  }

  if (!window.supabaseClient) {
    showError("文章系統尚未完成設定", "請確認 Supabase 設定檔已正確載入。");
    return;
  }

  if (articleContent) {
    articleContent.innerHTML = `<p class="article-loading">文章載入中...</p>`;
  }

  let query = window.supabaseClient
    .from("posts")
    .select("id, title, slug, category, category_id, post_categories(name, slug, parent_id), content_type, excerpt, content, cover_image, seo_title, seo_description, status, published_at, created_at, canonical_url, meta_robots")
    .eq("status", "published");

  if (id) {
    query = query.eq("id", id);
  } else {
    query = query.eq("slug", slug);
  }

  const { data, error } = await query.single();

  if (error || !data) {
    console.error("單篇文章讀取失敗：", error);
    showError("找不到這篇文章", "這篇文章可能尚未發布，或網址 id / slug 不正確。");
    return;
  }

  renderArticle(data);
}

loadArticle();
