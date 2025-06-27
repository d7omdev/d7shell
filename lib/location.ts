import { Variable } from "astal";
import Gio from "gi://Gio?version=2.0";
import GLib from "gi://GLib?version=2.0";
import Soup from "gi://Soup?version=3.0";

Gio._promisify(
  Soup.Session.prototype,
  "send_and_read_async",
  "send_and_read_finish",
);

export const currentLocation = Variable<{
  latitude: number;
  longitude: number;
  city: string;
  country: string;
  region: string;
} | null>(null);

export const locationError = Variable<string | null>(null);

// Function to get location from IP
async function getLocationFromIP(): Promise<{
  latitude: number;
  longitude: number;
  city: string;
  country: string;
  region: string;
} | null> {
  try {
    const uri = GLib.uri_build(
      GLib.UriFlags.NONE,
      "http",
      null,
      "ip-api.com",
      -1,
      "/json",
      null,
      null,
    );

    const session = new Soup.Session();
    const message = Soup.Message.new_from_uri("GET", uri);

    const data = await session.send_and_read_async(
      message,
      GLib.PRIORITY_DEFAULT,
      null,
    );
    const dataString = new TextDecoder().decode(data.toArray());
    const rawObject = JSON.parse(dataString);

    if (rawObject.status === "success") {
      // console.log(`IP Location: ${rawObject.city}, ${rawObject.regionName}, ${rawObject.country}`);
      // console.log(`Coordinates: ${rawObject.lat}, ${rawObject.lon}`);

      return {
        latitude: rawObject.lat,
        longitude: rawObject.lon,
        city: rawObject.city,
        country: rawObject.country,
        region: rawObject.regionName,
      };
    } else {
      throw new Error("IP geolocation failed");
    }
  } catch (error) {
    console.error("Failed to get location from IP:", error);
    return null;
  }
}

// Initialize location from IP
async function initializeLocation() {
  // console.log("Getting location from IP...");
  const location = await getLocationFromIP();

  if (location) {
    currentLocation.set(location);
    locationError.set(null);
    console.log(
      `📍 Location: ${location.city}, ${location.region}, ${location.country}`,
    );
  } else {
    currentLocation.set(null);
    locationError.set("Failed to detect location from IP address");
    console.error("❌ Location error: Could not detect your location");
  }
}

// Start location initialization after a short delay
GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
  initializeLocation();
  return GLib.SOURCE_REMOVE;
});

// Manual refresh function
export function refreshLocation() {
  // console.log("Manual location refresh requested");
  initializeLocation();
}
