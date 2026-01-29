# Share MonetaDEX-Swap with Raphael (dev) and push to GitHub

Raphael will bring the project to production and push to GitHub. Follow these steps.

---

## What’s already done

- **Git repo** is initialized inside `MonetaDEX-Swap` (first commit created).
- **`.env` is in `.gitignore`** — API keys and secrets are not committed. Share them with Raphael separately (e.g. 1Password, secure chat).

---

## Your steps (you do this)

### Push checklist (do this first)

1. **Create the repo on GitHub** (if you haven’t):
   - Open **https://github.com/new** (logged in as **btbroker**).
   - **Repository name:** `MonetaDEX-Swap` (exact spelling).
   - **Private** or **Public** — your choice.
   - **Do not** check “Add a README”, “Add .gitignore”, or “Choose a license”.
   - Click **Create repository**.

2. **Push from your Mac** (in Terminal):
   ```bash
   cd /Users/bernardoteixeira/MonetaDEX-Swap
   git push -u origin main
   ```
   - If it asks for login, use your **btbroker** GitHub account (or a Personal Access Token if you use 2FA: GitHub → Settings → Developer settings → Personal access tokens → generate token with `repo` scope, use it as the password).

3. **Confirm:** Open **https://github.com/btbroker/MonetaDEX-Swap** in your browser — you should see the project files.

---

### 1. Create the GitHub repo (if not done above)

1. Go to **https://github.com/new** (logged in as **btbroker**).
2. **Repository name:** `MonetaDEX-Swap` (exact name — repo URL will be https://github.com/btbroker/MonetaDEX-Swap).
3. **Visibility:** Private (recommended) or Public.
4. **Do not** add a README, .gitignore, or license (the project already has them).
5. Click **Create repository**.

### 2. Add the remote and push (first time only)

In a terminal, from the project folder:

```bash
cd /Users/bernardoteixeira/MonetaDEX-Swap

git remote add origin https://github.com/btbroker/MonetaDEX-Swap.git

git branch -M main
git push -u origin main
```

If GitHub asks you to sign in, use your credentials or a Personal Access Token (Settings → Developer settings → Personal access tokens).

### 3. Invite Raphael as a collaborator

1. On GitHub, open the repo **MonetaDEX-Swap** (https://github.com/btbroker/MonetaDEX-Swap).
2. Go to **Settings** → **Collaborators** (or **Collaborators and teams** in an org).
3. Click **Add people**.
4. Enter **Raphael’s GitHub username or email** (the one he uses on GitHub).
5. Choose role: **Write** (or **Maintain** if you want him to manage settings).
6. Send the invite. Raphael will get an email to accept.

### 4. Share secrets with Raphael (outside GitHub)

Send him separately (e.g. 1Password, secure channel):

- **API keys** from `services/swaps-api/.env` (0x, OKX, etc.) so he can add them in production.
- **Fee recipient addresses** if different from the ones in the codebase.
- Any **production env** (e.g. `NEXT_PUBLIC_API_URL`, RPC URLs) when you have them.

Do **not** put real API keys in the repo or in docs.

---

## Raphael’s steps (send him this)

1. **Accept the GitHub invite** (email from GitHub).
2. **Clone the repo:**
   ```bash
   git clone https://github.com/btbroker/MonetaDEX-Swap.git
   cd monetadex-swap
   ```
3. **Install and run locally:**
   ```bash
   pnpm install
   pnpm dev
   ```
   - API: http://localhost:3001  
   - Web: http://localhost:3000  

4. **Add his own `.env`** (copy from `services/swaps-api/.env.example` and `apps/swaps-web/.env.example`; you share real API keys with him separately).

5. **Push to GitHub** when he has changes:
   ```bash
   git add .
   git commit -m "Description of changes"
   git push origin main
   ```

6. **Production:** Deploy swaps-api and swaps-web (e.g. Vercel for web, Railway/Fly.io/Render for API), set env vars in the hosting dashboard, and point the frontend to the production API URL.

---

## Repo URL

- **Repo:** https://github.com/btbroker/MonetaDEX-Swap  
- **Clone:** `git clone https://github.com/btbroker/MonetaDEX-Swap.git`

---

## Summary

| Step | Who | Action |
|------|-----|--------|
| 1 | You | Create repo on GitHub (no README/.gitignore). |
| 2 | You | `git remote add origin ...` and `git push -u origin main`. |
| 3 | You | Invite Raphael (Settings → Collaborators → Add people). |
| 4 | You | Share API keys / .env values with Raphael securely (not in GitHub). |
| 5 | Raphael | Accept invite, clone, `pnpm install`, `pnpm dev`, add .env from you. |
| 6 | Raphael | Push changes, deploy to production. |
