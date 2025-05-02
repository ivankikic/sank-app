import {
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  addDoc,
  getDoc,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "../firebase";
import { toast } from "react-hot-toast";
import { format } from "date-fns";

const UpdateConfirmationModal = ({ isOpen, onClose, onConfirm, date }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Postojeći podaci
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Već postoje podaci za datum {format(date, "dd.MM.yyyy")}. Želite li ih
          ažurirati?
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            Odustani
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-md hover:bg-yellow-700"
          >
            Ažuriraj
          </button>
        </div>
      </div>
    </div>
  );
};

const ManualEntry = forwardRef(
  ({ onLogAdded, onDirtyStateChange, initialCopyData, onDataCopied }, ref) => {
    const [artikli, setArtikli] = useState([]);
    const [selectedDate, setSelectedDate] = useState(
      new Date().toISOString().split("T")[0]
    );
    const [entries, setEntries] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const [pendingStavke, setPendingStavke] = useState(null);
    const [showCopyModal, setShowCopyModal] = useState(false);
    const [logsForCopy, setLogsForCopy] = useState([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);
    const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
    const [isLoadingDateData, setIsLoadingDateData] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [filteredArtikli, setFilteredArtikli] = useState([]);

    useEffect(() => {
      const loadData = async () => {
        setIsLoading(true);
        try {
          const artikliSnapshot = await getDocs(collection(db, "artikli"));
          const artikliData = artikliSnapshot.docs
            .map((doc) => ({
              ...doc.data(),
              docId: doc.id,
            }))
            .sort((a, b) => (a.order || 0) - (b.order || 0));
          setArtikli(artikliData);

          const savedEntries = localStorage.getItem("manualEntryData");
          if (savedEntries) {
            try {
              const parsed = JSON.parse(savedEntries);
              const lastModified = new Date(parsed.lastModified);
              const now = new Date();
              const hoursDiff = (now - lastModified) / (1000 * 60 * 60);

              if (hoursDiff < 24) {
                setSelectedDate(parsed.date);
                setEntries(parsed.entries);
                setIsDirty(true);
                onDirtyStateChange?.(true);
              } else {
                await fetchDataForDate(new Date().toISOString().split("T")[0]);
              }
            } catch (e) {
              await fetchDataForDate(new Date().toISOString().split("T")[0]);
            }
          } else {
            await fetchDataForDate(new Date().toISOString().split("T")[0]);
          }
        } catch (error) {
          console.error("Error fetching artikli:", error);
          toast.error("Greška pri dohvaćanju artikala");
        } finally {
          setIsLoading(false);
        }
      };

      loadData();
    }, []);

    useEffect(() => {
      if (initialCopyData) {
        const newEntries = { ...entries };
        initialCopyData.items.forEach((item) => {
          if (newEntries[item.artiklId]) {
            newEntries[item.artiklId] = {
              ulaz: item.ulaz?.toString() || "",
              izlaz: item.izlaz?.toString() || "",
            };
          }
        });
        setEntries(newEntries);
        setSelectedDate(format(initialCopyData.date, "yyyy-MM-dd"));
        setIsDirty(true);
        onDirtyStateChange?.(true);
        onDataCopied();
      }
    }, [initialCopyData]);

    useEffect(() => {
      if (
        Object.keys(entries).some(
          (key) => entries[key].ulaz || entries[key].izlaz
        )
      ) {
        localStorage.setItem(
          "manualEntryData",
          JSON.stringify({
            entries,
            date: selectedDate,
            lastModified: new Date().toISOString(),
          })
        );
        setIsDirty(true);
        onDirtyStateChange?.(true);
      }
    }, [entries, selectedDate]);

    // Funkcija koja provjerava ima li unesenih podataka
    const checkForChanges = useCallback((entries) => {
      return Object.values(entries).some(
        (entry) => entry.ulaz !== "" || entry.izlaz !== ""
      );
    }, []);

    // Prvo ćemo dodati novu funkciju koja će dohvatiti podatke za odabrani datum
    const fetchDataForDate = async (date) => {
      setIsLoadingDateData(true);
      try {
        const docRef = doc(db, "dnevniUnosi", date);
        const docSnap = await getDoc(docRef);

        const newEntries = {};
        artikli.forEach((artikl) => {
          newEntries[artikl.slug] = { ulaz: "", izlaz: "" };
        });

        if (docSnap.exists()) {
          setIsEditMode(true);
          const data = docSnap.data();
          data.stavke.forEach((stavka) => {
            if (newEntries[stavka.artiklId]) {
              newEntries[stavka.artiklId] = {
                ulaz: stavka.ulaz?.toString() || "",
                izlaz: stavka.izlaz?.toString() || "",
              };
            }
          });
        } else {
          setIsEditMode(false);
        }

        setEntries(newEntries);
        setIsDirty(false);
        onDirtyStateChange?.(false);
      } catch (error) {
        console.error("Error fetching data for date:", error);
        toast.error("Greška pri dohvaćanju podataka za odabrani datum");
      } finally {
        setIsLoadingDateData(false);
      }
    };

    // Modificiraj handleInputChange da označi formu kao prljavu samo ako su podaci stvarno promijenjeni
    const handleInputChange = (artiklId, type, value) => {
      const newEntries = {
        ...entries,
        [artiklId]: {
          ...entries[artiklId],
          [type]: value,
        },
      };
      setEntries(newEntries);
      setIsDirty(true);
      onDirtyStateChange?.(true);
    };

    // Modificiraj dio gdje se mijenja datum
    const handleDateChange = async (newDate) => {
      setSelectedDate(newDate);
      await fetchDataForDate(newDate);
    };

    const saveData = async (stavke, type) => {
      setIsSaving(true);
      try {
        // Spremi u dnevniUnosi
        await setDoc(doc(collection(db, "dnevniUnosi"), selectedDate), {
          datum: selectedDate,
          stavke,
        });

        // Kreiraj log
        await addDoc(collection(db, "logovi"), {
          type,
          date: selectedDate,
          timestamp: new Date().toISOString(),
          itemCount: stavke.length,
          items: stavke.map((item) => {
            const artikl = artikli.find((a) => a.slug === item.artiklId);
            return {
              ...item,
              sifra: artikl?.sifra || "",
              naziv: artikl?.name || item.artiklId,
            };
          }),
        });

        // Resetiraj formu
        const resetEntries = {};
        artikli.forEach((artikl) => {
          resetEntries[artikl.slug] = { ulaz: "", izlaz: "" };
        });
        setEntries(resetEntries);

        setIsDirty(false);
        onDirtyStateChange?.(false);

        toast.success(
          type === "CREATE" ? "Uspješno spremljeno!" : "Uspješno ažurirano!"
        );
        onLogAdded?.();
      } catch (error) {
        console.error("Error saving entries:", error);
        toast.error("Greška pri spremanju podataka");
      }
      setIsSaving(false);
      setShowUpdateModal(false);
      setPendingStavke(null);
    };

    const handleSave = async () => {
      setIsSaving(true);
      try {
        // Filtriraj samo artikle koji imaju unos
        const stavke = Object.entries(entries)
          .filter(([_, values]) => values.ulaz || values.izlaz)
          .map(([artiklId, values]) => ({
            artiklId,
            ulaz: Number(values.ulaz) || 0,
            izlaz: Number(values.izlaz) || 0,
          }));

        if (stavke.length === 0) {
          toast.error("Unesite barem jedan podatak");
          setIsSaving(false);
          return;
        }

        // Provjeri postoji li već unos za taj datum
        const existingDoc = await getDoc(doc(db, "dnevniUnosi", selectedDate));

        if (existingDoc.exists()) {
          setPendingStavke(stavke);
          setShowUpdateModal(true);
          setIsSaving(false);
        } else {
          await saveData(stavke, "CREATE");
        }
      } catch (error) {
        console.error("Error checking existing data:", error);
        toast.error("Greška pri provjeri postojećih podataka");
        setIsSaving(false);
      }
    };

    // Add new function to fetch logs for copying
    const fetchLogsForCopy = async () => {
      setIsLoadingLogs(true);
      try {
        const q = query(
          collection(db, "logovi"),
          orderBy("timestamp", "desc"),
          limit(10)
        );
        const querySnapshot = await getDocs(q);
        const logsData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setLogsForCopy(logsData);
      } catch (error) {
        console.error("Error fetching logs:", error);
        toast.error("Greška pri dohvaćanju povijesti unosa");
      } finally {
        setIsLoadingLogs(false);
      }
    };

    // Add function to handle copying values from selected log
    const handleCopyFromLog = (log) => {
      const newEntries = { ...entries };
      log.items.forEach((item) => {
        if (newEntries[item.artiklId]) {
          newEntries[item.artiklId] = {
            ulaz: item.ulaz?.toString() || "",
            izlaz: item.izlaz?.toString() || "",
          };
        }
      });
      setEntries(newEntries);
      setShowCopyModal(false);
      setIsDirty(true);
      onDirtyStateChange?.(true);
      toast.success("Vrijednosti uspješno kopirane");
    };

    // Add CopyModal component
    const CopyModal = () => (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Odaberi unos za kopiranje
            </h3>
            <button
              onClick={() => setShowCopyModal(false)}
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

          {isLoadingLogs ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {logsForCopy.map((log) => (
                <div
                  key={log.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleCopyFromLog(log)}
                >
                  <div className="grid grid-cols-3 items-center gap-4">
                    <div className="flex items-center gap-3">
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
                      <span className="text-sm font-medium text-gray-900">
                        {format(log.date, "dd.MM.yyyy")}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500 text-center">
                      Broj stavki: {log.itemCount}
                    </span>
                    <span className="text-sm text-gray-500 text-right">
                      {format(new Date(log.timestamp), "HH:mm:ss")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );

    // Dodaj useImperativeHandle za izlaganje funkcije kroz ref
    useImperativeHandle(ref, () => ({
      copyFromLog: (log) => {
        const newEntries = { ...entries };
        log.items.forEach((item) => {
          if (newEntries[item.artiklId]) {
            newEntries[item.artiklId] = {
              ulaz: item.ulaz?.toString() || "",
              izlaz: item.izlaz?.toString() || "",
            };
          }
        });
        setEntries(newEntries);
        setIsDirty(true);
        onDirtyStateChange?.(true);
        // Postavi datum iz loga
        setSelectedDate(format(log.date, "yyyy-MM-dd"));
      },
    }));

    // Preimenuj funkcije i promijeni njihovu logiku
    const handleResetForm = () => {
      setShowClearConfirmModal(true);
    };

    const handleConfirmReset = async () => {
      // Ponovno dohvati podatke za trenutni datum iz baze
      await fetchDataForDate(selectedDate);
      setShowClearConfirmModal(false);
      toast.success(
        isEditMode
          ? "Podaci su vraćeni na originalno stanje"
          : "Forma je vraćena na početno stanje"
      );
    };

    // Ažuriraj ClearConfirmationModal u ResetConfirmationModal
    const ResetConfirmationModal = () => (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
          <div className="mb-4">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-yellow-100 rounded-full">
              <svg
                className="w-6 h-6 text-yellow-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-medium text-gray-900 text-center">
              {isEditMode
                ? "Vraćanje originalnih podataka"
                : "Vraćanje prazne forme"}
            </h3>
            <p className="mt-2 text-sm text-gray-500 text-center">
              {isEditMode
                ? "Želite li vratiti podatke na originalno stanje iz baze? Sve promjene će biti poništene."
                : "Želite li vratiti formu na prazno stanje? Svi uneseni podaci će biti obrisani."}
            </p>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={() => setShowClearConfirmModal(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Odustani
            </button>
            <button
              onClick={handleConfirmReset}
              className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
            >
              {isEditMode ? "Vrati originalno" : "Vrati prazno"}
            </button>
          </div>
        </div>
      </div>
    );

    // Update filtered artikli when search term or artikli changes
    useEffect(() => {
      if (searchTerm.trim() === "") {
        setFilteredArtikli(artikli);
      } else {
        const term = searchTerm.toLowerCase();
        const filtered = artikli.filter(
          (artikl) =>
            artikl.name.toLowerCase().includes(term) ||
            artikl.sifra.toLowerCase().includes(term)
        );
        setFilteredArtikli(filtered);
      }
    }, [searchTerm, artikli]);

    if (isLoading) {
      return (
        <div className="flex justify-center items-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        </div>
      );
    }

    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-medium text-gray-900">Ručni unos</h2>
            {!isLoadingDateData && (
              <div
                className={`px-3 py-1 rounded-full text-xs font-medium inline-flex items-center gap-2
                  ${
                    isEditMode
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-green-100 text-green-800"
                  }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isEditMode ? "bg-yellow-400" : "bg-green-400"
                  }`}
                />
                {isEditMode ? "Uređivanje postojećeg" : "Novi unos"}
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Datum unosa
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                disabled={isLoadingDateData}
              />
            </div>
            <button
              onClick={handleResetForm}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
            >
              <svg
                className="h-4 w-4 mr-2 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Vrati na početno
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Spremam...
                </>
              ) : (
                "Spremi"
              )}
            </button>
          </div>
        </div>

        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          {/* Search box */}
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="h-5 w-5 text-gray-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Pretraži po nazivu ili šifri artikla..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setSearchTerm("")}
                >
                  <svg
                    className="h-5 w-5 text-gray-400 hover:text-gray-500"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              )}
            </div>
            {searchTerm && (
              <div className="mt-2 text-sm text-gray-500 text-left">
                {filteredArtikli.length === 0
                  ? "Nema rezultata za uneseni pojam."
                  : `Pronađeno ${filteredArtikli.length} ${
                      filteredArtikli.length === 1
                        ? "artikl"
                        : filteredArtikli.length < 5
                        ? "artikla"
                        : "artikala"
                    }`}
              </div>
            )}
          </div>

          {isLoadingDateData ? (
            <div className="flex justify-center items-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
              <span className="ml-2 text-gray-500">Učitavam podatke...</span>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-12 border-r border-gray-200"
                  >
                    #
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200"
                  >
                    Šifra
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200"
                  >
                    Artikl
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200"
                  >
                    Ulaz
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Izlaz
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredArtikli.map((artikl, index) => (
                  <tr key={artikl.docId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 text-center border-r border-gray-200">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-r border-gray-200">
                      {artikl.sifra}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-200 text-left">
                      {artikl.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap border-r border-gray-200">
                      <input
                        type="number"
                        min="0"
                        value={entries[artikl.slug]?.ulaz}
                        onChange={(e) =>
                          handleInputChange(artikl.slug, "ulaz", e.target.value)
                        }
                        className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="number"
                        min="0"
                        value={entries[artikl.slug]?.izlaz}
                        onChange={(e) =>
                          handleInputChange(
                            artikl.slug,
                            "izlaz",
                            e.target.value
                          )
                        }
                        className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="0"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <UpdateConfirmationModal
          isOpen={showUpdateModal}
          onClose={() => {
            setShowUpdateModal(false);
            setPendingStavke(null);
            setIsSaving(false);
          }}
          onConfirm={() => saveData(pendingStavke, "UPDATE")}
          date={new Date(selectedDate)}
        />

        {showCopyModal && <CopyModal />}

        {showClearConfirmModal && <ResetConfirmationModal />}
      </div>
    );
  }
);

export default ManualEntry;
