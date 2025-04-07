import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  addDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import toast from "react-hot-toast";
import { format } from "date-fns";

const DuplicatesModal = ({ duplicates, onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white p-6 rounded-lg max-w-2xl w-full mx-4">
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        Pronađeni duplicirani artikli
      </h3>
      <div className="mb-6">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-yellow-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                Sljedeći artikli se pojavljuju više puta u Excel datoteci.
                Provjerite jesu li duplicirani unosi namjerni.
              </p>
            </div>
          </div>
        </div>
        <div className="max-h-60 overflow-y-auto">
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
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Redovi u Excelu
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {duplicates.map((duplicate, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-left">
                    {duplicate.naziv}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-left">
                    {duplicate.redovi.join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          Odustani
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-md hover:bg-yellow-700"
        >
          Nastavi spremanje
        </button>
      </div>
    </div>
  </div>
);

const ExcelUploader = ({ onLogAdded }) => {
  const [status, setStatus] = useState("");
  const [validArtikli, setValidArtikli] = useState(null);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [pendingData, setPendingData] = useState(null);
  const [duplicatesData, setDuplicatesData] = useState(null);

  useEffect(() => {
    const fetchArtikli = async () => {
      try {
        const artikliSnapshot = await getDocs(collection(db, "artikli"));
        const artikliData = artikliSnapshot.docs.map((doc) => ({
          ...doc.data(),
          slug: doc.data().slug,
        }));
        setValidArtikli(artikliData);
      } catch (error) {
        toast.error("Greška pri dohvaćanju artikala");
      }
    };
    fetchArtikli();
  }, []);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.match(/\.(xlsx|xls)$/)) {
      toast.error("Molimo odaberite Excel datoteku (.xlsx ili .xls)");
      return;
    }

    setSelectedFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length) {
      const file = files[0];
      if (!file.name.match(/\.(xlsx|xls)$/)) {
        toast.error("Molimo odaberite Excel datoteku (.xlsx ili .xls)");
        return;
      }
      setSelectedFile(file);
    }
  };

  const createLog = async (type, date, itemCount, items) => {
    try {
      await addDoc(collection(db, "logovi"), {
        type,
        date,
        itemCount,
        timestamp: new Date().toISOString(),
        items: items.map((item) => ({
          artiklId: item.artiklId,
          ulaz: item.ulaz,
          izlaz: item.izlaz,
          naziv:
            validArtikli.find((a) => a.slug === item.artiklId)?.naziv ||
            item.artiklId,
        })),
      });
      onLogAdded?.();
    } catch (error) {
      console.error("Error creating log:", error);
    }
  };

  const processExcelData = async (data, rows) => {
    // Prvo pronađi duplikate
    const duplicates = rows.reduce((acc, row, index) => {
      const artiklId = row[0].trim().toLowerCase().replaceAll(" ", "-");
      const existing = rows.findIndex(
        (r, i) =>
          i !== index &&
          r[0].trim().toLowerCase().replaceAll(" ", "-") === artiklId
      );

      if (existing !== -1 && !acc.some((d) => d.artiklId === artiklId)) {
        const naziv =
          validArtikli.find((a) => a.slug === artiklId)?.naziv || artiklId;
        acc.push({
          artiklId,
          naziv,
          redovi: [index + 2, existing + 2], // +2 jer Excel počinje od 1 i preskačemo header
        });
      }
      return acc;
    }, []);

    if (duplicates.length > 0) {
      setDuplicatesData(duplicates);
      return;
    }

    const stavke = rows.map((row) => {
      const [naziv, ulaz, izlaz] = row;
      return {
        artiklId: naziv.trim().toLowerCase().replaceAll(" ", "-"),
        ulaz: Number(ulaz) || 0,
        izlaz: Number(izlaz) || 0,
      };
    });

    // Provjeri postoji li već unos za taj datum
    const existingDoc = await getDoc(doc(db, "dnevniUnosi", selectedDate));

    if (existingDoc.exists()) {
      setPendingData(stavke);
      setIsUpdateModalOpen(true);
      return;
    }

    // Ako ne postoji, kreiraj novi
    await saveData(stavke, "CREATE");
  };

  const saveData = async (stavke, type) => {
    await setDoc(doc(collection(db, "dnevniUnosi"), selectedDate), {
      datum: selectedDate,
      stavke,
    });

    await createLog(type, selectedDate, stavke.length, stavke);

    toast.success(
      type === "CREATE" ? "Uspješno spremljeno!" : "Uspješno ažurirano!"
    );
    setStatus(
      type === "CREATE"
        ? "Datoteka je uspješno učitana i spremljena!"
        : "Datoteka je uspješno ažurirana!"
    );

    setIsUpdateModalOpen(false);
    setPendingData(null);
    setSelectedFile(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Molimo prvo odaberite Excel datoteku");
      return;
    }

    setStatus("Učitavam Excel datoteku...");
    const loadingToast = toast.loading("Učitavam Excel...");

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: "array" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];

        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        const rows = data.slice(1);

        const nepoznatiArtikli = rows
          .map((row) => row[0]?.trim().toLowerCase().replaceAll(" ", "-"))
          .filter(
            (artiklId) =>
              !validArtikli.some((artikl) => artikl.slug === artiklId)
          );

        if (nepoznatiArtikli.length > 0) {
          toast.error(`Nepoznati artikli: ${nepoznatiArtikli.join(", ")}`);
          setStatus("");
          setIsLoading(false);
          return;
        }

        await processExcelData(data, rows);
        toast.dismiss(loadingToast);
      } catch (err) {
        console.error(err);
        toast.error("Greška prilikom obrade Excel datoteke");
        toast.dismiss(loadingToast);
        setStatus("Došlo je do greške prilikom obrade datoteke.");
      }
    };

    reader.onerror = () => {
      toast.error("Greška prilikom čitanja datoteke");
      toast.dismiss(loadingToast);
      setStatus("Greška prilikom čitanja datoteke.");
    };

    reader.readAsArrayBuffer(selectedFile);
  };

  const handleDuplicatesConfirm = async () => {
    setDuplicatesData(null);
    const rows = XLSX.utils
      .sheet_to_json(
        XLSX.read(await selectedFile.arrayBuffer(), { type: "array" }).Sheets[
          XLSX.read(await selectedFile.arrayBuffer(), { type: "array" })
            .SheetNames[0]
        ],
        { header: 1 }
      )
      .slice(1);
    await processExcelData(rows, rows);
  };

  const handleDuplicatesCancel = () => {
    setDuplicatesData(null);
    setSelectedFile(null);
    setStatus("Spremanje otkazano zbog dupliciranih artikala.");
  };

  return (
    <div className="p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-6">Unos Excela</h2>
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Datum unosa
            </label>
            <div className="relative">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-0 focus:border-indigo-500 transition-colors"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <svg
                  className="h-5 w-5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                ></svg>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Excel datoteka
            </label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 ${
                isDragging
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-gray-300 border-dashed"
              } rounded-lg hover:border-indigo-500 transition-colors`}
            >
              <div className="space-y-1 text-center">
                <svg
                  className={`mx-auto h-12 w-12 ${
                    isDragging ? "text-indigo-500" : "text-gray-400"
                  }`}
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="flex flex-col gap-1 items-center text-sm text-gray-600">
                  <label className="relative cursor-pointer rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none">
                    <span>Odaberi datoteku</span>
                    <input
                      type="file"
                      accept=".xlsx, .xls"
                      onChange={handleFileSelect}
                      className="sr-only"
                    />
                  </label>
                  <p className="text-gray-500">ili povuci i ispusti</p>
                </div>
                <p className="text-xs text-gray-500">XLSX ili XLS do 10MB</p>
              </div>
            </div>
            {selectedFile && (
              <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                <svg
                  className="h-5 w-5 text-green-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{selectedFile.name}</span>
              </div>
            )}
          </div>
        </div>

        <div>
          <button
            onClick={handleUpload}
            className="w-full inline-flex justify-center items-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
          >
            <svg
              className="mr-2 h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            Spremi
          </button>
        </div>

        {status && (
          <div
            className={`p-4 rounded-lg ${
              status.includes("uspješno")
                ? "bg-green-50 text-green-700"
                : "bg-gray-50 text-gray-600"
            }`}
          >
            <p className="text-sm">{status}</p>
          </div>
        )}
      </div>

      {/* Duplicates Modal */}
      {duplicatesData && (
        <DuplicatesModal
          duplicates={duplicatesData}
          onConfirm={handleDuplicatesConfirm}
          onCancel={handleDuplicatesCancel}
        />
      )}

      {/* Update Confirmation Modal */}
      {isUpdateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Postojeći podaci
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Već postoje podaci za datum {format(selectedDate, "dd.MM.yyyy")}.
              Želite li ih ažurirati?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsUpdateModalOpen(false);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Odustani
              </button>
              <button
                onClick={() => saveData(pendingData, "UPDATE")}
                className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-md hover:bg-yellow-700"
              >
                Ažuriraj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExcelUploader;
