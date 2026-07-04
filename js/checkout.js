const SHIPPING_FEES = {
  home: 80,
  store: 60,
  pickup: 0
};

function getCart() {
  return JSON.parse(localStorage.getItem("peanutCart")) || [];
}

function saveOrderDraft(order) {
  localStorage.setItem("peanutOrderDraft", JSON.stringify(order));
}

function formatPrice(price) {
  return `NT$ ${Number(price).toLocaleString()}`;
}

function getShippingFee(deliveryMethod) {
  if (!deliveryMethod) return 0;
  return SHIPPING_FEES[deliveryMethod] ?? 0;
}

function getDeliveryMethodText(deliveryMethod) {
  const map = {
    home: "宅配",
    store: "超商取貨",
    pickup: "面交"
  };

  return map[deliveryMethod] || deliveryMethod || "";
}

function createOrderId() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  const second = String(now.getSeconds()).padStart(2, "0");

  return `PL${year}${month}${day}${hour}${minute}${second}`;
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

  let subtotal = 0;

  const itemsHtml = cart.map(item => {
    const itemSubtotal = Number(item.price) * Number(item.quantity);
    subtotal += itemSubtotal;

    return `
      <div class="checkout-summary-item">
        <div>
          <strong>${item.name}</strong>
          <p>${item.weight || ""} × ${item.quantity}</p>
        </div>
        <strong>${formatPrice(itemSubtotal)}</strong>
      </div>
    `;
  }).join("");

  const deliveryMethod = document.getElementById("deliveryMethod")?.value || "";
  const shippingFee = getShippingFee(deliveryMethod);
  const grandTotal = subtotal + shippingFee;

  const shippingText = deliveryMethod
    ? formatPrice(shippingFee)
    : "請先選擇配送方式";

  container.innerHTML = `
    <div class="checkout-summary-header">
      <h2>訂單摘要</h2>
      <a href="cart.html">返回購物車</a>
    </div>

    ${itemsHtml}

    <div class="checkout-summary-row">
      <span>商品小計</span>
      <strong>${formatPrice(subtotal)}</strong>
    </div>

    <div class="checkout-summary-row">
      <span>運費</span>
      <strong>${shippingText}</strong>
    </div>

    <div class="checkout-summary-total">
      <span>合計</span>
      <strong>${formatPrice(grandTotal)}</strong>
    </div>

    <div class="checkout-summary-note">
      宅配 NT$ 80、超商取貨 NT$ 60、面交免運。選擇配送方式後，合計金額會自動更新。
    </div>
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
      if (message) message.textContent = "購物車目前是空的。";
      return;
    }

    if (typeof API_URL === "undefined" || !API_URL) {
      console.error("API_URL 沒有設定，請確認 checkout.html 是否有載入 js/config.js");
      if (message) message.textContent = "系統設定尚未完成，請聯絡我們。";
      return;
    }

    const name = document.getElementById("customerName").value.trim();
    const phone = document.getElementById("customerPhone").value.trim();
    const email = document.getElementById("customerEmail").value.trim();
    const deliveryMethod = document.getElementById("deliveryMethod").value;
    const address = document.getElementById("customerAddress").value.trim();
    const paymentMethod = document.getElementById("paymentMethod").value;
    const note = document.getElementById("customerNote").value.trim();

    if (!deliveryMethod) {
      if (message) message.textContent = "請選擇配送方式。";
      return;
    }

    const subtotal = cart.reduce((sum, item) => {
      return sum + Number(item.price) * Number(item.quantity);
    }, 0);

    const shippingFee = getShippingFee(deliveryMethod);
    const total = subtotal + shippingFee;
    const orderId = createOrderId();

    const order = {
      orderId: orderId,
      customer: {
        name: name,
        phone: phone,
        email: email,
        deliveryMethod: getDeliveryMethodText(deliveryMethod),
        address: address,
        paymentMethod: paymentMethod,
        note: note
      },
      items: cart,
      subtotal: subtotal,
      shippingFee: shippingFee,
      total: total
    };

    saveOrderDraft(order);

    if (message) message.textContent = "訂單送出中，請稍候...";

    fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(order)
    })
      .then(function () {
        localStorage.setItem("peanutLastOrderId", orderId);

        localStorage.removeItem("peanutCart");
        localStorage.removeItem("peanutOrderDraft");

        window.dispatchEvent(new Event("peanutCartUpdated"));

        if (message) message.textContent = "訂單已送出，我們會盡快與您確認。";

        setTimeout(function () {
          window.location.href = "thank-you.html";
        }, 1200);
      })
      .catch(function (error) {
        console.error("訂單送出失敗：", error);
        if (message) message.textContent = "訂單送出失敗，請稍後再試，或直接聯絡我們。";
      });
  });
}

renderCheckoutSummary();
handleCheckoutSubmit();

const deliveryMethodSelect = document.getElementById("deliveryMethod");

if (deliveryMethodSelect) {
  deliveryMethodSelect.addEventListener("change", renderCheckoutSummary);
}
