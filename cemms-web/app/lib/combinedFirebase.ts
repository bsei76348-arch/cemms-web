// app/lib/combinedFirebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// 1. ORIGINAL CEMMS PROJECT (mobile app)
const cemmsConfig = {
  apiKey: "AIzaSyBZpezoGJlP7Wb10UJeoDf7zwgY_gHFey0",
  authDomain: "cemms-9e6ca.firebaseapp.com",
  projectId: "cemms-9e6ca",
  storageBucket: "cemms-9e6ca.firebasestorage.app",
  messagingSenderId: "527024069469",
  appId: "1:527024069469:web:57eba4d265899a1f22e6b4"
};

// 2. NEW CEMMS WEB PROJECT (admin web inputs)
const cemmsWebConfig = {
  apiKey: "AIzaSyCe-JFCmM_pH4auGWS6LI4KTwrP9lzUxrU",
  authDomain: "cemms-web-db.firebaseapp.com",
  projectId: "cemms-web-db",
  storageBucket: "cemms-web-db.firebasestorage.app",
  messagingSenderId: "258792593520",
  appId: "1:258792593520:web:0ced76e982dbda68d37cb5"
};

// 3. WASTE TRACKER PROJECT
const wasteTrackerConfig = {
  apiKey: "AIzaSyBGSHIzJCNtYrt_gqskI9yMwl-jYJbF1H4",
  authDomain: "cemms-waste-tracker.firebaseapp.com",
  projectId: "cemms-waste-tracker",
  storageBucket: "cemms-waste-tracker.firebasestorage.app",
  messagingSenderId: "450686041437",
  appId: "1:450686041437:web:a7c1b457fb3711af167cb4"
};

// Initialize apps (with unique names)
const cemmsApp = !getApps().some(app => app.name === 'cemms') 
  ? initializeApp(cemmsConfig, 'cemms') 
  : getApp('cemms');

const cemmsWebApp = !getApps().some(app => app.name === 'cemmsWeb') 
  ? initializeApp(cemmsWebConfig, 'cemmsWeb') 
  : getApp('cemmsWeb');

const wasteTrackerApp = !getApps().some(app => app.name === 'wasteTracker') 
  ? initializeApp(wasteTrackerConfig, 'wasteTracker') 
  : getApp('wasteTracker');

// Auth (gamitin ang original CEMMS app para parehong user account)
export const auth = getAuth(cemmsApp);

// Firestore instances
export const mobileDb = getFirestore(cemmsApp);       // calculations (mobile)
export const webCemmsDb = getFirestore(cemmsWebApp); // emissions (web)
export const wasteWatchDb = getFirestore(wasteTrackerApp); // waste_records

// Aliases para sa backward compatibility (kung may ibang files na gumagamit)
export const cemmsDb = mobileDb;   // para hindi masira ang existing imports
export const originalDb = mobileDb;