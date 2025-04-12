import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { format, setDefaultOptions } from "date-fns";
import { hr } from "date-fns/locale";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "../firebase";

setDefaultOptions({ locale: hr });

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export const generateExcelReport = async (startDate, endDate, setIsLoading) => {
  setIsLoading(true);
  try {
    const artikliQuery = query(
      collection(db, "artikli"),
      orderBy("order", "asc")
    );
    const artikliSnapshot = await getDocs(artikliQuery);
    const artikli = artikliSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const dates = [];
    let currentDate = new Date(startDate);
    const endDateObj = new Date(endDate);
    while (currentDate <= endDateObj) {
      dates.push(format(currentDate, "yyyy-MM-dd"));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const unosiQuery = query(
      collection(db, "dnevniUnosi"),
      where("datum", ">=", startDate),
      where("datum", "<=", endDate),
      orderBy("datum")
    );
    const unosiSnapshot = await getDocs(unosiQuery);
    const weeklyData = {};
    unosiSnapshot.docs.forEach((doc) => {
      weeklyData[doc.data().datum] = doc.data().stavke;
    });

    const previousQuery = query(
      collection(db, "dnevniUnosi"),
      where("datum", "<", startDate),
      orderBy("datum")
    );
    const previousSnapshot = await getDocs(previousQuery);
    const previousStanje = {};
    previousSnapshot.docs.forEach((doc) => {
      doc.data().stavke.forEach((stavka) => {
        if (!previousStanje[stavka.artiklId]) {
          previousStanje[stavka.artiklId] = 0;
        }
        previousStanje[stavka.artiklId] +=
          (stavka.ulaz || 0) - (stavka.izlaz || 0);
      });
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Stanje artikala");

    // Definiranje stilova
    const styles = {
      header: {
        font: { bold: true, color: { argb: "FFFFFF" }, size: 11 },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "4F46E5" },
        },
        alignment: { vertical: "middle", horizontal: "center" },
        border: {
          top: { style: "thin", color: { argb: "D1D5DB" } },
          left: { style: "thin", color: { argb: "D1D5DB" } },
          bottom: { style: "thin", color: { argb: "D1D5DB" } },
          right: { style: "thin", color: { argb: "D1D5DB" } },
        },
      },
      subHeader: {
        font: { bold: true, color: { argb: "374151" }, size: 10 },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "F3F4F6" },
        },
        alignment: { vertical: "middle", horizontal: "center" },
        border: {
          top: { style: "thin", color: { argb: "D1D5DB" } },
          left: { style: "thin", color: { argb: "D1D5DB" } },
          bottom: { style: "thin", color: { argb: "D1D5DB" } },
          right: { style: "thin", color: { argb: "D1D5DB" } },
        },
      },
      artikl: {
        font: { bold: true, color: { argb: "111827" }, size: 10 },
        alignment: { vertical: "middle", horizontal: "left" },
        border: {
          top: { style: "thin", color: { argb: "D1D5DB" } },
          left: { style: "thin", color: { argb: "D1D5DB" } },
          bottom: { style: "thin", color: { argb: "D1D5DB" } },
          right: { style: "thin", color: { argb: "D1D5DB" } },
        },
      },
      pocetnoStanje: {
        font: { bold: true, color: { argb: "1F2937" }, size: 10 },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "F9FAFB" },
        },
        alignment: { vertical: "middle", horizontal: "center" },
        border: {
          top: { style: "thin", color: { argb: "D1D5DB" } },
          left: { style: "thin", color: { argb: "D1D5DB" } },
          bottom: { style: "thin", color: { argb: "D1D5DB" } },
          right: { style: "thin", color: { argb: "D1D5DB" } },
        },
      },
      ulaz: {
        font: { color: { argb: "059669" }, size: 10 },
        alignment: { vertical: "middle", horizontal: "center" },
        border: {
          top: { style: "thin", color: { argb: "D1D5DB" } },
          left: { style: "thin", color: { argb: "D1D5DB" } },
          bottom: { style: "thin", color: { argb: "D1D5DB" } },
          right: { style: "thin", color: { argb: "D1D5DB" } },
        },
        format: '+0;-0;""',
      },
      izlaz: {
        font: { color: { argb: "DC2626" }, size: 10 },
        alignment: { vertical: "middle", horizontal: "center" },
        border: {
          top: { style: "thin", color: { argb: "D1D5DB" } },
          left: { style: "thin", color: { argb: "D1D5DB" } },
          bottom: { style: "thin", color: { argb: "D1D5DB" } },
          right: { style: "thin", color: { argb: "D1D5DB" } },
        },
        format: '+0;-0;""',
      },
      stanje: {
        font: { bold: true, color: { argb: "1F2937" }, size: 10 },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "F9FAFB" },
        },
        alignment: { vertical: "middle", horizontal: "center" },
        border: {
          top: { style: "thin", color: { argb: "D1D5DB" } },
          left: { style: "thin", color: { argb: "D1D5DB" } },
          bottom: { style: "thin", color: { argb: "D1D5DB" } },
          right: { style: "thin", color: { argb: "D1D5DB" } },
        },
      },
      striped: {
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "F8FAFC" },
        },
      },
    };

    // Header red (datum + dan)
    const dateHeader = ["", "", ""];
    dates.forEach((date) => {
      const dayDate = format(new Date(date), "dd.MM.");
      const dayName = capitalizeFirstLetter(format(new Date(date), "EEEE"));
      dateHeader.push(`${dayDate} - ${dayName}`, "", "");
    });
    sheet.addRow(dateHeader);

    // Subheader (ulaz, izlaz, stanje)
    const subHeader = ["Artikl", "Šifra", "Početno stanje"];
    dates.forEach(() => {
      subHeader.push("Ulaz", "Izlaz", "Stanje");
    });
    sheet.addRow(subHeader);

    // Podaci po artiklima
    artikli.forEach((artikl, index) => {
      const row = [artikl.name, artikl.sifra, previousStanje[artikl.slug] || 0];
      let trenutnoStanje = previousStanje[artikl.slug] || 0;

      dates.forEach((date) => {
        const stavke =
          weeklyData[date]?.filter((s) => s.artiklId === artikl.slug) || [];
        const dnevniPodaci = stavke.reduce(
          (acc, stavka) => ({
            ulaz: acc.ulaz + (stavka.ulaz || 0),
            izlaz: acc.izlaz + (stavka.izlaz || 0),
          }),
          { ulaz: 0, izlaz: 0 }
        );

        trenutnoStanje += dnevniPodaci.ulaz - dnevniPodaci.izlaz;

        row.push(
          dnevniPodaci.ulaz || "",
          dnevniPodaci.izlaz ? -dnevniPodaci.izlaz : "",
          trenutnoStanje
        );
      });

      sheet.addRow(row);
    });

    // Spajanje ćelija za header datume
    dates.forEach((_, index) => {
      sheet.mergeCells(1, 4 + index * 3, 1, 6 + index * 3);
    });

    // Širina kolona
    sheet.columns = [
      { width: 25 }, // Artikl
      { width: 15 }, // Šifra
      { width: 18 }, // Početno stanje
      ...dates.flatMap(() => [{ width: 12 }, { width: 12 }, { width: 12 }]),
    ];

    // Visina redova
    sheet.getRow(1).height = 30;
    sheet.getRow(2).height = 25;

    // Primjena stilova
    sheet.getRow(1).eachCell((cell, colNumber) => {
      cell.style = styles.header;
    });

    sheet.getRow(2).eachCell((cell, colNumber) => {
      cell.style = styles.subHeader;
    });

    // Stiliziranje ćelija podataka
    for (let i = 3; i <= artikli.length + 2; i++) {
      const row = sheet.getRow(i);

      // Naizmjenično obojene retke (zebra striping)
      const isStriped = i % 2 === 0;

      row.eachCell((cell, colNumber) => {
        if (colNumber === 1) {
          // Artikl
          cell.style = { ...styles.artikl };
          if (isStriped) {
            cell.fill = styles.striped.fill;
          }
        } else if (colNumber === 2) {
          // Početno stanje
          cell.style = { ...styles.pocetnoStanje };
        } else {
          // Odredi tip ćelije (ulaz, izlaz, stanje) na temelju pozicije
          const columnType = (colNumber - 3) % 3;

          if (columnType === 0) {
            // Ulaz
            cell.style = { ...styles.ulaz };
            if (cell.value) {
              cell.value = +cell.value; // Format as number with plus sign
            }
            if (isStriped) {
              cell.fill = styles.striped.fill;
            }
          } else if (columnType === 1) {
            // Izlaz
            cell.style = { ...styles.izlaz };
            if (isStriped) {
              cell.fill = styles.striped.fill;
            }
          } else {
            // Stanje
            cell.style = { ...styles.stanje };
          }
        }
      });
    }

    // Dodaj zamrznute retke i stupce
    sheet.views = [{ state: "frozen", xSplit: 2, ySplit: 2, activeCell: "C3" }];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, `Stanje-artikala_${startDate}_${endDate}.xlsx`);
    return true;
  } catch (error) {
    console.error("Error generating Excel:", error);
    throw error;
  } finally {
    setIsLoading(false);
  }
};
