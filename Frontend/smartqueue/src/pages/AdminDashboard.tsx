import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  MdEvent, 
  MdPeople, 
  MdAnalytics, 
  MdTableChart,
  MdAdd, 
  MdEdit, 
  MdDelete, 
  MdSave, 
  MdCancel,
  MdVisibility,
  MdDownload,
} from 'react-icons/md';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Tooltip } from 'recharts';
import '../styling/AdminDashboard.css';
import { ADMIN_EVENTS_STORAGE_KEY } from '../data/adminEventsStorage';
import { CONCERT_ARTIST_MAX_LEN, type ConcertEvent } from '../types/concertEvent';
import ConcertEventEditForm from '../components/admin/ConcertEventEditForm';
import EventEditModal from '../components/admin/EventEditModal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { formatLocalDateFromApi } from '../utils/apiDate';
import {
  VENUE_MAX_LEN,
  VENUE_OTHER,
  VENUE_PRESETS,
  isVenueIncomplete,
  venueOtherInputValue,
  venueSelectValue,
} from '../utils/concertVenue';

type AddRequiredKey = 'name' | 'artist' | 'genre' | 'date' | 'venue' | 'capacity';

const initialAddRequiredEmpty: Record<AddRequiredKey, boolean> = {
  name: false,
  artist: false,
  genre: false,
  date: false,
  venue: false,
  capacity: false,
};

/** Letters A–Z, a–z, and spaces only; other keys are ignored. */
function sanitizeUserNameInput(value: string): string {
  return value.replace(/[^A-Za-z\s]/g, '');
}

/** Digits and at most one decimal point. */
function sanitizeSpentInput(value: string): string {
  let sawDot = false;
  let out = '';
  for (const ch of value) {
    if (ch >= '0' && ch <= '9') out += ch;
    else if (ch === '.' && !sawDot) {
      sawDot = true;
      out += ch;
    }
  }
  return out;
}

function parseSpentForSave(s: string): number | null {
  const t = s.trim();
  if (t === '' || t === '.') return null;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

const DEFAULT_CONCERT_IMAGE = '/concert1.jpg';
const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'https://cosc-4353-smart-queue-6ixj.vercel.app').replace(/\/$/, '');
const LOCAL_API_BASE = 'http://localhost:5000';
const REPORT_API_FALLBACK_BASE = API_BASE === LOCAL_API_BASE ? null : LOCAL_API_BASE;
/** Matches backend admin user API minimum password length. */
const ADMIN_USER_PASSWORD_MIN_LEN = 4;

async function fetchJsonWithOptionalFallback(path: string): Promise<unknown> {
  const primary = await fetch(`${API_BASE}${path}`);
  if (primary.ok) {
    return primary.json();
  }

  if (primary.status === 404 && REPORT_API_FALLBACK_BASE) {
    const fallback = await fetch(`${REPORT_API_FALLBACK_BASE}${path}`);
    if (fallback.ok) {
      return fallback.json();
    }
  }

  throw new Error(`Request failed (${primary.status})`);
}

async function fetchTextWithOptionalFallback(path: string): Promise<string> {
  const primary = await fetch(`${API_BASE}${path}`);
  if (primary.ok) {
    return primary.text();
  }

  if (primary.status === 404 && REPORT_API_FALLBACK_BASE) {
    const fallback = await fetch(`${REPORT_API_FALLBACK_BASE}${path}`);
    if (fallback.ok) {
      return fallback.text();
    }
  }

  throw new Error(`Request failed (${primary.status})`);
}

type PendingDelete =
  | { kind: 'concert'; id: string; title: string }
  | { kind: 'user'; id: string; title: string }
  | null;

// Maps a raw concert record from the backend to a ConcertEvent used by the UI
function mapApiConcert(c: {
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
}): ConcertEvent {
  const soldOut = String(c.concertStatus).toLowerCase() === 'sold_out';
  const price = Number(c.ticketPrice);
  return {
    id: String(c.concertID),
    name: c.concertName || `Event ${c.concertID}`,
    artist: c.artistName || '',
    genre: c.genre || '',
    date: typeof c.date === 'string' && c.date.length >= 10 ? c.date.slice(0, 10) : c.date,
    venue: c.venue || '',
    image: c.concertImage || DEFAULT_CONCERT_IMAGE,
    capacity: Number(c.capacity) || 0,
    ticketPriceMin: Number.isFinite(price) ? price : 0,
    ticketPriceMax: Number.isFinite(price) ? price : 0,
    status: soldOut ? 'completed' : 'upcoming',
    published: !soldOut,
  };
}

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
  firstName: string;
  lastName: string;
  email: string;
  joinDate: string;
  passType: 'none' | 'silver' | 'gold';
  totalSpent: number;
  status: 'active' | 'suspended' | 'banned';
}

/** Add-user form only; API stores first_name / last_name separately */
type AdminNewUserDraft = {
  firstName: string;
  lastName: string;
  email: string;
  passType: User['passType'];
  status: User['status'];
};

const initialAdminNewUser: AdminNewUserDraft = {
  firstName: '',
  lastName: '',
  email: '',
  passType: 'none',
  status: 'active',
};

const DEMO_ADMIN_USERS: User[] = [
  {
    id: '1',
    name: 'John Doe',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@email.com',
    joinDate: '2025-12-01',
    passType: 'gold',
    totalSpent: 850.0,
    status: 'active',
  },
  {
    id: '2',
    name: 'Jane Smith',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane.smith@email.com',
    joinDate: '2026-01-15',
    passType: 'silver',
    totalSpent: 450.0,
    status: 'active',
  },
  {
    id: '3',
    name: 'Mike Johnson',
    firstName: 'Mike',
    lastName: 'Johnson',
    email: 'mike.j@email.com',
    joinDate: '2026-01-20',
    passType: 'none',
    totalSpent: 120.0,
    status: 'suspended',
  },
];

function mapApiUserRow(u: {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  joinDate: string;
  passType: string;
  totalSpent: number;
  status: string;
}): User {
  let first = typeof u.firstName === 'string' ? u.firstName : '';
  let last = typeof u.lastName === 'string' ? u.lastName : '';
  if (!first && !last && typeof u.name === 'string' && u.name.trim()) {
    const parts = u.name.trim().split(/\s+/);
    first = parts[0] || '';
    last = parts.slice(1).join(' ') || '';
  }
  const combined = `${first} ${last}`.trim();
  const name = combined || (typeof u.name === 'string' && u.name.trim() ? u.name.trim() : 'Unknown');
  return {
    id: String(u.id),
    name,
    firstName: first,
    lastName: last,
    email: u.email,
    joinDate: u.joinDate,
    passType: (['none', 'silver', 'gold'].includes(u.passType) ? u.passType : 'none') as User['passType'],
    totalSpent: Number(u.totalSpent) || 0,
    status: (['active', 'suspended', 'banned'].includes(u.status) ? u.status : 'active') as User['status'],
  };
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

interface ApiReportData {
  totalUsers: number;
  totalEvents: number;
  totalRevenue: number;
  averageQueueTime: string;
  topGenres: Array<{ genre: string; count: number }>;
  passDistribution: Array<{ passType: string; count: number; percentage: string }>;
  monthlyRevenueTrend: Array<{ month: string; revenue: number }>;
  userGrowth: Array<{ month: string; newUsers: number; totalUsers: number }>;
}

interface DataReportHistoryEntry {
  historyID: number;
  concertID: number;
  concertName: string;
  status: string;
  inLineStatus: string;
  ticketCount: number;
  totalCost: number;
  waitTimeMinutes: number;
  queuedAt: string | null;
}

interface DataReportUserHistory {
  userID: number;
  customerName: string;
  email: string;
  passStatus: string;
  totalQueues: number;
  completedQueues: number;
  cancelledQueues: number;
  activeQueues: number;
  averageWaitTimeMinutes: number;
  lastQueuedAt: string | null;
  participationHistory: DataReportHistoryEntry[];
}

interface DataReportServiceActivity {
  serviceID: number;
  serviceName: string;
  artistName: string;
  genre: string;
  venue: string;
  scheduledAt: string;
  totalQueueEntries: number;
  usersServed: number;
  activeQueueEntries: number;
  cancelledEntries: number;
  averageWaitTimeMinutes: number;
  totalTicketsProcessed: number;
  revenueFromCompleted: number;
}

interface DataReportQueueUsageStats {
  totalQueueEntries: number;
  usersServed: number;
  activeQueueEntries: number;
  cancelledEntries: number;
  completionRatePercent: number;
  averageWaitTimeMinutes: number;
  averageWaitTimeForServedMinutes: number;
  totalTicketsProcessed: number;
  totalRevenueFromCompleted: number;
  peakQueueHourUtc: string | null;
  peakQueueHourEntryCount: number;
}

interface ApiDataReportDetails {
  usersQueueHistory: DataReportUserHistory[];
  serviceQueueActivity: DataReportServiceActivity[];
  queueUsageStatistics: DataReportQueueUsageStats;
  allQueueHistory: Array<
    DataReportHistoryEntry & {
      userID: number;
      customerName: string;
      email: string;
      genre: string;
      venue: string;
    }
  >;
  recentQueueHistory: Array<DataReportHistoryEntry & { userID: number }>;
  reportGeneratedAt: string;
}

type CsvReportKey = 'users' | 'services' | 'queue-usage';

const AdminDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeSection, setActiveSection] = useState<'events' | 'users' | 'analytics' | 'dataReports'>('events');
  const [events, setEvents] = useState<ConcertEvent[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [dataReportDetails, setDataReportDetails] = useState<ApiDataReportDetails | null>(null);
  const [dataReportLoading, setDataReportLoading] = useState(false);
  const [dataReportError, setDataReportError] = useState<string | null>(null);
  const [exportingReport, setExportingReport] = useState<CsvReportKey | null>(null);
  const [editingEvent, setEditingEvent] = useState<ConcertEvent | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showAddEventForm, setShowAddEventForm] = useState(false);
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [eventSearchTerm, setEventSearchTerm] = useState('');
  const [eventStatusFilter, setEventStatusFilter] = useState<'all' | ConcertEvent['status']>('all');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | User['status']>('all');
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [addRequiredEmpty, setAddRequiredEmpty] =
    useState<Record<AddRequiredKey, boolean>>(initialAddRequiredEmpty);
  const [addEventInvalidArtist, setAddEventInvalidArtist] = useState(false);
  const [addEventInvalidPriceRange, setAddEventInvalidPriceRange] = useState(false);

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
  const [newUser, setNewUser] = useState<AdminNewUserDraft>(initialAdminNewUser);
  const [addUserEmptyFirstName, setAddUserEmptyFirstName] = useState(false);
  const [addUserEmptyEmail, setAddUserEmptyEmail] = useState(false);
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserPasswordConfirm, setNewUserPasswordConfirm] = useState('');
  const [addUserPasswordError, setAddUserPasswordError] = useState<string | null>(null);
  const [userEditSpentStr, setUserEditSpentStr] = useState('');
  const [editUserEmptyFirstName, setEditUserEmptyFirstName] = useState(false);
  const [editUserEmptySpent, setEditUserEmptySpent] = useState(false);
  const [editUserPassword, setEditUserPassword] = useState('');
  const [editUserPasswordConfirm, setEditUserPasswordConfirm] = useState('');
  const [editUserPasswordError, setEditUserPasswordError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/admin/users`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.users) && data.users.length > 0) {
          setUsers(data.users.map(mapApiUserRow));
        } else {
          setUsers(DEMO_ADMIN_USERS);
        }
      })
      .catch(() => setUsers(DEMO_ADMIN_USERS));

    // Fetch concerts from API, fall back to local/demo data on failure
    fetch(`${API_BASE}/api/admin/concerts`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.concerts) && data.concerts.length > 0) {
          setEvents(data.concerts.map(mapApiConcert));
        } else {
          setEvents(getFallbackConcertEvents());
        }
      })
      .catch(() => setEvents(getFallbackConcertEvents()));
  }, []);

  // Fetch analytics report data for the Analytics section.
  useEffect(() => {
    let cancelled = false;
    const fetchReportData = async () => {
      setReportLoading(true);
      setReportError(null);
      try {
        const response = await fetch(`${API_BASE}/api/admin/data-report`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(
            typeof data?.error === 'string' ? data.error : `Report request failed (${response.status})`
          );
        }
        
        if (data.success && data.data) {
          const apiData = data.data as ApiReportData;
          
          // Transform API data to match ReportData interface
          const colors = ['#f59e0b', '#10b981', '#6366f1', '#ec4899', '#8b5cf6'];
          const transformedReport: ReportData = {
            totalUsers: apiData.totalUsers,
            totalEvents: apiData.totalEvents,
            totalRevenue: apiData.totalRevenue,
            averageQueueTime: apiData.averageQueueTime,
            topGenres: apiData.topGenres.map((g, idx) => ({
              name: g.genre,
              count: g.count,
              fill: colors[idx % colors.length]
            })),
            monthlyRevenue: apiData.monthlyRevenueTrend.map(m => ({
              month: m.month,
              revenue: m.revenue
            })),
            userGrowth: apiData.userGrowth.map(u => ({
              month: u.month,
              users: u.totalUsers
            })),
            passDistribution: apiData.passDistribution.map(p => {
              const passMap: Record<string, string> = {
                'None': '#9ca3af',
                'Gold': '#ffd700',
                'Silver': '#c0c0c0'
              };
              return {
                name: p.passType,
                value: Number.parseFloat(p.percentage),
                fill: passMap[p.passType] || '#9ca3af'
              };
            })
          };
          
          setReportData(transformedReport);
        }
      } catch (error) {
        console.error('Error fetching report data:', error);
        if (!cancelled) {
          setReportError(error instanceof Error ? error.message : 'Failed to load report data');
          setReportData(null);
        }
      } finally {
        if (!cancelled) setReportLoading(false);
      }
    };

    fetchReportData();
  }, []);

  useEffect(() => {
    const fetchDataReportDetails = async () => {
      setDataReportLoading(true);
      setDataReportError(null);
      try {
        const data = (await fetchJsonWithOptionalFallback('/api/admin/data-report/details')) as {
          success?: boolean;
          data?: ApiDataReportDetails;
        };
        if (data.success && data.data) {
          setDataReportDetails(data.data);
        } else {
          throw new Error('Failed to fetch detailed reports');
        }
      } catch (error) {
        console.error('Error fetching detailed reports:', error);
        setDataReportError(error instanceof Error ? error.message : 'Failed to load detailed reports');
      } finally {
        setDataReportLoading(false);
      }
    };

    fetchDataReportDetails();
  }, []);

  const handleExportDataReport = async (reportType: CsvReportKey) => {
    setExportingReport(reportType);
    try {
      const csvText = await fetchTextWithOptionalFallback(
        `/api/admin/data-report/export.csv?report=${reportType}`,
      );
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const reportFileMap: Record<CsvReportKey, string> = {
        users: 'users-queue-history-report.csv',
        services: 'service-queue-activity-report.csv',
        'queue-usage': 'queue-usage-statistics-report.csv',
      };

      const link = document.createElement('a');
      const blobUrl = window.URL.createObjectURL(blob);
      link.href = blobUrl;
      link.download = reportFileMap[reportType];
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('CSV export failed:', error);
      window.alert('Failed to export report. Please try again.');
    } finally {
      setExportingReport(null);
    }
  };

  const handleAddEvent = async () => {
    const artistTrim = newEvent.artist.trim();
    const artistEmpty = !artistTrim;
    const artistLenBad = !artistEmpty && newEvent.artist.length > CONCERT_ARTIST_MAX_LEN;
    const min = newEvent.ticketPriceMin;
    const max = newEvent.ticketPriceMax;
    const priceBad = Number.isFinite(min) && Number.isFinite(max) && min > max;

    const nextRequired: Record<AddRequiredKey, boolean> = {
      name: !newEvent.name.trim(),
      artist: artistEmpty,
      genre: !newEvent.genre.trim(),
      date: !newEvent.date,
      venue: isVenueIncomplete(newEvent.venue),
      capacity: !Number.isFinite(newEvent.capacity) || newEvent.capacity < 1,
    };

    setAddRequiredEmpty(nextRequired);
    setAddEventInvalidArtist(artistLenBad);
    setAddEventInvalidPriceRange(priceBad);

    if (Object.values(nextRequired).some(Boolean) || artistLenBad || priceBad) return;

    const venueTrimmed =
      venueSelectValue(newEvent.venue) === VENUE_OTHER
        ? venueOtherInputValue(newEvent.venue).trim()
        : newEvent.venue.trim();

    const body = {
      concertName: newEvent.name.trim(),
      artistName: newEvent.artist.trim(),
      genre: newEvent.genre.trim(),
      date: newEvent.date,
      venue: venueTrimmed.slice(0, VENUE_MAX_LEN),
      capacity: newEvent.capacity,
      ticketPrice: (min + max) / 2,
      concertImage: newEvent.image || DEFAULT_CONCERT_IMAGE,
    };

    try {
      const res = await fetch(`${API_BASE}/api/admin/concerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success && data.concert) {
        setEvents((prev) => [...prev, mapApiConcert(data.concert)]);
      } else {
        window.alert(`Failed to add concert: ${data.errors?.join(', ') || data.message || 'Unknown error'}`);
        return;
      }
    } catch {
      window.alert('Failed to connect to server. Concert not saved.');
      return;
    }

    setNewEvent({
      name: '', artist: '', genre: '', date: '', venue: '',
      image: DEFAULT_CONCERT_IMAGE, capacity: 0,
      ticketPriceMin: 0, ticketPriceMax: 0, status: 'upcoming', published: false,
    });
    setAddRequiredEmpty(initialAddRequiredEmpty);
    setAddEventInvalidArtist(false);
    setAddEventInvalidPriceRange(false);
    setShowAddEventForm(false);
  };

  const handleEditEvent = (event: ConcertEvent) => {
    setEditingEvent({ ...event, published: event.published ?? false });
  };

  const handleSaveEvent = async () => {
    if (!editingEvent) return;
    const venueTrimmed =
      venueSelectValue(editingEvent.venue) === VENUE_OTHER
        ? venueOtherInputValue(editingEvent.venue).trim()
        : editingEvent.venue.trim();
    const min = editingEvent.ticketPriceMin;
    const max = editingEvent.ticketPriceMax;

    const body = {
      concertName: editingEvent.name.trim(),
      artistName: editingEvent.artist.trim(),
      genre: editingEvent.genre.trim(),
      date: editingEvent.date,
      venue: venueTrimmed.slice(0, VENUE_MAX_LEN),
      capacity: editingEvent.capacity,
      ticketPrice: (min + max) / 2,
      concertImage: editingEvent.image || DEFAULT_CONCERT_IMAGE,
      concertStatus: editingEvent.status === 'completed' || editingEvent.status === 'cancelled'
        ? 'sold_out' : 'open',
    };

    try {
      const res = await fetch(`${API_BASE}/api/admin/concerts/${editingEvent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success && data.concert) {
        const updated = mapApiConcert(data.concert);
        setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      } else {
        window.alert(`Failed to save concert: ${data.errors?.join(', ') || data.message || 'Unknown error'}`);
        return;
      }
    } catch {
      window.alert('Failed to connect to server. Changes not saved.');
      return;
    }

    setEditingEvent(null);
  };

  const requestDeleteEvent = (id: string) => {
    const ev = events.find((e) => e.id === id);
    setPendingDelete({
      kind: 'concert',
      id,
      title: ev?.name?.trim() ? ev.name : `Event #${id}`,
    });
  };

  const executeDeleteEvent = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/concerts/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setEvents((prev) => prev.filter((e) => e.id !== id));
      } else {
        window.alert(`Failed to delete concert: ${data.message || 'Unknown error'}`);
      }
    } catch {
      window.alert('Failed to connect to server. Concert not deleted.');
    }
  };

  // User Management Functions
  const handleAddUser = async () => {
    const firstTrim = newUser.firstName.trim();
    const lastTrim = newUser.lastName.trim();
    const emailTrim = newUser.email.trim();
    const firstBad = !firstTrim;
    const emailBad = !emailTrim;
    setAddUserEmptyFirstName(firstBad);
    setAddUserEmptyEmail(emailBad);
    setAddUserPasswordError(null);
    if (firstBad || emailBad) return;

    const pw = newUserPassword;
    const pw2 = newUserPasswordConfirm;
    if (!pw || !pw2) {
      setAddUserPasswordError('Password and confirmation are required.');
      return;
    }
    if (pw.length < ADMIN_USER_PASSWORD_MIN_LEN) {
      setAddUserPasswordError(
        `Password must be at least ${ADMIN_USER_PASSWORD_MIN_LEN} characters.`
      );
      return;
    }
    if (pw !== pw2) {
      setAddUserPasswordError('Passwords do not match.');
      return;
    }

    const body: Record<string, unknown> = {
      firstName: sanitizeUserNameInput(firstTrim),
      lastName: sanitizeUserNameInput(lastTrim),
      email: emailTrim,
      passType: newUser.passType,
      status: newUser.status,
      password: pw,
    };

    try {
      const res = await fetch(`${API_BASE}/api/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success && data.user) {
        setUsers((prev) => [...prev, mapApiUserRow(data.user)]);
      } else {
        window.alert(`Failed to add user: ${data.errors?.join(', ') || data.message || 'Unknown error'}`);
        return;
      }
    } catch {
      window.alert('Failed to connect to server. User not created.');
      return;
    }
    setNewUser(initialAdminNewUser);
    setNewUserPassword('');
    setNewUserPasswordConfirm('');
    setAddUserPasswordError(null);
    setAddUserEmptyFirstName(false);
    setAddUserEmptyEmail(false);
    setShowAddUserForm(false);
  };

  const handleEditUser = (user: User) => {
    setEditingUser({ ...user });
    setUserEditSpentStr(String(user.totalSpent));
    setEditUserEmptyFirstName(false);
    setEditUserEmptySpent(false);
    setEditUserPassword('');
    setEditUserPasswordConfirm('');
    setEditUserPasswordError(null);
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    const firstTrim = sanitizeUserNameInput(editingUser.firstName.trim());
    const lastTrim = sanitizeUserNameInput(editingUser.lastName.trim());
    const spentNum = parseSpentForSave(userEditSpentStr);
    const firstBad = !firstTrim;
    const spentBad = spentNum === null;
    setEditUserEmptyFirstName(firstBad);
    setEditUserEmptySpent(spentBad);
    setEditUserPasswordError(null);
    if (firstBad || spentBad) return;

    const pw = editUserPassword;
    const pw2 = editUserPasswordConfirm;
    if (pw || pw2) {
      if (pw.length < ADMIN_USER_PASSWORD_MIN_LEN) {
        setEditUserPasswordError(
          `Password must be at least ${ADMIN_USER_PASSWORD_MIN_LEN} characters, or leave both fields blank to keep the current password.`
        );
        return;
      }
      if (pw !== pw2) {
        setEditUserPasswordError('Passwords do not match.');
        return;
      }
    }

    const body: Record<string, unknown> = {
      firstName: firstTrim,
      lastName: lastTrim,
      email: editingUser.email.trim(),
      passType: editingUser.passType,
      status: editingUser.status,
      totalSpent: spentNum,
    };
    if (pw.length >= ADMIN_USER_PASSWORD_MIN_LEN && pw === pw2) {
      body.password = pw;
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success && data.user) {
        const updated = mapApiUserRow(data.user);
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      } else {
        window.alert(`Failed to save user: ${data.errors?.join(', ') || data.message || 'Unknown error'}`);
        return;
      }
    } catch {
      window.alert('Failed to connect to server. Changes not saved.');
      return;
    }
    setEditingUser(null);
    setUserEditSpentStr('');
    setEditUserPassword('');
    setEditUserPasswordConfirm('');
    setEditUserPasswordError(null);
  };

  const requestDeleteUser = (id: string) => {
    const u = users.find((x) => x.id === id);
    setPendingDelete({
      kind: 'user',
      id,
      title: u?.name?.trim() ? u.name : `User #${id}`,
    });
  };

  const executeDeleteUser = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setUsers((prev) => prev.filter((x) => x.id !== id));
      } else {
        window.alert(`Failed to delete user: ${data.message || 'Unknown error'}`);
      }
    } catch {
      window.alert('Failed to connect to server. User not deleted.');
    }
  };

  const handleConfirmDelete = () => {
    if (!pendingDelete) return;
    const { kind, id } = pendingDelete;
    setPendingDelete(null);
    if (kind === 'concert') {
      void executeDeleteEvent(id);
    } else {
      void executeDeleteUser(id);
    }
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
            className={`nav-btn ${activeSection === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveSection('analytics')}
          >
            <MdAnalytics /> Analytics
          </button>
          <button 
            className={`nav-btn ${activeSection === 'dataReports' ? 'active' : ''}`}
            onClick={() => setActiveSection('dataReports')}
          >
            <MdTableChart /> Data Reports
          </button>
        </div>

        {/* Concert Events Section */}
        {activeSection === 'events' && (
          <section className="events-section">
            <div className="section-header">
              <h3>Concert Events Management</h3>
              <button
                className="add-btn"
                onClick={() => {
                  setAddRequiredEmpty(initialAddRequiredEmpty);
                  setAddEventInvalidArtist(false);
                  setAddEventInvalidPriceRange(false);
                  setShowAddEventForm(true);
                }}
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
                  <div className="form-field-stacked">
                    <input
                      type="text"
                      placeholder="Event Name"
                      className={addRequiredEmpty.name ? 'is-invalid' : undefined}
                      value={newEvent.name}
                      onChange={(e) => {
                        setAddRequiredEmpty((r) => ({ ...r, name: false }));
                        setNewEvent({ ...newEvent, name: e.target.value });
                      }}
                    />
                    {addRequiredEmpty.name && (
                      <span className="field-inline-error" role="alert">
                        Need to fill
                      </span>
                    )}
                  </div>
                  <div className="form-field-stacked">
                    <input
                      type="text"
                      placeholder="Artist"
                      maxLength={CONCERT_ARTIST_MAX_LEN}
                      className={
                        addRequiredEmpty.artist || addEventInvalidArtist ? 'is-invalid' : undefined
                      }
                      value={newEvent.artist}
                      onChange={(e) => {
                        setAddRequiredEmpty((r) => ({ ...r, artist: false }));
                        setAddEventInvalidArtist(false);
                        setNewEvent({
                          ...newEvent,
                          artist: e.target.value.slice(0, CONCERT_ARTIST_MAX_LEN),
                        });
                      }}
                    />
                    {addRequiredEmpty.artist && (
                      <span className="field-inline-error" role="alert">
                        Need to fill
                      </span>
                    )}
                    {!addRequiredEmpty.artist && addEventInvalidArtist && (
                      <span className="field-inline-error" role="alert">
                        Not valid
                      </span>
                    )}
                  </div>
                  <div className="form-field-stacked">
                    <select
                      className={addRequiredEmpty.genre ? 'is-invalid' : undefined}
                      value={newEvent.genre}
                      onChange={(e) => {
                        setAddRequiredEmpty((r) => ({ ...r, genre: false }));
                        setNewEvent({ ...newEvent, genre: e.target.value });
                      }}
                    >
                      <option value="">Select Genre</option>
                      <option value="Rock">Rock</option>
                      <option value="Pop">Pop</option>
                      <option value="Jazz">Jazz</option>
                      <option value="Electronic">Electronic</option>
                      <option value="Classical">Classical</option>
                      <option value="Hip-Hop">Hip-Hop</option>
                    </select>
                    {addRequiredEmpty.genre && (
                      <span className="field-inline-error" role="alert">
                        Need to fill
                      </span>
                    )}
                  </div>
                  <div className="form-field-stacked">
                    <input
                      type="date"
                      className={addRequiredEmpty.date ? 'is-invalid' : undefined}
                      value={newEvent.date}
                      onChange={(e) => {
                        setAddRequiredEmpty((r) => ({ ...r, date: false }));
                        setNewEvent({ ...newEvent, date: e.target.value });
                      }}
                    />
                    {addRequiredEmpty.date && (
                      <span className="field-inline-error" role="alert">
                        Need to fill
                      </span>
                    )}
                  </div>
                  <div className="form-field-venue">
                    <span className="form-field-label">Venue</span>
                    <select
                      className={`form-field-control${addRequiredEmpty.venue ? ' is-invalid' : ''}`}
                      value={venueSelectValue(newEvent.venue)}
                      onChange={(e) => {
                        setAddRequiredEmpty((r) => ({ ...r, venue: false }));
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
                        className={`venue-other-input${addRequiredEmpty.venue ? ' is-invalid' : ''}`}
                        placeholder="Venue name (max 100 characters)"
                        maxLength={VENUE_MAX_LEN}
                        value={venueOtherInputValue(newEvent.venue)}
                        onChange={(e) => {
                          setAddRequiredEmpty((r) => ({ ...r, venue: false }));
                          setNewEvent({
                            ...newEvent,
                            venue: e.target.value.slice(0, VENUE_MAX_LEN),
                          });
                        }}
                        aria-label="Custom venue name"
                      />
                    )}
                    {addRequiredEmpty.venue && (
                      <span className="field-inline-error" role="alert">
                        Need to fill
                      </span>
                    )}
                  </div>
                  <div className="form-field-stacked">
                    <input
                      type="number"
                      placeholder="Capacity"
                      min={0}
                      className={addRequiredEmpty.capacity ? 'is-invalid' : undefined}
                      value={newEvent.capacity || ''}
                      onChange={(e) => {
                        setAddRequiredEmpty((r) => ({ ...r, capacity: false }));
                        setNewEvent({ ...newEvent, capacity: parseInt(e.target.value, 10) || 0 });
                      }}
                    />
                    {addRequiredEmpty.capacity && (
                      <span className="field-inline-error" role="alert">
                        Need to fill
                      </span>
                    )}
                  </div>
                  <div className="form-field-price-range">
                    <span className="form-field-label">Ticket price range ($)</span>
                    <div className="event-price-range-inputs">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        placeholder="Min"
                        className={addEventInvalidPriceRange ? 'is-invalid' : undefined}
                        value={newEvent.ticketPriceMin || ''}
                        onChange={(e) => {
                          setAddEventInvalidPriceRange(false);
                          setNewEvent({
                            ...newEvent,
                            ticketPriceMin: parseFloat(e.target.value) || 0,
                          });
                        }}
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
                        className={addEventInvalidPriceRange ? 'is-invalid' : undefined}
                        value={newEvent.ticketPriceMax || ''}
                        onChange={(e) => {
                          setAddEventInvalidPriceRange(false);
                          setNewEvent({
                            ...newEvent,
                            ticketPriceMax: parseFloat(e.target.value) || 0,
                          });
                        }}
                        aria-label="Maximum ticket price"
                      />
                    </div>
                    {addEventInvalidPriceRange && (
                      <span className="field-inline-error" role="alert">
                        Not valid
                      </span>
                    )}
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
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={() => {
                      setAddRequiredEmpty(initialAddRequiredEmpty);
                      setAddEventInvalidArtist(false);
                      setAddEventInvalidPriceRange(false);
                      setShowAddEventForm(false);
                    }}
                  >
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
                            onClick={() => requestDeleteEvent(event.id)}
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
                        <dd>{formatLocalDateFromApi(event.date, { dateStyle: 'long' })}</dd>
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
                onClick={() => {
                  setNewUser(initialAdminNewUser);
                  setAddUserEmptyFirstName(false);
                  setAddUserEmptyEmail(false);
                  setNewUserPassword('');
                  setNewUserPasswordConfirm('');
                  setAddUserPasswordError(null);
                  setShowAddUserForm(true);
                }}
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
                  <div className="form-field-stacked">
                    <input
                      type="text"
                      placeholder="First name"
                      autoComplete="given-name"
                      className={addUserEmptyFirstName ? 'is-invalid' : undefined}
                      value={newUser.firstName}
                      onChange={(e) => {
                        setAddUserEmptyFirstName(false);
                        setNewUser({
                          ...newUser,
                          firstName: sanitizeUserNameInput(e.target.value),
                        });
                      }}
                    />
                    {addUserEmptyFirstName && (
                      <span className="field-inline-error" role="alert">
                        Need to fill
                      </span>
                    )}
                  </div>
                  <div className="form-field-stacked">
                    <input
                      type="text"
                      placeholder="Last name"
                      autoComplete="family-name"
                      value={newUser.lastName}
                      onChange={(e) =>
                        setNewUser({
                          ...newUser,
                          lastName: sanitizeUserNameInput(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="form-field-stacked">
                    <input
                      type="email"
                      placeholder="Email Address"
                      className={addUserEmptyEmail ? 'is-invalid' : undefined}
                      value={newUser.email}
                      onChange={(e) => {
                        setAddUserEmptyEmail(false);
                        setNewUser({ ...newUser, email: e.target.value });
                      }}
                    />
                    {addUserEmptyEmail && (
                      <span className="field-inline-error" role="alert">
                        Need to fill
                      </span>
                    )}
                  </div>
                  <div className="form-field-stacked form-field-stacked--full-row">
                    <input
                      type="password"
                      autoComplete="new-password"
                      placeholder={`Login password (required, min ${ADMIN_USER_PASSWORD_MIN_LEN} chars)`}
                      className={addUserPasswordError ? 'is-invalid' : undefined}
                      value={newUserPassword}
                      onChange={(e) => {
                        setAddUserPasswordError(null);
                        setNewUserPassword(e.target.value);
                      }}
                    />
                  </div>
                  <div className="form-field-stacked form-field-stacked--full-row">
                    <input
                      type="password"
                      autoComplete="new-password"
                      placeholder="Confirm password (required)"
                      className={addUserPasswordError ? 'is-invalid' : undefined}
                      value={newUserPasswordConfirm}
                      onChange={(e) => {
                        setAddUserPasswordError(null);
                        setNewUserPasswordConfirm(e.target.value);
                      }}
                    />
                    {addUserPasswordError && (
                      <span className="field-inline-error" role="alert">
                        {addUserPasswordError}
                      </span>
                    )}
                  </div>
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
                  <button
                    className="cancel-btn"
                    onClick={() => {
                      setNewUser(initialAdminNewUser);
                      setAddUserEmptyFirstName(false);
                      setAddUserEmptyEmail(false);
                      setNewUserPassword('');
                      setNewUserPasswordConfirm('');
                      setAddUserPasswordError(null);
                      setShowAddUserForm(false);
                    }}
                  >
                    <MdCancel /> Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="users-table-wrap">
              <table className="admin-users-table">
                {!editingUser && (
                  <thead>
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">Email</th>
                      <th scope="col">Joined</th>
                      <th scope="col">Pass</th>
                      <th scope="col">Spent</th>
                      <th scope="col">Status</th>
                      <th scope="col" className="admin-users-table-actions">
                        Actions
                      </th>
                    </tr>
                  </thead>
                )}
                <tbody>
                  {filteredUsers.map((user) =>
                    editingUser?.id === user.id ? (
                      <tr key={user.id} className="admin-users-table-row is-editing">
                        <td colSpan={7}>
                          <div className="admin-users-edit-panel">
                            <div className="admin-users-edit-panel-grid admin-users-edit-panel-grid--names">
                              <div className="admin-users-edit-field">
                                <label htmlFor={`edit-user-first-${editingUser.id}`}>First name</label>
                                <input
                                  id={`edit-user-first-${editingUser.id}`}
                                  type="text"
                                  autoComplete="given-name"
                                  placeholder="First name"
                                  className={editUserEmptyFirstName ? 'is-invalid' : undefined}
                                  value={editingUser.firstName}
                                  onChange={(e) => {
                                    setEditUserEmptyFirstName(false);
                                    const v = sanitizeUserNameInput(e.target.value);
                                    setEditingUser({
                                      ...editingUser,
                                      firstName: v,
                                      name: `${v} ${editingUser.lastName}`.trim(),
                                    });
                                  }}
                                />
                                {editUserEmptyFirstName && (
                                  <span className="field-inline-error" role="alert">
                                    Need to fill
                                  </span>
                                )}
                              </div>
                              <div className="admin-users-edit-field">
                                <label htmlFor={`edit-user-last-${editingUser.id}`}>Last name</label>
                                <input
                                  id={`edit-user-last-${editingUser.id}`}
                                  type="text"
                                  autoComplete="family-name"
                                  placeholder="Last name"
                                  value={editingUser.lastName}
                                  onChange={(e) => {
                                    const v = sanitizeUserNameInput(e.target.value);
                                    setEditingUser({
                                      ...editingUser,
                                      lastName: v,
                                      name: `${editingUser.firstName} ${v}`.trim(),
                                    });
                                  }}
                                />
                              </div>
                              <div className="admin-users-edit-field admin-users-edit-field--grow">
                                <label htmlFor={`edit-user-email-${editingUser.id}`}>Email</label>
                                <input
                                  id={`edit-user-email-${editingUser.id}`}
                                  type="email"
                                  autoComplete="email"
                                  placeholder="Email"
                                  value={editingUser.email}
                                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                                />
                              </div>
                            </div>
                            <div className="admin-users-edit-panel-grid admin-users-edit-panel-grid--meta">
                              <div className="admin-users-edit-field">
                                <span className="admin-users-edit-readonly-label">Joined</span>
                                <span className="admin-users-edit-readonly-value">
                                  {formatLocalDateFromApi(editingUser.joinDate, { dateStyle: 'medium' })}
                                </span>
                              </div>
                              <div className="admin-users-edit-field">
                                <label htmlFor={`edit-user-pass-${editingUser.id}`}>Pass</label>
                                <select
                                  id={`edit-user-pass-${editingUser.id}`}
                                  value={editingUser.passType}
                                  onChange={(e) =>
                                    setEditingUser({
                                      ...editingUser,
                                      passType: e.target.value as User['passType'],
                                    })
                                  }
                                >
                                  <option value="none">None</option>
                                  <option value="silver">Silver</option>
                                  <option value="gold">Gold</option>
                                </select>
                              </div>
                              <div className="admin-users-edit-field">
                                <label htmlFor={`edit-user-spent-${editingUser.id}`}>Total spent</label>
                                <input
                                  id={`edit-user-spent-${editingUser.id}`}
                                  type="text"
                                  inputMode="decimal"
                                  autoComplete="off"
                                  placeholder="0.00"
                                  className={`admin-users-spent-input${editUserEmptySpent ? ' is-invalid' : ''}`}
                                  value={userEditSpentStr}
                                  onChange={(e) => {
                                    setEditUserEmptySpent(false);
                                    setUserEditSpentStr(sanitizeSpentInput(e.target.value));
                                  }}
                                />
                                {editUserEmptySpent && (
                                  <span className="field-inline-error" role="alert">
                                    Need to fill
                                  </span>
                                )}
                              </div>
                              <div className="admin-users-edit-field">
                                <label htmlFor={`edit-user-status-${editingUser.id}`}>Status</label>
                                <select
                                  id={`edit-user-status-${editingUser.id}`}
                                  value={editingUser.status}
                                  onChange={(e) =>
                                    setEditingUser({
                                      ...editingUser,
                                      status: e.target.value as User['status'],
                                    })
                                  }
                                >
                                  <option value="active">Active</option>
                                  <option value="suspended">Suspended</option>
                                  <option value="banned">Banned</option>
                                </select>
                              </div>
                            </div>
                            <div className="admin-users-edit-password-block">
                              <span className="admin-user-password-label">New login password</span>
                              <div className="admin-user-password-fields">
                                <input
                                  type="password"
                                  autoComplete="new-password"
                                  aria-label="New password"
                                  placeholder={`Min ${ADMIN_USER_PASSWORD_MIN_LEN} characters`}
                                  value={editUserPassword}
                                  onChange={(e) => {
                                    setEditUserPasswordError(null);
                                    setEditUserPassword(e.target.value);
                                  }}
                                />
                                <input
                                  type="password"
                                  autoComplete="new-password"
                                  aria-label="Confirm new password"
                                  placeholder="Confirm password"
                                  value={editUserPasswordConfirm}
                                  onChange={(e) => {
                                    setEditUserPasswordError(null);
                                    setEditUserPasswordConfirm(e.target.value);
                                  }}
                                />
                              </div>
                              {editUserPasswordError && (
                                <span className="field-inline-error" role="alert">
                                  {editUserPasswordError}
                                </span>
                              )}
                            </div>
                            <div className="admin-users-edit-actions">
                              <button type="button" className="save-btn" onClick={() => void handleSaveUser()}>
                                <MdSave /> Save changes
                              </button>
                              <button
                                type="button"
                                className="cancel-btn"
                                onClick={() => {
                                  setEditingUser(null);
                                  setUserEditSpentStr('');
                                  setEditUserEmptyFirstName(false);
                                  setEditUserEmptySpent(false);
                                  setEditUserPassword('');
                                  setEditUserPasswordConfirm('');
                                  setEditUserPasswordError(null);
                                }}
                              >
                                <MdCancel /> Cancel
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={user.id} className="admin-users-table-row">
                        <td className="admin-users-table-strong">{user.name}</td>
                        <td>{user.email}</td>
                        <td className="admin-users-table-muted">{new Date(user.joinDate).toLocaleDateString()}</td>
                        <td>
                          <span className={`pass-type pass-type--pill ${user.passType}`}>{user.passType}</span>
                        </td>
                        <td>${user.totalSpent.toFixed(2)}</td>
                        <td>
                          <span className={`status-badge status-badge--table ${user.status}`}>{user.status}</span>
                        </td>
                        <td className="admin-users-table-actions">
                          <button type="button" className="edit-btn" onClick={() => handleEditUser(user)} aria-label={`Edit ${user.name}`} title="Edit">
                            <MdEdit />
                          </button>
                          <button type="button" className="delete-btn" onClick={() => requestDeleteUser(user.id)} aria-label={`Delete ${user.name}`} title="Delete">
                            <MdDelete />
                          </button>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
              {filteredUsers.length === 0 && (
                <p className="empty-results empty-results--users-table">No users found for your current search/filter.</p>
              )}
            </div>
          </section>
        )}

        {/* Analytics Section */}
        {activeSection === 'analytics' && (
          <section className="reports-section">
            <h3>Analytics Overview</h3>
            
            {reportLoading && (
              <div className="loading-state">
                <p>Loading report data...</p>
              </div>
            )}
            
            {reportError && (
              <div className="error-state">
                <p>Error: {reportError}</p>
              </div>
            )}
            
            {reportData && (
              <>
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
                          nameKey="name"
                          label={({ name, percent }) =>
                            `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`
                          }
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
              </>
            )}
          </section>
        )}

        {/* Data Reports Section */}
        {activeSection === 'dataReports' && (
          <section className="reports-section data-reports-section">
            <div className="section-header section-header--reports">
              <h3>Data Reports</h3>
              <p className="reports-subtitle">
                Generate operational reports for user queue participation, service activity, and queue usage statistics.
              </p>
            </div>

            {dataReportLoading && (
              <div className="loading-state">
                <p>Loading detailed report data...</p>
              </div>
            )}

            {dataReportError && (
              <div className="error-state">
                <p>Error: {dataReportError}</p>
              </div>
            )}

            {dataReportDetails && (
              <>
                <div className="report-export-actions">
                  <button
                    type="button"
                    className="add-btn"
                    onClick={() => void handleExportDataReport('users')}
                    disabled={exportingReport !== null}
                  >
                    <MdDownload />
                    {exportingReport === 'users' ? 'Exporting...' : 'Export Users Report (CSV)'}
                  </button>
                  <button
                    type="button"
                    className="add-btn"
                    onClick={() => void handleExportDataReport('services')}
                    disabled={exportingReport !== null}
                  >
                    <MdDownload />
                    {exportingReport === 'services' ? 'Exporting...' : 'Export Services Report (CSV)'}
                  </button>
                  <button
                    type="button"
                    className="add-btn"
                    onClick={() => void handleExportDataReport('queue-usage')}
                    disabled={exportingReport !== null}
                  >
                    <MdDownload />
                    {exportingReport === 'queue-usage' ? 'Exporting...' : 'Export Queue Stats (CSV)'}
                  </button>
                </div>

                <div className="report-block">
                  <h4>Users Data Report</h4>
                  <div className="admin-users-table-wrap">
                    <table className="admin-users-table">
                      <thead>
                        <tr>
                          <th>Customer</th>
                          <th>Email</th>
                          <th>Total Queues</th>
                          <th>Completed</th>
                          <th>Cancelled</th>
                          <th>Active</th>
                          <th>Avg Wait (Min)</th>
                          <th>Last Queue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dataReportDetails.usersQueueHistory.slice(0, 25).map((userRow) => (
                          <tr key={userRow.userID} className="admin-users-table-row">
                            <td className="admin-users-table-strong">{userRow.customerName}</td>
                            <td>{userRow.email}</td>
                            <td>{userRow.totalQueues}</td>
                            <td>{userRow.completedQueues}</td>
                            <td>{userRow.cancelledQueues}</td>
                            <td>{userRow.activeQueues}</td>
                            <td>{userRow.averageWaitTimeMinutes.toFixed(2)}</td>
                            <td>
                              {userRow.lastQueuedAt
                                ? new Date(userRow.lastQueuedAt).toLocaleString()
                                : 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="report-note">
                    Showing first 25 users. Export CSV for full participation history.
                  </p>
                </div>

                <div className="report-block">
                  <h4>Concert Queue Data Report</h4>
                  <div className="admin-users-table-wrap">
                    <table className="admin-users-table">
                      <thead>
                        <tr>
                          <th>Service/Event</th>
                          <th>Genre</th>
                          <th>Venue</th>
                          <th>Queue Entries</th>
                          <th>Users Served</th>
                          <th>Active</th>
                          <th>Cancelled</th>
                          <th>Avg Wait (Min)</th>
                          <th>Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dataReportDetails.serviceQueueActivity.slice(0, 25).map((serviceRow) => (
                          <tr key={serviceRow.serviceID} className="admin-users-table-row">
                            <td className="admin-users-table-strong">{serviceRow.serviceName}</td>
                            <td>{serviceRow.genre}</td>
                            <td>{serviceRow.venue}</td>
                            <td>{serviceRow.totalQueueEntries}</td>
                            <td>{serviceRow.usersServed}</td>
                            <td>{serviceRow.activeQueueEntries}</td>
                            <td>{serviceRow.cancelledEntries}</td>
                            <td>{serviceRow.averageWaitTimeMinutes.toFixed(2)}</td>
                            <td>${serviceRow.revenueFromCompleted.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="report-block">
                  <h4>Queue Usage Statistics Data Report</h4>
                  <div className="metrics-grid">
                    <div className="metric-card">
                      <div className="metric-icon">
                        <MdPeople />
                      </div>
                      <div className="metric-info">
                        <h4>{dataReportDetails.queueUsageStatistics.usersServed.toLocaleString()}</h4>
                        <p>Users Served</p>
                      </div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-icon">
                        <MdVisibility />
                      </div>
                      <div className="metric-info">
                        <h4>{dataReportDetails.queueUsageStatistics.averageWaitTimeMinutes.toFixed(2)} min</h4>
                        <p>Average Wait Time</p>
                      </div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-icon">
                        <MdAnalytics />
                      </div>
                      <div className="metric-info">
                        <h4>{dataReportDetails.queueUsageStatistics.completionRatePercent.toFixed(2)}%</h4>
                        <p>Completion Rate</p>
                      </div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-icon">
                        <MdEvent />
                      </div>
                      <div className="metric-info">
                        <h4>{dataReportDetails.queueUsageStatistics.totalQueueEntries.toLocaleString()}</h4>
                        <p>Total Queue Entries</p>
                      </div>
                    </div>
                  </div>

                  <div className="admin-users-table-wrap">
                    <table className="admin-users-table">
                      <thead>
                        <tr>
                          <th>History ID</th>
                          <th>Customer</th>
                          <th>Event</th>
                          <th>Status</th>
                          <th>In-Line</th>
                          <th>Tickets</th>
                          <th>Wait (Min)</th>
                          <th>Total Cost</th>
                          <th>Queued At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dataReportDetails.allQueueHistory.slice(0, 60).map((queueRow) => (
                          <tr key={queueRow.historyID} className="admin-users-table-row">
                            <td>{queueRow.historyID}</td>
                            <td className="admin-users-table-strong">{queueRow.customerName}</td>
                            <td>{queueRow.concertName}</td>
                            <td>{queueRow.status}</td>
                            <td>{queueRow.inLineStatus}</td>
                            <td>{queueRow.ticketCount}</td>
                            <td>{queueRow.waitTimeMinutes}</td>
                            <td>${queueRow.totalCost.toLocaleString()}</td>
                            <td>{queueRow.queuedAt ? new Date(queueRow.queuedAt).toLocaleString() : 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="report-note">
                    Showing first 60 queue entries. Export Queue Stats (CSV) now includes all queue usage rows.
                  </p>
                </div>
              </>
            )}
          </section>
        )}
      </main>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={
          pendingDelete?.kind === 'concert'
            ? 'Delete concert?'
            : pendingDelete?.kind === 'user'
              ? 'Delete user?'
              : ''
        }
        message={
          pendingDelete?.kind === 'concert' ? (
            <p>
              Remove <strong>{pendingDelete.title}</strong> from the catalog? This cannot be undone.
            </p>
          ) : pendingDelete?.kind === 'user' ? (
            <p>
              Remove <strong>{pendingDelete.title}</strong>? Their queue history will be removed as well.
            </p>
          ) : null
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmVariant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};

export default AdminDashboard;
