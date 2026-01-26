import { useEffect, useMemo, useState } from "react";
import { getToken } from "../../services/auth.js";

/**
 * Admin dashboard for snapshots, users, and database stats.
 *
 * Each action includes a confirmation step to reduce accidental changes.
 */
export default function AdminDashboard() {
  const [snapshots, setSnapshots] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [confirmAction, setConfirmAction] = useState(null);

  const baseUrl = import.meta.env.VITE_API_URL;
  const authHeader = useMemo(() => {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const [snapshotRes, userRes, statsRes, activityRes] = await Promise.all([
          fetch(`${baseUrl}/api/snapshots`, { headers: authHeader }),
          fetch(`${baseUrl}/api/admin/users`, { headers: authHeader }),
          fetch(`${baseUrl}/api/admin/stats`, { headers: authHeader }),
          fetch(`${baseUrl}/api/admin/activity`, { headers: authHeader }),
        ]);

        if (!snapshotRes.ok || !userRes.ok || !statsRes.ok || !activityRes.ok) {
          throw new Error("Failed to load admin data.");
        }

        const snapshotData = await snapshotRes.json();
        const userData = await userRes.json();
        const statsData = await statsRes.json();
        const activityData = await activityRes.json();

        setSnapshots(snapshotData.snapshots || []);
        setUsers(userData.users || []);
        setStats(statsData);
        setActivity(activityData.activity || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [baseUrl, authHeader]);

  const handleManualSnapshot = () => {
    setConfirmAction({
      title: "Create snapshot",
      message: "Create a manual snapshot of the current database state?",
      onConfirm: async () => {
        await fetch(`${baseUrl}/api/snapshots`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeader,
          },
          body: JSON.stringify({ description: manualDescription }),
        });
        setManualDescription("");
        await reloadSnapshots();
      },
    });
  };

  const handleRestoreSnapshot = (snapshot) => {
    setConfirmAction({
      title: "Restore snapshot",
      message: `Restore snapshot from ${snapshot.created_at}? This will overwrite current data.`,
      onConfirm: async () => {
        await fetch(`${baseUrl}/api/snapshots/${snapshot.id}/restore`, {
          method: "POST",
          headers: authHeader,
        });
        await reloadSnapshots();
      },
    });
  };

  const handlePasswordReset = (user) => {
    setConfirmAction({
      title: "Reset password",
      message: `Reset password for ${user.username}?`,
      onConfirm: async () => {
        const newPassword = prompt(`Enter new password for ${user.username}`);
        if (!newPassword) {
          return;
        }
        await fetch(`${baseUrl}/api/admin/users/${encodeURIComponent(user.username)}/password`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...authHeader,
          },
          body: JSON.stringify({ password: newPassword }),
        });
      },
    });
  };

  const reloadSnapshots = async () => {
    const snapshotRes = await fetch(`${baseUrl}/api/snapshots`, { headers: authHeader });
    const snapshotData = await snapshotRes.json();
    setSnapshots(snapshotData.snapshots || []);
  };

  if (isLoading) {
    return <div className="page">Loading admin dashboard...</div>;
  }

  if (error) {
    return (
      <div className="page">
        <p>Unable to load admin data. {error}</p>
      </div>
    );
  }

  return (
    <section className="page admin-dashboard">
      <h1>Admin Dashboard</h1>

      <section className="admin-section">
        <h2>Snapshot Management</h2>
        <div className="snapshot-actions">
          <input
            type="text"
            placeholder="Snapshot description"
            value={manualDescription}
            onChange={(event) => setManualDescription(event.target.value)}
          />
          <button type="button" onClick={handleManualSnapshot}>
            Create Manual Snapshot
          </button>
        </div>
        <ul className="snapshot-list">
          {snapshots.map((snapshot) => (
            <li key={snapshot.id}>
              <div>
                <strong>{snapshot.created_at}</strong>
                <p>{snapshot.description || "No description"}</p>
              </div>
              <button type="button" onClick={() => handleRestoreSnapshot(snapshot)}>
                Restore
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="admin-section">
        <h2>User Management</h2>
        <ul className="user-list">
          {users.map((user) => (
            <li key={user.id}>
              <div>
                <strong>{user.username}</strong>
                <p>Access level: {user.access_level}</p>
              </div>
              <button type="button" onClick={() => handlePasswordReset(user)}>
                Change Password
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="admin-section">
        <h2>Database Stats</h2>
        <div className="stats-grid">
          <div>
            <strong>Maternal People</strong>
            <p>{stats?.people?.maternal || 0}</p>
          </div>
          <div>
            <strong>Paternal People</strong>
            <p>{stats?.people?.paternal || 0}</p>
          </div>
          <div>
            <strong>Relationships</strong>
            <p>{stats?.relationships || 0}</p>
          </div>
          <div>
            <strong>Activity Entries</strong>
            <p>{stats?.activityEntries || 0}</p>
          </div>
        </div>
      </section>

      <section className="admin-section">
        <h2>Recent Activity</h2>
        <ul className="activity-list">
          {activity.map((entry) => (
            <li key={entry.id}>
              <strong>{entry.action}</strong> by {entry.user_id} on {entry.created_at}
            </li>
          ))}
        </ul>
      </section>

      {confirmAction ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <header className="modal-header">
              <h3>{confirmAction.title}</h3>
              <button type="button" onClick={() => setConfirmAction(null)}>
                Close
              </button>
            </header>
            <p>{confirmAction.message}</p>
            <div className="button-row">
              <button
                type="button"
                onClick={async () => {
                  await confirmAction.onConfirm();
                  setConfirmAction(null);
                }}
              >
                Confirm
              </button>
              <button type="button" onClick={() => setConfirmAction(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
