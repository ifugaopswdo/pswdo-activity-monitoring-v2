const usersPageUser = requireLogin();

let allUsers = [];
let allSections = [];

document.addEventListener("DOMContentLoaded", function () {
  displayUsersPageUser();
  prepareUsersPage();
  loadUsersPage();

  const form = document.getElementById("userForm");
  form.addEventListener("submit", saveUser);
});

function displayUsersPageUser() {
  document.getElementById("userName").textContent = usersPageUser.FULL_NAME || "User";
  document.getElementById("userRole").textContent = usersPageUser.ROLE || "";
}

function prepareUsersPage() {
  const role = String(usersPageUser.ROLE || "").toUpperCase();

  if (role !== "MAIN_ADMIN") {
    document.getElementById("accessDenied").classList.remove("hidden");
    document.getElementById("usersContent").classList.add("hidden");
  }
}

async function loadUsersPage() {
  const role = String(usersPageUser.ROLE || "").toUpperCase();

  if (role !== "MAIN_ADMIN") return;

  const tbody = document.getElementById("usersTableBody");

  tbody.innerHTML = `
    <tr>
      <td colspan="9" class="empty-cell">Loading users...</td>
    </tr>
  `;

  try {
    const [usersResponse, sectionsResponse] = await Promise.all([
      fetch(API_URL + "?action=users"),
      fetch(API_URL + "?action=sections")
    ]);

    const usersResult = await usersResponse.json();
    const sectionsResult = await sectionsResponse.json();

    if (!usersResult.success) throw new Error(usersResult.message);
    if (!sectionsResult.success) throw new Error(sectionsResult.message);

    allUsers = usersResult.data || [];
    allSections = sectionsResult.data || [];

    renderSectionOptions();
    renderUsers(allUsers);

  } catch (error) {
    console.error(error);

    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-cell">Unable to connect to backend.</td>
      </tr>
    `;
  }
}

function renderSectionOptions() {
  const sectionSelect = document.getElementById("section");

  const activeSections = allSections.filter(function (section) {
    return String(section.STATUS || "").toUpperCase() === "ACTIVE";
  });

  sectionSelect.innerHTML = `<option value="">Select Section / Division</option>`;

  activeSections.forEach(function (section) {
    sectionSelect.innerHTML += `
      <option value="${escapeAttr(section.SECTION_NAME)}">
        ${escapeHtml(section.SECTION_NAME)}
      </option>
    `;
  });

  sectionSelect.innerHTML += `
    <option value="Admin">Admin</option>
  `;
}

async function saveUser(event) {
  event.preventDefault();

  const fullName = document.getElementById("fullName").value.trim();
  const position = document.getElementById("position").value.trim();
  const section = document.getElementById("section").value.trim();
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  const role = document.getElementById("role").value.trim();
  const status = document.getElementById("status").value.trim();

  if (!fullName || !position || !section || !username || !password || !role) {
    showUserMessage("Please complete all required fields.", "error");
    return;
  }

  const usernameExists = allUsers.some(function (user) {
    return normalize(user.USERNAME) === normalize(username);
  });

  if (usernameExists) {
    showUserMessage("Username already exists. Please use another username.", "error");
    return;
  }

  const saveBtn = document.getElementById("saveUserBtn");
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action: "createUser",
        FULL_NAME: fullName,
        POSITION: position,
        SECTION: section,
        USERNAME: username,
        PASSWORD: password,
        ROLE: role,
        STATUS: status,
        CREATED_AT: "",
        createdBy: usersPageUser.FULL_NAME || "SYSTEM"
      })
    });

    const result = await response.json();

    if (!result.success) {
      showUserMessage(result.message || "Failed to save user.", "error");
      return;
    }

    showUserMessage("User saved successfully.", "success");
    clearUserForm();
    loadUsersPage();

  } catch (error) {
    console.error(error);
    showUserMessage("Unable to connect to backend.", "error");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save User";
  }
}

function renderUsers(users) {
  const tbody = document.getElementById("usersTableBody");
  tbody.innerHTML = "";

  if (!users || users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-cell">No users found.</td>
      </tr>
    `;
    return;
  }

  users.forEach(function (user) {
    const isActive = String(user.STATUS || "").toUpperCase() === "ACTIVE";

    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${escapeHtml(user.USER_ID)}</td>
      <td><strong>${escapeHtml(user.FULL_NAME)}</strong></td>
      <td>${escapeHtml(user.POSITION)}</td>
      <td>${escapeHtml(user.SECTION)}</td>
      <td>${escapeHtml(user.USERNAME)}</td>
      <td>${escapeHtml(user.ROLE)}</td>
      <td>
        <span class="status-badge ${isActive ? "status-green" : "status-gray"}">
          ${escapeHtml(user.STATUS)}
        </span>
      </td>
      <td>${escapeHtml(user.CREATED_AT)}</td>
      <td>
        <div class="table-actions">
          ${
            isActive
              ? `<button class="small-btn danger-btn" onclick="changeUserStatus('${escapeAttr(user.USER_ID)}', 'INACTIVE')">Deactivate</button>`
              : `<button class="small-btn success-btn" onclick="changeUserStatus('${escapeAttr(user.USER_ID)}', 'ACTIVE')">Activate</button>`
          }
          <button class="small-btn warning-btn" onclick="resetUserPassword('${escapeAttr(user.USER_ID)}')">Reset Password</button>
        </div>
      </td>
    `;

    tbody.appendChild(row);
  });
}

function filterUsers() {
  const search = normalize(document.getElementById("userSearch").value);

  if (!search) {
    renderUsers(allUsers);
    return;
  }

  const filtered = allUsers.filter(function (user) {
    return normalize(user.FULL_NAME).includes(search) ||
      normalize(user.POSITION).includes(search) ||
      normalize(user.SECTION).includes(search) ||
      normalize(user.USERNAME).includes(search) ||
      normalize(user.ROLE).includes(search) ||
      normalize(user.STATUS).includes(search);
  });

  renderUsers(filtered);
}

async function changeUserStatus(userId, status) {
  const confirmed = confirm(`Change user status to ${status}?`);

  if (!confirmed) return;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action: "updateUser",
        USER_ID: userId,
        STATUS: status,
        updatedBy: usersPageUser.FULL_NAME || "SYSTEM"
      })
    });

    const result = await response.json();

    if (!result.success) {
      alert(result.message || "Failed to update user.");
      return;
    }

    alert("User updated successfully.");
    loadUsersPage();

  } catch (error) {
    console.error(error);
    alert("Unable to connect to backend.");
  }
}

async function resetUserPassword(userId) {
  const newPassword = prompt("Enter new password for this user:");

  if (newPassword === null) return;

  if (!newPassword.trim()) {
    alert("Password cannot be empty.");
    return;
  }

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action: "updateUser",
        USER_ID: userId,
        PASSWORD: newPassword.trim(),
        updatedBy: usersPageUser.FULL_NAME || "SYSTEM"
      })
    });

    const result = await response.json();

    if (!result.success) {
      alert(result.message || "Failed to reset password.");
      return;
    }

    alert("Password reset successfully.");

  } catch (error) {
    console.error(error);
    alert("Unable to connect to backend.");
  }
}

function clearUserForm() {
  document.getElementById("fullName").value = "";
  document.getElementById("position").value = "";
  document.getElementById("section").value = "";
  document.getElementById("username").value = "";
  document.getElementById("password").value = "";
  document.getElementById("role").value = "STAFF";
  document.getElementById("status").value = "ACTIVE";
  showUserMessage("", "");
}

function showUserMessage(text, type) {
  const message = document.getElementById("userFormMessage");

  message.textContent = text;
  message.className = "message";

  if (type) {
    message.classList.add(type);
  }
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function escapeHtml(value) {
  if (value === null || value === undefined) return "";

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  if (value === null || value === undefined) return "";

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}