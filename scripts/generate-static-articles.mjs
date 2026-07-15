import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const articlesDir = join(root, "articles");
const siteUrl = "https://impeanut.com";
let supabaseUrl = process.env.SUPABASE_URL;
let supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  const publicConfig = await readFile(join(root, "admin/assets/js/services/supabase-config.js"), "utf8");
  supabaseUrl ||= publicConfig.match(/SUPABASE_URL\s*=\s*["']([^"']+)/)?.[1];
  supabaseKey ||= publicConfig.match(/SUPABASE_ANON_KEY\s*=\s*["']([^"']+)/)?.[1];
}

if (!supabaseUrl || !supabaseKey) {
  throw new Error("缺少 SUPABASE_URL 或 SUPABASE_ANON_KEY 環境變數。");
}

const escapeHtml = (value = "") => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const safeSlug = (value = "") => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) ? value : "";
const absoluteImage = (value = "") => {
  if (/^https?:\/\//.test(value)) return value;
  const normalized = String(value).replace(/^\.\.\//, "").replace(/^\//, "");
  return normalized ? `${siteUrl}/${normalized}` : `${siteUrl}/images/articles/article-placeholder.jpg`;
};
const formatDate = (value) => value ? new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Taipei" }).format(new Date(value)) : "";

function contentToHtml(content = "") {
  const raw = String(content).trim();
  if (!raw) return "<p>這篇文章目前尚未填寫內容。</p>";
  if (/<(p|h2|h3|ul|ol|blockquote|figure|img)[\s>]/i.test(raw)) return raw;
  const lines = raw.split(/\r?\n/); let html = ""; let list = [];
  const flushList = () => { if (list.length) { html += `<ul>${list.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`; list = []; } };
  for (const line of lines) {
    const text = line.trim();
    if (!text) { flushList(); continue; }
    if (text.startsWith("### ")) { flushList(); html += `<h3>${escapeHtml(text.slice(4))}</h3>`; }
    else if (text.startsWith("## ")) { flushList(); html += `<h2>${escapeHtml(text.slice(3))}</h2>`; }
    else if (text.startsWith("- ")) list.push(text.slice(2));
    else { flushList(); html += `<p>${escapeHtml(text)}</p>`; }
  }
  flushList(); return html;
}

async function supabase(path) {
  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/${path}`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  return response.json();
}

const fetchedPosts = await supabase("posts?status=eq.published&select=id,title,slug,excerpt,content,cover_image,seo_title,seo_description,seo_keywords,published_at,updated_at,created_at,canonical_url,meta_robots,category_id&order=published_at.desc.nullslast");
const postsBySlug = new Map();
for (const post of fetchedPosts) {
  const slug = safeSlug(post.slug);
  if (slug && !postsBySlug.has(slug)) postsBySlug.set(slug, post);
}
const posts = [...postsBySlug.values()];
let categories = [];
try { categories = await supabase("post_categories?select=id,name,slug,parent_id,is_visible&is_visible=eq.true"); } catch (error) { console.warn("分類資料讀取失敗，文章仍會產生：", error.message); }
const categoryMap = new Map(categories.map((item) => [item.id, item]));

function renderArticle(post) {
  const slug = safeSlug(post.slug); const canonical = `${siteUrl}/articles/${slug}.html`;
  const title = post.seo_title || `${post.title}｜花生一生`; const description = post.seo_description || post.excerpt || "花生一生品牌文章。";
  const image = absoluteImage(post.cover_image); const category = categoryMap.get(post.category_id); const parent = category?.parent_id ? categoryMap.get(category.parent_id) : null;
  const categoryLabel = [parent?.name, category?.name].filter(Boolean).join("・") || "花生知識";
  const date = post.published_at || post.created_at; const updated = post.updated_at || date;
  const robots = String(post.meta_robots || "index,follow").replace(/["']/g, "").trim();
  const jsonLd = JSON.stringify({ "@context": "https://schema.org", "@type": "Article", headline: post.title, description, image: [image], datePublished: date, dateModified: updated, mainEntityOfPage: canonical, author: { "@type": "Organization", name: "花生一生" }, publisher: { "@type": "Organization", name: "花生一生", logo: { "@type": "ImageObject", url: `${siteUrl}/images/logo.png` } } }).replaceAll("<", "\\u003c");
  return `<!DOCTYPE html>
<html lang="zh-Hant"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="${escapeHtml(robots)}"><link rel="canonical" href="${canonical}">
<meta property="og:type" content="article"><meta property="og:locale" content="zh_TW"><meta property="og:site_name" content="花生一生"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${escapeHtml(image)}">
<meta name="twitter:card" content="summary_large_image"><script type="application/ld+json">${jsonLd}</script><link rel="icon" href="../icons/icon.png">
<link rel="stylesheet" href="../css/style.css?v=20260712"><link rel="stylesheet" href="../css/footer.css"><link rel="stylesheet" href="../css/mobile.css"><link rel="stylesheet" href="../css/cart-ui.css"><link rel="stylesheet" href="../css/brand-system.css?v=1"><link rel="stylesheet" href="../css/article.css?v=20260715-2"></head>
<body><header class="site-header"><a href="../index.html" class="logo-area"><img src="../images/logo.png" alt="花生一生 Logo"></a><button class="menu-toggle" id="menuToggle" aria-label="開啟網站選單" aria-controls="siteNav" aria-expanded="false">☰</button><nav class="site-nav" id="siteNav" aria-label="主要導覽"><a href="../index.html">首頁</a><a href="../about.html">品牌理念</a><a href="../life.html">花生的一生</a><a href="../products.html">產品介紹</a><a href="../knowledge.html">花生知識</a><a href="../cart.html">購物車</a><a href="../contact.html">聯絡我們</a></nav></header>
<main class="article-page"><section class="article-hero"><a href="../knowledge.html" class="article-back-link">← 回花生知識</a><p class="article-category">${escapeHtml(categoryLabel)}</p><h1>${escapeHtml(post.title)}</h1>${post.excerpt ? `<p class="article-excerpt">${escapeHtml(post.excerpt)}</p>` : ""}<p class="article-date">${date ? `發布日期：${escapeHtml(formatDate(date))}` : ""}</p></section>
${post.cover_image ? `<section class="article-feature-image-wrap"><img src="${escapeHtml(image)}" alt="${escapeHtml(post.title)}" loading="eager"></section>` : ""}<article class="article-content">${contentToHtml(post.content)}</article><section class="article-bottom-actions"><a href="../knowledge.html" class="article-back-button">返回花生知識</a><a href="../products.html" class="article-product-link">查看產品</a></section></main>
<footer class="site-footer"><div><h3>從從農農｜花生一生</h3><p>來自雲林元長的花生品牌。</p></div><div><h4>網站導覽</h4><a href="../about.html">品牌理念</a><a href="../products.html">產品介紹</a><a href="../contact.html">聯絡我們</a></div></footer><script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script><script src="../admin/assets/js/services/supabase-config.js?v=20260712"></script><script src="../js/analytics.js?v=20260712"></script><script src="../js/main.js?v=20260712"></script><script src="../js/cart-ui.js?v=20260712"></script></body></html>`;
}

await mkdir(articlesDir, { recursive: true });
const generated = new Set();
for (const post of posts) {
  const slug = safeSlug(post.slug);
  const robots = String(post.meta_robots || "").replace(/["']/g, "");
  if (!slug || robots.includes("noindex")) continue;
  await writeFile(join(articlesDir, `${slug}.html`), renderArticle(post)); generated.add(`${slug}.html`);
}
for (const file of await readdir(articlesDir)) {
  if (file.endsWith(".html") && !generated.has(file)) await unlink(join(articlesDir, file));
}

const baseSitemap = await readFile(join(root, "sitemap.xml"), "utf8");
const markerStart = "  <!-- GENERATED_ARTICLES_START -->"; const markerEnd = "  <!-- GENERATED_ARTICLES_END -->";
const articleUrls = posts.filter((post) => safeSlug(post.slug) && !String(post.meta_robots || "").replace(/["']/g, "").includes("noindex")).map((post) => `  <url><loc>${siteUrl}/articles/${post.slug}.html</loc><lastmod>${String(post.updated_at || post.published_at || post.created_at).slice(0, 10)}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`).join("\n");
const generatedBlock = `${markerStart}\n${articleUrls}\n${markerEnd}`;
const sitemap = baseSitemap.includes(markerStart) ? baseSitemap.replace(new RegExp(`${markerStart}[\\s\\S]*?${markerEnd}`), generatedBlock) : baseSitemap.replace("</urlset>", `${generatedBlock}\n</urlset>`);
await writeFile(join(root, "sitemap.xml"), sitemap);
console.log(`已產生 ${generated.size} 篇靜態 SEO 文章。`);
