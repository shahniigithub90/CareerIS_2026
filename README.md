# CareerIS — Career Information System
**Final Year Project | Jinnah University for Women | 2026**
Team: Rabaika · Samra · Ariqah · Shahneela | Supervisor: Ms. Ushna Tasleem

---

## ▶️ HOW TO RUN (Phase 1)

### Step 1 — Install Node.js
Download from https://nodejs.org and install it.

### Step 2 — Install MongoDB
Option A (Easy): Sign up at https://mongodb.com/atlas — free cloud MongoDB.
Copy your connection string and paste it in `.env` as MONGODB_URI.

Option B: Install MongoDB locally from https://mongodb.com/try/download/community

### Step 3 — Open terminal in VS Code
In VS Code: Terminal → New Terminal

### Step 4 — Install dependencies
```
npm install
```

### Step 5 — Run the server
```
npm run dev
```

### Step 6 — Open the website
Go to: http://localhost:5000

---

## 📁 PROJECT STRUCTURE
```
CAREERIS/
├── public/           ← Frontend (HTML, CSS, JS)
│   ├── index.html    ← Homepage
│   ├── login.html    ← Login page
│   ├── register.html ← Register page
│   ├── css/style.css ← All styles
│   └── js/main.js    ← All JavaScript
├── config/db.js      ← MongoDB connection
├── models/User.js    ← User database schema
├── routes/auth.js    ← Login/Register API
├── middleware/       ← JWT authentication
├── server.js         ← Main server
├── .env              ← Environment variables
└── package.json      ← Dependencies
```

---

## 🔑 API ENDPOINTS
- POST /api/auth/register  → Create account
- POST /api/auth/login     → Login
- GET  /api/auth/me        → Get logged in user
