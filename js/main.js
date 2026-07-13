const menuToggle = document.getElementById("menuToggle");
const siteNav = document.getElementById("siteNav");


if (menuToggle && siteNav) {
  menuToggle.addEventListener("click", function () {
    siteNav.classList.toggle("active");
    const isOpen = siteNav.classList.contains("active");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.textContent = isOpen ? "×" : "☰";
  });

  siteNav.addEventListener("click", function (event) {
    if (event.target.closest("a")) {
      siteNav.classList.remove("active");
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.textContent = "☰";
    }
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatArticleDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

function getSafeMarqueeUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "#";
  if (/^(https?:\/\/|\/|[a-z0-9][a-z0-9/_-]*\.html(?:[?#].*)?$)/i.test(url)) return url;
  return "#";
}

async function loadHomeMarquee() {
  const marquee = document.getElementById("homeMarquee");
  const link = document.getElementById("homeMarqueeLink");
  const track = document.getElementById("homeMarqueeTrack");
  if (!marquee || !link || !track || !window.supabaseClient) return;

  const { data, error } = await window.supabaseClient.rpc("get_public_home_settings");
  if (error) {
    console.warn("首頁跑馬燈設定讀取失敗：", error);
    return;
  }

  const settings = Array.isArray(data) ? data[0] : data;
  const text = String(settings?.marquee_text || "").trim();
  if (!settings?.marquee_enabled || !text) return;

  const safeText = escapeHtml(text);
  track.innerHTML = `<span>${safeText}</span><span aria-hidden="true">${safeText}</span><span aria-hidden="true">${safeText}</span><span aria-hidden="true">${safeText}</span>`;
  link.href = getSafeMarqueeUrl(settings.marquee_url);
  if (settings.marquee_new_tab && link.href !== "#") {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }
  marquee.hidden = false;
}

function getArticleCategory(article) {
  const typeMap = {
    seo_article: "SEO 文章",
    research: "花生研究室",
    news: "最新消息",
    brand: "品牌故事",
    report: "檢驗報告",
    faq: "常見問題",
    general: "一般文章"
  };

  return article.category || typeMap[article.content_type] || "一般文章";
}

function renderHomeArticleCard(article) {
  const title = article.title || "未命名文章";
  const slug = article.slug || "";
  const articleId = article.id || "";
  const category = getArticleCategory(article);
  const excerpt = article.excerpt || article.seo_description || "";
  const dateText = formatArticleDate(article.published_at || article.created_at);
  const detailUrl = slug
    ? `articles/${encodeURIComponent(slug)}.html`
    : articleId ? `article.html?id=${encodeURIComponent(articleId)}` : "knowledge.html";

  return `
    <article class="home-article-card">
      <div class="home-article-meta">
        <span>${escapeHtml(category)}</span>
        ${dateText ? `<time>${escapeHtml(dateText)}</time>` : ""}
      </div>

      <h3>
        <a href="${detailUrl}">${escapeHtml(title)}</a>
      </h3>

      ${excerpt ? `<p>${escapeHtml(excerpt)}</p>` : ""}

      <a href="${detailUrl}" class="home-article-link">閱讀文章 →</a>
    </article>
  `;
}

async function loadHomeArticles() {
  const container = document.getElementById("homeArticleList");

  if (!container) return;

  if (!window.supabaseClient) {
    container.innerHTML = `<p class="home-article-loading">文章系統尚未完成設定。</p>`;
    return;
  }

  const { data, error } = await window.supabaseClient
    .from("posts")
    .select("id, title, slug, category, content_type, excerpt, seo_description, status, is_featured, published_at, created_at")
    .eq("status", "published")
    .order("is_featured", { ascending: false })
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(3);

  if (error) {
    console.error("首頁文章讀取失敗：", error);
    container.innerHTML = `<p class="home-article-loading">文章暫時無法載入。</p>`;
    return;
  }

  if (!data || !data.length) {
    container.innerHTML = `<p class="home-article-loading">目前尚無文章。</p>`;
    return;
  }

  container.innerHTML = data.map(renderHomeArticleCard).join("");
}

loadHomeMarquee();
loadHomeArticles();
