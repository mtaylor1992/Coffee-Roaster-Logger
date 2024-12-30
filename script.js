// script.js

// Variables for Timer
let timerInterval;
let startTime;
let elapsedTime = 0;
let running = false;

// Power Settings
const powerMap = { "P5": 100, "P4": 75, "P3": 50, "P2": 25, "P1": 0 };
let currentPower = "P5";
let drumSpeed = "Low";

// Milestone Times
let dryEndTime = null;
let firstCrackTime = null;
let dropTime = null;

// Target Drop Times
const targetDropPercentages = [15, 17.5, 20, 22.5, 25];
let targetDropTimes = {};

// Initialize Charts
let temperatureChart;
let pieChart;

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
    initializeCharts();
    setupEventListeners();
});

// Function to Initialize Charts
function initializeCharts() {
    // Check if Chart.js and plugins are loaded

    /*
    if (typeof Chart === 'undefined') {
        console.error("Chart.js is not loaded.");
        return;
    }

    if (typeof ChartAnnotation === 'undefined') {
        console.error("ChartAnnotation plugin is not loaded.");
        return;
    }

    if (typeof ChartDataLabels === 'undefined') {
        console.error("ChartDataLabels plugin is not loaded.");
        return;
    }

    // Register Annotation and Data Labels Plugins
    Chart.register(ChartAnnotation, ChartDataLabels);
    */

    // Combined Temperature and Power Chart Initialization
    const tempCanvas = document.getElementById('temperatureChart');
    if (tempCanvas) {
        const tempCtx = tempCanvas.getContext('2d');
        temperatureChart = new Chart(tempCtx, {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: 'Sensor B',
                        data: [],
                        borderColor: 'blue',
                        fill: false,
                        yAxisID: 'yTemp'
                    },
                    {
                        label: 'Sensor A',
                        data: [],
                        borderColor: 'green',
                        fill: false,
                        yAxisID: 'yTemp'
                    },
                    {
                        label: 'Power Level',
                        data: [],
                        borderColor: 'red',
                        fill: false,
                        yAxisID: 'yPower',
                        stepped: true,
                        tension: 0 // To make step lines
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, // Allow chart to fill container
                plugins: {
                    title: {
                        display: true,
                        text: 'Temperature and Power Over Time'
                    },
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    annotation: {
                        annotations: {}
                    },
                    datalabels: {
                        formatter: function(value, context) {
                            const datasetLabel = context.dataset.label;
                            if (datasetLabel === 'Power Level') {
                                return ''; // Do not show datalabels for Power Level
                            }
                            return `${value.y}°F`;
                        },
                        color: 'black',
                        align: 'top',
                        anchor: 'end'
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Time (Minutes)'
                        },
                        type: 'linear',
                        position: 'bottom',
                        ticks: {
                            stepSize: 1,
                            callback: function(value, index, values) {
                                const minutes = Math.floor(value);
                                return minutes % 1 === 0 ? `${minutes}` : '';
                            }
                        },
                        grid: {
                            tickColor: '#e0e0e0',
                            color: '#e0e0e0',
                            lineWidth: 1,
                            drawTicks: true,
                            tickLength: 10,
                            borderDash: [5, 5]
                        }
                    },
                    yTemp: {
                        title: {
                            display: true,
                            text: 'Temperature (°F)'
                        },
                        beginAtZero: true,
                        position: 'left'
                    },
                    yPower: {
                        title: {
                            display: true,
                            text: 'Power Level'
                        },
                        beginAtZero: true,
                        min: 0,
                        max: 100,
                        position: 'right',
                        grid: {
                            drawOnChartArea: false
                        },
                        ticks: {
                            callback: function(value) {
                                switch(value) {
                                    case 100:
                                        return 'P5';
                                    case 75:
                                        return 'P4';
                                    case 50:
                                        return 'P3';
                                    case 25:
                                        return 'P2';
                                    case 0:
                                        return 'P1';
                                    default:
                                        return '';
                                }
                            },
                            stepSize: 25
                        }
                    }
                }
            }
        });
        console.log("Temperature and Power Chart initialized.");
    } else {
        console.error("Canvas with ID 'temperatureChart' not found.");
    }

    // Pie Chart Initialization
    const pieCanvas = document.getElementById('pieChart');
    if (pieCanvas) {
        const pieCtx = pieCanvas.getContext('2d');
        pieChart = new Chart(pieCtx, {
            type: 'pie',
            data: {
                labels: ['Drying', 'Browning', 'Development'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: ['#ffe080', '#ffb060', '#ff8060']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, // Allow chart to fill container
                plugins: {
                    title: {
                        display: true,
                        text: 'Roast Phases'
                    },
                    legend: {
                        display: true,
                        position: 'right'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed;
                                const total = context.chart._metasets[context.datasetIndex].total;
                                const percentage = total ? ((value / total) * 100).toFixed(1) : 0;
                                return `${label}: ${formatTime(value * 1000)} (${percentage}%)`;
                            }
                        }
                    },
                    datalabels: {
                        formatter: function(value, context) {
                            const label = context.chart.data.labels[context.dataIndex];
                            const total = context.chart._metasets[context.datasetIndex].total;
                            const percentage = total ? ((value / total) * 100).toFixed(1) : 0;
                            const time = formatTime(value * 1000);
                            return `${time}\n${percentage}%`;
                        },
                        color: 'black',
                        font: {
                            size: 12
                        },
                        align: 'center',
                        anchor: 'center'
                    }
                }
            }
        });
        console.log("Pie Chart initialized.");
    } else {
        console.error("Canvas with ID 'pieChart' not found.");
    }
}

// Function to Setup Event Listeners
function setupEventListeners() {
    // Start Roast Button
    const startButton = document.getElementById('startRoast');
    if (startButton) {
        startButton.addEventListener('click', startRoast);
    } else {
        console.error("Start Roast button not found.");
    }

    // Reset Roast Button
    const resetButton = document.getElementById('resetRoast');
    if (resetButton) {
        resetButton.addEventListener('click', resetRoast);
    } else {
        console.error("Reset Roast button not found.");
    }

    // Power Level Buttons
    const powerButtons = document.querySelectorAll('.power-btn');
    powerButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const level = btn.getAttribute('data-level');
            changePowerLevel(level);
        });
    });

    // Toggle Drum Speed
    const toggleDrumBtn = document.getElementById('toggleDrumSpeed');
    if (toggleDrumBtn) {
        toggleDrumBtn.addEventListener('click', toggleDrumSpeed);
    } else {
        console.error("Toggle Drum Speed button not found.");
    }

    // Milestone Buttons
    const milestoneButtons = document.querySelectorAll('.milestone-btn');
    milestoneButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const eventName = btn.getAttribute('data-event');
            milestoneEvent(eventName);
        });
    });

    // Table Editing
    const roastTable = document.getElementById('roastTable');
    if (roastTable) {
        roastTable.addEventListener('dblclick', handleTableDoubleClick);
    } else {
        console.error("Roast Table not found.");
    }
}

// Timer Functions
function startRoast() {
    if (running) {
        console.log("Roast is already running.");
        return;
    }
    running = true;
    startTime = Date.now() - elapsedTime;
    timerInterval = setInterval(updateTimer, 1000);
    logEvent("Roast Started");

    // Initialize power level to P5 at 0:00
    temperatureChart.data.datasets.find(ds => ds.label === 'Power Level').data.push({ x: 0, y: powerMap['P5'] });
    temperatureChart.update();

    // Set currentPower to P5
    currentPower = 'P5';

    // Prompt for temperature at 0:00
    promptSensorData(0);
}

function resetRoast() {
    running = false;
    clearInterval(timerInterval);
    elapsedTime = 0;
    document.getElementById('timer').innerText = "00:00";

    // Clear Charts
    temperatureChart.data.datasets.forEach(dataset => dataset.data = []);
    temperatureChart.update();

    // Reset Pie Chart
    pieChart.data.datasets[0].data = [0, 0, 0];
    pieChart.update();

    // Reset Target Drop Times
    const dropTimesList = document.getElementById('dropTimesList');
    dropTimesList.innerHTML = `
        <li>15% → --:--</li>
        <li>17.5% → --:--</li>
        <li>20% → --:--</li>
        <li>22.5% → --:--</li>
        <li>25% → --:--</li>
    `;

    // Clear Table
    const roastTableBody = document.querySelector('#roastTable tbody');
    roastTableBody.innerHTML = '';

    // Clear Milestones
    dryEndTime = null;
    firstCrackTime = null;
    dropTime = null;

    // Clear Annotations
    temperatureChart.options.plugins.annotation.annotations = {};
    temperatureChart.update();

    // Reset currentPower to P5
    currentPower = 'P5';

    // Log Reset Event
    logEvent("Roast Reset");
}

function updateTimer() {
    elapsedTime = Date.now() - startTime;
    const totalSeconds = Math.floor(elapsedTime / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    document.getElementById('timer').innerText = `${pad(minutes)}:${pad(seconds)}`;

    // Update Pie Chart every second
    updatePieChart();

    // Plot power level every 30 seconds
    if (totalSeconds > 0 && totalSeconds % 30 === 0) {
        const exactMinutes = totalSeconds / 60;
        temperatureChart.data.datasets.find(ds => ds.label === 'Power Level').data.push({ x: exactMinutes, y: powerMap[currentPower] });
        temperatureChart.update();
    }

    // Prompt for sensor data every 30 seconds
    if (totalSeconds > 0 && totalSeconds % 30 === 0) {
        promptSensorData(totalSeconds);
    }
}

function pad(num) {
    return num.toString().padStart(2, '0');
}

// Power and Drum Functions
function changePowerLevel(level) {
    currentPower = level;
    const timeStr = document.getElementById('timer').innerText;
    logEvent(`${level} at ${timeStr}`);

    // Calculate exact time in minutes with decimals
    const exactMinutes = elapsedTime / 60000;

    // Update Power Data immediately
    temperatureChart.data.datasets.find(ds => ds.label === 'Power Level').data.push({ x: exactMinutes, y: powerMap[level] });
    temperatureChart.update();

    // Append note
    appendNote(timeStr, `${level} at ${timeStr}`);
}

function toggleDrumSpeed() {
    drumSpeed = drumSpeed === "Low" ? "High" : "Low";
    const timeStr = document.getElementById('timer').innerText;
    logEvent(`Drum ${drumSpeed} at ${timeStr}`);

    // Append note
    appendNote(timeStr, `Drum ${drumSpeed} at ${timeStr}`);
}

// Milestone Functions
function milestoneEvent(eventName) {
    const timeStr = document.getElementById('timer').innerText;
    logEvent(`${eventName} at ${timeStr}`);

    // Calculate exact time in minutes with decimals
    const exactMinutes = elapsedTime / 60000;

    if (eventName === "Dry End") {
        dryEndTime = elapsedTime / 1000;
    } else if (eventName === "First Crack") {
        firstCrackTime = elapsedTime / 1000;
        computeTargetDropTimes();
    } else if (eventName === "Drop") {
        dropTime = elapsedTime / 1000;
    }

    // Add annotation for the milestone
    addMilestoneAnnotation(eventName, exactMinutes);

    if (eventName === "Drop") {
        // Stop the roast without resetting
        running = false;
        clearInterval(timerInterval);
        logEvent("Roast Dropped");
    }

    // Append note
    appendNote(timeStr, `${eventName} at ${timeStr}`);
}

// Utility Functions
function getCurrentMinutes() {
    return elapsedTime / 60000;
}

function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${pad(minutes)}:${pad(seconds)}`;
}

// Logging Events and Data to Firestore
function logEvent(eventDescription) {
    const data = {
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        event: eventDescription
    };
    db.collection("roastEvents").add(data)
        .then(() => {
            console.log("Event logged:", eventDescription);
        })
        .catch(error => {
            console.error("Error logging event:", error);
        });
}

function logData(timeSec, sensorB, sensorA, notes) {
    const data = {
        time: timeSec,
        sensorB: sensorB,
        sensorA: sensorA,
        notes: notes,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };
    db.collection("roastLogs").add(data)
        .then(() => {
            console.log("Data logged:", data);
            addDataToTable(timeSec, sensorB, sensorA, notes);
            addDataToCharts(timeSec, sensorB, sensorA);
        })
        .catch(error => {
            console.error("Error logging data:", error);
        });
}

function log_data_point(interval_sec, sensorB, sensorA, note = "") {
    logData(interval_sec, sensorB, sensorA, note);
}

// Function to Prompt Sensor Data
function promptSensorData(totalSeconds) {
    const timeStr = `${pad(Math.floor(totalSeconds / 60))}:${pad(totalSeconds % 60)}`;
    const sensorB = prompt(`Enter Sensor B temperature at ${timeStr}:`);
    if (sensorB === null) return; // User cancelled
    const sensorA = prompt(`Enter Sensor A temperature at ${timeStr}:`);
    if (sensorA === null) return; // User cancelled

    const sensorBVal = parseFloat(sensorB);
    const sensorAVal = parseFloat(sensorA);

    if (isNaN(sensorBVal) || isNaN(sensorAVal)) {
        alert("Invalid input. Please enter numerical values.");
        return;
    }

    log_data_point(totalSeconds, sensorBVal, sensorAVal, "");
}

// Function to Add Data to Table
function addDataToTable(timeSec, sensorB, sensorA, notes) {
    const roastTableBody = document.querySelector('#roastTable tbody');
    const row = roastTableBody.insertRow();

    const cellTime = row.insertCell(0);
    const cellSensorB = row.insertCell(1);
    const cellSensorA = row.insertCell(2);
    const cellNotes = row.insertCell(3);

    const minutes = Math.floor(timeSec / 60);
    const seconds = timeSec % 60;
    cellTime.innerText = `${pad(minutes)}:${pad(seconds)}`;
    cellSensorB.innerText = sensorB;
    cellSensorA.innerText = sensorA;
    cellNotes.innerText = notes;
}

// Function to Add Data to Charts
function addDataToCharts(timeSec, sensorB, sensorA) {
    const timeMin = timeSec / 60;

    temperatureChart.data.datasets.find(ds => ds.label === 'Sensor B').data.push({ x: timeMin, y: sensorB });
    temperatureChart.data.datasets.find(ds => ds.label === 'Sensor A').data.push({ x: timeMin, y: sensorA });
    temperatureChart.update();
}

// Handling Table Double Click for Editing
function handleTableDoubleClick(event) {
    const table = document.getElementById('roastTable');
    const target = event.target;
    if (target.tagName !== 'TD') return;

    const row = target.parentElement;
    const cellIndex = target.cellIndex;
    if (cellIndex === 0) return; // Time column is not editable

    const originalValue = target.innerText;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = originalValue;
    input.style.width = '100%';
    target.innerHTML = '';
    target.appendChild(input);
    input.focus();

    input.addEventListener('blur', () => saveEdit(row, cellIndex, input.value));
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveEdit(row, cellIndex, input.value);
        }
    });
}

function saveEdit(row, cellIndex, newValue) {
    const oldValue = row.children[cellIndex].innerText;
    if (newValue === oldValue) {
        row.children[cellIndex].innerText = oldValue;
        return;
    }

    // Update in Firestore if needed
    // For simplicity, this example does not implement real-time syncing

    row.children[cellIndex].innerText = newValue;
    // Optionally, update local variables or perform additional actions
}

// Function to Append Note to the Last Data Row
function appendNote(timeStr, note) {
    const roastTableBody = document.querySelector('#roastTable tbody');
    if (roastTableBody.rows.length === 0) return;

    const lastRow = roastTableBody.rows[roastTableBody.rows.length - 1];
    const notesCell = lastRow.cells[3];
    if (notesCell.innerText === "") {
        notesCell.innerText = note;
    } else {
        notesCell.innerText += `, ${note}`;
    }
}

// Charts Updating Functions
function updatePieChart() {
    // Calculate phase durations
    let dryingDuration = 0;
    let browningDuration = 0;
    let developmentDuration = 0;

    if (dryEndTime === null && firstCrackTime === null && dropTime === null) {
        // Only Drying phase ongoing
        dryingDuration = elapsedTime / 1000;
    } else if (dryEndTime !== null && firstCrackTime === null && dropTime === null) {
        // Drying phase ended, Browning ongoing
        dryingDuration = dryEndTime;
        browningDuration = (elapsedTime / 1000) - dryEndTime;
    } else if (dryEndTime !== null && firstCrackTime !== null && dropTime === null) {
        // Browning phase ended, Development ongoing
        dryingDuration = dryEndTime;
        browningDuration = firstCrackTime - dryEndTime;
        developmentDuration = (elapsedTime / 1000) - firstCrackTime;
    } else if (dropTime !== null) {
        // All phases completed
        dryingDuration = dryEndTime;
        browningDuration = firstCrackTime - dryEndTime;
        developmentDuration = dropTime - firstCrackTime;
    }

    const totalTime = dryingDuration + browningDuration + developmentDuration;

    // Avoid division by zero
    const dryingPercentage = totalTime > 0 ? (dryingDuration / totalTime) * 100 : 0;
    const browningPercentage = totalTime > 0 ? (browningDuration / totalTime) * 100 : 0;
    const developmentPercentage = totalTime > 0 ? (developmentDuration / totalTime) * 100 : 0;

    // Update Pie Chart Data
    pieChart.data.datasets[0].data = [dryingDuration, browningDuration, developmentDuration];
    pieChart.update();

    // Update Target Drop Times
    displayTargetDropTimes();
}

function computeTargetDropTimes() {
    if (!firstCrackTime) return;

    targetDropPercentages.forEach(percent => {
        if (percent < 100) {
            const dropTimeSec = firstCrackTime / (1 - (percent / 100));
            targetDropTimes[percent] = dropTimeSec;
        } else {
            targetDropTimes[percent] = null;
        }
    });
}

function displayTargetDropTimes() {
    const dropTimesList = document.getElementById('dropTimesList');
    dropTimesList.innerHTML = '';
    targetDropPercentages.forEach(percent => {
        let timeStr = '--:--';
        if (targetDropTimes[percent] !== null && (elapsedTime / 1000) >= targetDropTimes[percent]) {
            const mm = Math.floor(targetDropTimes[percent] / 60);
            const ss = Math.floor(targetDropTimes[percent] % 60);
            timeStr = `${pad(mm)}:${pad(ss)}`;
        }
        dropTimesList.innerHTML += `<li>${percent}% → ${timeStr}</li>`;
    });
}

// Function to Add Annotation for Milestones
function addMilestoneAnnotation(eventName, exactMinutes) {
    const annotationId = `${eventName.replace(/\s/g, '')}_${exactMinutes.toFixed(2)}`;

    temperatureChart.options.plugins.annotation.annotations[annotationId] = {
        type: 'line',
        xMin: exactMinutes,
        xMax: exactMinutes,
        borderColor: 'gray',
        borderWidth: 2,
        borderDash: [5, 5],
        label: {
            enabled: true,
            content: eventName,
            position: 'start',
            backgroundColor: 'rgba(0,0,0,0.7)',
            color: 'white',
            font: {
                size: 12
            },
            yAdjust: -10
        }
    };

    temperatureChart.update();
}
