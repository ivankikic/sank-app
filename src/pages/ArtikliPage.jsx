import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  writeBatch,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";
import { v4 as uuidv4 } from "uuid";
import { toast } from "react-hot-toast";
import { DragDropContext, Draggable } from "react-beautiful-dnd";
import { StrictModeDroppable } from "./StrictModeDroppable";
import { startOfDay } from "date-fns";
import { formatNumber, roundToFour } from "../utils/numberUtils";

function ArtikliPage() {
  const [artikli, setArtikli] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSortMode, setIsSortMode] = useState(false);
  const [textareaContent, setTextareaContent] = useState("");
  const [selectedArtikl, setSelectedArtikl] = useState(null);
  const [editName, setEditName] = useState("");
  const [editMinStock, setEditMinStock] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [currentStocks, setCurrentStocks] = useState({});
  const [isLoadingStocks, setIsLoadingStocks] = useState(true);
  const [newArtikl, setNewArtikl] = useState({
    sifra: "",
    name: "",
    minStock: "10",
  });
  const [editSifra, setEditSifra] = useState("");

  const fetchArtikli = async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "artikli"));
      const data = querySnapshot.docs.map((doc) => ({
        docId: doc.id,
        ...doc.data(),
      }));
      const sortedData = data.sort((a, b) => a.order - b.order);
      setArtikli(sortedData);
    } catch (error) {
      console.error("Error fetching artikli:", error);
      toast.error("Greška pri dohvaćanju artikala");
    } finally {
      setIsLoading(false);
    }
  };

  const calculateCurrentStocks = async () => {
    setIsLoadingStocks(true);
    try {
      const unosiQuery = query(collection(db, "dnevniUnosi"), orderBy("datum"));
      const unosiSnapshot = await getDocs(unosiQuery);

      const stocks = {};
      unosiSnapshot.docs.forEach((doc) => {
        const stavke = doc.data().stavke;
        stavke.forEach((stavka) => {
          if (!stocks[stavka.artiklId]) {
            stocks[stavka.artiklId] = 0;
          }
          stocks[stavka.artiklId] += (stavka.ulaz || 0) - (stavka.izlaz || 0);
        });
      });

      setCurrentStocks(stocks);
    } catch (error) {
      console.error("Error calculating stocks:", error);
      toast.error("Greška pri dohvaćanju stanja");
    } finally {
      setIsLoadingStocks(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      await fetchArtikli();
      await calculateCurrentStocks();
    };
    loadData();
  }, []);

  const getNextOrder = () => {
    if (artikli.length === 0) return 0;
    const maxOrder = Math.max(...artikli.map((a) => a.order ?? 0));
    return maxOrder + 1;
  };

  const handleAddArtikl = async () => {
    try {
      const trimmedName = newArtikl.name.trim();
      const trimmedSifra = newArtikl.sifra.trim();

      if (!trimmedSifra || !trimmedName) {
        toast.error("Šifra i naziv su obavezni");
        return;
      }

      const exists = artikli.some((a) => a.sifra === trimmedSifra);
      if (exists) {
        toast.error("Artikl s tom šifrom već postoji");
        return;
      }

      // Provjeri je li minStock validan broj
      if (isNaN(newArtikl.minStock)) {
        toast.error("Minimalno stanje mora biti broj");
        return;
      }

      const slug = trimmedName.toLowerCase().replace(/\s+/g, "-");

      await addDoc(collection(db, "artikli"), {
        id: uuidv4().slice(0, 8),
        sifra: trimmedSifra,
        name: trimmedName,
        slug: slug,
        order: getNextOrder(),
        minStock: newArtikl.minStock, // Spremi kao string, ne pretvaraj u number
      });

      fetchArtikli();
      setIsModalOpen(false);
      setNewArtikl({ sifra: "", name: "", minStock: "10" });
      toast.success("Artikl uspješno dodan");
    } catch (error) {
      console.error("Error adding article:", error);
      toast.error("Došlo je do greške prilikom dodavanja artikla");
    }
  };

  const handleDelete = async () => {
    try {
      // First delete the article
      await deleteDoc(doc(db, "artikli", selectedArtikl.docId));

      // Get remaining articles and update their order
      const remainingArtikli = artikli.filter(
        (artikl) => artikl.docId !== selectedArtikl.docId
      );

      // Update the order of all remaining articles
      const batch = writeBatch(db);
      remainingArtikli.forEach((artikl, index) => {
        if (artikl.order !== index) {
          const artiklRef = doc(db, "artikli", artikl.docId);
          batch.update(artiklRef, { order: index });
        }
      });

      // Commit all updates in a batch
      await batch.commit();

      toast.success("Artikl uspješno obrisan");
      fetchArtikli();
      setIsDeleteModalOpen(false);
      setSelectedArtikl(null);
    } catch (error) {
      console.error("Error deleting article:", error);
      toast.error("Greška prilikom brisanja artikla");
    }
  };

  const handleEdit = async () => {
    try {
      const trimmedName = editName.trim();
      const trimmedSifra = editSifra.trim();
      const slug = selectedArtikl.slug;

      if (!trimmedSifra) {
        toast.error("Šifra je obavezna");
        return;
      }

      const exists = artikli.some(
        (a) => a.sifra === trimmedSifra && a.docId !== selectedArtikl.docId
      );
      if (exists) {
        toast.error("Artikl s tom šifrom već postoji");
        return;
      }

      // Provjeri je li editMinStock validan broj
      if (isNaN(editMinStock)) {
        toast.error("Minimalno stanje mora biti broj");
        return;
      }

      await updateDoc(doc(db, "artikli", selectedArtikl.docId), {
        name: trimmedName,
        sifra: trimmedSifra,
        slug: slug,
        order: selectedArtikl.order,
        minStock: editMinStock, // Spremi kao string, ne pretvaraj u number
      });

      toast.success("Artikl uspješno ažuriran");
      fetchArtikli();
      setIsEditModalOpen(false);
      setSelectedArtikl(null);
      setEditName("");
      setEditSifra("");
      setEditMinStock("");
    } catch (error) {
      console.error("Greška prilikom ažuriranja artikla:", error);
      toast.error("Greška prilikom ažuriranja artikla");
    }
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const items = Array.from(artikli);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update order values
    const updatedItems = items.map((item, index) => ({
      ...item,
      order: index,
    }));

    setArtikli(updatedItems);
  };

  const handleSaveOrder = async () => {
    try {
      const batch = writeBatch(db);

      artikli.forEach((artikl) => {
        const artiklRef = doc(db, "artikli", artikl.docId);
        batch.update(artiklRef, { order: artikl.order });
      });

      await batch.commit();
      toast.success("Redoslijed uspješno spremljen");
      setIsSortMode(false);
      fetchArtikli(); // Refresh the list
    } catch (error) {
      console.error("Error saving order:", error);
      toast.error("Greška prilikom spremanja redoslijeda");
    }
  };

  // Dodaj funkciju za filtriranje artikala
  const filteredArtikli = artikli.filter((artikl) =>
    artikl.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-[1350px] mx-auto px-6">
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <div className="flex flex-col items-start">
            <h1 className="text-2xl font-semibold text-gray-900">Artikli</h1>
            <p className="text-sm text-gray-500 mt-1">
              Upravljanje artiklima i njihovim redoslijedom
            </p>
          </div>
          <div className="flex gap-3">
            {isSortMode ? (
              <>
                <button
                  onClick={handleSaveOrder}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                >
                  Spremi Redoslijed
                </button>
                <button
                  onClick={() => {
                    setIsSortMode(false);
                    fetchArtikli();
                  }}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Odustani
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setIsSortMode(true)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
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
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                  Sortiraj
                </button>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
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
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Dodaj Artikle
                </button>
              </>
            )}
          </div>
        </div>

        {/* Modificirani search bar */}
        <div className="flex justify-end">
          <div className="w-64 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                className="h-5 w-5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pretraži artikle..."
              className="w-full text-sm pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <svg
                  className="h-5 w-5 text-gray-400 hover:text-gray-600"
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
            )}
            {searchQuery && (
              <div className="absolute -bottom-6 left-0 text-sm text-gray-500">
                Pronađeno {filteredArtikli.length} artikala
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          {isLoading || isLoadingStocks ? (
            <div className="px-6 py-8 flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
              <p className="mt-4 text-sm text-gray-500">Učitavam podatke...</p>
            </div>
          ) : isSortMode ? (
            <DragDropContext onDragEnd={handleDragEnd}>
              <StrictModeDroppable droppableId="artikli">
                {(provided) => (
                  <ul
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="divide-y divide-gray-200"
                  >
                    {artikli.map((artikl, index) => (
                      <Draggable
                        key={artikl.docId}
                        draggableId={artikl.docId}
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <li
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`px-6 py-4 flex items-center justify-between ${
                              snapshot.isDragging ? "bg-gray-50" : ""
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <span className="text-gray-400 select-none">
                                ⋮⋮
                              </span>
                              <span className="text-gray-400 text-sm">
                                #{artikl.order + 1}
                              </span>
                              <span className="text-gray-900">
                                {artikl.name}
                              </span>
                            </div>
                          </li>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </ul>
                )}
              </StrictModeDroppable>
            </DragDropContext>
          ) : (
            <>
              {filteredArtikli.length === 0 ? (
                <div className="px-6 py-8 text-center">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="mt-4 text-gray-900 font-medium">
                    Nema pronađenih artikala
                  </p>
                  <p className="mt-1 text-gray-500">
                    Pokušajte s drugačijim pojmom za pretragu
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th
                          scope="col"
                          className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-12 border-b border-gray-200"
                        >
                          #
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200"
                        >
                          Šifra
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200"
                        >
                          Artikl
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200"
                        >
                          Trenutno stanje
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200"
                        >
                          Min. stanje
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200"
                        >
                          Akcije
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {filteredArtikli.map((artikl) => {
                        const currentStock = currentStocks[artikl.slug] || 0;
                        const minStock = artikl.minStock || "10";
                        const isLowStock = currentStock < Number(minStock);

                        return (
                          <tr key={artikl.docId} className="hover:bg-gray-50">
                            <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-400 border-r border-gray-100 text-center">
                              {artikl.order + 1}
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 border-r border-gray-100">
                              {artikl.sifra}
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-100 text-left">
                              {artikl.name}
                            </td>
                            <td
                              className={`px-6 py-3 whitespace-nowrap text-sm text-center font-medium border-r border-gray-100 ${
                                isLowStock ? "text-red-600" : "text-gray-900"
                              }`}
                            >
                              {formatNumber(currentStock)}
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-sm text-center text-gray-500 border-r border-gray-100">
                              {minStock}
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-sm text-center">
                              <div className="flex justify-center gap-3">
                                <button
                                  onClick={() => {
                                    setSelectedArtikl(artikl);
                                    setEditName(artikl.name);
                                    setEditSifra(artikl.sifra);
                                    setEditMinStock(
                                      artikl.minStock?.toString() || "10"
                                    );
                                    setIsEditModalOpen(true);
                                  }}
                                  className="text-gray-400 hover:text-indigo-600 transition-colors"
                                >
                                  Uredi
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedArtikl(artikl);
                                    setIsDeleteModalOpen(true);
                                  }}
                                  className="text-gray-400 hover:text-red-600 transition-colors"
                                >
                                  Obriši
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        {/* Novi modal za unos artikla */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center">
            <div className="bg-white rounded-lg shadow-xl w-[500px] max-w-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">
                  Dodaj novi artikl
                </h2>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 text-left">
                    Šifra artikla
                  </label>
                  <input
                    type="text"
                    value={newArtikl.sifra}
                    onChange={(e) =>
                      setNewArtikl((prev) => ({
                        ...prev,
                        sifra: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Unesite šifru artikla"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 text-left">
                    Naziv artikla
                  </label>
                  <input
                    type="text"
                    value={newArtikl.name}
                    onChange={(e) =>
                      setNewArtikl((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Unesite naziv artikla"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 text-left">
                    Minimalno stanje
                  </label>
                  <input
                    type="text"
                    value={newArtikl.minStock}
                    onChange={(e) =>
                      setNewArtikl((prev) => ({
                        ...prev,
                        minStock: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Unesite minimalno stanje"
                  />
                </div>
              </div>
              <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-3">
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    setNewArtikl({ sifra: "", name: "", minStock: "10" });
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  Odustani
                </button>
                <button
                  onClick={handleAddArtikl}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Spremi
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Modal - novi stil */}
        {isDeleteModalOpen && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center">
            <div className="bg-white rounded-lg shadow-xl w-[500px] max-w-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">
                  Potvrda brisanja
                </h2>
              </div>
              <div className="p-6">
                <p className="text-gray-700 text-left">
                  Jeste li sigurni da želite obrisati artikl "
                  <span className="font-medium">{selectedArtikl?.name}</span>"?
                </p>
              </div>
              <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-3">
                <button
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setSelectedArtikl(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  Odustani
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Obriši
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal - novi stil */}
        {isEditModalOpen && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center">
            <div className="bg-white rounded-lg shadow-xl w-[500px] max-w-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">
                  Uredi artikl
                </h2>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 text-left">
                    Šifra artikla
                  </label>
                  <input
                    type="text"
                    value={editSifra}
                    onChange={(e) => setEditSifra(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Unesite šifru artikla"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 text-left">
                    Naziv artikla
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Unesite naziv artikla"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 text-left">
                    Minimalno stanje
                  </label>
                  <input
                    type="text"
                    value={editMinStock}
                    onChange={(e) => setEditMinStock(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Minimalno stanje"
                  />
                  <p className="mt-1 text-sm text-gray-500 text-left">
                    Upozorenje će se prikazati kada zalihe padnu ispod ove
                    vrijednosti
                  </p>
                </div>
              </div>
              <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-3">
                <button
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setSelectedArtikl(null);
                    setEditName("");
                    setEditSifra("");
                    setEditMinStock("");
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  Odustani
                </button>
                <button
                  onClick={handleEdit}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Spremi
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ArtikliPage;
