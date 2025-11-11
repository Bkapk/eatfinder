# 🍽️ EatFinder

A personal web app that helps you decide where to eat based on your mood, hunger level, and dining preferences.

## 🎯 Features

- **Public Recommendation Page** (`/eat`): Interactive sliders for heaviness, hunger level, and fine-dining preference
- **Smart Top-3 Display**: Shows the most relevant restaurants first with optional "Show More" button
- **Cuisine & Price Filters**: Multi-select cuisines and set max price level
- **Admin Dashboard**: Full CRUD interface for managing restaurants
- **CSV Import/Export**: Bulk import/export restaurants from CSV files
- **Intelligent Scoring Algorithm**: Matches restaurants to your preferences with customizable weights
- **Image Uploads**: Upload and display restaurant cover images
- **Search & Sort**: Find restaurants by name, cuisine, or neighborhood
- **Modern Dark UI**: Beautiful, responsive design with custom cyan accent color

## 🛠 Tech Stack

**TypeScript + Next.js 14 + Prisma + SQLite/PostgreSQL + Tailwind CSS**

### Why this stack?

- **Next.js 14**: Excellent DX with App Router, API routes, and server components. Easy deployment to Vercel/Railway/Render.
- **Prisma**: Type-safe database access, automatic migrations, and easy schema management.
- **SQLite**: Perfect for single-user apps, zero configuration, easy backups. **Can easily switch to PostgreSQL for production.**
- **TypeScript**: End-to-end type safety reduces bugs and improves developer experience.
- **Tailwind CSS**: Utility-first CSS for rapid UI development with consistent design system.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Setup

1. **Clone and install dependencies:**

```bash
npm install
```

2. **Set up environment variables:**

Create a `.env` file in the root directory:

```env
DATABASE_URL="file:./dev.db"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="changeme"
NEXTAUTH_SECRET="change-this-in-production"
NEXTAUTH_URL="http://localhost:3000"
```

3. **Initialize database:**

```bash
npm run db:migrate
```

4. **Seed sample data:**

```bash
npm run db:seed
```

5. **Start development server:**

```bash
npm run dev
```

Visit:
- **Public page**: http://localhost:3000/eat
- **Admin**: http://localhost:3000/admin (login: admin / changeme)

## 📦 Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed sample data
- `npm run db:studio` - Open Prisma Studio (database GUI)
- `npm test` - Run tests

## 🏗 Project Structure

```
├── app/
│   ├── api/              # API routes
│   │   ├── recommend/    # Recommendation endpoint
│   │   ├── restaurants/  # CRUD endpoints
│   │   └── auth/         # Authentication
│   ├── admin/            # Admin pages
│   ├── eat/              # Public recommendation page
│   └── globals.css       # Global styles
├── lib/
│   ├── prisma.ts         # Prisma client
│   ├── scoring.ts        # Scoring algorithm
│   ├── auth.ts           # Authentication helpers
│   ├── storage.ts        # File upload adapter
│   └── csv.ts            # CSV import/export
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── seed.ts           # Seed script
└── __tests__/            # Tests
```

## 🎨 Scoring Algorithm

The recommendation score is calculated as:

```typescript
score = 
  (100 - |wantHeavy - heaviness|) +
  (100 - |wantHungry - portionSize|) +
  (100 - |wantFinedine - fineDining|) +
  bonuses/penalties
```

**Bonuses:**
- `+50` if at least one selected cuisine matches (highly impactful)
- `+5` if `priceLevel <= maxPrice` (when provided)

**Penalties:**
- `-50` if no cuisine match when cuisines selected (highly impactful)
- `-10` if `priceLevel > maxPrice` (when maxPrice provided)
- `-avgPrepTime/2` if `fastOnly` is true and prep time > 20 minutes

### Customizing Weights

Edit `lib/scoring.ts` to adjust:
- Base score weights (currently equal)
- Cuisine bonus/penalty (currently +50/-50)
- Price bonus/penalty (currently +5/-10)
- Fast food penalty multiplier

## 📊 CSV Format

### Required Columns

- `name` (string, required, unique)
- `heaviness` (0-100)
- `portionSize` (0-100)
- `fineDining` (0-100)
- `priceLevel` (1-4)

### Optional Columns

- `description` (string)
- `spiceLevel` (0-100, default: 50)
- `avgPrepTime` (minutes, default: 30)
- `cuisines` (JSON array, e.g., `["Italian", "Pizza"]`)
- `neighborhood` (string)
- `websiteUrl` (URL)
- `gmapsUrl` (URL)
- `phone` (string)
- `image` (URL or path)
- `lat` (number)
- `lng` (number)
- `openHours` (string or JSON)

### Sample CSV

See `prisma/sample.csv` for an example file.

## 🚢 Deployment

**📖 For complete deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md)**

### Quick Options:

**Option 1: Vercel (Recommended - Easiest)**
- ✅ Free tier
- ✅ Auto-deploys on git push
- ✅ Custom domain support (`eat.yourdomain.com`)
- ✅ Built-in SSL
- ✅ No server maintenance

**Option 2: Self-Hosted (Your Virtualmin Server)**
- ✅ Full control
- ✅ Use existing infrastructure
- ✅ Nginx + PM2 setup
- ⚠️ Requires server management

**Option 3: Railway / Render**
- ✅ Good balance between ease and control
- ✅ Built-in PostgreSQL
- ✅ Git integration

See [DEPLOYMENT.md](./DEPLOYMENT.md) for step-by-step guides for each option.

## 🔒 Security Features

- ✅ HTTP security headers via middleware
- ✅ Content Security Policy (CSP) in production
- ✅ Password hashing with bcrypt
- ✅ Session-based authentication
- ✅ Rate limiting on public API
- ✅ Input validation with Zod
- ✅ SQL injection protection via Prisma
- ✅ XSS protection headers
- ⚠️ **Change default admin credentials in production!**

## 🧪 Testing

Run tests:

```bash
npm test
```

Current test coverage:
- Scoring algorithm unit tests
- API endpoint integration tests

## 📝 Database Migrations

Create a new migration:

```bash
npx prisma migrate dev --name your_migration_name
```

Apply migrations in production:

```bash
npx prisma migrate deploy
```

## 🎯 Future Enhancements

- [ ] PWA support with offline caching
- [ ] Distance-based sorting when lat/lng available
- [ ] User favorites/bookmarks
- [ ] Restaurant reviews/ratings
- [ ] Advanced filtering (dietary restrictions, etc.)
- [ ] S3/cloud storage adapter for images
- [ ] Redis for session management and rate limiting

## 📄 License

MIT

## 🙏 Acknowledgments

Built with Next.js, Prisma, and TypeScript.

