import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { v4 as uuidv4 } from "uuid";
import { toast } from "react-hot-toast";
import { DragDropContext, Draggable } from "react-beautiful-dnd";
import { StrictModeDroppable } from "./StrictModeDroppable";

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

  const fetchArtikli = async () => {
    const querySnapshot = await getDocs(collection(db, "artikli"));
    const data = querySnapshot.docs.map((doc) => ({
      docId: doc.id,
      ...doc.data(),
    }));
    const sortedData = data.sort((a, b) => a.order - b.order);
    setArtikli(sortedData);
  };

  useEffect(() => {
    fetchArtikli();
  }, []);

  const getNextOrder = () => {
    if (artikli.length === 0) return 0;
    const maxOrder = Math.max(...artikli.map((a) => a.order ?? 0));
    return maxOrder + 1;
  };

  const handleAddArtikli = async () => {
    const artikliNames = textareaContent
      .split("\n")
      .filter((name) => name.trim());

    try {
      const existingArtikli = new Set(artikli.map((a) => a.slug));
      const duplicates = [];
      let currentOrder = getNextOrder();

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
          order: currentOrder,
          minStock: 10,
        });

        currentOrder++;
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

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, "artikli", selectedArtikl.docId));
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
      const slug = trimmedName.toLowerCase().replace(/\s+/g, "-");

      const exists = artikli.some(
        (a) => a.slug === slug && a.docId !== selectedArtikl.docId
      );
      if (exists) {
        toast.error("Artikl s tim imenom već postoji");
        return;
      }

      await updateDoc(doc(db, "artikli", selectedArtikl.docId), {
        name: trimmedName,
        slug: slug,
        order: selectedArtikl.order,
        minStock: parseInt(editMinStock) || 10,
      });

      toast.success("Artikl uspješno ažuriran");
      fetchArtikli();
      setIsEditModalOpen(false);
      setSelectedArtikl(null);
      setEditName("");
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

        <div className="bg-white rounded-lg shadow">
          {isSortMode ? (
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
            <ul className="divide-y divide-gray-200">
              {artikli.map((artikl) => (
                <li
                  key={artikl.docId}
                  className="px-6 py-4 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-gray-400 text-sm">
                      #{artikl.order + 1}
                    </span>
                    <span className="text-gray-900">{artikl.name}</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-sm text-gray-500">
                      Min. stanje: {artikl.minStock || 10}
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setSelectedArtikl(artikl);
                          setEditName(artikl.name);
                          setEditMinStock(artikl.minStock?.toString() || "10");
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
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Modals with updated styling */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center">
            <div className="bg-white rounded-lg shadow-xl w-[500px] max-w-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">
                  Dodaj nove artikle
                </h2>
              </div>
              <div className="p-6">
                <textarea
                  value={textareaContent}
                  onChange={(e) => setTextareaContent(e.target.value)}
                  placeholder="Unesi artikle (jedan po retku)&#10;npr:&#10;Coca Cola 0.5L&#10;Jamnica 1L"
                  className="w-full h-40 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-3">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  Odustani
                </button>
                <button
                  onClick={handleAddArtikli}
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
                    Naziv artikla
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Naziv artikla"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 text-left">
                    Minimalno stanje
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editMinStock}
                    onChange={(e) => setEditMinStock(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Minimalno stanje"
                  />
                  <p className="mt-1 text-sm text-gray-500">
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
