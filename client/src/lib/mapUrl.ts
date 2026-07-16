export type MapApp = "google" | "apple" | "waze";

export function buildMapUrl(address: string, app: MapApp = "google"): string {
  const encoded = encodeURIComponent(address);
  switch (app) {
    case "apple":
      return `https://maps.apple.com/?q=${encoded}`;
    case "waze":
      return `https://waze.com/ul?q=${encoded}`;
    case "google":
    default:
      return `https://www.google.com/maps/search/?api=1&query=${encoded}`;
  }
}

export function buildNavUrl(address: string, app: MapApp = "google"): string {
  const encoded = encodeURIComponent(address);
  switch (app) {
    case "apple":
      return `https://maps.apple.com/?daddr=${encoded}`;
    case "waze":
      return `https://waze.com/ul?q=${encoded}&navigate=yes`;
    case "google":
    default:
      return `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
  }
}
