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

    if (!window.supabaseClient) {
      console.error("Supabase 尚未設定，請確認 checkout.html 是否有載入 Supabase CDN 與 supabase-config.js");
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

    const deliveryMethodText = getDeliveryMethodText(deliveryMethod);

    const order = {
      orderId: orderId,
      customer: {
        name: name,
        phone: phone,
        email: email,
        deliveryMethod: deliveryMethodText,
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

    submitOrderToSupabase({
      orderId,
      name,
      phone,
      email,
      deliveryMethodText,
      address,
      paymentMethod,
      note,
      subtotal,
      shippingFee,
      total,
      cart
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
        if (message) message.textContent = `訂單送出失敗：${error.message || "請稍後再試，或直接聯絡我們。"}`;
      });
  });
}

async function submitOrderToSupabase({
  orderId,
  name,
  phone,
  email,
  deliveryMethodText,
  address,
  paymentMethod,
  note,
  subtotal,
  shippingFee,
  total,
  cart
}) {
  const orderPayload = {
    order_number: orderId,
    customer_name: name,
    customer_phone: phone,
    customer_email: email || null,
    shipping_name: name,
    shipping_phone: phone,
    shipping_address: address,
    shipping_method: deliveryMethodText,
    subtotal: subtotal,
    shipping_fee: shippingFee,
    total_amount: total,
    payment_method: paymentMethod,
    payment_status: "unpaid",
    order_status: "new",
    packing_status: "not_started",
    shipping_status: "not_shipped",
    customer_note: note || null,
    internal_note: "官網訂單"
  };

  const { data: orderData, error: orderError } = await window.supabaseClient
    .from("orders")
    .insert(orderPayload)
    .select("*")
    .single();

  if (orderError) throw orderError;

  const orderItemsPayload = cart.map((item) => {
    const price = Number(item.price || 0);
    const quantity = Number(item.quantity || 0);
    const rawProductId = item.product_id || item.productId || item.id || null;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(rawProductId || ""));
    const productId = isUuid ? rawProductId : null;
    const sku = item.sku || (!isUuid && rawProductId ? rawProductId : "");

    return {
      order_id: orderData.id,
      product_id: productId,
      product_name: item.name || item.product_name || "未命名商品",
      sku: sku,
      weight: item.weight || "",
      price: price,
      quantity: quantity,
      subtotal: price * quantity
    };
  });

  const { error: itemsError } = await window.supabaseClient
    .from("order_items")
    .insert(orderItemsPayload);

  if (itemsError) throw itemsError;

  return orderData;
}

renderCheckoutSummary();
handleCheckoutSubmit();

const deliveryMethodSelect = document.getElementById("deliveryMethod");

if (deliveryMethodSelect) {
  deliveryMethodSelect.addEventListener("change", renderCheckoutSummary);
}
