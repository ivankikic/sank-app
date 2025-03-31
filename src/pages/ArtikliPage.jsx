import { useEffect, useState } from "react";
import { collection, getDocs, addDoc } from "firebase/firestore";
import { db } from "../firebase";
import { v4 as uuidv4 } from "uuid";
import { toast } from "react-hot-toast";
function ArtikliPage() {
  const [artikli, setArtikli] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [textareaContent, setTextareaContent] = useState("");

  const fetchArtikli = async () => {
    const querySnapshot = await getDocs(collection(db, "artikli"));
    const data = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setArtikli(data);
  };

  useEffect(() => {
    fetchArtikli();
  }, []);

  const handleAddArtikli = async () => {
    const artikliNames = textareaContent
      .split("\n")
      .filter((name) => name.trim());

    try {
      const existingArtikli = new Set(artikli.map((a) => a.slug));
      const duplicates = [];

      for (const name of artikliNames) {
        const trimmedName = name.trim();
        const slug = trimmedName.toLowerCase().replace(/\s+/g, "-");

        if (existingArtikli.has(slug)) {
          duplicates.push(trimmedName);
          continue;
        }

        await addDoc(collection(db, "artikli"), {
          id: uuidv4().slice(0, 8),
          name: trimmedName,
          slug: slug,
        });
      }

      if (duplicates.length > 0) {
        toast.error(`Sljedeći artikli već postoje:\n${duplicates.join("\n")}`);
      }

      fetchArtikli();
      setIsModalOpen(false);
      setTextareaContent("");
    } catch (error) {
      console.error("Error adding articles:", error);
      toast.error("Došlo je do greške prilikom dodavanja artikala");
    }
  };

  return (
    <div className="p-6 relative">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Artikli</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Dodaj Artikle
        </button>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-96">
            <h2 className="text-xl font-bold mb-4">Dodaj Nove Artikle</h2>
            <textarea
              value={textareaContent}
              onChange={(e) => setTextareaContent(e.target.value)}
              placeholder="Unesi artikle (jedan po retku)&#10;npr:&#10;Coca Cola 0.5L&#10;Jamnica 1L"
              className="w-full h-40 p-2 border rounded mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Odustani
              </button>
              <button
                onClick={handleAddArtikli}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Spremi
              </button>
            </div>
          </div>
        </div>
      )}

      <ul className="space-y-2">
        {artikli.map((artikl) => (
          <li
            key={artikl.id}
            className="p-3 bg-white rounded shadow hover:shadow-md transition-shadow"
          >
            {artikl.name}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ArtikliPage;
