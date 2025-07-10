import networkSpeed from "../../../lib/networkspeed";
import PanelButton from "../PanelButton";

export default function NetworkSpeedPanelButton() {
  return (
    <PanelButton
      window=""
      cssClasses={["netspeed-bg"]}
      child={
        <box
          cssClasses={["network-speed"]}
          child={
            <label
              cssClasses={["label"]}
              label={networkSpeed((value) => {
                const downloadSpeed = value.download;
                const uploadSpeed = value.upload;
                if (downloadSpeed === 0 && uploadSpeed === 0) return "";
                const higherSpeed =
                  downloadSpeed >= uploadSpeed ? downloadSpeed : uploadSpeed;
                const speed = (higherSpeed / 1000).toFixed(2);
                const symbol = downloadSpeed >= uploadSpeed ? "" : "";
                return `${speed} MB/s ${symbol}`;
              })}
            />
          }
        />
      }
    />
  );
}
