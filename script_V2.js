const menuButton = document.getElementById("menuButton");
const mobileMenu = document.getElementById("mobileMenu");
const menuLinks = document.querySelectorAll(".mobile-menu a");

if (menuButton && mobileMenu) {
  menuButton.addEventListener("click", () => {
    menuButton.classList.toggle("active");
    mobileMenu.classList.toggle("active");
  });
}

menuLinks.forEach((link) => {
  link.addEventListener("click", () => {
    menuButton.classList.remove("active");
    mobileMenu.classList.remove("active");
  });
});
