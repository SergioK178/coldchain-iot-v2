import { acknowledgeAlert } from '../lib/api.js';

interface Props {
  eventId: string;
  onDone: () => void;
}

export default function AcknowledgeButton({ eventId, onDone }: Props) {
  const handleClick = async () => {
    const name = prompt('Имя оператора:');
    if (!name?.trim()) return;

    try {
      await acknowledgeAlert(eventId, name.trim());
      onDone();
    } catch (err: any) {
      alert(`Ошибка: ${err.message}`);
    }
  };

  return (
    <button
      onClick={handleClick}
      style={{
        padding: '4px 12px',
        backgroundColor: '#dc3545',
        color: '#fff',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '12px',
      }}
    >
      Подтвердить
    </button>
  );
}
