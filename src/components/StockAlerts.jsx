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
import { formatNumber, roundToFour } from "../utils/numberUtils";

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
            currentStock[stavka.artiklId] = roundToFour(
              currentStock[stavka.artiklId] +
                roundToFour((stavka.ulaz || 0) - (stavka.izlaz || 0))
            );
          });
        });

        // Filtriraj artikle koji su ispod minimalne količine
        const currentAlerts = artikliData
          .filter((artikl) => {
            const currentStockValue = currentStock[artikl.slug] || 0;
            const artiklMinStock = artikl.minStock || 10;
            return currentStockValue < artiklMinStock;
          })
          .map((artikl) => ({
            id: artikl.id,
            name: artikl.name,
            currentStock: roundToFour(currentStock[artikl.slug] || 0),
            minStock: artikl.minStock || 10,
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
            <Popover.Panel className="absolute z-50 mt-3 left-5 top-3 transform px-4 sm:px-0">
              <div className="overflow-hidden rounded-lg shadow-lg ring-1 ring-black ring-opacity-5">
                <div className="relative bg-white p-4">
                  <div className="flex items-center gap-2 mb-4">
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
                    <h3 className="text-lg font-medium text-yellow-800">
                      Upozorenje o zalihama
                    </h3>
                  </div>

                  <div className="w-[480px]">
                    <div className="border rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[280px] border-b border-gray-200">
                              Artikl
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px] border-b border-gray-200">
                              Trenutno
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px] border-b border-gray-200">
                              Minimum
                            </th>
                          </tr>
                        </thead>
                      </table>
                      <div className="max-h-[300px] overflow-y-auto">
                        <table className="min-w-full">
                          <tbody className="bg-white divide-y divide-gray-100">
                            {alerts.map((alert) => (
                              <tr
                                key={alert.id}
                                className="hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                              >
                                <td className="px-4 py-2.5 text-sm font-medium text-gray-900 w-[280px] text-left border-r border-gray-100">
                                  {alert.name}
                                </td>
                                <td className="px-4 py-2.5 text-sm text-center text-red-600 font-medium w-[100px] border-r border-gray-100">
                                  {formatNumber(alert.currentStock)}
                                </td>
                                <td className="px-4 py-2.5 text-sm text-center text-gray-500 w-[100px]">
                                  {formatNumber(alert.minStock)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
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
