// utils.js

/**
 * Formats milliseconds into "MM:SS" string.
 * @param {number} ms - Milliseconds.
 * @returns {string} - Formatted time string.
 */
export function formatTime(ms) {
    const s = Math.floor(ms / 1000);
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${pad(mm)}:${pad(ss)}`;
}

/**
 * Formats seconds into "MM:SS" string.
 * @param {number} sec - Seconds.
 * @returns {string} - Formatted time string.
 */
export function formatTimeString(sec) {
    const mm = Math.floor(sec / 60);
    const ss = sec % 60;
    return `${pad(mm)}:${pad(ss)}`;
}

/**
 * Pads a number with leading zero if less than 10.
 * @param {number} num - Number to pad.
 * @returns {string} - Padded string.
 */
export function pad(num) {
    return num.toString().padStart(2, "0");
}

/**
 * Converts a "MM:SS" string to seconds.
 * @param {string} str - Time string.
 * @returns {number} - Total seconds.
 */
export function convertTimeStringToSeconds(str) {
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

/**
 * Generates a unique Annotation ID based on the event name and time in seconds.
 * @param {string} name - The name of the milestone event.
 * @param {number} noteSec - The time in seconds when the event occurs.
 * @returns {string} - A unique annotation ID.
 */
export function makeAnnID(name, noteSec) {
    // Replace spaces with underscores and concatenate with timeSec
    return `${name.replace(/\s+/g, '_')}_${noteSec}`;
}
