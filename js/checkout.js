function getCart() {
  return JSON.parse(localStorage.getItem("peanutCart")) || [];
}

function saveOrderDraft(order) {
  localStorage.setItem("peanutOrderDraft", JSON.stringify(order));
}

function formatPrice(price) {
  return `NT$ ${Number(price).toLocaleString()}`;
}

function renderCheckoutSummary() {
  const container = document.getElementById("checkoutSummary");
  const cart = getCart();

  if (!container) return;

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="checkout-empty">
        <p>購物車目前是空的。</p>
        <a href="products.html">回產品介紹</a>
      </div>
    `;
    return;
  }

  let total = 0;

  const itemsHtml = cart.map(item => {
    const subtotal = item.price * item.quantity;
    total += subtotal;

    return `
      <div class="checkout-summary-item">
        <div>
          <strong>${item.name}</strong>
          <p>${item.weight || ""} × ${item.quantity}</p>
        </div>
        <span>${formatPrice(subtotal)}</span>
      </div>
    `;
  }).join("");

  container.innerHTML = `
    <div class="checkout-summary-list">
      ${itemsHtml}
    </div>

    <div class="checkout-summary-row">
      <span>商品小計</span>
      <strong>${formatPrice(total)}</strong>
    </div>

    <div class="checkout-summary-row">
      <span>運費</span>
      <strong>尚未計算</strong>
    </div>

    <div class="checkout-summary-total">
      <span>目前合計</span>
      <strong>${formatPrice(total)}</strong>
    </div>

    <p class="checkout-summary-note">
      實際運費與付款資訊，將於訂單確認後通知。
    </p>
  `;
}

function handleCheckoutSubmit() {
  const form = document.getElementById("checkoutForm");
  const message = document.getElementById("checkoutMessage");

  if (!form) return;

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    const cart = getCart();

    if (cart.length === 0) {
      message.textContent = "購物車目前是空的，請先選擇商品。";
      return;
    }

    const total = cart.reduce((sum, item) => {
      return sum + item.price * item.quantity;
    }, 0);
    const orderId = "PL" + new Date().toISOString()
  .replace(/[-:TZ.]/g, "")
  .slice(0, 14);

    const order = {
      orderId: orderId,
      customer: {
        name: document.getElementById("customerName").value.trim(),
        phone: document.getElementById("customerPhone").value.trim(),
        email: document.getElementById("customerEmail").value.trim(),
        deliveryMethod: document.getElementById("deliveryMethod").value,
        address: document.getElementById("customerAddress").value.trim(),
        paymentMethod: document.getElementById("paymentMethod").value,
        note: document.getElementById("customerNote").value.trim()
      },
      items: cart,
      total: total,
      createdAt: new Date().toISOString()
    };

saveOrderDraft(order);

message.textContent = "訂單送出中，請稍候...";
    if (typeof API_URL === "undefined" || !API_URL) {
  console.error("ORDER_API_URL 沒有設定，請確認 checkout.html 是否有載入 js/config.js");
  message.textContent = "系統設定尚未完成，請聯絡我們。";
  return;
}

console.log("ORDER_API_URL：", API_URL);
console.log("準備送出的訂單：", order);

fetch(API_URL, {
  method: "POST",
  mode: "no-cors",
  headers: {
    "Content-Type": "text/plain;charset=utf-8"
  },
  body: JSON.stringify(order)
})
.then(function () {
  console.log("訂單已送出");

  localStorage.setItem("peanutLastOrderId", orderId);

  localStorage.removeItem("peanutCart");
  localStorage.removeItem("peanutOrderDraft");

  message.textContent = "訂單已送出，我們會盡快與您確認。";

  setTimeout(function () {
    window.location.href = "thank-you.html";
  }, 1200);
})
.catch(function (error) {
  console.error("訂單送出失敗：", error);
  message.textContent = "訂單送出失敗，請稍後再試，或直接聯絡我們。";
});
  });
}

renderCheckoutSummary();
handleCheckoutSubmit();
