# 🐙 GitHub Setup & Deployment Workflow

## Initial GitHub Setup

### 1. Install Git

If you don't have Git installed:

**Windows**: Download from [git-scm.com](https://git-scm.com/download/win)

**Mac**: 
```bash
brew install git
```

**Linux**:
```bash
sudo apt-get install git
```

### 2. Create GitHub Repository

1. Go to [github.com](https://github.com)
2. Click the **"+"** icon → **"New repository"**
3. Repository name: `eatfinder` (or your preferred name)
4. Description: "Restaurant recommendation app based on mood and preferences"
5. Choose **Private** (recommended) or **Public**
6. **Do NOT** initialize with README, .gitignore, or license (we already have these)
7. Click **"Create repository"**

### 3. Push Your Code to GitHub

Open terminal in your project directory and run:

```bash
# Initialize git repository (if not already done)
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit - EatFinder v1.0"

# Rename branch to main (if needed)
git branch -M main

# Add GitHub as remote (replace YOUR_USERNAME and YOUR_REPO)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# Push to GitHub
git push -u origin main
```

**Example**:
```bash
git remote add origin https://github.com/johndoe/eatfinder.git
git push -u origin main
```

---

## Development Workflow

### Making Changes

1. **Make changes locally** (edit files, test with `npm run dev`)

2. **Check what changed**:
   ```bash
   git status
   git diff
   ```

3. **Stage changes**:
   ```bash
   # Add specific files
   git add app/eat/page.tsx
   
   # Or add all changes
   git add .
   ```

4. **Commit changes**:
   ```bash
   git commit -m "Descriptive message about what you changed"
   ```
   
   **Good commit messages**:
   - ✅ "Add cuisine filter to main page"
   - ✅ "Fix scoring algorithm for price levels"
   - ✅ "Update admin UI colors"
   - ❌ "Update" (too vague)
   - ❌ "Changes" (too vague)

5. **Push to GitHub**:
   ```bash
   git push
   ```

---

## Deployment Workflow

### Option 1: Vercel (Recommended)

**One-time setup**:

1. Go to [vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click "New Project"
4. Import your `eatfinder` repository
5. Configure environment variables (copy from your local `.env`)
6. Deploy!

**Every future deployment**:
```bash
# 1. Make changes locally
# 2. Test with npm run dev
# 3. Commit and push
git add .
git commit -m "Your changes"
git push

# 4. Vercel automatically deploys! 🎉
# Check the deployment in Vercel dashboard
```

**To test before deploying to main**:
```bash
# Create a feature branch
git checkout -b test-feature

# Make changes, commit
git add .
git commit -m "Testing new feature"
git push -u origin test-feature

# Vercel creates a preview deployment
# Test it, if good, merge to main:
git checkout main
git merge test-feature
git push
```

---

### Option 2: Self-Hosted (Virtualmin)

**One-time setup** (on your server):

```bash
# SSH into server
ssh user@your-server.com

# Navigate to web directory
cd /var/www/

# Clone repository
git clone https://github.com/YOUR_USERNAME/eatfinder.git
cd eatfinder

# Install dependencies
npm install

# Set up .env (production values)
nano .env

# Build and start
npm run build
pm2 start npm --name "eatfinder" -- start
pm2 save
```

**Deploy updates**:

```bash
# 1. On local machine: make changes, test, commit, push
git add .
git commit -m "Your changes"
git push

# 2. On server: pull changes and restart
ssh user@your-server.com
cd /var/www/eatfinder
git pull
npm install  # if package.json changed
npx prisma migrate deploy  # if database schema changed
npm run build
pm2 reload eatfinder
```

**Create a deploy script** (on server):
```bash
nano /var/www/eatfinder/deploy.sh
```

Add:
```bash
#!/bin/bash
cd /var/www/eatfinder
echo "📦 Pulling latest code..."
git pull origin main
echo "📦 Installing dependencies..."
npm install
echo "🗄️ Running migrations..."
npx prisma generate
npx prisma migrate deploy
echo "🔨 Building..."
npm run build
echo "🔄 Restarting app..."
pm2 reload eatfinder
echo "✅ Deployment complete!"
```

Make executable:
```bash
chmod +x deploy.sh
```

**Future deployments**:
```bash
# Local: commit and push
git push

# Server: run deploy script
ssh user@your-server.com
cd /var/www/eatfinder
./deploy.sh
```

---

## Useful Git Commands

```bash
# Check status
git status

# View changes
git diff

# View commit history
git log
git log --oneline  # condensed view

# Undo changes (before commit)
git checkout -- filename.tsx  # discard changes to file
git reset HEAD filename.tsx   # unstage file

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Undo last commit (discard changes)
git reset --hard HEAD~1

# Create new branch
git checkout -b feature-name

# Switch branches
git checkout main
git checkout feature-name

# Merge branch into main
git checkout main
git merge feature-name

# Delete branch
git branch -d feature-name

# View branches
git branch
git branch -a  # include remote branches

# Pull latest changes from GitHub
git pull

# View remote URL
git remote -v
```

---

## Best Practices

### Branching Strategy

**For small projects (solo developer)**:
- Work directly on `main` branch
- Commit often with clear messages
- Push when features are complete

**For larger features**:
```bash
# Create feature branch
git checkout -b feature-new-scoring

# Make changes, commit
git add .
git commit -m "Update scoring algorithm"

# Push feature branch
git push -u origin feature-new-scoring

# Test deployed preview (on Vercel)
# If good, merge to main
git checkout main
git merge feature-new-scoring
git push
```

### Commit Frequency

✅ **Do**:
- Commit after completing a logical unit of work
- Commit before trying something experimental
- Commit before switching tasks

❌ **Don't**:
- Commit broken code to main branch
- Make huge commits with many unrelated changes
- Commit secrets or sensitive data

### .gitignore (Already configured!)

These files are **never** committed:
- `.env` (contains secrets)
- `node_modules/` (reinstalled from package.json)
- `prisma/*.db` (database files)
- `public/uploads/*` (user uploaded images)

---

## GitHub Repository Best Practices

### README Badges (Optional but cool)

Add to top of README.md:
```markdown
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![License](https://img.shields.io/badge/license-MIT-green)
```

### Add a LICENSE

1. Go to your GitHub repo
2. Click "Add file" → "Create new file"
3. Name it `LICENSE`
4. Click "Choose a license template"
5. Select **MIT License** (most permissive)

### Protect Main Branch (Optional)

1. Go to repo → Settings → Branches
2. Add rule for `main`
3. Enable "Require pull request reviews before merging"
4. This prevents accidental direct pushes to main

---

## Troubleshooting

### "Permission denied (publickey)"

Set up SSH key or use HTTPS:
```bash
# Check current remote
git remote -v

# Change to HTTPS if using SSH
git remote set-url origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
```

### "Updates were rejected because the remote contains work..."

```bash
# Pull first, then push
git pull origin main
git push
```

### Accidentally committed `.env`

```bash
# Remove from git (keeps local file)
git rm --cached .env
git commit -m "Remove .env from tracking"
git push

# Then immediately:
# 1. Change all secrets in .env
# 2. Verify .gitignore contains .env
```

### Want to start fresh?

```bash
# Delete .git folder
rm -rf .git

# Re-initialize
git init
git add .
git commit -m "Fresh start"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main --force
```

---

## 🎉 You're All Set!

Your workflow is now:
1. ✏️ Make changes locally
2. 🧪 Test with `npm run dev`
3. 💾 Commit: `git add . && git commit -m "Message"`
4. 🚀 Push: `git push`
5. ✅ Auto-deploy (Vercel) or run `./deploy.sh` (self-hosted)

Happy coding! 🎊

