

(async function initAnalytics() {
  if (!window.supabaseClient) {
    console.warn("Supabase 尚未載入，GA4 追蹤未啟用。");
    return;
  }

  const { data, error } = await window.supabaseClient.rpc(
    "get_public_analytics_settings"
  );

  if (error) {
    console.error("讀取 GA4 設定失敗：", error);
    return;
  }

  const settings = Array.isArray(data) ? data[0] : data;
  const measurementId = String(
    settings?.ga4_measurement_id || ""
  ).trim();

  if (!/^G-[A-Z0-9]+$/i.test(measurementId)) {
    console.warn("GA4 Measurement ID 尚未設定或格式不正確。");
    return;
  }

  if (window.__peanutGa4Loaded) {
    return;
  }

  window.__peanutGa4Loaded = true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };

  window.gtag("js", new Date());
  window.gtag("config", measurementId, {
    send_page_view: true,
    anonymize_ip: true
  });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  script.dataset.ga4 = measurementId;
  document.head.appendChild(script);

  window.peanutAnalytics = {
    measurementId,

    track(eventName, params = {}) {
      if (!eventName || typeof window.gtag !== "function") return;

      window.gtag("event", eventName, params);
    },

    trackPageView(extra = {}) {
      this.track("page_view", {
        page_title: document.title,
        page_location: window.location.href,
        page_path: window.location.pathname,
        ...extra
      });
    }
  };

  console.info("GA4 已啟用：", measurementId);
})();