

(async function protectAdminPage() {
  if (typeof supabaseClient === "undefined") {
    console.error("Supabase 尚未載入，無法驗證登入狀態。");
    return;
  }

  const {
    data: { session },
    error
  } = await supabaseClient.auth.getSession();

  if (error || !session) {
    const isAdminSubPage = window.location.pathname.includes("/admin/pages/");

    window.location.replace(
      isAdminSubPage ? "../login.html" : "login.html"
    );

    return;
  }

  window.adminSession = session;
})();