# Sarcy backend — AWS EC2 deployment (historical record)

> **Status: DECOMMISSIONED on 2026-09-02.** The EC2 instance described here was
> terminated to stop AWS charges. This document exists so the setup can be
> understood and rebuilt without re-deriving it. Nothing here is live.

This captures how the `sarcast.ai` backend actually ran on AWS between
2026-04-10 and 2026-09-02, recovered from the host before it was destroyed.

---

## 1. What the deployment actually was

A single t3.micro running `uvicorn` under `nohup`, exposed to the internet
through a free Cloudflare **quick tunnel**. There was no load balancer, no
systemd unit, no container, and no reverse proxy.

```
client ──> https://<random>.trycloudflare.com   (Cloudflare quick tunnel, ephemeral)
              │
              └─> cloudflared (on the box) ──> http://localhost:8000
                                                  │
                                                  └─> uvicorn / FastAPI (main:app)
                                                        │
                                                        ├─> Groq API      (LLM inference)
                                                        └─> Supabase REST (vibe_profiles)
```

Port `8000` was *also* open directly to `0.0.0.0/0`, so the box was reachable
both via the tunnel and via `http://<public-ip>:8000` (see Security notes).

## 2. Host facts

| Property | Value |
|---|---|
| AWS account | `641332413535` |
| Region / AZ | `us-east-1` / `us-east-1d` |
| Instance ID | `i-03d62b8d8da2a4cad` |
| Name tag | `sarcast-ai` |
| Type | `t3.micro` |
| AMI | `ami-0ea87431b78a82070` — Amazon Linux 2023 (kernel 6.1) |
| Login user | `ec2-user` |
| SSH key pair | `sarcast-key2` (private key was **never** stored locally — see below) |
| Root volume | 8 GiB gp3, `vol-09772df93646a6f59` (34% used, 2.7 GB) |
| Public IP | `52.91.33.106` (auto-assigned, not an Elastic IP) |
| Security group | `sarcast-sg` (`sg-04b943d66ad42f4d6`) |
| Subnet | `subnet-03fdf3bcd9c6ca372` (default VPC) |
| IAM instance profile | none |
| Launched | 2026-04-10 |
| Cost | ~$12/month (compute + public IPv4 + EBS) |

Security group inbound rules:

| Port | Source | Purpose |
|---|---|---|
| 22 | `0.0.0.0/0` | SSH |
| 8000 | `0.0.0.0/0` | uvicorn, exposed directly |

## 3. Runtime

- **Python 3.11.14** (system `python3.11`; no virtualenv — packages installed
  to `~/.local` with `pip --user`)
- `uvicorn` 0.29.0, `fastapi` 0.111.0, `httpx` 0.27.0, `pydantic` 2.7.1
- `cloudflared` 2026.3.0, a standalone binary at `~/Sarcy/backend/cloudflared`
- Code lived at `~/Sarcy`, a clone of `https://github.com/Gowtham369/Sarcy.git`
- Deploys were done by hand: `git pull`, then restart the process

Full dependency list is in `requirements.txt` at the repo root.

## 4. How it was started

Neither process was managed by systemd. Both were bare `nohup` background jobs,
which means **neither survived a reboot** — after any stop/start of the
instance, both commands had to be re-run by hand over SSH.

Backend (run from `~/Sarcy/backend`):

```bash
pkill -f uvicorn
cd ~/Sarcy/backend && git pull
GROQ_API_KEY="..." \
SUPABASE_URL="https://<project>.supabase.co" \
SUPABASE_KEY="..." \
API_KEY="" \
nohup uvicorn main:app --host 0.0.0.0 --port 8000 &
```

Tunnel (run from `~/Sarcy/backend`):

```bash
pkill -f cloudflared
nohup ./cloudflared tunnel --url http://localhost:8000 --no-autoupdate &
```

Logs for both went to `~/Sarcy/backend/nohup.out` (uvicorn access log plus the
cloudflared banner containing the generated tunnel URL).

Health check — the app answers on `/`:

```console
$ curl http://52.91.33.106:8000/
{"status":"sarcast.ai is running. Took you long enough."}
```

## 5. Configuration

There was **no `.env` file on the server.** Every secret was typed inline on the
`uvicorn` command line, so the only record of the values was the shell history
(`~/.bash_history`) and the running process environment.

`backend/main.py` reads four variables via `os.getenv`, all defaulting to `""`:

| Variable | Purpose | Notes |
|---|---|---|
| `GROQ_API_KEY` | Groq inference API | required for chat to work |
| `SUPABASE_URL` | Supabase project REST base URL | used for `vibe_profiles` |
| `SUPABASE_KEY` | Supabase **anon** key | sent as `apikey` + bearer token |
| `API_KEY` | shared secret guarding the API | **was set to empty string** |

`HF_TOKEN` appears in `backend/.env.example` and in older start commands, but
the current `main.py` does not read it — it is a leftover from the earlier
HuggingFace-based implementation.

> Values are deliberately not recorded in this repo. They were exported to a
> local file outside the working tree when the box was decommissioned. Treat all
> of them as compromised and rotate before reuse — see Security notes.

## 6. Security notes (issues found at decommission time)

These were real problems with the deployment. Fix them in any rebuild:

1. **`API_KEY` was empty.** `main.py` only enforces the key when the variable is
   truthy (`if API_KEY and x_api_key != API_KEY`). With it set to `""` the auth
   check was disabled entirely and every endpoint was open. The `401`s in the
   log are from clients sending a key the server was not checking.
2. **Port 8000 open to the world.** The tunnel gives Cloudflare's TLS and DDoS
   protection; the direct `0.0.0.0/0` rule on 8000 bypassed all of it and served
   the API in plaintext HTTP. The log shows opportunistic internet scanners
   hitting `/` and `/favicon.ico`. Only the tunnel should have been reachable.
3. **SSH open to the world** (`0.0.0.0/0` on 22). Should be scoped to a known IP
   or replaced with SSM Session Manager.
4. **Secrets in shell history.** Passing keys inline writes them to
   `~/.bash_history` in plaintext, forever. Use an `.env` file with mode `600`
   (already gitignored) or SSM Parameter Store.
5. **The private key for `sarcast-key2` was lost.** Access at decommission had to
   be recovered with EC2 Instance Connect, which pushes a temporary 60-second
   key (only possible because the AMI was AL2023, which ships the agent).

## 7. Fragilities worth knowing

- **The tunnel URL was ephemeral.** `cloudflared tunnel --url` generates a new
  random `*.trycloudflare.com` hostname on every start, with no persistence and
  no SLA. The last one issued was
  `https://reduction-thoroughly-stud-substantial.trycloudflare.com`.
  Any client with that URL hardcoded broke whenever the tunnel restarted. A
  named tunnel bound to a real DNS record is the fix.
- **No process supervision.** A crash or reboot took the service down until
  someone SSH'd in. `systemd` units (or `--restart` under a container) would
  have removed the manual step.
- **No backups of the box.** Acceptable here because all state lives in
  Supabase and all code lives in GitHub — the instance was genuinely
  disposable, which is what made deleting it safe.

## 8. State of the code at shutdown

The checkout on the server was at commit `b597f79`, which is an ancestor of
`origin/main` — **the box held no unpushed commits and no unique code.**
Everything it ran is in this repository. Untracked files on the host were only
build/runtime debris: `__pycache__/`, `nohup.out`, and the `cloudflared` binary.

## 9. If you need to rebuild this

The cheap path, in rough order of preference:

1. **Don't use EC2.** This is a single stateless FastAPI process with all
   persistence in Supabase — it fits a free/cheap PaaS tier. `railway.toml`,
   `runtime.txt`, and `requirements.txt` are already in the repo for exactly
   this, and `deployment-guide-v2.md` covers that route.
2. If you do want a box again: launch a t3.micro/t4g.micro on AL2023, clone the
   repo, `pip install --user -r requirements.txt`, put the secrets in
   `backend/.env` (mode 600), and run uvicorn from a **systemd unit** so it
   restarts on boot. Restrict the security group to port 22 from your IP only,
   and let the tunnel handle public traffic instead of opening 8000.
3. Use a **named** Cloudflare tunnel so the public hostname is stable.

## 10. Decommission record

Performed 2026-09-02 as part of stripping AWS account `641332413535` to stop
charges. The account's real cost was an unrelated Aurora PostgreSQL cluster
(`database-1`, 2× `db.r7g.large` I/O-Optimized) billing ~$18.65/day — roughly
$560/month against a database holding 1 GB. That cluster was deleted first; this
instance, at ~$12/month, was terminated alongside it.

Removed with the instance: the 8 GiB root volume and the auto-assigned public IP
`52.91.33.106`. Nothing was snapshotted, by decision — all code is in GitHub and
all data is in Supabase.
