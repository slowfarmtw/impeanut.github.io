const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_ANALYTICS_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const allowedPeriods = new Set([7, 30, 90, 365]);
const allowedOrigins = new Set([
  "https://impeanut.com",
  "https://www.impeanut.com",
  "https://slowfarmtw.github.io",
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  "http://127.0.0.1:4173",
  "http://localhost:4173"
]);

function corsHeaders(request) {
  const origin = request.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://impeanut.com",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Vary": "Origin"
  };
}

function json(request, body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(request) });
}

function base64Url(input) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function pemToBytes(pem) {
  const binary = atob(
    pem.replaceAll("\\n", "\n")
      .replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "")
  );
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function createGoogleAssertion(email, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(JSON.stringify({
    iss: email,
    scope: GOOGLE_ANALYTICS_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600
  }));
  const unsignedToken = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedToken)
  );
  return `${unsignedToken}.${base64Url(new Uint8Array(signature))}`;
}

async function getGoogleAccessToken(email, privateKey) {
  const assertion = await createGoogleAssertion(email, privateKey);
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  const result = await response.json();
  if (!response.ok || !result.access_token) {
    throw new Error(result.error_description || "Google Analytics 授權失敗。");
  }
  return result.access_token;
}

async function requireAdmin(request) {
  const authorization = request.headers.get("authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const apiKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!authorization || !supabaseUrl || !apiKey) return false;

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: authorization, apikey: apiKey }
  });
  if (!response.ok) return false;

  const user = await response.json();
  return user?.app_metadata?.role === "admin";
}

function metric(report, row, name) {
  const index = report?.metricHeaders?.findIndex((header) => header.name === name) ?? -1;
  return index >= 0 ? Number(row?.metricValues?.[index]?.value || 0) : 0;
}

function dimension(report, row, name) {
  const index = report?.dimensionHeaders?.findIndex((header) => header.name === name) ?? -1;
  return index >= 0 ? String(row?.dimensionValues?.[index]?.value || "") : "";
}

function formatGaDate(value) {
  return /^\d{8}$/.test(value)
    ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
    : value;
}

async function fetchAnalyticsReport(propertyId, accessToken, days) {
  const dateRanges = [{ startDate: `${days - 1}daysAgo`, endDate: "today" }];
  const previousDateRanges = [{ startDate: `${days * 2 - 1}daysAgo`, endDate: `${days}daysAgo` }];
  const summaryMetrics = ["activeUsers", "totalUsers", "sessions", "screenPageViews", "newUsers"]
    .map((name) => ({ name }));
  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:batchRunReports`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          { dateRanges, metrics: summaryMetrics },
          { dateRanges: previousDateRanges, metrics: summaryMetrics },
          {
            dateRanges,
            dimensions: [{ name: "date" }],
            metrics: ["activeUsers", "screenPageViews"].map((name) => ({ name })),
            orderBys: [{ dimension: { dimensionName: "date" } }],
            limit: "366"
          },
          {
            dateRanges,
            dimensions: [{ name: "pageTitle" }, { name: "pagePath" }],
            metrics: ["screenPageViews", "activeUsers"].map((name) => ({ name })),
            orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
            limit: "8"
          },
          {
            dateRanges,
            dimensions: [{ name: "sessionDefaultChannelGroup" }],
            metrics: ["sessions", "activeUsers"].map((name) => ({ name })),
            orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
            limit: "8"
          }
        ]
      })
    }
  );
  const result = await response.json();
  if (!response.ok) throw new Error(result?.error?.message || "Google Analytics 報表讀取失敗。");
  return result.reports || [];
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "僅接受 POST 請求。" }, 405);

  try {
    if (!(await requireAdmin(request))) return json(request, { error: "沒有讀取網站流量的權限。" }, 403);

    const body = await request.json().catch(() => ({}));
    const requestedDays = Number(body?.days || 30);
    const days = allowedPeriods.has(requestedDays) ? requestedDays : 30;
    const propertyId = Deno.env.get("GA4_PROPERTY_ID") || "";
    const email = Deno.env.get("GA4_SERVICE_ACCOUNT_EMAIL") || "";
    const privateKey = Deno.env.get("GA4_PRIVATE_KEY") || "";

    if (!/^\d+$/.test(propertyId) || !email || !privateKey) {
      return json(request, { error: "GA4 尚未完成設定：請設定資源 ID 與 Service Account 憑證。" }, 503);
    }

    const accessToken = await getGoogleAccessToken(email, privateKey);
    const [summaryReport, previousSummaryReport, trendReport, pageReport, sourceReport] = await fetchAnalyticsReport(propertyId, accessToken, days);
    const summaryRow = summaryReport?.rows?.[0] || {};
    const previousSummaryRow = previousSummaryReport?.rows?.[0] || {};

    return json(request, {
      summary: {
        activeUsers: metric(summaryReport, summaryRow, "activeUsers"),
        totalUsers: metric(summaryReport, summaryRow, "totalUsers"),
        sessions: metric(summaryReport, summaryRow, "sessions"),
        pageViews: metric(summaryReport, summaryRow, "screenPageViews"),
        newUsers: metric(summaryReport, summaryRow, "newUsers")
      },
      previousSummary: {
        activeUsers: metric(previousSummaryReport, previousSummaryRow, "activeUsers"),
        totalUsers: metric(previousSummaryReport, previousSummaryRow, "totalUsers"),
        sessions: metric(previousSummaryReport, previousSummaryRow, "sessions"),
        pageViews: metric(previousSummaryReport, previousSummaryRow, "screenPageViews"),
        newUsers: metric(previousSummaryReport, previousSummaryRow, "newUsers")
      },
      trend: (trendReport?.rows || []).map((row) => ({
        date: formatGaDate(dimension(trendReport, row, "date")),
        activeUsers: metric(trendReport, row, "activeUsers"),
        pageViews: metric(trendReport, row, "screenPageViews")
      })),
      topPages: (pageReport?.rows || []).map((row) => ({
        title: dimension(pageReport, row, "pageTitle") || "未命名頁面",
        path: dimension(pageReport, row, "pagePath"),
        pageViews: metric(pageReport, row, "screenPageViews"),
        activeUsers: metric(pageReport, row, "activeUsers")
      })),
      sources: (sourceReport?.rows || []).map((row) => ({
        name: dimension(sourceReport, row, "sessionDefaultChannelGroup") || "未分類",
        sessions: metric(sourceReport, row, "sessions"),
        activeUsers: metric(sourceReport, row, "activeUsers")
      })),
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("ga4-report failed", error);
    return json(request, { error: error instanceof Error ? error.message : "GA4 報表讀取失敗。" }, 500);
  }
});
