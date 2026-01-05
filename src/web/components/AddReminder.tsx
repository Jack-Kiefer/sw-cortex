import { useState } from 'react';

interface AddReminderProps {
  onAdd: (message: string, remindAt: string) => void;
}

export default function AddReminder({ onAdd }: AddReminderProps) {
  const [message, setMessage] = useState('');
  const [duration, setDuration] = useState('1h');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    onAdd(message, duration);
    setMessage('');
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6">
      <div className="flex gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Remind me to..."
          className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
        <select
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 focus:outline-none focus:border-blue-500"
        >
          <option value="15m">15 min</option>
          <option value="30m">30 min</option>
          <option value="1h">1 hour</option>
          <option value="2h">2 hours</option>
          <option value="4h">4 hours</option>
          <option value="1d">Tomorrow</option>
          <option value="1w">1 week</option>
        </select>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
        >
          Remind
        </button>
      </div>
    </form>
  );
}
