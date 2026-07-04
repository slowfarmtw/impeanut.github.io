let currentCategory = "全部";

function renderArticles() {
  const container = document.getElementById("articleList");

  if (!container) return;

  container.innerHTML = "";

  const filteredArticles = ARTICLES.filter(article => {
    if (currentCategory === "全部") return true;
    return article.category === currentCategory;
  });

  filteredArticles.forEach(article => {
    container.innerHTML += `
      <article class="article-card">
        <div class="article-card-image">
          <img 
            src="images/${article.image || "placeholder.png"}" 
            alt="${article.title}"
            onerror="this.src='images/placeholder.png'"
          >
        </div>

        <div class="article-card-body">
          <p class="article-category">${article.category}</p>
          <h2>${article.title}</h2>
          <p class="article-date">${article.date}</p>
          <p class="article-excerpt">${article.excerpt}</p>
          <a href="${article.file}" class="article-link">閱讀文章 →</a>
        </div>
      </article>
    `;
  });

  if (filteredArticles.length === 0) {
    container.innerHTML = `
      <div class="empty-articles">
        <h2>這個分類目前尚無文章</h2>
        <p>我們會慢慢整理更多花生知識與品牌紀錄。</p>
      </div>
    `;
  }
}

function setupCategoryFilter() {
  const buttons = document.querySelectorAll(".category-card");

  buttons.forEach(button => {
   button.addEventListener("click", function () {
  currentCategory = this.dataset.category;

  buttons.forEach(btn => btn.classList.remove("active"));
  this.classList.add("active");

  renderArticles();

  const articleList = document.getElementById("articleList");
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
renderArticles();
