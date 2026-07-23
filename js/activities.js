const activitiesUser = requireLogin();

let activePlan = null;
let allUsers = [];
let allSections = [];
let allActivities = [];
let allAssignees = [];

document.addEventListener("DOMContentLoaded", function () {
  displayCurrentUser();
  prepareActivitiesPage();
  loadActivitiesPage();

  const form = document.getElementById("activityForm");
  form.addEventListener("submit", saveActivity);
});

function displayCurrentUser() {
  document.getElementById("userName").textContent = activitiesUser.FULL_NAME || "User";
  document.getElementById("userRole").textContent = activitiesUser.ROLE || "";
}

function prepareActivitiesPage() {
  const role = String(activitiesUser.ROLE || "").toUpperCase();

  const canEncode = role === "MAIN_ADMIN" || role === "SECTION_HEAD";

  if (!canEncode) {
    document.getElementById("activityFormSection").classList.add("hidden");
  }
}

async function loadActivitiesPage() {
  const pageMessage = document.getElementById("pageMessage");
  const tbody = document.getElementById("activitiesTableBody");

  pageMessage.textContent = "Loading data...";
  tbody.innerHTML = `
    <tr>
      <td colspan="10" class="empty-cell">Loading activities...</td>
    </tr>
  `;

  try {
    const [
      activePlanResponse,
      usersResponse,
      sectionsResponse,
      activitiesResponse,
      assigneesResponse
    ] = await Promise.all([
      fetch(API_URL + "?action=activeMonthlyPlan"),
      fetch(API_URL + "?action=users"),
      fetch(API_URL + "?action=sections"),
      fetch(API_URL + "?action=activities"),
      fetch(API_URL + "?action=assignees")
    ]);

    const activePlanResult = await activePlanResponse.json();
    const usersResult = await usersResponse.json();
    const sectionsResult = await sectionsResponse.json();
    const activitiesResult = await activitiesResponse.json();
    const assigneesResult = await assigneesResponse.json();

    if (!activePlanResult.success) throw new Error(activePlanResult.message);
    if (!usersResult.success) throw new Error(usersResult.message);
    if (!sectionsResult.success) throw new Error(sectionsResult.message);
    if (!activitiesResult.success) throw new Error(activitiesResult.message);
    if (!assigneesResult.success) throw new Error(assigneesResult.message);

    activePlan = activePlanResult.data;
    allUsers = usersResult.data || [];
    allSections = sectionsResult.data || [];
    allActivities = activitiesResult.data || [];
    allAssignees = assigneesResult.data || [];

    renderActivePlan();
    renderSectionOptions();
    renderStaffPicker();
    renderActivities(allActivities);

    pageMessage.textContent = "Activities loaded successfully.";

  } catch (error) {
    console.error(error);
    pageMessage.textContent = "Unable to load activities data.";
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="empty-cell">Unable to connect to backend.</td>
      </tr>
    `;
  }
}

function renderActivePlan() {
  const title = document.getElementById("activePlanTitle");

  if (activePlan && activePlan.TITLE) {
    title.textContent = activePlan.TITLE;
  } else {
    title.textContent = "No Active Monthly Plan";
    document.getElementById("pageMessage").textContent =
      "Please create an active monthly plan first.";
  }
}

function renderSectionOptions() {
  const division = document.getElementById("division");

  const activeSections = allSections.filter(function (section) {
    return String(section.STATUS || "").toUpperCase() === "ACTIVE";
  });

  division.innerHTML = `<option value="">Select Division / Section</option>`;

  activeSections.forEach(function (section) {
    division.innerHTML += `
      <option value="${escapeAttr(section.SECTION_NAME)}">
        ${escapeHtml(section.SECTION_NAME)}
      </option>
    `;
  });
}

function renderStaffPicker() {
  const picker = document.getElementById("staffPicker");
  const search = normalize(document.getElementById("staffSearch").value);

  const activeStaff = allUsers.filter(function (user) {
    const role = String(user.ROLE || "").toUpperCase();
    const status = String(user.STATUS || "").toUpperCase();

    const isStaffRole = role === "STAFF" || role === "SECTION_HEAD";
    const isActive = status === "ACTIVE";

    const matchesSearch =
      normalize(user.FULL_NAME).includes(search) ||
      normalize(user.POSITION).includes(search) ||
      normalize(user.SECTION).includes(search);

    return isStaffRole && isActive && matchesSearch;
  });

  if (activeStaff.length === 0) {
    picker.innerHTML = `
      <div class="empty-picker">
        No active staff found.
      </div>
    `;
    return;
  }

  picker.innerHTML = "";

  activeStaff.forEach(function (staff) {
    const item = document.createElement("label");
    item.className = "staff-check-item";

    item.innerHTML = `
      <input 
        type="checkbox" 
        name="assignedStaff" 
        value="${escapeAttr(staff.FULL_NAME)}"
        data-section="${escapeAttr(staff.SECTION)}"
      />

      <span>
        <strong>${escapeHtml(staff.FULL_NAME)}</strong>
        <small>${escapeHtml(staff.POSITION)} • ${escapeHtml(staff.SECTION)}</small>
      </span>
    `;

    picker.appendChild(item);
  });
}

function clearSelectedStaff() {
  document.querySelectorAll("input[name='assignedStaff']").forEach(function (checkbox) {
    checkbox.checked = false;
  });
}

async function saveActivity(event) {
  event.preventDefault();

  if (!activePlan || !activePlan.PLAN_ID) {
    showActivityMessage("Please create or activate a monthly plan first.", "error");
    return;
  }

  const role = String(activitiesUser.ROLE || "").toUpperCase();

  if (role !== "MAIN_ADMIN" && role !== "SECTION_HEAD") {
    showActivityMessage("You are not allowed to encode activities.", "error");
    return;
  }

  const activityDate = document.getElementById("activityDate").value;
  const dateLabel = document.getElementById("dateLabel").value.trim();
  const division = document.getElementById("division").value.trim();
  const activityTitle = document.getElementById("activityTitle").value.trim();
  const destination = document.getElementById("destination").value.trim();
  const vehicle = document.getElementById("vehicle").value.trim();
  const status = document.getElementById("status").value.trim();
  const remarks = document.getElementById("remarks").value.trim();

  const selectedStaff = getSelectedStaff();

  if (!dateLabel && !activityDate) {
    showActivityMessage("Please provide activity date or date label.", "error");
    return;
  }

  if (!division || !activityTitle) {
    showActivityMessage("Please complete division and activity.", "error");
    return;
  }

  if (selectedStaff.length === 0) {
    showActivityMessage("Please select at least one responsible staff.", "error");
    return;
  }

  const saveBtn = document.getElementById("saveActivityBtn");
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action: "createActivity",
        PLAN_ID: activePlan.PLAN_ID,
        ACTIVITY_DATE: activityDate,
        DATE_LABEL: dateLabel || activityDate,
        DIVISION: division,
        ACTIVITY_TITLE: activityTitle,
        DESTINATION: destination,
        VEHICLE: vehicle || "N/A",
        STATUS: status || "SCHEDULED",
        REQUIRED_UPLOAD: "YES",
        HAS_UPLOAD: "NO",
        REMARKS: remarks,
        CREATED_BY: activitiesUser.FULL_NAME || "SYSTEM",
        ASSIGNEES: selectedStaff
      })
    });

    const result = await response.json();

    if (!result.success) {
      showActivityMessage(result.message || "Failed to save activity.", "error");
      return;
    }

    showActivityMessage("Activity saved successfully.", "success");
    clearActivityForm();
    loadActivitiesPage();

  } catch (error) {
    console.error(error);
    showActivityMessage("Unable to connect to backend.", "error");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Activity";
  }
}

function getSelectedStaff() {
  const checked = document.querySelectorAll("input[name='assignedStaff']:checked");

  return Array.from(checked).map(function (checkbox) {
    return {
      STAFF_NAME: checkbox.value,
      SECTION: checkbox.dataset.section || "",
      ROLE_IN_ACTIVITY: "Responsible Person",
      REMARKS: ""
    };
  });
}

function renderActivities(activities) {
  const tbody = document.getElementById("activitiesTableBody");
  tbody.innerHTML = "";

  if (!activities || activities.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="empty-cell">
          No activities found. Encode monthly activities first.
        </td>
      </tr>
    `;
    return;
  }

  activities.forEach(function (activity) {
    const relatedAssignees = allAssignees.filter(function (asg) {
      return String(asg.ACTIVITY_ID) === String(activity.ACTIVITY_ID);
    });

    const assigneeNames = relatedAssignees.map(function (asg) {
      return asg.STAFF_NAME;
    }).join(", ");

    const uploadText = String(activity.HAS_UPLOAD || "").toUpperCase() === "YES"
      ? `<span class="status-badge status-green">Uploaded</span>`
      : `<span class="status-badge status-red">Required</span>`;

    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${escapeHtml(activity.DATE_LABEL || activity.ACTIVITY_DATE)}</td>
      <td>${escapeHtml(activity.DIVISION)}</td>
      <td>
        <strong>${escapeHtml(activity.ACTIVITY_TITLE)}</strong>
      </td>
      <td>${escapeHtml(activity.DESTINATION)}</td>
      <td>${escapeHtml(activity.VEHICLE)}</td>
      <td>${escapeHtml(assigneeNames || "No assigned staff")}</td>
      <td>
        <span class="status-badge ${getStatusClass(activity.STATUS)}">
          ${escapeHtml(activity.STATUS)}
        </span>
      </td>
      <td>${uploadText}</td>
      <td>${escapeHtml(activity.REMARKS)}</td>
      <td>${renderActionButtons(activity)}</td>
    `;

    tbody.appendChild(row);
  });
}

function renderActionButtons(activity) {
  const role = String(activitiesUser.ROLE || "").toUpperCase();
  const canUpdate = role === "MAIN_ADMIN" || role === "SECTION_HEAD" || role === "BOSS";

  if (!canUpdate) {
    return `<span class="muted-text">View only</span>`;
  }

  const activityId = escapeAttr(activity.ACTIVITY_ID);

  return `
    <div class="table-actions">
      <button class="small-btn" onclick="changeActivityStatus('${activityId}', 'ONGOING')">Ongoing</button>
      <button class="small-btn warning-btn" onclick="changeActivityStatus('${activityId}', 'DELAYED')">Delayed</button>
      <button class="small-btn warning-btn" onclick="changeActivityStatus('${activityId}', 'RESCHEDULED')">Rescheduled</button>
      <button class="small-btn success-btn" onclick="changeActivityStatus('${activityId}', 'ACCOMPLISHED')">Accomplished</button>
    </div>
  `;
}

async function changeActivityStatus(activityId, status) {
  if (!activityId || !status) return;

  let message = `Change activity status to ${status}?`;

  if (status === "ACCOMPLISHED") {
    message =
      "Mark as ACCOMPLISHED? This will only work if a supporting document/report has already been uploaded.";
  }

  const confirmed = confirm(message);

  if (!confirmed) return;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action: "updateActivityStatus",
        ACTIVITY_ID: activityId,
        STATUS: status,
        REVIEWED_BY: activitiesUser.FULL_NAME || "SYSTEM",
        updatedBy: activitiesUser.FULL_NAME || "SYSTEM"
      })
    });

    const result = await response.json();

    if (!result.success) {
      alert(result.message || "Failed to update activity status.");
      return;
    }

    alert("Activity status updated.");
    loadActivitiesPage();

  } catch (error) {
    console.error(error);
    alert("Unable to connect to backend.");
  }
}

function filterActivities() {
  const search = normalize(document.getElementById("activitySearch").value);

  if (!search) {
    renderActivities(allActivities);
    return;
  }

  const filtered = allActivities.filter(function (activity) {
    const assignees = allAssignees
      .filter(asg => String(asg.ACTIVITY_ID) === String(activity.ACTIVITY_ID))
      .map(asg => asg.STAFF_NAME)
      .join(" ");

    return normalize(activity.DATE_LABEL).includes(search) ||
      normalize(activity.DIVISION).includes(search) ||
      normalize(activity.ACTIVITY_TITLE).includes(search) ||
      normalize(activity.DESTINATION).includes(search) ||
      normalize(activity.VEHICLE).includes(search) ||
      normalize(activity.STATUS).includes(search) ||
      normalize(assignees).includes(search);
  });

  renderActivities(filtered);
}

function clearActivityForm() {
  document.getElementById("activityDate").value = "";
  document.getElementById("dateLabel").value = "";
  document.getElementById("division").value = "";
  document.getElementById("activityTitle").value = "";
  document.getElementById("destination").value = "";
  document.getElementById("vehicle").value = "";
  document.getElementById("status").value = "SCHEDULED";
  document.getElementById("remarks").value = "";
  document.getElementById("staffSearch").value = "";

  renderStaffPicker();
  showActivityMessage("", "");
}

function showActivityMessage(text, type) {
  const message = document.getElementById("activityFormMessage");

  message.textContent = text;
  message.className = "message";

  if (type) {
    message.classList.add(type);
  }
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