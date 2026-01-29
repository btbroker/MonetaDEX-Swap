# Fix Git / GitHub credentials on Mac

Use this when you get **403 Permission denied** or need to push as a different GitHub account (e.g. **btbroker**).

---

## Step 1: Clear cached GitHub credentials

### Method A – Keychain Access (recommended)

1. Open **Keychain Access**  
   - Spotlight: **Cmd+Space** → type `Keychain Access` → Enter  
   - Or: **Applications** → **Utilities** → **Keychain Access**

2. In the **Search** box (top right), type: **github**

3. Delete the GitHub entry:
   - Look for **github.com** (or **Git Credential Manager**)
   - Double‑click it → **Access Control** tab → **Delete**  
   - Or right‑click → **Delete** “github.com”

4. Confirm **Delete** when asked.

### Method B – Terminal (credential helper)

Run in Terminal:

```bash
git credential-osxkeychain erase
host=github.com
protocol=https
```

Press **Enter** twice (empty line then Enter). That clears the stored GitHub login.

---

## Step 2: Push again (Git will ask for login)

```bash
cd /Users/bernardoteixeira/MonetaDEX-Swap
git push -u origin main
```

When prompted:

- **Username:** the GitHub user that has push access to the repo (e.g. **btbroker**)
- **Password:** that account’s **Personal Access Token** (not your normal password)

---

## Step 3: Create a Personal Access Token (if you don’t have one)

1. On GitHub, log in as the account you want to use (e.g. **btbroker**).
2. Click your **profile picture** (top right) → **Settings**.
3. Left sidebar: **Developer settings** → **Personal access tokens** → **Tokens (classic)**.
4. **Generate new token** → **Generate new token (classic)**.
5. **Note:** e.g. `Mac push MonetaDEX-Swap`
6. **Expiration:** e.g. 90 days or No expiration.
7. **Scopes:** check **repo** (full control of private repositories).
8. Click **Generate token**.
9. **Copy the token** and use it as the **password** when Git asks (paste it, don’t type it).

---

## Summary

| Step | Action |
|------|--------|
| 1 | Clear credentials: Keychain Access → search “github” → delete **github.com** (or use `git credential-osxkeychain erase` in Terminal). |
| 2 | Run `git push -u origin main`; when prompted, use **btbroker** (or the right user) and that account’s **Personal Access Token** as the password. |
| 3 | If you don’t have a token: GitHub → Settings → Developer settings → Personal access tokens → Generate (scope **repo**). |

After this, Git will use the account you entered until you clear credentials again.
