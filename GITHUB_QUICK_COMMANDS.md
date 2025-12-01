# ⚡ GitHub Quick Commands - Cheat Sheet

> Fast reference for common GitHub operations

---

## 🚀 First Time Push to GitHub

### Create Repo on GitHub First
1. Go to: https://github.com/new
2. Repository name: `ether-trials`
3. Description: "Decentralized RPG Tournament on Base"
4. **Don't initialize** with README (we have one)
5. Click "Create repository"

### Then Run These Commands
```bash
# Connect to GitHub
git remote add origin https://github.com/YOUR_USERNAME/ether-trials.git

# Push to GitHub
git branch -M main
git push -u origin main

# ✅ Done! Your repo is live!
```

---

## 📝 Daily Workflow

### Make Changes and Push
```bash
# See what changed
git status

# Add all changes
git add .

# Commit with message
git commit -m "Update: Added mini game documentation"

# Push to GitHub
git push
```

### Quick One-Liner (Careful!)
```bash
# Add, commit, and push in one go
git add . && git commit -m "Quick update" && git push
```

---

## 🔄 Update Your Fork

### Sync with Original Repo
```bash
# Add original repo (one time only)
git remote add upstream https://github.com/ORIGINAL/ether-trials.git

# Get latest changes
git fetch upstream

# Merge into your main
git checkout main
git merge upstream/main

# Push to your fork
git push origin main
```

---

## 🌿 Branch Operations

### Create New Branch
```bash
# Create and switch to new branch
git checkout -b feature/your-feature

# Or separate commands
git branch feature/your-feature
git checkout feature/your-feature
```

### Switch Branches
```bash
# Switch to main
git checkout main

# Switch to feature branch
git checkout feature/your-feature
```

### Merge Branch
```bash
# Switch to main
git checkout main

# Merge feature branch into main
git merge feature/your-feature

# Push merged changes
git push
```

### Delete Branch
```bash
# Delete local branch
git branch -d feature/your-feature

# Delete remote branch
git push origin --delete feature/your-feature
```

---

## 📦 Pull and Clone

### Clone Repository
```bash
# Clone your repo
git clone https://github.com/YOUR_USERNAME/ether-trials.git

# Enter directory
cd ether-trials
```

### Pull Latest Changes
```bash
# Pull from GitHub
git pull

# Or be specific
git pull origin main
```

---

## 🔍 View Information

### Check Status
```bash
# See changed files
git status

# See branch
git branch

# See remotes
git remote -v
```

### View History
```bash
# See commit history
git log

# See recent commits (one line each)
git log --oneline

# See last 5 commits
git log --oneline -5

# See who changed what
git log --pretty=format:"%h - %an, %ar : %s"
```

### View Differences
```bash
# See unstaged changes
git diff

# See staged changes
git diff --staged

# See changes in specific file
git diff filename.md
```

---

## ↩️ Undo Operations

### Undo Last Commit (Keep Changes)
```bash
# Undo commit, keep files changed
git reset --soft HEAD~1
```

### Undo Last Commit (Discard Changes)
```bash
# ⚠️ WARNING: This deletes your changes!
git reset --hard HEAD~1
```

### Unstage File
```bash
# Remove from staging
git reset HEAD filename.md
```

### Discard Local Changes
```bash
# ⚠️ Discard changes in specific file
git checkout -- filename.md

# ⚠️ Discard ALL local changes
git reset --hard HEAD
```

---

## 🏷️ Tags and Releases

### Create Tag
```bash
# Create annotated tag
git tag -a v4.0.0 -m "EtherTrials TRIA v4 - Sustainable"

# Push tag to GitHub
git push origin v4.0.0

# Push all tags
git push --tags
```

### List Tags
```bash
# See all tags
git tag

# See tags with messages
git tag -n
```

### Delete Tag
```bash
# Delete local tag
git tag -d v4.0.0

# Delete remote tag
git push origin --delete v4.0.0
```

---

## 🔧 Fix Common Issues

### "Permission denied (publickey)"
```bash
# Generate new SSH key
ssh-keygen -t ed25519 -C "your_email@example.com"

# Copy public key
cat ~/.ssh/id_ed25519.pub

# Add to GitHub:
# Settings → SSH and GPG keys → New SSH key
```

### "Repository not found"
```bash
# Check remote URL
git remote -v

# Update remote URL
git remote set-url origin https://github.com/YOUR_USERNAME/ether-trials.git
```

### Merge Conflicts
```bash
# 1. Open conflicted files
# 2. Look for <<<<<<< HEAD markers
# 3. Edit to resolve conflicts
# 4. Remove conflict markers
# 5. Stage resolved files
git add .

# 6. Complete merge
git commit -m "Resolved merge conflicts"
```

### Forgot to Pull Before Push
```bash
# Pull with rebase
git pull --rebase

# If conflicts, resolve them, then:
git add .
git rebase --continue

# Push
git push
```

---

## 🗑️ Delete and Remove

### Remove File from Git (Keep Local)
```bash
# Stop tracking file
git rm --cached filename

# Commit removal
git commit -m "Remove file from tracking"
git push
```

### Remove File Completely
```bash
# Delete file and stage removal
git rm filename

# Commit
git commit -m "Delete filename"
git push
```

---

## 🔍 Search

### Search Commits
```bash
# Search commit messages
git log --grep="deployment"

# Search by author
git log --author="username"

# Search by date
git log --since="2025-11-01" --until="2025-11-03"
```

### Search Code
```bash
# Search in current files
git grep "function name"

# Search in all history
git log -S "function name"
```

---

## 🎯 Useful Aliases

### Set Up Shortcuts
```bash
# Add to ~/.gitconfig or run these commands:

git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.st status
git config --global alias.unstage 'reset HEAD --'
git config --global alias.last 'log -1 HEAD'
git config --global alias.visual 'log --oneline --graph --decorate --all'
```

### Use Aliases
```bash
# Now you can use:
git co main          # instead of git checkout main
git br               # instead of git branch
git ci -m "message"  # instead of git commit -m "message"
git st               # instead of git status
git visual           # pretty branch visualization
```

---

## 📊 GitHub-Specific

### Create Pull Request
```bash
# Push branch to GitHub
git push origin feature/your-feature

# Then on GitHub:
# 1. Go to your repository
# 2. Click "Compare & pull request"
# 3. Fill in details
# 4. Click "Create pull request"
```

### Close Issue via Commit
```bash
# Commit message closes issue #42
git commit -m "Fix: Resolved deployment bug. Closes #42"
git push
```

---

## ⚡ Super Quick Reference

| Task | Command |
|------|---------|
| Status | `git status` |
| Add all | `git add .` |
| Commit | `git commit -m "message"` |
| Push | `git push` |
| Pull | `git pull` |
| New branch | `git checkout -b name` |
| Switch branch | `git checkout name` |
| Merge | `git merge branch-name` |
| Clone | `git clone URL` |
| History | `git log --oneline` |

---

## 🎓 Learn More

- **Git Documentation**: https://git-scm.com/doc
- **GitHub Docs**: https://docs.github.com
- **Interactive Tutorial**: https://learngitbranching.js.org

---

## 💡 Pro Tips

1. **Commit Often** - Small commits are easier to manage
2. **Write Clear Messages** - "Fixed bug" vs "Fixed mobile wallet connection timeout"
3. **Pull Before Push** - Avoid conflicts
4. **Use Branches** - Keep main clean
5. **Test Locally** - Before pushing
6. **Read Error Messages** - They're usually helpful!

---

## 🆘 Emergency Commands

### "Help, I messed up everything!"
```bash
# See what happened
git reflog

# Go back to previous state (find commit hash from reflog)
git reset --hard abc1234

# Or go back one step
git reset --hard HEAD@{1}
```

### "I committed to wrong branch!"
```bash
# Create new branch with current changes
git branch new-correct-branch

# Go back to main
git checkout main

# Reset main to before commit
git reset --hard HEAD~1

# Switch to new branch (has your commit)
git checkout new-correct-branch
```

---

**Print this page for quick reference! 📄**

*Last updated: November 3, 2025*
