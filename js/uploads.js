const uploadUser = requireLogin();

let uploadActivePlan = null;
let uploadActivities = [];
let uploadAssignees = [];
let uploadRecords = [];

document.addEventListener("DOMContentLoaded", function () {
  displayUploadUser();
  prepareUploadPage();
  loadUploadsPage();

  const form = document.getElementById("uploadForm");
  form.addEventListener("submit", uploadSupportingFile);
});

function displayUploadUser() {
  document.getElementById("userName").textContent = uploadUser.FULL_NAME || "User";
  document.getElementById("userRole").textContent = uploadUser.ROLE || "";
}

function prepareUploadPage() {
  const role = String(uploadUser.ROLE || "").toUpperCase();

  if (role === "BOSS") {
    document.getElementById("uploadFormSection").classList.add("hidden");
  }
}

async function loadUploadsPage() {
  const pageMessage = document.getElementById("pageMessage");

  pageMessage.textContent = "Loading upload data...";

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

    uploadActivePlan = activePlanResult.data;
    uploadActivities = activitiesResult.data || [];
    uploadAssignees = assigneesResult.data || [];
    uploadRecords = uploadsResult.data || [];

    renderActivePlanTitle();
    renderActivityOptions();
    renderActivitiesNeedingUpload();
    renderUploadsTable(uploadRecords);

    pageMessage.textContent = "Upload records loaded successfully.";

  } catch (error) {
    console.error(error);
    pageMessage.textContent = "Unable to load upload data.";

    document.getElementById("activitiesUploadTableBody").innerHTML = `
      <tr>
        <td colspan="6" class="empty-cell">Unable to connect to backend.</td>
      </tr>
    `;

    document.getElementById("uploadsTableBody").innerHTML = `
      <tr>
        <td colspan="8" class="empty-cell">Unable to connect to backend.</td>
      </tr>
    `;
  }
}

function renderActivePlanTitle() {
  const title = document.getElementById("activePlanTitle");

  if (uploadActivePlan && uploadActivePlan.TITLE) {
    title.textContent = uploadActivePlan.TITLE;
  } else {
    title.textContent = "No Active Monthly Plan";
  }
}

function renderActivityOptions() {
  const activitySelect = document.getElementById("activitySelect");
  const search = normalize(document.getElementById("activitySearch").value);

  const filteredActivities = uploadActivities.filter(function (activity) {
    const assignees = getAssigneeNames(activity.ACTIVITY_ID);

    return normalize(activity.DATE_LABEL).includes(search) ||
      normalize(activity.ACTIVITY_TITLE).includes(search) ||
      normalize(activity.DIVISION).includes(search) ||
      normalize(activity.DESTINATION).includes(search) ||
      normalize(activity.STATUS).includes(search) ||
      normalize(assignees).includes(search);
  });

  activitySelect.innerHTML = `<option value="">Select related activity</option>`;

  filteredActivities.forEach(function (activity) {
    const assignees = getAssigneeNames(activity.ACTIVITY_ID);
    const label = `${activity.DATE_LABEL || activity.ACTIVITY_DATE} | ${activity.ACTIVITY_TITLE} | ${assignees}`;

    activitySelect.innerHTML += `
      <option value="${escapeAttr(activity.ACTIVITY_ID)}">
        ${escapeHtml(label)}
      </option>
    `;
  });

  onActivitySelect();
}

function onActivitySelect() {
  const activityId = document.getElementById("activitySelect").value;
  const uploadedFor = document.getElementById("uploadedFor");

  uploadedFor.innerHTML = `<option value="">Select responsible staff</option>`;

  if (!activityId) return;

  const relatedAssignees = uploadAssignees.filter(function (asg) {
    return String(asg.ACTIVITY_ID) === String(activityId);
  });

  relatedAssignees.forEach(function (asg) {
    uploadedFor.innerHTML += `
      <option value="${escapeAttr(asg.STAFF_NAME)}">
        ${escapeHtml(asg.STAFF_NAME)}
      </option>
    `;
  });

  if (relatedAssignees.length === 1) {
    uploadedFor.value = relatedAssignees[0].STAFF_NAME;
  }
}

async function uploadSupportingFile(event) {
  event.preventDefault();

  const activityId = document.getElementById("activitySelect").value;
  const uploadedFor = document.getElementById("uploadedFor").value;
  const fileInput = document.getElementById("fileInput");
  const uploadType = document.getElementById("uploadType").value;
  const uploadRemarks = document.getElementById("uploadRemarks").value.trim();

  if (!activityId) {
    showUploadMessage("Please select the related activity.", "error");
    return;
  }

  if (!fileInput.files || fileInput.files.length === 0) {
    showUploadMessage("Please select a file to upload.", "error");
    return;
  }

  const file = fileInput.files[0];

  const maxSize = 5 * 1024 * 1024;

  if (file.size > maxSize) {
    showUploadMessage("File is too large. Please upload a file not more than 5MB.", "error");
    return;
  }

  const uploadBtn = document.getElementById("uploadBtn");
  uploadBtn.disabled = true;
  uploadBtn.textContent = "Uploading...";

  try {
    const fileBase64 = await readFileAsBase64(file);

    const remarksText = [
      uploadType ? "Type: " + uploadType : "",
      uploadRemarks || ""
    ].filter(Boolean).join(" | ");

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action: "uploadFile",
        ACTIVITY_ID: activityId,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        fileBase64: fileBase64,
        UPLOADED_BY: uploadUser.FULL_NAME || "SYSTEM",
        UPLOADED_FOR: uploadedFor || "",
        UPLOAD_REMARKS: remarksText
      })
    });

    const result = await response.json();

    if (!result.success) {
      showUploadMessage(result.message || "Failed to upload file.", "error");
      return;
    }

    showUploadMessage("File uploaded successfully. Activity is now FOR_REVIEW.", "success");
    clearUploadForm();
    loadUploadsPage();

  } catch (error) {
    console.error(error);
    showUploadMessage("Unable to upload file. Please try again.", "error");
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.textContent = "Upload File";
  }
}

function readFileAsBase64(file) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();

    reader.onload = function () {
      const result = String(reader.result || "");
      const base64 = result.split(",")[1] || "";
      resolve(base64);
    };

    reader.onerror = function () {
      reject(reader.error);
    };

    reader.readAsDataURL(file);
  });
}

function renderActivitiesNeedingUpload() {
  const tbody = document.getElementById("activitiesUploadTableBody");
  tbody.innerHTML = "";

  const pendingActivities = uploadActivities.filter(function (activity) {
    const status = String(activity.STATUS || "").toUpperCase();

    return status !== "ACCOMPLISHED" && status !== "CANCELLED";
  });

  if (pendingActivities.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-cell">No pending activities.</td>
      </tr>
    `;
    return;
  }

  pendingActivities.forEach(function (activity) {
    const hasUpload = String(activity.HAS_UPLOAD || "").toUpperCase() === "YES";
    const assignees = getAssigneeNames(activity.ACTIVITY_ID);

    const uploadStatus = hasUpload
      ? `<span class="status-badge status-green">Uploaded</span>`
      : `<span class="status-badge status-red">Required</span>`;

    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${escapeHtml(activity.DATE_LABEL || activity.ACTIVITY_DATE)}</td>
      <td>
        <strong>${escapeHtml(activity.ACTIVITY_TITLE)}</strong>
        <br>
        <small>${escapeHtml(activity.DESTINATION)}</small>
      </td>
      <td>${escapeHtml(assignees)}</td>
      <td>
        <span class="status-badge ${getStatusClass(activity.STATUS)}">
          ${escapeHtml(activity.STATUS)}
        </span>
      </td>
      <td>${uploadStatus}</td>
      <td>
        <button class="small-btn" onclick="selectActivityForUpload('${escapeAttr(activity.ACTIVITY_ID)}')">
          Upload
        </button>
      </td>
    `;

    tbody.appendChild(row);
  });
}

function selectActivityForUpload(activityId) {
  document.getElementById("activitySearch").value = "";
  renderActivityOptions();

  document.getElementById("activitySelect").value = activityId;
  onActivitySelect();

  document.getElementById("uploadFormSection").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function renderUploadsTable(records) {
  const tbody = document.getElementById("uploadsTableBody");
  tbody.innerHTML = "";

  if (!records || records.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-cell">No uploaded documents yet.</td>
      </tr>
    `;
    return;
  }

  records.forEach(function (upload) {
    const activity = uploadActivities.find(function (item) {
      return String(item.ACTIVITY_ID) === String(upload.ACTIVITY_ID);
    });

    const activityTitle = activity
      ? activity.ACTIVITY_TITLE
      : upload.ACTIVITY_ID;

    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${escapeHtml(upload.UPLOAD_ID)}</td>
      <td>
        <strong>${escapeHtml(activityTitle)}</strong>
        <br>
        <small>${escapeHtml(upload.ACTIVITY_ID)}</small>
      </td>
      <td>${escapeHtml(upload.FILE_NAME)}</td>
      <td>${escapeHtml(upload.UPLOADED_BY)}</td>
      <td>${escapeHtml(upload.UPLOADED_FOR)}</td>
      <td>${escapeHtml(upload.UPLOADED_AT)}</td>
      <td>${escapeHtml(upload.UPLOAD_REMARKS)}</td>
      <td>
        <a href="${escapeAttr(upload.FILE_LINK)}" target="_blank">Open File</a>
      </td>
    `;

    tbody.appendChild(row);
  });
}

function filterUploads() {
  const search = normalize(document.getElementById("uploadSearch").value);

  if (!search) {
    renderUploadsTable(uploadRecords);
    return;
  }

  const filtered = uploadRecords.filter(function (upload) {
    const activity = uploadActivities.find(function (item) {
      return String(item.ACTIVITY_ID) === String(upload.ACTIVITY_ID);
    });

    const activityTitle = activity ? activity.ACTIVITY_TITLE : "";

    return normalize(upload.UPLOAD_ID).includes(search) ||
      normalize(upload.FILE_NAME).includes(search) ||
      normalize(upload.UPLOADED_BY).includes(search) ||
      normalize(upload.UPLOADED_FOR).includes(search) ||
      normalize(upload.UPLOAD_REMARKS).includes(search) ||
      normalize(activityTitle).includes(search);
  });

  renderUploadsTable(filtered);
}

function clearUploadForm() {
  document.getElementById("activitySearch").value = "";
  document.getElementById("activitySelect").value = "";
  document.getElementById("uploadedFor").innerHTML = `<option value="">Select responsible staff</option>`;
  document.getElementById("fileInput").value = "";
  document.getElementById("uploadType").value = "Completion Report";
  document.getElementById("uploadRemarks").value = "";

  renderActivityOptions();
}

function getAssigneeNames(activityId) {
  return uploadAssignees
    .filter(function (asg) {
      return String(asg.ACTIVITY_ID) === String(activityId);
    })
    .map(function (asg) {
      return asg.STAFF_NAME;
    })
    .join(", ");
}

function showUploadMessage(text, type) {
  const message = document.getElementById("uploadFormMessage");

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