# Soulink online (free): open it on your phone anytime, laptop can be off

One https address serves everything (the app + its server), for example `https://soulink-xvbd.onrender.com`.
Friends need the **access code** you choose (asked once per phone). The login code (OTP) is shown on
screen and filled in automatically, the same as on the laptop, because there is no paid SMS yet.

| Piece | Free service | What it does |
|---|---|---|
| Code | **GitHub** (private repository) | Keeps the code. Every upload builds the web app automatically |
| App + server | **Render** (free web service) | Runs Soulink at your https address |
| Database | **Azure SQL Database** (free offer) | Same SQL Server database as on the laptop. Photos and voice notes are stored here too |

**Good to know about free plans**
- Render sleeps after 15 minutes with nobody using it. The next open takes about a minute ("Soulink is waking up").
- Azure's free database gives 100,000 compute-seconds a month. Pick "auto-pause until next month" so it never bills you.
  It also sleeps when idle and takes up to a minute to wake.
- The free database offer itself needs no credit card, but creating a new Azure account may ask for one to confirm who you are (not charged). Render and GitHub need no card.
- Runs on the laptop only for now: Soulmoji AI faces, the chat/voice translator, and the free AI referee
  (online they fall back to the built-in Soulmoji engine and the basic Argue judge).

---

## One-time setup (about 30 minutes)

### 1. GitHub: a private home for the code
1. Sign up / sign in at https://github.com.
2. Top right **+** > **New repository**. Name: `soulink`. Choose **Private**. Do NOT tick README / .gitignore / licence. **Create**.
3. Copy the address shown (like `https://github.com/yourname/soulink.git`).
4. Install Git if you don't have it: https://git-scm.com/download/win (keep all default options).
5. Double-click **`PUBLISH-SOULINK.bat`**, paste the address when asked, and sign in to GitHub in the window that opens.
6. On GitHub open your repository > **Actions**. "Build Soulink for the cloud" runs (about 3 minutes). When it shows a green tick,
   a branch called **deploy** exists. (If Actions asks you to enable workflows, click the green button.)

### 2. Azure: the free database
1. Go to https://portal.azure.com and sign in with a Microsoft account (create one if needed). Complete the free sign-up.
2. Open https://aka.ms/azuresqlhub > in **Create a database** click **Start free**. Check the page shows **"Free offer applied!"** and the cost summary says 0.
3. Fill in:
   - Resource group: **Create new** > `soulink`
   - Database name: `soulink`
   - Server: **Create new** > name e.g. `soulink-sai` (becomes `soulink-sai.database.windows.net`),
     location **(Asia Pacific) Southeast Asia**, authentication **Use SQL authentication**, choose an admin login and a strong password. Note them down.
   - Behaviour when free limit reached: **Auto-pause the database until next month**.
4. **Next: Networking**: Connectivity **Public endpoint**. Turn **on** "Allow Azure services and resources to access this server" and **on** "Add current client IP address".
5. **Review + create** > **Create**. Wait for "Your deployment is complete".
6. Open the **SQL server** (not the database) > **Security > Networking** > **+ Add a firewall rule**:
   name `everyone`, start `0.0.0.0`, end `255.255.255.255` > **Save**. (Render's addresses change, so it must be open; your strong password protects it.)
7. On the laptop double-click **`SETUP-CLOUD.bat`** and type the server name, database `soulink`, login, password and an **access code** for friends.
   It should say "Connected to the cloud database".

### 3. Render: put it online
1. Go to https://render.com > **Get Started** > sign up **with GitHub**.
2. **New +** > **Blueprint**. Connect your `soulink` repository (allow Render to see it). Leave the branch as **main**:
   the blueprint itself tells Render to run the ready-built **deploy** branch.
3. Render reads `render.yaml` and asks for 5 values: `DB_SERVER`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `ACCESS_CODE`
   (the same ones you typed in SETUP-CLOUD; it prints them for you). **Apply**.
4. First start takes 5-8 minutes. Render > **soulink** shows your address, e.g. `https://soulink-xvbd.onrender.com`.
   **Logs** should end with "Soulink server running".

### 4. Bring your current accounts and photos (optional)
Double-click **`COPY-DATA-TO-CLOUD.bat`**, type `YES`. Everything on the laptop (your account, Nikhil's, posts, chats, Soul DNA, photos)
is copied to the cloud. Run it again any time you want the cloud to match the laptop (it replaces the cloud data).

### 5. On your iPhone
Open the address in Safari > enter the access code > log in.
Then **Share** > **Add to Home Screen**: Soulink gets its own icon and opens full screen like an app.

---

## Every time you want the latest version online
Double-click **`PUBLISH-SOULINK.bat`**. GitHub builds it and Render switches over by itself in about 5-8 minutes.
Nothing else to run, and the laptop can be off afterwards.

## If something goes wrong
- **"Soulink is waking up"** for more than 2 minutes: Render > soulink > **Logs**. "Could not connect to SQL Server" means the Azure firewall rule
  (step 2.6) or a DB_ value is wrong (Render > soulink > **Environment**).
- **GitHub Actions red cross**: open it, the failing step says why. Usually fixed by running PUBLISH-SOULINK.bat again.
- **Change the access code**: Render > soulink > Environment > `ACCESS_CODE` > Save (restarts by itself).
