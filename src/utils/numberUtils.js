/**
 * Zaokružuje broj na 4 decimale
 * @param {number} num - Broj koji treba zaokružiti
 * @returns {number} - Zaokruženi broj na 4 decimale
 */
export const roundToFour = (num) => {
  return Math.round((num + Number.EPSILON) * 10000) / 10000;
};

/**
 * Formatira broj za prikaz s maksimalno 4 decimale
 * - Cijeli brojevi se prikazuju bez decimala
 * - Brojevi s decimalama se prikazuju s onoliko decimala koliko imaju, do maksimalno 4
 * @param {number} num - Broj za formatiranje
 * @returns {string} - Formatirani broj kao string
 */
export const formatNumber = (num) => {
  if (num === undefined || num === null) return "0";

  // Zaokruži na 4 decimale
  const rounded = roundToFour(Number(num));

  // Ako je cijeli broj, prikaži bez decimalne točke
  if (Math.floor(rounded) === rounded) {
    return rounded.toString();
  }

  // Inače prikaži s do 4 decimale, bez trailing nula
  return rounded
    .toString()
    .replace(/(\.\d*?)0+$/, "$1")
    .replace(/\.$/, "");
};
