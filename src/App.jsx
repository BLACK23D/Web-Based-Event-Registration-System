import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { apiRequest } from './api.js';

const emptyEvent = { name: '', description: '', date: '', time: '', venue: '' };

function formatDate(date) {
  return new Intl.DateTimeFormat('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(`${date}T00:00:00`),
  );
}

function Header({ admin = false, onLogout }) {
  return (
    <header className={admin ? 'site-header admin-header' : 'site-header'}>
      <Link className="brand" to="/">Campus Events</Link>
      <nav aria-label="Main navigation">
        {admin ? (
          <>
            <Link to="/">View site</Link>
            <button className="button button-outline" onClick={onLogout}>Log out</button>
          </>
        ) : (
          <>
            <Link to="/">Events</Link>
            <Link to="/admin/login">Admin login</Link>
          </>
        )}
      </nav>
    </header>
  );
}

function Home() {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest('/events').then(setEvents).catch((requestError) => setError(requestError.message));
  }, []);

  return (
    <>
      <Header />
      <main>
        <section className="hero">
          <div>
            <h1>Find your next<br />campus event.</h1>
            <p>Discover talks, workshops, cultural events and more, all in one place.</p>
          </div>
          <div className="campus-sketch" aria-hidden="true">
            <span className="tower" />
            <span className="building" />
            <span className="tree tree-one" />
            <span className="tree tree-two" />
          </div>
        </section>
        <section className="page-section">
          <h2>Available events</h2>
          {error && <p className="message error">{error}</p>}
          <div className="event-grid">
            {events.map((event) => <EventCard key={event.id} event={event} />)}
          </div>
          {!error && events.length === 0 && <p>No events are available yet.</p>}
        </section>
      </main>
    </>
  );
}

function EventCard({ event }) {
  return (
    <article className="event-card">
      <h3>{event.name}</h3>
      <p className="event-meta"><strong>{formatDate(event.date)}</strong><span>{event.time}</span></p>
      <p className="venue">{event.venue}</p>
      <p>{event.description}</p>
      <Link className="button" to={`/events/${event.id}`}>View event</Link>
    </article>
  );
}

function EventDetails() {
  const eventId = window.location.pathname.split('/').pop();
  const [event, setEvent] = useState(null);
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', admissionNumber: '' });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiRequest(`/events/${eventId}`).then(setEvent).catch((error) => setMessage({ type: 'error', text: error.message }));
  }, [eventId]);

  function updateField(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function submitRegistration(event) {
    event.preventDefault();
    setSubmitting(true);
    setMessage({ type: '', text: '' });
    try {
      const result = await apiRequest(`/events/${eventId}/register`, {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setMessage({ type: 'success', text: result.message });
      setForm({ fullName: '', email: '', phone: '', admissionNumber: '' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Header />
      <main className="narrow-page">
        <Link className="back-link" to="/">← Back to events</Link>
        {event && (
          <>
            <section className="event-heading">
              <h1>{event.name}</h1>
              <p>{event.description}</p>
              <dl className="event-facts">
                <div><dt>Date</dt><dd>{formatDate(event.date)}</dd></div>
                <div><dt>Time</dt><dd>{event.time}</dd></div>
                <div><dt>Venue</dt><dd>{event.venue}</dd></div>
              </dl>
            </section>
            <section className="form-panel">
              <div className="form-intro">
                <h2>Register for this event</h2>
                <p>Fill in your details to reserve your place.</p>
              </div>
              <form onSubmit={submitRegistration}>
                <FormField label="Full name" name="fullName" value={form.fullName} onChange={updateField} />
                <FormField label="Email" name="email" type="email" value={form.email} onChange={updateField} />
                <FormField label="Phone number" name="phone" type="tel" value={form.phone} onChange={updateField} pattern="[+0-9][0-9 \\-]{6,19}" />
                <FormField label="Admission number" name="admissionNumber" value={form.admissionNumber} onChange={updateField} />
                <button className="button" disabled={submitting}>{submitting ? 'Registering…' : 'Register'}</button>
                {message.text && <p className={`message ${message.type}`} role="status">{message.text}</p>}
              </form>
            </section>
          </>
        )}
        {!event && message.text && <p className="message error">{message.text}</p>}
      </main>
    </>
  );
}

function FormField({ label, name, type = 'text', value, onChange, ...props }) {
  return (
    <label>
      <span>{label}</span>
      <input name={name} type={type} value={value} onChange={onChange} required {...props} />
    </label>
  );
}

function AdminLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');

  async function login(event) {
    event.preventDefault();
    setError('');
    try {
      const result = await apiRequest('/admin/login', { method: 'POST', body: JSON.stringify(form) });
      localStorage.setItem('adminToken', result.token);
      navigate('/admin');
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <>
      <Header />
      <main className="login-page">
        <form className="login-card" onSubmit={login}>
          <h1>Admin login</h1>
          <p>Sign in to manage university events.</p>
          <FormField label="Username" name="username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
          <FormField label="Password" name="password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          <button className="button">Log in</button>
          {error && <p className="message error" role="alert">{error}</p>}
        </form>
      </main>
    </>
  );
}

function AdminDashboard() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [editing, setEditing] = useState(null);
  const [registrations, setRegistrations] = useState(null);
  const [error, setError] = useState('');

  function loadEvents() {
    apiRequest('/events').then(setEvents).catch((requestError) => setError(requestError.message));
  }

  useEffect(loadEvents, []);

  async function logout() {
    try { await apiRequest('/admin/logout', { method: 'POST' }); } catch { /* The local token is cleared either way. */ }
    localStorage.removeItem('adminToken');
    navigate('/admin/login');
  }

  async function removeEvent(event) {
    if (!window.confirm(`Delete “${event.name}” and its registrations?`)) return;
    try {
      await apiRequest(`/admin/events/${event.id}`, { method: 'DELETE' });
      loadEvents();
      if (registrations?.event.id === event.id) setRegistrations(null);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function viewRegistrations(event) {
    try {
      setRegistrations(await apiRequest(`/admin/events/${event.id}/registrations`));
    } catch (requestError) {
      if (requestError.message.includes('log in')) {
        localStorage.removeItem('adminToken');
        navigate('/admin/login');
      } else setError(requestError.message);
    }
  }

  return (
    <>
      <Header admin onLogout={logout} />
      <main className="admin-page">
        <div className="page-title-row"><h1>Admin dashboard</h1></div>
        {error && <p className="message error">{error}</p>}
        <section className="admin-panel">
          <div className="panel-heading">
            <h2>Events</h2>
            <button className="button" onClick={() => { setEditing(emptyEvent); setRegistrations(null); }}>Create event</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Event</th><th>Date</th><th>Time</th><th>Venue</th><th>Registrations</th><th>Actions</th></tr></thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td><strong>{event.name}</strong></td><td>{formatDate(event.date)}</td><td>{event.time}</td><td>{event.venue}</td><td>{event.registration_count}</td>
                    <td className="table-actions">
                      <button onClick={() => { setEditing(event); setRegistrations(null); }}>Edit</button>
                      <button onClick={() => { viewRegistrations(event); setEditing(null); }}>View registrations</button>
                      <button className="danger-link" onClick={() => removeEvent(event)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        {editing && <EventEditor event={editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); loadEvents(); }} />}
        {registrations && <RegistrationList data={registrations} onClose={() => setRegistrations(null)} />}
      </main>
    </>
  );
}

function EventEditor({ event, onCancel, onSaved }) {
  const [form, setForm] = useState({ ...event });
  const [error, setError] = useState('');
  const isEditing = Boolean(event.id);

  async function save(submitEvent) {
    submitEvent.preventDefault();
    setError('');
    try {
      await apiRequest(isEditing ? `/admin/events/${event.id}` : '/admin/events', {
        method: isEditing ? 'PUT' : 'POST',
        body: JSON.stringify(form),
      });
      onSaved();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <section className="admin-panel editor-panel">
      <h2>{isEditing ? 'Edit event' : 'Create event'}</h2>
      <form className="event-editor" onSubmit={save}>
        <FormField label="Event name" name="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <label className="description-field"><span>Description</span><textarea name="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required /></label>
        <FormField label="Date" name="date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        <FormField label="Time" name="time" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
        <FormField label="Venue" name="venue" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
        <div className="form-actions"><button className="button">Save event</button><button type="button" className="button button-secondary" onClick={onCancel}>Cancel</button></div>
        {error && <p className="message error">{error}</p>}
      </form>
    </section>
  );
}

function RegistrationList({ data, onClose }) {
  return (
    <section className="admin-panel registrations-panel">
      <div className="panel-heading"><div><h2>Registrations</h2><p>{data.event.name}</p></div><button className="button button-secondary" onClick={onClose}>Close</button></div>
      {data.registrations.length === 0 ? <p>No one has registered for this event yet.</p> : (
        <div className="table-wrap"><table><thead><tr><th>Full name</th><th>Email</th><th>Phone</th><th>Admission number</th><th>Registered</th></tr></thead>
          <tbody>{data.registrations.map((item) => <tr key={item.id}><td>{item.full_name}</td><td>{item.email}</td><td>{item.phone}</td><td>{item.admission_number}</td><td>{new Date(item.created_at.replace(' ', 'T') + 'Z').toLocaleString()}</td></tr>)}</tbody>
        </table></div>
      )}
    </section>
  );
}

function ProtectedAdmin() {
  return localStorage.getItem('adminToken') ? <AdminDashboard /> : <Navigate to="/admin/login" replace />;
}

export default function App() {
  return <Routes><Route path="/" element={<Home />} /><Route path="/events/:id" element={<EventDetails />} /><Route path="/admin/login" element={<AdminLogin />} /><Route path="/admin" element={<ProtectedAdmin />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes>;
}
