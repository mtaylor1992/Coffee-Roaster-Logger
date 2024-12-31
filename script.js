/***** script.js *****/

// ========== GLOBALS ==========
// Timer for Normal Mode
let timerInterval;
let startTime;
let elapsedTime = 0;
let running = false;

// Manual Mode
let manualMode = false;
let manualRowTimeSec = 0; // seconds for new manual row

// Power / Drum
let currentPower = "P5";
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

// ========== INITIAL SETUP ==========
document.addEventListener("DOMContentLoaded", () => {
  // Auto-fill date with local “today” (avoid tomorrow offset)
  const dateEl = document.getElementById('date');
  if (dateEl) {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    dateEl.value = now.toISOString().slice(0,10); 
  }

  initializeCharts();
  setupEventListeners();
});

// ========== CHART INITIALIZATION ==========
function initializeCharts() {
  initializeTemperatureChart();
  initializePieChart();
}

function initializeTemperatureChart() {
  const canvas = document.getElementById('temperatureChart');
  if (!canvas) return console.error("No 'temperatureChart' canvas found.");

  temperatureChart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'Sensor B',
          data: [],
          borderColor: 'blue',
          fill: false,
          yAxisID: 'yTemp',
          pointRadius: 3
        },
        {
          label: 'Sensor A',
          data: [],
          borderColor: 'green',
          fill: false,
          yAxisID: 'yTemp',
          pointRadius: 3
        },
        {
          label: 'Power Level',
          data: [],
          borderColor: 'red',
          fill: false,
          yAxisID: 'yPower',
          stepped: true,
          pointRadius: 0,  // no dots
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        // Hide legend entirely
        legend: { display: false },
        // Title updated dynamically
        title: { display: true, text: '' },
        annotation: { annotations: {} },
        datalabels: false // No line labels
      },
      scales: {
        x: {
          type: 'linear',
          position: 'bottom',
          min: 0,
          ticks: {
            // Major ticks each minute, minor ticks at 30s
            stepSize: 0.5,
            callback: (val) => (val % 1 === 0) ? val : ''
          }
        },
        yTemp: {
          title: { display: true, text: 'Temperature (°F)' },
          position: 'left',
          min: 95,
          ticks: {
            // Whole integers
            callback: (value) => Math.round(value)
          }
        },
        yPower: {
          title: { display: true, text: 'Power Level' },
          position: 'right',
          min: 0,
          max: 100,
          grid: { drawOnChartArea: false },
          ticks: {
            stepSize: 25,
            callback: (val) => {
              switch (val) {
                case 100: return 'P5';
                case 75:  return 'P4';
                case 50:  return 'P3';
                case 25:  return 'P2';
                case 0:   return 'P1';
                default:  return '';
              }
            }
          }
        }
      }
    }
  });
}

function initializePieChart() {
  const canvas = document.getElementById('pieChart');
  if (!canvas) return console.error("No 'pieChart' canvas found.");

  pieChart = new Chart(canvas.getContext('2d'), {
    type: 'pie',
    data: {
      labels: ['Drying', 'Browning', 'Development'],
      datasets: [
        {
          data: [0, 0, 0],
          backgroundColor: ['#ffe080', '#ffb060', '#ff8060']
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        // Hide the legend if you prefer
        legend: { display: false },
        title: { display: true, text: 'Roast Phases' },
        // Always show data labels (time + %)
        datalabels: {
          formatter: (value, context) => {
            const total = context.chart._metasets[context.datasetIndex].total || 1;
            const pct = ((value / total) * 100).toFixed(1);
            const timeStr = formatTime(value * 1000);
            return `${timeStr}\n${pct}%`;
          },
          color: 'black',
          font: { size: 12 },
          align: 'center',
          anchor: 'center'
        },
        tooltip: { enabled: false }
      }
    }
  });
}

// ========== EVENT LISTENERS ==========
function setupEventListeners() {
  const startBtn = document.getElementById('startRoast');
  startBtn?.addEventListener('click', startRoast);

  const resetBtn = document.getElementById('resetRoast');
  resetBtn?.addEventListener('click', resetRoastAll);

  // Power Buttons (inactive in manual mode)
  document.querySelectorAll('.power-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!manualMode) {
        const level = btn.getAttribute('data-level');
        changePowerLevel(level);
      }
    });
  });

  // Drum Speed
  const drumBtn = document.getElementById('toggleDrumSpeed');
  drumBtn?.addEventListener('click', () => {
    if (!manualMode) toggleDrumSpeed();
  });

  // Milestone Buttons
  document.querySelectorAll('.milestone-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!manualMode) milestoneEvent(btn.getAttribute('data-event'));
    });
  });

  // Table editing
  const roastTable = document.getElementById('roastTable');
  roastTable?.addEventListener('dblclick', handleTableDoubleClick);

  // Manual Mode Checkbox
  const manualCheckbox = document.getElementById('manualModeCheckbox');
  manualCheckbox?.addEventListener('change', (e) => {
    if (e.target.checked) {
      // Attempt to enable manual mode
      if (!checkBeanAndWeight()) {
        // revert checkbox
        e.target.checked = false;
      } else {
        manualMode = true;
        enableManualMode();
      }
    } else {
      // Turn off manual mode
      manualMode = false;
      resetRoast();
    }
  });
}

// ========== BEAN/WEIGHT CHECK ==========
function checkBeanAndWeight() {
  const beanVal = (document.getElementById('beanType')?.value || "").trim();
  const startW = (document.getElementById('startWeight')?.value || "").trim();
  if (!beanVal || !startW) {
    alert("Please enter Bean Type and Start Weight first.");
    return false;
  }
  return true;
}

// ========== MANUAL MODE FUNCTIONS ==========
function enableManualMode() {
  // Disable all buttons except Reset
  document.querySelectorAll('.buttons button').forEach(btn => {
    if (btn.id !== 'resetRoast') btn.disabled = true;
  });

  // Partial reset
  resetRoast(true);

  // Add initial power point at 0:00
  temperatureChart.data.datasets.find(ds => ds.label === 'Power Level')
    .data.push({ x: 0, y: powerMap[currentPower] });
  temperatureChart.update();

  addManualTableRow(); // first row at 0:00
  updateChartTitle();
}

function addManualTableRow() {
  const tbody = document.querySelector('#roastTable tbody');
  const row = tbody.insertRow();

  row.dataset.timeSec = manualRowTimeSec;

  // Time
  row.insertCell(0).innerText = formatTimeString(manualRowTimeSec);
  // B
  const bCell = row.insertCell(1);
  bCell.contentEditable = 'true';
  // A
  const aCell = row.insertCell(2);
  aCell.contentEditable = 'true';
  // Notes
  const notesCell = row.insertCell(3);
  notesCell.contentEditable = 'true';

  bCell.focus();

  // Enter key
  row.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleManualCellEnter(row, e.target);
    }
  });
}

function handleManualCellEnter(row, targetCell) {
  const cIndex = targetCell.cellIndex;
  if (cIndex === 1) {
    row.cells[2].focus(); // B => A
  } else if (cIndex === 2) {
    row.cells[3].focus(); // A => Notes
  } else if (cIndex === 3) {
    // Finalize row, new row
    const bVal = parseFloat(row.cells[1].innerText.trim());
    const aVal = parseFloat(row.cells[2].innerText.trim());
    const noteVal = row.cells[3].innerText.trim();

    if (!isNaN(bVal) && !isNaN(aVal)) {
      const tSec = parseInt(row.dataset.timeSec, 10);
      logData(tSec, bVal, aVal, noteVal, false);
      addOrReplaceChartData(tSec, bVal, aVal);
      parseAndExecuteNoteWithRemoval(noteVal, row); 
    }

    manualRowTimeSec += 30;
    addManualTableRow();
  }
}

// ========== START ROAST (NORMAL MODE) ==========
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

  // Start power at 0:00
  temperatureChart.data.datasets.find(ds => ds.label === 'Power Level')
    .data.push({ x: 0, y: powerMap["P5"] });
  temperatureChart.update();
  currentPower = "P5";

  promptSensorData(0);
  updateChartTitle();
}

// ========== TIMER UPDATE ==========
function updateTimer() {
  if (!running) return;
  elapsedTime = Date.now() - startTime;
  const totalSec = Math.floor(elapsedTime / 1000);
  document.getElementById('timer').innerText = formatTimeString(totalSec);

  // Update Pie
  updatePieChart();

  // Every 30s => record power & prompt sensor
  if (totalSec > 0 && totalSec % 30 === 0) {
    const xMin = totalSec / 60;
    temperatureChart.data.datasets.find(ds => ds.label === 'Power Level')
      .data.push({ x: xMin, y: powerMap[currentPower] });
    temperatureChart.update();

    promptSensorData(totalSec);
  }
}

// ========== RESET ==========
function resetRoast(partial = false) {
  running = false;
  clearInterval(timerInterval);

  elapsedTime = 0;
  const tEl = document.getElementById('timer');
  if (tEl) tEl.innerText = "00:00";

  // Clear charts
  temperatureChart.data.datasets.forEach(ds => ds.data = []);
  temperatureChart.update();

  pieChart.data.datasets[0].data = [0, 0, 0];
  pieChart.update();

  // Clear table
  document.querySelector('#roastTable tbody').innerHTML = '';

  // Reset milestones
  dryEndTime = null;
  firstCrackTime = null;
  dropTime = null;
  temperatureChart.options.plugins.annotation.annotations = {};
  temperatureChart.update();

  // Reset drop times
  resetDropTimesUI();
  targetDropTimes = {};

  currentPower = "P5";
  manualRowTimeSec = 0;

  if (!partial) logEvent("Roast Reset");
}

function resetRoastAll() {
  resetRoast();
  document.getElementById('beanType').value = '';
  document.getElementById('startWeight').value = '';
  document.getElementById('endWeight').value = '';
  const manualBox = document.getElementById('manualModeCheckbox');
  if (manualBox) manualBox.checked = false;
}

// ========== POWER / DRUM / MILESTONES ==========
function changePowerLevel(level) {
  currentPower = level;
  const timeStr = getCurrentTimeString();
  logEvent(`${level} at ${timeStr}`);

  const xMin = (elapsedTime / 1000) / 60;
  temperatureChart.data.datasets.find(ds => ds.label === 'Power Level')
    .data.push({ x: xMin, y: powerMap[level] });
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
  const xMin = (elapsedTime / 1000) / 60;

  if (name === "Dry End") {
    dryEndTime = elapsedTime / 1000;
  } else if (name === "First Crack") {
    firstCrackTime = elapsedTime / 1000;
    computeTargetDropTimes();
  } else if (name === "Drop") {
    dropTime = elapsedTime / 1000;
  }

  addMilestoneAnnotation(name, xMin);

  if (name === "Drop") {
    running = false;
    clearInterval(timerInterval);
    logEvent("Roast Dropped");
  }
  appendNoteToLastRow(timeStr, `${name} at ${timeStr}`);
}

// ========== DATA LOGGING ==========
function logEvent(desc) {
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
      // In normal mode, add row
      if (!manualMode && addToTable) {
        addDataToTable(timeSec, sensorB, sensorA, notes);
      }
      // Add data to chart
      addOrReplaceChartData(timeSec, sensorB, sensorA);
    })
    .catch(err => console.error("Error logging data:", err));
}

// ========== SENSOR PROMPT (NORMAL MODE) ==========
function promptSensorData(totalSec) {
  if (!running) return;

  const timeStr = formatTimeString(totalSec);
  const bVal = window.prompt(`Enter Sensor B temp at ${timeStr}:`, "");
  if (bVal === null) return; // user hit Cancel

  const aVal = window.prompt(`Enter Sensor A temp at ${timeStr}:`, "");
  if (aVal === null) return;

  const bNum = parseFloat(bVal);
  const aNum = parseFloat(aVal);
  if (isNaN(bNum) || isNaN(aNum)) {
    alert("Invalid input. Numbers only.");
    return;
  }
  logData(totalSec, bNum, aNum, "");
}

// ========== TABLE & CHART UPDATE ==========
function addDataToTable(timeSec, sensorB, sensorA, notes) {
  const tbody = document.querySelector('#roastTable tbody');
  const row = tbody.insertRow();
  row.dataset.timeSec = timeSec;
  row.insertCell(0).innerText = formatTimeString(timeSec);
  row.insertCell(1).innerText = sensorB;
  row.insertCell(2).innerText = sensorA;
  row.insertCell(3).innerText = notes;
}

// Adds/replaces chart data points for sensor B/A at a given time
function addOrReplaceChartData(timeSec, sensorB, sensorA) {
  const xVal = timeSec / 60;
  removeChartPoint('Sensor B', xVal);
  removeChartPoint('Sensor A', xVal);

  temperatureChart.data.datasets.find(ds => ds.label === 'Sensor B')
    .data.push({ x: xVal, y: sensorB });
  temperatureChart.data.datasets.find(ds => ds.label === 'Sensor A')
    .data.push({ x: xVal, y: sensorA });

  temperatureChart.update();
}

// Helper to remove a single chart point for the given dataset/time
function removeChartPoint(label, xVal) {
  const ds = temperatureChart.data.datasets.find(d => d.label === label);
  if (!ds) return;
  const idx = ds.data.findIndex(pt => pt.x === xVal);
  if (idx !== -1) ds.data.splice(idx, 1);
}

// ========== TABLE EDITING ==========
function handleTableDoubleClick(e) {
  if (e.target.tagName !== 'TD') return;
  const cIndex = e.target.cellIndex;
  if (cIndex === 0) return; // Time not editable

  const row = e.target.parentElement;
  const oldValue = e.target.innerText;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = oldValue;
  input.style.width = '100%';
  e.target.innerHTML = '';
  e.target.appendChild(input);
  input.focus();

  input.addEventListener('blur', () => saveEdit(row, cIndex, input.value));
  input.addEventListener('keypress', (evt) => {
    if (evt.key === 'Enter') saveEdit(row, cIndex, input.value);
  });
}

function saveEdit(row, cellIndex, newVal) {
  row.cells[cellIndex].innerText = newVal;
  if (manualMode) {
    // Re-parse row
    const timeSec = parseInt(row.dataset.timeSec, 10);
    const bVal = parseFloat(row.cells[1].innerText.trim());
    const aVal = parseFloat(row.cells[2].innerText.trim());
    const noteVal = row.cells[3].innerText.trim();

    // Update chart data for B/A
    if (!isNaN(bVal) && !isNaN(aVal)) {
      addOrReplaceChartData(timeSec, bVal, aVal);
    }
    // Remove old note’s power line & re-parse new note
    parseAndExecuteNoteWithRemoval(noteVal, row);
  }
}

// ========== NOTE PARSING WITH REMOVAL OF OLD TIMES ==========
function parseAndExecuteNoteWithRemoval(newNote, row) {
  const oldNote = row.dataset.oldNote || "";
  if (oldNote) removeOldNotePoints(oldNote);

  parseAndExecuteNote(newNote);
  row.dataset.oldNote = newNote;
}

function removeOldNotePoints(note) {
  // Remove power-level points from old note
  const regex = /(P\d)\s+(\d{1,2}:\d{2})/gi;
  let match;
  while ((match = regex.exec(note)) !== null) {
    const lvl = match[1].toUpperCase();
    const timeStr = match[2];
    const noteSec = convertTimeStringToSeconds(timeStr);
    const xMin = noteSec / 60;
    removeChartPoint('Power Level', xMin);
    temperatureChart.update();
  }
  // If needed, similarly remove old milestone annotations
}

function parseAndExecuteNote(note) {
  if (!note) return;
  const pattern = /(P\d|Dry\s?end|First\s?Crack|Drop|Drum\s?High|Drum\s?Low)\s+(\d{1,2}:\d{2})/gi;
  let match;
  while ((match = pattern.exec(note)) !== null) {
    const action = match[1].toLowerCase();
    const timeStr = match[2];
    const noteSec = convertTimeStringToSeconds(timeStr);
    const xMin = noteSec / 60;

    if (action.startsWith('p')) {
      const lvl = action.toUpperCase();
      removeChartPoint('Power Level', xMin);
      temperatureChart.data.datasets.find(ds => ds.label === 'Power Level')
        .data.push({ x: xMin, y: powerMap[lvl] });
      currentPower = lvl;
      temperatureChart.update();
    } else if (action.includes('dry')) {
      dryEndTime = noteSec;
      removeAnnotation("Dry End"); 
      addMilestoneAnnotation("Dry End", xMin);
    } else if (action.includes('first')) {
      firstCrackTime = noteSec;
      removeAnnotation("First Crack");
      addMilestoneAnnotation("First Crack", xMin);
      computeTargetDropTimes();
    } else if (action.includes('drop')) {
      dropTime = noteSec;
      removeAnnotation("Drop");
      addMilestoneAnnotation("Drop", xMin);
    }
  }
  updatePieChart();
}

function removeAnnotation(eventName) {
  const ann = temperatureChart.options.plugins.annotation.annotations;
  for (const key in ann) {
    if (ann[key].label?.content === eventName) {
      delete ann[key];
    }
  }
  temperatureChart.update();
}

// ========== ANNOTATIONS & PIE UPDATE ==========
function addMilestoneAnnotation(name, xVal) {
  const annID = `${name.replace(/\s/g, '')}_${xVal.toFixed(2)}`;
  temperatureChart.options.plugins.annotation.annotations[annID] = {
    type: 'line',
    xMin: xVal,
    xMax: xVal,
    borderColor: 'gray',
    borderWidth: 2,
    borderDash: [5, 5],
    label: {
      enabled: true,
      content: name,
      position: 'start',
      backgroundColor: 'rgba(0,0,0,0.7)',
      color: 'white',
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
    ? manualRowTimeSec 
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

function computeTargetDropTimes() {
  if (!firstCrackTime) return;
  targetDropPercentages.forEach((p) => {
    const frac = p / 100;
    targetDropTimes[p] = firstCrackTime / (1 - frac);
  });
  displayTargetDropTimes();
}

function displayTargetDropTimes() {
  const dropList = document.getElementById('dropTimesList');
  dropList.innerHTML = '';
  targetDropPercentages.forEach((p) => {
    let timeStr = '--:--';
    if (targetDropTimes[p]) {
      timeStr = formatTimeString(Math.floor(targetDropTimes[p]));
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
  const [mm, ss] = str.split(':').map(Number);
  return (mm * 60) + ss;
}

function pad(num) {
  return num.toString().padStart(2, '0');
}

function appendNoteToLastRow(timeStr, note) {
  const rows = document.querySelector('#roastTable tbody').rows;
  if (!rows.length) return;
  const lastRow = rows[rows.length - 1];
  const existing = lastRow.cells[3].innerText.trim();
  lastRow.cells[3].innerText = existing ? `${existing}, ${note}` : note;
}

function resetDropTimesUI() {
  const dropList = document.getElementById('dropTimesList');
  dropList.innerHTML = `
    <li>15% → --:--</li>
    <li>17.5% → --:--</li>
    <li>20% → --:--</li>
    <li>22.5% → --:--</li>
    <li>25% → --:--</li>
  `;
}

// Format chart title as: "Bean, Weight, Date"
function updateChartTitle() {
  const bean = (document.getElementById('beanType')?.value || "").trim() || "No Bean";
  const startW = (document.getElementById('startWeight')?.value || "").trim() || "??";
  let dateVal = (document.getElementById('date')?.value || "").trim() || "No Date";

  // If date is "2024-12-30", format as "12/30/24"
  let dateFormatted = dateVal;
  const parts = dateVal.split('-'); // [YYYY, MM, DD]
  if (parts.length === 3) {
    const yyyy = parts[0].slice(-2); // last two digits
    const mm = parts[1];
    const dd = parts[2];
    dateFormatted = `${mm}/${dd}/${yyyy}`;
  }

  temperatureChart.options.plugins.title.text =
    `${bean}, ${startW}g, ${dateFormatted}`;
  temperatureChart.update();
}
