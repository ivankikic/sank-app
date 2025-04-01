import { Routes, Route } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import Header from "./components/Header";
import HomePage from "./pages/HomePage";
import ArtikliPage from "./pages/ArtikliPage";
import StanjePage from "./pages/StanjePage";
import StatistikaPage from "./pages/StatistikaPage";
import LockScreen from "./components/LockScreen";
import SettingsPage from "./pages/SettingsPage";
import "./App.css";
import { getDoc, doc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

function App() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [appSettings, setAppSettings] = useState(null);

  // Dohvati postavke iz baze
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, "settings", "appSettings"));
        if (settingsDoc.exists()) {
          setAppSettings(settingsDoc.data());
        } else {
          // Ako postavke ne postoje, kreiraj ih s default vrijednostima
          const defaultSettings = {
            appLock: {
              enabled: true,
              autoLockTimeout: 30, // 30 minuta default
            },
            stockAlerts: {
              enabled: true,
            },
          };
          await setDoc(doc(db, "settings", "appSettings"), defaultSettings);
          setAppSettings(defaultSettings);
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      }
    };
    fetchSettings();
  }, []);

  // Provjeri je li aplikacija otključana
  useEffect(() => {
    const unlocked = localStorage.getItem("app_unlocked") === "true";
    setIsUnlocked(unlocked);
    setIsLoading(false);
  }, []);

  const handleLock = useCallback(() => {
    localStorage.removeItem("app_unlocked");
    setIsUnlocked(false);
  }, []);

  const handleUnlock = () => {
    localStorage.setItem("app_unlocked", "true");
    setIsUnlocked(true);
  };

  // Automatsko zaključavanje nakon neaktivnosti
  useEffect(() => {
    if (!isUnlocked || !appSettings?.appLock?.enabled) return;

    const INACTIVE_TIMEOUT = appSettings.appLock.autoLockTimeout * 60 * 1000;
    let inactivityTimer;

    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(handleLock, INACTIVE_TIMEOUT);
    };

    // Eventi koji resetiraju timer
    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
    ];

    events.forEach((event) => {
      document.addEventListener(event, resetTimer);
    });

    // Postavi inicijalni timer
    resetTimer();

    // Cleanup
    return () => {
      clearTimeout(inactivityTimer);
      events.forEach((event) => {
        document.removeEventListener(event, resetTimer);
      });
    };
  }, [isUnlocked, appSettings, handleLock]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  // Prikaži lock screen samo ako je zaključavanje omogućeno u postavkama
  if (!isUnlocked && appSettings?.appLock?.enabled) {
    return <LockScreen onUnlock={handleUnlock} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onLock={handleLock} />{" "}
      <main className="py-6">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/artikli" element={<ArtikliPage />} />
          <Route path="/stanje" element={<StanjePage />} />
          <Route path="/statistika" element={<StatistikaPage />} />
          <Route path="/postavke" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
