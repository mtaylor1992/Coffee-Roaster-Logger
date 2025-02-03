/***** script.js *****/

// ========== GLOBAL VARIABLES ==========
let timerInterval;
let startTime;
let elapsedTime = 0;
let running = false;
let currentPromptSec = 0;
let tempModalTimeout = null;
let roastsArray = [];        // Holds all roasts from Firestore
let selectedRoastDocId = ""; // Which doc the user clicked in the table
let previewChart;   // line chart
let previewPie;     // pie chart

// Manual Mode
let manualMode = false;
let manualRowTimeSec = 0;

// Normal Mode
let currentPower = "P5"; // Default power level
let drumSpeed = "Low";

// Milestones
let dryEndTime = null;
let firstCrackTime = null;
let dropTime = null;

// Charts
let temperatureChart;
let pieChart;

// Target Drop Times
const targetDropPercentages = [15, 17.5, 20, 22.5, 25];
let targetDropTimes = {};

// Power map
const powerMap = { P5: 100, P4: 75, P3: 50, P2: 25, P1: 0 };

// Power Points Array
let powerPoints = []; // Array of {x: time in minutes, y: power level}

// Flag to prevent duplicate milestone processing
let isProcessingMilestone = false;

// ========== ON LOAD ==========
document.addEventListener("DOMContentLoaded", () => {
  // Register plugins if they exist
  if (typeof ChartDataLabels !== "undefined") {
    Chart.register(ChartDataLabels);
  }

  if (typeof ChartAnnotation !== "undefined") {
    Chart.register(ChartAnnotation);
  }

  initializeCharts();
  setupEventListeners();

  // Auto-fill date input
  const dateEl = document.getElementById("date");
  if (dateEl) {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    dateEl.value = now.toISOString().slice(0, 10);
  }
});

/** ========== INITIALIZE CHARTS ========== **/
function initializeCharts() {
  initializeTemperatureChart();
  initializePieChart();
}

function initializeTemperatureChart() {
  const canvas = document.getElementById("temperatureChart");
  if (!canvas) return;

  // Get the computed font size of the table title
  const tableTitle = document.querySelector(".table-section h3");
  const computedStyle = window.getComputedStyle(tableTitle);
  const fontSizeEm =
    parseFloat(computedStyle.fontSize) /
    parseFloat(getComputedStyle(document.body).fontSize);
  const fontSizePx = 16 * fontSizeEm; // Assuming 1em = 16px

  temperatureChart = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      datasets: [
        {
          label: "Sensor B",
          data: [],
          borderColor: "blue",
          fill: false,
          yAxisID: "yTemp",
          pointRadius: 3
        },
        {
          label: "Sensor A",
          data: [],
          borderColor: "green",
          fill: false,
          yAxisID: "yTemp",
          pointRadius: 3
        },
        {
          label: "Power Level",
          data: [],
          borderColor: "red",
          fill: false,
          yAxisID: "yPower",
          stepped: true,
          pointRadius: 0,
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "",
          color: "black",
          font: {
            size: fontSizePx,
            weight: "bold"
          }
        },
        annotation: {
          annotations: {}
        },
        datalabels: false
      },
      scales: {
        x: {
          title: { display: true, text: "Time (min)" },
          type: "linear",
          position: "bottom",
          min: 0,
          ticks: {
            stepSize: 0.5,
            callback: (val) => (val % 1 === 0 ? val : "")
          }
        },
        yTemp: {
          title: { display: true, text: "Temperature (°F)" },
          position: "left",
          min: 95,
          ticks: {
            callback: (val) => Math.round(val)
          }
        },
        yPower: {
          title: { display: true, text: "Power Level" },
          position: "right",
          min: 0,
          max: 100,
          grid: { drawOnChartArea: false },
          ticks: {
            stepSize: 25,
            callback: (val) => {
              switch (val) {
                case 100:
                  return "P5";
                case 75:
                  return "P4";
                case 50:
                  return "P3";
                case 25:
                  return "P2";
                case 0:
                  return "P1";
                default:
                  return "";
              }
            }
          }
        }
      },
      // Add or modify the animation settings here
      animation: {
        duration: 0, // Disables animations
        easing: "linear" // Optional: makes updates smoother if animations are enabled
      }
    }
  });
}

function initializePieChart() {
  const canvas = document.getElementById("pieChart");
  if (!canvas) return;

  // Get the computed font size of the table title
  const tableTitle = document.querySelector(".table-section h3");
  const computedStyle = window.getComputedStyle(tableTitle);
  const fontSizeEm =
    parseFloat(computedStyle.fontSize) /
    parseFloat(getComputedStyle(document.body).fontSize);
  const fontSizePx = 16 * fontSizeEm; // Assuming 1em = 16px

  pieChart = new Chart(canvas.getContext("2d"), {
    type: "pie",
    data: {
      labels: ["Drying", "Browning", "Development"],
      datasets: [
        {
          data: [0, 0, 0],
          backgroundColor: ["#ffe080", "#ffb060", "#ff8060"]
        }
      ]
    },
    options: {
      responsive: true,
      borderColor: ["#ffe080", "#ffb060", "#ff8060"],
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }, // Removed the legend
        title: {
          display: true,
          text: "Roast Phases",
          color: "black",
          font: {
            size: fontSizePx,
            weight: "bold"
          }
        },
        datalabels: {
          // Updated formatter to show labels only for active slices
          formatter: (value, ctx) => {
            const total = ctx.chart.data.datasets[ctx.datasetIndex].data.reduce(
              (a, b) => a + b,
              0
            );
            if (total === 0 || value === 0) return ""; // Hide label if slice is inactive
            let pct = ((value / total) * 100).toFixed(1) + "%";
            const label = ctx.chart.data.labels[ctx.dataIndex] || "";
            const timeStr = formatTime(value * 1000);
            // Return multi-line string without HTML tags
            return `${label}\n${timeStr}\n${pct}`;
          },
          font: { size: 12, weight: "bold" }, // Set font weight to bold
          color: "black",
          align: "center",
          anchor: "center"
        },
        tooltip: { enabled: false }
      }
    }
  });
}

/** ========== EVENT LISTENERS ========== **/
function setupEventListeners() {
  const startBtn = document.getElementById("startRoast");
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      autoAddChargeIfTyped();
      startRoast();
    });
  }

  const resetBtn = document.getElementById("resetRoast");
  if (resetBtn) {
    resetBtn.addEventListener("click", resetRoastAll);
  }

  // Debounce function to prevent rapid multiple clicks
  function debounce(func, delay) {
    let debounceTimer;
    return function (...args) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => func.apply(this, args), delay);
    };
  }

  // Power buttons in normal mode with debounced event handler
  document.querySelectorAll(".power-btn").forEach((btn) => {
    btn.addEventListener(
      "click",
      debounce(() => {
        if (!manualMode) changePowerLevel(btn.getAttribute("data-level"));
      }, 300)
    ); // 300ms delay
  });

  // Toggle drum speed in normal mode with debounced event handler
  const drumBtn = document.getElementById("toggleDrumSpeed");
  if (drumBtn) {
    drumBtn.addEventListener(
      "click",
      debounce(() => {
        if (!manualMode) toggleDrumSpeed();
      }, 300)
    );
  }

  // Milestone buttons in normal mode with debounced event handler
  document.querySelectorAll(".milestone-btn").forEach((btn) => {
    btn.addEventListener(
      "click",
      debounce(() => {
        if (!manualMode) milestoneEvent(btn.getAttribute("data-event"));
      }, 300)
    );
  });

  const roastTable = document.getElementById("roastTable");
  if (roastTable) {
    // Changed from 'dblclick' to 'click' for single-click editing
    roastTable.addEventListener("click", handleTableClick);
  }

  const manualCheckbox = document.getElementById("manualModeCheckbox");
  if (manualCheckbox) {
    manualCheckbox.addEventListener("change", (e) => {
      if (e.target.checked) {
        autoAddChargeIfTyped();
        if (!checkBeanAndWeight()) {
          e.target.checked = false;
        } else {
          manualMode = true;
          enableManualMode();
        }
      } else {
        manualMode = false;
        resetRoast();
      }
    });
  }

  const chargeTempInput = document.getElementById("chargeTemp");
  if (chargeTempInput) {
    chargeTempInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        const val = parseFloat(chargeTempInput.value.trim());
        if (!isNaN(val)) {
          setOrUpdateChargeRow(val);
        }
      }
    });
  }

  const saveBtn = document.getElementById("saveRoastBtn");
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      if (!firebase.auth().currentUser) {
        alert("You must create an account or log in before saving a roast.");
        return;
      }
      // If the user is logged in, open the save popup.
      showSavePopup();
    });
  }   

  const loadBtn = document.getElementById("loadRoastBtn");
  if (loadBtn) {
    loadBtn.addEventListener("click", () => {
      if (!firebase.auth().currentUser) {
        alert("You must create an account or log in before loading a roast.");
        return;
      }
      // If the user is logged in, open the load popup.
      showLoadPopup();
    });
  }

  const cancelSaveBtn = document.getElementById("cancelSaveBtn");
  if (cancelSaveBtn) {
    cancelSaveBtn.addEventListener("click", hideSavePopup);
  }
  const confirmSaveBtn = document.getElementById("confirmSaveBtn");
  if (confirmSaveBtn) {
    confirmSaveBtn.addEventListener("click", doSaveRoast);
  }

  const cancelLoadBtn = document.getElementById("cancelLoadBtn");
  if (cancelLoadBtn) {
    cancelLoadBtn.addEventListener("click", hideLoadPopup);
  }
  const confirmLoadBtn = document.getElementById("confirmLoadBtn");
  if (confirmLoadBtn) {
    confirmLoadBtn.addEventListener("click", handleLoadSelection);
  }

  document.getElementById("confirmLoadBtn").addEventListener("click", () => {
    if (!selectedRoastDocId) {
      document.getElementById("loadStatus").innerText = "Please select a roast row first.";
      return;
    }
    handleLoadSelection(selectedRoastDocId);
  });

  document.getElementById("roastSearchInput").addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim();

    const filtered = roastsArray.filter(r => {
      return r.beanType.toLowerCase().includes(query);
      // Or also check dateValue, docId, etc. for multi-field search
    });

    // Re-render with the filtered list
    renderRoastListTable(filtered);
  });

  document.getElementById("applySortBtn").addEventListener("click", () => {
    const field = document.getElementById("sortFieldSelect").value;   // "dateValue", "beanType", ...
    const direction = document.getElementById("sortDirectionSelect").value; // "asc" or "desc"

    roastsArray.sort((a, b) => {
      let valA = a[field];
      let valB = b[field];

      // If sorting startWeight as a number:
      if (field === "startWeight") {
        valA = parseFloat(valA) || 0;
        valB = parseFloat(valB) || 0;
      }

      if (valA < valB) return direction === "asc" ? -1 : 1;
      if (valA > valB) return direction === "asc" ? 1 : -1;
      return 0;
    });

    // Now re-render
    renderRoastListTable(roastsArray);
  });

  // Temp Modal Buttons
  const cancelTempBtn = document.getElementById("cancelTempBtn");
  if (cancelTempBtn) {
    cancelTempBtn.addEventListener("click", () => {
      // If user cancels, also treat it as missed input or handle differently
      // e.g. fill with previous temps or do nothing
      handleMissedTempInput();
    });
  }

  const confirmTempBtn = document.getElementById("confirmTempBtn");
  if (confirmTempBtn) {
    confirmTempBtn.addEventListener("click", () => {
      handleTempSubmit();
    });
  }

  const bInput = document.getElementById("sensorBInput");
  const aInput = document.getElementById("sensorAInput");

  if (bInput) {
    bInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        // Move focus to sensor A
        aInput.focus();
      }
    });
  }

  if (aInput) {
    aInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        // Submit the modal
        handleTempSubmit();
      }
    });
  }

  // Delete button in load modal
  const deleteBtn = document.getElementById("deleteRoastPopupBtn");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", deleteSelectedRoast);
  }

  //Mini previews in load popup
  function initializePreviewCharts() {
    const lineCanvas = document.getElementById("previewChart");
    if (lineCanvas) {
      previewChart = new Chart(lineCanvas.getContext("2d"), {
        type: "line",
        data: {
          datasets: [
            { label: "Sensor B", data: [], borderColor: "blue", fill: false, pointRadius: 0 },
            { label: "Sensor A", data: [], borderColor: "green", fill: false, pointRadius: 0 }
          ]
        },
        options: {
          responsive: false, // so it doesn't shrink unpredictably
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { type: "linear", position: "bottom", min: 0 },
            y: { min: 0 } // or any min you prefer
          }
        }
      });
    }

    const pieCanvas = document.getElementById("previewPie");
    if (pieCanvas) {
      previewPie = new Chart(pieCanvas.getContext("2d"), {
        type: "pie",
        data: {
          labels: ["Drying", "Browning", "Development"],
          datasets: [
            { data: [0, 0, 0], backgroundColor: ["#ffe080", "#ffb060", "#ff8060"] }
          ]
        },
        options: {
          responsive: false,
          borderColor: ["#ffe080", "#ffb060", "#ff8060"],
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }, // Removed the legend
            datalabels: {
              // Updated formatter to show labels only for active slices
              formatter: (value, ctx) => {
                const total = ctx.chart.data.datasets[ctx.datasetIndex].data.reduce(
                  (a, b) => a + b,
                  0
                );
                if (total === 0 || value === 0) return ""; // Hide label if slice is inactive
                let pct = ((value / total) * 100).toFixed(1) + "%";
                const label = ctx.chart.data.labels[ctx.dataIndex] || "";
                const timeStr = formatTime(value * 1000);
                // Return multi-line string without HTML tags
                return `${label}\n${timeStr}\n${pct}`;
              },
              font: { size: 12, weight: "bold" }, // Set font weight to bold
              color: "black",
              align: "center",
              anchor: "center"
            },
            tooltip: { enabled: false }
          }
        }
      });
    }
  }

  // Toggle sidebar when hamburger is clicked
  document.getElementById("hamburger").addEventListener("click", function() {
    const sidebar = document.getElementById("sidebar");
    sidebar.classList.toggle("open");
  });

  // Firebase Auth event listeners and functions
  // (Assumes Firebase is already initialized via your firebase-config.js)

  const auth = firebase.auth(); // using Firebase Auth

  // Update the UI when the auth state changes
  auth.onAuthStateChanged((user) => {
    const loggedInUserEl = document.getElementById("loggedInUser");
    const logoutBtn = document.getElementById("logoutBtn");
    if (user) {
      loggedInUserEl.textContent = `Logged in as: ${user.email}`;
      logoutBtn.style.display = "block";
    } else {
      loggedInUserEl.textContent = "Not logged in";
      logoutBtn.style.display = "none";
    }
  });

  // Login button functionality
  document.getElementById("loginBtn").addEventListener("click", () => {
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    if (!email || !password) {
      alert("Please enter both email and password.");
      return;
    }
    auth.signInWithEmailAndPassword(email, password)
      .catch((error) => {
        alert(`Login failed: ${error.message}`);
      });
  });

  // Sign up button functionality
  document.getElementById("signupBtn").addEventListener("click", () => {
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    if (!email || !password) {
      alert("Please enter both email and password.");
      return;
    }
    auth.createUserWithEmailAndPassword(email, password)
      .then(() => {
        alert("Account created and logged in successfully.");
        document.getElementById("sidebar").classList.remove("open");
      })
      .catch((error) => {
        alert(`Sign up failed: ${error.message}`);
      });
  });

  // Logout button functionality
  document.getElementById("logoutBtn").addEventListener("click", () => {
    auth.signOut()
      .catch((error) => {
        alert(`Logout failed: ${error.message}`);
      });
  });

  // Change Password functionality (simple example)
  document.getElementById("changePasswordBtn").addEventListener("click", () => {
    const newPassword = prompt("Enter your new password:");
    if (!newPassword) {
      alert("Password not changed.");
      return;
    }
    const user = auth.currentUser;
    if (user) {
      user.updatePassword(newPassword)
        .then(() => {
          alert("Password updated successfully.");
        })
        .catch((error) => {
          alert(`Failed to update password: ${error.message}`);
        });
    } else {
      alert("No user is currently logged in.");
    }
  });

  // When the sidebar is open, clicking anywhere outside of it will close it.
  document.addEventListener("click", function(event) {
    const sidebar = document.getElementById("sidebar");
    const hamburger = document.getElementById("hamburger");

    // Check if the sidebar is open.
    if (sidebar.classList.contains("open")) {
      // If the click is outside the sidebar and outside the hamburger icon...
      if (!sidebar.contains(event.target) && !hamburger.contains(event.target)) {
        sidebar.classList.remove("open");
      }
    }
  });

  document.getElementById("forgotPasswordLink").addEventListener("click", function(e) {
    e.preventDefault();
    sendPasswordReset();
  });

  initializePreviewCharts();
}

/** If user typed charge temp but never pressed Enter, do it automatically **/
function autoAddChargeIfTyped() {
  const chargeTempInput = document.getElementById("chargeTemp");
  if (!chargeTempInput) return;
  const val = parseFloat(chargeTempInput.value.trim());
  if (!isNaN(val)) {
    setOrUpdateChargeRow(val);
  }
}

// ========== CHECK BEAN / WEIGHT ==========
function checkBeanAndWeight() {
  const beanVal = (document.getElementById("beanType")?.value || "").trim();
  const startW = (document.getElementById("startWeight")?.value || "").trim();
  if (!beanVal || !startW) {
    //alert("Please enter Bean Type and Start Weight first.");
    //return false;
  }
  return true;
}

// ========== CHARGE ROW ==========
function setOrUpdateChargeRow(tempVal) {
  const tbody = document.querySelector("#roastTable tbody");
  if (!tbody) return;

  if (tbody.rows.length && tbody.rows[0].cells[0].innerText === "Charge") {
    tbody.rows[0].cells[1].innerText = tempVal;
  } else {
    const row = tbody.insertRow(0);
    row.dataset.timeSec = 0;
    row.dataset.oldNote = "";

    row.insertCell(0).innerText = "Charge";
    row.insertCell(1).innerText = tempVal;
    row.insertCell(2).innerText = "";
    row.insertCell(3).innerText = "";
    // No delete button for Charge row
  }
  toggleDeleteButtons();
}

/** ========== MANUAL MODE ========== **/
function enableManualMode() {
  document.querySelectorAll(".buttons button").forEach((btn) => {
    // Keep Reset and Save enabled
    if (btn.id !== "resetRoast" && btn.id !== "saveRoastBtn") {
      btn.disabled = true;
    }
  });

  running = false;
  elapsedTime = 0;
  manualMode = true;
  manualRowTimeSec = 0;

  // Initialize powerPoints with default P5 starting at 0:00
  powerPoints = [];
  pushOrReplacePowerPoint(0, "P5");
  updatePowerDataset();
  temperatureChart.update(); // Ensure the chart reflects the change

  addManualRow();
  updateChartTitle();
}

function addManualRow() {
  const tbody = document.querySelector("#roastTable tbody");

  let lastSec = -1;
  let foundNormalRow = false;
  for (let i = tbody.rows.length - 1; i >= 0; i--) {
    if (tbody.rows[i].cells[0].innerText !== "Charge") {
      lastSec = parseTimeToSec(tbody.rows[i].cells[0].innerText);
      foundNormalRow = true;
      break;
    }
  }
  if (!foundNormalRow) {
    manualRowTimeSec = 0;
  } else {
    manualRowTimeSec = Math.max(0, lastSec) + 30;
  }

  const row = tbody.insertRow(tbody.rows.length);
  row.dataset.timeSec = manualRowTimeSec;
  row.dataset.oldNote = "";

  // 5 columns for manual
  row.insertCell(0).innerText = formatTimeString(manualRowTimeSec);
  const bCell = row.insertCell(1);
  bCell.contentEditable = "true";
  const aCell = row.insertCell(2);
  aCell.contentEditable = "true";
  const noteCell = row.insertCell(3);
  noteCell.contentEditable = "true";
  const xCell = row.insertCell(4);
  const xBtn = document.createElement("button");
  xBtn.innerText = "x";
  xBtn.style.marginLeft = "10px";
  xBtn.addEventListener("click", () => removeRowAndData(row));
  xCell.appendChild(xBtn);

  toggleDeleteButtons();

  row.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const cIndex = e.target.cellIndex;
      if (cIndex === 1) {
        row.cells[2].focus();
      } else if (cIndex === 2) {
        row.cells[3].focus();
      } else if (cIndex === 3) {
        updateRowSensors(row);
        parseAndExecuteNoteWithRemoval(row);
        if (tbody.rows[tbody.rows.length - 1] === row) {
          addManualRow();
          tbody.rows[tbody.rows.length - 1].cells[1].focus();
        }
      }
      updatePieChart();
    }
  });

  if (!foundNormalRow) {
    bCell.focus();
  }
  refreshNotesSection();
}

function parseTimeToSec(timeStr) {
  if (timeStr.toLowerCase() === "charge") return -1;
  const [mm, ss] = timeStr.split(":").map(Number);
  return mm * 60 + (ss || 0);
}

function toggleDeleteButtons() {
  const tbody = document.querySelector("#roastTable tbody");
  let normalRows = [];
  for (let i = 0; i < tbody.rows.length; i++) {
    const row = tbody.rows[i];
    if (row.cells[0].innerText === "Charge") {
      if (row.cells.length > 4) {
        row.cells[4].style.visibility = "hidden";
      }
    } else {
      normalRows.push(row);
    }
  }
  if (manualMode && normalRows.length) {
    for (let i = 0; i < normalRows.length - 1; i++) {
      if (normalRows[i].cells.length > 4) {
        normalRows[i].cells[4].style.visibility = "hidden";
      }
    }
    if (normalRows[normalRows.length - 1].cells.length > 4) {
      normalRows[normalRows.length - 1].cells[4].style.visibility = "visible";
    }
  }
}

function updateRowSensors(row) {
  const tSec = parseInt(row.dataset.timeSec, 10);

  // Grab the raw text from the table cells
  let bRaw = row.cells[1].innerText.trim();
  let aRaw = row.cells[2].innerText.trim();

  // Default blank cells to "0"
  if (!bRaw) {
    bRaw = "0";
    row.cells[1].innerText = "0"; // optionally display "0" in the cell
  }
  if (!aRaw) {
    aRaw = "0";
    row.cells[2].innerText = "0";
  }

  const bVal = parseFloat(bRaw);
  const aVal = parseFloat(aRaw);

  // If both are valid numbers, add to chart
  if (!isNaN(bVal) && !isNaN(aVal)) {
    addOrReplaceChartData(tSec, bVal, aVal);
  }
}

function removeRowAndData(row) {
  // 1) Identify the timeSec
  const tSec = parseInt(row.dataset.timeSec, 10);
  const xVal = tSec / 60;

  // 2) Remove Sensor B/A points from the chart at that time
  removeChartPoint("Sensor B", xVal);
  removeChartPoint("Sensor A", xVal);

  // 3) Remove any power changes or milestone lines if noted
  const oldNote = row.dataset.oldNote || row.cells[3].innerText.trim();
  removeOldNotePoints(oldNote);     // Removes any power references like "P4 1:23"
  removeOldMilestoneLines(oldNote); // Removes Dry/First/Drop lines if in the note

  // 4) Physically remove the row from the table
  row.parentElement.removeChild(row);

  // 5) Update UI
  toggleDeleteButtons();

  // Rebuild the powerPoints from the table (so all future references are consistent)
  rebuildPowerPoints();

  // If you want to re-parse annotations from scratch:
  rebuildAnnotations();

  // Re-sort data sets & update chart
  sortAllDatasets();
  updatePieChart();
  refreshNotesSection();
}

function containsExplicitPowerTime(str) {
  const re = /\bP[1-5]\b\s+\d{1,2}:\d{2}/i;
  return re.test(str);
}

function parseAndExecuteNoteWithRemoval(row) {
  const oldNote = row.dataset.oldNote || "";
  removeOldNotePoints(oldNote);
  removeOldMilestoneLines(oldNote);

  const rawNote = row.cells[3].innerText.trim();
  const rowTimeSec = parseInt(row.dataset.timeSec, 10);

  // Double-enter fix if user typed "P4 1:23"
  if (containsExplicitPowerTime(rawNote)) {
    removeChartPoint("Power Level", rowTimeSec / 60);
  }

  const finalNote = maybeAddSyntheticTime(rawNote, rowTimeSec);
  parseAndExecuteNote(finalNote, rowTimeSec);
  row.dataset.oldNote = finalNote;

  if (containsPowerChange(finalNote)) {
    forwardPatchPowerChange(row);
  }

  // Rebuild power points from the updated table
  rebuildPowerPoints();
}

function maybeAddSyntheticTime(rawNote, defaultTimeSec) {
  const timeRegex = /\d{1,2}:\d{2}/;
  if (timeRegex.test(rawNote)) {
    return rawNote;
  }

  const lower = rawNote.toLowerCase().trim();
  const powerRegex = /^p[1-5]$/i; // Matches exactly "P1" to "P5"

  if (
    lower.includes("dry") ||
    lower.includes("first") ||
    lower.includes("drop") ||
    powerRegex.test(lower)
  ) {
    const timeStr = formatTimeString(defaultTimeSec);
    return `${rawNote} ${timeStr}`;
  }

  return rawNote;
}

function maybeAddPowerPoint(row) {
  const noteVal = row.dataset.syntheticNote || row.cells[3].innerText.trim();
  const tSec = parseInt(row.dataset.timeSec, 10);
  const xVal = tSec / 60;

  // 1) Power + explicit time
  const explicitTimeRegex = /(P[1-5])\s+(\d{1,2}:\d{2})/i;
  let match = noteVal.match(explicitTimeRegex);
  if (match) {
    const powerLevel = match[1].toUpperCase();
    const timeSec = convertTimeStringToSeconds(match[2]);
    currentPower = powerLevel; // update currentPower
    pushOrReplacePowerPoint(timeSec / 60, powerLevel);
    return;
  }

  // 2) Power no time, e.g., "p4"
  const pNoTimeRegex = /(P[1-5])(?!\s*\d)/i;
  match = noteVal.match(pNoTimeRegex);
  if (match) {
    const powerLevel = match[1].toUpperCase();
    currentPower = powerLevel; // ensure we update currentPower
    pushOrReplacePowerPoint(xVal, currentPower);
    return;
  }
}

function containsPowerChange(str) {
  const re = /\bP[1-5]\b/i;
  return re.test(str);
}

/**
 * forwardPatchPowerChange:
 * We set the new power for all future rows until we find another power note or time < lastSec
 */
function forwardPatchPowerChange(row) {
  const rowTimeSec = parseInt(row.dataset.timeSec, 10);
  const note = row.cells[3].innerText.trim();
  const re = /\b(P[1-5])\b/i;
  const match = note.match(re);
  if (!match) return;

  const newPower = match[1].toUpperCase();
  currentPower = newPower; // Update current power

  const tbody = document.querySelector("#roastTable tbody");
  const allRows = Array.from(tbody.rows);
  const index = allRows.indexOf(row);
  if (index < 0) return;

  for (let i = index + 1; i < allRows.length; i++) {
    const r = allRows[i];
    if (r.cells[0].innerText === "Charge") continue;
    const rTimeSec = parseInt(r.dataset.timeSec, 10);
    const xVal = rTimeSec / 60;
    const rNote = r.dataset.oldNote || r.cells[3].innerText || "";

    if (containsPowerChange(rNote) || rTimeSec < rowTimeSec) break;

    pushOrReplacePowerPoint(xVal, newPower);
  }
  updatePowerDataset();
}

function startRoast() {
  if (manualMode) return;
  if (!checkBeanAndWeight()) return;

  if (running) {
    return;
  }
  running = true;
  startTime = Date.now() - elapsedTime;
  timerInterval = setInterval(updateTimer, 200);

  // Start power P5 at 0:00
  pushOrReplacePowerPoint(0, "P5");
  currentPower = "P5";
  updatePowerDataset();
  sortAllDatasets();

  //promptSensorData(0);
  showTempModal(0);
  updateChartTitle();
  updatePhaseBackground();
}

function updateTimer() {
  if (!running) return;
  elapsedTime = Date.now() - startTime;
  const totalSec = Math.floor(elapsedTime / 1000);
  document.getElementById("timer").innerText = formatTimeString(totalSec);

  updatePieChart(); // Always update pie chart every second

  // Update temperature chart every 30 seconds
  if (totalSec > 0 && totalSec % 30 === 0) {
    const xVal = totalSec / 60;
    pushOrReplacePowerPoint(xVal, currentPower);
    updatePowerDataset();
    sortAllDatasets();
    updatePhaseBackground();
    showTempModal(totalSec);
    //promptSensorData(totalSec);
  }

  // Ensure powerPoints covers up to current time
  ensurePowerPointAtCurrentTime();
}

// ========== RESET ==========
function resetRoast(partial = false) {
  running = false;
  clearInterval(timerInterval);
  elapsedTime = 0;
  document.getElementById("timer").innerText = "00:00";

  // Clear chart data
  temperatureChart.data.datasets.forEach((ds) => (ds.data = []));
  temperatureChart.options.plugins.annotation.annotations = {};
  temperatureChart.options.plugins.title.text = "";
  temperatureChart.update();

  // Clear pie
  pieChart.data.datasets[0].data = [0, 0, 0];
  pieChart.update();

  // Clear table
  const tbody = document.querySelector("#roastTable tbody");
  if (tbody) tbody.innerHTML = "";

  // Clear milestones
  dryEndTime = null;
  firstCrackTime = null;
  dropTime = null;

  resetDropTimesUI();
  targetDropTimes = {};

  currentPower = "P5";
  manualRowTimeSec = 0;

  // Clear power points array
  powerPoints = [];
  updatePowerDataset();

  //Clear notes section
  document.getElementById("autoNotesList").innerHTML = "";
  document.getElementById("manualNotesArea").value = "";
}

function resetRoastAll() {
  resetRoast();
  // Auto-fill date input
  const dateEl = document.getElementById("date");
  if (dateEl) {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    dateEl.value = now.toISOString().slice(0, 10);
  }
  document.getElementById("beanType").value = "";
  document.getElementById("startWeight").value = "";
  document.getElementById("endWeight").value = "";
  document.getElementById("chargeTemp").value = "";
  const manualBox = document.getElementById("manualModeCheckbox");
  if (manualBox) manualBox.checked = false;
}

// ========== POWER / DRUM / MILESTONES ==========
function changePowerLevel(level) {
  currentPower = level;
  const timeStr = getCurrentTimeString();

  appendNoteToLastRow(timeStr, `${level} ${timeStr}`);

  const xVal = elapsedTime / 1000 / 60;
  pushOrReplacePowerPoint(xVal, level);
  updatePowerDataset();
  sortAllDatasets();
  refreshNotesSection();
}

function toggleDrumSpeed() {
  drumSpeed = drumSpeed === "Low" ? "High" : "Low";
  const timeStr = getCurrentTimeString();
  appendNoteToLastRow(timeStr, `Drum ${drumSpeed} ${timeStr}`);
  refreshNotesSection();
}

function milestoneEvent(name) {
  if (isProcessingMilestone) {
    console.warn(
      `Milestone event processing is already in progress. Skipping: ${name}`
    );
    return;
  }
  isProcessingMilestone = true;

  try {
    const timeStr = getCurrentTimeString();

    appendNoteToLastRow(timeStr, `${name} ${timeStr}`);

    const xVal = elapsedTime / 1000 / 60;
    if (name.toLowerCase().includes("dry")) {
      dryEndTime = elapsedTime / 1000;
      addMilestoneAnnotation("Dry End", xVal);
      updatePhaseBackground();
    } else if (name.toLowerCase().includes("first")) {
      firstCrackTime = elapsedTime / 1000;
      addMilestoneAnnotation("First Crack", xVal);
      updatePhaseBackground();
      computeTargetDropTimes();
    } else if (name.toLowerCase().includes("drop")) {
      dropTime = elapsedTime / 1000;
      addMilestoneAnnotation("Drop", xVal);
      updatePhaseBackground();
      running = false;
      clearInterval(timerInterval);
    }
    updatePieChart();
    refreshNotesSection();

  } catch (error) {
    console.error(`Error processing milestone event "${name}":`, error);
  } finally {
    // Ensure the flag is reset even if an error occurs
    isProcessingMilestone = false;
  }
}

//========== LOGGING ==========
function logData(timeSec, sensorB, sensorA, notes, addToTable = true) {
  const payload = {
    time: timeSec,
    sensorB,
    sensorA,
    notes//,
  };

  // Only add row to table if not manual
  if (!manualMode && addToTable) {
    addDataToTable(timeSec, sensorB, sensorA, notes);
  }
  addOrReplaceChartData(timeSec, sensorB, sensorA);
}

function showTempModal(totalSec) {
  if (!running) return; // If roast is no longer running, skip
  currentPromptSec = totalSec; // Store globally

  // Format the time string for display
  const timeLabel = formatTimeString(totalSec); // e.g. "4:30"
  document.getElementById("tempModalTitle").innerText = `Enter Temperatures for ${timeLabel}`;

  // Display the custom modal
  document.getElementById("tempModal").style.display = "flex";
  document.getElementById("tempPromptInfo").innerText = ""; // Clear old msg
  document.getElementById("sensorBInput").value = "";
  document.getElementById("sensorAInput").value = "";

  // Focus Sensor B immediately
  document.getElementById("sensorBInput").focus();

  // If user doesn't submit within 28 seconds, treat it as "missed input"
  tempModalTimeout = setTimeout(() => {
    // Only do this if the modal is still open
    if (document.getElementById("tempModal").style.display === "flex") {
      handleMissedTempInput(totalSec);
    }
  }, 28000); // e.g. 28,000 ms = 28 seconds
}

function handleTempSubmit() {
  // Cancel the missed-input timeout
  clearTimeout(tempModalTimeout);

  // Grab user inputs
  const bInputVal = parseFloat(document.getElementById("sensorBInput").value);
  const aInputVal = parseFloat(document.getElementById("sensorAInput").value);

  // We need the time we’re logging for. One way:
  //  - Option A: store `currentPromptSec` in a global or pass it in
  //  - Option B: keep a hidden field in the modal
  // For simplicity, let's assume we stored "currentPromptSec" globally:

  if (isNaN(bInputVal) || isNaN(aInputVal)) {
    document.getElementById("tempPromptInfo").innerText = "Invalid input. Numbers only.";
    return;
  }

  // Log data
  logData(currentPromptSec, bInputVal, aInputVal, "");

  // Hide modal
  document.getElementById("tempModal").style.display = "none";
}

function handleMissedTempInput(missedSec = null) {
  clearTimeout(tempModalTimeout);
  document.getElementById("tempModal").style.display = "none";

  if (!missedSec) missedSec = currentPromptSec;
  // Or handle if user canceled after some delay

  // 1) Get previous row’s B/A
  const tbody = document.querySelector("#roastTable tbody");
  let lastB = null, lastA = null;
  if (tbody && tbody.rows.length) {
    const lastRow = tbody.rows[tbody.rows.length - 1];
    lastB = parseFloat(lastRow.cells[1].innerText) || 0;
    lastA = parseFloat(lastRow.cells[2].innerText) || 0;
  }

  // 2) Insert a new row (like normal) with those values
  logData(missedSec, lastB, lastA, "Temperature input missed");
}

/** ========== TABLE & CHART UPDATE ========== **/
function addDataToTable(timeSec, sensorB, sensorA, notes) {
  const tbody = document.querySelector("#roastTable tbody");
  if (!tbody) return;

  // Always append at bottom for normal mode
  const row = tbody.insertRow(tbody.rows.length);
  row.dataset.timeSec = timeSec;
  row.dataset.oldNote = notes || "";

  // 4 columns
  row.insertCell(0).innerText = formatTimeString(timeSec);
  row.insertCell(1).innerText = sensorB;
  row.insertCell(2).innerText = sensorA;
  row.insertCell(3).innerText = notes;

  // --- Auto-scroll after inserting ---
  const container = document.querySelector(".table-section");
  if (container) {
    // Use smooth scrolling:
    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }
}

function addOrReplaceChartData(timeSec, sensorB, sensorA) {
  const xVal = timeSec / 60;
  removeChartPoint("Sensor B", xVal);
  removeChartPoint("Sensor A", xVal);

  temperatureChart.data.datasets
    .find((ds) => ds.label === "Sensor B")
    .data.push({ x: xVal, y: sensorB });
  temperatureChart.data.datasets
    .find((ds) => ds.label === "Sensor A")
    .data.push({ x: xVal, y: sensorA });

  sortAllDatasets();
}

/**
 * handleTableClick => user can edit B/A or note with single click
 */
function handleTableClick(e) {
  // Ensure the clicked element is a table cell (TD)
  if (e.target.tagName !== "TD") return;

  // Skip the first column (e.g., Time)
  if (e.target.cellIndex === 0) return;

  const row = e.target.parentElement;

  // Prevent editing the "Charge" row if applicable
  if (row.cells[0].innerText === "Charge") return;

  // Prevent multiple input fields in the same cell
  if (e.target.querySelector("input")) return;

  const oldValue = e.target.innerText.trim();

  // Create an input element for editing
  const input = document.createElement("input");
  input.type = "text";
  input.value = oldValue;
  input.style.width = "100%";
  e.target.innerHTML = ""; // Clear the cell's current content
  e.target.appendChild(input);
  input.focus();

  /**
   * Function to handle saving or reverting the edit
   */
  const handleEdit = () => {
    const newVal = input.value.trim();

    if (newVal === oldValue) {
      // No changes detected
      // Check if we should still create a new row in manual mode
      if (manualMode && e.target.cellIndex === 3) {
        // Is this the last row in the table?
        const tbody = document.querySelector("#roastTable tbody");
        const allRows = tbody.querySelectorAll("tr");
        const isLastRow = (row === allRows[allRows.length - 1]);

        if (isLastRow) {
          // Force the creation of a new row
          addManualRow();
          tbody.rows[tbody.rows.length - 1].cells[1].focus();
        }
      }
      // Regardless of whether we added a row, restore old text and return
      e.target.innerText = oldValue;
    } else {
      // Changes detected; proceed to save the new value
      saveEdit(row, e.target.cellIndex, newVal);
    }
  };

  // Event listener for losing focus (blur)
  input.addEventListener("blur", handleEdit);

  // Event listener for keydown (Enter key)
  input.addEventListener("keydown", (evt) => {
    if (evt.key === "Enter") {
      evt.preventDefault(); // Prevent default Enter key behavior
      input.blur(); // Trigger the blur event to handle the edit
    }
  });
}

/**
 * saveEdit => now we unify normal/manual => if col=3 is notes => remove old lines, parse new
 */
function saveEdit(row, cellIndex, newVal) {
  // Trim the new value
  newVal = newVal.trim();

  // Update the cell's displayed text
  row.cells[cellIndex].innerText = newVal;

  const tSec = parseInt(row.dataset.timeSec, 10);
  const timeStr = formatTimeString(tSec); // e.g., "2:00"

  if (cellIndex === 1 || cellIndex === 2) {
    // Sensor B or Sensor A value changed
    const bVal = parseFloat(row.cells[1].innerText.trim());
    const aVal = parseFloat(row.cells[2].innerText.trim());
    if (!isNaN(bVal) && !isNaN(aVal)) {
      addOrReplaceChartData(tSec, bVal, aVal);
    }
  } else if (cellIndex === 3) {
    // Note changed => rebuild powerPoints and update chart
    let rawNote = row.cells[3].innerText.trim();

    // **Do not modify the cell's innerText**
    // Instead, store the synthetic note in a data attribute
    const syntheticNote = maybeAddSyntheticTime(rawNote, tSec, timeStr);
    row.dataset.syntheticNote = syntheticNote; // Store synthetic note in data attribute

    // Rebuild powerPoints from the updated table
    rebuildPowerPoints();

    // Parse and execute the synthetic note
    parseAndExecuteNoteWithRemoval(row);
    updatePhaseBackground();
  }

  updatePieChart();
  refreshNotesSection();

  if (manualMode) {
    // **Determine if the current row is the last row**
    const tbody = document.querySelector("#roastTable tbody");
    const allRows = tbody.querySelectorAll("tr");
    const isLastRow = row === allRows[allRows.length - 1];

    if (isLastRow) {
      // **If editing the last row, add a new row and focus on its Sensor B cell**
      if (cellIndex === 1) {
        row.cells[2].focus();
      } else if (cellIndex === 2) {
        row.cells[3].focus();
      } else if (cellIndex === 3) {
        addManualRow();
        tbody.rows[tbody.rows.length - 1].cells[1].focus();
      }
    }
  }
}

function refreshNotesSection() {
  const autoNotesList = document.getElementById("autoNotesList");
  if (!autoNotesList) return;

  // Find the boundary <li>
  const boundaryLi = document.getElementById("recipeBoundary");
  if (!boundaryLi) {
    // No recipe, clear everything
    autoNotesList.innerHTML = "";
  } else {
    // Remove everything *after* boundaryLi
    let node = boundaryLi.nextSibling;
    while (node) {
      let toRemove = node;
      node = node.nextSibling;
      autoNotesList.removeChild(toRemove);
    }
  }

  // Grab the roast table body
  const tbody = document.querySelector("#roastTable tbody");
  if (!tbody) return;

  // Iterate over each row
  for (let i = 0; i < tbody.rows.length; i++) {
    const row = tbody.rows[i];

    const timeStr = row.cells[0]?.innerText.trim() || "";
    const noteStr = row.cells[3]?.innerText.trim() || "";

    // Only show if there's actually a note
    if (!noteStr) continue;

    // Create a read-only list item, e.g., "2:30 - P4 2:30"
    const li = document.createElement("li");
    li.textContent = `${timeStr} – ${noteStr}`;
    // (You could style or format it differently if you like.)

    // Append to the UL
    autoNotesList.appendChild(li);
  }
}

// ========== MILESTONE LINES & POWER REMOVALS ETC. ==========
function removeOldMilestoneLines(oldNote) {
  if (!oldNote) return;
  const noteLower = oldNote.toLowerCase();
  const pattern = /(dry\s?end|first\s?crack|drop)\s+(\d{1,2}:\d{2})/g;
  const matches = [...noteLower.matchAll(pattern)];
  if (!matches.length) return;

  matches.forEach((m) => {
    const eventNameLower = m[1];
    const timeStr = m[2];
    let normalizedName = "";
    if (eventNameLower.includes("dry")) {
      normalizedName = "Dry End";
    } else if (eventNameLower.includes("first")) {
      normalizedName = "First Crack";
    } else if (eventNameLower.includes("drop")) {
      normalizedName = "Drop";
    }
    const sec = convertTimeStringToSeconds(timeStr);
    removeOneMilestoneAnnotation(normalizedName, sec);
  });
}

function removeOneMilestoneAnnotation(eventName, noteSec) {
  const annID = makeAnnID(eventName, noteSec);
  delete temperatureChart.options.plugins.annotation.annotations[annID];
  updatePhaseBackground();
  temperatureChart.update();
}

function removeOldNotePoints(note) {
  if (!note) return;
  const powerPattern = /\b(P[1-5])\s+(\d{1,2}:\d{2})/gi;
  const matches = [...note.matchAll(powerPattern)];
  if (!matches.length) return;

  matches.forEach((m) => {
    const powerLevel = m[1].toUpperCase();
    const timeStr = m[2];
    const timeSec = convertTimeStringToSeconds(timeStr);
    const xVal = timeSec / 60;
    removeChartPoint("Power Level", xVal);
    // Also remove from powerPoints array
    powerPoints = powerPoints.filter(
      (p) => !(p.x === xVal && p.y === powerMap[powerLevel])
    );
    updatePowerDataset();
  });

  sortAllDatasets();
}

function parseAndExecuteNote(note, defaultTimeSec = 0) {
  if (!note) return;

  const segments = note.split(",").map((s) => s.trim()).filter(Boolean);
  segments.forEach((seg) => {
    const re =
      /(P[1-5])\s+(\d{1,2}:\d{2})|Dry\s?end\s+(\d{1,2}:\d{2})|first\s?crack\s+(\d{1,2}:\d{2})|drop\s+(\d{1,2}:\d{2})|drum\s?high\s+(\d{1,2}:\d{2})|drum\s?low\s+(\d{1,2}:\d{2})/i;
    const match = seg.match(re);
    if (match) {
      applyMatchWithTime(seg, match);
    } else {
      applyNoTimeSegment(seg, defaultTimeSec);
    }
  });
}

function applyMatchWithTime(segment, match) {
  let powerVal = match[1] || "";
  let powerTime = match[2] || "";
  let dryEndTimeStr = match[3] || "";
  let firstCrackTimeStr = match[4] || "";
  let dropTimeStr = match[5] || "";
  let drumHighTimeStr = match[6] || "";
  let drumLowTimeStr = match[7] || "";

  if (powerVal && powerTime) {
    const noteSec = convertTimeStringToSeconds(powerTime);
    applyNoteAction(powerVal.toLowerCase(), noteSec);
  } else if (dryEndTimeStr) {
    const noteSec = convertTimeStringToSeconds(dryEndTimeStr);
    applyNoteAction("dry", noteSec);
  } else if (firstCrackTimeStr) {
    const noteSec = convertTimeStringToSeconds(firstCrackTimeStr);
    applyNoteAction("first", noteSec);
  } else if (dropTimeStr) {
    const noteSec = convertTimeStringToSeconds(dropTimeStr);
    applyNoteAction("drop", noteSec);
  } else if (drumHighTimeStr) {
    const noteSec = convertTimeStringToSeconds(drumHighTimeStr);
    applyNoteAction("drum high", noteSec);
  } else if (drumLowTimeStr) {
    const noteSec = convertTimeStringToSeconds(drumLowTimeStr);
    applyNoteAction("drum low", noteSec);
  }
}

function applyNoTimeSegment(seg, defaultTimeSec) {
  seg = seg.toLowerCase();

  if (seg.includes("dry")) {
    const timeStr = formatTimeString(defaultTimeSec);
    const synthetic = `dry end ${timeStr}`;
    parseAndExecuteNote(synthetic, defaultTimeSec);
    return;
  }
  if (seg.includes("first")) {
    const timeStr = formatTimeString(defaultTimeSec);
    const synthetic = `first crack ${timeStr}`;
    parseAndExecuteNote(synthetic, defaultTimeSec);
    return;
  }
  if (seg.includes("drop")) {
    const timeStr = formatTimeString(defaultTimeSec);
    const synthetic = `drop ${timeStr}`;
    parseAndExecuteNote(synthetic, defaultTimeSec);
    return;
  }
  if (seg.includes("drum")) return;

  if (seg.startsWith("p")) {
    applyNoteAction(seg, defaultTimeSec);
  }
}

function applyNoteAction(action, noteSec) {
  const xVal = noteSec / 60;
  if (action.startsWith("p")) {
    pushOrReplacePowerPoint(xVal, action.toUpperCase());
    currentPower = action.toUpperCase();
    updatePowerDataset();
  } else if (action.includes("dry")) {
    dryEndTime = noteSec;
    addMilestoneAnnotation("Dry End", xVal);
  } else if (action.includes("first")) {
    firstCrackTime = noteSec;
    addMilestoneAnnotation("First Crack", xVal);
    computeTargetDropTimes();
  } else if (action.includes("drop")) {
    dropTime = noteSec;
    addMilestoneAnnotation("Drop", xVal);
    // Stop the timer
    running = false;
    clearInterval(timerInterval);
  }
}

function addMilestoneAnnotation(name, xVal) {
  const noteSec = xVal * 60;
  const annID = makeAnnID(name, noteSec);

  // Check if the annotation already exists
  if (temperatureChart.options.plugins.annotation.annotations[annID]) {
    console.warn(`Annotation ${annID} already exists. Skipping addition.`);
    return;
  }

  // **Additional Tolerance Check**
  // Define a tolerance in seconds
  const TOLERANCE_SEC = 1; // 1 second

  // Check existing annotations for the same event within the tolerance
  const existingAnnotations = Object.values(
    temperatureChart.options.plugins.annotation.annotations
  );
  const hasCloseAnnotation = existingAnnotations.some((annotation) => {
    if (annotation.label.content !== name) return false;
    const existingXVal = annotation.xMin; // xMin is in minutes
    const existingSec = existingXVal * 60;
    return Math.abs(existingSec - noteSec) <= TOLERANCE_SEC;
  });

  if (hasCloseAnnotation) {
    console.warn(
      `A ${name} annotation within ${TOLERANCE_SEC} seconds already exists. Skipping addition.`
    );
    return;
  }

  // Add the annotation
  temperatureChart.options.plugins.annotation.annotations[annID] = {
    type: "line",
    xMin: xVal,
    xMax: xVal,
    borderColor: "black",
    borderWidth: 2,
    borderDash: [10, 10],
    label: {
      display: true,
      content: name,
      position: "start",
      xAdjust: -30,
      backgroundColor: "rgba(0,0,0,1)",
      color: "white",
      font: { size: 12 },
      yAdjust: -50
    }
  };

  // Update the chart once after adding
  updatePhaseBackground();
  temperatureChart.update();
}

function updatePhaseBackground() {
  if (!temperatureChart) return;

  const annots = temperatureChart.options.plugins.annotation.annotations;

  // Remove old phase boxes if they exist
  delete annots["dryPhase"];
  delete annots["browningPhase"];
  delete annots["developmentPhase"];

  // Convert times to minutes
  const dryEndMin = dryEndTime ? dryEndTime / 60 : null;
  const firstCrackMin = firstCrackTime ? firstCrackTime / 60 : null;
  const dropMin = dropTime ? dropTime / 60 : null;

  // DRY PHASE: 0 to Dry End
  // Only add if we have a dryEndTime
  //if (dryEndMin && dryEndMin > 0) {
  annots["dryPhase"] = {
    type: "box",
    xMin: 0,
    xMax: dryEndMin,
    yMin: 0,
    yMax: "100%", // or a large number, e.g. 9999
    backgroundColor: "rgba(255, 224, 128, 0.5)", // #ffe080 w/ alpha
    borderWidth: 0,
  };
  //}

  // BROWNING PHASE: Dry End to First Crack
  if (dryEndMin) {
    annots["browningPhase"] = {
      type: "box",
      xMin: dryEndMin,
      xMax: firstCrackMin,
      yMin: 0,
      yMax: "100%",
      backgroundColor: "rgba(255, 176, 96, 0.5)", // #ffb060 w/ alpha
      borderWidth: 0
    };
  }

  // DEVELOPMENT PHASE: First Crack to Drop
  if (firstCrackMin) {
    annots["developmentPhase"] = {
      type: "box",
      xMin: firstCrackMin,
      xMax: dropMin,
      yMin: 0,
      yMax: "100%",
      backgroundColor: "rgba(255, 128, 96, 0.5)", // #ff8060 w/ alpha
      borderWidth: 0
    };
  }

  // Finally, update the chart to apply new boxes
  temperatureChart.update();
}

function updatePieChart() {
  let drying = 0;
  let browning = 0;
  let development = 0;

  const nowSec = manualMode ? findMaxManualTimeSec() : Math.floor(elapsedTime / 1000);

  if (!dryEndTime && !firstCrackTime && !dropTime) {
    drying = nowSec;
  } else if (dryEndTime && !firstCrackTime && !dropTime) {
    drying = dryEndTime;
    browning = nowSec - dryEndTime;
  } else if (dryEndTime && firstCrackTime && !dropTime) {
    drying = dryEndTime;
    browning = firstCrackTime - dryEndTime;
    development = nowSec - firstCrackTime;
  } else if (dropTime) {
    drying = dryEndTime || 0;
    browning = (firstCrackTime || 0) - (dryEndTime || 0);
    development = dropTime - (firstCrackTime || 0);
  }

  pieChart.data.datasets[0].data = [
    Math.max(drying, 0),
    Math.max(browning, 0),
    Math.max(development, 0)
  ];
  pieChart.update();

  updatePhaseBackground();
  displayTargetDropTimes();
}

function findMaxManualTimeSec() {
  const tbody = document.querySelector("#roastTable tbody");
  let maxSec = 0;
  for (let i = 0; i < tbody.rows.length; i++) {
    const row = tbody.rows[i];
    if (row.cells[0].innerText === "Charge") continue;
    const rSec = parseInt(row.dataset.timeSec, 10) || 0;
    if (rSec > maxSec) maxSec = rSec;
  }
  return maxSec;
}

function computeTargetDropTimes() {
  if (!firstCrackTime) return;
  targetDropPercentages.forEach((p) => {
    const frac = p / 100;
    targetDropTimes[p] = firstCrackTime / (1 - frac);
  });
  displayTargetDropTimes();
}

function displayTargetDropTimes() {
  const dropList = document.getElementById("dropTimesList");
  if (!dropList) return;
  dropList.innerHTML = "";
  targetDropPercentages.forEach((p) => {
    let timeStr = "--:--";
    if (targetDropTimes[p]) {
      timeStr = formatTime(Math.floor(targetDropTimes[p] * 1000));
    }
    dropList.innerHTML += `<li>${p}% → ${timeStr}</li>`;
  });
}

// ========== HELPERS ==========
function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${pad(mm)}:${pad(ss)}`;
}

function formatTimeString(sec) {
  const mm = Math.floor(sec / 60);
  const ss = sec % 60;
  return `${pad(mm)}:${pad(ss)}`;
}

function getCurrentTimeString() {
  const totalSec = Math.floor(elapsedTime / 1000);
  return formatTimeString(totalSec);
}

function convertTimeStringToSeconds(str) {
  if (typeof str !== "string") {
    console.error("convertTimeStringToSeconds called with non-string input:", str);
    return 0;
  }

  const parts = str.split(":").map(Number);
  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) {
    console.error("Invalid time string format:", str);
    return 0;
  }

  const [mm, ss] = parts;
  return mm * 60 + (ss || 0);
}

function pad(num) {
  return num.toString().padStart(2, "0");
}

/** Remove a single data point from chart by x-value */
function removeChartPoint(label, xVal) {
  const ds = temperatureChart.data.datasets.find((d) => d.label === label);
  if (!ds) return;
  const idx = ds.data.findIndex((pt) => pt.x === xVal);
  if (idx !== -1) ds.data.splice(idx, 1);
}

/** Order all datasets within temperatureChart chronologically by x-value, then update graph */
function sortAllDatasets() {
  temperatureChart.data.datasets.forEach((ds) => {
    ds.data.sort((a, b) => a.x - b.x);
  });
  temperatureChart.update();
}

/**
 * pushOrReplacePowerPoint: 
 * Ensures only 1 power value for a given x.
 * If x already exists, replace that point's y value; 
 * otherwise push a new {x, y}.
 */
function pushOrReplacePowerPoint(xVal, powerLevel) {
  // Find existing index
  const existingIndex = powerPoints.findIndex((p) => p.x === xVal);
  const yVal = powerMap[powerLevel];

  if (existingIndex !== -1) {
    // Replace
    powerPoints[existingIndex].y = yVal;
  } else {
    // Insert
    powerPoints.push({ x: xVal, y: yVal });
  }
}

/** Append to note in last row (normal mode) */
function appendNoteToLastRow(timeStr, note) {
  const tbody = document.querySelector("#roastTable tbody");
  if (!tbody || !tbody.rows.length) return;
  let lastIndex = tbody.rows.length - 1;
  while (lastIndex >= 0 && tbody.rows[lastIndex].cells[0].innerText === "Charge") {
    lastIndex--;
  }
  if (lastIndex < 0) return;

  const lastRow = tbody.rows[lastIndex];
  const existing = lastRow.cells[3].innerText.trim();
  lastRow.cells[3].innerText = existing ? `${existing}, ${note}` : note;

  // Rebuild powerPoints after appending a note
  rebuildPowerPoints();
}

function resetDropTimesUI() {
  const dropList = document.getElementById("dropTimesList");
  if (!dropList) return;
  dropList.innerHTML = `
    <li>15% → --:--</li>
    <li>17.5% → --:--</li>
    <li>20% → --:--</li>
    <li>22.5% → --:--</li>
    <li>25% → --:--</li>
  `;
}

function updateChartTitle() {
  const bean = (document.getElementById("beanType")?.value || "").trim() || "No Bean";
  const startW = (document.getElementById("startWeight")?.value || "").trim() || "??";
  let dateVal = (document.getElementById("date")?.value || "").trim() || "No Date";

  const parts = dateVal.split("-");
  if (parts.length === 3) {
    const yyyy = parts[0].slice(-2);
    const mm = parts[1];
    const dd = parts[2];
    dateVal = `${mm}/${dd}/${yyyy}`;
  }

  temperatureChart.options.plugins.title.text = `${bean}, ${startW}g, ${dateVal}`;
  temperatureChart.update();
}

// ========== REBUILD FUNCTIONS ==========
/**
 * Rebuild Power Points from the current table
 */
function rebuildPowerPoints() {
  // 1. Clear powerPoints array; start with P5 at 0:00
  powerPoints = [];
  pushOrReplacePowerPoint(0, "P5");

  // 2. Reset milestones & annotations
  dryEndTime = null;
  firstCrackTime = null;
  dropTime = null;
  // Clear all existing non-ghost recipe annotations
  const annots = temperatureChart.options.plugins.annotation.annotations;
  for (const key in annots) {
    if (!key.startsWith("ghost_")) {
      delete annots[key];
    }
  }

  // 3. Gather all row data into an array
  const tbody = document.querySelector("#roastTable tbody");
  if (!tbody) return;

  let rowData = [];
  for (let i = 0; i < tbody.rows.length; i++) {
    const row = tbody.rows[i];
    // Skip "Charge" row if that's your convention
    if (row.cells[0].innerText === "Charge") continue;

    const tSec = parseInt(row.dataset.timeSec, 10) || 0;
    // Use synthetic note if present, else actual note cell
    const note = row.dataset.syntheticNote || row.cells[3].innerText || "";
    rowData.push({ tSec, note });
  }

  // 4. Sort rowData by ascending time
  rowData.sort((a, b) => a.tSec - b.tSec);

  // 5. Parse each row's note in correct chronological order
  rowData.forEach((item) => {
    // parseAndExecuteNote does all the power changes & milestones
    parseAndExecuteNote(item.note, item.tSec);
  });

  // 6. Sort final powerPoints by x-value & update chart
  powerPoints.sort((a, b) => a.x - b.x);
  updatePowerDataset();
  updatePieChart();  // optional
}

/**
 * Rebuild Annotations based on current milestone notes in the table
 */
function rebuildAnnotations() {
  // Clear all existing non-ghost recipe annotations
  const annots = temperatureChart.options.plugins.annotation.annotations;
  for (const key in annots) {
    if (!key.startsWith("ghost_")) {
      delete annots[key];
    }
  }

  const tbody = document.querySelector("#roastTable tbody");
  if (!tbody) return;

  for (let i = 0; i < tbody.rows.length; i++) {
    const row = tbody.rows[i];
    if (row.cells[0].innerText === "Charge") continue;
    const note = row.cells[3].innerText;
    const tSec = parseInt(row.dataset.timeSec, 10);
    parseAndExecuteNote(note, tSec);
  }

  updatePhaseBackground();
  temperatureChart.update();
}

// ========== MISSING FUNCTIONS ==========

/**
 * Generates a unique Annotation ID based on the event name and time in seconds.
 * @param {string} name - The name of the milestone event.
 * @param {number} noteSec - The time in seconds when the event occurs.
 * @returns {string} - A unique annotation ID.
 */
function makeAnnID(name, noteSec) {
  // Replace spaces with underscores and concatenate with timeSec
  return `${name.replace(/\s+/g, "_")}_${noteSec}`;
}

/**
 * Ensures that the powerPoints array covers up to the current elapsed time.
 * Adds a power point at the current time if necessary.
 */
function ensurePowerPointAtCurrentTime() {
  const currentTimeMin = elapsedTime / 60000;
  const lastPowerPoint = powerPoints[powerPoints.length - 1];

  // Add a power point at the current time if the last power point is before the current time
  if (lastPowerPoint.x < currentTimeMin) {
    pushOrReplacePowerPoint(currentTimeMin, currentPower);
    updatePowerDataset();
  }
}

/**
 * Updates the Power Level dataset on the Temperature chart.
 * This function ensures that the Power Level line reflects all power changes accurately.
 */
function updatePowerDataset() {
  const powerDataset = temperatureChart.data.datasets.find(
    (ds) => ds.label === "Power Level"
  );
  if (!powerDataset) return;

  // 1) Optionally add a trailing point if we want the line to extend to current time
  const manualLastSec = findMaxManualTimeSec();
  const currentTimeMin = manualMode
    ? manualLastSec / 60
    : elapsedTime / 60000;
  const lastPoint = powerPoints[powerPoints.length - 1];
  if (!lastPoint || lastPoint.x < currentTimeMin) {
    pushOrReplacePowerPoint(currentTimeMin, currentPower);
  }

  // 2) **Remove** the "consolidation" logic.
  //    Instead, just sort and keep all points (including duplicates at same x).
  powerPoints.sort((a, b) => a.x - b.x);

  // 3) Assign powerPoints directly to the "Power Level" dataset
  powerDataset.data = powerPoints.map((p) => ({ x: p.x, y: p.y }));

  // 4) Determine currentPower based on the point nearest the current time
  const relevantPowerPoints = powerPoints.filter((p) => p.x <= currentTimeMin);
  if (relevantPowerPoints.length > 0) {
    const latestPowerPoint =
      relevantPowerPoints[relevantPowerPoints.length - 1];
    currentPower = getPowerLevelFromValue(latestPowerPoint.y);
  } else {
    currentPower = "P5";
  }

  // 5) Update the chart
  temperatureChart.update();
}

/**
 * Helper function to get power level string from y-value.
 * @param {number} y - The y-value representing power level.
 * @returns {string} - The corresponding power level (P1-P5).
 */
function getPowerLevelFromValue(y) {
  for (const [key, value] of Object.entries(powerMap)) {
    if (value === y) return key;
  }
  return "P5"; // default
}

/**
 * Parses power change notes.
 * @param {string} note - The note string.
 * @returns {object|null} - Returns an object with powerLevel and timeMin if matched, else null.
 */
function parsePowerChange(note) {
  const powerMatch = note.match(/\b(P[1-5])\b\s*(?:at\s*)?(\d{1,2}:\d{2})/i);
  if (powerMatch) {
    const powerLevel = powerMatch[1].toUpperCase();
    const timeStr = powerMatch[2];
    const timeSec = convertTimeStringToSeconds(timeStr);
    const timeMin = timeSec / 60;
    return { powerLevel, timeMin };
  }
  return null;
}

/**
 * Parses milestone notes.
 * @param {string} note - The note string.
 * @returns {object} - Returns an object with possible milestone times.
 */
function parseMilestones(note) {
  const milestones = {};

  const dryEndMatch = note.match(/dry\s?end\s+(\d{1,2}:\d{2})/i);
  const firstCrackMatch = note.match(/first\s?crack\s+(\d{1,2}:\d{2})/i);
  const dropMatch = note.match(/drop\s+(\d{1,2}:\d{2})/i);

  if (dryEndMatch) {
    milestones.dryEnd = convertTimeStringToSeconds(dryEndMatch[1]);
  }

  if (firstCrackMatch) {
    milestones.firstCrack = convertTimeStringToSeconds(firstCrackMatch[1]);
  }

  if (dropMatch) {
    milestones.drop = convertTimeStringToSeconds(dropMatch[1]);
  }

  return milestones;
}


//ADDED SAVE/LOAD FEATURES
// Function to send a password reset email
function sendPasswordReset() {
  const email = prompt("Please enter your email address for password reset:");
  if (!email) {
    alert("Email is required for password reset.");
    return;
  }
  
  firebase.auth().sendPasswordResetEmail(email)
    .then(() => {
      alert("Password reset email sent. Please check your inbox.");
    })
    .catch((error) => {
      alert("Error: " + error.message);
    });
}

function showSavePopup() {
  // Pre-fill the roast name with: BeanType + StartWeight + date + time
  const bean = (document.getElementById("beanType")?.value || "").trim() || "UnknownBean";
  const startW = (document.getElementById("startWeight")?.value || "").trim() || "??g";

  // The date field might be "yyyy-mm-dd", convert to "m/d/yy"
  let dateVal = (document.getElementById("date")?.value || "").trim() || "";
  let dateStr = "NoDate";
  if (dateVal) {
    const parts = dateVal.split("-");
    if (parts.length === 3) {
      const yyyy = parts[0].slice(-2);
      const mm = parts[1];
      const dd = parts[2];
      dateStr = `${mm}/${dd}/${yyyy}`;
    }
  }

  // 24-hour format time HH:MM
  const now = new Date();
  const hh = now.getHours().toString().padStart(2, "0");
  const min = now.getMinutes().toString().padStart(2, "0");
  const timeStr = `${hh}:${min}`;

  const defaultName = `${bean} ${startW}g ${dateStr} ${timeStr}`;

  document.getElementById("saveRoastName").value = defaultName;
  document.getElementById("saveStatus").innerText = "";

  document.getElementById("savePopup").style.display = "flex";
}

function hideSavePopup() {
  document.getElementById("savePopup").style.display = "none";
}

async function doSaveRoast() {
  docId = document.getElementById("saveRoastName").value.trim();
  const statusEl = document.getElementById("saveStatus");

  if (!docId) {
    statusEl.innerText = "Roast name cannot be empty.";
    statusEl.style.color = "red";
    return;
  }

  // Gather data from the DOM
  const beanType = document.getElementById("beanType").value.trim();
  const startWeight = document.getElementById("startWeight").value.trim();
  const endWeight = document.getElementById("endWeight").value.trim();
  const dateValue = document.getElementById("date").value.trim();
  const chargeTemp = document.getElementById("chargeTemp").value.trim();
  const userNotes = document.getElementById("manualNotesArea").value.trim();
  const user = firebase.auth().currentUser;

  // Gather table data
  const tableRows = [];
  const tbody = document.querySelector("#roastTable tbody");
  if (tbody) {
    for (let i = 0; i < tbody.rows.length; i++) {
      const row = tbody.rows[i];

      // If manual mode and this is the last row, check if we should skip it
      if (manualMode && i === (tbody.rows.length - 1)) {
        // Grab B and A cells
        const bValRaw = row.cells[1].innerText.trim();
        const aValRaw = row.cells[2].innerText.trim();

        // See if both are blank or invalid
        const bNum = parseFloat(bValRaw);
        const aNum = parseFloat(aValRaw);

        // If neither B nor A is a valid temperature, skip this row
        if (!bValRaw && !aValRaw) {
          continue; // Do not push this row
        }
      }

      // Otherwise, proceed as normal
      const timeCell = row.cells[0].innerText;
      const sensorBCell = row.cells[1].innerText;
      const sensorACell = row.cells[2].innerText;
      const notesCell = row.cells[3]?.innerText || "";

      tableRows.push({
        time: timeCell,
        sensorB: sensorBCell,
        sensorA: sensorACell,
        notes: notesCell,
        datasetTimeSec: parseInt(row.dataset.timeSec || 0, 10)
      });
    }
  }

  let finalSec = dropTime;
  pushOrReplacePowerPoint(finalSec / 60, currentPower);
  const finalPower = currentPower;

  const roastData = {
    beanType,
    startWeight,
    endWeight,
    dateValue,
    chargeTemp,
    tableRows,
    userNotes,
    finalTimeSec: finalSec,
    finalPower: finalPower,
    uid: user.uid,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    // Instead of "01/12/25 16:35", change to "01-12-25 16:35"
    const cleanedName = docId.replace(/\//g, "-");
    await db.collection("roasts").doc(cleanedName).set(roastData);
    statusEl.style.color = "green";
    statusEl.innerText = "Saved successfully!";
  } catch (err) {
    console.error("Save error:", err);
    statusEl.style.color = "red";
    statusEl.innerText = "Save failed.";
  }
}

async function showLoadPopup() {
  // Clear any previous status message and show the load popup
  document.getElementById("loadStatus").innerText = "";
  document.getElementById("loadPopup").style.display = "flex";

  // Clear the global roast array and reset the selected document ID
  roastsArray = [];
  selectedRoastDocId = "";

  try {
    const currentUser = firebase.auth().currentUser;
    if (currentUser) {
      // Use await to get the query snapshot
      const snapshot = await db.collection("roasts")
        .where("uid", "==", currentUser.uid)
        .orderBy("timestamp", "desc")
        .get();
      snapshot.forEach(doc => {
        const data = doc.data();
        roastsArray.push({
          docId: doc.id,
          beanType: data.beanType || "",
          startWeight: data.startWeight || "",
          dateValue: data.dateValue || "", // e.g., "2025-01-12"
          roastTime: parseTimeFromDocId(doc.id), // helper function you already have
        });
      });

      // Render the table after the dummy roasts have been pushed into roastsArray
      renderRoastListTable(roastsArray);
    }
  } catch (err) {
    console.error("Error loading roasts:", err);
    document.getElementById("loadStatus").innerText = "Failed to load roasts.";
  }
}

function parseTimeFromDocId(docId) {
  // If docId = "Colombia 454g 01-12-25 16:35"
  // we can try to match the last "HH:MM"
  const match = docId.match(/\b\d{1,2}:\d{2}\b/);
  return match ? match[0] : "";
}

function renderRoastListTable(roasts) {
  const tbody = document.querySelector("#roastListTable tbody");
  if (!tbody) return;
  tbody.innerHTML = ""; // clear old rows

  const roastCountSpan = document.getElementById("roastCountSpan");
  if (roastCountSpan) {
    roastCountSpan.innerText = `${roasts.length} roasts found`;
  }

  roasts.forEach(roast => {
    const { docId, beanType, startWeight, dateValue, roastTime } = roast;

    const tr = document.createElement("tr");

    // 1) Date
    const dateTd = document.createElement("td");
    dateTd.innerText = formatDateMMDDYY(roast.dateValue);
    tr.appendChild(dateTd);

    // 2) Time
    const tdTime = document.createElement("td");
    tdTime.innerText = roastTime; // or parse from dateValue if you stored it
    tr.appendChild(tdTime);

    // 3) Bean Type
    const tdBean = document.createElement("td");
    tdBean.innerText = beanType;
    tr.appendChild(tdBean);

    // 4) Start Weight
    const tdWeight = document.createElement("td");
    tdWeight.innerText = startWeight;
    tr.appendChild(tdWeight);

    // Row click to select
    tr.addEventListener("click", () => {
      // Un-highlight any existing selection
      document.querySelectorAll("#roastListTable tbody tr").forEach(rowEl => {
        rowEl.classList.remove("selected-row");
      });
      // Highlight this row
      tr.classList.add("selected-row");
      // Remember which doc is selected
      selectedRoastDocId = docId;
      previewRoast(docId);
    });

    tbody.appendChild(tr);
  });

  async function previewRoast(docId) {
    // 1) Safety checks
    if (!docId) return console.warn("No docId provided for previewRoast.");
    if (!previewChart || !previewPie) {
      console.warn("previewChart or previewPie not initialized globally.");
      return;
    }

    // 2) Fetch the Firestore doc
    try {
      const docRef = db.collection("roasts").doc(docId);
      const docSnap = await docRef.get();
      if (!docSnap.exists) {
        clearPreview(); // Optional: define a helper to blank out preview UI
        return;
      }
      const data = docSnap.data() || {};

      // 3) Reset the previewChart fully (clear old data, old annotations, etc.)
      //    We'll set up 3 datasets: Sensor B, Sensor A, Power Level
      previewChart.data.datasets = [
        {
          label: "Sensor B",
          borderColor: "blue",
          yAxisID: "yTemp",
          fill: false,
          pointRadius: 0,
          data: []
        },
        {
          label: "Sensor A",
          borderColor: "green",
          yAxisID: "yTemp",
          fill: false,
          pointRadius: 0,
          data: []
        },
        {
          label: "Power Level",
          borderColor: "red",
          yAxisID: "yPower",
          fill: false,
          stepped: true,
          pointRadius: 0,
          data: []
        }
      ];
      previewChart.options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: "",
            color: "black",
            font: {
              size: 12,
              weight: "bold"
            }
          },
          annotation: {
            annotations: {}
          },
          datalabels: false
        },
        scales: {
          x: {
            title: { display: true, text: "Time (min)" },
            type: "linear",
            position: "bottom",
            min: 0,
            ticks: {
              stepSize: 0.5,
              callback: (val) => (val % 1 === 0 ? val : "")
            }
          },
          yTemp: {
            title: { display: true, text: "Temperature (°F)" },
            position: "left",
            min: 95,
            max: 360,
            ticks: {
              callback: (val) => Math.round(val)
            }
          },
          yPower: {
            title: { display: true, text: "Power Level" },
            position: "right",
            min: 0,
            max: 100,
            grid: { drawOnChartArea: false },
            ticks: {
              stepSize: 25,
              callback: (val) => {
                switch (val) {
                  case 100:
                    return "P5";
                  case 75:
                    return "P4";
                  case 50:
                    return "P3";
                  case 25:
                    return "P2";
                  case 0:
                    return "P1";
                  default:
                    return "";
                }
              }
            }
          }
        },
        // Add or modify the animation settings here
        animation: {
          duration: 0, // Disables animations
          easing: "linear" // Optional: makes updates smoother if animations are enabled
        }
      }
      previewChart.options.plugins.annotation.annotations = {}; // clear old annotations

      // 4) We'll track sensor data, power points, milestone times, etc.
      let previewPowerPoints = [];
      let previewDryEndSec = null;
      let previewFirstCrackSec = null;
      let previewDropSec = null;

      // 4a) Always ensure we start at P5, x=0
      // We'll insert it now, and if any note actually changes the 0:00 point,
      // we can overwrite it later in the loop.
      previewPowerPoints.push({ x: 0, y: powerMap["P5"] }); // i.e. {x:0, y:100}

      // 5) Parse each tableRow for sensor values & notes
      //    (We mimic your main script's approach)
      (data.tableRows || []).forEach(row => {
        const tSec = row.datasetTimeSec || 0;
        const bVal = parseFloat(row.sensorB) || 0;
        const aVal = parseFloat(row.sensorA) || 0;

        // Add sensor B / A to dataset
        previewChart.data.datasets[0].data.push({ x: tSec / 60, y: bVal });
        previewChart.data.datasets[1].data.push({ x: tSec / 60, y: aVal });

        // Then parse the row's notes for power changes or milestones
        if (row.notes) {
          // minimal parse for power/milestone
          parsePreviewNotes(row.notes, tSec);
        }

        function parsePreviewNotes(notesStr, defaultSec) {
          const segments = notesStr.split(",").map(s => s.trim());
          segments.forEach(seg => {
            const timeMatch = seg.match(/\b\d{1,2}:\d{2}\b/);
            let noteSec = defaultSec;
            if (timeMatch) {
              noteSec = convertTimeStringToSeconds(timeMatch[0]);
            }

            // Check for power
            const powerMatch = seg.match(/\bP[1-5]\b/i);
            if (powerMatch) {
              const powerLevel = powerMatch[0].toUpperCase(); // e.g. "P4"
              const xVal = noteSec / 60;
              const yVal = powerMap[powerLevel];
              previewPowerPoints.push({ x: xVal, y: yVal });
            }

            // Check for milestones
            if (/dry\s?end/i.test(seg)) {
              previewDryEndSec = noteSec;
            }
            if (/first\s?crack/i.test(seg)) {
              previewFirstCrackSec = noteSec;
            }
            if (/drop/i.test(seg)) {
              previewDropSec = noteSec;
            }
          });
        }
      });

      // 5a) If we have a finalTimeSec and finalPower from Firestore,
      //     ensure the power line extends that far in time.
      //     e.g., if finalTimeSec=540 (9 min) and finalPower="P3"
      if (data.finalTimeSec !== undefined && data.finalPower) {
        const xVal = data.finalTimeSec / 60;
        const yVal = powerMap[data.finalPower] || 100; // default to P5 if missing
        previewPowerPoints.push({ x: xVal, y: yVal });
      }

      // 6) Sort them by x so the stepped line is in order
      previewPowerPoints.sort((a, b) => a.x - b.x);
      previewChart.data.datasets[2].data = previewPowerPoints;

      // 7) Add milestone lines as annotation lines for Dry/First/Drop
      function addPreviewMilestoneLine(id, sec, labelText) {
        const xVal = sec / 60;
        previewChart.options.plugins.annotation.annotations[id] = {
          type: "line",
          xMin: xVal,
          xMax: xVal,
          borderColor: "gray",
          borderWidth: 2,
          borderDash: [5, 5],
          label: {
            display: false,
            content: labelText,
            position: "start",
            xAdjust: -30,
            backgroundColor: "rgba(0,0,0,0.7)",
            color: "white",
            font: { size: 10 },
            yAdjust: -20
          }
        };
      }
      if (previewDryEndSec !== null) {
        addPreviewMilestoneLine("previewDry", previewDryEndSec, "Dry End");
      }
      if (previewFirstCrackSec !== null) {
        addPreviewMilestoneLine("previewFirst", previewFirstCrackSec, "First Crack");
      }
      if (previewDropSec !== null) {
        addPreviewMilestoneLine("previewDrop", previewDropSec, "Drop");
      }

      // 8) Add background shading for the phases if you like
      //    We'll do a minimal approach similar to updatePhaseBackground
      //    Note that we do not forcibly remove old boxes because we 
      //    reset annotation objects above.
      previewChart.options.plugins.annotation.annotations["previewDryPhase"] = {
        type: "box",
        xMin: 0,
        xMax: previewDryEndSec ? (previewDryEndSec / 60) : null,
        yMin: 0,
        yMax: "100%",
        backgroundColor: "rgba(255,224,128,0.3)",
        borderWidth: 0
      };
      if (previewDryEndSec && previewFirstCrackSec) {
        previewChart.options.plugins.annotation.annotations["previewBrowning"] = {
          type: "box",
          xMin: previewDryEndSec / 60,
          xMax: previewFirstCrackSec / 60,
          yMin: 0,
          yMax: "100%",
          backgroundColor: "rgba(255,176,96,0.3)",
          borderWidth: 0
        };
      }
      if (previewFirstCrackSec && previewDropSec) {
        previewChart.options.plugins.annotation.annotations["previewDevelopment"] = {
          type: "box",
          xMin: previewFirstCrackSec / 60,
          xMax: previewDropSec / 60,
          yMin: 0,
          yMax: "100%",
          backgroundColor: "rgba(255,128,96,0.3)",
          borderWidth: 0
        };
      }

      // 9) Finally update the previewChart
      previewChart.update();

      // 10) For the mini pie, replicate the logic for dryness/browning/dev times
      //     We'll just compute from the previewDryEndSec, previewFirstCrackSec, and previewDropSec
      let dryingTime = 0, browningTime = 0, devTime = 0;
      // if none set, entire roast is "drying"
      const roastEndSec = previewDropSec || 0; // fallback
      const nowSec = getMaxSecFromRows(data.tableRows); // or just previewDropSec

      const currentSec = nowSec || 0; // fallback if no drop

      if (!previewDryEndSec && !previewFirstCrackSec && !previewDropSec) {
        dryingTime = currentSec;
      } else if (previewDryEndSec && !previewFirstCrackSec && !previewDropSec) {
        dryingTime = previewDryEndSec;
        browningTime = Math.max(0, currentSec - previewDryEndSec);
      } else if (previewDryEndSec && previewFirstCrackSec && !previewDropSec) {
        dryingTime = previewDryEndSec;
        browningTime = previewFirstCrackSec - previewDryEndSec;
        devTime = Math.max(0, currentSec - previewFirstCrackSec);
      } else if (previewDropSec) {
        dryingTime = previewDryEndSec || 0;
        browningTime = (previewFirstCrackSec || 0) - (previewDryEndSec || 0);
        devTime = previewDropSec - (previewFirstCrackSec || 0);
      }

      // Update the previewPie
      previewPie.data.datasets[0].data = [
        Math.max(dryingTime, 0),
        Math.max(browningTime, 0),
        Math.max(devTime, 0)
      ];
      previewPie.update();

      // 11) Fill in some text stats
      document.getElementById("previewBean").innerText = data.beanType || "";
      document.getElementById("previewStart").innerText = data.startWeight || "";
      document.getElementById("previewDate").innerText = formatDateMMDDYY(data.dateValue || "");
      document.getElementById("previewRoastTime").innerText =
        data.finalTimeSec
          ? formatTimeString(Math.floor(data.finalTimeSec))
          : formatTimeString(getMaxSecFromRows(data.tableRows));

    } catch (err) {
      console.error("previewRoast error:", err);
      clearPreview(); // or show an error message
    }

    //--- HELPER inline or from your script
    function convertTimeStringToSeconds(str) {
      // e.g. "2:30" => 150
      const [m, s] = str.split(":").map(Number);
      return (m || 0) * 60 + (s || 0);
    }
    function formatTimeString(sec) {
      const mm = Math.floor(sec / 60);
      const ss = sec % 60;
      return String(mm).padStart(2, "0") + ":" + String(ss).padStart(2, "0");
    }
    function formatDateMMDDYY(yyyy_mm_dd) {
      // e.g. "2025-01-12" => "01/12/25"
      if (!yyyy_mm_dd) return "";
      const parts = yyyy_mm_dd.split("-");
      if (parts.length !== 3) return yyyy_mm_dd;
      const yy = parts[0].slice(-2);
      return `${parts[1]}/${parts[2]}/${yy}`;
    }
    function getMaxSecFromRows(rows) {
      let max = 0;
      if (!Array.isArray(rows)) return max;
      rows.forEach(r => {
        const s = r.datasetTimeSec || 0;
        if (s > max) max = s;
      });
      return max;
    }
    function clearPreview() {
      // optionally blank the preview text, reset charts, etc.
      if (previewChart) {
        previewChart.data.datasets.forEach(ds => ds.data = []);
        previewChart.options.plugins.annotation.annotations = {};
        previewChart.update();
      }
      if (previewPie) {
        previewPie.data.datasets[0].data = [0, 0, 0];
        previewPie.update();
      }
      document.getElementById("previewBean").innerText = "";
      document.getElementById("previewStart").innerText = "";
      document.getElementById("previewDate").innerText = "";
      document.getElementById("previewRoastTime").innerText = "";
    }
  }
}

function formatDateMMDDYY(yyyy_mm_dd) {
  // e.g. "2025-01-12" => "01/12/25"
  if (!yyyy_mm_dd) return "";
  const parts = yyyy_mm_dd.split("-");
  if (parts.length !== 3) return yyyy_mm_dd; // fallback if invalid
  let [yyyy, mm, dd] = parts;
  const yy = yyyy.slice(-2); // last two digits
  return `${mm}/${dd}/${yy}`;
}

function hideLoadPopup() {
  // Uncheck the "Use as Recipe" checkbox every time the load button is clicked
  document.getElementById("useAsRecipeCheckbox").checked = false;
  document.getElementById("loadPopup").style.display = "none";
}

async function handleLoadSelection() {
  try {
    const useAsRecipe = document.getElementById("useAsRecipeCheckbox").checked;
    if (!selectedRoastDocId) {
      document.getElementById("loadStatus").innerText = "Please select a roast row first.";
      return;
    }

    const docRef = db.collection("roasts").doc(selectedRoastDocId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      document.getElementById("loadStatus").innerText = "Roast not found in DB.";
      return;
    }

    hideLoadPopup();

    if (useAsRecipe) {
      // 1) Start a new roast, but overlay the selected doc as ghost data
      loadAsRecipe(docSnap.data());
    } else {
      // 2) Normal "overwrite" load
      doNormalLoad(docSnap.data());
    }

  } catch (err) {
    console.error("Load error:", err);
    document.getElementById("loadStatus").innerText = "Failed to load roast data.";
  }
}

async function deleteSelectedRoast() {
  // Make sure a roast is selected
  if (!selectedRoastDocId) {
    alert("Please select a roast to delete.");
    return;
  }

  // Confirm deletion with the user
  if (!confirm("Are you sure you want to delete this roast? This cannot be undone.")) {
    return;
  }

  try {
    // Delete the roast document from Firestore
    await db.collection("roasts").doc(selectedRoastDocId).delete();

    // Optionally, refresh your roast list
    roastsArray = roastsArray.filter(roast => roast.docId !== selectedRoastDocId);
    renderRoastListTable(roastsArray);

    // Clear preview and selection if needed
    clearPreview();
    selectedRoastDocId = "";
  } catch (error) {
    console.error("Error deleting roast: ", error);
    alert("Failed to delete roast. Please try again.");
  }
}

function clearPreview() {
  // Clear the preview chart's datasets and annotations
  if (previewChart) {
    previewChart.data.datasets.forEach((ds) => {
      ds.data = [];
    });
    // Clear all annotations if they exist
    if (previewChart.options.plugins.annotation) {
      previewChart.options.plugins.annotation.annotations = {};
    }
    previewChart.update();
  }

  // Clear the preview pie chart data
  if (previewPie) {
    previewPie.data.datasets.forEach((ds) => {
      ds.data = [0, 0, 0];
    });
    previewPie.update();
  }

  // Clear any preview text fields
  const previewBean = document.getElementById("previewBean");
  if (previewBean) previewBean.innerText = "";
  const previewStart = document.getElementById("previewStart");
  if (previewStart) previewStart.innerText = "";
  const previewDate = document.getElementById("previewDate");
  if (previewDate) previewDate.innerText = "";
  const previewRoastTime = document.getElementById("previewRoastTime");
  if (previewRoastTime) previewRoastTime.innerText = "";
}

function doNormalLoad(data) {
  // Clear current UI
  resetRoastAll();

  // Populate fields
  document.getElementById("beanType").value = data.beanType || "";
  document.getElementById("startWeight").value = data.startWeight || "";
  document.getElementById("endWeight").value = data.endWeight || "";
  document.getElementById("date").value = data.dateValue || "";
  document.getElementById("chargeTemp").value = data.chargeTemp || "";

  // Re-create table rows
  const tbody = document.querySelector("#roastTable tbody");
  if (tbody) {
    tbody.innerHTML = "";

    (data.tableRows || []).forEach(rowObj => {
      const newRow = tbody.insertRow(tbody.rows.length);
      newRow.dataset.timeSec = rowObj.datasetTimeSec || 0;
      newRow.dataset.oldNote = rowObj.notes || "";

      // The table has 4 columns: time, B, A, notes
      newRow.insertCell(0).innerText = rowObj.time;
      newRow.insertCell(1).innerText = rowObj.sensorB;
      newRow.insertCell(2).innerText = rowObj.sensorA;
      newRow.insertCell(3).innerText = rowObj.notes;

      // INSERT temperatures into chart
      const timeSec = rowObj.datasetTimeSec || 0;
      const bVal = parseFloat(rowObj.sensorB) || 0;
      const aVal = parseFloat(rowObj.sensorA) || 0;
      addOrReplaceChartData(timeSec, bVal, aVal);
    });
  }

  // Finally, call your existing rebuild logic
  // This will parse notes, restore milestones, power, etc.
  rebuildPowerPoints();
  rebuildAnnotations();
  // If the doc has a finalTimeSec and finalPower, add that point behind the scenes
  if (data.finalTimeSec !== undefined && data.finalPower !== undefined) {
    pushOrReplacePowerPoint(data.finalTimeSec / 60, data.finalPower);
    updatePowerDataset();     // re-render power line
    temperatureChart.update();
  }
  updatePieChart();
  updateChartTitle();

  refreshNotesSection();
  document.getElementById("manualNotesArea").value = data.userNotes || "";

  // Display that final time on the timer
  document.getElementById("timer").innerText = formatTimeString(dropTime);
}

function loadAsRecipe(roastData) {
  // Clear out current roast UI:
  resetRoastAll();            // Clears table, chart, etc.
  manualMode = false;         // Ensure normal mode

  // Overlay the ghost data onto the chart
  overlayGhostData(roastData);

  // Show the ghost’s notes in a read-only section
  overlayGhostNotes(roastData);

  // Build the side-by-side table
  //createGhostComparisonTable(roastData);
}

function overlayGhostData(roastData) {
  // Populate fields
  document.getElementById("beanType").value = roastData.beanType || "";
  document.getElementById("startWeight").value = roastData.startWeight || "";
  
  const bean = (document.getElementById("beanType")?.value || "").trim() || "No Bean";
  const startW = (document.getElementById("startWeight")?.value || "").trim() || "??";
  let dateVal = roastData.dateValue;

  const parts = dateVal.split("-");
  if (parts.length === 3) {
    const yyyy = parts[0].slice(-2);
    const mm = parts[1];
    const dd = parts[2];
    dateVal = `${mm}/${dd}/${yyyy}`;
  }

  temperatureChart.options.plugins.title.text = `${bean}, ${startW}g, ${dateVal}`;
  temperatureChart.update();

  // We'll add 3 new datasets: “Recipe B”, “Recipe A”, “Recipe Power”

  const ghostB = {
    label: "Recipe B",
    data: [],
    borderColor: "rgba(0,0,255,0.4)", // translucent blue
    fill: false,
    pointRadius: 3,
    yAxisID: "yTemp",
    borderDash: [4, 2] // dashed line for clarity
  };

  const ghostA = {
    label: "Recipe A",
    data: [],
    borderColor: "rgba(0,128,0,0.4)", // translucent green
    fill: false,
    pointRadius: 3,
    yAxisID: "yTemp",
    borderDash: [4, 2]
  };

  const ghostPower = {
    label: "Recipe Power",
    data: [],
    borderColor: "rgba(255,0,0,0.4)", // translucent red
    fill: false,
    stepped: true,
    pointRadius: 0,
    yAxisID: "yPower",
    borderDash: [4, 2]
  };

  // 1) Add them to the chart’s datasets
  temperatureChart.data.datasets.push(ghostB, ghostA, ghostPower);

  // 2) Fill them from roastData.tableRows
  ghostPower.data.push({ x: 0, y: powerMap["P5"] });

  // Helper to parse a time string like "1:20" → total seconds
  function timeStringToSec(str) {
    const parts = str.split(":").map(Number);
    if (parts.length !== 2) return 0;
    return (parts[0] * 60) + (parts[1] || 0);
  }

  // For each row, add B/A data, parse power changes if found
  (roastData.tableRows || []).forEach(row => {
    const tSec = row.datasetTimeSec || 0;
    const bVal = parseFloat(row.sensorB) || 0;
    const aVal = parseFloat(row.sensorA) || 0;

    ghostB.data.push({ x: tSec / 60, y: bVal });
    ghostA.data.push({ x: tSec / 60, y: aVal });

    // If the notes contain "P4 1:20" or "p3" or "P5 5:00", parse it:
    const note = row.notes || "";
    const powerRegex = /\b(P[1-5])\s+(\d{1,2}:\d{2})/gi;
    // e.g. "P4 1:20" => group1="P4" group2="1:20"
    let match;
    while ((match = powerRegex.exec(note)) !== null) {
      const powerLevel = match[1].toUpperCase();  // e.g. "P4"
      const timeStr = match[2];                  // e.g. "1:20"
      const sec = timeStringToSec(timeStr);
      const xVal = sec / 60;
      ghostPower.data.push({ x: xVal, y: powerMap[powerLevel] });
    }

    // Also check for lines like "P3" with no time => use tSec
    // if you want to handle that scenario:
    const shortPowerRegex = /\bP[1-5]\b(?!\s*\d)/i; 
    const shortMatch = note.match(shortPowerRegex);
    if (shortMatch) {
      // e.g. "P2" with no explicit time, we treat it as row time
      const level = shortMatch[0].toUpperCase();
      ghostPower.data.push({ x: tSec / 60, y: powerMap[level] });
    }
  });

  // If the doc has a finalTimeSec and finalPower, add it to ghostPower
  if (roastData.finalTimeSec !== undefined && roastData.finalPower !== undefined) {
    const xVal = roastData.finalTimeSec / 60;
    const powerLevel = roastData.finalPower; // e.g. "P3"
    const yVal = powerMap[powerLevel];       // convert "P3" -> 50, etc.

    ghostPower.data.push({ x: xVal, y: yVal });
  }

  // Sort them by x:
  ghostB.data.sort((a,b)=> a.x - b.x);
  ghostA.data.sort((a,b)=> a.x - b.x);
  ghostPower.data.sort((a,b)=> a.x - b.x);

  // 3) Add ghost milestone lines
  overlayGhostMilestones(roastData);

  // 4) Finally, update the chart
  temperatureChart.update();
}

function overlayGhostMilestones(roastData) {
  // Ensure an annotations object exists on the chart
  if (!temperatureChart.options.plugins.annotation.annotations) {
    temperatureChart.options.plugins.annotation.annotations = {};
  }

  // Helper to parse "mm:ss" => total seconds
  function parseTimeStringToSec(str) {
    const parts = str.split(":").map(Number);
    if (parts.length !== 2) return 0;
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  }

  /*
    Regex Explanation:
      (dry\s?end|first\s?crack|drop)
        - captures either "dry end", "first crack", or "drop" (case-insensitive)
      (?:\s+(\d{1,2}:\d{2}))?
        - optionally matches a space and a time like "1:23"
        - the second capturing group (match[2]) will be undefined if not found
        - the entire group is optional (?), so a note with no time still matches.
  */
  const milestoneRegex = /(dry\s?end|first\s?crack|drop)(?:\s+(\d{1,2}:\d{2}))?/gi;

  // Loop through each row in the loaded roast
  (roastData.tableRows || []).forEach(row => {
    const noteText = row.notes || "";
    const tSec = row.datasetTimeSec || 0;

    // We'll default to the row's time in seconds if no time is found in the note.
    let match;
    while ((match = milestoneRegex.exec(noteText)) !== null) {
      const milestoneRaw = match[1].toLowerCase(); // "dry end", "first crack", or "drop"
      const timeStr = match[2];                    // e.g. "4:30" or undefined if missing

      // If no explicit time was found, use this row’s time
      let sec = tSec;
      if (timeStr) {
        sec = parseTimeStringToSec(timeStr);
      }

      // Turn seconds -> x-value (in minutes)
      const xVal = sec / 60;

      // Create a label
      let label;
      if (milestoneRaw.includes("dry")) {
        label = "Recipe Dry End";
      } else if (milestoneRaw.includes("first")) {
        label = "Recipe First Crack";
      } else if (milestoneRaw.includes("drop")) {
        label = "Recipe Drop";
      }

      // Unique ID so multiple lines don’t collide
      const annId = `ghost_${milestoneRaw.replace(/\s+/g, "_")}_${sec}`;

      // Add a dashed vertical line
      temperatureChart.options.plugins.annotation.annotations[annId] = {
        type: "line",
        xMin: xVal,
        xMax: xVal,
        borderColor: "rgba(0,0,0,0.3)",
        borderDash: [5, 5],
        borderWidth: 2,
        label: {
          display: true,
          content: label,
          color: "#333",
          backgroundColor: "rgba(255,255,255,0.5)",
          position: "start",
          yAdjust: -20
        }
      };
    }
  });

  // Finally update the chart
  temperatureChart.update();
}

function overlayGhostNotes(roastData) {
  // 1) If you have a function that updates the "auto notes" from the table,
  //    you can push the ghost's tableRows into a temporary structure,
  //    then render them in read-only fashion.

  // For example, let's say you have a special UL for recipe notes:
  const autoNotesList = document.getElementById("autoNotesList");
  if (!autoNotesList) return;

  // Clear if old recipe notes exist
  autoNotesList.innerHTML = "";

  // We'll append a small header, then the ghost’s table notes
  const headerLi = document.createElement("li");
  headerLi.textContent = "=== RECIPE NOTES ===";
  headerLi.style.fontWeight = "bold";
  headerLi.style.listStyle = "none";
  autoNotesList.appendChild(headerLi);

  // Add recipe stats
  const rLi = document.createElement("li");
  rLi.textContent =
    `${roastData.beanType || "??"} ${formatDateMMDDYY(roastData.dateValue) || "??"}`;
  rLi.style.color = "#555";
  autoNotesList.appendChild(rLi);

  // 3) Compute and add phase percentages (e.g., "50/30/20%")
  const phasePct = computePhasePercentages(roastData);
  const wLi = document.createElement("li");
  wLi.textContent =
    `Start/End Weight: ${roastData.startWeight || "??"}/${roastData.endWeight || "??"} g, 
    Charge: ${roastData.chargeTemp || "??"} °F, ${phasePct}`;
  wLi.style.color = "#555";
  autoNotesList.appendChild(wLi);

  // Add each table note as a read-only <li>
  (roastData.tableRows || []).forEach(row => {
    if (!row.notes) return;
    const li = document.createElement("li");
    li.textContent = `${row.time} — ${row.notes}`;
    li.style.color = "#555"; // grey-ish
    autoNotesList.appendChild(li);
  });

  // 2) Also append the user's typed notes from that roast, if you stored them
  if (roastData.userNotes) {
    const userLi = document.createElement("li");
    userLi.textContent = `User Notes: ${roastData.userNotes}`;
    userLi.style.color = "#777";
    userLi.style.fontStyle = "italic";
    autoNotesList.appendChild(userLi);
  }

  // 3) Insert a boundary so you know where to start the new roast notes
  const boundaryLi = document.createElement("li");
  boundaryLi.id = "recipeBoundary";
  boundaryLi.style.listStyleType = "none";
  boundaryLi.style.borderBottom = "1px solid #000";
  boundaryLi.style.margin = "4px 0";
  autoNotesList.appendChild(boundaryLi);

  // Now the user can see the loaded roast’s notes, but cannot edit them
  // because they're just plain text in a read-only UL.
}

/**
 * Computes phase percentages for drying, browning, and development.
 * It scans the tableRows of the loaded roast data for milestone notes.
 * If a milestone is missing, it falls back on the row's time.
 *
 * @param {object} roastData - The data object loaded from Firestore.
 * @returns {string|null} - A string in the format "50/30/20%" or null if not enough info.
 */
function computePhasePercentages(roastData) {
  let dryEndSec = 0,
      firstCrackSec = 0,
      dropSec = 0;

  // Loop through each table row in the roast data
  (roastData.tableRows || []).forEach(row => {
    if (row.notes) {
      const lower = row.notes.toLowerCase();
      // Use the row's time (assumed to be in "MM:SS" format) as a fallback
      const rowSec = row.datasetTimeSec ? parseInt(row.datasetTimeSec, 10) : convertTimeStringToSeconds(row.time);
      if (lower.includes("dry end") && dryEndSec === 0) {
        dryEndSec = rowSec;
      }
      if (lower.includes("first crack") && firstCrackSec === 0) {
        firstCrackSec = rowSec;
      }
      if (lower.includes("drop") && dropSec === 0) {
        dropSec = rowSec;
      }
    }
  });

  // If dropSec wasn't set from a milestone note, use the maximum datasetTimeSec from the rows
  if (dropSec === 0) {
    (roastData.tableRows || []).forEach(row => {
      const t = row.datasetTimeSec ? parseInt(row.datasetTimeSec, 10) : convertTimeStringToSeconds(row.time);
      if (t > dropSec) dropSec = t;
    });
  }

  // We need at least a nonzero total time to compute percentages
  const total = dropSec;
  if (total === 0 || dryEndSec === 0 || firstCrackSec === 0) {
    return null;
  }

  // Compute phase times
  const dryingTime = dryEndSec;
  const browningTime = firstCrackSec - dryEndSec;
  const developmentTime = dropSec - firstCrackSec;
  // Compute percentages (rounding to whole numbers)
  const dryingPct = Math.round((dryingTime / total) * 100);
  const browningPct = Math.round((browningTime / total) * 100);
  const developmentPct = Math.round((developmentTime / total) * 100);

  return `${dryingPct}/${browningPct}/${developmentPct}%`;
}

/**
 * Helper to convert a "MM:SS" string into seconds.
 */
function convertTimeStringToSeconds(timeStr) {
  if (typeof timeStr !== "string") return 0;
  const parts = timeStr.split(":").map(Number);
  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return 0;
  return parts[0] * 60 + parts[1];
}

function createGhostComparisonTable(roastData) {
  // Clear out any existing rows
  const tbody = document.querySelector("#roastTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  // For each row in the recipe, create a side-by-side row
  (roastData.tableRows || []).forEach(recipeRow => {
    createGhostComparisonRow(recipeRow);
  });
}

function createGhostComparisonRow(recipeRow) {
  // recipeRow has { time, sensorB, sensorA, notes, datasetTimeSec }
  const tableBody = document.querySelector("#roastTable tbody");
  const tr = tableBody.insertRow();

  // Time cell
  const tdTime = tr.insertCell();
  tdTime.textContent = recipeRow.time; // "1:00", etc.

  // Sensor B cell
  const tdB = tr.insertCell();
  tdB.innerHTML = `
    <span class="userB" contentEditable="true" style="display:inline-block; width:50%;"></span>
    <span class="ghost-value" style="display:inline-block; width:50%; text-align:right; color:grey; 
                                     pointer-events:none; user-select:none;">
      ${recipeRow.sensorB}
    </span>
  `;

  // SENSOR A cell
  const tdA = tr.insertCell();
  tdA.innerHTML = `
    <span class="userA" contentEditable="true" style="display:inline-block; width:50%;"></span>
    <span class="ghost-value" style="display:inline-block; width:50%; text-align:right; color:grey; 
                                     pointer-events:none; user-select:none;">
      ${recipeRow.sensorA}
    </span>
  `;

  // Then attach event listeners to the userB / userA spans:
  const userBSpan = tdB.querySelector(".userB");
  userBSpan.addEventListener("blur", () => {
    const val = parseFloat(userBSpan.innerText);
    if (!isNaN(val)) {
      // do something with new B value, e.g. addOrReplaceChartData(...)
    }
  });

  const userASpan = tdA.querySelector(".userA");
  userASpan.addEventListener("blur", () => {
    const val = parseFloat(userASpan.innerText);
    if (!isNaN(val)) {
      // do something with new A value
    }
  });

  // This row is now a "ghost comparison" row.
}
