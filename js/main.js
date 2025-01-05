// main.js

import { initializeFirebase } from '../firebase-config.js';
import { initializeCharts } from './chartHandler.js';
import { setupEventListeners } from './uiHandler.js';
import { initializeTimer } from './timer.js';
import { loadDataOnStart } from './dataHandler.js';

// Initialize Firebase
initializeFirebase();

// Initialize Charts
initializeCharts();

// Initialize Timer
initializeTimer();

// Setup UI Event Listeners
setupEventListeners();

// Load previously saved data on startup
loadDataOnStart();
