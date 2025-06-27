import { Variable, interval } from "astal";
import Gio from "gi://Gio?version=2.0";
import GLib from "gi://GLib?version=2.0";

interface SystemUsage {
  cpu: number; // 0-100
  gpu: number; // 0-100
  ram: number;
}

interface CpuTimes {
  idle: number;
  total: number;
}

export const systemUsage = Variable<SystemUsage>({
  cpu: 0,
  gpu: 0,
  ram: 0,
});

// CPU usage tracking
let lastCpuTimes: CpuTimes | null = null;

/**
 * Get CPU usage percentage
 * @returns CPU usage as a percentage (0-100)
 */
function getCpuUsage(): number {
  try {
    const statFile = Gio.File.new_for_path("/proc/stat");
    const [success, contents] = statFile.load_contents(null);

    if (!success) {
      console.warn("Failed to read /proc/stat");
      return 0;
    }

    const statData = new TextDecoder().decode(contents);
    const cpuLine = statData.split("\n")[0];
    const cpuValues = cpuLine.split(/\s+/).slice(1).map(Number);

    if (cpuValues.length < 5) {
      console.warn("Invalid CPU stat data");
      return 0;
    }

    // CPU time values: user, nice, system, idle, iowait, irq, softirq, steal
    const idle = cpuValues[3] + cpuValues[4]; // idle + iowait
    const total = cpuValues.reduce((sum, val) => sum + val, 0);

    if (lastCpuTimes) {
      const idleDiff = idle - lastCpuTimes.idle;
      const totalDiff = total - lastCpuTimes.total;

      if (totalDiff > 0) {
        const usage = Math.round(((totalDiff - idleDiff) / totalDiff) * 100);
        lastCpuTimes = { idle, total };
        return Math.max(0, Math.min(100, usage));
      }
    }

    lastCpuTimes = { idle, total };
    return 0;
  } catch (error) {
    console.error("Error getting CPU usage:", error);
    return 0;
  }
}

/**
 * Get GPU usage percentage
 * @returns GPU usage as a percentage (0-100)
 */
function getGpuUsage(): number {
  // Try NVIDIA GPU first
  const nvidiaUsage = getNvidiaGpuUsage();
  if (nvidiaUsage !== null) {
    return nvidiaUsage;
  }

  // Try AMD GPU
  const amdUsage = getAmdGpuUsage();
  if (amdUsage !== null) {
    return amdUsage;
  }

  // Try generic method
  const genericUsage = getGenericGpuUsage();
  if (genericUsage !== null) {
    return genericUsage;
  }

  return 0;
}

/**
 * Get NVIDIA GPU usage
 * @returns GPU usage percentage or null if not available
 */
function getNvidiaGpuUsage(): number | null {
  try {
    const result = GLib.spawn_command_line_sync(
      "nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits",
    );

    if (result[0] && result[1]) {
      const output = new TextDecoder().decode(result[1]).trim();
      const usage = parseInt(output);
      if (!isNaN(usage)) {
        return Math.max(0, Math.min(100, usage));
      }
    }
  } catch (error) {
    // NVIDIA command failed, continue to next method
  }

  return null;
}

/**
 * Get AMD GPU usage
 * @returns GPU usage percentage or null if not available
 */
function getAmdGpuUsage(): number | null {
  const drmFiles = [
    "/sys/class/drm/card0/device/gpu_busy_percent",
    "/sys/class/drm/card1/device/gpu_busy_percent",
  ];

  for (const filePath of drmFiles) {
    try {
      const file = Gio.File.new_for_path(filePath);
      if (file.query_exists(null)) {
        const [success, contents] = file.load_contents(null);
        if (success) {
          const usage = parseInt(new TextDecoder().decode(contents).trim());
          if (!isNaN(usage)) {
            return Math.max(0, Math.min(100, usage));
          }
        }
      }
    } catch (error) {
      // Continue to next file
    }
  }

  return null;
}

/**
 * Get generic GPU usage
 * @returns GPU usage percentage or null if not available
 */
function getGenericGpuUsage(): number | null {
  try {
    const result = GLib.spawn_command_line_sync(
      "cat /sys/class/drm/card*/device/gpu_busy_percent 2>/dev/null | head -1",
    );

    if (result[0] && result[1]) {
      const output = new TextDecoder().decode(result[1]).trim();
      const usage = parseInt(output);
      if (!isNaN(usage)) {
        return Math.max(0, Math.min(100, usage));
      }
    }
  } catch (error) {
    console.error("Error getting generic GPU usage:", error);
  }

  return null;
}

/**
 * Get RAM usage percentage
 * @returns RAM usage as a percentage (0-100)
 */
function getRamUsage(): number {
  try {
    const meminfoFile = Gio.File.new_for_path("/proc/meminfo");
    const [success, contents] = meminfoFile.load_contents(null);

    if (!success) {
      console.warn("Failed to read /proc/meminfo");
      return 0;
    }

    const meminfoData = new TextDecoder().decode(contents);
    const lines = meminfoData.split("\n");

    let memTotal = 0;
    let memFree = 0;
    let memBuffers = 0;
    let memCached = 0;
    let memSReclaimable = 0;

    for (const line of lines) {
      const [key, value] = line.split(":");
      if (!key || !value) continue;

      const valueKB = parseInt(value.trim().split(" ")[0]);
      if (isNaN(valueKB)) continue;

      switch (key) {
        case "MemTotal":
          memTotal = valueKB;
          break;
        case "MemFree":
          memFree = valueKB;
          break;
        case "Buffers":
          memBuffers = valueKB;
          break;
        case "Cached":
          memCached = valueKB;
          break;
        case "SReclaimable":
          memSReclaimable = valueKB;
          break;
      }
    }

    if (memTotal === 0) {
      console.warn("Invalid memory data: MemTotal is 0");
      return 0;
    }

    // Calculate actual used memory (excluding cache and buffers)
    const memUsed =
      memTotal - memFree - memBuffers - memCached - memSReclaimable;
    const percentage = Math.round((memUsed / memTotal) * 100);

    return Math.max(0, Math.min(100, percentage));
  } catch (error) {
    console.error("Error getting RAM usage:", error);
    return 0;
  }
}

export { getCpuUsage, getGpuUsage, getRamUsage };
