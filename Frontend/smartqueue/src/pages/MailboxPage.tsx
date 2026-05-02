import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MdRefresh } from 'react-icons/md';
import { useAuth } from '../context/AuthContext';
import '../styling/HomePage.css';
import '../styling/MailboxPage.css';

const API_BASE = 'https://cosc-4353-smart-queue-6ixj.vercel.app';

interface Row {
  notificationId: number;
  userId: number;
  message: string;
  timestamp: string | null;
  status: string;
}

interface ConcertLite {
  id: string;
  name: string;
}

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
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [concerts, setConcerts] = useState<ConcertLite[]>([]);

  const uid =
    user?.id && /^\d+$/.test(user.id) ? Number(user.id) : null;

  const load = useCallback(async () => {
    if (uid == null) {
      setRows([]);
      setSelectedId(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid }),
      });
      const text = await res.text();
      let data: { success?: boolean; message?: string; notifications?: Row[] };
      try {
        data = JSON.parse(text) as typeof data;
      } catch {
        throw new Error(res.ok ? 'Invalid response' : `${res.status} ${res.statusText}`);
      }
      if (!res.ok || !data.success) {
        throw new Error(data.message || `Could not load notifications (${res.status} ${res.statusText})`);
      }
      const list = data.notifications ?? [];
      setRows(list);
      setSelectedId((prev) => {
        if (prev != null && list.some((r) => r.notificationId === prev)) return prev;
        return list[0]?.notificationId ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load notifications');
      setRows([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }, [uid]);

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
      /* keep UI; user can refresh */
    }
  }, []);

  const handleRowClick = (r: Row) => {
    setSelectedId(r.notificationId);
    void markAsViewed(r);
  };

  const selected = rows.find((r) => r.notificationId === selectedId) ?? null;

  const queuePathForSelected = useMemo(() => {
    if (!selected?.message) return null;
    const hint = extractQueueConcertHint(selected.message);
    if (!hint) return null;
    const id = findConcertIdForHint(hint, concerts);
    return id ? `/queue/${id}` : null;
  }, [selected, concerts]);

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

          <div className="mailbox-split">
            <aside className="mailbox-inbox" aria-label="Inbox">
              <div className="mailbox-inbox-toolbar">
                <span>
                  <strong>Inbox</strong> {loading ? '…' : rows.length}
                </span>
                <button
                  type="button"
                  className="mailbox-refresh"
                  aria-label="Refresh inbox"
                  onClick={() => void load()}
                  disabled={loading}
                >
                  <MdRefresh size={22} />
                </button>
              </div>
              <div className="mailbox-list-wrap">
                {rows.length === 0 && !loading ? (
                  <p className="mailbox-empty">No messages yet.</p>
                ) : (
                  rows.map((r) => {
                    const unread = String(r.status).toLowerCase() !== 'viewed';
                    return (
                    <button
                      key={r.notificationId}
                      type="button"
                      className={`mailbox-item-btn${r.notificationId === selectedId ? ' is-active' : ''}${unread ? ' is-unread' : ''}`}
                      onClick={() => handleRowClick(r)}
                    >
                      <span className="mailbox-item-preview">{r.message}</span>
                      {r.timestamp ? (
                        <span className="mailbox-item-time">{formatTime(r.timestamp)}</span>
                      ) : null}
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
                    <p className="mailbox-detail-text">{selected.message}</p>
                    {queuePathForSelected && (
                      <div className="mailbox-queue-action">
                        <Link className="mailbox-queue-btn" to={queuePathForSelected}>
                          Go to queue
                        </Link>
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
    </div>
  );
};

export default MailboxPage;
