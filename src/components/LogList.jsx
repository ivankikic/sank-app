import { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { format } from "date-fns";
const LogList = ({ refreshTrigger }) => {
  const [logs, setLogs] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const fetchLogs = async () => {
      const q = query(collection(db, "logovi"), orderBy("timestamp", "desc"));
      const querySnapshot = await getDocs(q);
      const logsData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setLogs(logsData);
    };

    fetchLogs();
  }, [refreshTrigger]);

  const ItemsModal = ({ log, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Detalji promjene - {format(log.date, "dd.MM.yyyy")}
          </h3>
          <button
            onClick={onClose}
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
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-left w-[60%]">
                Artikl
              </th>
              <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-center w-[20%]">
                Ulaz
              </th>
              <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-center w-[20%]">
                Izlaz
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {log.items.map((item, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-left w-[60%]">
                  {item.naziv}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center w-[20%]">
                  {item.ulaz}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center w-[20%]">
                  {item.izlaz}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="mt-8">
      <h2 className="text-lg font-medium text-gray-900 mb-4">
        Povijest promjena
      </h2>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr className="bg-gray-50">
              <th
                scope="col"
                className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-[150px]"
              >
                Tip
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Datum unosa
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Broj stavki
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right"
              >
                Vrijeme unosa
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-center w-[100px]"
              >
                Detalji
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap w-[150px]">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium
                    ${
                      log.type === "CREATE"
                        ? "bg-green-100 text-green-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {log.type}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {format(log.date, "dd.MM.yyyy")}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {log.itemCount}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                  {new Date(log.timestamp)
                    .toLocaleString("hr", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })
                    .replace(",", "")}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <button
                    onClick={() => {
                      setSelectedLog(log);
                      setIsModalOpen(true);
                    }}
                    className="text-indigo-600 hover:text-indigo-900"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && selectedLog && (
        <ItemsModal
          log={selectedLog}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedLog(null);
          }}
        />
      )}
    </div>
  );
};

export default LogList;
