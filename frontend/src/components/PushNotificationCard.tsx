import { usePushNotifications } from "../hooks/usePushNotifications";

export function PushNotificationCard() {
  const { permission, loading, enabled, enable, disable } = usePushNotifications();

  // Don't render if service workers aren't supported
  if (permission === "unsupported") return null;

  return (
    <div className="bg-white rounded-2xl border border-warm-200 shadow-sm p-5 md:p-6">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-teal-600">
            <path
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-warm-800">
            Appointment Reminders
          </h3>

          {permission === "denied" ? (
            <div className="mt-1">
              <p className="text-sm text-warm-500">
                Notifications are blocked. To enable them, open your browser
                settings and allow notifications for this site.
              </p>
            </div>
          ) : enabled ? (
            <div className="mt-1">
              <p className="text-sm text-warm-500">
                You will receive reminders on this device before your appointments.
              </p>
              <button
                onClick={disable}
                disabled={loading}
                className="mt-3 text-sm text-warm-500 hover:text-warm-700 transition-colors disabled:opacity-50"
              >
                {loading ? "Disabling..." : "Turn off notifications"}
              </button>
            </div>
          ) : (
            <div className="mt-1">
              <p className="text-sm text-warm-500">
                Get reminders on this device before your appointments.
              </p>
              <button
                onClick={enable}
                disabled={loading}
                className="mt-3 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
              >
                {loading ? "Enabling..." : "Enable Notifications"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
