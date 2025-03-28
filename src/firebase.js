import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCyR6hw9HMAdwg9x55jUbt21B_XuhCrRPA",
  authDomain: "sank-app.firebaseapp.com",
  projectId: "sank-app",
  storageBucket: "sank-app.firebasestorage.app",
  messagingSenderId: "724293666557",
  appId: "1:724293666557:web:6bc3b3ebcb3f7b4211e094",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
