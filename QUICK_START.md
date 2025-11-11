# 🚀 Quick Start Guide

Get EatFinder running in 5 minutes!

---

## 📋 Prerequisites

- Node.js 18 or higher
- npm (comes with Node.js)
- A code editor (VS Code recommended)

---

## ⚡ 5-Minute Setup

### 1. Install Dependencies (2 min)

```bash
npm install
```

### 2. Configure Environment (1 min)

Create a `.env` file in the project root:

```env
DATABASE_URL="file:./dev.db"
SESSION_SECRET="change-this-to-a-long-random-string"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="changeme"
NODE_ENV="development"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

**⚠️ Change the `ADMIN_PASSWORD`!**

### 3. Initialize Database (1 min)

```bash
npm run db:migrate
npm run db:seed
```

### 4. Start the App (1 min)

```bash
npm run dev
```

---

## 🎉 You're Done!

**Open your browser:**

- 🍽️ **Public page**: http://localhost:3000/eat
- 🔐 **Admin**: http://localhost:3000/admin
  - Email: `admin@example.com`
  - Password: whatever you set in `.env`

---

## 🎯 What's Next?

### Try the App

1. Go to http://localhost:3000/eat
2. Move the sliders
3. Click "Find Restaurants"
4. See 10 sample restaurants ranked by your preferences!

### Add Your Restaurants

1. Go to http://localhost:3000/admin
2. Login with your credentials
3. Click "Add Restaurant"
4. Fill in the details

### Deploy It

When ready to deploy:
- Read [DEPLOYMENT.md](./DEPLOYMENT.md) for full instructions
- **Recommended**: Use Vercel (free, easy, auto-deploys)

---

## 📚 Full Documentation

- **[README.md](./README.md)** - Complete feature list and technical details
- **[SETUP.md](./SETUP.md)** - Detailed setup instructions
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Complete deployment guide
- **[GITHUB_SETUP.md](./GITHUB_SETUP.md)** - Git and GitHub workflow
- **[PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md)** - Pre-deployment checklist

---

## ❓ Common Issues

**"Port 3000 is already in use"**
```bash
npm run dev -- -p 3001
```

**"Database is locked"**
```bash
rm prisma/*.db*
npm run db:migrate
npm run db:seed
```

**Can't login to admin**
- Check your `.env` file
- Run `npm run db:seed` again

---

## 🆘 Need Help?

1. Check the documentation files listed above
2. Review code comments
3. Check browser console for errors (F12)

---

**Enjoy EatFinder! 🍽️✨**

