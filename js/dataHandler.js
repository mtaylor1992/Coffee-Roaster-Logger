// dataHandler.js

import { collection, getDocs, query, orderBy, limit, addDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { db } from '../firebase/firebase-config.js';
import { addDataToTable } from './uiHandler.js';
import { rebuildPowerPoints } from './timer.js';

/**
 * Saves the current table data to Firebase Firestore.
 * This function can be called manually or automatically based on your requirements.
 */
export function saveTableData() {
    const tbody = document.querySelector("#roastTable tbody");
    if (!tbody) return;

    const tableData = [];
    for (let i = 0; i < tbody.rows.length; i++) {
        const row = tbody.rows[i];
        const time = row.cells[0].innerText;
        const sensorB = parseFloat(row.cells[1].innerText) || null;
        const sensorA = parseFloat(row.cells[2].innerText) || null;
        const notes = row.cells[3].innerText;

        tableData.push({ time, sensorB, sensorA, notes });
    }

    // Save to Firestore
    const roastTableRef = collection(db, "roastTableData");
    addDoc(roastTableRef, {
        timestamp: new Date(),
        data: tableData,
    })
        .then(() => {
            alert("Table data saved successfully!");
        })
        .catch(err => console.error("Error saving table data:", err));
}

/**
 * Loads the latest table data from Firebase Firestore and populates the table.
 */
export async function loadTableData() {
    try {
        const roastTableRef = collection(db, "roastTableData");
        const q = query(roastTableRef, orderBy("timestamp", "desc"), limit(1));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            console.log("No saved table data found.");
            return;
        }

        const doc = snapshot.docs[0];
        const tableData = doc.data().data;

        // Clear existing table
        const tbody = document.querySelector("#roastTable tbody");
        if (tbody) tbody.innerHTML = "";

        // Populate table with loaded data
        tableData.forEach(rowData => {
            addDataToTableFromLoad(rowData);
        });

        alert("Table data loaded successfully!");
    } catch (error) {
        console.error("Error loading table data:", error);
    }
}

/**
 * Adds data to the table when loading from Firestore.
 * @param {object} rowData - The data for the row.
 */
function addDataToTableFromLoad(rowData) {
    const tbody = document.querySelector("#roastTable tbody");
    if (!tbody) return;

    const row = tbody.insertRow();
    row.dataset.timeSec = convertTimeStringToSeconds(rowData.time);
    row.dataset.oldNote = rowData.notes || "";

    row.insertCell(0).innerText = rowData.time;
    row.insertCell(1).innerText = rowData.sensorB;
    row.insertCell(2).innerText = rowData.sensorA;
    row.insertCell(3).innerText = rowData.notes;
}

/**
 * Converts a "MM:SS" string to seconds.
 * @param {string} str - Time string.
 * @returns {number} - Total seconds.
 */
function convertTimeStringToSeconds(str) {
    const parts = str.split(":").map(Number);
    if (parts.length !== 2) return 0;
    return parts[0] * 60 + parts[1];
}

export function logEvent(desc) {
    // Example Firestore logging if needed
    db.collection("roastEvents").add({
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      event: desc
    }).catch(err => console.error("Error logging event:", err));
}

/**
 * Logs data to Firestore (existing functionality).
 * @param {number} timeSec - Time in seconds.
 * @param {number} sensorB - Sensor B value.
 * @param {number} sensorA - Sensor A value.
 * @param {string} notes - Notes.
 * @param {boolean} addToTable - Whether to add to table.
 */
export function logData(timeSec, sensorB, sensorA, notes, addToTable = true) {
    const payload = {
        time: formatTimeString(timeSec),
        sensorB,
        sensorA,
        notes,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };
    db.collection("roastLogs").add(payload)
        .then(() => {
            // Only add row to table if not manual
            if (!manualMode && addToTable) {
                addDataToTable(timeSec, sensorB, sensorA, notes);
            }
            addOrReplaceChartData(timeSec, sensorB, sensorA);
        })
        .catch(err => console.error("Error logging data:", err));
}

export function promptSensorData(totalSec) {
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

/**
 * Loads data on application start.
 */
export function loadDataOnStart() {
    // Optionally, load table data when the app starts
    loadTableData();
}
