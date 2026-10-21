# Web-Based Event Registration System for University Events

This is a small full-stack university project. Students can view events and register for one. An administrator can log in, create events, change them, delete them, and see who registered.

The project deliberately avoids payments, messages, QR codes, third-party APIs, and complicated user accounts. The classroom version runs completely on one computer. The hosted demo uses Vercel and Supabase only so its data remains available online.

## Main technology

- **React + Vite** displays the pages in the browser.
- **Node.js + Express** receives requests and applies the system rules.
- **SQLite** stores admins, events, and registrations in one local database file.
- **Supabase PostgreSQL** stores the same three tables in the hosted demo.
- **Vercel** hosts the React site and its small production API.
- **CSS** handles all styling. There is no UI library.

## Project structure

```text
project/
├── api/
│   └── index.js              # Vercel production API
├── server/
│   ├── data/                 # SQLite file is created here automatically
│   ├── database.js           # Creates tables and sample records
│   └── index.js              # Express API and admin authentication
├── src/
│   ├── api.js                # Reusable browser-to-server request helper
│   ├── App.jsx               # Pages, forms, and routes
│   ├── main.jsx              # Starts the React application
│   └── styles.css            # Responsive university-style design
├── supabase/
│   └── migrations/           # Hosted database schema and sample data
├── .env.example              # Names of production settings (no secrets)
├── index.html
├── package.json
├── vercel.json               # Vercel build and route settings
├── vite.config.js
└── README.md
```

## Database explanation

SQLite creates `server/data/events.db` the first time the local server starts. The hosted version uses the same table design in Supabase PostgreSQL.

1. `admins` stores the admin username and hashed password.
2. `events` stores the name, description, date, time, and venue.
3. `registrations` stores the student's details and the event ID. The event ID connects each registration to one event.

If an event is deleted, its registrations are deleted too. A student cannot register the same admission number for the same event twice.

## How registration works

1. The student opens the home page and chooses an event.
2. The student enters a full name, email, phone number, and admission number.
3. The browser checks that required fields are filled in.
4. The server checks the values again and saves the registration in SQLite locally or Supabase when hosted.
5. The page shows `Registration successful.`

## How admin works

The admin signs in and receives a temporary token. Admin API routes require this token. It lasts for eight hours. The hosted API signs the token so it works safely across Vercel serverless requests.

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

## Hosted version

The live version uses the same React pages and form rules. Vercel runs the production API, while Supabase stores the three database tables. Production secrets are saved in Vercel and are never committed to GitHub.

The required Vercel settings are listed in `.env.example`:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `API_BACKEND_SECRET`
- `ADMIN_SESSION_SECRET`

The SQL file in `supabase/migrations` creates the tables, validation constraints, secure database functions, sample admin, and sample events. Row Level Security blocks direct table access; the public site can only use the small set of functions it needs.

## Sample events

The database starts with:

- Career Readiness Workshop
- Sustainability on Campus
- University Cultural Night

## Simple presentation notes

You can memorize this short explanation:

> My project is a web-based event registration system for university events. React displays the interface, Express handles the local application rules, and SQLite stores local data. Students can browse an event and submit their details. The admin can log in, manage events, and see registrations. The online demo uses Vercel and Supabase, but the features stay exactly the same. I kept the project small so I can explain every part clearly.

### Short system flow

```text
Student or Admin → React page → Express API → SQLite database
```

For the hosted demo:

```text
Student or Admin → React on Vercel → Vercel API → Supabase database
```

### Important validation

- All fields are required.
- Email and phone formats are checked.
- Only a logged-in admin can change events or view registrations.
- Duplicate admission numbers for one event are rejected.

> Note: The login is intentionally simple for a university demonstration. The hosted version uses hashed passwords, signed sessions, HTTPS, and database access controls, but a larger public system should also add login rate limiting and password reset support.
