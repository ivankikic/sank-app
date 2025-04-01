import { useState } from "react";
import { format } from "date-fns";
import { hr } from "date-fns/locale";
import * as XLSX from "xlsx";
import { toast } from "react-hot-toast";

const ExportModal = ({
  isOpen,
  onClose,
  onExport,
  startDate,
  endDate,
  setStartDate,
  setEndDate,
}) => {
  if (!isOpen) return null;

  const handleStartDateChange = (e) => {
    setStartDate(e.target.value);
  };

  const handleEndDateChange = (e) => {
    setEndDate(e.target.value);
  };

  const handleExport = () => {
    if (!startDate || !endDate) {
      toast.error("Molimo odaberite datume za export");
      return;
    }
    onExport(startDate, endDate);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Export podataka
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
              Od datuma
            </label>
            <input
              type="date"
              value={startDate || ""}
              onChange={handleStartDateChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
              Do datuma
            </label>
            <input
              type="date"
              value={endDate || ""}
              onChange={handleEndDateChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            Odustani
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
          >
            Preuzmi Excel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
