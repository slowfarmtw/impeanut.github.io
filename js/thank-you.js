if (window.PEANUT_PURCHASE_MODE === "myship") {
  window.location.replace("order.html");
} else {
function showLastOrderId() {
  const orderId = localStorage.getItem("peanutLastOrderId");
  const target = document.getElementById("lastOrderId");

  if (!target) return;

  if (orderId) {
    target.textContent = orderId;
  } else {
    target.textContent = "系統已收到訂單";
  }
}

showLastOrderId();
}
