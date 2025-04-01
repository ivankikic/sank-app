import { useState, useEffect, Fragment } from "react";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import {
  startOfWeek,
  endOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  format,
} from "date-fns";
import { hr } from "date-fns/locale";
import ExportModal from "../components/ExportModal";
import { toast } from "react-hot-toast";
import { generateExcelReport } from "../utils/excelExport";

const StanjePage = () => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [artikli, setArtikli] = useState([]);
  const [weeklyData, setWeeklyData] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [previousStanje, setPreviousStanje] = useState({});
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  // Izračunaj datume za trenutni tjedan
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Počinje od ponedjeljka
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });

  // Generiraj array datuma u tjednu
  const weekDays = Array.from({ length: 7 }, (_, i) =>
    format(addDays(weekStart, i), "yyyy-MM-dd")
  );

  useEffect(() => {
    const fetchArtikli = async () => {
      const artikliQuery = query(
        collection(db, "artikli"),
        orderBy("order", "asc")
      );
      const artikliSnapshot = await getDocs(artikliQuery);
      const artikliData = artikliSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setArtikli(artikliData);
    };
    fetchArtikli();
  }, []);

  useEffect(() => {
    const fetchWeeklyData = async () => {
      setIsLoading(true);
      try {
        // Dohvati sve unose za trenutni tjedan
        const weeklyQ = query(
          collection(db, "dnevniUnosi"),
          where("datum", ">=", weekStart.toISOString().split("T")[0]),
          where("datum", "<=", weekEnd.toISOString().split("T")[0]),
          orderBy("datum")
        );

        const weeklySnapshot = await getDocs(weeklyQ);
        const weeklyData = {};
        weeklySnapshot.docs.forEach((doc) => {
          weeklyData[doc.data().datum] = doc.data().stavke;
        });
        setWeeklyData(weeklyData);

        // Dohvati sve unose do početka trenutnog tjedna
        const previousQ = query(
          collection(db, "dnevniUnosi"),
          where("datum", "<", weekStart.toISOString().split("T")[0]),
          orderBy("datum")
        );

        const previousSnapshot = await getDocs(previousQ);
        const previousState = {};

        // Sortiraj dokumente po datumu da bismo bili sigurni da uzimamo najnovije stanje
        const sortedDocs = previousSnapshot.docs.sort((a, b) =>
          a.data().datum.localeCompare(b.data().datum)
        );

        // Izračunaj stanje za svaki artikl kroz sve prethodne dane
        sortedDocs.forEach((doc) => {
          const stavke = doc.data().stavke;
          stavke.forEach((stavka) => {
            if (!previousState[stavka.artiklId]) {
              previousState[stavka.artiklId] = 0;
            }
            previousState[stavka.artiklId] += stavka.ulaz - stavka.izlaz;
          });
        });

        setPreviousStanje(previousState);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
      setIsLoading(false);
    };

    fetchWeeklyData();
  }, [currentWeek]);

  const calculateDailyStanje = (artiklId, date) => {
    const dayStavke =
      weeklyData[date]?.filter((s) => s.artiklId === artiklId) || [];

    // Zbroji sve ulaze i izlaze za isti artikl u jednom danu
    return dayStavke.reduce(
      (acc, stavka) => ({
        ulaz: acc.ulaz + (stavka.ulaz || 0),
        izlaz: acc.izlaz + (stavka.izlaz || 0),
      }),
      { ulaz: 0, izlaz: 0 }
    );
  };

  const calculateRunningStanje = (artiklId, upToDate) => {
    // Počni od prethodnog stanja
    let stanje = previousStanje[artiklId] || 0;

    // Sortiraj datume da bismo bili sigurni da računamo kronološki
    const sortedDates = weekDays
      .filter((date) => date <= upToDate)
      .sort((a, b) => a.localeCompare(b));

    // Izračunaj stanje do željenog datuma
    sortedDates.forEach((date) => {
      const dayStavke =
        weeklyData[date]?.filter((s) => s.artiklId === artiklId) || [];
      // Zbroji sve promjene za taj dan
      const dnevnaPromjena = dayStavke.reduce(
        (acc, stavka) => acc + (stavka.ulaz || 0) - (stavka.izlaz || 0),
        0
      );
      stanje += dnevnaPromjena;
    });

    return stanje;
  };

  // Dodajte ovu funkciju za export podataka
  const handleExport = async () => {
    if (!startDate || !endDate) {
      toast.error("Molimo odaberite datume za export");
      return;
    }

    try {
      // Formatiramo datume u 'YYYY-MM-DD' format
      const formattedStartDate = format(new Date(startDate), "yyyy-MM-dd");
      const formattedEndDate = format(new Date(endDate), "yyyy-MM-dd");

      await generateExcelReport(
        formattedStartDate,
        formattedEndDate,
        setIsLoading
      );
      toast.success("Excel uspješno generiran!");
      setIsExportModalOpen(false);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Došlo je do greške prilikom generiranja Excela");
    }
  };

  return (
    <div className="max-w-[1350px] mx-auto px-4">
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-semibold text-gray-900">
              Stanje artikala
            </h1>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setCurrentWeek((date) => subWeeks(date, 1))}
                className="p-2 text-gray-600 hover:text-gray-900"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <span className="text-lg font-medium">
                {format(weekStart, "d. MMMM", { locale: hr })} -{" "}
                {format(weekEnd, "d. MMMM yyyy.", { locale: hr })}
              </span>
              <button
                onClick={() => setCurrentWeek((date) => addWeeks(date, 1))}
                className="p-2 text-gray-600 hover:text-gray-900"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
              <button
                onClick={() => setIsExportModalOpen(true)}
                className="ml-4 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Export
              </button>
            </div>
          </div>
        </div>

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

          <div
            className="overflow-x-auto border-t border-gray-200"
            style={{ maxWidth: "100%" }}
          >
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 z-20 bg-gray-50 border-r border-gray-200 min-w-[200px]"
                  >
                    Artikl
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 min-w-[120px]"
                  >
                    Početno stanje
                  </th>
                  {weekDays.map((date, idx) => (
                    <th
                      key={date}
                      scope="col"
                      className="border-r border-gray-200 bg-gray-50"
                      colSpan={3}
                    >
                      <div className="px-4 py-3 text-center">
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {format(new Date(date), "EEEE", { locale: hr })}
                        </div>
                        <div className="text-xs font-medium text-gray-400 mt-1">
                          {format(new Date(date), "dd.MM.")}
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <th className="sticky left-0 z-20 bg-gray-50 border-r border-gray-200"></th>
                  <th className="border-r border-gray-200"></th>
                  {weekDays.map((date, idx) => (
                    <Fragment key={`subheader-${date}`}>
                      <th className="px-4 py-2 text-xs font-medium text-gray-500 text-center border-r border-gray-200 min-w-[80px]">
                        Ulaz
                      </th>
                      <th className="px-4 py-2 text-xs font-medium text-gray-500 text-center border-r border-gray-200 min-w-[80px]">
                        Izlaz
                      </th>
                      <th className="px-4 py-2 text-xs font-medium text-gray-500 text-center border-r border-gray-200 min-w-[80px]">
                        Stanje
                      </th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {artikli.map((artikl, index) => (
                  <tr key={artikl.id} className="group hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 z-20 bg-white border-r border-gray-200 group-hover:bg-gray-50 min-w-[200px] text-left">
                      {artikl.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center border-r border-gray-200 font-medium min-w-[120px]">
                      {previousStanje[artikl.slug] || 0}
                    </td>
                    {weekDays.map((date, idx) => {
                      const dailyData = calculateDailyStanje(artikl.slug, date);
                      const stanje = calculateRunningStanje(artikl.slug, date);
                      return (
                        <Fragment key={`${artikl.id}-${date}`}>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-center border-r border-gray-200 min-w-[80px]">
                            {dailyData.ulaz > 0 && (
                              <span className="text-green-600 font-medium">
                                +{dailyData.ulaz}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-center border-r border-gray-200 min-w-[80px]">
                            {dailyData.izlaz > 0 && (
                              <span className="text-red-600 font-medium">
                                -{dailyData.izlaz}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-center border-r border-gray-200 font-medium min-w-[80px]">
                            {stanje}
                          </td>
                        </Fragment>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <ExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          onExport={handleExport}
          startDate={startDate}
          endDate={endDate}
          setStartDate={setStartDate}
          setEndDate={setEndDate}
        />
      </div>
    </div>
  );
};

export default StanjePage;
