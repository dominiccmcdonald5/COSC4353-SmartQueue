import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  MdEvent, 
  MdPeople, 
  MdAnalytics, 
  MdAdd, 
  MdEdit, 
  MdDelete, 
  MdSave, 
  MdCancel,
  MdVisibility
} from 'react-icons/md';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Tooltip } from 'recharts';
import '../styling/AdminDashboard.css';
import { ADMIN_EVENTS_STORAGE_KEY } from '../data/adminEventsStorage';
import type { ConcertEvent } from '../types/concertEvent';
import ConcertEventEditForm from '../components/admin/ConcertEventEditForm';
import EventEditModal from '../components/admin/EventEditModal';
import {
  VENUE_MAX_LEN,
  VENUE_OTHER,
  VENUE_PRESETS,
  venueOtherInputValue,
  venueSelectValue,
} from '../utils/concertVenue';

const DEFAULT_CONCERT_IMAGE = '/concert1.jpg';

function migrateStoredEvents(raw: unknown): ConcertEvent[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: ConcertEvent[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const e = item as Partial<ConcertEvent> & { ticketPrice?: number };
    if (!e.id || !e.name) continue;
    const legacy = typeof e.ticketPrice === 'number' ? e.ticketPrice : 0;
    const min = typeof e.ticketPriceMin === 'number' ? e.ticketPriceMin : legacy;
    const max = typeof e.ticketPriceMax === 'number' ? e.ticketPriceMax : legacy;
    out.push({
      id: e.id,
      name: e.name,
      artist: e.artist ?? '',
      genre: e.genre ?? '',
      date: e.date ?? '',
      venue: e.venue ?? '',
      image: e.image ?? DEFAULT_CONCERT_IMAGE,
      capacity: e.capacity ?? 0,
      ticketPriceMin: min,
      ticketPriceMax: max,
      status: e.status ?? 'upcoming',
      published: e.published ?? true,
    });
  }
  return out.length ? out : null;
}

/** Empty `VITE_API_URL` would make fetch(`/api/concerts`) hit Vite (5173) and fail — coerce to real backend URL. */
function resolveBackendBase(): string {
  const v = import.meta.env.VITE_API_URL;
  if (v != null && String(v).trim() !== '') {
    return String(v).trim().replace(/\/$/, '');
  }
  return 'http://localhost:5000';
}

interface ApiConcertRow {
  concertID: number;
  concertName: string;
  artistName: string;
  genre: string;
  date: string;
  venue: string;
  capacity: number;
  ticketPrice: number;
  concertImage: string;
  concertStatus: string;
}

function mapApiRowToConcertEvent(c: ApiConcertRow): ConcertEvent {
  const soldOut = String(c.concertStatus).toLowerCase() === 'sold_out';
  const iso = typeof c.date === 'string' ? c.date : '';
  const dateForInput = iso.length >= 10 ? iso.slice(0, 10) : iso;
  const price = Number(c.ticketPrice);
  const id = c.concertID;
  return {
    id: String(id),
    name: (typeof c.concertName === 'string' && c.concertName.trim()) ? c.concertName.trim() : `Event ${id}`,
    artist: typeof c.artistName === 'string' ? c.artistName : '',
    genre: typeof c.genre === 'string' ? c.genre : '',
    date: dateForInput || iso,
    venue: typeof c.venue === 'string' ? c.venue : '',
    image: typeof c.concertImage === 'string' && c.concertImage.trim() ? c.concertImage.trim() : DEFAULT_CONCERT_IMAGE,
    capacity: Number(c.capacity) || 0,
    ticketPriceMin: Number.isFinite(price) ? price : 0,
    ticketPriceMax: Number.isFinite(price) ? price : 0,
    /* Backend uses open/sold_out; map open → upcoming so “Upcoming” filter matches most catalog rows. */
    status: soldOut ? 'completed' : 'upcoming',
    published: !soldOut,
  };
}

async function fetchConcertsFromBackend(base: string): Promise<ConcertEvent[] | null> {
  const url = `${base}/api/concerts`;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const text = await res.text();
    let data: { concerts?: unknown } = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      return null;
    }
    const list = data.concerts;
    if (!res.ok || !Array.isArray(list) || list.length === 0) {
      return null;
    }
    const mapped = list
      .filter(
        (row): row is ApiConcertRow =>
          row != null &&
          typeof row === 'object' &&
          typeof (row as ApiConcertRow).concertID === 'number',
      )
      .map((row) => mapApiRowToConcertEvent(row));
    return mapped.length > 0 ? mapped : null;
  } catch {
    return null;
  }
}

const DEMO_ADMIN_EVENTS: ConcertEvent[] = [
  {
    id: '1',
    name: 'Summer Rock Festival',
    artist: 'Various Artists',
    genre: 'Rock',
    date: '2026-07-15',
    venue: 'Central Stadium',
    image: '/concert1.jpg',
    capacity: 50000,
    ticketPriceMin: 79.99,
    ticketPriceMax: 99.99,
    status: 'upcoming',
    published: true,
  },
  {
    id: '2',
    name: 'Jazz Night Live',
    artist: 'The Jazz Collective',
    genre: 'Jazz',
    date: '2026-06-20',
    venue: 'Downtown Theater',
    image: '/concert2.jpg',
    capacity: 2500,
    ticketPriceMin: 55,
    ticketPriceMax: 75,
    status: 'active',
    published: true,
  },
  {
    id: '3',
    name: 'Pop Extravaganza',
    artist: 'PopStar',
    genre: 'Pop',
    date: '2026-05-10',
    venue: 'Arena Center',
    image: '/concert3.jpg',
    capacity: 15000,
    ticketPriceMin: 100,
    ticketPriceMax: 140,
    status: 'completed',
    published: false,
  },
];

function getFallbackConcertEvents(): ConcertEvent[] {
  try {
    const raw = localStorage.getItem(ADMIN_EVENTS_STORAGE_KEY);
    if (raw) {
      const migrated = migrateStoredEvents(JSON.parse(raw));
      if (migrated && migrated.length > 0) {
        return migrated;
      }
    }
  } catch {
    /* use demo */
  }
  return DEMO_ADMIN_EVENTS;
}

interface User {
  id: string;
  name: string;
  email: string;
  joinDate: string;
  passType: 'none' | 'silver' | 'gold';
  totalSpent: number;
  status: 'active' | 'suspended' | 'banned';
}

interface ReportData {
  totalUsers: number;
  totalEvents: number;
  totalRevenue: number;
  averageQueueTime: string;
  topGenres: Array<{ name: string; count: number; fill: string }>;
  monthlyRevenue: Array<{ month: string; revenue: number }>;
  userGrowth: Array<{ month: string; users: number }>;
  passDistribution: Array<{ name: string; value: number; fill: string }>;
}

const AdminDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeSection, setActiveSection] = useState<'events' | 'users' | 'reports'>('events');
  const [events, setEvents] = useState<ConcertEvent[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [editingEvent, setEditingEvent] = useState<ConcertEvent | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showAddEventForm, setShowAddEventForm] = useState(false);
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [eventSearchTerm, setEventSearchTerm] = useState('');
  const [eventStatusFilter, setEventStatusFilter] = useState<'all' | ConcertEvent['status']>('all');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | User['status']>('all');

  // Form data for new events
  const [newEvent, setNewEvent] = useState<Omit<ConcertEvent, 'id'>>({
    name: '',
    artist: '',
    genre: '',
    date: '',
    venue: '',
    image: DEFAULT_CONCERT_IMAGE,
    capacity: 0,
    ticketPriceMin: 0,
    ticketPriceMax: 0,
    status: 'upcoming',
    published: false,
  });

  // Form data for new users
  const [newUser, setNewUser] = useState<Omit<User, 'id' | 'joinDate' | 'totalSpent'>>({
    name: '',
    email: '',
    passType: 'none',
    status: 'active'
  });

  useEffect(() => {
    let cancelled = false;

    const mockUsers: User[] = [
      {
        id: '1',
        name: 'John Doe',
        email: 'john.doe@email.com',
        joinDate: '2025-12-01',
        passType: 'gold',
        totalSpent: 850.00,
        status: 'active'
      },
      {
        id: '2',
        name: 'Jane Smith',
        email: 'jane.smith@email.com',
        joinDate: '2026-01-15',
        passType: 'silver',
        totalSpent: 450.00,
        status: 'active'
      },
      {
        id: '3',
        name: 'Mike Johnson',
        email: 'mike.j@email.com',
        joinDate: '2026-01-20',
        passType: 'none',
        totalSpent: 120.00,
        status: 'suspended'
      }
    ];

    const mockReportData: ReportData = {
      totalUsers: 1247,
      totalEvents: 24,
      totalRevenue: 284750,
      averageQueueTime: '23 minutes',
      topGenres: [
        { name: 'Rock', count: 8, fill: '#f59e0b' },
        { name: 'Pop', count: 6, fill: '#10b981' },
        { name: 'Jazz', count: 4, fill: '#6366f1' },
        { name: 'Electronic', count: 3, fill: '#ec4899' },
        { name: 'Classical', count: 3, fill: '#8b5cf6' }
      ],
      monthlyRevenue: [
        { month: 'Jan', revenue: 45000 },
        { month: 'Feb', revenue: 52000 },
        { month: 'Mar', revenue: 48000 },
        { month: 'Apr', revenue: 61000 },
        { month: 'May', revenue: 67000 },
        { month: 'Jun', revenue: 59000 }
      ],
      userGrowth: [
        { month: 'Jan', users: 1100 },
        { month: 'Feb', users: 1150 },
        { month: 'Mar', users: 1180 },
        { month: 'Apr', users: 1210 },
        { month: 'May', users: 1235 },
        { month: 'Jun', users: 1247 }
      ],
      passDistribution: [
        { name: 'None', value: 68, fill: '#9ca3af' },
        { name: 'Silver', value: 22, fill: '#c0c0c0' },
        { name: 'Gold', value: 10, fill: '#ffd700' }
      ]
    };

    async function load() {
      const base = resolveBackendBase();
      const fromApi = await fetchConcertsFromBackend(base);
      if (cancelled) return;
      if (fromApi) {
        setEvents(fromApi);
        setUsers(mockUsers);
        setReportData(mockReportData);
        return;
      }
      setEvents(getFallbackConcertEvents());
      setUsers(mockUsers);
      setReportData(mockReportData);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (events.length === 0) return;
    try {
      localStorage.setItem(ADMIN_EVENTS_STORAGE_KEY, JSON.stringify(events));
    } catch {
      /* ignore */
    }
  }, [events]);

  const handleAddEvent = () => {
    const venueTrimmed = newEvent.venue.trim();
    if (!venueTrimmed || venueTrimmed === VENUE_OTHER) {
      window.alert('Please select a venue or choose Other and enter a venue name.');
      return;
    }
    let min = newEvent.ticketPriceMin;
    let max = newEvent.ticketPriceMax;
    if (min > max) {
      const t = min;
      min = max;
      max = t;
    }
    const event: ConcertEvent = {
      ...newEvent,
      id: Date.now().toString(),
      venue: venueTrimmed.slice(0, VENUE_MAX_LEN),
      ticketPriceMin: min,
      ticketPriceMax: max,
    };
    setEvents([...events, event]);
    setNewEvent({
      name: '',
      artist: '',
      genre: '',
      date: '',
      venue: '',
      image: DEFAULT_CONCERT_IMAGE,
      capacity: 0,
      ticketPriceMin: 0,
      ticketPriceMax: 0,
      status: 'upcoming',
      published: false,
    });
    setShowAddEventForm(false);
  };

  const handleEditEvent = (event: ConcertEvent) => {
    setEditingEvent({ ...event, published: event.published ?? false });
  };

  const handleSaveEvent = () => {
    if (!editingEvent) return;
    const venueTrimmed = editingEvent.venue.trim();
    if (!venueTrimmed || venueTrimmed === VENUE_OTHER) {
      window.alert('Please select a venue or choose Other and enter a venue name.');
      return;
    }
    let min = editingEvent.ticketPriceMin;
    let max = editingEvent.ticketPriceMax;
    if (min > max) {
      const t = min;
      min = max;
      max = t;
    }
    const updated: ConcertEvent = {
      ...editingEvent,
      venue: venueTrimmed.slice(0, VENUE_MAX_LEN),
      ticketPriceMin: min,
      ticketPriceMax: max,
    };
    setEvents(events.map((e) => (e.id === updated.id ? updated : e)));
    setEditingEvent(null);
  };

  const handleDeleteEvent = (id: string) => {
    setEvents(events.filter(e => e.id !== id));
  };

  // User Management Functions
  const handleAddUser = () => {
    const user: User = {
      ...newUser,
      id: Date.now().toString(),
      joinDate: new Date().toISOString().split('T')[0],
      totalSpent: 0
    };
    setUsers([...users, user]);
    setNewUser({
      name: '',
      email: '',
      passType: 'none',
      status: 'active'
    });
    setShowAddUserForm(false);
  };

  const handleEditUser = (user: User) => {
    setEditingUser({ ...user });
  };

  const handleSaveUser = () => {
    if (editingUser) {
      setUsers(users.map(u => u.id === editingUser.id ? editingUser : u));
      setEditingUser(null);
    }
  };

  const handleDeleteUser = (id: string) => {
    setUsers(users.filter(u => u.id !== id));
  };

  const filteredEvents = events.filter((event) => {
    const searchText = eventSearchTerm.toLowerCase();
    const matchesSearch =
      event.name.toLowerCase().includes(searchText) ||
      event.artist.toLowerCase().includes(searchText);
    const matchesStatus = eventStatusFilter === 'all' || event.status === eventStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredUsers = users.filter((currentUser) => {
    const searchText = userSearchTerm.toLowerCase();
    const matchesSearch =
      currentUser.name.toLowerCase().includes(searchText) ||
      currentUser.email.toLowerCase().includes(searchText);
    const matchesStatus = userStatusFilter === 'all' || currentUser.status === userStatusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="admin-header-content">
          <Link to="/home" className="back-link">← Back to Home</Link>
          <h1>Admin Dashboard</h1>
          <button onClick={logout} className="logout-btn">Logout</button>
        </div>
      </header>

      <main className="admin-main">
        <div className="admin-profile">
          <div className="profile-info">
            <h2>Welcome, Admin {user?.name}!</h2>
          </div>
        </div>

        <div className="admin-navigation">
          <button 
            className={`nav-btn ${activeSection === 'events' ? 'active' : ''}`}
            onClick={() => setActiveSection('events')}
          >
            <MdEvent /> Concert Events
          </button>
          <button 
            className={`nav-btn ${activeSection === 'users' ? 'active' : ''}`}
            onClick={() => setActiveSection('users')}
          >
            <MdPeople /> User Management
          </button>
          <button 
            className={`nav-btn ${activeSection === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveSection('reports')}
          >
            <MdAnalytics /> Data Reports
          </button>
        </div>

        {/* Concert Events Section */}
        {activeSection === 'events' && (
          <section className="events-section">
            <div className="section-header">
              <h3>Concert Events Management</h3>
              <button 
                className="add-btn"
                onClick={() => setShowAddEventForm(true)}
              >
                <MdAdd /> Add New Event
              </button>
            </div>

            <div className="section-tools">
              <input
                type="text"
                className="search-input"
                placeholder="Search event or artist..."
                value={eventSearchTerm}
                onChange={(e) => setEventSearchTerm(e.target.value)}
              />
              <select
                className="filter-select"
                value={eventStatusFilter}
                onChange={(e) => setEventStatusFilter(e.target.value as 'all' | ConcertEvent['status'])}
              >
                <option value="all">All Statuses</option>
                <option value="upcoming">Upcoming</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <p className="admin-concert-count-line" aria-live="polite">
              Showing {filteredEvents.length} of {events.length} events
              {eventStatusFilter !== 'all' || eventSearchTerm.trim()
                ? ' (filters applied)'
                : ''}
            </p>

            {showAddEventForm && (
              <div className="add-form">
                <h4>Add New Concert Event</h4>
                <div className="form-grid">
                  <input
                    type="text"
                    placeholder="Event Name"
                    value={newEvent.name}
                    onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="Artist"
                    value={newEvent.artist}
                    onChange={(e) => setNewEvent({ ...newEvent, artist: e.target.value })}
                  />
                  <select
                    value={newEvent.genre}
                    onChange={(e) => setNewEvent({ ...newEvent, genre: e.target.value })}
                  >
                    <option value="">Select Genre</option>
                    <option value="Rock">Rock</option>
                    <option value="Pop">Pop</option>
                    <option value="Jazz">Jazz</option>
                    <option value="Electronic">Electronic</option>
                    <option value="Classical">Classical</option>
                    <option value="Hip-Hop">Hip-Hop</option>
                  </select>
                  <input
                    type="date"
                    value={newEvent.date}
                    onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                  />
                  <div className="form-field-venue">
                    <span className="form-field-label">Venue</span>
                    <select
                      className="form-field-control"
                      value={venueSelectValue(newEvent.venue)}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === VENUE_OTHER) {
                          setNewEvent({ ...newEvent, venue: VENUE_OTHER });
                        } else {
                          setNewEvent({ ...newEvent, venue: v });
                        }
                      }}
                    >
                      <option value="">Select venue</option>
                      {VENUE_PRESETS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                      <option value={VENUE_OTHER}>Other (type below)</option>
                    </select>
                    {venueSelectValue(newEvent.venue) === VENUE_OTHER && (
                      <input
                        type="text"
                        className="venue-other-input"
                        placeholder="Venue name (max 100 characters)"
                        maxLength={VENUE_MAX_LEN}
                        value={venueOtherInputValue(newEvent.venue)}
                        onChange={(e) =>
                          setNewEvent({
                            ...newEvent,
                            venue: e.target.value.slice(0, VENUE_MAX_LEN),
                          })
                        }
                        aria-label="Custom venue name"
                      />
                    )}
                  </div>
                  <input
                    type="number"
                    placeholder="Capacity"
                    value={newEvent.capacity || ''}
                    onChange={(e) => setNewEvent({ ...newEvent, capacity: parseInt(e.target.value, 10) || 0 })}
                  />
                  <div className="form-field-price-range">
                    <span className="form-field-label">Ticket price range ($)</span>
                    <div className="event-price-range-inputs">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        placeholder="Min"
                        value={newEvent.ticketPriceMin || ''}
                        onChange={(e) =>
                          setNewEvent({
                            ...newEvent,
                            ticketPriceMin: parseFloat(e.target.value) || 0,
                          })
                        }
                        aria-label="Minimum ticket price"
                      />
                      <span className="price-range-sep" aria-hidden>
                        to
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        placeholder="Max"
                        value={newEvent.ticketPriceMax || ''}
                        onChange={(e) =>
                          setNewEvent({
                            ...newEvent,
                            ticketPriceMax: parseFloat(e.target.value) || 0,
                          })
                        }
                        aria-label="Maximum ticket price"
                      />
                    </div>
                  </div>
                  <select
                    value={newEvent.status}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, status: e.target.value as ConcertEvent['status'] })
                    }
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <label className="form-publish-option">
                    <input
                      type="checkbox"
                      checked={newEvent.published}
                      onChange={(e) => setNewEvent({ ...newEvent, published: e.target.checked })}
                    />
                    Publish on home page when saved
                  </label>
                </div>
                <div className="form-actions">
                  <button type="button" className="save-btn" onClick={handleAddEvent}>
                    <MdSave /> Save Event
                  </button>
                  <button type="button" className="cancel-btn" onClick={() => setShowAddEventForm(false)}>
                    <MdCancel /> Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="events-list">
              {filteredEvents.map((event) => (
                <div key={event.id} className="event-card">
                  <div className="event-info">
                    <div className="event-info-header">
                      <h4 className="event-title">{event.name}</h4>
                      <div className="event-info-toolbar">
                        <span className={`status-badge ${event.status}`}>{event.status}</span>
                        <span
                          className={`event-publish-badge ${event.published ?? false ? 'is-published' : 'is-draft'}`}
                        >
                          {event.published ?? false ? 'Listed' : 'Not listed'}
                        </span>
                        <div className="event-actions">
                          <button
                            type="button"
                            className="edit-btn"
                            onClick={() => handleEditEvent(event)}
                            aria-label={`Edit ${event.name}`}
                            title="Edit event"
                          >
                            <MdEdit />
                          </button>
                          <button
                            type="button"
                            className="delete-btn"
                            onClick={() => handleDeleteEvent(event.id)}
                            aria-label={`Delete ${event.name}`}
                            title="Delete event"
                          >
                            <MdDelete />
                          </button>
                        </div>
                      </div>
                    </div>
                    <dl className="event-detail-rows">
                      <div className="event-detail-row">
                        <dt>Artist</dt>
                        <dd>{event.artist}</dd>
                      </div>
                      <div className="event-detail-row">
                        <dt>Genre</dt>
                        <dd>{event.genre}</dd>
                      </div>
                      <div className="event-detail-row">
                        <dt>Date</dt>
                        <dd>{new Date(event.date).toLocaleDateString(undefined, { dateStyle: 'long' })}</dd>
                      </div>
                      <div className="event-detail-row">
                        <dt>Venue</dt>
                        <dd>{event.venue}</dd>
                      </div>
                      <div className="event-detail-row">
                        <dt>Capacity</dt>
                        <dd>{event.capacity.toLocaleString()} seats</dd>
                      </div>
                      <div className="event-detail-row">
                        <dt>Ticket price</dt>
                        <dd>
                          ${event.ticketPriceMin.toFixed(2)} – ${event.ticketPriceMax.toFixed(2)}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              ))}
              {filteredEvents.length === 0 && (
                <p className="empty-results">
                  {events.length === 0
                    ? 'No concert events yet. Add one with the button above.'
                    : 'No events match your search or status filter. Try changing the filter to “All Statuses” or clear the search.'}
                </p>
              )}
            </div>

            {editingEvent && (
              <EventEditModal
                open
                title={`Edit event — ${editingEvent.name}`}
                onClose={() => setEditingEvent(null)}
              >
                <ConcertEventEditForm
                  value={editingEvent}
                  onChange={setEditingEvent}
                  onSave={handleSaveEvent}
                  onCancel={() => setEditingEvent(null)}
                />
              </EventEditModal>
            )}
          </section>
        )}

        {/* User Management Section */}
        {activeSection === 'users' && (
          <section className="users-section">
            <div className="section-header">
              <h3>User Management</h3>
              <button 
                className="add-btn"
                onClick={() => setShowAddUserForm(true)}
              >
                <MdAdd /> Add New User
              </button>
            </div>

            <div className="section-tools">
              <input
                type="text"
                className="search-input"
                placeholder="Search user name or email..."
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
              />
              <select
                className="filter-select"
                value={userStatusFilter}
                onChange={(e) => setUserStatusFilter(e.target.value as 'all' | User['status'])}
              >
                <option value="all">All User Statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="banned">Banned</option>
              </select>
            </div>

            {showAddUserForm && (
              <div className="add-form">
                <h4>Add New User</h4>
                <div className="form-grid">
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={newUser.name}
                    onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                  />
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  />
                  <select
                    value={newUser.passType}
                    onChange={(e) => setNewUser({...newUser, passType: e.target.value as User['passType']})}
                  >
                    <option value="none">No Pass</option>
                    <option value="silver">Silver Pass</option>
                    <option value="gold">Gold Pass</option>
                  </select>
                  <select
                    value={newUser.status}
                    onChange={(e) => setNewUser({...newUser, status: e.target.value as User['status']})}
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="banned">Banned</option>
                  </select>
                </div>
                <div className="form-actions">
                  <button className="save-btn" onClick={handleAddUser}>
                    <MdSave /> Save User
                  </button>
                  <button className="cancel-btn" onClick={() => setShowAddUserForm(false)}>
                    <MdCancel /> Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="users-list">
              {filteredUsers.map((user) => (
                <div key={user.id} className="user-card">
                  {editingUser?.id === user.id ? (
                    <div className="edit-form">
                      <div className="form-grid">
                        <input
                          type="text"
                          value={editingUser.name}
                          onChange={(e) => setEditingUser({...editingUser, name: e.target.value})}
                        />
                        <input
                          type="email"
                          value={editingUser.email}
                          onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                        />
                        <select
                          value={editingUser.passType}
                          onChange={(e) => setEditingUser({...editingUser, passType: e.target.value as User['passType']})}
                        >
                          <option value="none">No Pass</option>
                          <option value="silver">Silver Pass</option>
                          <option value="gold">Gold Pass</option>
                        </select>
                        <select
                          value={editingUser.status}
                          onChange={(e) => setEditingUser({...editingUser, status: e.target.value as User['status']})}
                        >
                          <option value="active">Active</option>
                          <option value="suspended">Suspended</option>
                          <option value="banned">Banned</option>
                        </select>
                      </div>
                      <div className="form-actions">
                        <button className="save-btn" onClick={handleSaveUser}>
                          <MdSave /> Save
                        </button>
                        <button className="cancel-btn" onClick={() => setEditingUser(null)}>
                          <MdCancel /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="user-info">
                        <h4>{user.name}</h4>
                        <p><strong>Email:</strong> {user.email}</p>
                        <p><strong>Member Since:</strong> {new Date(user.joinDate).toLocaleDateString()}</p>
                        <p><strong>Pass Type:</strong> <span className={`pass-type ${user.passType}`}>{user.passType}</span></p>
                        <p><strong>Total Spent:</strong> ${user.totalSpent.toFixed(2)}</p>
                        <span className={`status-badge ${user.status}`}>{user.status}</span>
                      </div>
                      <div className="user-actions">
                        <button className="edit-btn" onClick={() => handleEditUser(user)}>
                          <MdEdit />
                        </button>
                        <button className="delete-btn" onClick={() => handleDeleteUser(user.id)}>
                          <MdDelete />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
              {filteredUsers.length === 0 && (
                <p className="empty-results">No users found for your current search/filter.</p>
              )}
            </div>
          </section>
        )}

        {/* Data Reports Section */}
        {activeSection === 'reports' && reportData && (
          <section className="reports-section">
            <h3>Data Reports & Analytics</h3>
            
            {/* Key Metrics */}
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-icon">
                  <MdPeople />
                </div>
                <div className="metric-info">
                  <h4>{reportData.totalUsers.toLocaleString()}</h4>
                  <p>Total Users</p>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-icon">
                  <MdEvent />
                </div>
                <div className="metric-info">
                  <h4>{reportData.totalEvents}</h4>
                  <p>Total Events</p>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-icon">
                  <MdAnalytics />
                </div>
                <div className="metric-info">
                  <h4>${reportData.totalRevenue.toLocaleString()}</h4>
                  <p>Total Revenue</p>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-icon">
                  <MdVisibility />
                </div>
                <div className="metric-info">
                  <h4>{reportData.averageQueueTime}</h4>
                  <p>Avg Queue Time</p>
                </div>
              </div>
            </div>

            {/* Charts Container */}
            <div className="charts-container">
              {/* Genre Distribution */}
              <div className="chart-card">
                <h4>Popular Genres</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={reportData.topGenres}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {reportData.topGenres.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Monthly Revenue */}
              <div className="chart-card">
                <h4>Monthly Revenue Trend</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={reportData.monthlyRevenue}>
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip
                      formatter={(value) => {
                        const numericValue = typeof value === 'number' ? value : Number(value ?? 0);
                        return [`$${numericValue.toLocaleString()}`, 'Revenue'];
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="#6366f1" 
                      strokeWidth={3}
                      dot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* User Growth */}
              <div className="chart-card">
                <h4>User Growth</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={reportData.userGrowth}>
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip
                      formatter={(value) => {
                        const numericValue = typeof value === 'number' ? value : Number(value ?? 0);
                        return [numericValue.toLocaleString(), 'Users'];
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="users" 
                      stroke="#10b981" 
                      strokeWidth={3}
                      dot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Pass Distribution */}
              <div className="chart-card">
                <h4>Pass Type Distribution</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={reportData.passDistribution}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}%`}
                    >
                      {reportData.passDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;