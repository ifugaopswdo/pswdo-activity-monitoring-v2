const loginForm = document.getElementById("loginForm");
const loginBtn = document.getElementById("loginBtn");
const loginMessage = document.getElementById("loginMessage");

loginForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!username || !password) {
    showMessage("Please enter username and password.", "error");
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = "Logging in...";
  showMessage("", "");

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action: "login",
        username: username,
        password: password
      })
    });

    const result = await response.json();

    if (!result.success) {
      showMessage(result.message || "Invalid username or password.", "error");
      return;
    }

    localStorage.setItem("pswdo_v2_user", JSON.stringify(result.user));

    showMessage("Login successful. Redirecting...", "success");

    setTimeout(function () {
      window.location.href = "dashboard.html";
    }, 700);

  } catch (error) {
    console.error(error);
    showMessage("Unable to connect to server. Please check your API URL.", "error");
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Login";
  }
});

function showMessage(text, type) {
  loginMessage.textContent = text;
  loginMessage.className = "message";

  if (type) {
    loginMessage.classList.add(type);
  }
}