# Falak.io: Backup & Restore Guide (one page)

Keep this file next to `falak-backup.sh`. Backups contain real customer and accounting data, so keep them private.

---

## A. One-time setup (Mac, about 10 minutes)

1. **Install Homebrew**, if you don't have it. Open the **Terminal** app and paste the install line from https://brew.sh
2. **Install the PostgreSQL tools:**
   `brew install libpq`
3. **Put the backup folder somewhere safe**, e.g. `Documents/falak-backup/`. Then in Terminal:
   `cd ~/Documents/falak-backup && chmod +x falak-backup.sh`
4. **Find your database password.** It is the one you chose when you created the Supabase project. If you forgot it: Supabase → Project Settings → Database → **Reset database password**. The app keeps working, because it doesn't use this password.
   **Never send this password to anyone, including Claude.**

## B. Make a backup

`./falak-backup.sh`

- **First time only:** it asks for the **pooler host**. In Supabase, click **Connect** (top of the project), choose **Session pooler**, and copy only the part that looks like `aws-0-xx-xxxx-x.pooler.supabase.com`.
- It asks for the **database password**. Your typing is hidden. Answer **y** to save it in the Mac Keychain.
- **Result:** `Documents/Falak-Backups/falak-YYYY-MM-DD_HHMM.tar.gz`
- It keeps the newest 12 backups and deletes older ones.

**Make it weekly** (every Sunday 10:00, or the next time the Mac is awake):
`./falak-backup.sh --install-weekly`
To stop it: `./falak-backup.sh --remove-weekly`

**Once a month:** copy the newest backup file to Google Drive, iCloud, or a USB stick.

## C. What is inside a backup

| File | Contents |
|---|---|
| `data.sql` | All businesses, users/roles, records (invoices, receipts, customers…), history |
| `schema.sql` | Table structure (for reference) |
| `auth-users.sql` | Login accounts (emails + encrypted password hashes). Optional. |
| `counts.txt` | Number of rows per table, used to check a restore |

## D. Restore (only if something goes wrong)

> **Always restore into a NEW, empty Supabase project. Never restore over the live one.**

1. **Create a new Supabase project.** Note its database password.
2. **Set up the tables.** In the new project open **SQL Editor → New query**, paste all of `supabase-setup.sql`, and click **Run**.
3. **Unpack the backup.** In Terminal:
   `tar -xzf falak-YYYY-MM-DD_HHMM.tar.gz && cd falak-YYYY-MM-DD_HHMM`
4. **Load the data.** Use the new project's Session pooler connection string, from **Connect → Session pooler**:
   ```
   psql "postgresql://postgres.NEWREF:PASSWORD@HOST:5432/postgres" \
     --single-transaction --variable ON_ERROR_STOP=1 \
     --command 'SET session_replication_role = replica' \
     --file auth-users.sql --file data.sql
   ```
   - If `auth-users.sql` gives an error, run it again without `--file auth-users.sql`. Users then simply **sign up again** with the same email, and their roles come back automatically.
5. **Check the counts.** In the new project's SQL Editor:
   ```sql
   select type, count(*) from records group by type order by 1;
   ```
   Compare the result with `counts.txt`.
6. **Point the app to the new project.** Change `supabaseUrl` and `anonKey` in `config.js` and redeploy. Then in Authentication → URL Configuration, add `https://falakhesab.com`.
7. **Check in the app:** open a few customers and confirm their balances match before using it again.

*Tested: a sample backup restored with identical row counts and the live-update (Realtime) setting re-enabled.*

## E. Supabase's own backups (dashboard check)

Supabase → your project → **Database** (left menu) → **Backups**.

- **Free plan:** usually shows no backups, or an "upgrade" message. That is why this script exists.
- **Pro plan ($25/month):** daily backups kept for 7 days, with a **Restore** button.
- **Free projects pause after 7 days without use.** Open falakhesab.com at least once a week.
