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
const articleEditorToolbar = document.getElementById("articleEditorToolbar");
const articleBlockFormat = document.getElementById("articleBlockFormat");
const articleTextColor = document.getElementById("articleTextColor");
const articleLinkButton = document.getElementById("articleLinkButton");
const articleImageButton = document.getElementById("articleImageButton");
const articleImageDialog = document.getElementById("articleImageDialog");
const articleImageFile = document.getElementById("articleImageFile");
const articleImageAlt = document.getElementById("articleImageAlt");
const articleImageCaption = document.getElementById("articleImageCaption");
const articleImageSize = document.getElementById("articleImageSize");
const articleImageAlign = document.getElementById("articleImageAlign");
const articleImagePreview = document.getElementById("articleImagePreview");
const articleImageStatus = document.getElementById("articleImageStatus");
const articleImageUploadButton = document.getElementById("articleImageUploadButton");
const articleCategoryId = document.getElementById("articleCategoryId");
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
const staticArticlePreview = document.getElementById("staticArticlePreview");

function updateStaticPreview(slug, status) {
  if (!staticArticlePreview) return;
  const canPreview = Boolean(slug) && status === "published";
  staticArticlePreview.hidden = !canPreview;
  if (canPreview) staticArticlePreview.href = `../../articles/${encodeURIComponent(slug)}.html`;
}

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

const ARTICLE_ALLOWED_TAGS = new Set([
  "P", "H2", "H3", "H4", "UL", "OL", "LI", "STRONG", "B", "EM", "I",
  "U", "S", "BLOCKQUOTE", "A", "BR", "SPAN", "IMG", "FIGURE", "FIGCAPTION"
]);

const ARTICLE_FONT_SIZE_MAP = {
  "1": "12px",
  "2": "14px",
  "3": "16px",
  "4": "18px",
  "5": "24px",
  "6": "30px",
  "7": "36px"
};

function isSafeArticleUrl(value, allowImagePath = false) {
  const url = String(value || "").trim();
  if (!url) return false;
  if (/^(https?:|mailto:|tel:|#|\/)/i.test(url)) return true;
  return allowImagePath && /^(\.\.\/|images\/)/i.test(url);
}

function normalizeEditorHtml(container) {
  container.querySelectorAll("font").forEach((font) => {
    const span = document.createElement("span");
    const size = font.getAttribute("size");
    const color = font.getAttribute("color");
    if (size && ARTICLE_FONT_SIZE_MAP[size]) span.style.fontSize = ARTICLE_FONT_SIZE_MAP[size];
    if (color) span.style.color = color;
    span.append(...font.childNodes);
    font.replaceWith(span);
  });

  container.querySelectorAll("div").forEach((div) => {
    const paragraph = document.createElement("p");
    paragraph.style.color = div.style.color;
    paragraph.style.backgroundColor = div.style.backgroundColor;
    paragraph.style.fontSize = div.style.fontSize;
    paragraph.style.textAlign = div.style.textAlign;
    paragraph.append(...div.childNodes);
    div.replaceWith(paragraph);
  });
}

function sanitizeArticleHtml(value) {
  const template = document.createElement("template");
  template.innerHTML = String(value || "");
  normalizeEditorHtml(template.content);

  const blockedTags = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "FORM", "INPUT", "BUTTON"]);

  [...template.content.querySelectorAll("*")].forEach((element) => {
    if (blockedTags.has(element.tagName)) {
      element.remove();
      return;
    }

    if (!ARTICLE_ALLOWED_TAGS.has(element.tagName)) {
      element.replaceWith(...element.childNodes);
      return;
    }

    const originalStyle = {
      color: element.style.color,
      backgroundColor: element.style.backgroundColor,
      fontSize: element.style.fontSize,
      textAlign: element.style.textAlign
    };
    const href = element.getAttribute("href");
    const src = element.getAttribute("src");
    const alt = element.getAttribute("alt") || "";
    const originalClasses = [...element.classList];

    [...element.attributes].forEach((attribute) => element.removeAttribute(attribute.name));

    if (originalStyle.color && /^(#[0-9a-f]{3,8}|rgba?\([0-9.,%\s]+\)|[a-z]+)$/i.test(originalStyle.color)) {
      element.style.color = originalStyle.color;
    }
    if (originalStyle.backgroundColor && /^(#[0-9a-f]{3,8}|rgba?\([0-9.,%\s]+\)|[a-z]+)$/i.test(originalStyle.backgroundColor)) {
      element.style.backgroundColor = originalStyle.backgroundColor;
    }
    if (originalStyle.fontSize && /^(12|14|16|18|20|24|30|36)px$/.test(originalStyle.fontSize)) {
      element.style.fontSize = originalStyle.fontSize;
    }
    if (["left", "center", "right", "justify"].includes(originalStyle.textAlign)) {
      element.style.textAlign = originalStyle.textAlign;
    }

    if (element.tagName === "A" && isSafeArticleUrl(href)) {
      element.setAttribute("href", href.trim());
      if (/^https?:/i.test(href)) {
        element.setAttribute("target", "_blank");
        element.setAttribute("rel", "noopener noreferrer");
      }
    }

    if (element.tagName === "IMG" && isSafeArticleUrl(src, true)) {
      element.setAttribute("src", src.trim());
      element.setAttribute("alt", alt);
      element.setAttribute("loading", "lazy");
    }

    if (element.tagName === "FIGURE") {
      const allowedClasses = originalClasses.filter((className) => [
        "article-media", "article-media--full", "article-media--large", "article-media--medium",
        "article-media--left", "article-media--center", "article-media--right"
      ].includes(className));
      if (allowedClasses.length) element.className = allowedClasses.join(" ");
    }
  });

  return template.innerHTML.trim();
}

function plainTextToEditorHtml(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/<[a-z][\s\S]*>/i.test(raw)) return sanitizeArticleHtml(raw);

  const escapeText = (text) => {
    const node = document.createElement("div");
    node.textContent = text;
    return node.innerHTML;
  };

  const lines = raw.split(/\r?\n/);
  let html = "";
  let listItems = [];
  const flushList = () => {
    if (!listItems.length) return;
    html += `<ul>${listItems.map((item) => `<li>${escapeText(item)}</li>`).join("")}</ul>`;
    listItems = [];
  };

  lines.forEach((line) => {
    const text = line.trim();
    if (!text) {
      flushList();
      return;
    }
    if (text.startsWith("### ")) {
      flushList();
      html += `<h3>${escapeText(text.slice(4))}</h3>`;
    } else if (text.startsWith("## ")) {
      flushList();
      html += `<h2>${escapeText(text.slice(3))}</h2>`;
    } else if (text.startsWith("- ")) {
      listItems.push(text.slice(2));
    } else {
      flushList();
      html += `<p>${escapeText(text)}</p>`;
    }
  });
  flushList();
  return html;
}

let savedArticleRange = null;

function saveArticleSelection() {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !articleContent) return;
  const range = selection.getRangeAt(0);
  if (articleContent.contains(range.commonAncestorContainer)) {
    savedArticleRange = range.cloneRange();
    updateArticleToolbarState();
  }
}

function updateArticleToolbarState() {
  if (!articleEditorToolbar || !articleContent) return;

  const stateCommands = new Set([
    "bold", "italic", "underline", "strikeThrough", "insertUnorderedList",
    "insertOrderedList", "justifyLeft", "justifyCenter", "justifyRight", "justifyFull"
  ]);

  articleEditorToolbar.querySelectorAll("button[data-command]").forEach((button) => {
    if (!stateCommands.has(button.dataset.command)) return;
    let isActive = false;
    try {
      isActive = document.queryCommandState(button.dataset.command);
    } catch (error) {
      isActive = false;
    }
    button.classList.toggle("is-active", isActive);
  });

  try {
    const block = String(document.queryCommandValue("formatBlock") || "p").toLowerCase().replace(/[<>]/g, "");
    if (["p", "h2", "h3", "blockquote"].includes(block)) articleBlockFormat.value = block;
  } catch (error) {
    articleBlockFormat.value = "p";
  }

  try {
    const fontSize = String(document.queryCommandValue("fontSize") || "3");
    articleEditorToolbar.querySelectorAll("button[data-font-size]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.fontSize === fontSize);
    });
  } catch (error) {
    // 瀏覽器不回報字級狀態時，仍可正常套用格式。
  }
}

function restoreArticleSelection() {
  if (!savedArticleRange) return false;
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(savedArticleRange);
  return true;
}

function runArticleCommand(command, value = null) {
  if (!articleContent) return;
  articleContent.focus();
  restoreArticleSelection();
  document.execCommand(command, false, value);
  normalizeEditorHtml(articleContent);
  saveArticleSelection();
}

function setupRichTextEditor() {
  if (!articleContent || !articleEditorToolbar) return;

  document.addEventListener("selectionchange", saveArticleSelection);

  articleEditorToolbar.querySelectorAll("button[data-command]").forEach((button) => {
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => runArticleCommand(button.dataset.command));
  });

  articleBlockFormat?.addEventListener("change", () => {
    runArticleCommand("formatBlock", articleBlockFormat.value);
  });

  articleEditorToolbar.querySelectorAll("button[data-font-size]").forEach((button) => {
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => runArticleCommand("fontSize", button.dataset.fontSize));
  });

  articleEditorToolbar.querySelectorAll("button[data-text-color]").forEach((button) => {
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => runArticleCommand("foreColor", button.dataset.textColor));
  });

  articleEditorToolbar.querySelectorAll("button[data-highlight-color]").forEach((button) => {
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => runArticleCommand("hiliteColor", button.dataset.highlightColor));
  });

  articleTextColor?.addEventListener("input", () => {
    runArticleCommand("foreColor", articleTextColor.value);
  });

  articleTextColor?.addEventListener("mousedown", saveArticleSelection);
  articleTextColor?.addEventListener("pointerdown", saveArticleSelection);

  articleLinkButton?.addEventListener("mousedown", (event) => event.preventDefault());
  articleLinkButton?.addEventListener("click", () => {
    restoreArticleSelection();
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      alert("請先選取要加入連結的文字。");
      return;
    }
    const url = prompt("請輸入連結網址，例如：https://example.com");
    if (!url) return;
    if (!isSafeArticleUrl(url)) {
      alert("連結格式不正確，請使用 https://、mailto:、tel: 或站內路徑。");
      return;
    }
    runArticleCommand("createLink", url.trim());
  });

  // 不在失焦時重建 HTML，避免開啟系統選色器時遺失原本選取的文字。
  // 儲存文章時仍會統一執行 sanitizeArticleHtml。
}

const ARTICLE_IMAGE_BUCKET = "article-images";
const ARTICLE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const ARTICLE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
let articleImagePreviewUrl = "";

function setArticleImageStatus(message, isError = false) {
  if (!articleImageStatus) return;
  articleImageStatus.textContent = message;
  articleImageStatus.classList.toggle("is-error", isError);
}

function clearArticleImagePreview() {
  if (articleImagePreviewUrl) URL.revokeObjectURL(articleImagePreviewUrl);
  articleImagePreviewUrl = "";
  if (articleImagePreview) articleImagePreview.innerHTML = "<span>圖片預覽</span>";
}

function resetArticleImageDialog() {
  clearArticleImagePreview();
  if (articleImageFile) articleImageFile.value = "";
  if (articleImageAlt) articleImageAlt.value = "";
  if (articleImageCaption) articleImageCaption.value = "";
  if (articleImageSize) articleImageSize.value = "large";
  if (articleImageAlign) articleImageAlign.value = "center";
  if (articleImageUploadButton) articleImageUploadButton.disabled = false;
  setArticleImageStatus("請先選擇圖片。");
}

function openArticleImageDialog() {
  if (!articleImageDialog) return;
  saveArticleSelection();
  resetArticleImageDialog();
  articleImageDialog.hidden = false;
  document.body.classList.add("image-dialog-open");
  articleImageFile?.focus();
}

function closeArticleImageDialog() {
  if (!articleImageDialog) return;
  articleImageDialog.hidden = true;
  document.body.classList.remove("image-dialog-open");
  clearArticleImagePreview();
  articleContent?.focus();
  restoreArticleSelection();
}

function validateArticleImage(file) {
  if (!file) return "請先選擇圖片。";
  if (!ARTICLE_IMAGE_TYPES.has(file.type)) return "圖片格式不支援，請使用 JPG、PNG、WebP 或 AVIF。";
  if (file.size > ARTICLE_IMAGE_MAX_BYTES) return "圖片超過 5MB，請先壓縮後再上傳。";
  return "";
}

function renderArticleImagePreview(file) {
  clearArticleImagePreview();
  const error = validateArticleImage(file);
  if (error) {
    setArticleImageStatus(error, true);
    return;
  }
  articleImagePreviewUrl = URL.createObjectURL(file);
  const image = document.createElement("img");
  image.src = articleImagePreviewUrl;
  image.alt = "待上傳圖片預覽";
  articleImagePreview.innerHTML = "";
  articleImagePreview.appendChild(image);
  if (articleImageAlt && !articleImageAlt.value.trim()) {
    articleImageAlt.value = file.name.replace(/\.[^.]+$/, "").replaceAll(/[-_]+/g, " ");
  }
  setArticleImageStatus(`已選擇 ${file.name}（${Math.ceil(file.size / 1024)}KB）`);
}

function buildArticleImagePath(file) {
  const extensionMap = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif"
  };
  const extension = extensionMap[file.type] || "webp";
  const baseName = file.name.replace(/\.[^.]+$/, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "article-image";
  const articleFolder = slugify(articleSlug?.value || "") || currentArticleId || "draft";
  const uniquePart = globalThis.crypto?.randomUUID?.().slice(0, 8) || Math.random().toString(36).slice(2, 10);
  return `${articleFolder}/${Date.now()}-${uniquePart}-${baseName}.${extension}`;
}

function insertArticleImage(publicUrl, altText, captionText, size, align) {
  if (!articleContent) return;

  const figure = document.createElement("figure");
  figure.className = `article-media article-media--${size} article-media--${align}`;
  const image = document.createElement("img");
  image.src = publicUrl;
  image.alt = altText;
  image.loading = "lazy";
  figure.appendChild(image);

  if (captionText) {
    const caption = document.createElement("figcaption");
    caption.textContent = captionText;
    figure.appendChild(caption);
  }

  const trailingParagraph = document.createElement("p");
  trailingParagraph.appendChild(document.createElement("br"));

  articleContent.focus();
  const selectionRestored = restoreArticleSelection();
  const selection = window.getSelection();

  if (selectionRestored && selection?.rangeCount) {
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(trailingParagraph);
    range.insertNode(figure);
  } else {
    articleContent.append(figure, trailingParagraph);
  }

  const nextRange = document.createRange();
  nextRange.selectNodeContents(trailingParagraph);
  nextRange.collapse(true);
  selection?.removeAllRanges();
  selection?.addRange(nextRange);
  savedArticleRange = nextRange.cloneRange();
}

async function uploadAndInsertArticleImage() {
  const file = articleImageFile?.files?.[0];
  const validationError = validateArticleImage(file);
  if (validationError) {
    setArticleImageStatus(validationError, true);
    return;
  }

  const altText = articleImageAlt?.value.trim() || "";
  if (!altText) {
    setArticleImageStatus("請填寫圖片替代文字（alt）。", true);
    articleImageAlt?.focus();
    return;
  }

  if (!window.supabaseClient) {
    setArticleImageStatus("Supabase 尚未設定，無法上傳圖片。", true);
    return;
  }

  articleImageUploadButton.disabled = true;
  setArticleImageStatus("圖片上傳中，請稍候…");

  const storagePath = buildArticleImagePath(file);
  const { error } = await window.supabaseClient.storage
    .from(ARTICLE_IMAGE_BUCKET)
    .upload(storagePath, file, { cacheControl: "31536000", upsert: false, contentType: file.type });

  if (error) {
    console.error("文章圖片上傳失敗：", error);
    articleImageUploadButton.disabled = false;
    const setupHint = /bucket|policy|row-level|not found|unauthorized/i.test(error.message || "")
      ? " 請確認已執行 docs/article-images-storage.sql。"
      : "";
    setArticleImageStatus(`上傳失敗：${error.message || "未知錯誤"}${setupHint}`, true);
    return;
  }

  const { data } = window.supabaseClient.storage.from(ARTICLE_IMAGE_BUCKET).getPublicUrl(storagePath);
  if (!data?.publicUrl) {
    articleImageUploadButton.disabled = false;
    setArticleImageStatus("圖片已上傳，但無法取得公開網址。請確認 bucket 已設為 public。", true);
    return;
  }

  insertArticleImage(
    data.publicUrl,
    altText,
    articleImageCaption?.value.trim() || "",
    articleImageSize?.value || "medium",
    articleImageAlign?.value || "center"
  );
  setArticleImageStatus("圖片已上傳並插入文章。");
  closeArticleImageDialog();
}

function setupArticleImageUploader() {
  if (!articleImageButton || !articleImageDialog) return;
  articleImageButton.addEventListener("mousedown", (event) => event.preventDefault());
  articleImageButton.addEventListener("click", openArticleImageDialog);
  articleImageFile?.addEventListener("change", () => renderArticleImagePreview(articleImageFile.files?.[0]));
  articleImageUploadButton?.addEventListener("click", uploadAndInsertArticleImage);
  articleImageDialog.querySelectorAll("[data-close-image-dialog]").forEach((button) => {
    button.addEventListener("click", closeArticleImageDialog);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !articleImageDialog.hidden) closeArticleImageDialog();
  });
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function syncCategoryByContentType() {
  const typeToSlug = {
    general: "general",
    seo_article: "seo",
    research: "research",
    news: "news",
    brand: "brand-story",
    report: "reports",
    faq: "faq"
  };
  const matchingCategory = categoryRecords.find((item) => !item.parent_id && item.slug === typeToSlug[articleContentType?.value]);
  if (matchingCategory && articleCategoryId) articleCategoryId.value = matchingCategory.id;
}

function syncContentTypeByCategory() {
  if (!articleCategoryId || !articleContentType) return;
  const selected = categoryRecords.find((item) => item.id === articleCategoryId.value);
  if (!selected) return;
  const root = selected.parent_id
    ? categoryRecords.find((item) => item.id === selected.parent_id)
    : selected;
  const slugToType = {
    general: "general",
    seo: "seo_article",
    research: "research",
    news: "news",
    "brand-story": "brand",
    reports: "report",
    faq: "faq"
  };
  if (root && slugToType[root.slug]) articleContentType.value = slugToType[root.slug];
}

let categoryRecords = [];

function renderCategoryOptions(selectedId = "") {
  if (!articleCategoryId) return;
  const escapeOptionText = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
  const parents = categoryRecords.filter((item) => !item.parent_id);
  const knownIds = new Set(categoryRecords.map((item) => item.id));
  const nestedOptions = parents.map((parent) => {
    const children = categoryRecords.filter((item) => item.parent_id === parent.id);
    const parentState = parent.is_visible === false ? "（停用）" : "";
    return `<option value="${escapeOptionText(parent.id)}">${escapeOptionText(parent.name)}${parentState}</option>` + children
      .map((child) => `<option value="${escapeOptionText(child.id)}">　└ ${escapeOptionText(parent.name)} ＞ ${escapeOptionText(child.name)}${child.is_visible === false ? "（停用）" : ""}</option>`).join("");
  }).join("");
  const orphanOptions = categoryRecords
    .filter((item) => item.parent_id && !knownIds.has(item.parent_id))
    .map((item) => `<option value="${escapeOptionText(item.id)}">${escapeOptionText(item.name)}${item.is_visible === false ? "（停用）" : ""}</option>`)
    .join("");
  articleCategoryId.innerHTML = '<option value="">未分類</option>' + nestedOptions + orphanOptions;
  articleCategoryId.value = selectedId || "";
}

async function loadCategories(selectedId = "") {
  const { data, error } = await window.supabaseClient.from("post_categories")
    .select("id, name, slug, parent_id, sort_order, is_visible")
    .order("sort_order", { ascending: true }).order("name", { ascending: true });
  if (error) {
    console.error("分類讀取失敗：", error);
    if (articleCategoryId) articleCategoryId.innerHTML = '<option value="">請先執行分類資料庫設定</option>';
    return;
  }
  categoryRecords = data || [];
  renderCategoryOptions(selectedId);
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

async function fillForm(article) {
  articleTitle.value = article.title || "";
  articleSlug.value = article.slug || "";
  articleExcerpt.value = article.excerpt || "";
  articleContent.innerHTML = plainTextToEditorHtml(article.content || "");
  await loadCategories(article.category_id || "");
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
  updateStaticPreview(article.slug, article.status);

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

  const sanitizedContent = sanitizeArticleHtml(articleContent.innerHTML);
  articleContent.innerHTML = sanitizedContent;

  return {
    title: articleTitle.value.trim(),
    slug,
    category_id: articleCategoryId.value || null,
    content_type: articleContentType.value || "general",
    excerpt: articleExcerpt.value.trim(),
    content: sanitizedContent,
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

  await fillForm(data);
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

  updateStaticPreview(payload.slug, payload.status);
  setEditorStatus(payload.status === "published"
    ? "儲存成功。靜態 SEO 頁會在 GitHub Actions 下次同步後更新（最長約 15 分鐘）。"
    : "儲存成功，品牌內容已同步到 Supabase。");
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
articleCategoryId?.addEventListener("change", syncContentTypeByCategory);
articleStatus?.addEventListener("change", syncPublishedAtByStatus);

articleExcerpt?.addEventListener("blur", () => {
  if (!articleSeoDescription.value.trim()) {
    articleSeoDescription.value = articleExcerpt.value.trim();
  }
});

articleCoverImage?.addEventListener("input", updateCoverPreview);
articleEditorForm?.addEventListener("submit", saveArticle);

setupRichTextEditor();
setupArticleImageUploader();
syncPublishedAtByStatus();
setEditorModeText();
(async () => {
  if (!isEditMode) await loadCategories();
  await loadArticle();
})();
