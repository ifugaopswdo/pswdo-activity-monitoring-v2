const exportUser = requireLogin();

let exportActivePlan = null;
let exportActivities = [];
let exportAssignees = [];
let exportUploads = [];
let exportDashboard = null;

document.addEventListener("DOMContentLoaded", function () {
  displayExportUser();
  prepareExportPage();
  loadExportPage();
});

function displayExportUser() {
  document.getElementById("userName").textContent = exportUser.FULL_NAME || "User";
  document.getElementById("userRole").textContent = exportUser.ROLE || "";
}

function prepareExportPage() {
  const role = String(exportUser.ROLE || "").toUpperCase();
  const canExport = role === "BOSS" || role === "MAIN_ADMIN" || role === "SECTION_HEAD";

  if (!canExport) {
    document.getElementById("accessDenied").classList.remove("hidden");
    document.getElementById("exportContent").classList.add("hidden");
  }
}

async function loadExportPage() {
  const role = String(exportUser.ROLE || "").toUpperCase();

  if (role !== "BOSS" && role !== "MAIN_ADMIN" && role !== "SECTION_HEAD") {
    return;
  }

  document.getElementById("pageMessage").textContent = "Loading export data...";

  try {
    const [
      activePlanResponse,
      activitiesResponse,
      assigneesResponse,
      uploadsResponse,
      dashboardResponse
    ] = await Promise.all([
      fetch(API_URL + "?action=activeMonthlyPlan"),
      fetch(API_URL + "?action=activities"),
      fetch(API_URL + "?action=assignees"),
      fetch(API_URL + "?action=uploads"),
      fetch(API_URL + "?action=dashboard")
    ]);

    const activePlanResult = await activePlanResponse.json();
    const activitiesResult = await activitiesResponse.json();
    const assigneesResult = await assigneesResponse.json();
    const uploadsResult = await uploadsResponse.json();
    const dashboardResult = await dashboardResponse.json();

    if (!activePlanResult.success) throw new Error(activePlanResult.message);
    if (!activitiesResult.success) throw new Error(activitiesResult.message);
    if (!assigneesResult.success) throw new Error(assigneesResult.message);
    if (!uploadsResult.success) throw new Error(uploadsResult.message);
    if (!dashboardResult.success) throw new Error(dashboardResult.message);

    exportActivePlan = activePlanResult.data;
    exportActivities = activitiesResult.data || [];
    exportAssignees = assigneesResult.data || [];
    exportUploads = uploadsResult.data || [];
    exportDashboard = dashboardResult.data || {};

    renderExportSummary();
    renderExportPreview(exportActivities);

    document.getElementById("pageMessage").textContent = "Export data loaded successfully.";

  } catch (error) {
    console.error(error);
    document.getElementById("pageMessage").textContent = "Unable to load export data.";

    document.getElementById("exportPreviewBody").innerHTML = `
      <tr>
        <td colspan="9" class="empty-cell">Unable to connect to backend.</td>
      </tr>
    `;
  }
}

function renderExportSummary() {
  if (exportActivePlan && exportActivePlan.TITLE) {
    document.getElementById("activePlanTitle").textContent = exportActivePlan.TITLE;
  } else {
    document.getElementById("activePlanTitle").textContent = "No Active Monthly Plan";
  }

  setText("totalActivities", exportDashboard.totalActivities);
  setText("accomplishedActivities", exportDashboard.accomplishedActivities);
  setText("forReviewActivities", exportDashboard.forReviewActivities);
  setText("delayedActivities", exportDashboard.delayedActivities);
}

function renderExportPreview(activities) {
  const tbody = document.getElementById("exportPreviewBody");
  tbody.innerHTML = "";

  if (!activities || activities.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-cell">No activities found for the active monthly plan.</td>
      </tr>
    `;
    return;
  }

  activities.forEach(function (activity) {
    const assignees = getAssigneeNames(activity.ACTIVITY_ID);
    const uploads = getUploadsForActivity(activity.ACTIVITY_ID);

    const uploadText = uploads.length > 0
      ? `<a href="${escapeAttr(uploads[0].FILE_LINK)}" target="_blank">Open File</a>`
      : `<span class="status-badge status-red">Required</span>`;

    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${escapeHtml(activity.DATE_LABEL || activity.ACTIVITY_DATE)}</td>
      <td>${escapeHtml(activity.DIVISION)}</td>
      <td><strong>${escapeHtml(activity.ACTIVITY_TITLE)}</strong></td>
      <td>${escapeHtml(activity.DESTINATION)}</td>
      <td>${escapeHtml(activity.VEHICLE)}</td>
      <td>${escapeHtml(assignees)}</td>
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

function filterExportPreview() {
  const search = normalize(document.getElementById("exportSearch").value);

  if (!search) {
    renderExportPreview(exportActivities);
    return;
  }

  const filtered = exportActivities.filter(function (activity) {
    const assignees = getAssigneeNames(activity.ACTIVITY_ID);
    const uploads = getUploadsForActivity(activity.ACTIVITY_ID)
      .map(upload => upload.FILE_NAME)
      .join(" ");

    return normalize(activity.DATE_LABEL).includes(search) ||
      normalize(activity.DIVISION).includes(search) ||
      normalize(activity.ACTIVITY_TITLE).includes(search) ||
      normalize(activity.DESTINATION).includes(search) ||
      normalize(activity.VEHICLE).includes(search) ||
      normalize(activity.STATUS).includes(search) ||
      normalize(activity.REMARKS).includes(search) ||
      normalize(assignees).includes(search) ||
      normalize(uploads).includes(search);
  });

  renderExportPreview(filtered);
}

function downloadConsolidatedCSV() {
  const rows = [
    [
      "Date",
      "Division",
      "Activity",
      "Destination",
      "Vehicle",
      "Responsible Staff",
      "Status",
      "Has Upload",
      "Supporting File Link",
      "Reviewed By",
      "Reviewed At",
      "Remarks"
    ]
  ];

  exportActivities.forEach(function (activity) {
    const uploads = getUploadsForActivity(activity.ACTIVITY_ID);
    const fileLinks = uploads.map(upload => upload.FILE_LINK).join(" | ");

    rows.push([
      activity.DATE_LABEL || activity.ACTIVITY_DATE || "",
      activity.DIVISION || "",
      activity.ACTIVITY_TITLE || "",
      activity.DESTINATION || "",
      activity.VEHICLE || "",
      getAssigneeNames(activity.ACTIVITY_ID),
      activity.STATUS || "",
      activity.HAS_UPLOAD || "",
      fileLinks,
      activity.REVIEWED_BY || "",
      activity.REVIEWED_AT || "",
      activity.REMARKS || ""
    ]);
  });

  const fileName = getSafePlanFileName("monthly-consolidated-activities") + ".csv";
  downloadCSV(rows, fileName);
}

function downloadStaffSummaryCSV() {
  const staffCards = exportDashboard.staffCards || [];

  const rows = [
    [
      "Staff Name",
      "Position",
      "Section",
      "Total Activities",
      "Scheduled",
      "Ongoing",
      "For Review",
      "Accomplished",
      "Delayed",
      "Rescheduled",
      "Cancelled"
    ]
  ];

  staffCards.forEach(function (staff) {
    rows.push([
      staff.FULL_NAME || "",
      staff.POSITION || "",
      staff.SECTION || "",
      staff.totalActivities || 0,
      staff.scheduled || 0,
      staff.ongoing || 0,
      staff.forReview || 0,
      staff.accomplished || 0,
      staff.delayed || 0,
      staff.rescheduled || 0,
      staff.cancelled || 0
    ]);
  });

  const fileName = getSafePlanFileName("staff-summary") + ".csv";
  downloadCSV(rows, fileName);
}

function downloadUploadsCSV() {
  const rows = [
    [
      "Upload ID",
      "Activity ID",
      "Activity",
      "File Name",
      "File Type",
      "File Link",
      "Uploaded By",
      "Uploaded For",
      "Uploaded At",
      "Upload Remarks"
    ]
  ];

  exportUploads.forEach(function (upload) {
    const activity = exportActivities.find(function (item) {
      return String(item.ACTIVITY_ID) === String(upload.ACTIVITY_ID);
    });

    rows.push([
      upload.UPLOAD_ID || "",
      upload.ACTIVITY_ID || "",
      activity ? activity.ACTIVITY_TITLE : "",
      upload.FILE_NAME || "",
      upload.FILE_TYPE || "",
      upload.FILE_LINK || "",
      upload.UPLOADED_BY || "",
      upload.UPLOADED_FOR || "",
      upload.UPLOADED_AT || "",
      upload.UPLOAD_REMARKS || ""
    ]);
  });

  const fileName = getSafePlanFileName("uploaded-documents") + ".csv";
  downloadCSV(rows, fileName);
}

function downloadCSV(rows, fileName) {
  const csv = rows.map(function (row) {
    return row.map(function (cell) {
      const value = cell === null || cell === undefined ? "" : String(cell);
      return '"' + value.replaceAll('"', '""') + '"';
    }).join(",");
  }).join("\n");

  const bom = "\uFEFF";
  const blob = new Blob([bom + csv], {
    type: "text/csv;charset=utf-8;"
  });

  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.href = url;
  link.download = fileName;
  link.click();

  URL.revokeObjectURL(url);
}

function openPrintableReport() {
  window.open("print-report.html", "_blank");
}

function getSafePlanFileName(prefix) {
  const title = exportActivePlan && exportActivePlan.TITLE
    ? exportActivePlan.TITLE
    : "PSWDO Monthly Report";

  const safeTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return prefix + "-" + safeTitle;
}

function getAssigneeNames(activityId) {
  return exportAssignees
    .filter(function (asg) {
      return String(asg.ACTIVITY_ID) === String(activityId);
    })
    .map(function (asg) {
      return asg.STAFF_NAME;
    })
    .join(", ");
}

function getUploadsForActivity(activityId) {
  return exportUploads.filter(function (upload) {
    return String(upload.ACTIVITY_ID) === String(activityId);
  });
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