# Yoga this week

The next 7 days of yoga classes at my Cape Town studios, on one static page at `joshstein.io/yoga`. A systemd timer rebuilds it every 30 minutes. Each run first pulls `main`, so a push goes live within 30 minutes. Studios are configured in `src/studios.ts`. Terms are in [CONTEXT.md](CONTEXT.md).

## Local

```sh
npm install
npm start   # writes data/*.json and dist/index.html
npm test
```

## VPS setup (once)

1. Install Node 24 with Volta. systemd does not load Volta's PATH, so the unit sets it.
2. Run as your normal user. `$USER` and `$HOME` expand when pasted.

   ```sh
   git clone https://github.com/joshestein/ct_yoga.git ~/yoga
   (cd ~/yoga && npm ci --omit=dev)
   sudo mkdir -p /var/www/yoga && sudo chown $USER /var/www/yoga

   sudo tee /etc/systemd/system/yoga.service >/dev/null <<EOF
   [Unit]
   Description=Fetch yoga schedules and render the dashboard
   Wants=network-online.target
   After=network-online.target

   [Service]
   Type=oneshot
   User=$USER
   WorkingDirectory=$HOME/yoga
   Environment=PATH=$HOME/.volta/bin:/usr/local/bin:/usr/bin:/bin
   # "-": a failed pull still runs the fetch with the current code
   ExecStartPre=-/bin/sh scripts/update.sh
   ExecStart=$HOME/.volta/bin/node src/main.ts
   # /var/lib/yoga keeps the last good Snapshot per Studio
   StateDirectory=yoga
   Environment=YOGA_DATA_DIR=/var/lib/yoga
   Environment=YOGA_OUT_FILE=/var/www/yoga/index.html
   EOF

   sudo tee /etc/systemd/system/yoga.timer >/dev/null <<EOF
   [Unit]
   Description=Refresh the yoga dashboard every 30 minutes

   [Timer]
   OnCalendar=*:0/30
   Persistent=true

   [Install]
   WantedBy=timers.target
   EOF

   sudo systemctl daemon-reload && sudo systemctl enable --now yoga.timer && sudo systemctl start yoga.service
   ```

3. Update `/etc/caddy/Caddyfile`, then `sudo systemctl reload caddy`. The website's directives move into `handle`. Without it, `try_files` rewrites `/yoga/` to the website's `index.html`.

   ```caddy
   joshstein.io {
       encode
       header {
           X-Frame-Options "SAMEORIGIN"
           X-Content-Type-Options "nosniff"
           Referrer-Policy "same-origin"
           X-XSS-Protection "1; mode=block"
           Strict-Transport-Security "max-age=31536000"
       }

       # Separate root: the website deploy runs rsync --delete on /var/www/joshstein
       redir /yoga /yoga/
       handle_path /yoga/* {
           root * /var/www/yoga
           file_server
       }

       handle {
           root * /var/www/joshstein
           file_server
           try_files {path} {path}/ /index.html
       }
   }
   ```

## Stale warning on the page

A Studio's fetch failed, and the page shows its last good data. Find the error with `journalctl -u yoga.service -n 50`.
