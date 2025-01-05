// uiHandler.js

import { formatTimeString, convertTimeStringToSeconds, pad } from './utils.js';
import { saveTableData, loadTableData } from './dataHandler.js';
import { temperatureChart, pieChart, powerMap, powerPoints, targetDropPercentages, targetDropTimes } from './chartHandler.js';
import { db } from '../firebase/firebase-config.js';

/** 
 * Sets up all UI event listeners.
 */
export function setupEventListeners() {
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
        return function(...args) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => func.apply(this, args), delay);
        }
    }

    // Power buttons in normal mode with debounced event handler
    document.querySelectorAll(".power-btn").forEach(btn => {
        btn.addEventListener("click", debounce(() => {
            if (!manualMode) changePowerLevel(btn.getAttribute("data-level"));
        }, 300)); // 300ms delay
    });

    // Toggle drum speed in normal mode with debounced event handler
    const drumBtn = document.getElementById("toggleDrumSpeed");
    if (drumBtn) {
        drumBtn.addEventListener("click", debounce(() => {
            if (!manualMode) toggleDrumSpeed();
        }, 300)); // 300ms delay
    }

    // Milestone buttons in normal mode with debounced event handler
    document.querySelectorAll(".milestone-btn").forEach(btn => {
        btn.addEventListener("click", debounce(() => {
            if (!manualMode) milestoneEvent(btn.getAttribute("data-event"));
        }, 300)); // 300ms delay
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

    // Save and Load Buttons (New Features)
    const saveButton = document.getElementById("saveButton");
    if (saveButton) {
        saveButton.addEventListener("click", saveTableData);
    }

    const loadButton = document.getElementById("loadButton");
    if (loadButton) {
        loadButton.addEventListener("click", loadTableData);
    }
}

// Rest of the existing UI handling functions...
// For brevity, only key functions are included here. Ensure all existing functions are moved appropriately.

/**
 * Adds data to the table from existing code.
 */
export function addDataToTable(timeSec, sensorB, sensorA, notes) {
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

/**
 * Handles table cell clicks for editing.
 */
function handleTableClick(e) {
    if (e.target.tagName !== "TD") return;
    if (e.target.cellIndex === 0) return; 
    const row = e.target.parentElement;
    if (row.cells[0].innerText === "Charge") return;

    // Prevent multiple input boxes
    if (e.target.querySelector('input')) return;

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

/**
 * Saves edited cell data.
 */
function saveEdit(row, cellIndex, newVal) {
    row.cells[cellIndex].innerText = newVal;

    const tSec = parseInt(row.dataset.timeSec, 10);

    if (cellIndex === 1 || cellIndex === 2) {
        // B or A sensor value changed
        const bVal = parseFloat(row.cells[1].innerText.trim());
        const aVal = parseFloat(row.cells[2].innerText.trim());
        if (!isNaN(bVal) && !isNaN(aVal)) {
            addOrReplaceChartData(tSec, bVal, aVal);
        }
    } else if (cellIndex === 3) {
        // Note changed => rebuild powerPoints and update chart
        const newNote = row.cells[3].innerText.trim();
        row.dataset.oldNote = newNote; // Update oldNote

        // Rebuild powerPoints from the updated table
        rebuildPowerPoints();
    }

    updatePieChart();
}

/**
 * Appends a note to the last row in the table.
 */
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

// Add other necessary UI functions similarly...
