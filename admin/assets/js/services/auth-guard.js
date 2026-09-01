

(async function protectAdminPage() {
  if (typeof supabaseClient === "undefined") {
    console.error("Supabase 尚未載入，無法驗證登入狀態。");
    return;
  }

  const {
    data: { session },
    error
  } = await supabaseClient.auth.getSession();

  const isAdmin = session?.user?.app_metadata?.role === "admin";

  if (error || !session || !isAdmin) {
    const isAdminSubPage = window.location.pathname.includes("/admin/pages/");

    if (session && !isAdmin) {
      await supabaseClient.auth.signOut();
    }

    window.location.replace(
      isAdminSubPage ? "../login.html?error=unauthorized" : "login.html?error=unauthorized"
    );

    return;
  }

  window.adminSession = session;
})();
