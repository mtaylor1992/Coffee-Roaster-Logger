// chartHandler.js

import { makeAnnID, pad, formatTimeString } from './utils.js';
import { db } from '../firebase/firebase-config.js';

/** 
 * Initialize all charts.
 */
export function initializeCharts() {
    initializeTemperatureChart();
    initializePieChart();
}

/** ========== CHART VARIABLES ==========
 * Declare chart variables to be used across functions.
 */
let temperatureChart;
let pieChart;

// Target Drop Times
const targetDropPercentages = [15, 17.5, 20, 22.5, 25];
let targetDropTimes = {};

// Power map
const powerMap = { P5: 100, P4: 75, P3: 50, P2: 25, P1: 0 };

// Power Points Array
let powerPoints = []; // Array of {x: time in minutes, y: power level}

// Milestones
let dryEndTime = null;
let firstCrackTime = null;
let dropTime = null;

// Flag to prevent duplicate milestone processing
let isProcessingMilestone = false;

/** ========== INITIALIZE TEMPERATURE CHART ========== **/
function initializeTemperatureChart() {
    const canvas = document.getElementById("temperatureChart");
    if (!canvas) return;

    // Get the computed font size of the table title
    const tableTitle = document.querySelector(".table-section h3");
    const computedStyle = window.getComputedStyle(tableTitle);
    const fontSizeEm = parseFloat(computedStyle.fontSize) / parseFloat(getComputedStyle(document.body).fontSize);
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
                        weight: 'bold' // Optional: Make the title bold
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
            },
            // Add or modify the animation settings here
            animation: {
                duration: 0, // Disables animations
                easing: 'linear' // Optional: makes updates smoother if animations are enabled
            }
        }
    });
}

/** ========== INITIALIZE PIE CHART ========== **/
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
                title: { display: true, text: "Roast Phases" , color: "black"},
                datalabels: {
                    // Updated formatter to show labels only for active slices
                    formatter: (value, ctx) => {
                        const total = ctx.chart.data.datasets[ctx.datasetIndex].data.reduce((a, b) => a + b, 0);
                        if (total === 0 || value === 0) return ""; // Hide label if slice is inactive
                        let pct = ((value / total) * 100).toFixed(1) + "%";
                        const label = ctx.chart.data.labels[ctx.dataIndex] || "";
                        const timeStr = formatTime(value * 1000);
                        // Return multi-line string without HTML tags
                        return `${label}\n${timeStr}\n${pct}`;
                    },
                    font: { size: 12, weight: 'bold' }, // Set font weight to bold
                    color: "black",
                    align: "center",
                    anchor: "center"
                },
                tooltip: { enabled: false }
            }
        }
    });
}

/** ========== EXPORT FUNCTIONS ==========
 * Export necessary functions and variables for other modules to use.
 */

export { temperatureChart, pieChart, powerMap, powerPoints, targetDropPercentages, targetDropTimes, dryEndTime, firstCrackTime, dropTime, isProcessingMilestone };

/**
 * Removes a single data point from chart by x-value.
 * @param {string} label - The label of the dataset.
 * @param {number} xVal - The x-value to remove.
 */
export function removeChartPoint(label, xVal) {
    const ds = temperatureChart.data.datasets.find(d => d.label === label);
    if (!ds) return;
    const idx = ds.data.findIndex(pt => pt.x === xVal);
    if (idx !== -1) ds.data.splice(idx, 1);
}

/**
 * Sorts all datasets by x-value.
 */
export function sortAllDatasets() {
    temperatureChart.data.datasets.forEach(ds => {
        ds.data.sort((a, b) => a.x - b.x);
    });
    temperatureChart.update();
}

/**
 * Adds or replaces chart data.
 * @param {number} timeSec - Time in seconds.
 * @param {number} sensorB - Sensor B value.
 * @param {number} sensorA - Sensor A value.
 */
export function addOrReplaceChartData(timeSec, sensorB, sensorA) {
    const xVal = timeSec / 60;
    removeChartPoint("Sensor B", xVal);
    removeChartPoint("Sensor A", xVal);

    temperatureChart.data.datasets
        .find(ds => ds.label === "Sensor B")
        .data.push({ x: xVal, y: sensorB });
    temperatureChart.data.datasets
        .find(ds => ds.label === "Sensor A")
        .data.push({ x: xVal, y: sensorA });

    sortAllDatasets();
    temperatureChart.update();
}

/**
 * Updates the Power Level dataset on the Temperature chart.
 */
export function updatePowerDataset() {
    const powerDataset = temperatureChart.data.datasets.find(ds => ds.label === "Power Level");
    if (!powerDataset) return;

    // Clone and sort powerPoints to avoid mutation issues
    powerDataset.data = powerPoints.slice().sort((a, b) => a.x - b.x);

    // Determine currentPower based on precise elapsed time
    const currentTimeMin = elapsedTime / 60000; // Convert ms to minutes (float)
    const relevantPowerPoints = powerPoints.filter(p => p.x <= currentTimeMin);

    if (relevantPowerPoints.length > 0) {
        const latestPowerPoint = relevantPowerPoints[relevantPowerPoints.length - 1];
        currentPower = getPowerLevelFromValue(latestPowerPoint.y); // Convert y back to P1-P5
    } else {
        currentPower = "P5"; // Default power level
    }

    temperatureChart.update();
}

/**
 * Helper function to get power level string from y-value.
 * @param {number} y - The y-value representing power level.
 * @returns {string} - The corresponding power level (P1-P5).
 */
export function getPowerLevelFromValue(y) {
    for (const [key, value] of Object.entries(powerMap)) {
        if (value === y) return key;
    }
    return "P5"; // default
}

/**
 * Adds a milestone annotation to the temperature chart.
 * @param {string} name - Name of the milestone.
 * @param {number} xVal - X-axis value (time in minutes).
 */
export function addMilestoneAnnotation(name, xVal) {
    const noteSec = Math.round(xVal * 60);
    const annID = makeAnnID(name, noteSec);

    // Check if the annotation already exists
    if (temperatureChart.options.plugins.annotation.annotations[annID]) {
        console.warn(`Annotation ${annID} already exists. Skipping addition.`);
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

    console.log(`Adding milestone annotation: ${name} at ${xVal} minutes`);
}

/**
 * Updates the pie chart based on current milestones and elapsed time.
 */
export function updatePieChart() {
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

/**
 * Displays target drop times in the UI.
 */
export function displayTargetDropTimes() {
    const dropList = document.getElementById("dropTimesList");
    if (!dropList) return;
    dropList.innerHTML = "";
    targetDropPercentages.forEach(p => {
        let timeStr = "--:--";
        if (targetDropTimes[p]) {
            timeStr = formatTimeString(Math.floor(targetDropTimes[p] * 1000));
        }
        dropList.innerHTML += `<li>${p}% → ${timeStr}</li>`;
    });
}

/**
 * Resets drop times UI.
 */
export function resetDropTimesUI() {
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

/**
 * Finds the maximum time in seconds from manual entries.
 * @returns {number} - Maximum time in seconds.
 */
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
