import { Gtk } from "astal/gtk4";
import { getRamUsage, getCpuUsage, getGpuUsage } from "../../lib/systeminfo";
import { bind, Variable, interval, Time } from "astal";

interface SystemMetric {
  label: string;
  iconName: string;
  value: Variable<number>;
  getValue: () => number;
}

export function SystemInfo() {
  // System metrics with their respective data
  const systemMetrics: SystemMetric[] = [
    {
      label: "CPU",
      iconName: "processor-symbolic",
      value: Variable(0),
      getValue: getCpuUsage,
    },
    {
      label: "GPU",
      iconName: "nvidia-card-symbolic",
      value: Variable(0),
      getValue: getGpuUsage,
    },
    {
      label: "RAM",
      iconName: "nvidia-ram-symbolic",
      value: Variable(0),
      getValue: getRamUsage,
    },
  ];

  // Update all system metrics
  const updateMetrics = (): void => {
    try {
      systemMetrics.forEach((metric) => {
        const value = metric.getValue();
        metric.value.set(value);
      });
    } catch (error) {
      console.error("Error updating system metrics:", error);
    }
  };

  // Initialize metrics and set up interval
  let intervalId: Time | null = null;

  // Update metrics immediately
  updateMetrics();

  // Set up periodic updates every 2 seconds
  intervalId = interval(2000, updateMetrics);

  // Component for individual metric display
  const MetricDisplay = ({ metric }: { metric: SystemMetric }) => (
    <box orientation={Gtk.Orientation.VERTICAL} spacing={5}>
      <box spacing={8}>
        <image iconName={metric.iconName} />
        <box hexpand />
        <label
          label={bind(metric.value).as((value) => `${metric.label}: ${value}%`)}
          halign={Gtk.Align.START}
          cssClasses={["labelSmallBold"]}
        />
      </box>
      <levelbar
        value={bind(metric.value).as((value) => value / 100)}
        minValue={0}
        maxValue={1}
        widthRequest={280}
        heightRequest={20}
      />
    </box>
  );

  return (
    <box
      setup={(self) => {
        // Clean up interval when component is destroyed
        self.connect("destroy", () => {
          if (intervalId) {
            intervalId.cancel();
            intervalId = null;
          }
        });
      }}
      orientation={Gtk.Orientation.VERTICAL}
      cssClasses={["systeminfo"]}
      spacing={10}
      marginTop={10}
      marginBottom={10}
    >
      {systemMetrics.map((metric) => (
        <MetricDisplay metric={metric} />
      ))}
    </box>
  );
}
