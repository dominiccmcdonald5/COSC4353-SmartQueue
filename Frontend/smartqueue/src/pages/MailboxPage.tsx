import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MdRefresh,
  MdDeleteOutline,
  MdDeleteSweep,
  MdRestoreFromTrash,
  MdDeleteForever,
} from 'react-icons/md';
import { useAuth } from '../context/AuthContext';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import '../styling/HomePage.css';
import '../styling/MailboxPage.css';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'https://cosc4353-smartqueue.onrender.com').replace(/\/$/, '');

interface Row {
  notificationId: number;
  userId: number;
  message: string;
  timestamp: string | null;
  status: string;
  deletedAt?: string | null;
}

interface ConcertLite {
  id: string;
  name: string;
}

type Folder = 'inbox' | 'trash';

/** Matches backend notification copy (purchase + 6th-in-line). */
function extractQueueConcertHint(message: string): string | null {
  const purchase = message.match(/purchase a ticket for\s+(.+?)\.\s*Grab\s+it/i);
  if (purchase) {
    const raw = purchase[1].trim();
    if (raw.toLowerCase() === 'this concert') return null;
    return raw;
  }
  const sixth = message.match(/6th in line for\s+(.+?)\./i);
  if (sixth) return sixth[1].trim();
  const left = message.match(/left the queue for\s+(.+?)\./i);
  if (left) {
    const raw = left[1].trim();
    if (raw.toLowerCase() === 'this concert') return null;
    return raw;
  }
  const joined = message.match(/joined the queue for\s+(.+?)\./i);
  if (joined) {
    const raw = joined[1].trim();
    if (raw.toLowerCase() === 'this concert') return null;
    return raw;
  }
  const concertLine = message.match(/^Concert:\s*(.+)$/m);
  if (concertLine) {
    const raw = concertLine[1].trim();
    if (raw.toLowerCase() === 'this concert') return null;
    return raw;
  }
  return null;
}

function findConcertIdForHint(hint: string, concerts: ConcertLite[]): string | null {
  const h = hint.toLowerCase().trim();
  for (const c of concerts) {
    const n = c.name.toLowerCase().trim();
    if (n === h || n.includes(h) || h.includes(n)) {
      return c.id;
    }
  }
  return null;
}

function queuePathForMessage(message: string | null | undefined, concerts: ConcertLite[]): string | null {
  if (message == null || message === '') return null;
  const hint = extractQueueConcertHint(message);
  if (!hint) return null;
  const id = findConcertIdForHint(hint, concerts);
  return id ? `/queue/${id}` : null;
}

function formatTime(ts: string | null): string {
  if (ts == null || ts === '') return '';
  const ms = Date.parse(ts);
  if (!Number.isNaN(ms)) {
    return new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }
  return String(ts);
}

const MailboxPage: React.FC = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [supportsTrash, setSupportsTrash] = useState(false);
  const [folder, setFolder] = useState<Folder>('inbox');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [concerts, setConcerts] = useState<ConcertLite[]>([]);
  const [confirm, setConfirm] = useState<
    null | { kind: 'moveAll' } | { kind: 'deletePermanent'; deleteAll: boolean }
  >(null);

  const uid =
    user?.id && /^\d+$/.test(user.id) ? Number(user.id) : null;

  const load = useCallback(async () => {
    if (uid == null) {
      setRows([]);
      setSelectedId(null);
      setSupportsTrash(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid, folder }),
      });
      const text = await res.text();
      let data: {
        success?: boolean;
        message?: string;
        notifications?: Row[];
        supportsTrash?: boolean;
      };
      try {
        data = JSON.parse(text) as typeof data;
      } catch {
        throw new Error(res.ok ? 'Invalid response' : `${res.status} ${res.statusText}`);
      }
      if (!res.ok || !data.success) {
        throw new Error(data.message || `Could not load notifications (${res.status} ${res.statusText})`);
      }
      const list = data.notifications ?? [];
      setSupportsTrash(Boolean(data.supportsTrash));
      setRows(list);
      setSelectedId((prev) => {
        if (prev != null && list.some((r) => r.notificationId === prev)) return prev;
        return list[0]?.notificationId ?? null;
      });
      setSelectedIds((prev) => prev.filter((id) => list.some((r) => r.notificationId === id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load notifications');
      setRows([]);
      setSelectedId(null);
      setSupportsTrash(false);
    } finally {
      setLoading(false);
    }
  }, [uid, folder]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/concerts`);
        const data = (await res.json()) as {
          success?: boolean;
          concerts?: Array<{ id?: string; name?: string }>;
        };
        if (cancelled || !res.ok || !data.success || !Array.isArray(data.concerts)) return;
        setConcerts(
          data.concerts.map((c) => ({
            id: String(c.id ?? ''),
            name: String(c.name ?? ''),
          })).filter((c) => c.id && c.name)
        );
      } catch {
        /* queue links optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSelectMode(false);
    setSelectedIds([]);
  }, [folder]);

  const markAsViewed = useCallback(async (r: Row) => {
    if (String(r.status).toLowerCase() === 'viewed') return;
    try {
      const res = await fetch(`${API_BASE}/api/notifications/mark-viewed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: r.notificationId }),
      });
      const data = (await res.json()) as { success?: boolean };
      if (res.ok && data.success) {
        setRows((prev) =>
          prev.map((x) =>
            x.notificationId === r.notificationId ? { ...x, status: 'viewed' } : x
          )
        );
      }
    } catch {
      /* keep UI */
    }
  }, []);

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAllToggle = () => {
    if (rows.length > 0 && selectedIds.length === rows.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(rows.map((r) => r.notificationId));
    }
  };

  const postJson = async (path: string, body: object) => {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { success?: boolean; message?: string };
    if (!res.ok || !data.success) {
      throw new Error(data.message || `${res.status} ${res.statusText}`);
    }
    return data;
  };

  const handleMoveToTrash = async (ids: number[]) => {
    if (uid == null || ids.length === 0) return;
    try {
      await postJson('/api/notifications/move-to-trash', {
        userId: uid,
        notificationIds: ids,
      });
      setSelectMode(false);
      setSelectedIds([]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not move to trash');
    }
  };

  const handleMoveAllToTrash = async () => {
    if (uid == null) return;
    try {
      await postJson('/api/notifications/move-all-to-trash', { userId: uid });
      setConfirm(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not move all to trash');
    }
  };

  const handleRestore = async () => {
    if (uid == null || selectedIds.length === 0) return;
    try {
      await postJson('/api/notifications/restore', {
        userId: uid,
        notificationIds: selectedIds,
      });
      setSelectMode(false);
      setSelectedIds([]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not restore');
    }
  };

  const handleDeletePermanent = async (deleteAll: boolean) => {
    if (uid == null) return;
    try {
      await postJson('/api/notifications/delete-permanent', {
        userId: uid,
        deleteAll,
        notificationIds: deleteAll ? [] : selectedIds,
      });
      setConfirm(null);
      setSelectMode(false);
      setSelectedIds([]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete');
    }
  };

  const handleRestoreSingle = async (notificationId: number) => {
    if (uid == null) return;
    try {
      await postJson('/api/notifications/restore', {
        userId: uid,
        notificationIds: [notificationId],
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not restore');
    }
  };

  const handleRowClick = (r: Row) => {
    if (selectMode) {
      toggleSelected(r.notificationId);
      return;
    }
    setSelectedId(r.notificationId);
    void markAsViewed(r);
  };

  const selected = rows.find((r) => r.notificationId === selectedId) ?? null;

  const queuePathForSelected = useMemo(
    () => queuePathForMessage(selected?.message, concerts),
    [selected?.message, concerts]
  );

  if (!user) {
    return (
      <div className="home-page mailbox-page">
        <header className="home-header">
          <div className="header-content mailbox-header-inner">
            <Link className="mailbox-home-pill" to="/login">
              ← Sign in
            </Link>
            <h1 className="mailbox-page-title">Mailbox</h1>
          </div>
        </header>
        <p className="mailbox-guest-msg">Sign in to view your notifications.</p>
      </div>
    );
  }

  if (uid == null) {
    return (
      <div className="home-page mailbox-page">
        <header className="home-header">
          <div className="header-content mailbox-header-inner">
            <Link className="mailbox-home-pill" to="/home">
              ← Home
            </Link>
            <h1 className="mailbox-page-title">Mailbox</h1>
          </div>
        </header>
        <p className="mailbox-guest-msg">
          Notifications are tied to your numeric user id. Sign in with a regular concert account.
        </p>
      </div>
    );
  }

  const folderLabel = folder === 'inbox' ? 'Inbox' : 'Trash';
  const allSelected = rows.length > 0 && selectedIds.length === rows.length;

  return (
    <div className="home-page mailbox-page">
      <header className="home-header">
        <div className="header-content mailbox-header-inner">
          <Link className="mailbox-home-pill" to="/home">
            ← Home
          </Link>
          <h1 className="mailbox-page-title">Mailbox</h1>
        </div>
      </header>

      <div className="mailbox-shell">
        <div className="mailbox-card">
          {error && (
            <div className="mailbox-error-banner" role="alert">
              {error}
            </div>
          )}
          {!supportsTrash && (
            <div className="mailbox-migration-hint" role="note">
              Trash and selective delete require the database migration{' '}
              <code className="mailbox-code">Backend/add_notifications_deleted_at.sql</code>.
              Until then, only Inbox is available.
            </div>
          )}

          <div className="mailbox-folder-row">
            <button
              type="button"
              className={`mailbox-folder-tab${folder === 'inbox' ? ' is-active' : ''}`}
              onClick={() => setFolder('inbox')}
            >
              Inbox
            </button>
            <button
              type="button"
              className={`mailbox-folder-tab${folder === 'trash' ? ' is-active' : ''}`}
              onClick={() => setFolder('trash')}
              disabled={!supportsTrash}
              title={
                !supportsTrash
                  ? 'Run add_notifications_deleted_at.sql on the database to enable Trash'
                  : undefined
              }
            >
              Trash
            </button>
          </div>

          <div className="mailbox-split">
            <aside className="mailbox-inbox" aria-label={folderLabel}>
              <div className="mailbox-inbox-toolbar">
                <span>
                  <strong>{folderLabel}</strong> {loading ? '…' : rows.length}
                </span>
                <button
                  type="button"
                  className="mailbox-refresh"
                  aria-label="Refresh"
                  onClick={() => void load()}
                  disabled={loading}
                >
                  <MdRefresh size={22} />
                </button>
              </div>

              <div className="mailbox-actions-row">
                <button
                  type="button"
                  className="mailbox-chip-btn"
                  onClick={() => {
                    setSelectMode((m) => !m);
                    setSelectedIds([]);
                  }}
                >
                  {selectMode ? 'Done' : 'Select'}
                </button>

                {folder === 'inbox' && supportsTrash && (
                  <>
                    {selectMode ? (
                      <>
                        <button type="button" className="mailbox-chip-btn" onClick={selectAllToggle}>
                          {allSelected ? 'Clear selection' : 'Select all'}
                        </button>
                        <button
                          type="button"
                          className="mailbox-chip-btn mailbox-chip-with-icon"
                          disabled={selectedIds.length === 0}
                          onClick={() => void handleMoveToTrash(selectedIds)}
                          title="Move selected to trash"
                        >
                          <MdDeleteOutline size={18} aria-hidden />
                          <span>Trash ({selectedIds.length})</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="mailbox-chip-btn mailbox-chip-with-icon mailbox-chip-muted"
                        onClick={() => setConfirm({ kind: 'moveAll' })}
                        title="Move every inbox message to trash"
                      >
                        <MdDeleteSweep size={18} aria-hidden />
                        <span>Trash all</span>
                      </button>
                    )}
                  </>
                )}

                {folder === 'trash' && supportsTrash && selectMode && (
                  <>
                    <button type="button" className="mailbox-chip-btn" onClick={selectAllToggle}>
                      {allSelected ? 'Clear selection' : 'Select all'}
                    </button>
                    <button
                      type="button"
                      className="mailbox-chip-btn mailbox-chip-with-icon"
                      disabled={selectedIds.length === 0}
                      onClick={() => void handleRestore()}
                      title="Restore selected to inbox"
                    >
                      <MdRestoreFromTrash size={18} aria-hidden />
                      <span>Restore ({selectedIds.length})</span>
                    </button>
                    <button
                      type="button"
                      className="mailbox-chip-btn mailbox-chip-with-icon mailbox-chip-danger"
                      disabled={selectedIds.length === 0}
                      onClick={() => setConfirm({ kind: 'deletePermanent', deleteAll: false })}
                      title="Permanently delete selected"
                    >
                      <MdDeleteForever size={18} aria-hidden />
                      <span>Delete forever</span>
                    </button>
                  </>
                )}

                {folder === 'trash' && supportsTrash && !selectMode && rows.length > 0 && (
                  <button
                    type="button"
                    className="mailbox-chip-btn mailbox-chip-with-icon mailbox-chip-danger"
                    onClick={() => setConfirm({ kind: 'deletePermanent', deleteAll: true })}
                    title="Empty trash permanently"
                  >
                    <MdDeleteForever size={18} aria-hidden />
                    <span>Empty trash</span>
                  </button>
                )}
              </div>

              <div className="mailbox-list-wrap">
                {rows.length === 0 && !loading ? (
                  <p className="mailbox-empty">
                    {folder === 'trash' ? 'Trash is empty.' : 'No messages yet.'}
                  </p>
                ) : (
                  rows.map((r) => {
                    const unread = String(r.status).toLowerCase() !== 'viewed';
                    const checked = selectedIds.includes(r.notificationId);
                    return (
                      <button
                        key={r.notificationId}
                        type="button"
                        className={`mailbox-item-btn${r.notificationId === selectedId ? ' is-active' : ''}${unread ? ' is-unread' : ''}`}
                        onClick={() => handleRowClick(r)}
                      >
                        <span className="mailbox-item-row-inner">
                          {selectMode && (
                            <span className="mailbox-item-check">
                              <input
                                type="checkbox"
                                readOnly
                                checked={checked}
                                tabIndex={-1}
                                aria-label={`Select message ${r.notificationId}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSelected(r.notificationId);
                                }}
                              />
                            </span>
                          )}
                          <span className="mailbox-item-main">
                            <span className="mailbox-item-preview-line">
                              <span className="mailbox-item-preview">{r.message}</span>
                            </span>
                            {r.timestamp ? (
                              <span className="mailbox-item-time">{formatTime(r.timestamp)}</span>
                            ) : null}
                          </span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </aside>

            <section className="mailbox-detail" aria-label="Message">
              <div className="mailbox-detail-panel">
                {selected ? (
                  <>
                    <div className="mailbox-detail-time">{formatTime(selected.timestamp)}</div>
                    <div className="mailbox-detail-message-with-link">
                      <p className="mailbox-detail-text">{selected.message}</p>
                      {queuePathForSelected && folder === 'inbox' ? (
                        <Link className="mailbox-queue-link-inline" to={queuePathForSelected}>
                          Go to queue →
                        </Link>
                      ) : null}
                    </div>
                    {supportsTrash && folder === 'trash' && !selectMode && (
                      <div className="mailbox-detail-actions">
                        <button
                          type="button"
                          className="mailbox-detail-restore-btn"
                          onClick={() => void handleRestoreSingle(selected.notificationId)}
                          title="Restore to inbox"
                        >
                          <MdRestoreFromTrash size={20} aria-hidden />
                          Restore
                        </button>
                        <button
                          type="button"
                          className="mailbox-detail-hard-delete-btn"
                          onClick={() => {
                            setSelectedIds([selected.notificationId]);
                            setConfirm({ kind: 'deletePermanent', deleteAll: false });
                          }}
                          title="Permanently delete this message"
                        >
                          <MdDeleteForever size={20} aria-hidden />
                          Delete forever
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="mailbox-detail-placeholder">Select a message to read.</p>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirm?.kind === 'moveAll'}
        title="Trash all messages?"
        message="Every inbox message will be moved to Trash. You can restore them later."
        confirmLabel="Trash all"
        cancelLabel="Cancel"
        onConfirm={() => void handleMoveAllToTrash()}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.kind === 'deletePermanent'}
        title={
          confirm?.kind === 'deletePermanent' && confirm.deleteAll
            ? 'Empty trash?'
            : 'Delete forever?'
        }
        message={
          confirm?.kind === 'deletePermanent' && confirm.deleteAll
            ? 'Permanently delete every message in Trash. This cannot be undone.'
            : `Permanently delete ${selectedIds.length || 1} message(s). This cannot be undone.`
        }
        confirmLabel="Delete permanently"
        cancelLabel="Cancel"
        confirmVariant="danger"
        onConfirm={() => {
          if (confirm?.kind !== 'deletePermanent') return;
          void handleDeletePermanent(confirm.deleteAll);
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
};

export default MailboxPage;
