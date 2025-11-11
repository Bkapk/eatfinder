# 🚀 EatFinder Deployment Guide

This guide covers two deployment options for your EatFinder app.

---

## 📋 Pre-Deployment Checklist

Before deploying, ensure you have:

1. ✅ Tested the app locally and it works as expected
2. ✅ Git installed on your local machine
3. ✅ A GitHub account
4. ✅ Decided on your deployment method

---

## 🎯 Option 1: Managed Hosting (Recommended - Easiest)

### Why This Option?
- ✅ Zero-config deployments
- ✅ Automatic HTTPS
- ✅ Built-in database solutions
- ✅ Git integration (push to deploy)
- ✅ Free tier available
- ✅ Automatic scaling
- ✅ No server maintenance

### Recommended Platforms:

#### **A) Vercel (Best for Next.js)**

1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/eatfinder.git
   git push -u origin main
   ```

2. **Deploy to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Sign in with GitHub
   - Click "New Project"
   - Import your `eatfinder` repository
   - Configure:
     - **Framework Preset:** Next.js
     - **Root Directory:** ./
     - **Build Command:** `npm run build` (auto-detected)
     - **Output Directory:** .next (auto-detected)
   
3. **Add Environment Variables:**
   ```
   DATABASE_URL=file:./prod.db
   SESSION_SECRET=[generate with: openssl rand -base64 32]
   ADMIN_EMAIL=your-email@example.com
   ADMIN_PASSWORD=your-secure-password
   NODE_ENV=production
   NEXT_PUBLIC_APP_URL=https://your-subdomain.vercel.app
   ```

4. **For PostgreSQL (Recommended for Production):**
   - Add Vercel Postgres addon
   - Or use external: Railway, Supabase, Neon
   - Update `DATABASE_URL` to PostgreSQL connection string
   - Run migrations: `npx prisma migrate deploy`

5. **Link Custom Domain:**
   - Vercel Dashboard → Your Project → Settings → Domains
   - Add: `eat.yourdomain.com`
   - Configure DNS (Vercel provides instructions):
     ```
     Type: CNAME
     Name: eat
     Value: cname.vercel-dns.com
     ```

**✨ Result:** Auto-deployment on every Git push to main branch!

---

#### **B) Railway (Good Alternative)**

1. **Push to GitHub** (same as above)

2. **Deploy to Railway:**
   - Go to [railway.app](https://railway.app)
   - Sign in with GitHub
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository
   - Railway auto-detects Next.js

3. **Add PostgreSQL:**
   - In Railway dashboard: "New" → "Database" → "PostgreSQL"
   - Copy the `DATABASE_URL` provided

4. **Set Environment Variables:**
   - Go to your project → Variables
   - Add all variables from `.env.example`
   - Use the Railway PostgreSQL `DATABASE_URL`

5. **Run Migrations:**
   - In Railway dashboard → Deployment logs
   - Or connect via Railway CLI:
     ```bash
     railway run npx prisma migrate deploy
     railway run npm run db:seed
     ```

6. **Custom Domain:**
   - Railway provides a domain: `your-app.railway.app`
   - Or add custom domain in Settings → Domains
   - Add CNAME record: `eat.yourdomain.com` → `your-app.railway.app`

---

## 🖥️ Option 2: Self-Hosted on Your Virtualmin Server

### Requirements:
- Node.js 18+ installed
- Nginx configured
- MariaDB or PostgreSQL
- PM2 (process manager)
- Git

### Step-by-Step:

#### 1. **Prepare Your Server**

SSH into your Virtualmin server:

```bash
ssh user@your-server.com
```

Install Node.js 18+:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Install PM2:
```bash
sudo npm install -g pm2
```

#### 2. **Set Up Database**

**Option A: Use MariaDB**
```bash
sudo mysql -u root -p

CREATE DATABASE eatfinder;
CREATE USER 'eatfinder_user'@'localhost' IDENTIFIED BY 'your-secure-password';
GRANT ALL PRIVILEGES ON eatfinder.* TO 'eatfinder_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

**Option B: Use PostgreSQL**
```bash
sudo -u postgres psql

CREATE DATABASE eatfinder;
CREATE USER eatfinder_user WITH PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE eatfinder TO eatfinder_user;
\q
```

#### 3. **Deploy Application**

```bash
# Navigate to web directory
cd /var/www/

# Clone from GitHub
sudo git clone https://github.com/YOUR_USERNAME/eatfinder.git
cd eatfinder

# Set permissions
sudo chown -R $USER:$USER /var/www/eatfinder

# Install dependencies
npm install

# Create production .env file
nano .env
```

Add to `.env`:
```env
# For MariaDB:
DATABASE_URL="mysql://eatfinder_user:your-secure-password@localhost:3306/eatfinder"

# For PostgreSQL:
# DATABASE_URL="postgresql://eatfinder_user:your-secure-password@localhost:5432/eatfinder"

SESSION_SECRET="your-super-secret-key-generate-with-openssl-rand-base64-32"
ADMIN_EMAIL="your-email@example.com"
ADMIN_PASSWORD="your-secure-password"
NODE_ENV="production"
NEXT_PUBLIC_APP_URL="https://eat.yourdomain.com"
```

```bash
# Generate Prisma client and run migrations
npx prisma generate
npx prisma migrate deploy

# Seed database
npm run db:seed

# Build for production
npm run build

# Start with PM2
pm2 start npm --name "eatfinder" -- start
pm2 save
pm2 startup
```

#### 4. **Configure Nginx**

Create Nginx config:
```bash
sudo nano /etc/nginx/sites-available/eatfinder
```

Add:
```nginx
server {
    listen 80;
    server_name eat.yourdomain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name eat.yourdomain.com;

    # SSL Configuration (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/eat.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/eat.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # File upload size limit
    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static files
    location /_next/static {
        proxy_pass http://localhost:3000;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Public files
    location /uploads {
        alias /var/www/eatfinder/public/uploads;
        add_header Cache-Control "public, max-age=31536000";
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/eatfinder /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 5. **SSL Certificate (Let's Encrypt)**

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d eat.yourdomain.com
```

#### 6. **Set Up Auto-Deployment from GitHub**

Create a deploy script:
```bash
nano /var/www/eatfinder/deploy.sh
```

Add:
```bash
#!/bin/bash
cd /var/www/eatfinder
git pull origin main
npm install
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 reload eatfinder
echo "Deployment completed at $(date)"
```

Make executable:
```bash
chmod +x deploy.sh
```

**Option A: Manual Deploy**
```bash
cd /var/www/eatfinder
./deploy.sh
```

**Option B: GitHub Webhook (Advanced)**
- Install webhook listener
- Configure in GitHub repo settings
- Triggers deploy.sh on push to main

---

## 🔄 Development Workflow

### Local Development → Production

1. **Make changes locally:**
   ```bash
   npm run dev
   # Test your changes
   ```

2. **Commit and push to GitHub:**
   ```bash
   git add .
   git commit -m "Your changes description"
   git push origin main
   ```

3. **Deploy to production:**
   - **Vercel/Railway:** Automatic deployment on push ✅
   - **Self-hosted:** SSH in and run `./deploy.sh`

---

## 🔐 Post-Deployment Security

1. **Change default admin password immediately**
2. **Use strong SESSION_SECRET** (32+ characters)
3. **Enable firewall:**
   ```bash
   sudo ufw allow 22
   sudo ufw allow 80
   sudo ufw allow 443
   sudo ufw enable
   ```
4. **Regular backups:**
   - Database: `pg_dump` or `mysqldump`
   - Uploads folder: `/public/uploads`
5. **Monitor logs:**
   - Vercel: Built-in dashboard
   - Self-hosted: `pm2 logs eatfinder`

---

## 📊 Database Backup

### Vercel/Railway (PostgreSQL):
```bash
# Export
pg_dump $DATABASE_URL > backup.sql

# Import
psql $DATABASE_URL < backup.sql
```

### Self-hosted MariaDB:
```bash
# Export
mysqldump -u eatfinder_user -p eatfinder > backup.sql

# Import
mysql -u eatfinder_user -p eatfinder < backup.sql
```

---

## 🆘 Troubleshooting

### App won't start:
```bash
# Check logs
pm2 logs eatfinder

# Restart
pm2 restart eatfinder
```

### Database connection error:
- Verify DATABASE_URL in `.env`
- Check database is running: `sudo systemctl status postgresql`
- Test connection: `npx prisma studio`

### Nginx 502 error:
- Check app is running: `pm2 status`
- Check Nginx config: `sudo nginx -t`
- View Nginx logs: `sudo tail -f /var/log/nginx/error.log`

---

## 🎉 Recommended: Vercel for Simplicity

For your use case, I **strongly recommend Vercel** because:
- ✅ Free tier is generous
- ✅ Perfect for Next.js (made by same company)
- ✅ Auto-deploy on git push
- ✅ No server maintenance
- ✅ Custom domain support
- ✅ Built-in SSL
- ✅ You can still use your subdomain `eat.yourdomain.com`

Your Virtualmin server is great for WordPress, but Next.js apps shine on platforms built for them!

