function getCurrentUser() {
  const userData = localStorage.getItem("pswdo_v2_user");

  if (!userData) {
    return null;
  }

  try {
    return JSON.parse(userData);
  } catch (error) {
    localStorage.removeItem("pswdo_v2_user");
    return null;
  }
}

function requireLogin() {
  const user = getCurrentUser();

  if (!user) {
    window.location.href = "login.html";
    return null;
  }

  return user;
}

function logout() {
  localStorage.removeItem("pswdo_v2_user");
  window.location.href = "login.html";
}