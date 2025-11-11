# 🚀 EatFinder Setup Guide

## Quick Setup (5 minutes)

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create a `.env` file in the root directory:

```env
# Database (SQLite for local development)
DATABASE_URL="file:./dev.db"

# Session Secret (generate with: openssl rand -base64 32 or use any random 32+ char string)
SESSION_SECRET="your-super-secret-key-at-least-32-characters-long"

# Admin Credentials
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="your-secure-password"

# Environment
NODE_ENV="development"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

**⚠️ Important**: Change `ADMIN_PASSWORD` to something secure!

### 3. Initialize Database

```bash
npm run db:migrate
npm run db:seed
```

This will:
- Create the SQLite database
- Run all migrations
- Add 10 sample restaurants
- Create the admin user

### 4. Start Development Server

```bash
npm run dev
```

Visit:
- **Public page**: http://localhost:3000/eat
- **Admin dashboard**: http://localhost:3000/admin
- **Home**: http://localhost:3000

### 5. Login to Admin

- Email: `admin@example.com` (or what you set in `.env`)
- Password: your `ADMIN_PASSWORD` from `.env`

---

## 📦 What's Next?

### Local Development
- ✅ App is running on `http://localhost:3000`
- ✅ Make changes and they'll hot-reload
- ✅ Database file is at `prisma/dev.db`

### Add Your Restaurants
1. Go to http://localhost:3000/admin
2. Login with your credentials
3. Click "Add Restaurant"
4. Fill in the details
5. Or use CSV import for bulk adding

### Deploy to Production
When you're ready to deploy:
1. Test everything works locally
2. Read [DEPLOYMENT.md](./DEPLOYMENT.md)
3. Choose your hosting option (Vercel recommended)
4. Push to GitHub
5. Deploy!

---

## 🔧 Useful Commands

```bash
# Development
npm run dev              # Start dev server (http://localhost:3000)

# Database
npm run db:migrate       # Run database migrations
npm run db:seed          # Seed sample data
npm run db:studio        # Open Prisma Studio (database GUI)

# Production
npm run build            # Build for production
npm start                # Start production server

# Testing
npm test                 # Run tests (if available)

# Code Quality
npm run lint             # Run ESLint
```

---

## 🎨 Customization

### Change Colors
Edit `app/globals.css` and update the CSS variables:
```css
:root {
  --primary: #90e0ef;        /* Main accent color */
  --primary-hover: #7dd3f0;  /* Hover state */
  /* ... other colors ... */
}
```

### Change Font
The app uses **Manrope** from Google Fonts. To change:
1. Edit `app/layout.tsx` - update font import links
2. Edit `app/globals.css` - update `font-family` in `html, body`
3. Edit `tailwind.config.ts` - update `fontFamily.sans`

### Customize Scoring Algorithm
Edit `lib/scoring.ts`:
- Line 38-40: Base scoring for heaviness, portion, fine dining
- Line 53: Cuisine match bonus (+50)
- Line 55: Cuisine mismatch penalty (-50)
- Line 62-67: Price level adjustments
- Line 71-74: Fast food prep time penalty

---

## ❓ Troubleshooting

### "Database is locked" error
```bash
# Close any apps/tools accessing the database
# Or delete and recreate:
rm prisma/*.db*
npm run db:migrate
npm run db:seed
```

### Port 3000 already in use
```bash
# Use a different port:
npm run dev -- -p 3001
```

### Can't login to admin
1. Check your `.env` file has correct credentials
2. Try reseeding the database: `npm run db:seed`
3. The seed script will recreate the admin user

### Images not uploading
1. Check `public/uploads/` directory exists
2. Check file permissions: `chmod 755 public/uploads`
3. Check file size (max 10MB)

---

## 📝 Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | ✅ | Database connection string | `file:./dev.db` |
| `SESSION_SECRET` | ✅ | Secret key for sessions (32+ chars) | Generate with openssl |
| `ADMIN_EMAIL` | ✅ | Admin user email | `admin@example.com` |
| `ADMIN_PASSWORD` | ✅ | Admin user password | Choose securely |
| `NODE_ENV` | ⚠️ | Environment mode | `development` or `production` |
| `NEXT_PUBLIC_APP_URL` | ⚠️ | Public app URL | `http://localhost:3000` |

**⚠️** = Recommended but optional  
**✅** = Required

---

## 🎯 Next Steps

1. ✅ Setup complete!
2. 🍽️ Add your favorite restaurants
3. 🎨 Customize colors/fonts to your taste
4. 🧪 Test the recommendation algorithm
5. 🚀 Deploy to production when ready

---

## 💬 Support

For deployment help, see [DEPLOYMENT.md](./DEPLOYMENT.md)

For code questions, check the README or code comments!

