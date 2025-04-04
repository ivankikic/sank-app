import { useState, useEffect } from "react";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";
import { toast } from "react-hot-toast";
import { Switch } from "@headlessui/react";
import { format } from "date-fns";
import { generateExcelReport } from "../utils/excelExport";

const SettingsPage = () => {
  const [settings, setSettings] = useState({
    appLock: {
      enabled: true,
      autoLockTimeout: 30, // u minutama
    },
    stockAlerts: {
      enabled: true, // Zadržavamo samo enabled flag za prikaz upozorenja općenito
    },
    // Ovdje možemo dodavati nove postavke po potrebi
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedDateToDelete, setSelectedDateToDelete] = useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletingRecord, setIsDeletingRecord] = useState(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, "settings", "appSettings"));
        if (settingsDoc.exists()) {
          setSettings(settingsDoc.data());
        } else {
          // Ako ne postoje postavke, kreiraj ih s default vrijednostima
          await setDoc(doc(db, "settings", "appSettings"), settings);
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
        toast.error("Greška pri učitavanju postavki");
      }
      setIsLoading(false);
    };

    fetchSettings();
  }, []);

  const handleSettingChange = (section, setting, value) => {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [setting]: value,
      },
    }));
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, "settings", "appSettings"), settings);
      toast.success("Postavke su uspješno spremljene");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Greška pri spremanju postavki");
    }
    setIsSaving(false);
  };

  const SettingSection = ({ title, children }) => (
    <div className="border-b border-gray-200 pb-6">
      <h2 className="text-lg font-medium text-gray-900 mb-1">{title}</h2>
      <p className="text-sm text-gray-500 mb-4">
        {title === "Zaključavanje aplikacije"
          ? "Postavke za sigurnost i automatsko zaključavanje aplikacije"
          : "Upravljanje obavijestima o stanju zaliha"}
      </p>
      <div className="space-y-4">{children}</div>
    </div>
  );

  const Toggle = ({ enabled, onChange, label }) => (
    <Switch.Group>
      <div className="flex items-center justify-between">
        <Switch.Label className="text-sm text-gray-700 mr-4">
          {label}
        </Switch.Label>
        <Switch
          checked={enabled}
          onChange={onChange}
          className={`${
            enabled ? "bg-indigo-600" : "bg-gray-200"
          } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
        >
          <span
            className={`${
              enabled ? "translate-x-6" : "translate-x-1"
            } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
          />
        </Switch>
      </div>
    </Switch.Group>
  );

  const DeleteModal = ({ date, onConfirm, onCancel }) => (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[500px] max-w-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Potvrda brisanja
          </h2>
        </div>
        <div className="p-6">
          <p className="text-gray-700 text-left">
            Jeste li sigurni da želite obrisati zapis za datum{" "}
            <span className="font-medium">
              {format(new Date(date), "dd.MM.yyyy.")}
            </span>
            ?
          </p>
          <p className="text-sm text-gray-500 mt-2 text-left">
            Ova akcija je nepovratna i obrisat će sve podatke za odabrani dan.
          </p>
        </div>
        <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            Odustani
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Obriši
          </button>
        </div>
      </div>
    </div>
  );

  const handleDeleteRecord = async () => {
    setIsDeletingRecord(true);
    try {
      // 1. Dohvati podatke prije brisanja za log
      const recordRef = doc(db, "dnevniUnosi", selectedDateToDelete);
      const recordDoc = await getDoc(recordRef);

      if (!recordDoc.exists()) {
        toast.error("Zapis za odabrani datum ne postoji");
        return;
      }

      const recordData = recordDoc.data();

      // 2. Obriši zapis
      await deleteDoc(recordRef);

      // 3. Kreiraj log o brisanju
      const logRef = collection(db, "logovi");
      await addDoc(logRef, {
        type: "DELETE",
        date: selectedDateToDelete,
        timestamp: new Date().toISOString(),
        itemCount: recordData.stavke.length,
        items: recordData.stavke,
      });

      toast.success("Zapis je uspješno obrisan");
      setSelectedDateToDelete("");
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error("Error deleting record:", error);
      toast.error("Greška pri brisanju zapisa");
    } finally {
      setIsDeletingRecord(false);
    }
  };

  const handleCreateBackup = async () => {
    setIsCreatingBackup(true);
    try {
      // Dohvati sve datume iz dnevniUnosi kolekcije
      const datesSnapshot = await getDocs(
        query(collection(db, "dnevniUnosi"), orderBy("datum"))
      );

      if (datesSnapshot.empty) {
        toast.error("Nema podataka za backup");
        return;
      }

      // Uzmi prvi i zadnji datum
      const firstDate = datesSnapshot.docs[0].data().datum;
      const lastDate =
        datesSnapshot.docs[datesSnapshot.docs.length - 1].data().datum;

      // Generiraj Excel izvještaj
      await generateExcelReport(firstDate, lastDate, setIsCreatingBackup);
      toast.success("Backup je uspješno kreiran!");
    } catch (error) {
      console.error("Error creating backup:", error);
      toast.error("Došlo je do greške prilikom kreiranja backupa");
    } finally {
      setIsCreatingBackup(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-center items-center h-64">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          <span className="text-sm text-gray-600 font-medium">
            Učitavam postavke...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="bg-white rounded-lg shadow-sm ring-1 ring-gray-900/5">
        <div className="px-8 py-6 border-b border-gray-200">
          <div className="flex items-center">
            <svg
              className="h-6 w-6 text-gray-600 mr-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <h1 className="text-xl font-semibold text-gray-900">Postavke</h1>
          </div>
        </div>

        <div className="px-8 py-6 space-y-8">
          <SettingSection title="Zaključavanje aplikacije">
            <Toggle
              enabled={settings.appLock.enabled}
              onChange={(enabled) =>
                handleSettingChange("appLock", "enabled", enabled)
              }
              label="Omogući zaključavanje aplikacije"
            />

            {settings.appLock.enabled && (
              <div className="ml-6 mt-4">
                <label className="block text-sm text-gray-700 mb-2 text-center">
                  Automatsko zaključavanje nakon
                </label>
                <div className="relative w-48 mx-auto">
                  <select
                    value={settings.appLock.autoLockTimeout}
                    onChange={(e) =>
                      handleSettingChange(
                        "appLock",
                        "autoLockTimeout",
                        Number(e.target.value)
                      )
                    }
                    className="appearance-none w-full px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm text-center
                      focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
                  >
                    <option value={15}>15 minuta</option>
                    <option value={30}>30 minuta</option>
                    <option value={60}>1 sat</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                    <svg
                      className="h-4 w-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            )}
          </SettingSection>

          <SettingSection title="Upozorenja o stanju">
            <Toggle
              enabled={settings.stockAlerts.enabled}
              onChange={(enabled) =>
                handleSettingChange("stockAlerts", "enabled", enabled)
              }
              label="Prikaži upozorenja o niskim zalihama"
            />
            {settings.stockAlerts.enabled && (
              <div className="ml-6 mt-4">
                <p className="text-sm text-gray-500">
                  Upozorenja će se prikazivati prema minimalnim količinama
                  postavljenim za svaki artikl
                </p>
              </div>
            )}
          </SettingSection>

          <div className="flex justify-end pt-4">
            <button
              onClick={saveSettings}
              disabled={isSaving}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors duration-200"
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
                "Spremi promjene"
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm ring-1 ring-gray-900/5 mt-8">
        <div className="px-8 py-6 border-b border-gray-200">
          <div className="flex items-center">
            <svg
              className="h-6 w-6 text-red-600 mr-3"
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
            <h2 className="text-lg font-medium text-gray-900">
              Brisanje zapisa
            </h2>
          </div>
          <p className="mt-1 text-sm text-gray-500 text-left">
            Odaberite datum za koji želite obrisati zapis. Ova akcija će
            obrisati sve podatke za odabrani dan.
          </p>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2 text-left">
              Datum
            </label>
            <div className="flex gap-4 items-center">
              <div className="flex-1">
                <input
                  type="date"
                  value={selectedDateToDelete}
                  onChange={(e) => setSelectedDateToDelete(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <button
                onClick={() => setIsDeleteModalOpen(true)}
                disabled={!selectedDateToDelete || isDeletingRecord}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isDeletingRecord ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
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
                    Brisanje...
                  </>
                ) : (
                  <>
                    <svg
                      className="h-4 w-4"
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
                    Obriši zapis
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm ring-1 ring-gray-900/5 mt-8">
        <div className="px-8 py-6 border-b border-gray-200">
          <div className="flex items-center">
            <svg
              className="h-6 w-6 text-indigo-600 mr-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2M8 4v4h8V4M8 4l4 4 4-4"
              />
            </svg>
            <h2 className="text-lg font-medium text-gray-900">
              Backup podataka
            </h2>
          </div>
          <p className="mt-1 text-sm text-gray-500 text-left">
            Kreirajte backup svih podataka u Excel formatu. Backup će uključiti
            sve zapise od prvog do zadnjeg datuma.
          </p>
          <div className="mt-4">
            <button
              onClick={handleCreateBackup}
              disabled={isCreatingBackup}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isCreatingBackup ? (
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
                  Kreiranje backupa...
                </>
              ) : (
                <>
                  <svg
                    className="mr-2 h-4 w-4"
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
                  Kreiraj backup
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {isDeleteModalOpen && (
        <DeleteModal
          date={selectedDateToDelete}
          onConfirm={handleDeleteRecord}
          onCancel={() => setIsDeleteModalOpen(false)}
        />
      )}
    </div>
  );
};

export default SettingsPage;
