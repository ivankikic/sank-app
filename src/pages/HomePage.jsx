import { useState } from "react";
import ExcelUploader from "../components/ExcelUploader";
import LogList from "../components/LogList";

function HomePage() {
  const [refreshLogs, setRefreshLogs] = useState(0);

  const handleLogAdded = () => {
    setRefreshLogs((prev) => prev + 1);
  };

  return (
    <div className="max-w-[1350px] mx-auto px-6">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Početna</h1>
          <p className="text-sm text-gray-500 mt-1">Upload dnevnih unosa</p>
        </div>
        <div className="bg-white rounded-lg shadow">
          <ExcelUploader onLogAdded={handleLogAdded} />
        </div>
        <LogList refreshTrigger={refreshLogs} />
      </div>
    </div>
  );
}

export default HomePage;
