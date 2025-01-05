// main.js

import { initializeFirebase } from '../firebase/firebase-config.js';
import { initializeCharts } from './chartHandler.js';
import { setupEventListeners } from './uiHandler.js';
import { loadDataOnStart } from './dataHandler.js';

// Initialize Firebase
initializeFirebase();

// Initialize Charts
initializeCharts();

// Setup UI Event Listeners
setupEventListeners();

// Load previously saved data on startup
loadDataOnStart();
