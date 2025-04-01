import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  where,
  doc,
  getDoc,
  limit,
  startAfter,
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
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const ITEMS_PER_PAGE = 10;
  const [lastVisible, setLastVisible] = useState(null);
  const [firstVisible, setFirstVisible] = useState(null);
  const [pageNumbers, setPageNumbers] = useState([]);
  const [totalDocs, setTotalDocs] = useState(0);

  useEffect(() => {
    fetchData();
  }, [refreshTrigger, currentPage]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Prvo dohvati ukupan broj logova
      const totalQuery = await getDocs(collection(db, "logovi"));
      const totalLogs = totalQuery.size;
      setTotalDocs(totalLogs);
      const calculatedTotalPages = Math.ceil(totalLogs / ITEMS_PER_PAGE);
      setTotalPages(calculatedTotalPages);

      // Resetiraj lastVisible ako se vratimo na prvu stranicu
      if (currentPage === 1) {
        setLastVisible(null);
      }

      // Dohvati logove za trenutnu stranicu
      let q;
      if (currentPage === 1) {
        q = query(
          collection(db, "logovi"),
          orderBy("timestamp", "desc"),
          limit(ITEMS_PER_PAGE)
        );
      } else {
        q = query(
          collection(db, "logovi"),
          orderBy("timestamp", "desc"),
          startAfter(lastVisible),
          limit(ITEMS_PER_PAGE)
        );
      }

      const querySnapshot = await getDocs(q);
      const logsData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setLogs(logsData);

      // Spremi zadnji dokument za sljedeću stranicu
      if (querySnapshot.docs.length > 0) {
        setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
        setFirstVisible(querySnapshot.docs[0]);
      }

      // Izračunaj brojeve stranica odmah s točnim totalPages
      let numbers = [];
      if (calculatedTotalPages <= 5) {
        numbers = Array.from({ length: calculatedTotalPages }, (_, i) => i + 1);
      } else {
        if (currentPage <= 3) {
          numbers = [1, 2, 3, 4, 5, "...", calculatedTotalPages];
        } else if (currentPage >= calculatedTotalPages - 2) {
          numbers = [
            1,
            "...",
            calculatedTotalPages - 4,
            calculatedTotalPages - 3,
            calculatedTotalPages - 2,
            calculatedTotalPages - 1,
            calculatedTotalPages,
          ];
        } else {
          numbers = [
            1,
            "...",
            currentPage - 1,
            currentPage,
            currentPage + 1,
            "...",
            calculatedTotalPages,
          ];
        }
      }
      setPageNumbers(numbers);

      // Dohvati artikle
      const artikliQuery = query(collection(db, "artikli"));
      const artikliSnapshot = await getDocs(artikliQuery);
      const artikliData = {};
      artikliSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        artikliData[data.slug] = data.name; // Mapiramo slug na ime artikla
      });
      setArtikli(artikliData);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

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

  const Pagination = () => (
    <div className="px-6 py-4 flex items-center justify-between border-t border-gray-200">
      <div className="flex-1 flex justify-between sm:hidden">
        <button
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={currentPage === 1 || isLoading}
          className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          Prethodna
        </button>
        <button
          onClick={() =>
            setCurrentPage((prev) => Math.min(prev + 1, totalPages))
          }
          disabled={currentPage === totalPages || isLoading}
          className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          Sljedeća
        </button>
      </div>
      <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-700">
            Prikazano{" "}
            <span className="font-medium">
              {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, totalDocs)}
            </span>{" "}
            -{" "}
            <span className="font-medium">
              {Math.min(currentPage * ITEMS_PER_PAGE, totalDocs)}
            </span>{" "}
            od <span className="font-medium">{totalDocs}</span> rezultata
          </p>
        </div>
        <div>
          <nav
            className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
            aria-label="Pagination"
          >
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1 || isLoading}
              className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
            >
              <span className="sr-only">Prethodna</span>
              <svg
                className="h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {pageNumbers.map((number, index) => (
              <button
                key={index}
                onClick={() => number !== "..." && setCurrentPage(number)}
                disabled={
                  number === "..." || number === currentPage || isLoading
                }
                className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                  number === currentPage
                    ? "z-10 bg-indigo-50 border-indigo-500 text-indigo-600"
                    : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                } ${number === "..." ? "cursor-default" : ""}`}
              >
                {number}
              </button>
            ))}

            <button
              onClick={() =>
                setCurrentPage((prev) => Math.min(prev + 1, totalPages))
              }
              disabled={currentPage === totalPages || isLoading}
              className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
            >
              <span className="sr-only">Sljedeća</span>
              <svg
                className="h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </nav>
        </div>
      </div>
    </div>
  );

  return (
    <div className="mt-8">
      <h2 className="text-lg font-medium text-gray-900 mb-4">
        Povijest promjena
      </h2>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="relative">
          {isLoading && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-30 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                <span className="text-sm text-gray-600 font-medium">
                  Učitavam podatke...
                </span>
              </div>
            </div>
          )}

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

          <Pagination />
        </div>
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
