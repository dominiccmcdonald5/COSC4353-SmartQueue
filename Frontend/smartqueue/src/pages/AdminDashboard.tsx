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

interface ConcertEvent {
  id: string;
  name: string;
  artist: string;
  genre: string;
  date: string;
  venue: string;
  image: string;
  capacity: number;
  ticketPrice: number;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
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

const DEFAULT_CONCERT_IMAGE = '/concert1.jpg';

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
    ticketPrice: 0,
    status: 'upcoming'
  });

  // Form data for new users
  const [newUser, setNewUser] = useState<Omit<User, 'id' | 'joinDate' | 'totalSpent'>>({
    name: '',
    email: '',
    passType: 'none',
    status: 'active'
  });

  useEffect(() => {
    // TODO: Replace with actual API calls
    // Mock data for demonstration
    const mockEvents: ConcertEvent[] = [
      {
        id: '1',
        name: 'Summer Rock Festival',
        artist: 'Various Artists',
        genre: 'Rock',
        date: '2026-07-15',
        venue: 'Central Stadium',
        image: '/concert1.jpg',
        capacity: 50000,
        ticketPrice: 89.99,
        status: 'upcoming'
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
        ticketPrice: 65.00,
        status: 'active'
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
        ticketPrice: 120.00,
        status: 'completed'
      }
    ];

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

    setEvents(mockEvents);
    setUsers(mockUsers);
    setReportData(mockReportData);
  }, []);

  // Event Management Functions
  const handleAddEvent = () => {
    const event: ConcertEvent = {
      ...newEvent,
      id: Date.now().toString()
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
      ticketPrice: 0,
      status: 'upcoming'
    });
    setShowAddEventForm(false);
  };

  const handleNewEventImageChange = (file: File | null) => {
    if (!file) return;
    const imageUrl = URL.createObjectURL(file);
    setNewEvent({ ...newEvent, image: imageUrl });
  };

  const handleEditingEventImageChange = (file: File | null) => {
    if (!file || !editingEvent) return;
    const imageUrl = URL.createObjectURL(file);
    setEditingEvent({ ...editingEvent, image: imageUrl });
  };

  const handleEditEvent = (event: ConcertEvent) => {
    setEditingEvent({ ...event });
  };

  const handleSaveEvent = () => {
    if (editingEvent) {
      setEvents(events.map(e => e.id === editingEvent.id ? editingEvent : e));
      setEditingEvent(null);
    }
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

            {showAddEventForm && (
              <div className="add-form">
                <h4>Add New Concert Event</h4>
                <div className="form-grid">
                  <input
                    type="text"
                    placeholder="Event Name"
                    value={newEvent.name}
                    onChange={(e) => setNewEvent({...newEvent, name: e.target.value})}
                  />
                  <input
                    type="text"
                    placeholder="Artist"
                    value={newEvent.artist}
                    onChange={(e) => setNewEvent({...newEvent, artist: e.target.value})}
                  />
                  <select
                    value={newEvent.genre}
                    onChange={(e) => setNewEvent({...newEvent, genre: e.target.value})}
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
                    onChange={(e) => setNewEvent({...newEvent, date: e.target.value})}
                  />
                  <input
                    type="text"
                    placeholder="Venue"
                    value={newEvent.venue}
                    onChange={(e) => setNewEvent({...newEvent, venue: e.target.value})}
                  />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleNewEventImageChange(e.target.files?.[0] || null)}
                  />
                  <input
                    type="number"
                    placeholder="Capacity"
                    value={newEvent.capacity || ''}
                    onChange={(e) => setNewEvent({...newEvent, capacity: parseInt(e.target.value) || 0})}
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ticket Price"
                    value={newEvent.ticketPrice || ''}
                    onChange={(e) => setNewEvent({...newEvent, ticketPrice: parseFloat(e.target.value) || 0})}
                  />
                  <select
                    value={newEvent.status}
                    onChange={(e) => setNewEvent({...newEvent, status: e.target.value as ConcertEvent['status']})}
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="form-actions">
                  <button className="save-btn" onClick={handleAddEvent}>
                    <MdSave /> Save Event
                  </button>
                  <button className="cancel-btn" onClick={() => setShowAddEventForm(false)}>
                    <MdCancel /> Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="events-list">
              {filteredEvents.map((event) => (
                <div key={event.id} className="event-card">
                  {editingEvent?.id === event.id ? (
                    <div className="edit-form">
                      <div className="form-grid">
                        <input
                          type="text"
                          value={editingEvent.name}
                          onChange={(e) => setEditingEvent({...editingEvent, name: e.target.value})}
                        />
                        <input
                          type="text"
                          value={editingEvent.artist}
                          onChange={(e) => setEditingEvent({...editingEvent, artist: e.target.value})}
                        />
                        <select
                          value={editingEvent.genre}
                          onChange={(e) => setEditingEvent({...editingEvent, genre: e.target.value})}
                        >
                          <option value="Rock">Rock</option>
                          <option value="Pop">Pop</option>
                          <option value="Jazz">Jazz</option>
                          <option value="Electronic">Electronic</option>
                          <option value="Classical">Classical</option>
                          <option value="Hip-Hop">Hip-Hop</option>
                        </select>
                        <input
                          type="date"
                          value={editingEvent.date}
                          onChange={(e) => setEditingEvent({...editingEvent, date: e.target.value})}
                        />
                        <input
                          type="text"
                          value={editingEvent.venue}
                          onChange={(e) => setEditingEvent({...editingEvent, venue: e.target.value})}
                        />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleEditingEventImageChange(e.target.files?.[0] || null)}
                        />
                        <input
                          type="number"
                          value={editingEvent.capacity}
                          onChange={(e) => setEditingEvent({...editingEvent, capacity: parseInt(e.target.value)})}
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={editingEvent.ticketPrice}
                          onChange={(e) => setEditingEvent({...editingEvent, ticketPrice: parseFloat(e.target.value)})}
                        />
                        <select
                          value={editingEvent.status}
                          onChange={(e) => setEditingEvent({...editingEvent, status: e.target.value as ConcertEvent['status']})}
                        >
                          <option value="upcoming">Upcoming</option>
                          <option value="active">Active</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                      <div className="form-actions">
                        <button className="save-btn" onClick={handleSaveEvent}>
                          <MdSave /> Save
                        </button>
                        <button className="cancel-btn" onClick={() => setEditingEvent(null)}>
                          <MdCancel /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="event-info">
                        <div className="event-top-row">
                          <h4>{event.name}</h4>
                          <img
                            src={event.image || DEFAULT_CONCERT_IMAGE}
                            alt={`${event.name} concert`}
                            className="event-image-preview"
                            onError={(e) => {
                              e.currentTarget.src = DEFAULT_CONCERT_IMAGE;
                            }}
                          />
                        </div>
                        <p><strong>Artist:</strong> {event.artist}</p>
                        <p><strong>Genre:</strong> {event.genre}</p>
                        <p><strong>Date:</strong> {new Date(event.date).toLocaleDateString()}</p>
                        <p><strong>Venue:</strong> {event.venue}</p>
                        <p><strong>Capacity:</strong> {event.capacity.toLocaleString()}</p>
                        <p><strong>Ticket Price:</strong> ${event.ticketPrice.toFixed(2)}</p>
                        <span className={`status-badge ${event.status}`}>{event.status}</span>
                      </div>
                      <div className="event-side">
                        <div className="event-actions">
                          <button className="edit-btn" onClick={() => handleEditEvent(event)}>
                            <MdEdit />
                          </button>
                          <button className="delete-btn" onClick={() => handleDeleteEvent(event.id)}>
                            <MdDelete />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
              {filteredEvents.length === 0 && (
                <p className="empty-results">No events found for your current search/filter.</p>
              )}
            </div>
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