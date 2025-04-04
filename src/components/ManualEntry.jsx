import { useState, useEffect, useCallback } from "react";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  addDoc,
  getDoc,
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

const ManualEntry = ({ onLogAdded, onDirtyStateChange }) => {
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
    } catch (error) {
      console.error("Error checking existing data:", error);
      toast.error("Greška pri provjeri postojećih podataka");
    }
  };

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
    </div>
  );
};

export default ManualEntry;
