import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { Popover, Transition } from "@headlessui/react";
import { Fragment } from "react";

const StockAlerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      const settingsDoc = await getDoc(doc(db, "settings", "appSettings"));
      if (settingsDoc.exists()) {
        setSettings(settingsDoc.data());
      }
      setIsLoading(false);
    };
    loadSettings();
  }, []);

  useEffect(() => {
    const checkStock = async () => {
      if (!settings?.stockAlerts?.enabled) return;

      try {
        // Dohvati sve artikle
        const artikliQuery = query(collection(db, "artikli"));
        const artikliSnapshot = await getDocs(artikliQuery);
        const artikliData = artikliSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Dohvati sve unose sortirane po datumu
        const unosiQuery = query(
          collection(db, "dnevniUnosi"),
          orderBy("datum")
        );
        const unosiSnapshot = await getDocs(unosiQuery);

        // Izračunaj trenutno stanje za svaki artikl
        const currentStock = {};

        unosiSnapshot.docs.forEach((doc) => {
          const stavke = doc.data().stavke;
          stavke.forEach((stavka) => {
            if (!currentStock[stavka.artiklId]) {
              currentStock[stavka.artiklId] = 0;
            }
            currentStock[stavka.artiklId] +=
              (stavka.ulaz || 0) - (stavka.izlaz || 0);
          });
        });

        // Filtriraj artikle koji su ispod minimalne količine
        const minStock = settings.stockAlerts.minStock || 10;
        const currentAlerts = artikliData
          .filter((artikl) => (currentStock[artikl.slug] || 0) <= minStock)
          .map((artikl) => ({
            id: artikl.id,
            name: artikl.name,
            currentStock: currentStock[artikl.slug] || 0,
            minStock,
          }));

        setAlerts(currentAlerts);
      } catch (error) {
        console.error("Error checking stock:", error);
      }
    };

    if (!isLoading && settings) {
      checkStock();
    }
  }, [settings, isLoading]);

  if (isLoading || !settings?.stockAlerts?.enabled || alerts.length === 0) {
    return null;
  }

  return (
    <Popover className="relative flex items-center justify-center">
      {({ open }) => (
        <>
          <Popover.Button
            className={`${
              open ? "text-yellow-500" : "text-yellow-400"
            } hover:text-yellow-500 focus:outline-none ml-3`}
          >
            <div className="relative">
              <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-xs text-white flex items-center justify-center">
                {alerts.length}
              </span>
            </div>
          </Popover.Button>

          <Transition
            as={Fragment}
            enter="transition ease-out duration-200"
            enterFrom="opacity-0 translate-y-1"
            enterTo="opacity-100 translate-y-0"
            leave="transition ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 translate-y-1"
          >
            <Popover.Panel className="absolute z-50 mt-3 left-5 top-3 transform px-4 sm:px-0 lg:max-w-md">
              <div className="overflow-hidden rounded-lg shadow-lg ring-1 ring-black ring-opacity-5">
                <div className="relative bg-white p-6 w-[400px]">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg
                        className="h-6 w-6 text-yellow-400"
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
                    <div className="ml-4 flex-1">
                      <h3 className="text-lg font-medium text-yellow-800 mb-3">
                        Upozorenje o zalihama
                      </h3>
                      <div className="text-sm text-yellow-700">
                        <ul className="space-y-2 max-h-[300px] overflow-y-auto">
                          {alerts.map((alert) => (
                            <li
                              key={alert.id}
                              className="flex items-baseline text-left"
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 mr-2 mt-1.5 flex-shrink-0"></span>
                              <span className="flex-1">
                                <span className="font-medium">
                                  {alert.name}
                                </span>
                                <span className="block text-gray-600">
                                  Trenutno stanje:{" "}
                                  <span className="font-medium text-gray-900">
                                    {alert.currentStock}
                                  </span>
                                </span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Popover.Panel>
          </Transition>
        </>
      )}
    </Popover>
  );
};

export default StockAlerts;
