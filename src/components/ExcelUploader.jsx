// src/components/ExcelUploader.jsx
import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { collection, doc, setDoc, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import toast from "react-hot-toast";

const ExcelUploader = () => {
  const [status, setStatus] = useState("");
  const [validArtikli, setValidArtikli] = useState(null);

  // Dohvati listu važećih artikala pri mountanju komponente
  useEffect(() => {
    const fetchArtikli = async () => {
      try {
        const artikliSnapshot = await getDocs(collection(db, "artikli"));
        const artikliIds = artikliSnapshot.docs.map((doc) => doc.id);
        setValidArtikli(artikliIds);
      } catch (error) {
        toast.error("Greška pri dohvaćanju artikala");
      }
    };
    fetchArtikli();
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setStatus("Učitavam...");
    toast.loading("Učitavam Excel...");

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];

      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
      const rows = data.slice(1);

      // Provjeri sve artikle prije obrade
      const nepoznatiArtikli = rows
        .map((row) => row[0]?.trim().toLowerCase().replaceAll(" ", "-"))
        .filter((artiklId) => !validArtikli.includes(artiklId));

      if (nepoznatiArtikli.length > 0) {
        toast.error(`Nepoznati artikli: ${nepoznatiArtikli.join(", ")}`);
        setStatus("");
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

      const today = new Date();
      const datumStr = today.toISOString().split("T")[0];

      try {
        await setDoc(doc(collection(db, "dnevniUnosi"), datumStr), {
          datum: datumStr,
          stavke,
        });
        toast.success("Uspješno spremljeno!");
        setStatus("");
      } catch (err) {
        console.error(err);
        toast.error("Greška prilikom spremanja");
        setStatus("");
      }
    };

    reader.readAsBinaryString(file);
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Import Excela</h2>
      <input
        type="file"
        accept=".xlsx, .xls"
        onChange={handleFileUpload}
        className="mb-4"
      />
      {status && (
        <p style={{ whiteSpace: "pre-line" }} className="text-sm">
          {status}
        </p>
      )}
    </div>
  );
};

export default ExcelUploader;
