import { GLib, Variable } from "astal";

/**
 * @file Provides time-related variables and functions for the application.
 * This module exports variables for current time, uptime, and a function to get the current date and time in a specific format.
 */

export const time = Variable(GLib.DateTime.new_now_local()).poll(1000, () =>
  GLib.DateTime.new_now_local(),
);

/**
 * Returns the current date and time formatted as "YYYY-MM-DD_HH-MM-SS".
 * This function uses GLib to create a new DateTime object in the local timezone and formats it accordingly.
 * @returns {string} The formatted current date and time.
 */

export const uptime = Variable(
  Math.floor(GLib.get_monotonic_time() / 1000000),
).poll(1000, () => Math.floor(GLib.get_monotonic_time() / 1000000));

export const now = () =>
  GLib.DateTime.new_now_local().format("%Y-%m-%d_%H-%M-%S");

/**
 * Format seconds into a human-readable string
 * @param seconds - Number of seconds to format
 * @returns Formatted time string (e.g., "2d 5h 30m 15s")
 */
export function formatTime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  seconds %= 86400;
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  seconds %= 60;

  let result = "";
  if (days > 0) result += `${days}d `;
  if (hours > 0 || days > 0) result += `${hours}h `;
  if (minutes > 0 || hours > 0 || days > 0) result += `${minutes}m `;
  result += `${seconds}s`;

  return result;
}
