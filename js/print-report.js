let printActivePlan = null;
let printActivities = [];
let printAssignees = [];
let printUploads = [];
let printDashboard = null;

document.addEventListener("DOMContentLoaded", function () {
  loadPrintReport();
});

async function loadPrintReport() {
  document.getElementById("reportSubtitle").textContent = "Loading report data...";

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

    printActivePlan = activePlanResult.data;
    printActivities = activitiesResult.data || [];
    printAssignees = assigneesResult.data || [];
    printUploads = uploadsResult.data || [];
    printDashboard = dashboardResult.data || {};

    renderPrintReport();

  } catch (error) {
    console.error(error);

    document.getElementById("reportSubtitle").textContent = "Unable to load report data.";
    document.getElementById("printReportBody").innerHTML = `
      <tr>
        <td colspan="8">Unable to connect to backend.</td>
      </tr>
    `;
  }
}

function renderPrintReport() {
  if (printActivePlan && printActivePlan.TITLE) {
    document.getElementById("reportTitle").textContent = printActivePlan.TITLE;
    document.getElementById("reportSubtitle").textContent =
      "Monthly consolidated activities and accomplishment monitoring report";
  } else {
    document.getElementById("reportTitle").textContent = "Monthly Consolidated Activities";
    document.getElementById("reportSubtitle").textContent = "No active monthly plan selected";
  }

  setText("printTotalActivities", printDashboard.totalActivities);
  setText("printAccomplished", printDashboard.accomplishedActivities);
  setText("printForReview", printDashboard.forReviewActivities);
  setText("printDelayed", printDashboard.delayedActivities);

  document.getElementById("generatedDate").textContent =
    "Generated on: " + new Date().toLocaleString();

  renderPrintTable();
}

function renderPrintTable() {
  const tbody = document.getElementById("printReportBody");
  tbody.innerHTML = "";

  if (!printActivities || printActivities.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">No activities found for this monthly plan.</td>
      </tr>
    `;
    return;
  }

  printActivities.forEach(function (activity) {
    const assignees = getAssigneeNames(activity.ACTIVITY_ID);
    const uploadCount = getUploadsForActivity(activity.ACTIVITY_ID).length;

    const remarksParts = [];

    if (activity.REMARKS) {
      remarksParts.push(activity.REMARKS);
    }

    if (uploadCount > 0) {
      remarksParts.push("Supporting document uploaded.");
    } else {
      remarksParts.push("Supporting document required.");
    }

    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${escapeHtml(activity.DATE_LABEL || activity.ACTIVITY_DATE)}</td>
      <td>${escapeHtml(activity.DIVISION)}</td>
      <td>${escapeHtml(activity.ACTIVITY_TITLE)}</td>
      <td>${escapeHtml(activity.DESTINATION)}</td>
      <td>${escapeHtml(activity.VEHICLE)}</td>
      <td>${escapeHtml(assignees)}</td>
      <td>${escapeHtml(activity.STATUS)}</td>
      <td>${escapeHtml(remarksParts.join(" "))}</td>
    `;

    tbody.appendChild(row);
  });
}

function getAssigneeNames(activityId) {
  return printAssignees
    .filter(function (asg) {
      return String(asg.ACTIVITY_ID) === String(activityId);
    })
    .map(function (asg) {
      return asg.STAFF_NAME;
    })
    .join(", ");
}

function getUploadsForActivity(activityId) {
  return printUploads.filter(function (upload) {
    return String(upload.ACTIVITY_ID) === String(activityId);
  });
}

function setText(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = value || 0;
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