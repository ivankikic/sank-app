import React, { useState, useCallback, useEffect } from "react";
import ExcelUploader from "../components/ExcelUploader";
import ManualEntry from "../components/ManualEntry";
import LogList from "../components/LogList";
import ConfirmationModal from "../components/ConfirmationModal";

function HomePage() {
  const [refreshLogs, setRefreshLogs] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [pendingCopyData, setPendingCopyData] = useState(null);

  const handleLogAdded = () => {
    setRefreshLogs((prev) => prev + 1);
    // Zatvori Excel modal ako je otvoren
    setShowExcelModal(false);
  };

  const handleDirtyStateChange = useCallback((isDirty) => {
    setHasUnsavedChanges(isDirty);
  }, []);

  const handleCopyFromLog = (log) => {
    setPendingCopyData(log);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDataCopied = () => {
    setPendingCopyData(null);
  };

  // Modal za Excel import
  const ExcelModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Unos Excela</h3>
          <button
            onClick={() => setShowExcelModal(false)}
            className="text-gray-400 hover:text-gray-500"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <ExcelUploader onLogAdded={handleLogAdded} />
      </div>
    </div>
  );

  return (
    <div className="max-w-[1350px] mx-auto px-6">
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <div className="flex flex-col justify-start items-start">
            <h1 className="text-2xl font-semibold text-gray-900">
              Unos podataka
            </h1>
            <p className="text-sm text-gray-500 mt-1">Dnevni unos stanja</p>
          </div>
          <button
            onClick={() => setShowExcelModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            <svg
              className="h-5 w-5 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Unos Excela
          </button>
        </div>

        <div className="bg-white rounded-lg shadow">
          <ManualEntry
            onLogAdded={handleLogAdded}
            onDirtyStateChange={handleDirtyStateChange}
            initialCopyData={pendingCopyData}
            onDataCopied={handleDataCopied}
          />
        </div>

        <LogList refreshTrigger={refreshLogs} onCopyLog={handleCopyFromLog} />
      </div>

      {showExcelModal && <ExcelModal />}

      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={() => {
          setShowConfirmModal(false);
          setHasUnsavedChanges(false);
        }}
        title="Nesačuvane promjene"
        message="Imate nesačuvane promjene. Jeste li sigurni da želite napustiti stranicu? Sve nesačuvane promjene će biti izgubljene."
      />
    </div>
  );
}

export default HomePage;
