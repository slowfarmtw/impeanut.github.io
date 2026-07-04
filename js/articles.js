function renderArticles() {
  const container = document.getElementById("articleList");

  if (!container) return;

  container.innerHTML = "";

  ARTICLES.forEach(article => {
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

  if (container.innerHTML === "") {
    container.innerHTML = "<p>目前尚無文章。</p>";
  }
}

renderArticles();
