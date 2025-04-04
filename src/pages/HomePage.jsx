import { useState, useCallback, useEffect } from "react";
import ExcelUploader from "../components/ExcelUploader";
import ManualEntry from "../components/ManualEntry";
import LogList from "../components/LogList";
import ConfirmationModal from "../components/ConfirmationModal";

function HomePage() {
  const [refreshLogs, setRefreshLogs] = useState(0);
  const [activeTab, setActiveTab] = useState("excel"); // "excel" ili "manual"
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingTabChange, setPendingTabChange] = useState(null);

  const handleLogAdded = () => {
    setRefreshLogs((prev) => prev + 1);
  };

  const handleDirtyStateChange = useCallback((isDirty) => {
    setHasUnsavedChanges(isDirty);
  }, []);

  // Funkcija za provjeru prije promjene taba
  const handleTabChange = (newTab) => {
    if (hasUnsavedChanges) {
      setPendingTabChange(newTab);
      setShowConfirmModal(true);
    } else {
      setActiveTab(newTab);
    }
  };

  const handleConfirmNavigation = () => {
    setActiveTab(pendingTabChange);
    setHasUnsavedChanges(false);
    setShowConfirmModal(false);
    setPendingTabChange(null);
  };

  const handleCancelNavigation = () => {
    setShowConfirmModal(false);
    setPendingTabChange(null);
  };

  // Dodaj useEffect za praćenje navigacije
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  return (
    <div className="max-w-[1350px] mx-auto px-6">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Početna</h1>
          <p className="text-sm text-gray-500 mt-1">Unos dnevnih podataka</p>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex">
              <button
                onClick={() => handleTabChange("excel")}
                className={`w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm ${
                  activeTab === "excel"
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Excel Import
              </button>
              <button
                onClick={() => handleTabChange("manual")}
                className={`w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm ${
                  activeTab === "manual"
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Ručni unos
              </button>
            </nav>
          </div>

          {activeTab === "excel" ? (
            <ExcelUploader onLogAdded={handleLogAdded} />
          ) : (
            <ManualEntry
              onLogAdded={handleLogAdded}
              onDirtyStateChange={handleDirtyStateChange}
            />
          )}
        </div>

        <LogList refreshTrigger={refreshLogs} />
      </div>

      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={handleCancelNavigation}
        onConfirm={handleConfirmNavigation}
        title="Nesačuvane promjene"
        message="Imate nesačuvane promjene. Jeste li sigurni da želite napustiti stranicu? Sve nesačuvane promjene će biti izgubljene."
      />
    </div>
  );
}

export default HomePage;
