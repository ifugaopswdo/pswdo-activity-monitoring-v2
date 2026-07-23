const reviewUser = requireLogin();

let reviewActivePlan = null;
let reviewActivities = [];
let reviewAssignees = [];
let reviewUploads = [];

document.addEventListener("DOMContentLoaded", function () {
  displayReviewUser();
  prepareReviewPage();
  loadReviewPage();
});

function displayReviewUser() {
  document.getElementById("userName").textContent = reviewUser.FULL_NAME || "User";
  document.getElementById("userRole").textContent = reviewUser.ROLE || "";
}

function prepareReviewPage() {
  const role = String(reviewUser.ROLE || "").toUpperCase();

  const canReview = role === "BOSS" || role === "MAIN_ADMIN" || role === "SECTION_HEAD";

  if (!canReview) {
    document.getElementById("accessDenied").classList.remove("hidden");
    document.getElementById("reviewContent").classList.add("hidden");
  }
}

async function loadReviewPage() {
  const role = String(reviewUser.ROLE || "").toUpperCase();

  if (role !== "BOSS" && role !== "MAIN_ADMIN" && role !== "SECTION_HEAD") {
    return;
  }

  document.getElementById("pageMessage").textContent = "Loading review data...";

  try {
    const [
      activePlanResponse,
      activitiesResponse,
      assigneesResponse,
      uploadsResponse
    ] = await Promise.all([
      fetch(API_URL + "?action=activeMonthlyPlan"),
      fetch(API_URL + "?action=activities"),
      fetch(API_URL + "?action=assignees"),
      fetch(API_URL + "?action=uploads")
    ]);

    const activePlanResult = await activePlanResponse.json();
    const activitiesResult = await activitiesResponse.json();
    const assigneesResult = await assigneesResponse.json();
    const uploadsResult = await uploadsResponse.json();

    if (!activePlanResult.success) throw new Error(activePlanResult.message);
    if (!activitiesResult.success) throw new Error(activitiesResult.message);
    if (!assigneesResult.success) throw new Error(assigneesResult.message);
    if (!uploadsResult.success) throw new Error(uploadsResult.message);

    reviewActivePlan = activePlanResult.data;
    reviewActivities = activitiesResult.data || [];
    reviewAssignees = assigneesResult.data || [];
    reviewUploads = uploadsResult.data || [];

    renderActivePlanTitle();
    renderReviewSummary();
    renderReviewActivities(getActivitiesForReview());
    renderAccomplishedActivities();

    document.getElementById("pageMessage").textContent = "Review data loaded successfully.";

  } catch (error) {
    console.error(error);

    document.getElementById("pageMessage").textContent = "Unable to load review data.";

    document.getElementById("reviewTableBody").innerHTML = `
      <tr>
        <td colspan="8" class="empty-cell">Unable to connect to backend.</td>
      </tr>
    `;

    document.getElementById("accomplishedTableBody").innerHTML = `
      <tr>
        <td colspan="6" class="empty-cell">Unable to connect to backend.</td>
      </tr>
    `;
  }
}

function renderActivePlanTitle() {
  const title = document.getElementById("activePlanTitle");

  if (reviewActivePlan && reviewActivePlan.TITLE) {
    title.textContent = reviewActivePlan.TITLE;
  } else {
    title.textContent = "No Active Monthly Plan";
  }
}

function renderReviewSummary() {
  const forReview = reviewActivities.filter(function (activity) {
    return String(activity.STATUS || "").toUpperCase() === "FOR_REVIEW";
  }).length;

  const accomplished = reviewActivities.filter(function (activity) {
    return String(activity.STATUS || "").toUpperCase() === "ACCOMPLISHED";
  }).length;

  const forUpload = reviewActivities.filter(function (activity) {
    const status = String(activity.STATUS || "").toUpperCase();
    const hasUpload = String(activity.HAS_UPLOAD || "").toUpperCase();

    return status !== "ACCOMPLISHED" && hasUpload !== "YES";
  }).length;

  setText("forReviewCount", forReview);
  setText("accomplishedCount", accomplished);
  setText("forUploadCount", forUpload);
  setText("totalUploadsCount", reviewUploads.length);
}

function getActivitiesForReview() {
  return reviewActivities.filter(function (activity) {
    const status = String(activity.STATUS || "").toUpperCase();
    const hasUpload = String(activity.HAS_UPLOAD || "").toUpperCase();

    return status === "FOR_REVIEW" || hasUpload === "YES";
  });
}

function renderReviewActivities(activities) {
  const tbody = document.getElementById("reviewTableBody");
  tbody.innerHTML = "";

  const pendingReview = activities.filter(function (activity) {
    return String(activity.STATUS || "").toUpperCase() !== "ACCOMPLISHED";
  });

  if (!pendingReview || pendingReview.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-cell">
          No activities waiting for review.
        </td>
      </tr>
    `;
    return;
  }

  pendingReview.forEach(function (activity) {
    const assignees = getAssigneeNames(activity.ACTIVITY_ID);
    const uploads = getUploadsForActivity(activity.ACTIVITY_ID);

    const uploadLinks = uploads.length > 0
      ? uploads.map(function (upload, index) {
          return `
            <div class="file-link-row">
              <a href="${escapeAttr(upload.FILE_LINK)}" target="_blank">
                Open File ${index + 1}
              </a>
              <small>${escapeHtml(upload.FILE_NAME)}</small>
            </div>
          `;
        }).join("")
      : `<span class="status-badge status-red">No Upload</span>`;

    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${escapeHtml(activity.DATE_LABEL || activity.ACTIVITY_DATE)}</td>
      <td>
        <strong>${escapeHtml(activity.ACTIVITY_TITLE)}</strong>
        <br>
        <small>${escapeHtml(activity.DIVISION)}</small>
      </td>
      <td>${escapeHtml(assignees)}</td>
      <td>${escapeHtml(activity.DESTINATION)}</td>
      <td>
        <span class="status-badge ${getStatusClass(activity.STATUS)}">
          ${escapeHtml(activity.STATUS)}
        </span>
      </td>
      <td>${uploadLinks}</td>
      <td>${escapeHtml(activity.REMARKS)}</td>
      <td>${renderReviewActions(activity)}</td>
    `;

    tbody.appendChild(row);
  });
}

function renderReviewActions(activity) {
  const role = String(reviewUser.ROLE || "").toUpperCase();
  const canApprove = role === "BOSS" || role === "MAIN_ADMIN" || role === "SECTION_HEAD";

  if (!canApprove) {
    return `<span class="muted-text">View only</span>`;
  }

  const hasUpload = String(activity.HAS_UPLOAD || "").toUpperCase() === "YES";
  const activityId = escapeAttr(activity.ACTIVITY_ID);

  if (!hasUpload) {
    return `<span class="muted-text">Upload required first</span>`;
  }

  return `
    <div class="table-actions">
      <button class="small-btn success-btn" onclick="approveActivity('${activityId}')">
        Approve
      </button>

      <button class="small-btn warning-btn" onclick="returnActivity('${activityId}')">
        Return
      </button>

      <button class="small-btn danger-btn" onclick="markDelayed('${activityId}')">
        Delayed
      </button>
    </div>
  `;
}

function renderAccomplishedActivities() {
  const tbody = document.getElementById("accomplishedTableBody");
  tbody.innerHTML = "";

  const accomplished = reviewActivities.filter(function (activity) {
    return String(activity.STATUS || "").toUpperCase() === "ACCOMPLISHED";
  });

  if (!accomplished || accomplished.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-cell">No accomplished activities yet.</td>
      </tr>
    `;
    return;
  }

  accomplished.forEach(function (activity) {
    const assignees = getAssigneeNames(activity.ACTIVITY_ID);
    const uploads = getUploadsForActivity(activity.ACTIVITY_ID);

    const firstUpload = uploads[0];

    const fileLink = firstUpload
      ? `<a href="${escapeAttr(firstUpload.FILE_LINK)}" target="_blank">Open File</a>`
      : `<span class="muted-text">No file</span>`;

    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${escapeHtml(activity.DATE_LABEL || activity.ACTIVITY_DATE)}</td>
      <td>
        <strong>${escapeHtml(activity.ACTIVITY_TITLE)}</strong>
        <br>
        <small>${escapeHtml(activity.DIVISION)}</small>
      </td>
      <td>${escapeHtml(assignees)}</td>
      <td>${escapeHtml(activity.REVIEWED_BY)}</td>
      <td>${escapeHtml(activity.REVIEWED_AT)}</td>
      <td>${fileLink}</td>
    `;

    tbody.appendChild(row);
  });
}

function filterReviewActivities() {
  const search = normalize(document.getElementById("reviewSearch").value);
  const activities = getActivitiesForReview();

  if (!search) {
    renderReviewActivities(activities);
    return;
  }

  const filtered = activities.filter(function (activity) {
    const assignees = getAssigneeNames(activity.ACTIVITY_ID);
    const uploads = getUploadsForActivity(activity.ACTIVITY_ID)
      .map(upload => upload.FILE_NAME)
      .join(" ");

    return normalize(activity.DATE_LABEL).includes(search) ||
      normalize(activity.ACTIVITY_TITLE).includes(search) ||
      normalize(activity.DIVISION).includes(search) ||
      normalize(activity.DESTINATION).includes(search) ||
      normalize(activity.STATUS).includes(search) ||
      normalize(activity.REMARKS).includes(search) ||
      normalize(assignees).includes(search) ||
      normalize(uploads).includes(search);
  });

  renderReviewActivities(filtered);
}

async function approveActivity(activityId) {
  const confirmed = confirm(
    "Approve this activity as ACCOMPLISHED? Make sure the supporting document/report has been reviewed."
  );

  if (!confirmed) return;

  await updateReviewStatus(activityId, "ACCOMPLISHED", "Activity approved as accomplished.");
}

async function returnActivity(activityId) {
  const remarks = prompt(
    "Enter reason for returning this activity. Example: Please upload corrected report."
  );

  if (remarks === null) return;

  await updateReviewStatus(
    activityId,
    "FOR_UPLOAD",
    remarks || "Returned for correction or additional supporting document."
  );
}

async function markDelayed(activityId) {
  const remarks = prompt("Enter reason for delay:");

  if (remarks === null) return;

  await updateReviewStatus(
    activityId,
    "DELAYED",
    remarks || "Marked delayed after review."
  );
}

async function updateReviewStatus(activityId, status, remarks) {
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
        REMARKS: remarks,
        REVIEWED_BY: reviewUser.FULL_NAME || "SYSTEM",
        updatedBy: reviewUser.FULL_NAME || "SYSTEM"
      })
    });

    const result = await response.json();

    if (!result.success) {
      alert(result.message || "Failed to update activity.");
      return;
    }

    alert("Activity updated successfully.");
    loadReviewPage();

  } catch (error) {
    console.error(error);
    alert("Unable to connect to backend.");
  }
}

function getAssigneeNames(activityId) {
  return reviewAssignees
    .filter(function (asg) {
      return String(asg.ACTIVITY_ID) === String(activityId);
    })
    .map(function (asg) {
      return asg.STAFF_NAME;
    })
    .join(", ");
}

function getUploadsForActivity(activityId) {
  return reviewUploads.filter(function (upload) {
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