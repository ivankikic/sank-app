// src/pages/ArtikliPage.jsx
import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

function ArtikliPage() {
  const [artikli, setArtikli] = useState([]);

  useEffect(() => {
    const fetchArtikli = async () => {
      const querySnapshot = await getDocs(collection(db, "artikli"));
      const data = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setArtikli(data);
    };

    fetchArtikli();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Artikli</h1>
      <ul className="space-y-2">
        {artikli.map((art) => (
          <li
            key={art.id}
            className="p-3 bg-white rounded shadow hover:shadow-md transition-shadow"
          >
            {art.naziv}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ArtikliPage;
