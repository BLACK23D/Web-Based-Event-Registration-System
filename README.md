# Web-Based Event Registration System for University Events

This is a small full-stack university project. Students can view events and register for one. An administrator can log in, create events, change them, delete them, and see who registered.

The project deliberately avoids payments, messages, QR codes, cloud services, and complicated user accounts. This keeps the code easy to read and the system easy to present.

## Main technology

- **React + Vite** displays the pages in the browser.
- **Node.js + Express** receives requests and applies the system rules.
- **SQLite** stores admins, events, and registrations in one local database file.
- **CSS** handles all styling. There is no UI library.

## Project structure

```text
project/
├── server/
│   ├── data/                 # SQLite file is created here automatically
│   ├── database.js           # Creates tables and sample records
│   └── index.js              # Express API and admin authentication
├── src/
│   ├── api.js                # Reusable browser-to-server request helper
│   ├── App.jsx               # Pages, forms, and routes
│   ├── main.jsx              # Starts the React application
│   └── styles.css            # Responsive university-style design
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

## Database explanation

SQLite creates `server/data/events.db` the first time the server starts.

1. `admins` stores the admin username and hashed password.
2. `events` stores the name, description, date, time, and venue.
3. `registrations` stores the student's details and the event ID. The event ID connects each registration to one event.

If an event is deleted, its registrations are deleted too. A student cannot register the same admission number for the same event twice.

## How registration works

1. The student opens the home page and chooses an event.
2. The student enters a full name, email, phone number, and admission number.
3. The browser checks that required fields are filled in.
4. The server checks the values again and saves the registration in SQLite.
5. The page shows `Registration successful.`

## How admin works

The admin signs in and receives a temporary token. Admin API routes require this token. The token expires when the server restarts or after eight hours.

Sample login:

```text
Username: admin
Password: admin123
```

After login, the admin can:

- create an event;
- edit an event;
- delete an event;
- view every event; and
- view the people registered for an event.

## How to run the project

You need Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

For a production-style local run:

```bash
npm run build
npm start
```

Then open `http://localhost:3001`.

To reset the sample database, stop the server, delete `server/data/events.db`, and start it again.

## Sample events

The database starts with:

- Career Readiness Workshop
- Sustainability on Campus
- University Cultural Night

## Simple presentation notes

You can memorize this short explanation:

> My project is a web-based event registration system for university events. React displays the interface, Express handles the application rules, and SQLite stores the data. Students can browse an event and submit their details. The admin can log in, manage events, and see registrations. I kept the project small on purpose so each part is clear, secure enough for a classroom demonstration, and easy to run on one computer.

### Short system flow

```text
Student or Admin → React page → Express API → SQLite database
```

### Important validation

- All fields are required.
- Email and phone formats are checked.
- Only a logged-in admin can change events or view registrations.
- Duplicate admission numbers for one event are rejected.

> Note: The login is intentionally simple for a university demonstration. A public production system should use stronger password hashing, persistent sessions, HTTPS, and login rate limiting.
