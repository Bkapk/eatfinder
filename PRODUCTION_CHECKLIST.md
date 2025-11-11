# ✅ Production Deployment Checklist

Use this checklist before deploying EatFinder to production.

---

## 🔒 Security (CRITICAL)

- [ ] Change `ADMIN_PASSWORD` to a strong, unique password
- [ ] Generate a new `SESSION_SECRET` (32+ characters)
  ```bash
  # Generate with:
  openssl rand -base64 32
  # Or use: https://randomkeygen.com/
  ```
- [ ] Remove or comment out any `console.log()` with sensitive data
- [ ] Verify `.env` is in `.gitignore` (it is by default)
- [ ] Verify no secrets are hardcoded in source code
- [ ] Set `NODE_ENV="production"` in production `.env`

---

## 🗄️ Database

**If using SQLite (small-scale only)**:
- [ ] Backup `prisma/dev.db` regularly
- [ ] Know that SQLite has file upload limits
- [ ] Understand you'll need migration strategy for scaling

**If using PostgreSQL (recommended for production)**:
- [ ] Created database: `CREATE DATABASE eatfinder;`
- [ ] Updated `DATABASE_URL` to PostgreSQL connection string
- [ ] Updated `prisma/schema.prisma` provider to `"postgresql"`
- [ ] Ran migrations: `npx prisma migrate deploy`
- [ ] Ran seed: `npm run db:seed`
- [ ] Set up automated backups (pg_dump)
- [ ] Note: Vercel, Railway, Render all offer managed PostgreSQL

**If using MySQL/MariaDB**:
- [ ] Created database: `CREATE DATABASE eatfinder;`
- [ ] Created user with proper permissions
- [ ] Updated `DATABASE_URL` to MySQL connection string
- [ ] Updated `prisma/schema.prisma` provider to `"mysql"`
- [ ] Ran migrations: `npx prisma migrate deploy`
- [ ] Ran seed: `npm run db:seed`
- [ ] Set up automated backups (mysqldump)

---

## 🌍 Environment Variables

Create production `.env` with these values:

```env
DATABASE_URL="[your-production-database-url]"
SESSION_SECRET="[32+ char random string]"
ADMIN_EMAIL="[your-email]"
ADMIN_PASSWORD="[strong-password]"
NODE_ENV="production"
NEXT_PUBLIC_APP_URL="https://eat.yourdomain.com"
```

**Platform-specific**:

**Vercel**:
- [ ] Added all env vars in Vercel dashboard
- [ ] Verified `NODE_ENV` is auto-set to `production`
- [ ] Added custom domain in Vercel settings

**Railway**:
- [ ] Added all env vars in Railway dashboard
- [ ] DATABASE_URL auto-populated if using Railway Postgres
- [ ] Custom domain configured

**Self-Hosted**:
- [ ] Created `.env` file on server
- [ ] File permissions set correctly: `chmod 600 .env`
- [ ] Environment loaded by PM2 or systemd

---

## 🚀 Deployment Platform

**Vercel** (if chosen):
- [ ] Pushed code to GitHub
- [ ] Connected GitHub repo to Vercel
- [ ] Configured environment variables
- [ ] Triggered first deployment
- [ ] Verified build succeeds
- [ ] Tested deployed app
- [ ] Added custom domain `eat.yourdomain.com`
- [ ] Verified DNS configured correctly
- [ ] Verified SSL certificate issued

**Railway** (if chosen):
- [ ] Pushed code to GitHub
- [ ] Connected GitHub repo to Railway
- [ ] Added PostgreSQL database
- [ ] Configured environment variables
- [ ] Deployed successfully
- [ ] Added custom domain
- [ ] Verified SSL certificate

**Self-Hosted** (if chosen):
- [ ] Installed Node.js 18+ on server
- [ ] Installed PM2: `npm install -g pm2`
- [ ] Cloned repo to `/var/www/eatfinder`
- [ ] Ran `npm install`
- [ ] Created production `.env`
- [ ] Ran migrations: `npx prisma migrate deploy`
- [ ] Ran seed: `npm run db:seed`
- [ ] Built app: `npm run build`
- [ ] Started with PM2: `pm2 start npm --name "eatfinder" -- start`
- [ ] Configured Nginx reverse proxy
- [ ] Obtained SSL certificate: `certbot --nginx -d eat.yourdomain.com`
- [ ] Verified Nginx config: `nginx -t`
- [ ] Reloaded Nginx: `systemctl reload nginx`
- [ ] Configured PM2 startup: `pm2 startup` and `pm2 save`
- [ ] Configured firewall (ufw/iptables)

---

## 🌐 Domain & DNS

- [ ] Purchased domain or using subdomain
- [ ] Configured DNS records:
  - **Vercel**: `CNAME` record: `eat` → `cname.vercel-dns.com`
  - **Railway**: `CNAME` record: `eat` → `[your-app].railway.app`
  - **Self-hosted**: `A` record: `eat` → `[your-server-ip]`
- [ ] Waited for DNS propagation (up to 24 hours)
- [ ] Verified SSL certificate issued
- [ ] Tested `https://eat.yourdomain.com`

---

## 📁 File Storage

**Local Storage** (current setup):
- [ ] Created `public/uploads/` directory
- [ ] Set permissions: `chmod 755 public/uploads`
- [ ] Configured backup strategy for uploads folder
- [ ] Note: Works on self-hosted, but Vercel is read-only filesystem

**For Vercel/Serverless** (if needed):
- [ ] Set up S3/Cloudinary/Uploadcare
- [ ] Updated `lib/storage.ts` to use cloud storage
- [ ] Configured credentials in environment variables

---

## ✅ Testing

- [ ] Visited homepage
- [ ] Visited `/eat` page
- [ ] Adjusted sliders, clicked "Find Restaurants"
- [ ] Selected cuisines
- [ ] Selected max price
- [ ] Verified results display correctly
- [ ] Clicked "Show More" button
- [ ] Logged into `/admin` with credentials
- [ ] Viewed restaurant list
- [ ] Created new restaurant
- [ ] Uploaded image
- [ ] Edited existing restaurant
- [ ] Deleted restaurant
- [ ] Exported CSV
- [ ] Imported CSV
- [ ] Tested search/filter in admin
- [ ] Tested on mobile device
- [ ] Tested in multiple browsers

---

## 🔐 Post-Deployment Security

- [ ] Changed admin password immediately after first login
- [ ] Verified HTTPS works (no mixed content warnings)
- [ ] Checked security headers:
  ```bash
  curl -I https://eat.yourdomain.com
  # Look for: X-Frame-Options, X-Content-Type-Options, etc.
  ```
- [ ] Tested rate limiting on `/api/recommend`
- [ ] Verified `/admin` requires login
- [ ] Verified logout works
- [ ] No sensitive data in browser console
- [ ] No sensitive data in network tab responses

---

## 📊 Monitoring & Backups

**Monitoring**:
- [ ] Set up application monitoring (Vercel Analytics, Railway logs, or custom)
- [ ] Monitor error logs
- [ ] Monitor database size
- [ ] Monitor upload folder size

**Backups**:
- [ ] Database backup strategy in place
  ```bash
  # PostgreSQL
  pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
  
  # MySQL
  mysqldump -u user -p database > backup-$(date +%Y%m%d).sql
  ```
- [ ] Uploads folder backup strategy
- [ ] Scheduled automated backups (cron job or platform feature)
- [ ] Tested restore process

**Example backup cron** (self-hosted):
```bash
# Add to crontab: crontab -e
0 2 * * * /var/www/eatfinder/backup.sh
```

Create `/var/www/eatfinder/backup.sh`:
```bash
#!/bin/bash
DATE=$(date +%Y%m%d)
pg_dump $DATABASE_URL > /backups/eatfinder-$DATE.sql
tar -czf /backups/uploads-$DATE.tar.gz /var/www/eatfinder/public/uploads
# Keep only last 7 days
find /backups -name "eatfinder-*.sql" -mtime +7 -delete
find /backups -name "uploads-*.tar.gz" -mtime +7 -delete
```

---

## 📱 Performance

- [ ] Tested page load speed
- [ ] Optimized images (consider WebP format)
- [ ] Verified CDN caching (Vercel/Railway handle this)
- [ ] Tested with slow network (Chrome DevTools throttling)

---

## 📖 Documentation

- [ ] Updated `NEXT_PUBLIC_APP_URL` in docs
- [ ] Documented any custom changes
- [ ] Saved deployment credentials securely (password manager)
- [ ] Documented backup/restore procedures
- [ ] Shared access with team (if applicable)

---

## 🎉 Launch

- [ ] All items above completed
- [ ] Announced to users (if public)
- [ ] Added to portfolio/showcase
- [ ] Celebrate! 🎊

---

## 🆘 Rollback Plan

If something goes wrong:

**Vercel/Railway**:
1. Go to deployments
2. Find last working deployment
3. Click "Promote to Production"

**Self-Hosted**:
```bash
# Rollback code
cd /var/www/eatfinder
git log --oneline  # find last good commit
git reset --hard [commit-hash]
npm install
npm run build
pm2 reload eatfinder

# Rollback database (if needed)
psql $DATABASE_URL < backup-YYYYMMDD.sql
```

---

## 📞 Support Contacts

- **Domain registrar**: _______________
- **Hosting platform**: _______________
- **Database host**: _______________
- **SSL certificate**: _______________
- **Emergency contact**: _______________

---

## Notes

_Add any deployment-specific notes here:_

---

**Last Updated**: _______________  
**Deployed By**: _______________  
**Production URL**: https://eat.yourdomain.com

