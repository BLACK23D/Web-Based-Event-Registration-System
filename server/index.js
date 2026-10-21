import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import database from './database.js';

const app = express();
const port = process.env.PORT || 3001;
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const clientDirectory = path.resolve(currentDirectory, '..', 'dist');
const sessions = new Map();

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json({ limit: '20kb' }));

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function passwordMatches(password, storedPassword) {
  const [salt, storedHash] = storedPassword.split(':');
  if (!salt || !storedHash) return false;
  const suppliedHash = crypto.scryptSync(password, salt, 64);
  const expectedHash = Buffer.from(storedHash, 'hex');
  return suppliedHash.length === expectedHash.length && crypto.timingSafeEqual(suppliedHash, expectedHash);
}

function validateEvent(body) {
  const event = {
    name: cleanText(body.name),
    description: cleanText(body.description),
    date: cleanText(body.date),
    time: cleanText(body.time),
    venue: cleanText(body.venue),
  };
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(event.date);
  const validTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(event.time);

  if (Object.values(event).some((value) => !value) || !validDate || !validTime) {
    return { error: 'Complete every event field with a valid date and time.' };
  }
  return { event };
}

function requireAdmin(request, response, next) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
  const expiresAt = token ? sessions.get(token) : null;
  if (!expiresAt || expiresAt < Date.now()) {
    if (token) sessions.delete(token);
    return response.status(401).json({ message: 'Please log in as admin.' });
  }
  next();
}

app.post('/api/admin/login', (request, response) => {
  const username = cleanText(request.body.username);
  const password = cleanText(request.body.password);
  const admin = database.prepare('SELECT * FROM admins WHERE username = ?').get(username);

  if (!admin || !passwordMatches(password, admin.password)) {
    return response.status(401).json({ message: 'Incorrect username or password.' });
  }

  const token = crypto.randomUUID();
  sessions.set(token, Date.now() + 8 * 60 * 60 * 1000);
  response.json({ token });
});

app.post('/api/admin/logout', requireAdmin, (request, response) => {
  const token = request.headers.authorization.replace(/^Bearer\s+/i, '');
  sessions.delete(token);
  response.status(204).end();
});

app.get('/api/events', (_request, response) => {
  const events = database.prepare(`
    SELECT e.*, COUNT(r.id) AS registration_count
    FROM events e
    LEFT JOIN registrations r ON r.event_id = e.id
    GROUP BY e.id
    ORDER BY e.date ASC, e.time ASC
  `).all();
  response.json(events);
});

app.get('/api/events/:id', (request, response) => {
  const event = database.prepare('SELECT * FROM events WHERE id = ?').get(request.params.id);
  if (!event) return response.status(404).json({ message: 'Event not found.' });
  response.json(event);
});

app.post('/api/events/:id/register', (request, response) => {
  const event = database.prepare('SELECT id FROM events WHERE id = ?').get(request.params.id);
  if (!event) return response.status(404).json({ message: 'Event not found.' });

  const registration = {
    fullName: cleanText(request.body.fullName),
    email: cleanText(request.body.email).toLowerCase(),
    phone: cleanText(request.body.phone),
    admissionNumber: cleanText(request.body.admissionNumber).toUpperCase(),
  };
  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registration.email);
  const phoneIsValid = /^[+\d][\d\s-]{6,19}$/.test(registration.phone);

  if (Object.values(registration).some((value) => !value) || !emailIsValid || !phoneIsValid) {
    return response.status(400).json({ message: 'Enter complete and valid registration details.' });
  }

  try {
    database.prepare(`
      INSERT INTO registrations (event_id, full_name, email, phone, admission_number)
      VALUES (?, ?, ?, ?, ?)
    `).run(event.id, registration.fullName, registration.email, registration.phone, registration.admissionNumber);
    response.status(201).json({ message: 'Registration successful.' });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return response.status(409).json({ message: 'This admission number is already registered for this event.' });
    }
    throw error;
  }
});

app.post('/api/admin/events', requireAdmin, (request, response) => {
  const { event, error } = validateEvent(request.body);
  if (error) return response.status(400).json({ message: error });
  const result = database.prepare(`
    INSERT INTO events (name, description, date, time, venue) VALUES (?, ?, ?, ?, ?)
  `).run(event.name, event.description, event.date, event.time, event.venue);
  response.status(201).json({ id: result.lastInsertRowid, ...event });
});

app.put('/api/admin/events/:id', requireAdmin, (request, response) => {
  const { event, error } = validateEvent(request.body);
  if (error) return response.status(400).json({ message: error });
  const result = database.prepare(`
    UPDATE events SET name = ?, description = ?, date = ?, time = ?, venue = ? WHERE id = ?
  `).run(event.name, event.description, event.date, event.time, event.venue, request.params.id);
  if (result.changes === 0) return response.status(404).json({ message: 'Event not found.' });
  response.json({ id: Number(request.params.id), ...event });
});

app.delete('/api/admin/events/:id', requireAdmin, (request, response) => {
  const result = database.prepare('DELETE FROM events WHERE id = ?').run(request.params.id);
  if (result.changes === 0) return response.status(404).json({ message: 'Event not found.' });
  response.status(204).end();
});

app.get('/api/admin/events/:id/registrations', requireAdmin, (request, response) => {
  const event = database.prepare('SELECT id, name FROM events WHERE id = ?').get(request.params.id);
  if (!event) return response.status(404).json({ message: 'Event not found.' });
  const registrations = database.prepare(`
    SELECT id, full_name, email, phone, admission_number, created_at
    FROM registrations WHERE event_id = ? ORDER BY created_at DESC
  `).all(event.id);
  response.json({ event, registrations });
});

app.use(express.static(clientDirectory));
app.get('*', (request, response, next) => {
  if (request.path.startsWith('/api')) return next();
  response.sendFile(path.join(clientDirectory, 'index.html'));
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ message: 'Something went wrong. Please try again.' });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
