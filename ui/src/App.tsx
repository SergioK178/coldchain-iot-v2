import { useState, useEffect, useCallback } from 'react';
import { fetchDevices, fetchUnacknowledgedAlerts, setToken, clearToken, type Device, type AlertEvent } from './lib/api.js';
import DeviceRow from './components/DeviceRow.js';

export default function App() {
  const [token, setTokenState] = useState(() => sessionStorage.getItem('apiToken') ?? '');
  const [tokenInput, setTokenInput] = useState('');
  const [devices, setDevices] = useState<Device[]>([]);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [devs, alts] = await Promise.all([
        fetchDevices(),
        fetchUnacknowledgedAlerts(),
      ]);
      setDevices(devs);
      setAlerts(alts);
      setError('');
    } catch (err: any) {
      if (err.message === 'UNAUTHORIZED') {
        setTokenState('');
        clearToken();
        setError('Неверный токен');
      } else {
        setError(err.message);
      }
    }
  }, []);

  // Initial fetch + auto-refresh 30s
  useEffect(() => {
    if (!token) return;
    loadData();
    const interval = setInterval(loadData, 30_000);
    return () => clearInterval(interval);
  }, [token, loadData]);

  const handleSubmitToken = () => {
    if (!tokenInput.trim()) return;
    setToken(tokenInput.trim());
    setTokenState(tokenInput.trim());
    setError('');
  };

  // Token gate
  if (!token) {
    return (
      <div style={{ maxWidth: 400, margin: '100px auto', textAlign: 'center' }}>
        <h2>Sensor Platform</h2>
        <p style={{ margin: '16px 0', color: '#666' }}>Введите API токен для доступа</p>
        {error && <p style={{ color: '#dc3545', marginBottom: 8 }}>{error}</p>}
        <input
          type="password"
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmitToken()}
          placeholder="API Token"
          style={{ width: '100%', padding: '8px 12px', fontSize: 14, border: '1px solid #ccc', borderRadius: 4 }}
        />
        <button
          onClick={handleSubmitToken}
          style={{ marginTop: 12, padding: '8px 24px', fontSize: 14, backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
        >
          Войти
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '20px auto', padding: '0 16px' }}>
      <h1 style={{ marginBottom: 16 }}>Sensor Platform</h1>
      {error && <p style={{ color: '#dc3545', marginBottom: 8 }}>{error}</p>}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>
            <th style={th}>Serial</th>
            <th style={th}>Имя</th>
            <th style={th}>Зона</th>
            <th style={th}>Статус</th>
            <th style={th}>Темп.</th>
            <th style={th}>Влажн.</th>
            <th style={th}>Батарея</th>
            <th style={th}>Последнее</th>
            <th style={th}>Действия</th>
          </tr>
        </thead>
        <tbody>
          {devices.map((d) => (
            <DeviceRow
              key={d.serial}
              device={d}
              alerts={alerts.filter((a) => a.deviceSerial === d.serial)}
              onRefresh={loadData}
            />
          ))}
          {devices.length === 0 && (
            <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: '#999' }}>Нет устройств</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const th: React.CSSProperties = { padding: '8px 12px', fontWeight: 600 };
