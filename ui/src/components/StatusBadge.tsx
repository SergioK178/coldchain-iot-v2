interface Props {
  connectivityStatus: 'online' | 'offline';
  alertStatus: 'normal' | 'alert';
}

export default function StatusBadge({ connectivityStatus, alertStatus }: Props) {
  let color: string;
  let text: string;

  if (alertStatus === 'alert') {
    color = '#dc3545';
    text = 'Тревога';
  } else if (connectivityStatus === 'offline') {
    color = '#6c757d';
    text = 'Офлайн';
  } else {
    color = '#28a745';
    text = 'Норма';
  }

  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '4px',
      color: '#fff',
      backgroundColor: color,
      fontSize: '12px',
      fontWeight: 600,
    }}>
      {text}
    </span>
  );
}
