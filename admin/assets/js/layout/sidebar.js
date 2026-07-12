(() => {
  const sidebar = document.querySelector(".sidebar");
  const nav = sidebar?.querySelector(".nav-menu");

  if (!sidebar || !nav || sidebar.querySelector(".sidebar-menu-toggle")) return;

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "sidebar-menu-toggle";
  toggle.setAttribute("aria-label", "展開導覽選單");
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", "adminNavigation");
  toggle.title = "導覽選單";
  toggle.innerHTML = '<span aria-hidden="true">☰</span>';

  nav.id ||= "adminNavigation";
  sidebar.classList.add("has-mobile-menu");
  sidebar.appendChild(toggle);

  function setMenuOpen(isOpen) {
    sidebar.classList.toggle("is-menu-open", isOpen);
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.setAttribute("aria-label", isOpen ? "收合導覽選單" : "展開導覽選單");
    toggle.innerHTML = `<span aria-hidden="true">${isOpen ? "×" : "☰"}</span>`;
  }

  toggle.addEventListener("click", () => {
    setMenuOpen(!sidebar.classList.contains("is-menu-open"));
  });

  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) setMenuOpen(false);
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 900) setMenuOpen(false);
  });
})();
