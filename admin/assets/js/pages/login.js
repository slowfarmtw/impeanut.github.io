

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("loginForm");
  const emailInput = document.getElementById("loginEmail");
  const passwordInput = document.getElementById("loginPassword");
  const loginButton = document.getElementById("loginButton");
  const message = document.getElementById("loginMessage");

  if (!form || !emailInput || !passwordInput || !loginButton || !message) {
    console.error("登入頁面欄位載入失敗");
    return;
  }

  if (typeof supabaseClient === "undefined") {
    message.textContent = "Supabase 連線設定尚未載入。";
    message.dataset.state = "error";
    return;
  }

  const { data: sessionData } = await supabaseClient.auth.getSession();

  if (sessionData.session) {
    window.location.replace("index.html");
    return;
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    message.textContent = "";
    message.dataset.state = "";

    if (!email || !password) {
      message.textContent = "請輸入 Email 與密碼。";
      message.dataset.state = "error";
      return;
    }

    loginButton.disabled = true;
    loginButton.textContent = "登入中…";

    try {
      const { error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        throw error;
      }

      message.textContent = "登入成功，正在進入後台…";
      message.dataset.state = "success";
      window.location.replace("index.html");
    } catch (error) {
      console.error("後台登入失敗：", error);

      if (error?.message === "Invalid login credentials") {
        message.textContent = "帳號或密碼錯誤，請重新確認。";
      } else if (error?.message === "Email not confirmed") {
        message.textContent = "此帳號尚未完成 Email 驗證。";
      } else {
        message.textContent = error?.message || "登入失敗，請稍後再試。";
      }

      message.dataset.state = "error";
    } finally {
      loginButton.disabled = false;
      loginButton.textContent = "登入後台";
    }
  });
});