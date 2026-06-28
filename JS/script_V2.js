const menuButton = document.getElementById("menuButton");
const mobileMenu = document.getElementById("mobileMenu");
const menuLinks = document.querySelectorAll(".mobile-menu a");

if (menuButton && mobileMenu) {
  menuButton.addEventListener("click", () => {
    const isOpen = menuButton.classList.toggle("active");

    mobileMenu.classList.toggle("active");
    menuButton.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });
}

menuLinks.forEach((link) => {
  link.addEventListener("click", () => {
    if (menuButton && mobileMenu) {
      menuButton.classList.remove("active");
      mobileMenu.classList.remove("active");
      menuButton.setAttribute("aria-expanded", "false");
    }
  });
});
