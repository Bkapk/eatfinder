# 👋 Start Here - EatFinder Documentation Index

Welcome to EatFinder! This guide will help you navigate the documentation.

---

## 🎯 What Do You Want to Do?

### 🚀 I'm New - Just Want to Run It Locally

**Read this**: [QUICK_START.md](./QUICK_START.md) (5 minutes)

Quick commands:
```bash
npm install
# Create .env file (see QUICK_START.md)
npm run db:migrate
npm run db:seed
npm run dev
```

Then open: http://localhost:3000/eat

---

### 🌐 I Want to Deploy to Production

**Read this**: [DEPLOYMENT_SUMMARY.md](./DEPLOYMENT_SUMMARY.md) (overview)

Then follow the detailed guide for your platform:
- **Vercel** (recommended): [DEPLOYMENT.md - Section A](./DEPLOYMENT.md#a-vercel-best-for-nextjs)
- **Self-Hosted**: [DEPLOYMENT.md - Section 2](./DEPLOYMENT.md#option-2-self-hosted-on-your-virtualmin-server)

Before deploying, check: [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md)

---

### 🐙 I Need to Set Up GitHub

**Read this**: [GITHUB_SETUP.md](./GITHUB_SETUP.md)

Quick commands:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/eatfinder.git
git push -u origin main
```

---

### 📖 I Want to Understand the Project

**Read these in order:**
1. [README.md](./README.md) - Project overview, features, tech stack
2. [SETUP.md](./SETUP.md) - Detailed setup guide
3. Code comments in each file

---

### 🎨 I Want to Customize It

**Colors**: Edit `app/globals.css` (line ~9, CSS variables)

**Font**: 
- Edit `app/layout.tsx` (Google Fonts link)
- Edit `app/globals.css` (font-family)
- Edit `tailwind.config.ts` (Tailwind config)

**Scoring Algorithm**: Edit `lib/scoring.ts` (lines 40-74)

**UI Components**: All in `app/` directory

---

### 🔧 I'm Having Issues

**Check these:**
1. [SETUP.md - Troubleshooting](./SETUP.md#-troubleshooting)
2. [DEPLOYMENT.md - Troubleshooting](./DEPLOYMENT.md#-troubleshooting)
3. Browser console (F12) for errors
4. Dev server logs in terminal

**Common fixes:**
```bash
# Database locked
rm prisma/*.db*
npm run db:migrate
npm run db:seed

# Port in use
npm run dev -- -p 3001

# Can't login
npm run db:seed  # Recreates admin user
```

---

## 📚 Full Documentation Index

### Getting Started
- 📄 **[QUICK_START.md](./QUICK_START.md)** - 5-minute setup guide
- 📄 **[SETUP.md](./SETUP.md)** - Detailed setup instructions
- 📄 **[README.md](./README.md)** - Project overview and features

### Deployment
- 📄 **[DEPLOYMENT_SUMMARY.md](./DEPLOYMENT_SUMMARY.md)** - Overview and next steps
- 📄 **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Complete deployment guide (all platforms)
- 📄 **[PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md)** - Pre-deployment checklist

### Development
- 📄 **[GITHUB_SETUP.md](./GITHUB_SETUP.md)** - Git workflow and GitHub integration
- 📄 **[ENV_TEMPLATE.txt](./ENV_TEMPLATE.txt)** - Environment variables reference
- 📄 **Code comments** - Throughout the codebase

---

## 🗂️ Project Structure

```
eatfinder/
├── app/                    # Next.js app directory
│   ├── eat/               # Public recommendation page
│   ├── admin/             # Admin dashboard
│   ├── api/               # API routes
│   └── globals.css        # Global styles (customize here!)
├── lib/                   # Utilities
│   ├── scoring.ts         # Scoring algorithm (customize here!)
│   ├── auth.ts            # Authentication
│   └── prisma.ts          # Database client
├── prisma/                # Database
│   ├── schema.prisma      # Database schema
│   └── seed.ts            # Sample data
├── middleware.ts          # Security middleware
├── .env                   # Environment variables (you create this)
└── Documentation files    # You are here!
```

---

## 🎓 Learning Path

### Beginner
1. Run locally with [QUICK_START.md](./QUICK_START.md)
2. Explore the app at http://localhost:3000
3. Add a restaurant in admin
4. Understand the features from [README.md](./README.md)

### Intermediate
1. Customize colors and fonts
2. Adjust scoring algorithm
3. Add your real restaurants
4. Deploy to Vercel

### Advanced
1. Set up GitHub workflow
2. Deploy to self-hosted server
3. Set up PostgreSQL
4. Configure CI/CD
5. Add custom features

---

## 🚀 Quick Command Reference

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm start                # Start production server

# Database
npm run db:migrate       # Run migrations
npm run db:seed          # Add sample data
npm run db:studio        # Database GUI

# Git
git add .
git commit -m "message"
git push

# Deployment (self-hosted)
./deploy.sh              # Deploy to production
```

---

## 🆘 Emergency Quick Fixes

**App won't start:**
```bash
rm -rf node_modules
npm install
```

**Database issues:**
```bash
rm prisma/*.db*
npm run db:migrate
npm run db:seed
```

**Build errors:**
```bash
rm -rf .next
npm run build
```

**Git issues:**
```bash
git status
git pull
```

---

## 📊 Feature List

### Current Features ✅
- Smart restaurant recommendations
- 3-slider interface (heaviness, hunger, fine dining)
- Cuisine filtering
- Price level filtering
- Top 3 + "Show More" display
- Admin CRUD interface
- Image uploads
- CSV import/export
- Session-based auth
- Security middleware
- Rate limiting
- Dark theme with cyan accents
- Mobile responsive

### Easy to Add 🔧
- More cuisines
- Distance/location sorting
- Operating hours filtering
- User reviews
- Favorites/bookmarks
- Multiple admin users
- Email notifications

---

## 🎯 Deployment Recommendation

**For your use case, I recommend:**

### ✅ Use Vercel

**Why:**
- You can still use your subdomain `eat.yourdomain.com`
- Free tier is enough for personal use
- Auto-deploys when you push to GitHub
- No server maintenance needed
- Built-in SSL/HTTPS
- Perfect for Next.js apps

**Process:**
1. Push code to GitHub (10 minutes)
2. Connect to Vercel (5 minutes)
3. Configure domain DNS (5 minutes + propagation time)
4. Done! Auto-deploys on every push ✨

**Your Virtualmin server is great for WordPress**, but Next.js apps are optimized for platforms like Vercel. You'll have less headaches and more time to enjoy your app!

---

## ✅ Current Status

**Your app is:**
- ✅ Fully functional locally
- ✅ Production-ready code
- ✅ Security hardened
- ✅ Well-documented
- ✅ Clean and maintainable
- ✅ Ready to deploy

**Next step:** Choose your deployment method and follow the guide!

---

## 📞 Quick Links

- **Local app**: http://localhost:3000
- **Admin panel**: http://localhost:3000/admin
- **Database GUI**: Run `npm run db:studio`
- **Vercel**: https://vercel.com
- **GitHub**: https://github.com

---

**Happy deploying! 🎉**

_Choose your path above and follow the guide. If you get stuck, check the troubleshooting sections in the docs._

