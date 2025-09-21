import { Variable } from "astal";

interface NetworkMeasurement {
  totalDownBytes: number;
  totalUpBytes: number;
  timestamp: number;
}

interface NetworkSpeed {
  download: number;
  upload: number;
}

const interval = 1000;
let lastMeasurement: NetworkMeasurement | null = null;

// More comprehensive list of virtual interfaces to exclude
const isVirtualInterface = (interfaceName: string): boolean => {
  const virtualPatterns = [
    /^lo$/, // loopback
    /^ifb\d+$/, // intermediate functional block
    /^lxdbr\d+$/, // lxd bridge
    /^virbr\d+$/, // virtual bridge
    /^br-\w+$/, // docker bridge
    /^vnet\d+$/, // virtual network
    /^tun\d+$/, // tunnel
    /^tap\d+$/, // tap interface
    /^veth\w+$/, // virtual ethernet
    /^docker\d+$/, // docker
    /^wg\d+$/, // wireguard
  ];

  return virtualPatterns.some((pattern) => pattern.test(interfaceName));
};

const parseNetworkData = (content: string): NetworkMeasurement => {
  const lines = content.split("\n");
  let totalDownBytes = 0;
  let totalUpBytes = 0;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || !trimmedLine.includes(":")) continue;

    // More robust parsing - split on colon first
    const colonIndex = trimmedLine.indexOf(":");
    const interfaceName = trimmedLine.substring(0, colonIndex).trim();
    const statsString = trimmedLine.substring(colonIndex + 1).trim();
    const fields = statsString.split(/\s+/);

    if (fields.length < 16) continue; // Need at least 16 fields for valid data

    const rxBytes = parseInt(fields[0], 10);
    const txBytes = parseInt(fields[8], 10);

    // Skip if parsing failed or it's a virtual interface
    if (isNaN(rxBytes) || isNaN(txBytes) || isVirtualInterface(interfaceName)) {
      continue;
    }

    totalDownBytes += rxBytes;
    totalUpBytes += txBytes;
  }

  return { totalDownBytes, totalUpBytes, timestamp: Date.now() };
};

const calculateSpeed = (
  current: NetworkMeasurement,
  last: NetworkMeasurement | null,
): NetworkSpeed => {
  if (!last) return { download: 0, upload: 0 };

  const timeDelta = (current.timestamp - last.timestamp) / 1000; // Convert to seconds

  // Handle edge cases
  if (timeDelta <= 0) return { download: 0, upload: 0 };

  // Calculate bytes per second, ensure non-negative values
  const downloadSpeed = Math.max(
    0,
    (current.totalDownBytes - last.totalDownBytes) / timeDelta,
  );
  const uploadSpeed = Math.max(
    0,
    (current.totalUpBytes - last.totalUpBytes) / timeDelta,
  );

  return { download: downloadSpeed, upload: uploadSpeed };
};

const networkSpeed = Variable<NetworkSpeed>({
  download: 0,
  upload: 0,
}).poll(interval, ["cat", "/proc/net/dev"], (content: string): NetworkSpeed => {
  try {
    const currentMeasurement = parseNetworkData(content);
    const speed = calculateSpeed(currentMeasurement, lastMeasurement);

    lastMeasurement = currentMeasurement;

    return speed;
  } catch (error) {
    console.error("Network speed calculation error:", error);
    return { download: 0, upload: 0 };
  }
});

export default networkSpeed;
