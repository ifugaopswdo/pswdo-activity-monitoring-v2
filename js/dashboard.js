const currentUser = requireLogin();

let dashboardData = null;
let staffCards = [];

document.addEventListener("DOMContentLoaded", function () {
  displayCurrentUser();
  loadDashboard();
});

function displayCurrentUser() {
  if (!currentUser) return;

  document.getElementById("userName").textContent = currentUser.FULL_NAME || "User";
  document.getElementById("userRole").textContent = currentUser.ROLE || "";
}

async function loadDashboard() {
  const loadingText = document.getElementById("loadingText");
  const staffGrid = document.getElementById("staffCardsGrid");

  loadingText.textContent = "Loading dashboard data...";
  staffGrid.innerHTML = `<div class="empty-card">Loading staff...</div>`;

  try {
    const response = await fetch(API_URL + "?action=dashboard");
    const result = await response.json();

    if (!result.success) {
      loadingText.textContent = result.message || "Failed to load dashboard.";
      staffGrid.innerHTML = `<div class="empty-card">Failed to load staff.</div>`;
      return;
    }

    dashboardData = result.data;
    staffCards = dashboardData.staffCards || [];

    renderDashboardSummary(dashboardData);
    renderStaffCards(staffCards);

    loadingText.textContent = "Dashboard updated successfully.";

  } catch (error) {
    console.error(error);
    loadingText.textContent = "Unable to connect to backend.";
    staffGrid.innerHTML = `<div class="empty-card">Unable to connect to backend.</div>`;
  }
}

function renderDashboardSummary(data) {
  if (data.activePlan && data.activePlan.TITLE) {
    document.getElementById("activePlanTitle").textContent = data.activePlan.TITLE;
  } else {
    document.getElementById("activePlanTitle").textContent = "No Active Monthly Plan";
  }

  setText("totalStaff", data.totalStaff);
  setText("totalActivities", data.totalActivities);
  setText("scheduledActivities", data.scheduledActivities);
  setText("ongoingActivities", data.ongoingActivities);
  setText("forReviewActivities", data.forReviewActivities);
  setText("accomplishedActivities", data.accomplishedActivities);
  setText("delayedActivities", data.delayedActivities);
  setText("staffWithNoAssignedActivity", data.staffWithNoAssignedActivity);
}

function renderStaffCards(cards) {
  const staffGrid = document.getElementById("staffCardsGrid");
  staffGrid.innerHTML = "";

  if (!cards || cards.length === 0) {
    staffGrid.innerHTML = `
      <div class="empty-card">
        No active staff found. Add staff accounts first.
      </div>
    `;
    return;
  }

  cards.forEach(function (staff) {
    const card = document.createElement("button");
    card.className = "staff-card";
    card.type = "button";
    card.dataset.staffName = staff.FULL_NAME || "";

    card.innerHTML = `
      <div class="staff-avatar">${getInitials(staff.FULL_NAME)}</div>

      <div class="staff-card-content">
        <h3>${escapeHtml(staff.FULL_NAME)}</h3>
        <p>${escapeHtml(staff.POSITION)}</p>
        <span>${escapeHtml(staff.SECTION)}</span>

        <div class="staff-stats">
          <div>
            <strong>${staff.totalActivities || 0}</strong>
            <small>Total</small>
          </div>

          <div>
            <strong>${staff.accomplished || 0}</strong>
            <small>Done</small>
          </div>

          <div>
            <strong>${staff.forReview || 0}</strong>
            <small>Review</small>
          </div>

          <div>
            <strong>${staff.delayed || 0}</strong>
            <small>Delayed</small>
          </div>
        </div>
      </div>

      <div class="staff-status ${getStaffCardStatusClass(staff)}">
        ${getStaffCardStatusText(staff)}
      </div>
    `;

    card.addEventListener("click", function () {
      openStaffDetails(staff.FULL_NAME);
    });

    staffGrid.appendChild(card);
  });
}

function filterStaffCards() {
  const search = normalize(document.getElementById("staffSearch").value);

  if (!search) {
    renderStaffCards(staffCards);
    return;
  }

  const filtered = staffCards.filter(function (staff) {
    return normalize(staff.FULL_NAME).includes(search) ||
      normalize(staff.POSITION).includes(search) ||
      normalize(staff.SECTION).includes(search);
  });

  renderStaffCards(filtered);
}

async function openStaffDetails(staffName) {
  if (!staffName) return;

  const modal = document.getElementById("staffModal");
  modal.classList.remove("hidden");

  document.getElementById("modalStaffName").textContent = staffName;
  document.getElementById("modalStaffInfo").textContent = "Loading staff details...";
  document.getElementById("modalActivitiesBody").innerHTML = `
    <tr>
      <td colspan="7" class="empty-cell">Loading activities...</td>
    </tr>
  `;

  try {
    const url = API_URL + "?action=staffDetails&staffName=" + encodeURIComponent(staffName);
    const response = await fetch(url);
    const result = await response.json();

    if (!result.success) {
      document.getElementById("modalStaffInfo").textContent = result.message || "Failed to load staff details.";
      return;
    }

    renderStaffDetails(result.data || {});

  } catch (error) {
    console.error(error);
    document.getElementById("modalStaffInfo").textContent = "Unable to connect to backend.";
  }
}

function renderStaffDetails(data) {
  const staff = data.staff || {};
  const activities = data.activities || [];

  document.getElementById("modalStaffName").textContent = staff.FULL_NAME || "Staff";
  document.getElementById("modalStaffInfo").textContent =
    (staff.POSITION || "No position") + " • " + (staff.SECTION || "No section");

  const accomplished = activities.filter(activity => normalize(activity.STATUS) === "accomplished").length;
  const forReview = activities.filter(activity => normalize(activity.STATUS) === "for_review").length;
  const delayed = activities.filter(activity => normalize(activity.STATUS) === "delayed").length;

  setText("modalTotalActivities", activities.length);
  setText("modalAccomplished", accomplished);
  setText("modalForReview", forReview);
  setText("modalDelayed", delayed);

  renderStaffActivities(activities);
}

function renderStaffActivities(activities) {
  const tbody = document.getElementById("modalActivitiesBody");
  tbody.innerHTML = "";

  if (!activities || activities.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-cell">No assigned activities for this monthly plan.</td>
      </tr>
    `;
    return;
  }

  activities.forEach(function (activity) {
    const uploads = activity.UPLOADS || [];

    const uploadText = uploads.length > 0
      ? `<a href="${escapeAttr(uploads[0].FILE_LINK)}" target="_blank">Open File</a>`
      : `<span class="muted-text">No upload</span>`;

    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${escapeHtml(activity.DATE_LABEL || formatDateOnly(activity.ACTIVITY_DATE))}</td>
      <td>
        <strong>${escapeHtml(activity.ACTIVITY_TITLE)}</strong>
        <br>
        <small>${escapeHtml(activity.DIVISION)}</small>
      </td>
      <td>${escapeHtml(activity.DESTINATION)}</td>
      <td>${escapeHtml(activity.VEHICLE)}</td>
      <td>
        <span class="status-badge ${getStatusClass(activity.STATUS)}">
          ${escapeHtml(activity.STATUS)}
        </span>
      </td>
      <td>${uploadText}</td>
      <td>${escapeHtml(activity.REMARKS)}</td>
    `;

    tbody.appendChild(row);
  });
}

function closeStaffModal() {
  document.getElementById("staffModal").classList.add("hidden");
}

function getStaffCardStatusText(staff) {
  if ((staff.delayed || 0) > 0) return "Has Delayed";
  if ((staff.forReview || 0) > 0) return "For Review";
  if ((staff.totalActivities || 0) === 0) return "No Activity";
  if ((staff.accomplished || 0) === (staff.totalActivities || 0)) return "All Done";
  if ((staff.ongoing || 0) > 0) return "Ongoing";
  return "Scheduled";
}

function getStaffCardStatusClass(staff) {
  if ((staff.delayed || 0) > 0) return "staff-danger";
  if ((staff.forReview || 0) > 0) return "staff-warning";
  if ((staff.totalActivities || 0) === 0) return "staff-gray";
  if ((staff.accomplished || 0) === (staff.totalActivities || 0)) return "staff-success";
  if ((staff.ongoing || 0) > 0) return "staff-blue";
  return "staff-blue";
}

function getStatusClass(status) {
  const value = String(status || "").toUpperCase();

  if (value === "ACCOMPLISHED") return "status-green";
  if (value === "FOR_REVIEW") return "status-yellow";
  if (value === "ONGOING") return "status-blue";
  if (value === "SCHEDULED") return "status-blue";
  if (value === "DELAYED") return "status-red";
  if (value === "RESCHEDULED") return "status-yellow";
  if (value === "CANCELLED") return "status-gray";
  if (value === "FOR_UPLOAD") return "status-red";

  return "status-gray";
}

function getInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(" ")
    .filter(Boolean);

  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();

  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function formatDateOnly(value) {
  if (!value) return "";

  const date = new Date(value);

  if (isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString();
}

function setText(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = value || 0;
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