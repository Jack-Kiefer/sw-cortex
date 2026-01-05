import { useState } from 'react';

interface Reminder {
  id: number;
  message: string;
  remindAt: string;
  status: string;
  taskId: number | null;
  snoozedUntil: string | null;
  sentAt: string | null;
  createdAt: string;
}

interface ReminderListProps {
  reminders: Reminder[];
  onCancel: (id: number) => void;
  onSnooze: (id: number, duration: string) => void;
}

export default function ReminderList({ reminders, onCancel, onSnooze }: ReminderListProps) {
  const [showSnoozeId, setShowSnoozeId] = useState<number | null>(null);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = date.getTime() - now.getTime();

    if (diff < 0) return 'Overdue';
    if (diff < 60000) return 'In < 1 min';
    if (diff < 3600000) return `In ${Math.round(diff / 60000)} min`;
    if (diff < 86400000) return `In ${Math.round(diff / 3600000)} hours`;
    return `In ${Math.round(diff / 86400000)} days`;
  };

  if (reminders.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        No pending reminders. Add one above!
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {reminders.map((reminder) => (
        <div
          key={reminder.id}
          className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-slate-600 transition"
        >
          <div className="flex items-start gap-3">
            {/* Bell icon */}
            <div className="text-yellow-400 mt-0.5">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
              </svg>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-white">{reminder.message}</p>
              <p className="text-sm text-slate-400 mt-1">
                {formatTime(reminder.snoozedUntil || reminder.remindAt)}
                <span className="text-slate-500 ml-2">
                  ({new Date(reminder.snoozedUntil || reminder.remindAt).toLocaleString()})
                </span>
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => setShowSnoozeId(showSnoozeId === reminder.id ? null : reminder.id)}
                  className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition"
                  title="Snooze"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </button>
                {showSnoozeId === reminder.id && (
                  <div className="absolute right-0 top-8 bg-slate-700 rounded-lg shadow-xl z-10 py-1 min-w-[100px]">
                    {['15m', '30m', '1h', '2h', '1d'].map((d) => (
                      <button
                        key={d}
                        onClick={() => {
                          onSnooze(reminder.id, d);
                          setShowSnoozeId(null);
                        }}
                        className="block w-full text-left px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-600"
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => onCancel(reminder.id)}
                className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-slate-700 transition"
                title="Cancel"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
