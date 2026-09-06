# QuestUp

QuestUp is a full-stack personal reminder app for tracking game names, quests, and due dates.

## Stack

- Frontend: React + Vite + JavaScript
- Backend: Node.js + Express
- Authentication: JWT + bcrypt
- Game data: manual entry only; no Player ID, game login, or game API access
- Persistence: `server/data.json` (local, portable, no database setup required)

## Run

```powershell
npm run install:all
npm run dev
```

Open `http://localhost:5173`.

## Use with Live Server

Live Server cannot run the React JSX source directly. Build the frontend first,
then right-click `client/dist/index.html` and choose **Open with Live Server**.
Keep the API running in a second terminal with `npm run start --prefix server`.

```powershell
npm run build
npm run start --prefix server
```

The website will normally be available at the Live Server URL, such as
`http://127.0.0.1:5500`. The frontend calls the API at `http://localhost:4000`.

Demo account: `demo@questup.app` / `questup123`

The API runs at `http://localhost:4000` and exposes `/api/health`, auth endpoints, reminder creation, dashboard data, and reminder completion. Users enter the game name, quest name, and due date themselves. To use a production database, replace the small data access functions in `server/index.js` with a database repository while keeping the API contract unchanged.
