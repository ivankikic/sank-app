import {
  getFirestore,
  collection,
  setDoc,
  doc,
  getDocs,
  deleteDoc,
} from "firebase/firestore";
import { db } from "./firebase.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const artikli = JSON.parse(
  readFileSync(join(__dirname, "artikli.json"), "utf8")
);

async function deleteAllArtikli() {
  try {
    const querySnapshot = await getDocs(collection(db, "artikli"));
    const deletePromises = querySnapshot.docs.map((doc) => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    console.log("🗑️ Svi postojeći artikli su obrisani!");
  } catch (error) {
    console.error("❌ Greška kod brisanja artikala:", error);
  }
}

async function uploadArtikli() {
  try {
    // Prvo obriši sve postojeće artikle
    await deleteAllArtikli();

    // Zatim dodaj nove artikle
    for (const artikl of artikli) {
      const docRef = doc(collection(db, "artikli")); // automatski ID
      await setDoc(docRef, artikl);
      console.log(`✅ Dodan artikl: ${artikl.name}`);
    }
    console.log("🎉 Svi artikli su uspješno dodani!");
  } catch (error) {
    console.error("❌ Greška kod dodavanja artikala:", error);
  }
}

uploadArtikli();
