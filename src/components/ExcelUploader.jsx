import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { collection, doc, setDoc, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import toast from "react-hot-toast";

const ExcelUploader = () => {
  const [status, setStatus] = useState("");
  const [validArtikli, setValidArtikli] = useState(null);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [selectedFile, setSelectedFile] = useState(null);

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

        const stavke = rows.map((row) => {
          const [naziv, ulaz, izlaz] = row;
          return {
            artiklId: naziv.trim().toLowerCase().replaceAll(" ", "-"),
            ulaz: Number(ulaz) || 0,
            izlaz: Number(izlaz) || 0,
          };
        });

        const datumStr = selectedDate;

        console.log("Spremam podatke za datum:", datumStr);
        console.log("Stavke:", stavke);

        await setDoc(doc(collection(db, "dnevniUnosi"), datumStr), {
          datum: datumStr,
          stavke,
        });
        toast.success("Uspješno spremljeno!");
        toast.dismiss(loadingToast);
        setStatus("Datoteka je uspješno učitana i spremljena!");
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

  return (
    <div className="p-4 border rounded-lg shadow-sm">
      <h2 className="text-xl font-bold mb-4">Import Excela</h2>
      <div className="flex flex-col gap-4">
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="border p-2 rounded"
        />
        <input
          type="file"
          accept=".xlsx, .xls"
          onChange={handleFileSelect}
          className="border p-2 rounded"
        />
        <button
          onClick={handleUpload}
          className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition-colors"
        >
          Upload
        </button>
        {status && (
          <div className="mt-4 p-3 bg-gray-100 rounded">
            <p className="text-sm">{status}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExcelUploader;
