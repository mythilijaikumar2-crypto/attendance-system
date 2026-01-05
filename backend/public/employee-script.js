/**
 * employee-script.js
 * - Navigation for employee sidebar
 * - Loads sections: dashboard, profile, leave, reports, quick-actions, settings
 * - Integrates with backend (empId-based auth)
 *
 * NOTE: API_BASE points to your backend. If frontend is served from same origin, set to ''
 */
const API_BASE = "http://localhost:4000"; // change to '' if serving frontend from same origin

function getToken() {
  return localStorage.getItem('nxt_token');
}
function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/* ===== AUTH CHECK ===== */
(function initAuth() {
  const token = getToken();
  if (!token) {
    // Not logged in -> redirect to login page
    window.location = './index.html';
    return;
  }
})();

// --- Global fetch wrapper to handle 401 Unauthorized ---
async function fetchWithAuth(url, options = {}) {
  // Merge Authorization header
  const headers = { ...(options.headers || {}), ...authHeaders() };
  const opts = { ...options, headers };
  try {
    const res = await fetch(url, opts);
    if (res.status === 401) {
      // Token invalid/expired, force logout
      localStorage.removeItem('nxt_token');
      localStorage.removeItem('nxt_user');
      alert('Session expired or unauthorized. Please log in again.');
      window.location = './index.html';
      return Promise.reject(new Error('Unauthorized'));
    }
    return res;
  } catch (err) {
    throw err;
  }
}

/* ===== SIDEBAR NAV HANDLING ===== */
// attach click listeners to sidebar nav links (.nav-item a expected)
document.querySelectorAll('.sidebar .nav-list .nav-item a').forEach(link => {
  link.addEventListener('click', function (e) {
    e.preventDefault();
    const href = this.getAttribute('href') || '#dashboard';
    let sectionId = href.replace('#', '') || 'dashboard';
    // Map 'attendance' nav to 'profile' section
    if (sectionId === 'attendance') sectionId = 'profile';

    // show the selected section
    document.querySelectorAll('.content-section').forEach(function (s) { s.classList.remove('active'); });
    var target = document.getElementById(sectionId);
    if (target) {
      target.classList.add('active');
      // If settings section, ensure options are visible
      if (sectionId === 'settings') {
        var settingsOptions = document.querySelector('.settings-options');
        if (settingsOptions) settingsOptions.style.display = '';
      }
    }

    // update active item
    document.querySelectorAll('.sidebar .nav-list .nav-item').forEach(function (i) { i.classList.remove('active'); });
    this.parentElement.classList.add('active');

    // update breadcrumb .current element if present
    var crumb = document.querySelector('.breadcrumb .current');
    if (crumb) crumb.innerText = this.innerText.trim();

    // lazy-load dynamic content for the section
    loadSectionContent(sectionId);
  });
});

/* Logout link (last sidebar item usually) */

// Attach logout modal only to the actual logout link, not Settings or others
document.addEventListener('DOMContentLoaded', () => {
  // Sidebar Logout link logic
  var sidebarLogoutLink = document.getElementById('sidebarLogoutLink');
  if (sidebarLogoutLink) {
    sidebarLogoutLink.addEventListener('click', function (e) {
      e.preventDefault();
      var modal = document.getElementById('logoutModal');
      if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
      }
    });
  }
  // Resignation Request Form Logic (Employee Workflow)
  // Resignation Modal Helper Functions
  const resignationModal = document.getElementById('resignationRequestModal');
  const openResignationBtn = document.getElementById('openResignationModalBtn');
  const closeResignationBtn = document.getElementById('closeResignationModalBtn');
  const resignationForm = document.getElementById('resignationForm');
  const resignationStatus = document.getElementById('resignationStatus');

  function closeResignationModal() {
    if (resignationModal) {
      resignationModal.classList.add('hidden');
      resignationModal.classList.remove('active');
    }
  }

  function openResignationModal() {
    if (resignationModal) {
      // Clear the form and status when opening
      if (resignationForm) resignationForm.reset();
      if (resignationStatus) resignationStatus.innerHTML = '';

      resignationModal.classList.remove('hidden');
      resignationModal.classList.add('active');
      // Load status when opening the modal
      loadResignationStatus();
    }
  }

  if (openResignationBtn) {
    openResignationBtn.addEventListener('click', function (e) {
      e.preventDefault();
      openResignationModal();
    });
  }

  if (closeResignationBtn) {
    closeResignationBtn.onclick = closeResignationModal;
  }

  // Resignation Request Form Logic (Employee Workflow - Kept same IDs)
  if (resignationForm) {
    resignationForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      resignationStatus.innerHTML = '<div class="resign-loader">Submitting...</div>';

      // Disable submit button to prevent double-submission
      const submitBtn = this.querySelector('.submit-btn');
      if (submitBtn) submitBtn.disabled = true;

      const formData = new FormData(resignationForm);
      const user = JSON.parse(localStorage.getItem('nxt_user'));
      if (!user || !user.empId) {
        resignationStatus.innerHTML = '<div class="resign-error">User not logged in.</div>';
        if (submitBtn) submitBtn.disabled = false;
        return;
      }
      formData.append('empId', user.empId);
      try {
        const res = await fetch(`${API_BASE}/api/resignations/submit`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('nxt_token')}` },
          body: formData
        });
        const data = await res.json();
        if (data.success) {
          resignationStatus.innerHTML = '<div class="resign-success">Resignation submitted! Status: Pending. Closing in 3 seconds...</div>';
          loadResignationStatus();

          // Automatically close the modal after a successful submission delay
          setTimeout(closeResignationModal, 3000);

        } else {
          resignationStatus.innerHTML = '<div class="resign-error">' + (data.message || 'Error submitting resignation') + '</div>';
        }
      } catch (err) {
        resignationStatus.innerHTML = '<div class="resign-error">Server error</div>';
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }
  async function loadResignationStatus() {
    if (!resignationStatus) return;
    resignationStatus.innerHTML = '<div class="resign-loader">Loading status...</div>';
    try {
      const res = await fetch('/api/resignations/my', {
        headers: { Authorization: `Bearer ${localStorage.getItem('nxt_token')}` }
      });
      const data = await res.json();
      if (!Array.isArray(data) || !data.length) {
        resignationStatus.innerHTML = '<div class="resign-empty">No resignation requests found.</div>';
        return;
      }
      resignationStatus.innerHTML = data.map(r => `
            <div class="resign-history-card ${r.status}">
              <div class="resign-row"><b>Status:</b> <span class="resign-status">${r.status.charAt(0).toUpperCase() + r.status.slice(1)}</span></div>
              <div class="resign-row"><b>Submitted:</b> ${new Date(r.submittedAt).toLocaleDateString()}</div>
              <div class="resign-row"><b>Last Day:</b> ${new Date(r.lastWorkingDay).toLocaleDateString()}</div>
              <div class="resign-row"><b>Reason:</b> ${r.reason}</div>
              ${r.attachmentUrl ? `<div class="resign-row"><b>Attachment:</b> <a href="${r.attachmentUrl}" target="_blank">View</a></div>` : ''}
              ${r.feedback ? `<div class="resign-row"><b>HR Feedback:</b> ${r.feedback}</div>` : ''}
            </div>
          `).join('');
    } catch (err) {
      resignationStatus.innerHTML = '<div class="resign-error">Error loading status</div>';
    }
  }
  // Actions section: handle Resignation Request and Logout options

  // Actions section navigation: show Actions section when clicked
  var actionsNavLink = document.querySelector('.sidebar .nav-list .nav-item a[href="#actions"]');
  if (actionsNavLink) {
    actionsNavLink.addEventListener('click', function (e) {
      e.preventDefault();
      document.querySelectorAll('.content-section').forEach(function (s) { s.classList.remove('active'); });
      var actionsSection = document.getElementById('actions');
      if (actionsSection) actionsSection.classList.add('active');
      var crumb = document.querySelector('.breadcrumb .current');
      if (crumb) crumb.innerText = 'Actions';
    });
  }

  // Resignation form submit is already handled above (see resignationForm event listener)

  var actionsLogoutLink = document.getElementById('actionsLogoutLink');
  if (actionsLogoutLink) {
    actionsLogoutLink.addEventListener('click', function (e) {
      e.preventDefault();
      var modal = document.getElementById('logoutModal');
      if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
      }
    });
  }
  // Modal logic
  const modal = document.getElementById('logoutModal');
  const confirmBtn = document.getElementById('confirmLogoutBtn');
  const cancelBtn = document.getElementById('cancelLogoutBtn');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
  if (modal && confirmBtn && cancelBtn) {
    confirmBtn.onclick = function () {
      localStorage.removeItem('nxt_token');
      localStorage.removeItem('nxt_user');
      window.location = './index.html';
    };
    cancelBtn.onclick = function () {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    };
  }

  // Find the logout link by its icon (fa-sign-out-alt) or by text
  document.querySelectorAll('.sidebar .nav-list .nav-item a').forEach(link => {
    const icon = link.querySelector('i');
    const text = link.textContent.trim().toLowerCase();
    if (
      (icon && icon.classList.contains('fa-sign-out-alt')) ||
      text === 'logout'
    ) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        if (modal) {
          modal.classList.remove('hidden');
          modal.style.display = 'flex';
        }
      });
    }
  });
});

/* ===== INITIAL LOAD ===== */
document.addEventListener('DOMContentLoaded', () => {
  // ensure dashboard is active on load
  const defaultSection = document.getElementById('dashboard');
  if (defaultSection && !defaultSection.classList.contains('active')) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    defaultSection.classList.add('active');
  }

  // load default dashboard content
  loadSectionContent('dashboard');

  // fill static profile name and empId in sidebar if elements exist
  try {
    const stored = localStorage.getItem('nxt_user');
    if (stored) {
      const user = JSON.parse(stored);
      const nameEl = document.querySelector('.profile-name');
      const roleEl = document.querySelector('.profile-role');
      if (nameEl) nameEl.innerText = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.empId;
      if (roleEl) roleEl.innerText = (user.role || 'Employee');
    }
  } catch (e) {
    console.warn('Failed to set sidebar profile text', e);
  }

  // Initialize dashboard widgets if on dashboard
  if (defaultSection && defaultSection.classList.contains('active')) {
    initDashboardWidgets();
    fetchAndSetClockStatus();
    initClockButton();
  }

  // ===== HEADER ACTIONS: BELL (NOTIFICATIONS) & ENVELOPE (MESSAGES) =====
  function showModal(title, items) {
    let modal = document.getElementById('headerActionModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'headerActionModal';
      modal.style.position = 'fixed';
      modal.style.top = '70px';
      modal.style.right = '40px';
      modal.style.background = '#fff';
      modal.style.borderRadius = '12px';
      modal.style.boxShadow = '0 4px 24px rgba(44,55,150,0.13)';
      modal.style.zIndex = '9999';
      modal.style.minWidth = '320px';
      modal.style.maxWidth = '95vw';
      modal.style.padding = '1.2rem 1.5rem';
      modal.style.display = 'block';
      document.body.appendChild(modal);
    }
    modal.innerHTML = `<div style='display:flex;align-items:center;justify-content:space-between;'><h3 style='margin:0;font-size:1.2rem;'>${title}</h3><button id='closeHeaderActionModal' style='background:none;border:none;font-size:1.3rem;cursor:pointer;'>&times;</button></div><ul style='margin:1rem 0 0 0;padding:0;list-style:none;'>${items.map(i => `<li style='padding:0.5rem 0;border-bottom:1px solid #eee;'>${i}</li>`).join('')}</ul>`;
    document.getElementById('closeHeaderActionModal').onclick = () => { modal.style.display = 'none'; };
    modal.style.display = 'block';
  }
  const bellBtn = document.querySelector('.header-actions .action-btn i.fa-bell')?.parentElement;
  const msgBtn = document.querySelector('.header-actions .action-btn i.fa-envelope')?.parentElement;
  if (bellBtn) {
    bellBtn.addEventListener('click', () => {
      // Example notifications
      showModal('Notifications', [
        'Your leave request was approved.',
        'Attendance marked for today.',
        'Company meeting at 4 PM.'
      ]);
    });
  }
  if (msgBtn) {
    msgBtn.addEventListener('click', () => {
      // Example messages
      showModal('Messages', [
        '<b>HR:</b> Don’t forget to submit your timesheet.',
        '<b>Manager:</b> Please check your project updates.',
        '<b>Admin:</b> Welcome to the new portal!'
      ]);
    });
  }
  // ===== SEARCH BAR INTERACTION =====
  const searchInput = document.querySelector('.search-box input[type="text"]');
  let searchDropdown = document.createElement('div');
  searchDropdown.className = 'search-results-dropdown';
  document.querySelector('.search-box').appendChild(searchDropdown);

  // Example search data (replace with real API if needed)
  const searchData = [
    { label: 'My Profile', action: () => loadSectionContent('profile') },
    { label: 'Leave Requests', action: () => loadSectionContent('leave') },
    { label: 'Attendance Dashboard', action: () => loadSectionContent('dashboard') },
    { label: 'Reports', action: () => loadSectionContent('reports') }
  ];

  searchInput.addEventListener('input', function () {
    const val = this.value.trim().toLowerCase();
    if (!val) {
      searchDropdown.classList.remove('active');
      searchDropdown.innerHTML = '';
      return;
    }
    const results = searchData.filter(item => item.label.toLowerCase().includes(val));
    if (!results.length) {
      searchDropdown.innerHTML = '<div class="search-result-item">No results found</div>';
      searchDropdown.classList.add('active');
      return;
    }
    searchDropdown.innerHTML = results.map(item => `<div class="search-result-item">${item.label}</div>`).join('');
    searchDropdown.classList.add('active');
    // Attach click handlers
    Array.from(searchDropdown.children).forEach((el, idx) => {
      el.onclick = () => {
        results[idx].action();
        searchDropdown.classList.remove('active');
        searchInput.value = '';
      };
    });
  });
  // Hide dropdown on blur
  searchInput.addEventListener('blur', function () {
    setTimeout(() => searchDropdown.classList.remove('active'), 150);
  });
});
// --- Quick Actions: Real-Time Clock and Clock In/Out ---
function updateRealTimeClock() {
  const clock = document.getElementById('realTimeClock');
  if (clock) {
    const now = new Date();
    clock.textContent = now.toLocaleTimeString();
  }
}
setInterval(updateRealTimeClock, 1000);
updateRealTimeClock();

// Clock In/Out Button Logic
const clockInOutBtn = document.getElementById('clockInOutBtn');
const clockInOutText = document.getElementById('clockInOutText');
if (clockInOutBtn && clockInOutText) {
  // Fetch current status on load
  fetchWithAuth('/api/attendance/status', { credentials: 'include' })
    .then(res => res.json())
    .then(data => {
      if (data && data.status === 'in') {
        clockInOutText.textContent = 'Clock Out';
      } else {
        clockInOutText.textContent = 'Clock In';
      }
    });

  clockInOutBtn.addEventListener('click', () => {
    // Use correct backend endpoint names
    const user = JSON.parse(localStorage.getItem('nxt_user'));
    if (!user || !user.empId) {
      alert('User not found');
      return;
    }
    const action = clockInOutText.textContent === 'Clock In' ? 'checkin' : 'checkout';
    fetchWithAuth(`/api/attendance/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ empId: user.empId }),
      credentials: 'include'
    })
      .then(res => res.json())
      .then(data => {
        if (data.success || data._id) {
          clockInOutText.textContent = action === 'checkin' ? 'Clock Out' : 'Clock In';
          // Optionally refresh widgets or show a toast
        } else {
          alert(data.message || 'Operation failed.');
        }
      })
      .catch(() => alert('Network error.'));
  });
}

// Quick Action Option Buttons
const viewAttendanceBtn = document.getElementById('viewAttendanceBtn');
if (viewAttendanceBtn) {
  viewAttendanceBtn.addEventListener('click', () => {
    // Navigate to attendance section
    if (typeof showSection === 'function') showSection('attendance');
  });
}
const requestLeaveBtn = document.getElementById('requestLeaveBtn');
if (requestLeaveBtn) {
  requestLeaveBtn.addEventListener('click', () => {
    if (typeof showSection === 'function') showSection('leaves');
  });
}
const helpDeskBtn = document.getElementById('helpDeskBtn');
if (helpDeskBtn) {
  helpDeskBtn.addEventListener('click', () => {
    alert('Contact HR or support@example.com for help.');
  });
}

// Fetch real clock status from backend and update UI
async function fetchAndSetClockStatus() {
  const user = JSON.parse(localStorage.getItem('nxt_user'));
  const statusEl = document.getElementById('clockStatus');
  const btn = document.getElementById('clockButton');
  const lastAction = document.getElementById('lastActionTime');
  if (!user) {
    if (statusEl) statusEl.textContent = 'User not found';
    if (btn) {
      btn.className = 'clock-btn clock-in';
      btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Clock In';
      btn.disabled = true;
    }
    if (lastAction) lastAction.textContent = 'Last action: None recorded.';
    return;
  }
  try {
    const res = await fetchWithAuth(`${API_BASE}/api/attendance/status/${user.empId}`, {
      headers: { 'Content-Type': 'application/json' }
    });
    let data = {};
    try { data = await res.json(); } catch (e) { data = {}; }
    if (!res.ok || typeof data.clockedIn === 'undefined') throw new Error(data.message || 'Failed to fetch status');
    if (statusEl && btn) {
      if (data.clockedIn) {
        statusEl.textContent = 'You are currently Clocked In';
        btn.className = 'clock-btn clock-out';
        btn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Clock Out';
        btn.disabled = false;
      } else {
        statusEl.textContent = 'You are currently Clocked Out';
        btn.className = 'clock-btn clock-in';
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Clock In';
        btn.disabled = false;
      }
      if (lastAction) {
        if (data.lastActionTime) {
          lastAction.textContent = `Last action: ${new Date(data.lastActionTime).toLocaleString()}`;
        } else {
          lastAction.textContent = 'Last action: None recorded.';
        }
      }
    }
  } catch (err) {
    if (statusEl) statusEl.textContent = 'Unable to fetch status';
    if (btn) {
      btn.className = 'clock-btn clock-in';
      btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Clock In';
      btn.disabled = true;
    }
    if (lastAction) lastAction.textContent = 'Last action: None recorded.';
    // Optionally show error to user
    alert('Error fetching attendance status. Please try again.');
    console.error('fetchAndSetClockStatus error:', err);
  }
}
// ===== CLOCK IN/OUT BUTTON LOGIC ON DASHBOARD =====
function initClockButton() {
  const btn = document.getElementById('clockButton');
  if (!btn) return;
  btn.addEventListener('click', async function () {
    // Always fetch backend status to determine action
    const user = JSON.parse(localStorage.getItem('nxt_user'));
    if (!user) {
      alert('User not found');
      return;
    }
    let isClockedIn = false;
    try {
      const statusRes = await fetchWithAuth(`${API_BASE}/api/attendance/status/${user.empId}`, {
        headers: { 'Content-Type': 'application/json' }
      });
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        isClockedIn = !!statusData.clockedIn;
      }
    } catch (e) {
      isClockedIn = false;
    }
    if (isClockedIn) {
      // Normal clock out (keep as is for now)
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
      try {
        const url = `${API_BASE}/api/attendance/checkout`;
        const res = await fetchWithAuth(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ empId: user.empId })
        });
        let data = {};
        try { data = await res.json(); } catch (e) { data = {}; }
        if (!res.ok) {
          showAttendanceStatusMessage((data && data.message) ? data.message : 'Check-out failed', 'error');
        } else {
          showAttendanceStatusMessage('Checked out successfully.', 'success');
        }
      } catch (err) {
        showAttendanceStatusMessage('Server error: ' + (err && err.message ? err.message : err), 'error');
      } finally {
        btn.disabled = false;
        await fetchAndSetClockStatus();
      }
      return;
    }
    // If clocking in, open selfie modal for capture/upload
    showSelfieModal(async (imageBlob, meta) => {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
      try {
        // Prepare FormData
        const formData = new FormData();
        formData.append('employeeId', user.empId);
        const now = new Date();
        formData.append('date', now.toISOString().slice(0, 10));
        formData.append('checkInTime', now.toTimeString().slice(0, 8));
        formData.append('image', imageBlob, 'selfie.jpg');
        formData.append('metaData', JSON.stringify(meta));
        const res = await fetchWithAuth(`${API_BASE}/api/attendance/clock-in`, {
          method: 'POST',
          headers: { ...authHeaders() },
          body: formData
        });
        let data = {};
        try { data = await res.json(); } catch (e) { data = {}; }
        if (!res.ok) {
          showAttendanceStatusMessage((data && data.message) ? data.message : 'Clock-in failed', 'error');
        } else {
          let msg = 'Clocked in successfully.';
          let type = 'success';
          if (data.status === 'present') {
            msg = 'Present: You have clocked in on time.';
            type = 'success';
          } else if (data.status === 'late') {
            msg = 'Late login: You have clocked in late.';
            type = 'warning';
          } else if (data.status === 'out_of_office') {
            msg = 'Out of office: Location not matched.';
            type = 'error';
          } else if (data.message) {
            msg = data.message;
            type = 'info';
          }
          showAttendanceStatusMessage(msg, type);
        }
      } catch (err) {
        showAttendanceStatusMessage('Server error: ' + (err && err.message ? err.message : err), 'error');
      } finally {
        btn.disabled = false;
        await fetchAndSetClockStatus();
      }
    });
  });
}

// --- Attendance Status Message Logic ---
function showAttendanceStatusMessage(message, type = 'info') {
  // Remove any existing message
  let old = document.getElementById('attendanceStatusMessage');
  if (old) old.remove();
  const msgDiv = document.createElement('div');
  msgDiv.id = 'attendanceStatusMessage';
  msgDiv.className = `attendance-status-message ${type}`;
  msgDiv.innerHTML = `<span>${message}</span>`;
  // Place in dashboard section if available, else body
  const dashboard = document.getElementById('dashboard');
  if (dashboard) {
    dashboard.prepend(msgDiv);
  } else {
    document.body.appendChild(msgDiv);
  }
  // Auto-hide after 4 seconds
  setTimeout(() => {
    msgDiv.classList.add('hide');
    setTimeout(() => msgDiv.remove(), 700);
  }, 4000);
}

// --- Selfie Modal Logic ---
function showSelfieModal(onConfirm) {
  const modal = document.getElementById('selfieModal');
  const video = document.getElementById('selfieVideo');
  const canvas = document.getElementById('selfieCanvas');
  const preview = document.getElementById('selfiePreview');
  const fileInput = document.getElementById('selfieFileInput');
  const startCameraBtn = document.getElementById('startCameraBtn');
  const uploadPhotoBtn = document.getElementById('uploadPhotoBtn');
  const captureBtns = document.getElementById('selfieCaptureBtns');
  const confirmBtns = document.getElementById('selfieConfirmBtns');
  const captureBtn = document.getElementById('captureSelfieBtn');
  const cancelCameraBtn = document.getElementById('cancelCameraBtn');
  const confirmSelfieBtn = document.getElementById('confirmSelfieBtn');
  const retakeSelfieBtn = document.getElementById('retakeSelfieBtn');
  const closeBtn = document.getElementById('closeSelfieModalBtn');
  let stream = null;
  let imageBlob = null;
  let meta = {};
  function resetModal() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    video.style.display = 'none';
    canvas.style.display = 'none';
    preview.style.display = 'none';
    fileInput.value = '';
    imageBlob = null;
    meta = {};
    captureBtns.style.display = 'none';
    confirmBtns.style.display = 'none';
    startCameraBtn.style.display = '';
    uploadPhotoBtn.style.display = '';
  }
  function openModal() {
    modal.classList.add('active');
    resetModal();
  }
  function closeModal() {
    modal.classList.remove('active');
    resetModal();
  }
  startCameraBtn.onclick = async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream;
      video.style.display = '';
      captureBtns.style.display = '';
      startCameraBtn.style.display = 'none';
      uploadPhotoBtn.style.display = 'none';
    } catch (e) {
      alert('Unable to access camera.');
    }
  };
  uploadPhotoBtn.onclick = () => {
    fileInput.click();
  };
  fileInput.onchange = () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      preview.src = e.target.result;
      preview.style.display = '';
      imageBlob = file;
      collectSelfieMeta(file, function (metaResult) {
        meta = metaResult;
        confirmBtns.style.display = '';
        startCameraBtn.style.display = 'none';
        uploadPhotoBtn.style.display = 'none';
      });
    };
    reader.readAsDataURL(file);
  };
  captureBtn.onclick = () => {
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      imageBlob = blob;
      preview.src = canvas.toDataURL('image/jpeg');
      preview.style.display = '';
      video.style.display = 'none';
      canvas.style.display = 'none';
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
      }
      collectSelfieMeta(blob, function (metaResult) {
        meta = metaResult;
        confirmBtns.style.display = '';
        captureBtns.style.display = 'none';
      });
    }, 'image/jpeg', 0.95);
  };
  cancelCameraBtn.onclick = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    video.style.display = 'none';
    captureBtns.style.display = 'none';
    startCameraBtn.style.display = '';
    uploadPhotoBtn.style.display = '';
  };
  confirmSelfieBtn.onclick = async () => {
    // Validation: require photo
    if (!imageBlob) {
      alert('You must take or upload a photo to clock in.');
      return;
    }
    // Validation: check timestamp (within 5 minutes of now)
    const now = Date.now();
    let metaTime = null;
    if (meta.capturedAt) {
      metaTime = new Date(meta.capturedAt).getTime();
    } else if (meta.timestamp) {
      metaTime = new Date(meta.timestamp).getTime();
    }
    // if (metaTime && Math.abs(now - metaTime) > 24 * 60 * 60 * 1000) {
    //   alert('Photo capture time is too far from current time. Please use a recent photo (within 24 hours).');
    //   return;
    // }
    // Validation: require GPS if mandatory (set to true to enforce)
    const requireGPS = false; // set to true if GPS is mandatory
    if (requireGPS && !(meta.gps || meta.geo)) {
      alert('GPS location is required. Please enable location and try again.');
      return;
    }
    // Optionally get geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          meta.geo = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          closeModal();
          onConfirm(imageBlob, meta);
        },
        () => {
          closeModal();
          onConfirm(imageBlob, meta);
        },
        { timeout: 3000 }
      );
    } else {
      closeModal();
      onConfirm(imageBlob, meta);
    }
  };
  retakeSelfieBtn.onclick = () => {
    resetModal();
  };
  closeBtn.onclick = () => {
    closeModal();
  };
  openModal();
}


function collectSelfieMeta(fileOrBlob, callback) {
  // Use EXIF.js to extract metadata
  const meta = {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    fileType: fileOrBlob.type,
    fileSize: fileOrBlob.size,
    imageHash: '', // Optionally implement hash
    exif: {},
    gps: null,
    deviceModel: '',
    resolution: '',
    capturedAt: '',
  };

  if (fileOrBlob && window.EXIF) {
    try {
      // EXIF.getData supports standard File/Blob objects directly
      EXIF.getData(fileOrBlob, function () {
        try {
          // 'this' refers to the file object with extracted metadata
          const tags = EXIF.getAllTags(this);
          if (tags) {
            meta.exif = tags;
            if (tags.DateTimeOriginal) meta.capturedAt = tags.DateTimeOriginal;
            if (tags.Model) meta.deviceModel = tags.Model;

            if (tags.GPSLatitude && tags.GPSLongitude) {
              // Convert GPS to decimal
              function dmsToDecimal(dms, ref) {
                if (!dms) return 0;
                let d = dms[0] || 0, m = dms[1] || 0, s = dms[2] || 0;
                let dec = d + m / 60 + s / 3600;
                if (ref === 'S' || ref === 'W') dec = -dec;
                return dec;
              }
              meta.gps = {
                lat: dmsToDecimal(tags.GPSLatitude, tags.GPSLatitudeRef),
                lon: dmsToDecimal(tags.GPSLongitude, tags.GPSLongitudeRef)
              };
            }
            if (tags.PixelXDimension && tags.PixelYDimension) {
              meta.resolution = `${tags.PixelXDimension}x${tags.PixelYDimension}`;
            }
          }
        } catch (e) {
          console.warn('Error parsing EXIF tags', e);
        }
        callback(meta);
      });
    } catch (err) {
      console.warn('EXIF.getData failed', err);
      callback(meta);
    }
  } else {
    callback(meta);
  }
}


// ===== DASHBOARD WIDGETS: Clock, Week Range, Calendar =====
function initDashboardWidgets() {
  // Live 12hr clock
  function updateClock() {
    const now = new Date();
    let h = now.getHours();
    const m = now.getMinutes();
    const s = now.getSeconds();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12;
    const pad = n => n.toString().padStart(2, '0');
    const timeStr = `${pad(h)}:${pad(m)}:${pad(s)} ${ampm}`;
    const el = document.getElementById('currentTime');
    if (el) el.textContent = timeStr;
  }
  updateClock();
  setInterval(updateClock, 1000);

  // Week range (Sun-Sat)
  function getWeekRange(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diffToSun = d.getDate() - day;
    const diffToSat = d.getDate() + (6 - day);
    const sunday = new Date(d.setDate(diffToSun));
    const saturday = new Date(d.setDate(diffToSat - (d.getDate() - diffToSun)));
    const opts = { month: 'short', day: 'numeric' };
    return `${sunday.toLocaleDateString(undefined, opts)} - ${saturday.toLocaleDateString(undefined, opts)}, ${saturday.getFullYear()}`;
  }
  const weekEl = document.getElementById('currentWeek');
  if (weekEl) weekEl.textContent = getWeekRange(new Date());

  // Calendar display: show today in a readable format, update in real time
  function updateCalendarDisplay() {
    const calEl = document.getElementById('calendarDisplay');
    if (calEl) {
      const today = new Date();
      const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      calEl.textContent = today.toLocaleDateString(undefined, opts);
    }
  }
  updateCalendarDisplay();
  setInterval(updateCalendarDisplay, 1000 * 60); // update every minute
}

/* ===== SECTION DISPATCHER ===== */
function loadSectionContent(sectionId) {
  switch (sectionId) {
    case 'dashboard':
      loadDashboard();
      break;
    case 'profile':
      loadProfile();
      break;
    case 'leave':
      loadLeave();
      break;
    case 'reports':
      loadReports();
      break;
    case 'quick-actions':
      loadQuickActions();
      break;
    case 'settings':
      loadSettings();
      break;
    default:
      // do nothing
      break;
  }
}

/* ===== DASHBOARD: load summary counts ===== */
async function loadDashboard() {
  try {
    const res = await fetch(`${API_BASE}/api/attendance/summary/today`, {
      headers: { 'Content-Type': 'application/json', ...authHeaders() }
    });
    if (!res.ok) return;
    const json = await res.json();
    // update elements if present
    const presentEl = document.getElementById('presentCount');
    const absentEl = document.getElementById('absentCount');
    const leaveEl = document.getElementById('leaveCount');
    if (presentEl) presentEl.innerText = json.present ?? 0;
    if (absentEl) absentEl.innerText = json.absent ?? 0;
    if (leaveEl) leaveEl.innerText = json.onLeave ?? 0;
  } catch (err) {
    console.error('Dashboard load error', err);
  }

  // Chart button logic for attendance and on-time rate
  function setActiveChartBtn(group, period) {
    document.querySelectorAll(group + ' .chart-btn').forEach(btn => {
      if (btn.dataset.period === period) btn.classList.add('active');
      else btn.classList.remove('active');
    });
  }

  // Update attendance gauge (placeholder logic)
  async function updateAttendanceGauge(period) {
    let present = 0, total = 1;
    if (period === 'today') {
      present = Number(document.getElementById('presentCount')?.innerText || 0);
      total = present + Number(document.getElementById('absentCount')?.innerText || 0) + Number(document.getElementById('leaveCount')?.innerText || 0);
    } else {
      // Placeholder: fetch or simulate week/month data
      // TODO: Replace with real API endpoints if available
      present = Math.floor(Math.random() * 10) + 10;
      total = present + Math.floor(Math.random() * 5) + 5;
    }
    const percent = total > 0 ? Math.round((present / total) * 100) : 0;
    document.getElementById('gaugePercentage').innerText = percent + '%';
    // Optionally update the canvas gauge here
  }

  // Update on-time gauge (placeholder logic)
  async function updateOnTimeGauge(period) {
    let onTime = 0, total = 1;
    if (period === 'today') {
      onTime = Math.floor(Math.random() * 10) + 5;
      total = onTime + Math.floor(Math.random() * 5) + 5;
    } else {
      // Placeholder: fetch or simulate week/month data
      onTime = Math.floor(Math.random() * 10) + 10;
      total = onTime + Math.floor(Math.random() * 5) + 5;
    }
    const percent = total > 0 ? Math.round((onTime / total) * 100) : 0;
    document.getElementById('ontimePercentage').innerText = percent + '%';
    // Optionally update the canvas gauge here
  }

  // Attach event listeners for attendance rate chart buttons
  document.querySelectorAll('.chart-card .chart-btn').forEach(btn => {
    btn.addEventListener('click', async function () {
      const group = this.closest('.chart-card');
      const header = group.querySelector('.chart-header h3').innerText.toLowerCase();
      const period = this.dataset.period;
      setActiveChartBtn('.chart-card[data-type="' + header + '"]', period);
      if (header.includes('attendance')) {
        await updateAttendanceGauge(period);
      } else if (header.includes('on-time')) {
        await updateOnTimeGauge(period);
      }
    });
  });

  // Initial load for both gauges
  await updateAttendanceGauge('today');
  await updateOnTimeGauge('today');
}

/* ===== PROFILE ===== */
async function loadProfile() {
  const sec = document.getElementById('profile');
  if (!sec) return;
  sec.innerHTML = `<div class="dashboard-content"><h2>Loading profile…</h2></div>`;
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, { headers: { 'Content-Type': 'application/json', ...authHeaders() } });
    if (!res.ok) {
      sec.innerHTML = `<div class="dashboard-content"><h2>Unable to load profile</h2></div>`;
      return;
    }
    const u = await res.json();
    sec.innerHTML = `
      <div class="dashboard-content">
        <h1 class="profile-title">My Profile</h1>
        <div class="profile-card">
          <div class="profile-avatar"><i class="fas fa-user-circle"></i></div>
          <div class="profile-details">
            <div class="profile-row"><span class="profile-label">Name:</span> <span class="profile-value">${u.firstName ?? ''} ${u.lastName ?? ''}</span></div>
            <div class="profile-row"><span class="profile-label">Employee ID:</span> <span class="profile-value">${u.empId}</span></div>
            <div class="profile-row"><span class="profile-label">Email:</span> <span class="profile-value">${u.email ?? '—'}</span></div>
            <div class="profile-row"><span class="profile-label">Mobile:</span> <span class="profile-value">${u.phone ?? '—'}</span></div>
            <div class="profile-row"><span class="profile-label">Department:</span> <span class="profile-value">${u.department ? (u.department.name || '—') : '—'}</span></div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    console.error('Profile error', err);
    sec.innerHTML = `<div class="dashboard-content"><h2>Error loading profile</h2></div>`;
  }
}

/* ===== LEAVE REQUEST ===== */
function loadLeave() {
  const sec = document.getElementById('leave');
  if (!sec) return;

  sec.innerHTML = `
    <div class="dashboard-content">
      <h1 style="margin-bottom:1.5rem;"><i class='fas fa-calendar-plus' style='color:var(--primary-color);margin-right:0.5rem;'></i>Leave Request</h1>
      <div class="leave-card">
        <div class="leave-field"><label for="leaveStart"><i class="fas fa-play"></i>Start Date</label><input type="date" id="leaveStart"></div>
        <div class="leave-field"><label for="leaveEnd"><i class="fas fa-flag-checkered"></i>End Date</label><input type="date" id="leaveEnd"></div>
        <div class="leave-field"><label for="leaveDepartment"><i class="fas fa-building"></i>Department</label><input type="text" id="leaveDepartment" name="department" placeholder="Enter your department"></div>
        <div class="leave-field"><label for="leaveReason"><i class="fas fa-align-left"></i>Reason</label><textarea id="leaveReason" rows="3"></textarea></div>
        <button id="leaveSubmit" class="submit-btn"><i class="fas fa-paper-plane"></i> Submit Leave</button>
      </div>
      <div style="margin-top:2.5rem;">
        <h2 style="margin-bottom:1rem;color:var(--primary-color);display:flex;align-items:center;gap:0.5rem;"><i class="fas fa-history"></i> Leave History</h2>
        <div id="myLeaves" class="leave-list"></div>
      </div>
    </div>
  `;

  document.getElementById('leaveSubmit').addEventListener('click', submitLeaveRequest);

  // also load user's leave requests (if backend has any)
  loadMyLeaves();
}

async function submitLeaveRequest() {
  const stored = localStorage.getItem('nxt_user');
  if (!stored) return alert('User not found');
  const user = JSON.parse(stored);

  const start = document.getElementById('leaveStart').value;
  const end = document.getElementById('leaveEnd').value;
  const reason = document.getElementById('leaveReason').value;

  if (!start || !end) return alert('Please select start and end date');

  try {
    const res = await fetch(`${API_BASE}/api/leaves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ empId: user.empId, startDate: start, endDate: end, reason })
    });
    const data = await res.json();
    if (!res.ok) return alert(data.message || 'Failed');

    // Show animated confirmation in page center
    showLeaveConfirmation();
    loadMyLeaves();
  } catch (err) {
    console.error('Submit leave error', err);
    alert('Server error');
  }
}

function showLeaveConfirmation() {
  // Remove any existing confirmation
  const old = document.getElementById('leaveConfirmationModal');
  if (old) old.remove();
  const modal = document.createElement('div');
  modal.id = 'leaveConfirmationModal';
  modal.className = 'leave-confirmation-modal';
  modal.innerHTML = `
    <div class="leave-confirmation-content">
      <div class="leave-illus">
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none"><circle cx="60" cy="60" r="56" fill="#e0f7fa"/><path d="M40 65l15 15 25-35" stroke="#10b981" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="60" cy="60" r="56" stroke="#10b981" stroke-width="4" stroke-dasharray="8 8"/></svg>
      </div>
      <div class="leave-confirmation-text">Leave request submitted!</div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => {
    modal.classList.add('hide');
    setTimeout(() => modal.remove(), 700);
  }, 1800);
}

async function loadMyLeaves() {
  // no dedicated endpoint in default backend; if you added one use it.
  const container = document.getElementById('myLeaves');
  if (!container) return;
  container.innerHTML = `<div style="text-align:center;color:var(--primary-color);"><i class="fas fa-spinner fa-spin"></i> Loading your leave requests...</div>`;
  try {
    const res = await fetch(`${API_BASE}/api/leaves/my`, { headers: { 'Content-Type': 'application/json', ...authHeaders() } });
    if (!res.ok) {
      container.innerHTML = `<div style="text-align:center;color:var(--primary-color);margin-top:1.5rem;"><i class="fas fa-info-circle"></i> No leave history available.</div>`;
      return;
    }
    const mine = await res.json();
    if (!mine.length) {
      container.innerHTML = `<div style="text-align:center;color:var(--primary-color);margin-top:1.5rem;"><i class="fas fa-info-circle"></i> No leave requests found.</div>`;
      return;
    }
    container.innerHTML = '<h3 style="margin-bottom:1rem;"><i class="fas fa-list"></i> My Leave Requests</h3>';
    mine.forEach(l => {
      const d = document.createElement('div');
      d.className = 'leave-request-card';
      d.innerHTML = `
        <span class="leave-request-icon"><i class="fas fa-calendar-alt"></i></span>
        <div class="leave-request-info">
          <div class="leave-request-dates">${l.startDate.substring(0, 10)} → ${l.endDate.substring(0, 10)}</div>
          <div>${l.reason || ''}</div>
        </div>
        <span class="leave-request-status">${l.status}</span>
      `;
      container.appendChild(d);
    });
  } catch (err) {
    console.error('Load my leaves', err);
    container.innerHTML = `<div style="text-align:center;color:var(--danger-color);margin-top:1.5rem;"><i class="fas fa-exclamation-triangle"></i> Error loading leave history.</div>`;
  }
}

/* ===== REPORTS (placeholder) ===== */
function loadReports() {
  const sec = document.getElementById('reports');
  if (!sec) return;
  sec.innerHTML = `
    <div class="dashboard-content">
      <h1 style="margin-bottom:1.5rem;">Reports</h1>
      <div class="report-section">
        <h2 class="report-section-title"><i class="fas fa-calendar-check"></i> Leave Requests Status</h2>
        <div id="leaveReports" class="report-leave-list"></div>
      </div>
      <div class="report-section">
        <h2 class="report-section-title"><i class="fas fa-tasks"></i> Admin Task Requests</h2>
        <div id="adminTasks" class="report-admin-task-list"></div>
      </div>
      <div class="report-section">
        <h2 class="report-section-title"><i class="fas fa-cogs"></i> Other Operations</h2>
        <div id="otherOps" class="report-other-ops-list"></div>
      </div>
    </div>
  `;
  loadLeaveReports();
  loadAdminMessages();
  loadAdminTasks();
  loadOtherOps();
}

// Fetch and display admin messages for the employee
async function loadAdminMessages() {
  const container = document.getElementById('adminMessages');
  if (!container) return;
  container.innerHTML = `<div style="text-align:center;color:var(--primary-color);"><i class="fas fa-spinner fa-spin"></i> Loading messages...</div>`;
  try {
    const user = JSON.parse(localStorage.getItem('nxt_user'));
    if (!user || !user.empId) {
      container.innerHTML = `<div class="report-empty">User not found.</div>`;
      return;
    }
    const res = await fetch(`${API_BASE}/api/messages/${user.empId}`, { headers: { 'Content-Type': 'application/json', ...authHeaders() } });
    if (!res.ok) {
      container.innerHTML = `<div class="report-empty">No messages found.</div>`;
      return;
    }
    const messages = await res.json();
    if (!messages.length) {
      container.innerHTML = `<div class="report-empty">No messages found.</div>`;
      return;
    }
    container.innerHTML = messages.map(m => `
      <div class="report-admin-message-card ${m.type}">
        <div class="admin-message-content">${m.message}</div>
        <div class="admin-message-date">${new Date(m.createdAt).toLocaleString()}</div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<div class="report-empty">Error loading messages.</div>`;
  }
}

// Dummy admin tasks loader (replace with real API if available)
function loadAdminTasks() {
  const container = document.getElementById('adminTasks');
  if (!container) return;
  // Example data
  const tasks = [
    { title: 'Profile Update Approval', status: 'pending', date: '2025-11-20' },
    { title: 'Document Submission', status: 'approved', date: '2025-11-15' }
  ];
  if (!tasks.length) {
    container.innerHTML = '<div class="report-empty">No admin tasks found.</div>';
    return;
  }
  container.innerHTML = tasks.map(t => `
    <div class="report-admin-task-card ${t.status}">
      <div class="task-title">${t.title}</div>
      <div class="task-date">${t.date}</div>
      <span class="task-status ${t.status}">${t.status.charAt(0).toUpperCase() + t.status.slice(1)}</span>
    </div>
  `).join('');
}

// Dummy other operations loader (replace with real API if available)
function loadOtherOps() {
  const container = document.getElementById('otherOps');
  if (!container) return;
  // Example data
  const ops = [
    { desc: 'Password changed', date: '2025-11-10' },
    { desc: 'Logged in from new device', date: '2025-11-08' }
  ];
  if (!ops.length) {
    container.innerHTML = '<div class="report-empty">No other operations found.</div>';
    return;
  }
  container.innerHTML = ops.map(o => `
    <div class="report-other-op-card">
      <div class="op-desc">${o.desc}</div>
      <div class="op-date">${o.date}</div>
    </div>
  `).join('');
}

async function loadLeaveReports() {
  const container = document.getElementById('leaveReports');
  if (!container) return;
  container.innerHTML = `<div style="text-align:center;color:var(--primary-color);"><i class="fas fa-spinner fa-spin"></i> Loading leave reports...</div>`;
  try {
    const res = await fetch(`${API_BASE}/api/leaves/my`, { headers: { 'Content-Type': 'application/json', ...authHeaders() } });
    if (!res.ok) {
      container.innerHTML = `<div style="text-align:center;color:var(--primary-color);margin-top:1.5rem;"><i class="fas fa-info-circle"></i> No leave report data available.</div>`;
      return;
    }
    const mine = await res.json();
    if (!mine.length) {
      container.innerHTML = `<div style="text-align:center;color:var(--primary-color);margin-top:1.5rem;"><i class="fas fa-info-circle"></i> No leave history found.</div>`;
      return;
    }
    // Group by status
    const statusGroups = {
      pending: [],
      approved: [],
      rejected: []
    };
    mine.forEach(l => {
      if (l.status === 'approved') statusGroups.approved.push(l);
      else if (l.status === 'rejected') statusGroups.rejected.push(l);
      else statusGroups.pending.push(l);
    });
    let html = '';
    html += `<div class="report-group"><h3><i class="fas fa-hourglass-half"></i> Pending Requests</h3>`;
    if (statusGroups.pending.length) {
      statusGroups.pending.forEach(l => {
        html += reportLeaveCard(l, 'pending');
      });
    } else {
      html += `<div class="report-empty"><i class="fas fa-info-circle"></i> No pending requests.</div>`;
    }
    html += `</div>`;
    html += `<div class="report-group"><h3><i class="fas fa-check-circle"></i> Approved Leaves</h3>`;
    if (statusGroups.approved.length) {
      statusGroups.approved.forEach(l => {
        html += reportLeaveCard(l, 'approved');
      });
    } else {
      html += `<div class="report-empty"><i class="fas fa-info-circle"></i> No approved leaves.</div>`;
    }
    html += `</div>`;
    html += `<div class="report-group"><h3><i class="fas fa-times-circle"></i> Rejected Leaves</h3>`;
    if (statusGroups.rejected.length) {
      statusGroups.rejected.forEach(l => {
        html += reportLeaveCard(l, 'rejected');
      });
    } else {
      html += `<div class="report-empty"><i class="fas fa-info-circle"></i> No rejected leaves.</div>`;
    }
    html += `</div>`;
    container.innerHTML = html;
  } catch (err) {
    console.error('Load leave reports', err);
    container.innerHTML = `<div style="text-align:center;color:var(--danger-color);margin-top:1.5rem;"><i class="fas fa-exclamation-triangle"></i> Error loading leave reports.</div>`;
  }
}

function reportLeaveCard(l, status) {
  let icon = 'fa-hourglass-half', badge = 'pending';
  if (status === 'approved') { icon = 'fa-check-circle'; badge = 'approved'; }
  if (status === 'rejected') { icon = 'fa-times-circle'; badge = 'rejected'; }
  return `
    <div class="report-leave-card">
      <span class="report-leave-icon"><i class="fas ${icon}"></i></span>
      <div class="report-leave-info">
        <div class="report-leave-dates">${l.startDate.substring(0, 10)} → ${l.endDate.substring(0, 10)}</div>
        <div class="report-leave-reason">${l.reason || ''}</div>
      </div>
      <span class="report-leave-badge ${badge}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
    </div>
  `;
}

/* ===== QUICK ACTIONS ===== */
function loadQuickActions() {
  const sec = document.getElementById('quick-actions');
  if (!sec) return;
  sec.innerHTML = `
    <div class="dashboard-content">
      <h1>Quick Actions</h1>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <button class="submit-btn" id="btnCheckIn">Clock In</button>
        <button class="submit-btn" id="btnCheckOut">Clock Out</button>
      </div>
    </div>
  `;
  document.getElementById('btnCheckIn').addEventListener('click', doCheckIn);
  document.getElementById('btnCheckOut').addEventListener('click', doCheckOut);
}

/* ===== SETTINGS (placeholder) ===== */
function loadSettings() {
  const sec = document.getElementById('settings');
  if (!sec) return;
  sec.innerHTML = `
    <div class="dashboard-content">
      <h1>Settings</h1>
      <div class="card">
        <p>Account and application settings will be here.</p>
      </div>
    </div>
  `;
}

/* ===== CHECK-IN / CHECK-OUT ===== */
async function doCheckIn() {
  const user = JSON.parse(localStorage.getItem('nxt_user'));
  if (!user) return alert('User not found');
  try {
    const res = await fetch(`${API_BASE}/api/attendance/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ empId: user.empId })
    });
    const data = await res.json();
    if (!res.ok) return alert(data.message || 'Check-in failed');
    alert('Checked in successfully');
    loadDashboard();
  } catch (err) {
    console.error('checkin error', err);
    alert('Server error');
  }
}

async function doCheckOut() {
  const user = JSON.parse(localStorage.getItem('nxt_user'));
  if (!user) return alert('User not found');
  try {
    const res = await fetch(`${API_BASE}/api/attendance/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ empId: user.empId })
    });
    const data = await res.json();
    if (!res.ok) return alert(data.message || 'Check-out failed');
    alert('Checked out successfully');
    loadDashboard();
  } catch (err) {
    console.error('checkout error', err);
    alert('Server error');
  }
}
