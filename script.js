/***** script.js *****/

// ========== GLOBAL VARIABLES ==========
let timerInterval;
let startTime;
let elapsedTime = 0;
let running = false;

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
        legend: { display: false }, // Removed the legend
        title: {
          display: true,
          text: "",
          color: "black",
          font: {
            size: fontSizePx, // Adjust the size as needed
            weight: "bold" // Optional: Make the title bold
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
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }, // Removed the legend
        title: { display: true, text: "Roast Phases", color: "black" },
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
    alert("Please enter Bean Type and Start Weight first.");
    return false;
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
    if (btn.id !== "resetRoast") btn.disabled = true;
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
  const bVal = parseFloat(row.cells[1].innerText.trim());
  const aVal = parseFloat(row.cells[2].innerText.trim());
  if (!isNaN(bVal) && !isNaN(aVal)) {
    addOrReplaceChartData(tSec, bVal, aVal);
  }
}

function removeRowAndData(row) {
  row.parentElement.removeChild(row);
  toggleDeleteButtons();

  // Rebuild powerPoints from the remaining table entries
  rebuildPowerPoints();

  // Update the chart and pie chart
  sortAllDatasets();
  updatePieChart();
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

  promptSensorData(0);
  updateChartTitle();
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

    promptSensorData(totalSec);
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
}

function resetRoastAll() {
  resetRoast();
  document.getElementById("beanType").value = "";
  document.getElementById("startWeight").value = "";
  document.getElementById("endWeight").value = "";
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
}

function toggleDrumSpeed() {
  drumSpeed = drumSpeed === "Low" ? "High" : "Low";
  const timeStr = getCurrentTimeString();

  if (manualMode) {
    appendNoteToLastRow(timeStr, `Drum ${drumSpeed} at ${timeStr}`);
  } else {
    appendNoteToLastRow(timeStr, `Drum ${drumSpeed} ${timeStr}`);
  }
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
    } else if (name.toLowerCase().includes("first")) {
      firstCrackTime = elapsedTime / 1000;
      addMilestoneAnnotation("First Crack", xVal);
      computeTargetDropTimes();
    } else if (name.toLowerCase().includes("drop")) {
      dropTime = elapsedTime / 1000;
      addMilestoneAnnotation("Drop", xVal);

      running = false;
      clearInterval(timerInterval);
    }
    updatePieChart();

  } catch (error) {
    console.error(`Error processing milestone event "${name}":`, error);
  } finally {
    // Ensure the flag is reset even if an error occurs
    isProcessingMilestone = false;
  }
}

//========== LOGGING ==========
/*
function logEvent(desc) {
  // Example Firestore logging if needed
  db.collection("roastEvents")
    .add({
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      event: desc
    })
    .catch((err) => console.error("Error logging event:", err));
}
*/

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

function promptSensorData(totalSec) {
  if (!running) return;
  const timeStr = formatTimeString(totalSec);
  const bVal = prompt(`Enter Sensor B temp at ${timeStr}:`, "");
  if (bVal === null) return;
  const aVal = prompt(`Enter Sensor A temp at ${timeStr}:`, "");
  if (aVal === null) return;

  const bNum = parseFloat(bVal);
  const aNum = parseFloat(aVal);
  if (isNaN(bNum) || isNaN(aNum)) {
    alert("Invalid input. Numbers only.");
    return;
  }
  logData(totalSec, bNum, aNum, "");
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
      // No changes detected; restore the original cell content
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
  }

  updatePieChart();

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
  const noteSec = Math.round(xVal * 60);
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
    const existingSec = Math.round(existingXVal * 60);
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
    borderColor: "gray",
    borderWidth: 2,
    borderDash: [5, 5],
    label: {
      display: true,
      content: name,
      position: "start",
      xAdjust: -30,
      backgroundColor: "rgba(0,0,0,0.7)",
      color: "white",
      font: { size: 12 },
      yAdjust: -10
    }
  };

  // Update the chart once after adding
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
  temperatureChart.options.plugins.annotation.annotations = {};

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
  // Clear all existing annotations
  temperatureChart.options.plugins.annotation.annotations = {};

  const tbody = document.querySelector("#roastTable tbody");
  if (!tbody) return;

  for (let i = 0; i < tbody.rows.length; i++) {
    const row = tbody.rows[i];
    if (row.cells[0].innerText === "Charge") continue;
    const note = row.cells[3].innerText;
    const tSec = parseInt(row.dataset.timeSec, 10);
    parseAndExecuteNote(note, tSec);
  }

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