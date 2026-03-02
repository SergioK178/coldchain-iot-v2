import type { Device, AlertEvent } from '../lib/api.js';
import StatusBadge from './StatusBadge.js';
import AcknowledgeButton from './AcknowledgeButton.js';

function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec} сек назад`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} мин назад`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs} ч назад`;
  return `${Math.floor(hrs / 24)} дн назад`;
}

function fmt(val: number | null, unit: string): string {
  if (val === null) return '—';
  return `${val}${unit}`;
}

interface Props {
  device: Device;
  alerts: AlertEvent[];
  onRefresh: () => void;
}

export default function DeviceRow({ device, alerts, onRefresh }: Props) {
  const rowColor =
    device.alertStatus === 'alert' ? '#fff5f5'
    : device.connectivityStatus === 'offline' ? '#f8f9fa'
    : '#f0fff0';

  return (
    <tr style={{ backgroundColor: rowColor }}>
      <td>{device.serial}</td>
      <td>{device.displayName ?? '—'}</td>
      <td>{device.zoneName ?? '—'}</td>
      <td><StatusBadge connectivityStatus={device.connectivityStatus} alertStatus={device.alertStatus} /></td>
      <td>{fmt(device.lastTemperatureC, '°C')}</td>
      <td>{fmt(device.lastHumidityPct, '%')}</td>
      <td>{fmt(device.lastBatteryPct, '%')}</td>
      <td>{relativeTime(device.lastSeenAt)}</td>
      <td>
        {alerts.map((a) => (
          <AcknowledgeButton key={a.id} eventId={a.id} onDone={onRefresh} />
        ))}
      </td>
    </tr>
  );
}
