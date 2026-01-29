import { useEffect, useMemo, useState } from "react";
import { getToken } from "../../services/auth.js";

/**
 * PeopleList component - displays active and soft-deleted people with checkboxes
 */
function PeopleList({
  people = [],
  selectedIds = new Set(),
  onSelectPerson,
  onSelectAll,
  onDelete,
  onHardDelete,
  onRestore,
  isBulkDeleting = false,
}) {
  // Handle both boolean and numeric (0/1) is_deleted values from SQLite
  const activePeople = (people || []).filter((p) => !p.is_deleted || p.is_deleted === 0);
  const softDeletedPeople = (people || []).filter((p) => p.is_deleted && p.is_deleted !== 0);

  const renderPerson = (person) => {
    const isSelected = selectedIds.has(person.id);
    // Handle both boolean and numeric (0/1) is_deleted values from SQLite
    const isDeleted = person.is_deleted && person.is_deleted !== 0;

    return (
      <li
        key={person.id}
        style={{
          opacity: isDeleted ? 0.6 : 1,
          backgroundColor: isDeleted ? "#f1f5f9" : "transparent",
          padding: "0.5rem",
          marginBottom: "0.5rem",
          borderRadius: "4px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelectPerson(person.id)}
            disabled={isBulkDeleting}
            style={{ 
              cursor: isBulkDeleting ? "not-allowed" : "pointer",
              width: "18px",
              height: "18px",
              flexShrink: 0
            }}
          />
          <div style={{ flex: 1 }}>
            <strong>
              {person.first_name} {person.last_name}
              {isDeleted && (
                <span
                  style={{
                    marginLeft: "0.5rem",
                    padding: "0.125rem 0.5rem",
                    backgroundColor: "#ef4444",
                    color: "#ffffff",
                    borderRadius: "4px",
                    fontSize: "0.75rem",
                  }}
                >
                  DELETED
                </span>
              )}
            </strong>
            <p style={{ margin: "0.25rem 0", fontSize: "0.875rem", color: "#64748b" }}>
              #{person.id}
            </p>
          </div>
        </div>
        <div className="button-row" style={{ marginTop: "0.5rem" }}>
          {!isDeleted && (
            <>
              <button
                type="button"
                onClick={() => onDelete(person)}
                disabled={isBulkDeleting}
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => onHardDelete(person)}
                disabled={isBulkDeleting}
                style={{ backgroundColor: "#dc2626", color: "#ffffff" }}
              >
                Hard Delete
              </button>
            </>
          )}
          {isDeleted && (
            <>
              <button
                type="button"
                onClick={() => onRestore(person)}
                disabled={isBulkDeleting}
                style={{ backgroundColor: "#16a34a", color: "#ffffff" }}
              >
                Restore
              </button>
              <button
                type="button"
                onClick={() => onHardDelete(person)}
                disabled={isBulkDeleting}
                style={{ backgroundColor: "#dc2626", color: "#ffffff" }}
              >
                Hard Delete
              </button>
            </>
          )}
        </div>
      </li>
    );
  };

  if (!people || people.length === 0) {
    return <div style={{ padding: "1rem", color: "#64748b" }}>No people found</div>;
  }

  return (
    <>
      <div style={{ marginBottom: "1rem", padding: "0.5rem", backgroundColor: "#f8fafc", borderRadius: "4px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={activePeople.length > 0 && activePeople.every((p) => selectedIds.has(p.id))}
            onChange={() => onSelectAll(activePeople)}
            disabled={isBulkDeleting}
            style={{ cursor: isBulkDeleting ? "not-allowed" : "pointer", width: "18px", height: "18px", flexShrink: 0 }}
          />
          <strong>Select All Active ({activePeople.length})</strong>
        </label>
      </div>
      <ul className="people-list" style={{ listStyle: "none", padding: 0 }}>
        {activePeople.length > 0 ? (
          activePeople.map(renderPerson)
        ) : (
          <li style={{ padding: "1rem", color: "#64748b" }}>No active people</li>
        )}
      </ul>

      {softDeletedPeople.length > 0 && (
        <>
          <h4 style={{ marginTop: "2rem", marginBottom: "0.5rem", color: "#ef4444" }}>
            Soft-Deleted People
          </h4>
          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}
            >
              <input
                type="checkbox"
                checked={
                  softDeletedPeople.length > 0 &&
                  softDeletedPeople.every((p) => selectedIds.has(p.id))
                }
                onChange={() => onSelectAll(softDeletedPeople)}
                disabled={isBulkDeleting}
                style={{ cursor: isBulkDeleting ? "not-allowed" : "pointer", width: "18px", height: "18px", flexShrink: 0 }}
              />
              <strong>Select All Deleted ({softDeletedPeople.length})</strong>
            </label>
          </div>
          <ul className="people-list" style={{ listStyle: "none", padding: 0 }}>
            {softDeletedPeople.map(renderPerson)}
          </ul>
        </>
      )}
    </>
  );
}

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
  const [people, setPeople] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [lastLogin, setLastLogin] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [confirmAction, setConfirmAction] = useState(null);
  const [photoCleanupError, setPhotoCleanupError] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const baseUrl = import.meta.env.VITE_API_URL;
  const authHeader = useMemo(() => {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const peopleMap = useMemo(() => {
    return (people || []).reduce((acc, person) => {
      acc[person.id] = `${person.first_name} ${person.last_name}`;
      return acc;
    }, {});
  }, [people]);

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
          peopleRes,
        ] = await Promise.all([
          fetch(`${baseUrl}/api/snapshots`, { headers: authHeader }),
          fetch(`${baseUrl}/api/admin/users`, { headers: authHeader }),
          fetch(`${baseUrl}/api/admin/stats`, { headers: authHeader }),
          fetch(`${baseUrl}/api/admin/activity`, { headers: authHeader }),
          fetch(`${baseUrl}/api/admin/people`, { headers: authHeader }),
        ]);

        if (
          !snapshotRes.ok ||
          !userRes.ok ||
          !statsRes.ok ||
          !activityRes.ok ||
          !peopleRes.ok
        ) {
          throw new Error("Failed to load admin data.");
        }

        const snapshotData = await snapshotRes.json();
        const userData = await userRes.json();
        const statsData = await statsRes.json();
        const activityData = await activityRes.json();
        const peopleData = await peopleRes.json();

        setSnapshots(snapshotData.snapshots || []);
        setUsers(userData.users || []);
        setStats(statsData);
        setActivity(activityData.activity || []);
        setPeople(peopleData.people || []);

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

  const handleRestorePerson = (person) => {
    setConfirmAction({
      title: "Restore person",
      message: `Restore ${person.first_name} ${person.last_name}? This will make them visible in the tree again.`,
      onConfirm: async () => {
        const response = await fetch(`${baseUrl}/api/people/${person.id}/restore`, {
          method: "POST",
          headers: authHeader,
        });
        if (!response.ok) {
          const payload = await response.json();
          alert(payload?.error || "Failed to restore person.");
          return;
        }
        await reloadPeople();
      },
    });
  };

  const handleSelectPerson = (personId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(personId)) {
        next.delete(personId);
      } else {
        next.add(personId);
      }
      return next;
    });
  };

  const handleSelectAll = (people) => {
    const allSelected = people.every((p) => selectedIds.has(p.id));
    if (allSelected) {
      // Deselect all
      setSelectedIds((prev) => {
        const next = new Set(prev);
        people.forEach((p) => next.delete(p.id));
        return next;
      });
    } else {
      // Select all
      setSelectedIds((prev) => {
        const next = new Set(prev);
        people.forEach((p) => next.add(p.id));
        return next;
      });
    }
  };

  const handleBulkDelete = (hard = false) => {
    if (selectedIds.size === 0) {
      alert("Please select at least one person.");
      return;
    }

    const personArray = Array.from(selectedIds);
    const action = hard ? "PERMANENTLY delete" : "delete";
    const warning = hard
      ? " This will remove them and all their relationships from the database forever. This cannot be undone!"
      : " This will hide them from the tree but keep the record in the database (soft delete).";

    setConfirmAction({
      title: hard ? "Bulk Hard Delete" : "Bulk Soft Delete",
      message: `${action} ${personArray.length} person(s)?${warning}`,
      onConfirm: async () => {
        setIsBulkDeleting(true);
        try {
          const response = await fetch(`${baseUrl}/api/admin/people/bulk-delete`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...authHeader,
            },
            body: JSON.stringify({
              person_ids: personArray,
              hard,
            }),
          });

          const payload = await response.json();
          if (!response.ok) {
            alert(payload?.error || "Bulk delete failed.");
            return;
          }

          const { deleted, failed, summary } = payload;
          if (failed.length > 0) {
            alert(
              `Deleted ${summary.deleted} person(s). Failed to delete ${summary.failed} person(s).`
            );
          } else {
            alert(`Successfully deleted ${summary.deleted} person(s).`);
          }
          await reloadPeople();
        } catch (err) {
          alert("Bulk delete failed: " + err.message);
        } finally {
          setIsBulkDeleting(false);
        }
      },
    });
  };

  const handleBulkRestore = () => {
    if (selectedIds.size === 0) {
      alert("Please select at least one soft-deleted person.");
      return;
    }

    const personArray = Array.from(selectedIds);
    setConfirmAction({
      title: "Bulk Restore",
      message: `Restore ${personArray.length} person(s)? This will make them visible in the tree again.`,
      onConfirm: async () => {
        setIsBulkDeleting(true);
        try {
          const restorePromises = personArray.map((personId) =>
            fetch(`${baseUrl}/api/people/${personId}/restore`, {
              method: "POST",
              headers: authHeader,
            })
          );

          const results = await Promise.allSettled(restorePromises);
          const successful = results.filter((r) => r.status === "fulfilled" && r.value.ok).length;
          const failed = results.length - successful;

          if (failed > 0) {
            alert(`Restored ${successful} person(s). Failed to restore ${failed} person(s).`);
          } else {
            alert(`Successfully restored ${successful} person(s).`);
          }
          await reloadPeople();
        } catch (err) {
          alert("Bulk restore failed: " + err.message);
        } finally {
          setIsBulkDeleting(false);
        }
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
    const peopleRes = await fetch(`${baseUrl}/api/admin/people`, {
      headers: authHeader,
    });

    if (!peopleRes.ok) {
      return;
    }

    const peopleData = await peopleRes.json();
    setPeople(peopleData.people || []);
    // Clear selections when data reloads
    setSelectedIds(new Set());
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
        <p>Use these lists to edit, delete, or restore any record.</p>
        <div style={{
          marginBottom: "1rem",
          padding: "0.75rem",
          backgroundColor: "#f8fafc",
          borderRadius: "8px",
          border: "1px solid #e2e8f0"
        }}>
          <strong>Summary:</strong>{" "}
          {people.filter((p) => !p.is_deleted || p.is_deleted === 0).length} active,{" "}
          {people.filter((p) => p.is_deleted && p.is_deleted !== 0).length} deleted
        </div>
        <div>
          <h3>All People</h3>
          <PeopleList
            people={people}
            selectedIds={selectedIds}
            onSelectPerson={handleSelectPerson}
            onSelectAll={handleSelectAll}
            onDelete={handleDeletePerson}
            onHardDelete={handleHardDeletePerson}
            onRestore={handleRestorePerson}
            isBulkDeleting={isBulkDeleting}
          />
        </div>
        <div 
          className="bulk-actions" 
          style={{ 
            marginTop: "1rem", 
            padding: "1rem", 
            border: "1px solid #cbd5f5", 
            borderRadius: "8px",
            backgroundColor: "#ffffff",
            display: "block"
          }}
        >
          <p style={{ margin: "0 0 0.5rem 0" }}>
            <strong>Bulk Actions:</strong> {selectedIds.size} person(s) selected
          </p>
          <div className="button-row" style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => handleBulkDelete(false)}
              disabled={selectedIds.size === 0 || isBulkDeleting}
              style={{ 
                padding: "0.5rem 1rem",
                cursor: selectedIds.size === 0 || isBulkDeleting ? "not-allowed" : "pointer",
                opacity: selectedIds.size === 0 || isBulkDeleting ? 0.5 : 1
              }}
            >
              {isBulkDeleting ? "Deleting..." : "Soft Delete Selected"}
            </button>
            <button
              type="button"
              onClick={() => handleBulkDelete(true)}
              disabled={selectedIds.size === 0 || isBulkDeleting}
              style={{ 
                backgroundColor: "#dc2626", 
                color: "#ffffff",
                padding: "0.5rem 1rem",
                cursor: selectedIds.size === 0 || isBulkDeleting ? "not-allowed" : "pointer",
                opacity: selectedIds.size === 0 || isBulkDeleting ? 0.5 : 1
              }}
            >
              {isBulkDeleting ? "Deleting..." : "Hard Delete Selected"}
            </button>
            <button
              type="button"
              onClick={handleBulkRestore}
              disabled={selectedIds.size === 0 || isBulkDeleting}
              style={{ 
                backgroundColor: "#16a34a", 
                color: "#ffffff",
                padding: "0.5rem 1rem",
                cursor: selectedIds.size === 0 || isBulkDeleting ? "not-allowed" : "pointer",
                opacity: selectedIds.size === 0 || isBulkDeleting ? 0.5 : 1
              }}
            >
              {isBulkDeleting ? "Restoring..." : "Restore Selected"}
            </button>
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
            <strong>People (Active)</strong>
            <p>{stats?.people?.active || 0}</p>
            {stats?.people?.total !== undefined && stats?.people?.total !== stats?.people?.active && (
              <p style={{ fontSize: "0.75rem", color: "#64748b" }}>
                Total: {stats.people.total} (includes {stats.people.deleted || 0} deleted)
              </p>
            )}
          </div>
          <div>
            <strong>People (Deleted)</strong>
            <p>{stats?.people?.deleted || 0}</p>
            <p style={{ fontSize: "0.75rem", color: "#64748b" }}>
              Soft-deleted records retained for recovery
            </p>
          </div>
          <div>
            <strong>Relationships</strong>
            <p>{stats?.relationshipsActive !== undefined ? stats.relationshipsActive : stats?.relationships || 0}</p>
            {stats?.relationshipsActive !== undefined && stats.relationshipsActive !== stats.relationships && (
              <p style={{ fontSize: "0.75rem", color: "#64748b" }}>
                Total: {stats.relationships} (includes deleted people)
              </p>
            )}
            <p style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
              Note: Soft-deleted people keep relationships. Hard delete removes them.
            </p>
          </div>
          <div>
            <strong>Activity Log Entries</strong>
            <p>{stats?.activityEntries || 0}</p>
            <p style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
              Audit trail of all actions (permanent record)
            </p>
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
