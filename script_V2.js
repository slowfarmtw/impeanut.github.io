const menuButton = document.getElementById("menuButton");
const mobileMenu = document.getElementById("mobileMenu");

menuButton.addEventListener("click", () => {
  menuButton.classList.toggle("active");
  mobileMenu.classList.toggle("active");
});
