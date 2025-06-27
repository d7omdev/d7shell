import { bind } from "astal";
import { Gtk } from "astal/gtk4";
import { weatherData, cityName } from "../../lib/weather";
import { locationError } from "../../lib/location";
import {
  createMainWeatherIcon,
  createSmallWeatherIcon,
  createWeatherIconDebug,
} from "../../lib/weatherIcons.jsx";

const nbsp = "\u202f";
const endash = "\u2013";

export function WeatherIconDebug() {
  return createWeatherIconDebug();
}

export function WeatherPanel() {
  return (
    <box spacing={8} cssClasses={["weather"]}>
      {bind(weatherData).as((data) =>
        data
          ? [
              createMainWeatherIcon(
                data.current.weather_code,
                data.current.is_day,
              ),
              <box vertical={true}>
                <box spacing={8}>
                  <label
                    label={`${data.current.temperature}${nbsp}${data.current.units.temperature}`}
                    cssClasses={["temperature-main"]}
                    valign={Gtk.Align.BASELINE}
                  />
                  <label
                    label={`${Math.floor(data.min_temperature)}${endash}${Math.ceil(
                      data.max_temperature,
                    )}${nbsp}${data.temperature_range_unit}`}
                    cssClasses={["temperature-range"]}
                    valign={Gtk.Align.BASELINE}
                  />
                </box>

                <label
                  label={`Feels like <b>${Math.round(data.current.apparent_temperature)}${nbsp}${
                    data.current.units.apparent_temperature
                  }</b>`}
                  useMarkup={true}
                  halign={Gtk.Align.START}
                />

                <box spacing={8}>
                  <box spacing={4}>
                    {createSmallWeatherIcon(
                      data.in_6h.weather_code,
                      data.in_6h.is_day,
                    )}
                    <label
                      label={`${Math.round(data.in_6h.temperature)}${nbsp}${
                        data.in_6h.units.temperature
                      } (${Math.round(data.in_6h.apparent_temperature)}${nbsp}${
                        data.in_6h.units.apparent_temperature
                      })`}
                    />
                  </box>
                  <box spacing={4}>
                    <image iconName="weather-windy-symbolic" />
                    <label
                      label={`${data.in_6h.wind_speed}${nbsp}${data.in_6h.units.wind_speed}`}
                    />
                  </box>
                </box>
              </box>,
              <label
                margin_start={8}
                label={bind(cityName).as((name) => name || "Unknown Location")}
                halign={Gtk.Align.CENTER}
              />,
            ]
          : [
              <box vertical spacing={4} halign={Gtk.Align.CENTER}>
                <image
                  iconName="weather-showers-scattered-symbolic"
                  pixelSize={24}
                  cssClasses={["error-icon"]}
                />
                <label
                  label={bind(locationError).as((locError) =>
                    locError
                      ? `Location Error: ${locError}`
                      : "Detecting location...",
                  )}
                  halign={Gtk.Align.CENTER}
                  cssClasses={["error-text"]}
                />
              </box>,
            ],
      )}
    </box>
  );
}
