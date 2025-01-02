/***** script.js *****/

// ========== GLOBAL VARIABLES ==========
let timerInterval;
let startTime;
let elapsedTime = 0;
let running = false;

// Manual Mode
let manualMode = false;
let manualRowTimeSec = 0;
let lastPower = "P5";   // for manual mode
let lastPowerTimeSec = 0; // Track when user last explicitly changed power

// Normal Mode
let currentPower = "P5"; // for normal mode
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

/** 
 * =====================================
 * HELPER: CREATE CONSISTENT ANNOTATION IDs (integer seconds)
 * =====================================
 * e.g. makeAnnID("Dry End", 181) => "DryEnd_181"
 */
function makeAnnID(eventName, noteSec) {
  return eventName.replace(/\s/g, "") + "_" + Math.round(noteSec);
}

/***** ON LOAD *****/
document.addEventListener("DOMContentLoaded", () => {
  // If chartjs-plugin-datalabels is present, register it
  if (typeof ChartDataLabels !== "undefined") {
    Chart.register(ChartDataLabels);
  }

  // If not already in HTML, register the annotation plugin
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
        title: { display: true, text: "" },
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
                case 100: return "P5";
                case 75:  return "P4";
                case 50:  return "P3";
                case 25:  return "P2";
                case 0:   return "P1";
                default:  return "";
              }
            }
          }
        }
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
        legend: { display: false },
        title: { display: true, text: "Roast Phases" },
        datalabels: {
          formatter: (value, ctx) => {
            if (!value) return "";
            const total = ctx.chart._metasets[ctx.datasetIndex].total || 1;
            let pct = ((value / total) * 100).toFixed(1) + "%";
            pct = `**${pct}**`; // visually "bold"

            const timeStr = formatTime(value * 1000);
            const label = ctx.chart.data.labels[ctx.dataIndex] || "";
            return `${label}\n${timeStr}\n${pct}`;
          },
          color: "black",
          font: { size: 12 },
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

  // Power buttons in normal mode
  document.querySelectorAll(".power-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (!manualMode) changePowerLevel(btn.getAttribute("data-level"));
    });
  });

  // Toggle drum speed in normal mode
  const drumBtn = document.getElementById("toggleDrumSpeed");
  if (drumBtn) {
    drumBtn.addEventListener("click", () => {
      if (!manualMode) toggleDrumSpeed();
    });
  }

  // Milestone buttons in normal mode
  document.querySelectorAll(".milestone-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (!manualMode) milestoneEvent(btn.getAttribute("data-event"));
    });
  });

  // Table for editing in manual mode
  const roastTable = document.getElementById("roastTable");
  if (roastTable) {
    roastTable.addEventListener("dblclick", handleTableDoubleClick);
  }

  // Manual mode checkbox
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

  // Charge Temp Enter => set row
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
    // Update existing charge row
    tbody.rows[0].cells[1].innerText = tempVal;
  } else {
    // Create new charge row at top
    const row = tbody.insertRow(0);
    row.insertCell(0).innerText = "Charge";
    row.insertCell(1).innerText = tempVal;
    row.insertCell(2).innerText = "";
    row.insertCell(3).innerText = "";
    row.insertCell(4).innerText = "";
  }
  toggleDeleteButtons();
}

// ========== MANUAL MODE ==========
function enableManualMode() {
  // do NOT fully reset table => keep charge row
  document.querySelectorAll(".buttons button").forEach(btn => {
    if (btn.id !== "resetRoast") btn.disabled = true;
  });

  running = false;   
  elapsedTime = 0;
  manualMode = true;
  lastPower = "P5";
  lastPowerTimeSec = 0; // resetting the lastPowerTimeSec if needed
  manualRowTimeSec = 0;  

  addManualRow(); 
  updateChartTitle();
}

function addManualRow() {
  const tbody = document.querySelector("#roastTable tbody");

  // find time of last normal row
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
  row.dataset.oldNote = ""; // track old note from the start

  // Time cell (read-only)
  row.insertCell(0).innerText = formatTimeString(manualRowTimeSec);

  // B
  const bCell = row.insertCell(1);
  bCell.contentEditable = "true";

  // A
  const aCell = row.insertCell(2);
  aCell.contentEditable = "true";

  // Note
  const noteCell = row.insertCell(3);
  noteCell.contentEditable = "true";

  // Delete cell
  const xCell = row.insertCell(4);
  const xBtn = document.createElement("button");
  xBtn.innerText = "x";
  xBtn.style.marginLeft = "10px";
  xBtn.addEventListener("click", () => removeRowAndData(row));
  xCell.appendChild(xBtn);

  toggleDeleteButtons();

  // Keydown => press Enter to move or add row
  row.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const cIndex = e.target.cellIndex;
      if (cIndex === 1) {
        row.cells[2].focus();
      } else if (cIndex === 2) {
        row.cells[3].focus();
      } else if (cIndex === 3) {
        // user finished editing note
        updateRowSensors(row);
        parseAndExecuteNoteWithRemoval(row);

        maybeAddPowerPoint(row);

        // If this is last row => add another new row
        if (tbody.rows[tbody.rows.length - 1] === row) {
          addManualRow();
          tbody.rows[tbody.rows.length - 1].cells[1].focus();
        }
      }
      updatePieChart();
    }
  });

  // If no normal row => focus B
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
      row.cells[4].style.visibility = "hidden";
    } else {
      normalRows.push(row);
    }
  }
  if (normalRows.length) {
    for (let i = 0; i < normalRows.length - 1; i++) {
      normalRows[i].cells[4].style.visibility = "hidden";
    }
    normalRows[normalRows.length - 1].cells[4].style.visibility = "visible";
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
  const tSec = parseInt(row.dataset.timeSec, 10);
  removeChartPoint("Sensor B", tSec / 60);
  removeChartPoint("Sensor A", tSec / 60);

  const oldNote = row.dataset.oldNote || "";
  removeOldNotePoints(oldNote);
  removeOldMilestoneLines(oldNote);

  removeChartPoint("Power Level", tSec / 60);

  row.parentElement.removeChild(row);
  toggleDeleteButtons();

  sortAllDatasets();
  temperatureChart.update();
  updatePieChart();
}

/** 
 * Helper: returns true if the user typed e.g. "P4 1:23"
 * i.e. there's an explicit power + time
 */
function containsExplicitPowerTime(str) {
  // e.g. "P4 1:23" or "P1 0:30"
  const re = /\bP[1-5]\b\s+\d{1,2}:\d{1,2}/i;
  return re.test(str);
}

// Called whenever user hits Enter after editing the note cell:
function parseAndExecuteNoteWithRemoval(row) {
  const oldNote = row.dataset.oldNote || "";
  removeOldNotePoints(oldNote);
  removeOldMilestoneLines(oldNote);

  // The raw note the user sees (and typed)
  const rawNote = row.cells[3].innerText.trim();
  const rowTimeSec = parseInt(row.dataset.timeSec, 10);

  // ============== Double Enter Fix ================
  // If user typed "P4" (no time) initially => row-time power
  // Now we see "P4 1:23" => remove that row-time power immediately
  if (containsExplicitPowerTime(rawNote)) {
    removeChartPoint("Power Level", rowTimeSec / 60);
  }
  // ================================================

  // If milestone has no time => add synthetic
  const finalNote = maybeAddSyntheticTime(rawNote, rowTimeSec);

  // parse the finalNote
  parseAndExecuteNote(finalNote, rowTimeSec);

  // store finalNote in oldNote
  row.dataset.oldNote = finalNote;

  // if finalNote has a power => forward patch
  if (containsPowerChange(finalNote)) {
    forwardPatchPowerChange(row);
  }
}

/**
 * maybeAddSyntheticTime:
 *  - If user typed "Dry End" with no time => returns "Dry End mm:ss"
 *  - Otherwise returns the original rawNote.
 */
function maybeAddSyntheticTime(rawNote, defaultSec) {
  // If rawNote already has a time, just return it
  const timeRegex = /\d{1,2}:\d{1,2}/;
  if (timeRegex.test(rawNote)) {
    return rawNote; 
  }

  const lower = rawNote.toLowerCase();
  if (lower.includes("dry") || lower.includes("first") || lower.includes("drop")) {
    const timeStr = formatTimeString(defaultSec); 
    return `${rawNote} ${timeStr}`; 
  }

  return rawNote;
}

/**
 * maybeAddPowerPoint: 
 * If user typed "P3" but no time => add power at row's time
 * If user typed "P3 3:16" => skip row-time
 * If no mention => only re-add lastPower if row time >= lastPowerTimeSec
 */
function maybeAddPowerPoint(row) {
  const noteVal = row.cells[3].innerText.trim();
  const tSec = parseInt(row.dataset.timeSec, 10);
  const xVal = tSec / 60;

  // If note has "P4 1:23" => explicit time => skip row-time
  const explicitTimeRegex = /(P[1-5])\s+(\d{1,2}:\d{2})/i;
  if (explicitTimeRegex.test(noteVal)) {
    removeChartPoint("Power Level", xVal);
    return;
  }

  // If note has "P4" but no time => row time
  const pNoTimeRegex = /(P[1-5])(?!\s*\d)/i; 
  if (pNoTimeRegex.test(noteVal)) {
    removeChartPoint("Power Level", xVal);
    temperatureChart.data.datasets
      .find(ds => ds.label === "Power Level")
      .data.push({ x: xVal, y: powerMap[lastPower] });
    // also update lastPowerTimeSec so it won't override older rows
    lastPowerTimeSec = tSec * 60; 
    sortAllDatasets();
    temperatureChart.update();
    return;
  }

  // If there's NO mention of power, only re-add lastPower if tSec >= lastPowerTimeSec/60
  if (tSec >= (lastPowerTimeSec / 60)) {
    removeChartPoint("Power Level", xVal);
    temperatureChart.data.datasets
      .find(ds => ds.label === "Power Level")
      .data.push({ x: xVal, y: powerMap[lastPower] });
    sortAllDatasets();
    temperatureChart.update();
  }
  // else: do nothing => don't forcibly set older row to lastPower
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
  const pVal = powerMap[newPower];

  const tbody = document.querySelector("#roastTable tbody");
  const allRows = Array.from(tbody.rows);
  const index = allRows.indexOf(row);
  if (index < 0) return;

  let lastSec = rowTimeSec;
  for (let i = index + 1; i < allRows.length; i++) {
    const r = allRows[i];
    if (r.cells[0].innerText === "Charge") continue;
    const rTimeSec = parseInt(r.dataset.timeSec, 10);
    const xVal = rTimeSec / 60;
    const rNote = r.dataset.oldNote || r.cells[3].innerText || "";

    // Stop if we find another power note or if time goes backward
    if (containsPowerChange(rNote) || rTimeSec < lastSec) break;

    removeChartPoint("Power Level", xVal);
    temperatureChart.data.datasets
      .find(ds => ds.label === "Power Level")
      .data.push({ x: xVal, y: pVal });

    lastSec = rTimeSec;
  }
  sortAllDatasets();
  temperatureChart.update();
}

// ========== NORMAL MODE ==========
function startRoast() {
  if (manualMode) return;
  if (!checkBeanAndWeight()) return;

  if (running) {
    console.log("Already running.");
    return;
  }
  running = true;
  startTime = Date.now() - elapsedTime;
  timerInterval = setInterval(updateTimer, 1000);

  logEvent("Roast Started");

  // Start power P5 at 0:00
  temperatureChart.data.datasets
    .find(ds => ds.label === "Power Level")
    .data.push({ x: 0, y: powerMap["P5"] });
  sortAllDatasets();
  temperatureChart.update();
  currentPower = "P5";

  promptSensorData(0);
  updateChartTitle();
}

function updateTimer() {
  if (!running) return;
  elapsedTime = Date.now() - startTime;
  const totalSec = Math.floor(elapsedTime / 1000);
  document.getElementById("timer").innerText = formatTimeString(totalSec);

  updatePieChart();

  // every 30s => prompt sensor & log power
  if (totalSec > 0 && totalSec % 30 === 0) {
    const xVal = totalSec / 60;
    temperatureChart.data.datasets
      .find(ds => ds.label === "Power Level")
      .data.push({ x: xVal, y: powerMap[currentPower] });
    sortAllDatasets();
    temperatureChart.update();

    promptSensorData(totalSec);
  }
}

// ========== RESET ==========
function resetRoast(partial = false) {
  running = false;
  clearInterval(timerInterval);
  elapsedTime = 0;
  document.getElementById("timer").innerText = "00:00";

  // Clear chart data
  temperatureChart.data.datasets.forEach(ds => ds.data = []);
  // Clear dotted lines
  temperatureChart.options.plugins.annotation.annotations = {};
  temperatureChart.update();

  // Clear pie
  pieChart.data.datasets[0].data = [0,0,0];
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
  lastPower = "P5";
  lastPowerTimeSec = 0;  // reset
  manualRowTimeSec = 0;

  if (!partial) logEvent("Roast Reset");
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
  logEvent(`${level} at ${timeStr}`);

  const xVal = (elapsedTime / 1000) / 60;
  temperatureChart.data.datasets
    .find(ds => ds.label === "Power Level")
    .data.push({ x: xVal, y: powerMap[level] });
  sortAllDatasets();
  temperatureChart.update();

  appendNoteToLastRow(timeStr, `${level} at ${timeStr}`);
}

function toggleDrumSpeed() {
  drumSpeed = (drumSpeed === "Low") ? "High" : "Low";
  const timeStr = getCurrentTimeString();
  logEvent(`Drum ${drumSpeed} at ${timeStr}`);
  appendNoteToLastRow(timeStr, `Drum ${drumSpeed} at ${timeStr}`);
}

function milestoneEvent(name) {
  const timeStr = getCurrentTimeString();
  logEvent(`${name} at ${timeStr}`);

  const xVal = (elapsedTime / 1000) / 60;
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
    logEvent("Roast Dropped");
  }
  updatePieChart();

  appendNoteToLastRow(timeStr, `${name} at ${timeStr}`);
}

// ========== LOG EXAMPLES ==========
function logEvent(desc) {
  // Firestore example. Remove or adapt if not needed:
  db.collection("roastEvents").add({
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    event: desc
  }).catch(err => console.error("Error logging event:", err));
}

function logData(timeSec, sensorB, sensorA, notes, addToTable = true) {
  const payload = {
    time: timeSec,
    sensorB,
    sensorA,
    notes,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  };
  db.collection("roastLogs").add(payload)
    .then(() => {
      if (!manualMode && addToTable) {
        addDataToTable(timeSec, sensorB, sensorA, notes);
      }
      addOrReplaceChartData(timeSec, sensorB, sensorA);
    })
    .catch(err => console.error("Error logging data:", err));
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
  let insertIndex = 0;
  if (tbody.rows.length && tbody.rows[0].cells[0].innerText === "Charge") {
    insertIndex = 1;
  } else {
    insertIndex = tbody.rows.length;
  }

  const row = tbody.insertRow(insertIndex);
  row.dataset.timeSec = timeSec;
  row.dataset.oldNote = notes || "";

  row.insertCell(0).innerText = formatTimeString(timeSec);
  row.insertCell(1).innerText = sensorB;
  row.insertCell(2).innerText = sensorA;
  row.insertCell(3).innerText = notes;
}

function addOrReplaceChartData(timeSec, sensorB, sensorA) {
  const xVal = timeSec / 60;
  removeChartPoint("Sensor B", xVal);
  removeChartPoint("Sensor A", xVal);

  temperatureChart.data.datasets.find(ds => ds.label === "Sensor B")
    .data.push({ x: xVal, y: sensorB });
  temperatureChart.data.datasets.find(ds => ds.label === "Sensor A")
    .data.push({ x: xVal, y: sensorA });

  sortAllDatasets();
  temperatureChart.update();
}

// Doubleclick => editing
function handleTableDoubleClick(e) {
  if (e.target.tagName !== "TD") return;
  // block time cell (index 0) or "Charge" row from editing
  if (e.target.cellIndex === 0) return; 
  const row = e.target.parentElement;
  if (row.cells[0].innerText === "Charge") return;

  const oldValue = e.target.innerText;
  const input = document.createElement("input");
  input.type = "text";
  input.value = oldValue;
  input.style.width = "100%";
  e.target.innerHTML = "";
  e.target.appendChild(input);
  input.focus();

  input.addEventListener("blur", () => saveEdit(row, e.target.cellIndex, input.value));
  input.addEventListener("keypress", (evt) => {
    if (evt.key === "Enter") {
      saveEdit(row, e.target.cellIndex, input.value);
    }
  });
}

function saveEdit(row, cellIndex, newVal) {
  row.cells[cellIndex].innerText = newVal;

  // Only in manual mode
  if (!manualMode) return;

  const tSec = parseInt(row.dataset.timeSec, 10);

  if (cellIndex === 1 || cellIndex === 2) {
    // B or A changed
    const bVal = parseFloat(row.cells[1].innerText.trim());
    const aVal = parseFloat(row.cells[2].innerText.trim());
    if (!isNaN(bVal) && !isNaN(aVal)) {
      addOrReplaceChartData(tSec, bVal, aVal);
    }
  } else if (cellIndex === 3) {
    const oldNote = row.dataset.oldNote || "";
    removeOldNotePoints(oldNote);
    removeOldMilestoneLines(oldNote);

    const newNote = row.cells[3].innerText.trim();
    parseAndExecuteNote(newNote, tSec);
    row.dataset.oldNote = newNote;

    // forward patch if "P\d" is found
    if (containsPowerChange(newNote)) {
      forwardPatchPowerChange(row);
    }
  }

  updatePieChart();
}

/** ========== POWER & MILESTONES ========== **/

function removeOldMilestoneLines(oldNote) {
  if (!oldNote) return;
  const noteLower = oldNote.toLowerCase();
  const pattern = /(dry\s?end|first\s?crack|drop)\s+(\d{1,2}:\d{2})/g;
  const matches = [...noteLower.matchAll(pattern)];
  if (!matches.length) return;

  matches.forEach(m => {
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

  matches.forEach(m => {
    const sec = convertTimeStringToSeconds(m[2]);
    removeChartPoint("Power Level", sec / 60);
  });

  sortAllDatasets();
  temperatureChart.update();
}

function parseAndExecuteNote(note, defaultTimeSec=0) {
  if (!note) return;
  const segments = note.split(",").map(s => s.trim()).filter(Boolean);
  segments.forEach(seg => {
    const re = /(P[1-5])\s+(\d{1,2}:\d{2})|Dry\s?end\s+(\d{1,2}:\d{2})|first\s?crack\s+(\d{1,2}:\d{2})|drop\s+(\d{1,2}:\d{2})|drum\s?high\s+(\d{1,2}:\d{2})|drum\s?low\s+(\d{1,2}:\d{2})/i;
    const match = seg.match(re);
    if (match) {
      applyMatchWithTime(seg, match);
    } else {
      applyNoTimeSegment(seg, defaultTimeSec);
    }
  });
}

function applyMatchWithTime(segment, match) {
  let powerVal           = match[1] || "";
  let powerTime          = match[2] || "";
  let dryEndTimeStr      = match[3] || "";
  let firstCrackTimeStr  = match[4] || "";
  let dropTimeStr        = match[5] || "";
  let drumHighTimeStr    = match[6] || "";
  let drumLowTimeStr     = match[7] || "";

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

  // If it's a milestone with no explicit time => synthesize one
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

  // "drum" => no dotted line
  if (seg.includes("drum")) return;

  // power note "p4"
  if (seg.startsWith("p")) {
    applyNoteAction(seg, defaultTimeSec);
  }
}

function applyNoteAction(action, noteSec) {
  const xVal = noteSec / 60;
  if (action.startsWith("p")) {
    // remove old row-based power
    removeChartPoint("Power Level", xVal);
    temperatureChart.data.datasets
      .find(ds => ds.label === "Power Level")
      .data.push({ x: xVal, y: powerMap[action.toUpperCase()] });
    lastPower = action.toUpperCase();
    lastPowerTimeSec = noteSec; // record the new power's second-based time
    sortAllDatasets();
    temperatureChart.update();
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
  } else if (action.includes("drum")) {
    // no dotted line for drum changes
  }
}

/** ADD / UPDATE MILESTONE LINES **/
function addMilestoneAnnotation(name, xVal) {
  const noteSec = Math.round(xVal * 60);
  const annID = makeAnnID(name, noteSec);

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
  temperatureChart.update();
}

function updatePieChart() {
  let drying = 0;
  let browning = 0;
  let development = 0;

  const nowSec = manualMode
    ? findMaxManualTimeSec()
    : Math.floor(elapsedTime / 1000);

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
  targetDropPercentages.forEach(p => {
    const frac = p / 100;
    targetDropTimes[p] = firstCrackTime / (1 - frac);
  });
  displayTargetDropTimes();
}

function displayTargetDropTimes() {
  const dropList = document.getElementById("dropTimesList");
  if (!dropList) return;
  dropList.innerHTML = "";
  targetDropPercentages.forEach(p => {
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
  const [mm, ss] = str.split(":").map(Number);
  return mm * 60 + (ss || 0);
}

function pad(num) {
  return num.toString().padStart(2, "0");
}

/** Remove one data point from chart by X value */
function removeChartPoint(label, xVal) {
  const ds = temperatureChart.data.datasets.find(d => d.label === label);
  if (!ds) return;
  const idx = ds.data.findIndex(pt => pt.x === xVal);
  if (idx !== -1) ds.data.splice(idx, 1);
}

function sortAllDatasets() {
  temperatureChart.data.datasets.forEach(ds => {
    ds.data.sort((a,b) => a.x - b.x);
  });
  temperatureChart.update();
}

/** Append to note in last row for normal mode logging */
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
}

/** Reset the displayed drop times UI */
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

  temperatureChart.options.plugins.title.text =
    `${bean}, ${startW}g, ${dateVal}`;
  temperatureChart.update();
}
