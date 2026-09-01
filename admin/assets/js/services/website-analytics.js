(function setupWebsiteAnalytics() {
  const allowedPeriods = new Set([7, 30, 90, 365]);

  function normalizePeriod(value) {
    const days = Number(value);
    return allowedPeriods.has(days) ? days : 30;
  }

  function normalizeNumber(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number : 0;
  }

  function normalizeReport(data) {
    const summary = data?.summary || {};

    return {
      summary: {
        activeUsers: normalizeNumber(summary.activeUsers),
        sessions: normalizeNumber(summary.sessions),
        pageViews: normalizeNumber(summary.pageViews),
        newUsers: normalizeNumber(summary.newUsers)
      },
      trend: Array.isArray(data?.trend) ? data.trend : [],
      topPages: Array.isArray(data?.topPages) ? data.topPages : [],
      sources: Array.isArray(data?.sources) ? data.sources : [],
      fetchedAt: data?.fetchedAt || new Date().toISOString()
    };
  }

  async function readFunctionError(error) {
    if (error?.context && typeof error.context.json === "function") {
      try {
        const detail = await error.context.json();
        if (detail?.error) return detail.error;
      } catch (parseError) {
        console.warn("無法解析網站流量錯誤內容：", parseError);
      }
    }

    return error?.message || "GA4 網站流量目前無法讀取。";
  }

  async function load(days = 30) {
    const supabase = window.supabaseClient;
    if (!supabase) throw new Error("Supabase 尚未載入，無法讀取網站流量。");

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const session = sessionData?.session;

    if (sessionError || !session) {
      throw new Error("登入狀態已失效，請重新登入後台。");
    }

    if (session.user?.app_metadata?.role !== "admin") {
      throw new Error("目前帳號沒有讀取網站流量的權限。");
    }

    const { data, error } = await supabase.functions.invoke("ga4-report", {
      body: { days: normalizePeriod(days) }
    });

    if (error) throw new Error(await readFunctionError(error));
    if (data?.error) throw new Error(data.error);

    return normalizeReport(data);
  }

  window.peanutWebsiteAnalytics = { load };
})();
