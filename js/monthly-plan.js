const monthlyPlanUser = requireLogin();

let monthlyPlans = [];

document.addEventListener("DOMContentLoaded", function () {
  displayCurrentUser();
  prepareMonthlyPlanPage();
  loadMonthlyPlans();

  const form = document.getElementById("monthlyPlanForm");
  form.addEventListener("submit", saveMonthlyPlan);

  const monthSelect = document.getElementById("month");
  const yearInput = document.getElementById("year");

  monthSelect.addEventListener("change", autoFillTitle);
  yearInput.addEventListener("input", autoFillTitle);

  yearInput.value = new Date().getFullYear();
});

function displayCurrentUser() {
  document.getElementById("userName").textContent = monthlyPlanUser.FULL_NAME || "User";
  document.getElementById("userRole").textContent = monthlyPlanUser.ROLE || "";
}

function prepareMonthlyPlanPage() {
  const role = String(monthlyPlanUser.ROLE || "").toUpperCase();

  if (role !== "MAIN_ADMIN") {
    document.getElementById("monthlyPlanFormSection").classList.add("hidden");
    document.getElementById("adminOnlyNotice").classList.remove("hidden");
  }
}

async function loadMonthlyPlans() {
  const tbody = document.getElementById("monthlyPlansTableBody");

  tbody.innerHTML = `
    <tr>
      <td colspan="9" class="empty-cell">Loading monthly plans...</td>
    </tr>
  `;

  try {
    const response = await fetch(API_URL + "?action=monthlyPlans");
    const result = await response.json();

    if (!result.success) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="empty-cell">${escapeHtml(result.message || "Failed to load monthly plans.")}</td>
        </tr>
      `;
      return;
    }

    monthlyPlans = result.data || [];
    renderMonthlyPlans(monthlyPlans);

  } catch (error) {
    console.error(error);
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-cell">Unable to connect to backend.</td>
      </tr>
    `;
  }
}

function renderMonthlyPlans(plans) {
  const tbody = document.getElementById("monthlyPlansTableBody");
  tbody.innerHTML = "";

  if (!plans || plans.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-cell">No monthly plans found. Create one first.</td>
      </tr>
    `;
    return;
  }

  plans.forEach(function (plan) {
    const isActive = String(plan.STATUS || "").toUpperCase() === "ACTIVE";
    const canManage = String(monthlyPlanUser.ROLE || "").toUpperCase() === "MAIN_ADMIN";

    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${escapeHtml(plan.PLAN_ID)}</td>
      <td>${escapeHtml(plan.MONTH)}</td>
      <td>${escapeHtml(plan.YEAR)}</td>
      <td>
        <strong>${escapeHtml(plan.TITLE)}</strong>
      </td>
      <td>
        <span class="status-badge ${isActive ? "status-green" : "status-gray"}">
          ${escapeHtml(plan.STATUS)}
        </span>
      </td>
      <td>${escapeHtml(plan.CREATED_BY)}</td>
      <td>${escapeHtml(plan.CREATED_AT)}</td>
      <td>${escapeHtml(plan.REMARKS)}</td>
      <td>
        ${
          isActive 
            ? `<span class="muted-text">Current Active</span>`
            : canManage
              ? `<button class="small-btn" onclick="setActivePlan('${escapeAttr(plan.PLAN_ID)}')">Set Active</button>`
              : `<span class="muted-text">No action</span>`
        }
      </td>
    `;

    tbody.appendChild(row);
  });
}

async function saveMonthlyPlan(event) {
  event.preventDefault();

  const role = String(monthlyPlanUser.ROLE || "").toUpperCase();

  if (role !== "MAIN_ADMIN") {
    showPlanMessage("Only the Main Admin can create monthly plans.", "error");
    return;
  }

  const month = document.getElementById("month").value.trim();
  const year = document.getElementById("year").value.trim();
  const title = document.getElementById("title").value.trim();
  const status = document.getElementById("planStatus").value.trim();
  const remarks = document.getElementById("remarks").value.trim();

  if (!month || !year || !title) {
    showPlanMessage("Please complete month, year, and title.", "error");
    return;
  }

  const saveBtn = document.getElementById("savePlanBtn");
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action: "createMonthlyPlan",
        MONTH: month,
        YEAR: year,
        TITLE: title,
        STATUS: status,
        CREATED_BY: monthlyPlanUser.FULL_NAME || "SYSTEM",
        REMARKS: remarks
      })
    });

    const result = await response.json();

    if (!result.success) {
      showPlanMessage(result.message || "Failed to save monthly plan.", "error");
      return;
    }

    if (status === "ACTIVE" && result.id) {
      await activatePlanSilently(result.id);
    }

    showPlanMessage("Monthly plan saved successfully.", "success");
    clearPlanForm();
    loadMonthlyPlans();

  } catch (error) {
    console.error(error);
    showPlanMessage("Unable to connect to backend.", "error");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Monthly Plan";
  }
}

async function setActivePlan(planId) {
  if (!planId) return;

  const confirmed = confirm("Set this as the active monthly plan?");

  if (!confirmed) return;

  try {
    const result = await activatePlanSilently(planId);

    if (!result.success) {
      alert(result.message || "Failed to set active plan.");
      return;
    }

    alert("Active monthly plan updated.");
    loadMonthlyPlans();

  } catch (error) {
    console.error(error);
    alert("Unable to connect to backend.");
  }
}

async function activatePlanSilently(planId) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify({
      action: "setActivePlan",
      PLAN_ID: planId,
      updatedBy: monthlyPlanUser.FULL_NAME || "SYSTEM"
    })
  });

  return await response.json();
}

function autoFillTitle() {
  const month = document.getElementById("month").value.trim();
  const year = document.getElementById("year").value.trim();
  const titleInput = document.getElementById("title");

  if (!month || !year) return;

  titleInput.value = `Consolidated Activities for ${month} ${year}`;
}

function clearPlanForm() {
  document.getElementById("month").value = "";
  document.getElementById("year").value = new Date().getFullYear();
  document.getElementById("title").value = "";
  document.getElementById("planStatus").value = "ACTIVE";
  document.getElementById("remarks").value = "";
  showPlanMessage("", "");
}

function showPlanMessage(text, type) {
  const message = document.getElementById("planFormMessage");

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

function escapeAttr(value) {
  if (value === null || value === undefined) return "";

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}