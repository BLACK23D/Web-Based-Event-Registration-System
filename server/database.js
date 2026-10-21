import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const dataDirectory = path.join(currentDirectory, 'data');
fs.mkdirSync(dataDirectory, { recursive: true });

const database = new Database(path.join(dataDirectory, 'events.db'));
database.pragma('foreign_keys = ON');
database.pragma('journal_mode = WAL');

database.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    venue TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    admission_number TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    UNIQUE(event_id, admission_number)
  );

  CREATE INDEX IF NOT EXISTS idx_registrations_event_id
  ON registrations(event_id);
`);

const adminCount = database.prepare('SELECT COUNT(*) AS count FROM admins').get().count;
if (adminCount === 0) {
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = crypto.scryptSync('admin123', salt, 64).toString('hex');
  database.prepare('INSERT INTO admins (username, password) VALUES (?, ?)').run(
    'admin',
    `${salt}:${passwordHash}`,
  );
}

const eventCount = database.prepare('SELECT COUNT(*) AS count FROM events').get().count;
if (eventCount === 0) {
  const insertEvent = database.prepare(`
    INSERT INTO events (name, description, date, time, venue)
    VALUES (?, ?, ?, ?, ?)
  `);

  const seedEvents = database.transaction(() => {
    insertEvent.run(
      'Career Readiness Workshop',
      'Learn practical CV, interview, and workplace skills from university career advisors.',
      '2026-11-12',
      '10:00',
      'Main Library, Seminar Room 1',
    );
    insertEvent.run(
      'Sustainability on Campus',
      'Join a student-led discussion about practical ways to make campus more sustainable.',
      '2026-11-18',
      '14:00',
      'Science Building, Lecture Theatre A',
    );
    insertEvent.run(
      'University Cultural Night',
      'Celebrate the cultures and communities that make our university unique.',
      '2026-11-25',
      '18:00',
      'Student Union Hall',
    );
  });

  seedEvents();
}

export default database;
