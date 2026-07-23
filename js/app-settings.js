let APP_SETTINGS = {};

document.addEventListener("DOMContentLoaded", function () {
  loadAppSettings();
});

async function loadAppSettings() {
  try {
    const response = await fetch(API_URL + "?action=settings");
    const result = await response.json();

    if (!result.success) {
      console.warn("Settings failed to load:", result.message);
      return;
    }

    APP_SETTINGS = convertSettingsArrayToObject(result.data || []);
    applyAppSettings();

  } catch (error) {
    console.warn("Unable to load app settings:", error);
  }
}

function convertSettingsArrayToObject(settingsArray) {
  const settings = {};

  settingsArray.forEach(function (item) {
    const key = String(item.SETTING_KEY || "").trim();
    const value = String(item.SETTING_VALUE || "").trim();

    if (key) {
      settings[key] = value;
    }
  });

  return settings;
}

function applyAppSettings() {
  document.querySelectorAll("[data-setting]").forEach(function (element) {
    const key = element.getAttribute("data-setting");

    if (APP_SETTINGS[key]) {
      element.textContent = APP_SETTINGS[key];
    }
  });

  const systemName = APP_SETTINGS.SYSTEM_NAME;

  if (systemName && document.title.includes("PSWDO Monthly Activity Monitoring System")) {
    document.title = document.title.replace("PSWDO Monthly Activity Monitoring System", systemName);
  }
}