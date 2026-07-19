# CodeRoom

CodeRoom is a real-time collaborative coding platform for building, testing, and discussing code with others in a shared room. Users can create or join a room, edit files in a Monaco-powered IDE, switch languages, run code, and chat live with collaborators.

## Highlights
- Real-time multi-user collaboration in shared coding rooms
- Monaco-based editor with file tabs and language switching
- Live presence indicators, cursor awareness, and active file tracking
- Built-in console for running code and viewing output
- Authenticated room access via JWT and persistent room state

## Tech stack
- Frontend: React, Vite, React Router, Socket.IO Client, Monaco Editor, Lucide icons
- Backend: Node.js, Express, Socket.IO, Mongoose, Axios
- Database: MongoDB

## Project structure
- `client/`: React frontend with collaboration UI and room workflow
- `server/`: Express and Socket.IO backend with auth, room, and execute APIs

## Setup

### 1. Install dependencies
```bash
cd client
npm install

cd ../server
npm install
```

### 2. Configure environment
Create a `.env` file in the `server/` folder with the following values:

```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
CLIENT_URL=http://localhost:5173
PORT=5000
```

`CLIENT_URL` is optional and defaults to `http://localhost:5173`.

### 3. Run the app
Start the backend:
```bash
cd server
npm run dev
```

Start the frontend:
```bash
cd client
npm run dev
```

- Frontend default: `http://localhost:5173`
- Backend default: `http://localhost:5000`

## Available scripts

### Client
- `npm run dev` — start Vite development server
- `npm run build` — build production assets
- `npm run preview` — preview built frontend
- `npm run lint` — run ESLint on frontend sources

### Server
- `npm run dev` — start backend with `nodemon`
- `npm start` — run backend with Node

## How it works
1. Users sign in and create or join a room.
2. The backend loads room state and collaborators from MongoDB.
3. Code edits, file events, chat messages, and cursor updates sync in real time through Socket.IO.
4. The `execute` endpoint runs code and returns console output to the client.

## Notes
- Room state is saved in MongoDB and synchronized across connected users.
- Socket connections require a valid JWT token for authentication.
- File and language changes are persisted automatically.
