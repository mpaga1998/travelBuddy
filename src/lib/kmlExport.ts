import type { Pin } from "../features/pins/pinTypes";

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Generate KML content from pins
 */
export function generateKML(pins: Pin[]): string {
  const placemarks = pins
    .map((pin) => {
      const escapedTitle = escapeXml(pin.title);
      const escapedDescription = escapeXml(pin.description || "No description");
      const category = pin.category ? ` | Category: ${pin.category}` : "";
      const likes = pin.likesCount > 0 ? ` | ❤️ ${pin.likesCount}` : "";

      return `    <Placemark>
      <name>${escapedTitle}</name>
      <description>${escapedDescription}${category}${likes}</description>
      <Point>
        <coordinates>${pin.lng},${pin.lat},0</coordinates>
      </Point>
    </Placemark>`;
    })
    .join("\n");

  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Backpack Map - Saved Pins</name>
    <description>Exported pins from Backpack Map (${pins.length} locations)</description>
    <open>1</open>
${placemarks}
  </Document>
</kml>`;

  return kml;
}

/**
 * Trigger KML file download in browser
 */
export function downloadKML(
  kml: string,
  filename: string = "backpack-map-pins.kml"
): void {
  const blob = new Blob([kml], {
    type: "application/octet-stream",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Open Google My Maps in a new tab
 */
export function openGoogleMyMaps(): void {
  window.open("https://www.google.com/mymaps", "_blank");
}

/**
 * Show detailed instructions for importing KML
 */
export function showImportInstructions(): void {
  alert(
    `📍 Your KML file has been downloaded!\n\n` +
    `To import into Google My Maps:\n\n` +
    `1. Click "Open Google My Maps" (new tab)\n` +
    `2. Click "Create" → "New map"\n` +
    `3. Click the three dots ⋮ menu\n` +
    `4. Select "Import" → choose your downloaded KML file\n` +
    `5. All your pins will appear on the map!\n\n` +
    `The file is named: backpack-map-pins.kml`
  );
}

/**
 * Export pins to KML and download
 */
export function exportPinsToKML(pins: Pin[]): void {
  if (pins.length === 0) {
    alert("No pins to export. Bookmark some pins first!");
    return;
  }

  const kml = generateKML(pins);
  downloadKML(kml);
}
