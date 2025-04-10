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
    const [selectedDate, setSelectedDate] = useState(() => {
      const savedEntries = localStorage.getItem("manualEntryData");
      if (savedEntries) {
        try {
          const parsed = JSON.parse(savedEntries);
          return parsed.date || new Date().toISOString().split("T")[0];
        } catch (e) {
          return new Date().toISOString().split("T")[0];
        }
      }
      return new Date().toISOString().split("T")[0];
    });
    const [entries, setEntries] = useState(() => {
      const savedEntries = localStorage.getItem("manualEntryData");
      if (savedEntries) {
        try {
          const parsed = JSON.parse(savedEntries);
          onDirtyStateChange?.(true);
          return parsed.entries;
        } catch (e) {
          console.error("Error parsing saved entries:", e);
          return {};
        }
      }
      return {};
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const [pendingStavke, setPendingStavke] = useState(null);
    const [showCopyModal, setShowCopyModal] = useState(false);
    const [logsForCopy, setLogsForCopy] = useState([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);
    const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);

    useEffect(() => {
      const fetchArtikli = async () => {
        try {
          const artikliSnapshot = await getDocs(collection(db, "artikli"));
          const artikliData = artikliSnapshot.docs
            .map((doc) => ({
              ...doc.data(),
              docId: doc.id,
            }))
            .sort((a, b) => (a.order || 0) - (b.order || 0));
          setArtikli(artikliData);

          // Inicijaliziraj entries objekt
          const initialEntries = {};
          artikliData.forEach((artikl) => {
            initialEntries[artikl.slug] = { ulaz: "", izlaz: "" };
          });
          setEntries(initialEntries);
          setIsLoading(false);
        } catch (error) {
          console.error("Error fetching artikli:", error);
          toast.error("Greška pri dohvaćanju artikala");
          setIsLoading(false);
        }
      };

      fetchArtikli();
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

    // Modificiraj handleInputChange da prati promjene
    const handleInputChange = (artiklId, type, value) => {
      const newEntries = {
        ...entries,
        [artiklId]: {
          ...entries[artiklId],
          [type]: value,
        },
      };
      setEntries(newEntries);

      // Provjeri ima li promjena
      const hasChanges = checkForChanges(newEntries);
      setIsDirty(hasChanges);
      onDirtyStateChange?.(hasChanges);
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
          items: stavke.map((item) => ({
            ...item,
            naziv:
              artikli.find((a) => a.slug === item.artiklId)?.name ||
              item.artiklId,
          })),
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
          return;
        }

        // Provjeri postoji li već unos za taj datum
        const existingDoc = await getDoc(doc(db, "dnevniUnosi", selectedDate));

        if (existingDoc.exists()) {
          setPendingStavke(stavke);
          setShowUpdateModal(true);
        } else {
          await saveData(stavke, "CREATE");
        }

        // Nakon uspješnog spremanja
        localStorage.removeItem("manualEntryData");
        setIsDirty(false);
        onDirtyStateChange?.(false);
      } catch (error) {
        console.error("Error checking existing data:", error);
        toast.error("Greška pri provjeri postojećih podataka");
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

    // Dodaj funkciju za čišćenje forme
    const handleClearForm = () => {
      setShowClearConfirmModal(true);
    };

    const handleConfirmClear = () => {
      const emptyEntries = {};
      artikli.forEach((artikl) => {
        emptyEntries[artikl.slug] = { ulaz: "", izlaz: "" };
      });
      setEntries(emptyEntries);
      setSelectedDate(new Date().toISOString().split("T")[0]);
      localStorage.removeItem("manualEntryData");
      setIsDirty(false);
      onDirtyStateChange?.(false);
      setShowClearConfirmModal(false);
      toast.success("Forma je očišćena");
    };

    // Dodaj ClearConfirmationModal komponentu
    const ClearConfirmationModal = () => (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
          <div className="mb-4">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
              <svg
                className="w-6 h-6 text-red-600"
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
              Brisanje unesenih podataka
            </h3>
            <p className="mt-2 text-sm text-gray-500 text-center">
              Jeste li sigurni da želite obrisati sve unesene podatke? Ova
              akcija se ne može poništiti.
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
              onClick={handleConfirmClear}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Obriši sve
            </button>
          </div>
        </div>
      </div>
    );

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
          <h2 className="text-lg font-medium text-gray-900">Ručni unos</h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Datum unosa
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <button
              onClick={() => {
                fetchLogsForCopy();
                setShowCopyModal(true);
              }}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
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
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              Kopiraj postojeći
            </button>
            <button
              onClick={handleClearForm}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
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
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              Očisti formu
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
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Artikl
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
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
              {artikli.map((artikl, index) => (
                <tr key={artikl.docId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-left">
                    <span className="text-gray-400 text-xs mr-2">
                      {index + 1}.
                    </span>
                    {artikl.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
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
                        handleInputChange(artikl.slug, "izlaz", e.target.value)
                      }
                      className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="0"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <UpdateConfirmationModal
          isOpen={showUpdateModal}
          onClose={() => {
            setShowUpdateModal(false);
            setPendingStavke(null);
          }}
          onConfirm={() => saveData(pendingStavke, "UPDATE")}
          date={new Date(selectedDate)}
        />

        {showCopyModal && <CopyModal />}

        {showClearConfirmModal && <ClearConfirmationModal />}
      </div>
    );
  }
);

export default ManualEntry;
