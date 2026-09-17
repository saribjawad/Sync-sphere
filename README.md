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

### Deploy frontend and backend together on Render

Use the existing Render **Web Service** for both Express and the built React app.
All browser traffic (pages, Google login, API calls, and WebSockets) then uses the
same origin, avoiding third-party login cookies.

In the existing service's Settings, configure:

| Setting | Value |
| --- | --- |
| Root Directory | Leave blank (repository root, not `server`) |
| Build Command | `bash scripts/render-build.sh` |
| Start Command | `npm start --prefix server` |

Render must have access to both `client` and `server`; files outside a configured
root directory are unavailable. See [Render monorepo documentation](https://render.com/docs/monorepo-support).
If build filters previously only included `server`, remove them or include
`client/**`, `server/**`, and `scripts/**`.

Set these environment variables on that service:

```env
NODE_ENV=production
FRONTEND_URL=https://sync-spheree.onrender.com
GOOGLE_CALLBACK_URL=https://sync-spheree.onrender.com/api/v1/auth/google/callback
```

Keep existing Google credentials, MongoDB settings, and token secrets. Render
provides `PORT`. Use your service's actual URL if its name differs.
The Google OAuth client's authorized redirect URIs must include the exact
`GOOGLE_CALLBACK_URL` above; the existing callback can stay unchanged.

The build script installs both packages (including build dependencies), builds
React with `VITE_API_BASE_URL=/api/v1`, and compiles Express. It overrides any old
frontend API URL for this build. Express serves `client/dist` in production,
including React routes such as `/room`; unknown API routes still return JSON 404s.
WebSockets connect to the page's host using `wss` on HTTPS.

Push the changes and deploy the existing service. Open
`https://sync-spheree.onrender.com` instead of the Vercel URL, re-enable Firefox
tracking protection, and log in. Verify that refreshing `/room` works and the
WebSocket connects. The old Vercel deployment is no longer needed for this setup.

Local development remains two processes: keep the absolute localhost API URL
from `client/.env.example` in `client/.env.development.local`. Keep the local
frontend and callback URLs from `server/.env.example` in `server/.env`.

Local environment files are ignored by Git. Only public configuration belongs
in `VITE_` variables; keep secrets on the server. YouTube integration URLs,
Google Fonts, and SVG namespace identifiers remain fixed third-party resources.

### Tech Stack

Frontend: React, TypeScript, Tailwind CSS

Backend: Node.js, Express.js, MongoDB

Real-time: WebSockets

### Contributing

Pull requests are welcome! Feel free to open an issue for feature suggestions or bug reports.
