import { Gtk } from "astal/gtk4";

export interface WeatherIconProps extends Partial<Gtk.Image.ConstructorProps> {
  weatherCode: number;
  isDay: boolean;
}

// Comprehensive weather code mapping based on WMO (World Meteorological Organization) codes
const WEATHER_ICON_MAP: Record<number, { day: string; night: string }> = {
  // Clear sky
  0: { day: "clear", night: "clear-night" },

  // Partly cloudy
  1: { day: "few-clouds", night: "few-clouds-night" },
  2: { day: "partly-cloudy", night: "partly-cloudy-night" },
  3: { day: "overcast", night: "overcast" },

  // Fog and mist
  45: { day: "fog", night: "fog" },
  48: { day: "fog", night: "fog" },

  // Drizzle
  51: { day: "showers-scattered", night: "showers-scattered" },
  53: { day: "showers-scattered", night: "showers-scattered" },
  55: { day: "showers-scattered", night: "showers-scattered" },

  // Freezing drizzle
  56: { day: "showers-scattered", night: "showers-scattered" },
  57: { day: "showers-scattered", night: "showers-scattered" },

  // Rain
  61: { day: "showers", night: "showers" },
  63: { day: "showers", night: "showers" },
  65: { day: "showers", night: "showers" },

  // Freezing rain
  66: { day: "showers", night: "showers" },
  67: { day: "showers", night: "showers" },

  // Snow
  71: { day: "snow", night: "snow" },
  73: { day: "snow", night: "snow" },
  75: { day: "snow", night: "snow" },
  77: { day: "snow", night: "snow" },

  // Snow grains
  85: { day: "snow", night: "snow" },
  86: { day: "snow", night: "snow" },

  // Showers
  80: { day: "showers", night: "showers" },
  81: { day: "showers", night: "showers" },
  82: { day: "showers", night: "showers" },

  // Thunderstorm
  95: { day: "storm", night: "storm" },
  96: { day: "storm", night: "storm" },
  99: { day: "storm", night: "storm" },
};

/**
 * Creates a weather icon based on WMO weather codes
 * @param weatherCode - WMO weather code (0-99)
 * @param isDay - Whether it's daytime
 * @param props - Additional Gtk.Image properties
 * @returns Gtk.Image widget with appropriate weather icon
 */
export function createWeatherIcon(
  weatherCode: number,
  isDay: boolean,
  props: Partial<Gtk.Image.ConstructorProps> = {},
): Gtk.Image {
  // Get icon mapping for the weather code
  const iconMapping = WEATHER_ICON_MAP[weatherCode];

  if (!iconMapping) {
    console.warn(`Unknown weather code: ${weatherCode}, using default icon`);
    // Fallback to clear weather for unknown codes
    const fallbackIcon = isDay ? "clear" : "clear-night";
    // const image = new Gtk.Image({
    //   iconName: `weather-${fallbackIcon}-symbolic`,
    //   cssClasses: [...(props.cssClasses ?? []), isDay ? "day" : "night"],
    //   ...props,
    // });

    return new Gtk.Image({
      cssClasses: ["weather-icon", "unknown"],
      iconName: "weather-unknown-symbolic",
      pixelSize: props.pixelSize ?? 24,
      ...props,
    });
  }

  const iconName = isDay ? iconMapping.day : iconMapping.night;

  const image = new Gtk.Image({
    iconName: `weather-${iconName}-symbolic`,
    cssClasses: [
      ...(props.cssClasses ?? []),
      "weather-icon",
      iconName,
      isDay ? "day" : "night",
    ],
    ...props,
  });

  return image;
}

/**
 * Creates a weather icon with default styling for the main weather display
 */
export function createMainWeatherIcon(
  weatherCode: number,
  isDay: boolean,
  props: Partial<Gtk.Image.ConstructorProps> = {},
): Gtk.Image {
  return createWeatherIcon(weatherCode, isDay, {
    pixelSize: 30,
    cssClasses: ["main-icon"],
    vexpand: false,
    valign: Gtk.Align.CENTER,
    ...props,
  });
}

/**
 * Creates a small weather icon for secondary displays
 */
export function createSmallWeatherIcon(
  weatherCode: number,
  isDay: boolean,
  props: Partial<Gtk.Image.ConstructorProps> = {},
): Gtk.Image {
  return createWeatherIcon(weatherCode, isDay, {
    pixelSize: 16,
    cssClasses: ["small-icon"],
    ...props,
  });
}

/**
 * Gets the weather description for a given weather code
 */
export function getWeatherDescription(weatherCode: number): string {
  const descriptions: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
  };

  return descriptions[weatherCode] || "Unknown weather";
}

/**
 * Creates a debug panel showing all weather icons
 */
export function createWeatherIconDebug(): Gtk.FlowBox {
  const wrapper = new Gtk.FlowBox({ cssClasses: ["weather-debug"] });

  // Add all weather codes to the debug panel
  for (const [code, mapping] of Object.entries(WEATHER_ICON_MAP)) {
    const weatherCode = parseInt(code);

    // Day version
    wrapper.append(
      createWeatherIcon(weatherCode, true, {
        cssClasses: ["debug-icon"],
        pixelSize: 32,
      }),
    );

    // Night version
    wrapper.append(
      createWeatherIcon(weatherCode, false, {
        cssClasses: ["debug-icon"],
        pixelSize: 32,
      }),
    );
  }

  return wrapper;
}
