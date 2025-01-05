// timer.js

import { formatTimeString, convertTimeStringToSeconds } from './utils.js';
import { logEvent, promptSensorData, addDataToTable } from './dataHandler.js';
import { temperatureChart, pieChart, powerMap, powerPoints, updatePowerDataset, sortAllDatasets, updatePieChart, updateChartTitle, resetRoastAll } from './chartHandler.js';

/**
 * Timer Variables
 */
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

// Flag to prevent duplicate milestone processing
let isProcessingMilestone = false;

/**
 * Starts the roast timer.
 */
export function startRoast() {
    if (manualMode) return;
    if (!checkBeanAndWeight()) return;

    if (running) {
        console.log("Already running.");
        return;
    }
    running = true;
    startTime = Date.now() - elapsedTime;
    timerInterval = setInterval(updateTimer, 200);

    logEvent("Roast Started");

    // Start power P5 at 0:00
    powerPoints.push({ x: 0, y: powerMap["P5"] });
    currentPower = "P5";
    updatePowerDataset();
    sortAllDatasets();
    temperatureChart.update();

    promptSensorData(0);
    updateChartTitle();
}

/**
 * Updates the timer every interval.
 */
function updateTimer() {
    if (!running) return;
    elapsedTime = Date.now() - startTime;
    const totalSec = Math.floor(elapsedTime / 1000);
    document.getElementById("timer").innerText = formatTimeString(totalSec);

    updatePieChart(); // Always update pie chart every second

    // Update temperature chart every 30 seconds
    if (totalSec > 0 && totalSec % 30 === 0) {
        const xVal = totalSec / 60;
        powerPoints.push({ x: xVal, y: powerMap[currentPower] });
        updatePowerDataset();
        sortAllDatasets();
        temperatureChart.update(); // Update without animation as configured

        promptSensorData(totalSec);
    }

    // Ensure powerPoints covers up to current time
    ensurePowerPointAtCurrentTime();
}

/**
 * Resets the roast timer and related data.
 */
export function resetRoast(partial = false) {
    running = false;
    clearInterval(timerInterval);
    elapsedTime = 0;
    document.getElementById("timer").innerText = "00:00";

    // Clear chart data
    temperatureChart.data.datasets.forEach(ds => ds.data = []);
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
    manualRowTimeSec = 0;  

    // Clear power points array
    powerPoints = [];
    updatePowerDataset();

    if (!partial) logEvent("Roast Reset");
}

/**
 * Resets all roast data and inputs.
 */
export function resetRoastAll() {
    resetRoast();
    document.getElementById("beanType").value = "";
    document.getElementById("startWeight").value = "";
    document.getElementById("endWeight").value = "";
    const manualBox = document.getElementById("manualModeCheckbox");
    if (manualBox) manualBox.checked = false;
}

/**
 * Ensures that the powerPoints array covers up to the current elapsed time.
 */
function ensurePowerPointAtCurrentTime() {
    const currentTimeMin = elapsedTime / 60000;
    const lastPowerPoint = powerPoints[powerPoints.length - 1];

    // Add a power point at the current time if the last power point is before the current time
    if (lastPowerPoint.x < currentTimeMin) {
        powerPoints.push({ x: currentTimeMin, y: powerMap[currentPower] });
        updatePowerDataset();
    }
}

/**
 * Checks if Bean Type and Start Weight are entered.
 */
function checkBeanAndWeight() {
    const beanVal = (document.getElementById("beanType")?.value || "").trim();
    const startW = (document.getElementById("startWeight")?.value || "").trim();
    if (!beanVal || !startW) {
        alert("Please enter Bean Type and Start Weight first.");
        return false;
    }
    return true;
}

/**
 * Auto-adds Charge row if charge temp is typed but Enter is not pressed.
 */
export function autoAddChargeIfTyped() {
    const chargeTempInput = document.getElementById("chargeTemp");
    if (!chargeTempInput) return;
    const val = parseFloat(chargeTempInput.value.trim());
    if (!isNaN(val)) {
        setOrUpdateChargeRow(val);
    }
}

/**
 * Sets or updates the Charge row in the table.
 * @param {number} tempVal - Charge temperature value.
 */
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

/**
 * Toggles delete buttons visibility based on manual mode.
 */
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

/**
 * Enables manual mode.
 */
function enableManualMode() {
    document.querySelectorAll(".buttons button").forEach(btn => {
        if (btn.id !== "resetRoast") btn.disabled = true;
    });

    running = false;   
    elapsedTime = 0;
    manualMode = true;
    manualRowTimeSec = 0;  

    addManualRow(); 
    updateChartTitle();
}

/**
 * Adds a manual row to the table.
 */
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
                maybeAddPowerPoint(row);

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

    // Rebuild powerPoints after adding a manual row
    rebuildPowerPoints();
}

/**
 * Removes a row and its associated data.
 */
function removeRowAndData(row) {
    row.parentElement.removeChild(row);
    toggleDeleteButtons();

    // Rebuild powerPoints from the remaining table entries
    rebuildPowerPoints();

    // Update the chart and pie chart
    sortAllDatasets();
    temperatureChart.update();
    updatePieChart();
}

/**
 * Rebuilds power points based on current table data.
 */
export function rebuildPowerPoints() {
    const tbody = document.querySelector("#roastTable tbody");
    if (!tbody) return;

    // Reset powerPoints array
    powerPoints = [];

    // Always start with P5 at 0:00
    powerPoints.push({ x: 0, y: powerMap["P5"] });

    // Reset milestones
    dryEndTime = null;
    firstCrackTime = null;
    dropTime = null;

    // Clear existing milestone annotations
    temperatureChart.options.plugins.annotation.annotations = {};

    // Iterate through each row to extract power changes and milestones
    for (let i = 0; i < tbody.rows.length; i++) {
        const row = tbody.rows[i];
        if (row.cells[0].innerText === "Charge") continue; // Skip Charge row

        const note = row.cells[3].innerText;
        const tSec = parseInt(row.dataset.timeSec, 10);
        const xVal = tSec / 60; // Convert seconds to minutes

        // Parse power changes
        const powerData = parsePowerChange(note);
        if (powerData) {
            const { powerLevel, timeMin } = powerData;

            // Prevent duplicate entries at the same time
            const exists = powerPoints.some(p => p.x === timeMin && p.y === powerMap[powerLevel]);
            if (!exists) {
                powerPoints.push({ x: timeMin, y: powerMap[powerLevel] });
            }
        }

        // Parse milestones
        const milestones = parseMilestones(note);

        if (milestones.dryEnd) {
            dryEndTime = milestones.dryEnd;
            addMilestoneAnnotation("Dry End", milestones.dryEnd / 60);
        }

        if (milestones.firstCrack) {
            firstCrackTime = milestones.firstCrack;
            addMilestoneAnnotation("First Crack", milestones.firstCrack / 60);
            computeTargetDropTimes();
        }

        if (milestones.drop) {
            dropTime = milestones.drop;
            addMilestoneAnnotation("Drop", milestones.drop / 60);
            // Stop the timer if Drop milestone is reached
            running = false;
            clearInterval(timerInterval);
            logEvent("Roast Dropped");
        }
    }

    // Sort powerPoints by time
    powerPoints.sort((a, b) => a.x - b.x);

    // Update the chart dataset
    updatePowerDataset();

    // Ensure a power point at the current elapsed time
    ensurePowerPointAtCurrentTime();
}

/**
 * Parses power change from note.
 * @param {string} note - Note string.
 * @returns {object|null} - Power level and time if matched, else null.
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
 * Parses milestones from note.
 * @param {string} note - Note string.
 * @returns {object} - Milestone times.
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
