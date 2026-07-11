let checkoutSettings = {
  defaultShippingFee: 80,
  convenienceStoreShippingFee: 60,
  freeShippingThreshold: 0,
  orderNumberPrefix: "PL"
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

function getShippingFee(deliveryMethod, subtotal = 0) {
  if (!deliveryMethod) return 0;

  const freeShippingThreshold = Number(checkoutSettings.freeShippingThreshold || 0);

  if (freeShippingThreshold > 0 && Number(subtotal || 0) >= freeShippingThreshold) {
    return 0;
  }

  const shippingFees = {
    home: Number(checkoutSettings.defaultShippingFee || 0),
    store: Number(checkoutSettings.convenienceStoreShippingFee || 0),
    pickup: 0
  };

  return shippingFees[deliveryMethod] ?? 0;
}

function getDeliveryMethodText(deliveryMethod) {
  const map = {
    home: "宅配",
    store: "超商取貨",
    pickup: "面交"
  };

  return map[deliveryMethod] || deliveryMethod || "";
}

function trackBeginCheckout(cart) {
  if (!Array.isArray(cart) || cart.length === 0) return;

  const items = cart.map((item) => {
    const price = Number(item.price || 0);
    const quantity = Math.max(1, Number(item.quantity || 1));

    return {
      item_id: item.sku || String(item.product_id || item.id || ""),
      item_name: item.name || item.product_name || "未命名商品",
      item_category: item.category || "未分類",
      price: price,
      quantity: quantity
    };
  });

  const value = items.reduce((sum, item) => {
    return sum + item.price * item.quantity;
  }, 0);

  const cartSignature = JSON.stringify(
    items.map((item) => [item.item_id, item.quantity, item.price])
  );

  if (sessionStorage.getItem("peanutBeginCheckoutSignature") === cartSignature) {
    return;
  }

  let attempts = 0;
  const maxAttempts = 20;

  const sendBeginCheckout = function () {
    attempts += 1;

    if (window.peanutAnalytics?.track) {
      window.peanutAnalytics.track("begin_checkout", {
        currency: "TWD",
        value: value,
        items: items
      });

      sessionStorage.setItem("peanutBeginCheckoutSignature", cartSignature);
      return;
    }

    if (attempts < maxAttempts) {
      window.setTimeout(sendBeginCheckout, 250);
    } else {
      console.warn("GA4 尚未就緒，begin_checkout 事件未送出。");
    }
  };

  sendBeginCheckout();
}

function trackPurchase({
  orderId,
  cart,
  subtotal,
  shippingFee,
  paymentMethod
}) {
  if (!orderId || !Array.isArray(cart) || cart.length === 0) return;

  const trackingKey = `peanutPurchaseTracked:${orderId}`;

  if (localStorage.getItem(trackingKey) === "true") {
    return;
  }

  const items = cart.map((item) => {
    const price = Number(item.price || 0);
    const quantity = Math.max(1, Number(item.quantity || 1));

    return {
      item_id: item.sku || String(item.product_id || item.id || ""),
      item_name: item.name || item.product_name || "未命名商品",
      item_category: item.category || "未分類",
      price: price,
      quantity: quantity
    };
  });

  let attempts = 0;
  const maxAttempts = 20;

  const sendPurchase = function () {
    attempts += 1;

    if (window.peanutAnalytics?.track) {
      window.peanutAnalytics.track("purchase", {
        transaction_id: orderId,
        affiliation: "花生一生官網",
        currency: "TWD",
        value: Number(subtotal || 0),
        shipping: Number(shippingFee || 0),
        payment_type: paymentMethod || "",
        items: items
      });

      localStorage.setItem(trackingKey, "true");
      sessionStorage.removeItem("peanutBeginCheckoutSignature");
      return;
    }

    if (attempts < maxAttempts) {
      window.setTimeout(sendPurchase, 250);
    } else {
      console.warn("GA4 尚未就緒，purchase 事件未送出。");
    }
  };

  sendPurchase();
}

function createOrderId() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  const second = String(now.getSeconds()).padStart(2, "0");

  const prefix = String(checkoutSettings.orderNumberPrefix || "PL")
    .trim()
    .toUpperCase();

  return `${prefix}${year}${month}${day}${hour}${minute}${second}`;
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
  const shippingFee = getShippingFee(deliveryMethod, subtotal);
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
    宅配 ${formatPrice(checkoutSettings.defaultShippingFee)}、超商取貨 ${formatPrice(checkoutSettings.convenienceStoreShippingFee)}、面交免運。${Number(checkoutSettings.freeShippingThreshold || 0) > 0 ? `訂單滿 ${formatPrice(checkoutSettings.freeShippingThreshold)} 免運。` : ""}選擇配送方式後，合計金額會自動更新。
  </div>
`;
}
async function loadPublicCheckoutSettings() {
  if (!window.supabaseClient) {
    console.warn("Supabase 尚未載入，結帳頁使用預設運費與訂單編號前綴。");
    return;
  }

  const { data, error } = await window.supabaseClient.rpc(
    "get_public_checkout_settings"
  );

  if (error) {
    console.error("讀取公開結帳設定失敗：", error);
    return;
  }

  const settings = Array.isArray(data) ? data[0] : data;

  if (!settings) return;

  checkoutSettings = {
    defaultShippingFee: Number(settings.default_shipping_fee ?? 80),
    convenienceStoreShippingFee: Number(
      settings.convenience_store_shipping_fee ?? 60
    ),
    freeShippingThreshold: Number(settings.free_shipping_threshold ?? 0),
    orderNumberPrefix: String(settings.order_number_prefix || "PL")
  };
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

    const shippingFee = getShippingFee(deliveryMethod, subtotal);
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

        trackPurchase({
          orderId: orderId,
          cart: cart,
          subtotal: subtotal,
          shippingFee: shippingFee,
          paymentMethod: paymentMethod
        });

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

  const orderItemsPayload = cart.map((item) => {
    const price = Number(item.price || 0);
    const quantity = Number(item.quantity || 0);
    const rawProductId = item.product_id || item.productId || item.id || null;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(rawProductId || ""));
    const productId = isUuid ? rawProductId : null;
    const sku = item.sku || (!isUuid && rawProductId ? rawProductId : "");

    return {
      product_id: productId,
      product_name: item.name || item.product_name || "未命名商品",
      sku: sku,
      weight: item.weight || "",
      price: price,
      quantity: quantity,
      subtotal: price * quantity
    };
  });

  const { data, error } = await window.supabaseClient.rpc("create_public_order", {
    p_order: orderPayload,
    p_items: orderItemsPayload
  });

  if (error) throw error;

  const result = Array.isArray(data) ? data[0] : data;

  if (!result?.id) {
    throw new Error("訂單建立成功，但系統沒有回傳訂單識別碼。請聯絡我們確認訂單狀態。");
  }

  return result;
}

async function initCheckout() {
  await loadPublicCheckoutSettings();

  renderCheckoutSummary();
  trackBeginCheckout(getCart());
  handleCheckoutSubmit();

  const deliveryMethodSelect = document.getElementById("deliveryMethod");

  if (deliveryMethodSelect) {
    deliveryMethodSelect.addEventListener("change", renderCheckoutSummary);
  }
}

initCheckout();
