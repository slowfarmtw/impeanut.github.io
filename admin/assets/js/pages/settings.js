

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("settingsForm");
  const saveButton = document.getElementById("saveSettingsButton");
  const message = document.getElementById("settingsMessage");

  if (!form || !saveButton || !message) {
    console.error("系統設定頁面欄位載入失敗");
    return;
  }

  let settingsId = null;

  const fieldMap = {
    brand_name: "brandName",
    brand_name_en: "brandNameEn",
    parent_brand_name: "parentBrandName",
    contact_phone: "contactPhone",
    contact_email: "contactEmail",
    contact_address: "contactAddress",
    line_url: "lineUrl",
    instagram_url: "instagramUrl",
    facebook_url: "facebookUrl",
    bank_transfer_info: "bankTransferInfo",
    line_pay_info: "linePayInfo",
    default_shipping_fee: "defaultShippingFee",
    convenience_store_shipping_fee: "convenienceStoreShippingFee",
    free_shipping_threshold: "freeShippingThreshold",
    order_number_prefix: "orderNumberPrefix",
    low_stock_threshold: "lowStockThreshold",
    monthly_revenue_target: "monthlyRevenueTarget",
    annual_revenue_target: "annualRevenueTarget",
    default_seo_description: "defaultSeoDescription",
    website_notice: "websiteNotice",
    marquee_enabled: "marqueeEnabled",
    marquee_text: "marqueeText",
    marquee_url: "marqueeUrl",
    marquee_new_tab: "marqueeNewTab",
    ga4_measurement_id: "ga4MeasurementId",
    maintenance_mode: "maintenanceMode"
  };

  function setMessage(text, state = "") {
    message.textContent = text;
    message.dataset.state = state;
  }

  function fillForm(settings) {
    Object.entries(fieldMap).forEach(([column, elementId]) => {
      const element = document.getElementById(elementId);
      if (!element) return;

      if (element.type === "checkbox") {
        element.checked = Boolean(settings[column]);
      } else {
        element.value = settings[column] ?? "";
      }
    });
  }

  function buildPayload() {
    const payload = {};

    Object.entries(fieldMap).forEach(([column, elementId]) => {
      const element = document.getElementById(elementId);
      if (!element) return;

      if (element.type === "checkbox") {
        payload[column] = element.checked;
      } else if (element.type === "number") {
        payload[column] = Number(element.value || 0);
      } else {
        const value = element.value.trim();
        payload[column] = value || null;
      }
    });

    payload.brand_name = document.getElementById("brandName").value.trim();
    payload.order_number_prefix = document
      .getElementById("orderNumberPrefix")
      .value.trim()
      .toUpperCase();
    payload.updated_at = new Date().toISOString();

    return payload;
  }

  async function loadSettings() {
    setMessage("正在讀取設定…");

    const { data, error } = await supabaseClient
      .from("system_settings")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("讀取系統設定失敗：", error);
      setMessage(`讀取設定失敗：${error.message}`, "error");
      return;
    }

    if (!data) {
      setMessage("找不到系統設定資料，請先確認資料表是否已建立。", "error");
      return;
    }

    settingsId = data.id;
    fillForm(data);
    setMessage("設定已載入。", "success");
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();

    if (!settingsId) {
      setMessage("找不到可更新的設定資料。", "error");
      return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "儲存中…";
    setMessage("正在儲存設定…");

    const { error } = await supabaseClient
      .from("system_settings")
      .update(buildPayload())
      .eq("id", settingsId);

    if (error) {
      console.error("儲存系統設定失敗：", error);
      setMessage(`儲存失敗：${error.message}`, "error");
    } else {
      setMessage("系統設定已儲存。", "success");
    }

    saveButton.disabled = false;
    saveButton.textContent = "儲存系統設定";
  });

  await loadSettings();
});
