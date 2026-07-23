const sectionsPageUser = requireLogin();

let allSections = [];

document.addEventListener("DOMContentLoaded", function () {
  displaySectionsPageUser();
  prepareSectionsPage();
  loadSections();

  const form = document.getElementById("sectionForm");
  form.addEventListener("submit", saveSection);
});

function displaySectionsPageUser() {
  document.getElementById("userName").textContent = sectionsPageUser.FULL_NAME || "User";
  document.getElementById("userRole").textContent = sectionsPageUser.ROLE || "";
}

function prepareSectionsPage() {
  const role = String(sectionsPageUser.ROLE || "").toUpperCase();

  if (role !== "MAIN_ADMIN") {
    document.getElementById("accessDenied").classList.remove("hidden");
    document.getElementById("sectionsContent").classList.add("hidden");
  }
}

async function loadSections() {
  const role = String(sectionsPageUser.ROLE || "").toUpperCase();

  if (role !== "MAIN_ADMIN") return;

  const tbody = document.getElementById("sectionsTableBody");

  tbody.innerHTML = `
    <tr>
      <td colspan="6" class="empty-cell">Loading sections...</td>
    </tr>
  `;

  try {
    const response = await fetch(API_URL + "?action=sections");
    const result = await response.json();

    if (!result.success) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-cell">${escapeHtml(result.message || "Failed to load sections.")}</td>
        </tr>
      `;
      return;
    }

    allSections = result.data || [];
    renderSections(allSections);

  } catch (error) {
    console.error(error);

    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-cell">Unable to connect to backend.</td>
      </tr>
    `;
  }
}

async function saveSection(event) {
  event.preventDefault();

  const sectionName = document.getElementById("sectionName").value.trim();
  const sectionHead = document.getElementById("sectionHead").value.trim();
  const status = document.getElementById("sectionStatus").value.trim();

  if (!sectionName) {
    showSectionMessage("Please enter section name.", "error");
    return;
  }

  const sectionExists = allSections.some(function (section) {
    return normalize(section.SECTION_NAME) === normalize(sectionName);
  });

  if (sectionExists) {
    showSectionMessage("Section already exists.", "error");
    return;
  }

  const saveBtn = document.getElementById("saveSectionBtn");
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action: "createSection",
        SECTION_NAME: sectionName,
        SECTION_HEAD: sectionHead,
        STATUS: status,
        CREATED_AT: "",
        createdBy: sectionsPageUser.FULL_NAME || "SYSTEM"
      })
    });

    const result = await response.json();

    if (!result.success) {
      showSectionMessage(result.message || "Failed to save section.", "error");
      return;
    }

    showSectionMessage("Section saved successfully.", "success");
    clearSectionForm();
    loadSections();

  } catch (error) {
    console.error(error);
    showSectionMessage("Unable to connect to backend.", "error");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Section";
  }
}

function renderSections(sections) {
  const tbody = document.getElementById("sectionsTableBody");
  tbody.innerHTML = "";

  if (!sections || sections.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-cell">No sections found.</td>
      </tr>
    `;
    return;
  }

  sections.forEach(function (section) {
    const isActive = String(section.STATUS || "").toUpperCase() === "ACTIVE";

    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${escapeHtml(section.SECTION_ID)}</td>
      <td><strong>${escapeHtml(section.SECTION_NAME)}</strong></td>
      <td>${escapeHtml(section.SECTION_HEAD)}</td>
      <td>
        <span class="status-badge ${isActive ? "status-green" : "status-gray"}">
          ${escapeHtml(section.STATUS)}
        </span>
      </td>
      <td>${escapeHtml(section.CREATED_AT)}</td>
      <td>
        ${
          isActive
            ? `<button class="small-btn danger-btn" onclick="changeSectionStatus('${escapeAttr(section.SECTION_ID)}', 'INACTIVE')">Deactivate</button>`
            : `<button class="small-btn success-btn" onclick="changeSectionStatus('${escapeAttr(section.SECTION_ID)}', 'ACTIVE')">Activate</button>`
        }
      </td>
    `;

    tbody.appendChild(row);
  });
}

function filterSections() {
  const search = normalize(document.getElementById("sectionSearch").value);

  if (!search) {
    renderSections(allSections);
    return;
  }

  const filtered = allSections.filter(function (section) {
    return normalize(section.SECTION_NAME).includes(search) ||
      normalize(section.SECTION_HEAD).includes(search) ||
      normalize(section.STATUS).includes(search);
  });

  renderSections(filtered);
}

async function changeSectionStatus(sectionId, status) {
  if (!sectionId) {
    alert("Missing section ID. Please check the SECTIONS sheet.");
    return;
  }

  const confirmed = confirm(`Change section status to ${status}?`);

  if (!confirmed) return;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action: "updateSection",
        SECTION_ID: sectionId,
        STATUS: status,
        updatedBy: sectionsPageUser.FULL_NAME || "SYSTEM"
      })
    });

    const result = await response.json();

    if (!result.success) {
      alert(result.message || "Failed to update section.");
      return;
    }

    alert("Section updated successfully.");
    loadSections();

  } catch (error) {
    console.error(error);
    alert("Unable to connect to backend.");
  }
}

function clearSectionForm() {
  document.getElementById("sectionName").value = "";
  document.getElementById("sectionHead").value = "";
  document.getElementById("sectionStatus").value = "ACTIVE";
  showSectionMessage("", "");
}

function showSectionMessage(text, type) {
  const message = document.getElementById("sectionFormMessage");

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