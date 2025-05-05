import { useState, useEffect, useMemo } from "react";
import { collection, getDocs, query, orderBy, where } from "firebase/firestore";
import { db } from "../firebase";
import { format, parseISO, subMonths, addDays, addMonths } from "date-fns";
import { hr } from "date-fns/locale";
import { Line, Bar, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { formatNumber, roundToFour } from "../utils/numberUtils";

// Registriranje svih potrebnih komponenti Chart.js-a
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const StatistikaPage = () => {
  const [artikli, setArtikli] = useState([]);
  const [dnevniUnosi, setDnevniUnosi] = useState([]);
  const [selectedArtikli, setSelectedArtikli] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("sve"); // "sve", "godina", "6mjeseci", "mjesec", "trenutnaGodina"
  const [graphGranularity, setGraphGranularity] = useState("day"); // "day", "week", "month"

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Dohvati artikle
        const artikliQuery = query(
          collection(db, "artikli"),
          orderBy("order", "asc")
        );
        const artikliSnapshot = await getDocs(artikliQuery);
        const artikliData = artikliSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setArtikli(artikliData);

        // Dohvati sve dnevne unose
        let unosiQuery;
        const today = new Date();

        if (timeRange === "trenutnaGodina") {
          const startOfYear = new Date(today.getFullYear(), 0, 1); // 1. siječnja tekuće godine
          unosiQuery = query(
            collection(db, "dnevniUnosi"),
            where("datum", ">=", format(startOfYear, "yyyy-MM-dd")),
            orderBy("datum")
          );
        } else if (timeRange === "godina") {
          const lastYear = subMonths(today, 12);
          unosiQuery = query(
            collection(db, "dnevniUnosi"),
            where("datum", ">=", format(lastYear, "yyyy-MM-dd")),
            orderBy("datum")
          );
        } else if (timeRange === "6mjeseci") {
          const lastSixMonths = subMonths(today, 6);
          unosiQuery = query(
            collection(db, "dnevniUnosi"),
            where("datum", ">=", format(lastSixMonths, "yyyy-MM-dd")),
            orderBy("datum")
          );
        } else if (timeRange === "mjesec") {
          const lastMonth = subMonths(today, 1);
          unosiQuery = query(
            collection(db, "dnevniUnosi"),
            where("datum", ">=", format(lastMonth, "yyyy-MM-dd")),
            orderBy("datum")
          );
        } else {
          // Za "sve"
          unosiQuery = query(collection(db, "dnevniUnosi"), orderBy("datum"));
        }

        const unosiSnapshot = await getDocs(unosiQuery);
        const unosiData = unosiSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setDnevniUnosi(unosiData);

        // Postavi početna 3 artikla za praćenje ako nisu već postavljeni
        if (selectedArtikli.length === 0 && artikliData.length > 0) {
          setSelectedArtikli(artikliData.slice(0, 3).map((a) => a.slug));
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
      setIsLoading(false);
    };

    fetchData();
  }, [timeRange]);

  // Izračunaj ukupni izlaz (prodaju) po artiklu
  const ukupnaProdaja = useMemo(() => {
    const prodaja = {};
    dnevniUnosi.forEach((unos) => {
      unos.stavke.forEach((stavka) => {
        if (stavka.izlaz) {
          if (!prodaja[stavka.artiklId]) {
            prodaja[stavka.artiklId] = 0;
          }
          prodaja[stavka.artiklId] = roundToFour(
            prodaja[stavka.artiklId] + stavka.izlaz
          );
        }
      });
    });
    return prodaja;
  }, [dnevniUnosi]);

  // Sortiraj artikle po prodaji za "Top prodaja" i "Najmanja prodaja"
  const sortiraniArtikli = useMemo(() => {
    return artikli
      .filter((artikl) => ukupnaProdaja[artikl.slug] !== undefined)
      .sort(
        (a, b) => (ukupnaProdaja[b.slug] || 0) - (ukupnaProdaja[a.slug] || 0)
      );
  }, [artikli, ukupnaProdaja]);

  // Izračunaj ukupni ulaz po artiklu
  const ukupniUlaz = useMemo(() => {
    const ulaz = {};
    dnevniUnosi.forEach((unos) => {
      unos.stavke.forEach((stavka) => {
        if (stavka.ulaz) {
          if (!ulaz[stavka.artiklId]) {
            ulaz[stavka.artiklId] = 0;
          }
          ulaz[stavka.artiklId] = roundToFour(
            ulaz[stavka.artiklId] + stavka.ulaz
          );
        }
      });
    });
    return ulaz;
  }, [dnevniUnosi]);

  // Podaci za linijski graf (kretanje prodaje kroz vrijeme)
  const lineChartData = useMemo(() => {
    const podaciPoVremenu = {};
    const vremenskeOznake = [];

    // Pronađi najraniji i najkasniji datum
    let najranijiDatum = new Date();
    let najkasnijiDatum = new Date(0);

    dnevniUnosi.forEach((unos) => {
      const datum = parseISO(unos.datum);
      if (datum < najranijiDatum) najranijiDatum = datum;
      if (datum > najkasnijiDatum) najkasnijiDatum = datum;
    });

    // Funkcija za generiranje ključa ovisno o granularnosti
    const getTimeKey = (datum) => {
      switch (graphGranularity) {
        case "day":
          return format(datum, "yyyy-MM-dd");
        case "week":
          return format(datum, "yyyy-'W'ww");
        case "month":
        default:
          return format(datum, "yyyy-MM");
      }
    };

    // Funkcija za formatiranje labele
    const formatLabel = (timeKey) => {
      switch (graphGranularity) {
        case "day":
          return format(parseISO(timeKey), "dd.MM.");
        case "week": {
          const [year, week] = timeKey.split("-W");
          return `T${week}/${year.substring(2)}`;
        }
        case "month":
        default: {
          const [year, month] = timeKey.split("-");
          return `${month}/${year.substring(2)}`;
        }
      }
    };

    // Generiraj sve vremenske oznake
    let trenutniDatum = najranijiDatum;
    while (trenutniDatum <= najkasnijiDatum) {
      const timeKey = getTimeKey(trenutniDatum);
      if (!vremenskeOznake.includes(timeKey)) {
        vremenskeOznake.push(timeKey);
        podaciPoVremenu[timeKey] = {};
        selectedArtikli.forEach((artiklId) => {
          podaciPoVremenu[timeKey][artiklId] = 0;
        });
      }

      // Pomakni datum ovisno o granularnosti
      switch (graphGranularity) {
        case "day":
          trenutniDatum = addDays(trenutniDatum, 1);
          break;
        case "week":
          trenutniDatum = addDays(trenutniDatum, 7);
          break;
        case "month":
          trenutniDatum = addMonths(trenutniDatum, 1);
          break;
      }
    }

    // Popuni podatke
    dnevniUnosi.forEach((unos) => {
      const datum = parseISO(unos.datum);
      const timeKey = getTimeKey(datum);

      if (podaciPoVremenu[timeKey]) {
        unos.stavke.forEach((stavka) => {
          if (selectedArtikli.includes(stavka.artiklId) && stavka.izlaz) {
            podaciPoVremenu[timeKey][stavka.artiklId] = roundToFour(
              podaciPoVremenu[timeKey][stavka.artiklId] + stavka.izlaz
            );
          }
        });
      }
    });

    const datasets = selectedArtikli.map((artiklId, index) => {
      const artikl = artikli.find((a) => a.slug === artiklId);
      const artikIme = artikl ? artikl.name : artiklId;

      const colors = [
        { line: "rgba(75, 192, 192, 1)", fill: "rgba(75, 192, 192, 0.2)" },
        { line: "rgba(153, 102, 255, 1)", fill: "rgba(153, 102, 255, 0.2)" },
        { line: "rgba(255, 159, 64, 1)", fill: "rgba(255, 159, 64, 0.2)" },
        { line: "rgba(54, 162, 235, 1)", fill: "rgba(54, 162, 235, 0.2)" },
      ];

      return {
        label: artikIme,
        data: vremenskeOznake.map((key) => podaciPoVremenu[key][artiklId]),
        borderColor: colors[index % colors.length].line,
        backgroundColor: colors[index % colors.length].fill,
        tension: 0.4,
        fill: true,
      };
    });

    return {
      labels: vremenskeOznake.map(formatLabel),
      datasets,
    };
  }, [dnevniUnosi, selectedArtikli, artikli, graphGranularity]);

  // Pronađi dan s najviše i najmanje prodaje
  const daniProdaje = useMemo(() => {
    const dnevnaProdaja = {};

    dnevniUnosi.forEach((unos) => {
      let ukupnoIzlaz = 0;
      unos.stavke.forEach((stavka) => {
        if (stavka.izlaz) {
          ukupnoIzlaz = roundToFour(ukupnoIzlaz + stavka.izlaz);
        }
      });
      dnevnaProdaja[unos.datum] = ukupnoIzlaz;
    });

    let najviseProdan = { datum: "", kolicina: 0 };
    let najmanjeProdan = { datum: "", kolicina: Infinity };

    Object.entries(dnevnaProdaja).forEach(([datum, kolicina]) => {
      if (kolicina > najviseProdan.kolicina) {
        najviseProdan = { datum, kolicina };
      }
      if (kolicina < najmanjeProdan.kolicina && kolicina > 0) {
        najmanjeProdan = { datum, kolicina };
      }
    });

    return { najviseProdan, najmanjeProdan };
  }, [dnevniUnosi]);

  // Podaci za pie chart (udio prodaje po artiklima)
  const pieChartData = useMemo(() => {
    const top5 = sortiraniArtikli.slice(0, 5);
    const ostali = sortiraniArtikli.slice(5);

    const ukupnaProdajaSum = Object.values(ukupnaProdaja).reduce(
      (a, b) => a + b,
      0
    );
    const ostaliUkupno = ostali.reduce(
      (acc, artikl) => acc + (ukupnaProdaja[artikl.slug] || 0),
      0
    );

    const labels = [...top5.map((a) => a.name), "Ostali"];
    const data = [...top5.map((a) => ukupnaProdaja[a.slug] || 0), ostaliUkupno];

    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: [
            "rgba(255, 99, 132, 0.8)",
            "rgba(54, 162, 235, 0.8)",
            "rgba(255, 206, 86, 0.8)",
            "rgba(75, 192, 192, 0.8)",
            "rgba(153, 102, 255, 0.8)",
            "rgba(200, 200, 200, 0.8)",
          ],
          borderColor: [
            "rgba(255, 99, 132, 1)",
            "rgba(54, 162, 235, 1)",
            "rgba(255, 206, 86, 1)",
            "rgba(75, 192, 192, 1)",
            "rgba(153, 102, 255, 1)",
            "rgba(200, 200, 200, 1)",
          ],
          borderWidth: 1,
        },
      ],
    };
  }, [sortiraniArtikli, ukupnaProdaja]);

  const barChartData = useMemo(() => {
    // Prikazujemo top 10 artikala
    const top10 = sortiraniArtikli.slice(0, 10);

    return {
      labels: top10.map((a) => a.name),
      datasets: [
        {
          label: "Ukupna prodaja",
          data: top10.map((a) => ukupnaProdaja[a.slug] || 0),
          backgroundColor: "rgba(54, 162, 235, 0.6)",
          borderColor: "rgba(54, 162, 235, 1)",
          borderWidth: 1,
        },
      ],
    };
  }, [sortiraniArtikli, ukupnaProdaja]);

  // Funkcija za promjenu odabranih artikala
  const handleArtiklCheck = (slug) => {
    if (selectedArtikli.includes(slug)) {
      setSelectedArtikli(selectedArtikli.filter((id) => id !== slug));
    } else {
      setSelectedArtikli([...selectedArtikli, slug]);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-[1350px] mx-auto px-4 flex justify-center items-center h-64">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          <span className="text-sm text-gray-600 font-medium">
            Učitavam podatke...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1350px] mx-auto px-4">
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-gray-900">Statistika</h1>
          <div className="flex gap-2">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="sve">Svi podaci</option>
              <option value="trenutnaGodina">
                {new Date().getFullYear()}. godina
              </option>
              <option value="godina">Zadnjih godinu dana</option>
              <option value="6mjeseci">Zadnjih 6 mjeseci</option>
              <option value="mjesec">Zadnjih mjesec dana</option>
            </select>
          </div>
        </div>

        {/* Top informacije u karticama */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xs uppercase font-bold text-gray-500 mb-1">
              Ukupno artikala
            </h2>
            <p className="text-2xl font-bold">{artikli.length}</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xs uppercase font-bold text-gray-500 mb-1">
              Ukupno dnevnih unosa
            </h2>
            <p className="text-2xl font-bold">{dnevniUnosi.length}</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xs uppercase font-bold text-gray-500 mb-1">
              Ukupno prodano
            </h2>
            <p className="text-2xl font-bold">
              {formatNumber(
                Object.values(ukupnaProdaja).reduce(
                  (a, b) => roundToFour(a + b),
                  0
                )
              )}
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xs uppercase font-bold text-gray-500 mb-1">
              Ukupno zaprimljeno
            </h2>
            <p className="text-2xl font-bold">
              {formatNumber(
                Object.values(ukupniUlaz).reduce(
                  (a, b) => roundToFour(a + b),
                  0
                )
              )}
            </p>
          </div>
        </div>

        {/* Dan s najviše i najmanje prodaje */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-sm font-bold text-gray-700 mb-4">
              Dan s najviše prodaje
            </h2>
            {daniProdaje.najviseProdan.datum ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500">Datum</p>
                  <p className="text-lg font-semibold">
                    {format(
                      parseISO(daniProdaje.najviseProdan.datum),
                      "d. MMMM yyyy.",
                      { locale: hr }
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Količina</p>
                  <p className="text-lg font-semibold text-right">
                    {formatNumber(daniProdaje.najviseProdan.kolicina)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">Nema podataka</p>
            )}
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-sm font-bold text-gray-700 mb-4">
              Dan s najmanje prodaje
            </h2>
            {daniProdaje.najmanjeProdan.datum ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500">Datum</p>
                  <p className="text-lg font-semibold">
                    {format(
                      parseISO(daniProdaje.najmanjeProdan.datum),
                      "d. MMMM yyyy.",
                      { locale: hr }
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Količina</p>
                  <p className="text-lg font-semibold text-right">
                    {formatNumber(daniProdaje.najmanjeProdan.kolicina)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">Nema podataka</p>
            )}
          </div>
        </div>

        {/* Top 5 i najmanje traženi artikli */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-sm font-bold text-gray-700 mb-4">
              Najprodavaniji artikli
            </h2>
            <ul className="space-y-2">
              {sortiraniArtikli.slice(0, 5).map((artikl, index) => (
                <li
                  key={artikl.id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center">
                    <span className="text-gray-400 text-xs mr-2">
                      {index + 1}.
                    </span>
                    <span>{artikl.name}</span>
                  </div>
                  <span className="font-medium text-indigo-600">
                    {formatNumber(ukupnaProdaja[artikl.slug] || 0)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-sm font-bold text-gray-700 mb-4">
              Najmanje prodavani artikli
            </h2>
            <ul className="space-y-2">
              {sortiraniArtikli
                .slice(-5)
                .reverse()
                .map((artikl, index) => (
                  <li
                    key={artikl.id}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center">
                      <span className="text-gray-400 text-xs mr-2">
                        {index + 1}.
                      </span>
                      <span>{artikl.name}</span>
                    </div>
                    <span className="font-medium text-indigo-600">
                      {formatNumber(ukupnaProdaja[artikl.slug] || 0)}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        </div>

        {/* Grafovi */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bar chart */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-sm font-bold text-gray-700 mb-4">
              Top 10 najprodavanijih artikala
            </h2>
            <div className="h-80">
              <Bar
                data={barChartData}
                options={{
                  maintainAspectRatio: false,
                  indexAxis: "y",
                  scales: {
                    y: {
                      ticks: {
                        callback: function (value) {
                          // Skrati imena ako su preduga
                          const label = this.getLabelForValue(value);
                          return label.length > 20
                            ? label.substr(0, 18) + "..."
                            : label;
                        },
                      },
                    },
                    x: {
                      ticks: {
                        callback: function (value) {
                          return formatNumber(value);
                        },
                      },
                    },
                  },
                  plugins: {
                    legend: {
                      display: false,
                    },
                    tooltip: {
                      callbacks: {
                        label: function (context) {
                          return `${context.label}: ${formatNumber(
                            context.raw
                          )}`;
                        },
                      },
                    },
                  },
                }}
              />
            </div>
          </div>

          {/* Pie chart */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-sm font-bold text-gray-700 mb-4">
              Udio prodaje po artiklima
            </h2>
            <div className="h-80 flex justify-center">
              <Pie
                key="pie-chart"
                data={pieChartData}
                options={{
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: "right",
                    },
                    tooltip: {
                      callbacks: {
                        label: (context) => {
                          const value = context.raw;
                          const total = context.dataset.data.reduce(
                            (a, b) => a + b,
                            0
                          );
                          const percentage = ((value / total) * 100).toFixed(1);
                          return `${context.label}: ${formatNumber(
                            value
                          )} (${percentage}%)`;
                        },
                      },
                    },
                  },
                }}
              />
            </div>
          </div>
        </div>

        {/* Linijski graf kretanja prodaje */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-bold text-gray-700">
              Kretanje prodaje kroz vrijeme
            </h2>
            <select
              value={graphGranularity}
              onChange={(e) => setGraphGranularity(e.target.value)}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="day">Po danu</option>
              <option value="week">Po tjednu</option>
              <option value="month">Po mjesecu</option>
            </select>
          </div>

          <div className="h-80">
            <Line
              key="line-chart"
              data={lineChartData}
              options={{
                maintainAspectRatio: false,
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      callback: function (value) {
                        return formatNumber(value);
                      },
                    },
                  },
                  x: {
                    ticks: {
                      maxRotation: 45,
                      minRotation: 45,
                    },
                  },
                },
                plugins: {
                  tooltip: {
                    mode: "index",
                    intersect: false,
                    callbacks: {
                      label: function (context) {
                        return `${context.dataset.label}: ${formatNumber(
                          context.raw
                        )}`;
                      },
                    },
                  },
                  legend: {
                    position: "top",
                  },
                },
              }}
            />
          </div>

          {/* Checkboxovi za odabir artikala premješteni ispod grafa */}
          <div className="mt-6 border-t pt-4">
            <div className="text-sm font-medium text-gray-700 mb-3">
              Odaberi artikle za prikaz:
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {artikli.map((artikl) => (
                <label key={artikl.id} className="inline-flex items-center">
                  <input
                    type="checkbox"
                    className="form-checkbox h-4 w-4 text-indigo-600"
                    checked={selectedArtikli.includes(artikl.slug)}
                    onChange={() => handleArtiklCheck(artikl.slug)}
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    {artikl.name}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatistikaPage;
