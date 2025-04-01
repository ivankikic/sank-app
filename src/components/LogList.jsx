import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { format } from "date-fns";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

const LogList = ({ refreshTrigger }) => {
  const [logs, setLogs] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [artikli, setArtikli] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      // Dohvati logove
      const q = query(collection(db, "logovi"), orderBy("timestamp", "desc"));
      const querySnapshot = await getDocs(q);
      const logsData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setLogs(logsData);

      // Dohvati artikle
      const artikliQuery = query(collection(db, "artikli"));
      const artikliSnapshot = await getDocs(artikliQuery);
      const artikliData = {};
      artikliSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        artikliData[data.slug] = data.name; // Mapiramo slug na ime artikla
      });
      setArtikli(artikliData);
    };

    fetchData();
  }, [refreshTrigger]);

  // Funkcija za generiranje i preuzimanje Excel datoteke za pojedinačni log
  const exportLogToExcel = async (log) => {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Detalji unosa");

      // Stilovi za Excel
      const headerStyle = {
        font: { bold: true, color: { argb: "FFFFFF" } },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "4F46E5" },
        },
        alignment: { vertical: "middle", horizontal: "center" },
        border: {
          top: { style: "thin", color: { argb: "D1D5DB" } },
          left: { style: "thin", color: { argb: "D1D5DB" } },
          bottom: { style: "thin", color: { argb: "D1D5DB" } },
          right: { style: "thin", color: { argb: "D1D5DB" } },
        },
      };

      // Informacije o unosu
      sheet.addRow([`Detalji unosa - ${format(log.date, "dd.MM.yyyy")}`]);
      sheet.addRow([
        `Tip: ${log.type}`,
        `Broj stavki: ${log.itemCount}`,
        `Vrijeme: ${new Date(log.timestamp).toLocaleString("hr")}`,
      ]);
      sheet.addRow([]); // Prazan red

      // Merge ćelije za naslov
      sheet.mergeCells("A1:C1");
      sheet.getCell("A1").style = {
        font: { bold: true, size: 14 },
        alignment: { horizontal: "center" },
      };

      // Merge ćelije za info
      sheet.getCell("A2").style = { font: { bold: true } };
      sheet.getCell("B2").style = { font: { bold: true } };
      sheet.getCell("C2").style = { font: { bold: true } };

      // Dodaj zaglavlje tablice
      const headerRow = sheet.addRow(["Artikl", "Ulaz", "Izlaz"]);
      headerRow.eachCell((cell) => {
        cell.style = headerStyle;
      });

      // Dodaj podatke
      log.items.forEach((item) => {
        // Koristi naziv iz item ako postoji, inače pronađi ime artikla po slugu
        const artiklNaziv =
          item.name || artikli[item.artiklId] || item.artiklId;

        const row = sheet.addRow([
          artiklNaziv,
          item.ulaz || 0,
          item.izlaz || 0,
        ]);

        // Stilovi za ćelije
        row.getCell(1).style = {
          alignment: { horizontal: "left" },
          border: {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          },
        };

        row.getCell(2).style = {
          font: { color: { argb: "059669" } },
          alignment: { horizontal: "center" },
          border: {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          },
        };

        row.getCell(3).style = {
          font: { color: { argb: "DC2626" } },
          alignment: { horizontal: "center" },
          border: {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          },
        };
      });

      // Podesi širine kolona
      sheet.getColumn(1).width = 40;
      sheet.getColumn(2).width = 15;
      sheet.getColumn(3).width = 15;

      // Naizmjenični retci za bolju čitljivost
      for (let i = 5; i < 5 + log.items.length; i++) {
        if (i % 2 === 0) {
          sheet.getRow(i).eachCell((cell) => {
            if (!cell.style.fill) cell.style.fill = {};
            cell.style.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "F8FAFC" },
            };
          });
        }
      }

      // Preuzmi Excel
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      saveAs(blob, `Unos_${format(log.date, "dd-MM-yyyy")}_${log.type}.xlsx`);
    } catch (error) {
      console.error("Error exporting log to Excel:", error);
      alert("Došlo je do greške prilikom izvoza.");
    }
  };

  const ItemsModal = ({ log, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Detalji promjene - {format(log.date, "dd.MM.yyyy")}
          </h3>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => exportLogToExcel(log)}
              className="inline-flex items-center px-3 py-2 border border-indigo-600 rounded-md text-sm font-medium text-indigo-600 hover:bg-indigo-50"
            >
              <svg
                className="h-4 w-4 mr-2"
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
              Excel
            </button>
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
                  {item.name || artikli[item.artiklId] || item.artiklId}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center w-[20%]">
                  {item.ulaz > 0 ? (
                    <span className="font-medium text-green-600">
                      +{item.ulaz}
                    </span>
                  ) : (
                    <span className="text-gray-400">0</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center w-[20%]">
                  {item.izlaz > 0 ? (
                    <span className="font-medium text-red-600">
                      -{item.izlaz}
                    </span>
                  ) : (
                    <span className="text-gray-400">0</span>
                  )}
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
                className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-center w-[140px]"
              >
                Akcije
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
                        : log.type === "UPDATE"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-red-100 text-red-800"
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
                  <div className="flex items-center justify-center space-x-3">
                    <button
                      onClick={() => {
                        setSelectedLog(log);
                        setIsModalOpen(true);
                      }}
                      className="text-indigo-600 hover:text-indigo-900"
                      title="Prikaži detalje"
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
                    <button
                      onClick={() => exportLogToExcel(log)}
                      className="text-green-600 hover:text-green-900"
                      title="Preuzmi Excel"
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
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                    </button>
                  </div>
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
