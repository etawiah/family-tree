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
  const [peopleBySide, setPeopleBySide] = useState({
    maternal: [],
    paternal: [],
  });
  const [currentUser, setCurrentUser] = useState(null);
  const [lastLogin, setLastLogin] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [confirmAction, setConfirmAction] = useState(null);
  const [photoCleanupError, setPhotoCleanupError] = useState("");

  const baseUrl = import.meta.env.VITE_API_URL;
  const authHeader = useMemo(() => {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const peopleMap = useMemo(() => {
    const allPeople = [...peopleBySide.maternal, ...peopleBySide.paternal];
    return allPeople.reduce((acc, person) => {
      acc[person.id] = `${person.first_name} ${person.last_name}`;
      return acc;
    }, {});
  }, [peopleBySide]);

  const orphanedPhotos = useMemo(() => {
    return (activity || [])
      .filter((entry) => entry.action === "photos.unlinked")
      .map((entry) => {
        let details = {};
        try {
          details = JSON.parse(entry.details || "{}");
        } catch {
          details = {};
        }
        return {
          id: entry.id,
          created_at: entry.created_at,
          user_id: entry.user_id,
          ...details,
        };
      });
  }, [activity]);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const [
          snapshotRes,
          userRes,
          statsRes,
          activityRes,
          maternalPeopleRes,
          paternalPeopleRes,
        ] = await Promise.all([
          fetch(`${baseUrl}/api/snapshots`, { headers: authHeader }),
          fetch(`${baseUrl}/api/admin/users`, { headers: authHeader }),
          fetch(`${baseUrl}/api/admin/stats`, { headers: authHeader }),
          fetch(`${baseUrl}/api/admin/activity`, { headers: authHeader }),
          fetch(`${baseUrl}/api/people?tree_side=maternal`, { headers: authHeader }),
          fetch(`${baseUrl}/api/people?tree_side=paternal`, { headers: authHeader }),
        ]);

        if (
          !snapshotRes.ok ||
          !userRes.ok ||
          !statsRes.ok ||
          !activityRes.ok ||
          !maternalPeopleRes.ok ||
          !paternalPeopleRes.ok
        ) {
          throw new Error("Failed to load admin data.");
        }

        const snapshotData = await snapshotRes.json();
        const userData = await userRes.json();
        const statsData = await statsRes.json();
        const activityData = await activityRes.json();
        const maternalPeopleData = await maternalPeopleRes.json();
        const paternalPeopleData = await paternalPeopleRes.json();

        setSnapshots(snapshotData.snapshots || []);
        setUsers(userData.users || []);
        setStats(statsData);
        setActivity(activityData.activity || []);
        setPeopleBySide({
          maternal: maternalPeopleData.people || [],
          paternal: paternalPeopleData.people || [],
        });

        // Fetch current user info to show role and attribution context.
        const verifyRes = await fetch(`${baseUrl}/api/auth/verify`, {
          headers: authHeader,
        });
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json();
          setCurrentUser(verifyData);
          const latestLogin = (activityData.activity || []).find(
            (entry) =>
              entry.action === "auth.login.success" &&
              entry.user_id === verifyData.username
          );
          setLastLogin(latestLogin?.created_at || null);
        }
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

  const handleDeletePerson = (person) => {
    setConfirmAction({
      title: "Soft Delete person",
      message: `Delete ${person.first_name} ${person.last_name}? This will hide them from the tree but keep the record in the database (soft delete). You can restore them later if needed.`,
      onConfirm: async () => {
        await fetch(`${baseUrl}/api/people/${person.id}`, {
          method: "DELETE",
          headers: authHeader,
        });
        await reloadPeople();
      },
    });
  };

  const handleHardDeletePerson = (person) => {
    setConfirmAction({
      title: "Hard Delete person",
      message: `PERMANENTLY delete ${person.first_name} ${person.last_name}? This will remove them and all their relationships from the database forever. This cannot be undone!`,
      onConfirm: async () => {
        const response = await fetch(`${baseUrl}/api/people/${person.id}?hard=true`, {
          method: "DELETE",
          headers: authHeader,
        });
        if (!response.ok) {
          const payload = await response.json();
          alert(payload?.error || "Failed to hard delete person.");
          return;
        }
        await reloadPeople();
      },
    });
  };

  const handleDeletePhoto = (photoUrl) => {
    if (!photoUrl) {
      return;
    }
    const filename = photoUrl.split("/").pop();
    if (!filename) {
      setPhotoCleanupError("Unable to determine filename from URL.");
      return;
    }
    setConfirmAction({
      title: "Delete photo from R2",
      message: "Delete this image from storage? This cannot be undone.",
      onConfirm: async () => {
        setPhotoCleanupError("");
        const response = await fetch(
          `${baseUrl}/upload?filename=${encodeURIComponent(filename)}`,
          {
            method: "DELETE",
            headers: authHeader,
          }
        );
        if (!response.ok) {
          const payload = await response.json();
          setPhotoCleanupError(payload?.error || "Failed to delete photo.");
        }
      },
    });
  };

  const reloadSnapshots = async () => {
    const snapshotRes = await fetch(`${baseUrl}/api/snapshots`, { headers: authHeader });
    const snapshotData = await snapshotRes.json();
    setSnapshots(snapshotData.snapshots || []);
  };

  const reloadPeople = async () => {
    const [maternalPeopleRes, paternalPeopleRes] = await Promise.all([
      fetch(`${baseUrl}/api/people?tree_side=maternal`, { headers: authHeader }),
      fetch(`${baseUrl}/api/people?tree_side=paternal`, { headers: authHeader }),
    ]);

    if (!maternalPeopleRes.ok || !paternalPeopleRes.ok) {
      return;
    }

    const maternalPeopleData = await maternalPeopleRes.json();
    const paternalPeopleData = await paternalPeopleRes.json();
    setPeopleBySide({
      maternal: maternalPeopleData.people || [],
      paternal: paternalPeopleData.people || [],
    });
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
        <h2>Current Session</h2>
        <p>
          Logged in as{" "}
          <strong>{currentUser?.username || "Unknown"}</strong> (
          {currentUser?.accessLevel || "unknown"}).
        </p>
        <p>
          Last login recorded at:{" "}
          {lastLogin ? new Date(lastLogin).toLocaleString() : "Not available"}
        </p>
        <p>
          Activity entries below provide attribution for actions performed in
          the app.
        </p>
      </section>

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
        <h2>People Management</h2>
        <p>Use these lists to edit or delete any record.</p>
        <div className="people-columns">
          <div>
            <h3>Maternal</h3>
            <ul className="people-list">
              {peopleBySide.maternal.map((person) => (
                <li key={person.id}>
                  <div>
                    <strong>
                      {person.first_name} {person.last_name}
                    </strong>
                    <p>#{person.id}</p>
                  </div>
                  <div className="button-row">
                    <a className="button-link" href={`/people/${person.id}/edit`}>
                      Edit
                    </a>
                    <button type="button" onClick={() => handleDeletePerson(person)}>
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Paternal</h3>
            <ul className="people-list">
              {peopleBySide.paternal.map((person) => (
                <li key={person.id}>
                  <div>
                    <strong>
                      {person.first_name} {person.last_name}
                    </strong>
                    <p>#{person.id}</p>
                  </div>
                  <div className="button-row">
                    <a className="button-link" href={`/people/${person.id}/edit`}>
                      Edit
                    </a>
                    <button type="button" onClick={() => handleDeletePerson(person)}>
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="admin-section">
        <h2>Photo Cleanup</h2>
        <p>
          Photos removed by editors are listed here for admin review. You can
          delete from R2 or leave them in storage.
        </p>
        {photoCleanupError ? (
          <p className="form-error">{photoCleanupError}</p>
        ) : null}
        <ul className="photo-cleanup-list">
          {orphanedPhotos.length ? (
            orphanedPhotos.map((entry) => (
              <li key={entry.id}>
                <div>
                  <strong>{entry.type || "photo"}</strong>
                  <p>
                    Person:{" "}
                    {entry.personId
                      ? peopleMap[entry.personId] || `#${entry.personId}`
                      : "Unknown"}
                  </p>
                  <p>Removed by: {entry.user_id}</p>
                  <p>{entry.url}</p>
                  <p>Logged at: {entry.created_at}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeletePhoto(entry.url)}
                >
                  Delete from R2
                </button>
              </li>
            ))
          ) : (
            <li>No unlinked photos recorded.</li>
          )}
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
