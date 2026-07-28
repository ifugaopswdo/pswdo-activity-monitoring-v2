const settingsPageUser = requireLogin();

let settingsRecords = [];
let settingsMap = {};

document.addEventListener("DOMContentLoaded", function () {
  displaySettingsUser();
  prepareSettingsPage();
  loadSettings();

  const form = document.getElementById("settingsForm");
  form.addEventListener("submit", saveSettings);
});

function displaySettingsUser() {
  document.getElementById("userName").textContent = settingsPageUser.FULL_NAME || "User";
  document.getElementById("userRole").textContent = settingsPageUser.ROLE || "";
}

function prepareSettingsPage() {
  const role = String(settingsPageUser.ROLE || "").toUpperCase();

  if (role !== "MAIN_ADMIN") {
    document.getElementById("accessDenied").classList.remove("hidden");
    document.getElementById("settingsContent").classList.add("hidden");
  }
}

async function loadSettings() {
  const role = String(settingsPageUser.ROLE || "").toUpperCase();

  if (role !== "MAIN_ADMIN") return;

  const tbody = document.getElementById("settingsTableBody");

  tbody.innerHTML = `
    <tr>
      <td colspan="3" class="empty-cell">Loading settings...</td>
    </tr>
  `;

  try {
    const response = await fetch(API_URL + "?action=settings");
    const result = await response.json();

    if (!result.success) {
      tbody.innerHTML = `
        <tr>
          <td colspan="3" class="empty-cell">${escapeHtml(result.message || "Failed to load settings.")}</td>
        </tr>
      `;
      return;
    }

    settingsRecords = result.data || [];
    settingsMap = convertSettingsToMap(settingsRecords);

    fillSettingsForm();
    renderSettingsTable(settingsRecords);

  } catch (error) {
    console.error(error);

    tbody.innerHTML = `
      <tr>
        <td colspan="3" class="empty-cell">Unable to connect to backend.</td>
      </tr>
    `;
  }
}

function convertSettingsToMap(records) {
  const map = {};

  records.forEach(function (item) {
    const key = String(item.SETTING_KEY || "").trim();

    if (key) {
      map[key] = item.SETTING_VALUE || "";
    }
  });

  return map;
}

function fillSettingsForm() {
  document.getElementById("systemName").value =
    settingsMap.SYSTEM_NAME || "PSWDO Monthly Activity Monitoring System";

  document.getElementById("officeName").value =
    settingsMap.OFFICE_NAME || "Provincial Social Welfare and Development Office";

  document.getElementById("province").value =
    settingsMap.PROVINCE || "Province of Ifugao";

  document.getElementById("officeAddress").value =
    settingsMap.OFFICE_ADDRESS || "Provincial Capitol Compound, Lagawe, Ifugao";

  document.getElementById("officeEmail").value =
    settingsMap.OFFICE_EMAIL || "";

  document.getElementById("footerNote").value =
    settingsMap.FOOTER_NOTE || "For official use only";

  document.getElementById("fileSharingMode").value =
    settingsMap.FILE_SHARING_MODE || "PRIVATE";

  document.getElementById("fileViewerEmails").value =
    settingsMap.FILE_VIEWER_EMAILS || "";
}

async function saveSettings(event) {
  event.preventDefault();

  const role = String(settingsPageUser.ROLE || "").toUpperCase();

  if (role !== "MAIN_ADMIN") {
    showSettingsMessage("Only the Main Admin can update settings.", "error");
    return;
  }

  const settingsToSave = [
    {
      SETTING_KEY: "SYSTEM_NAME",
      SETTING_VALUE: document.getElementById("systemName").value.trim(),
      DESCRIPTION: "Name of the system"
    },
    {
      SETTING_KEY: "OFFICE_NAME",
      SETTING_VALUE: document.getElementById("officeName").value.trim(),
      DESCRIPTION: "Office name"
    },
    {
      SETTING_KEY: "PROVINCE",
      SETTING_VALUE: document.getElementById("province").value.trim(),
      DESCRIPTION: "Province name"
    },
    {
      SETTING_KEY: "OFFICE_ADDRESS",
      SETTING_VALUE: document.getElementById("officeAddress").value.trim(),
      DESCRIPTION: "Office address"
    },
    {
      SETTING_KEY: "OFFICE_EMAIL",
      SETTING_VALUE: document.getElementById("officeEmail").value.trim(),
      DESCRIPTION: "Office email"
    },
    {
      SETTING_KEY: "FOOTER_NOTE",
      SETTING_VALUE: document.getElementById("footerNote").value.trim(),
      DESCRIPTION: "Footer note shown in reports"
    },
    {
      SETTING_KEY: "FILE_SHARING_MODE",
      SETTING_VALUE: document.getElementById("fileSharingMode").value.trim(),
      DESCRIPTION: "Use PRIVATE, ANYONE_WITH_LINK, or VIEWERS"
    },
    {
      SETTING_KEY: "FILE_VIEWER_EMAILS",
      SETTING_VALUE: document.getElementById("fileViewerEmails").value.trim(),
      DESCRIPTION: "Comma-separated emails if FILE_SHARING_MODE is VIEWERS"
    }
  ];

  const saveBtn = document.getElementById("saveSettingsBtn");
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";

  try {
    for (const setting of settingsToSave) {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
          action: "updateSetting",
          SETTING_KEY: setting.SETTING_KEY,
          SETTING_VALUE: setting.SETTING_VALUE,
          DESCRIPTION: setting.DESCRIPTION,
          updatedBy: settingsPageUser.FULL_NAME || "SYSTEM"
        })
      });

      const result = await response.json();

      if (!result.success) {
        showSettingsMessage(result.message || "Failed to save settings.", "error");
        return;
      }
    }

    showSettingsMessage("Settings saved successfully. Refresh other pages to see changes.", "success");
    loadSettings();

  } catch (error) {
    console.error(error);
    showSettingsMessage("Unable to connect to backend.", "error");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Settings";
  }
}

function renderSettingsTable(records) {
  const tbody = document.getElementById("settingsTableBody");
  tbody.innerHTML = "";

  if (!records || records.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" class="empty-cell">No settings found.</td>
      </tr>
    `;
    return;
  }

  records.forEach(function (setting) {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td><strong>${escapeHtml(setting.SETTING_KEY)}</strong></td>
      <td>${escapeHtml(setting.SETTING_VALUE)}</td>
      <td>${escapeHtml(setting.DESCRIPTION)}</td>
    `;

    tbody.appendChild(row);
  });
}

function showSettingsMessage(text, type) {
  const message = document.getElementById("settingsMessage");

  message.textContent = text;
  message.className = "message";

  if (type) {
    message.classList.add(type);
  }
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