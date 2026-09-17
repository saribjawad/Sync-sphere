# Syncsphere

A real-time co-watching app where users can create rooms, invite others, and watch YouTube videos together in perfect sync. Users can add videos to a shared queue, upvote them, and see each other's timestamps to sync instantly.

## Note

This app is hosted on a free instance of Render.com, which may spin down due to inactivity. As a result, initial load times can be delayed by 50 seconds or more.

## Features

- Real-time video playback with manual syncing
- Create and join rooms
- Add YouTube videos to a shared queue
- Upvote videos to decide what plays next
- See others' timestamps and sync instantly
- Seamless co-watching experience
- If a user disconnects, the app will wait for 1 minute before removing them from the room or ending it if they were the host

### Installation

1. Clone the repository:

```
git clone https://github.com/SaribJawad/Sync-sphere.git
cd Sync-sphere
```

2. Install dependencies:

```
cd server
npm install
cd ../client
npm install
```

3. Copy `server/.env.example` to `server/.env` and `client/.env.example` to
   `client/.env.development.local`. Fill in your Google credentials, MongoDB
   connection details, and token secrets in the server file.

4. Start the backend server:

```
cd server
npm run dev
```

5. Start the frontend server in a separate terminal:

```
cd client
npm run dev
```

### Deployment environment

Set these variables in your hosting dashboards before deploying:

| Service           | Variable              | Value for the current deployment                                |
| ----------------- | --------------------- | --------------------------------------------------------------- |
| Frontend (Vercel) | `VITE_API_BASE_URL`   | `https://sync-spheree.onrender.com/api/v1`                      |
| Backend (Render)  | `NODE_ENV`            | `production`                                                    |
| Backend (Render)  | `FRONTEND_URL`        | `https://sync-sphere-eight.vercel.app`                          |
| Backend (Render)  | `GOOGLE_CALLBACK_URL` | `https://sync-spheree.onrender.com/api/v1/auth/google/callback` |

Use your actual domains if they change. Keep the existing Google credentials,
MongoDB settings, and token secrets on the backend. `FRONTEND_URL` controls the
login redirect and allowed CORS origin. `GOOGLE_CALLBACK_URL` must exactly match
an authorized redirect URI in the Google OAuth client configuration.

`PROD_FRONTEND_URL` and `VITE_API_BASE_URL_LOCAL` are no longer used. Set
`FRONTEND_URL` and `VITE_API_BASE_URL` separately in each environment instead.
The WebSocket URL is derived from the API origin, using `wss` for HTTPS.
The frontend uses absolute API URLs and does not need a Vite proxy.

Restart local processes after environment changes. Frontend environment values
are embedded at build time, so rebuild/redeploy the frontend when they change.
Only public configuration belongs in `VITE_` variables; keep secrets on the server.
Local `.env` files are ignored by Git; the example files contain no credentials.

Deployment addresses live in environment settings. YouTube integration URLs,
the Google Fonts stylesheet, and SVG namespace identifiers are fixed third-party
resources and remain in the source.

### Tech Stack

Frontend: React, TypeScript, Tailwind CSS

Backend: Node.js, Express.js, MongoDB

Real-time: WebSockets

### Contributing

Pull requests are welcome! Feel free to open an issue for feature suggestions or bug reports.
