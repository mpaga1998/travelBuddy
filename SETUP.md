# 🚀 Development Setup Guide

## Quick Start (Recommended for most dev work)

### Local Development (Browser on same computer)

```bash
npm run dev:all
```

Then open: **http://localhost:5173**

That's it! Backend + Frontend run together.

---

## Phone Testing via ngrok

If you want to test on your phone via ngrok:

### Step 1: Start the app locally
```bash
npm run dev:all
```

### Step 2: In two NEW terminals, start ngrok tunnels

Terminal 1 (Backend):
```bash
npm run ngrok:be
```
You'll see:
```
Forwarding    https://xxx-xxx-xxx.ngrok-free.dev -> http://localhost:3000
```
Copy that URL.

Terminal 2 (Frontend):
```bash
npm run ngrok:fe
```
You'll see:
```
Forwarding    https://yyy-yyy-yyy.ngrok-free.dev -> http://localhost:5173
```
Copy that URL.

### Step 3: Update your .env

```env
VITE_API_BASE_URL=https://xxx-xxx-xxx.ngrok-free.dev/api
```
(Replace `xxx-xxx-xxx.ngrok-free.dev` with your actual backend ngrok URL)

### Step 4: Restart frontend (Ctrl+C and run again)
```bash
npm run dev:frontend
```

### Step 5: Access on your phone
Go to: `https://yyy-yyy-yyy.ngrok-free.dev` (your frontend ngrok URL)

---

## Summary

| Setup | Command | Where to access |
|-------|---------|-----------------|
| **Local Dev** | `npm run dev:all` | `http://localhost:5173` |
| **Phone via ngrok** | `npm run dev:all` + `npm run ngrok:be/fe` + update `.env` | `https://xxx.ngrok-free.dev` |

---

## Troubleshooting

**"Failed to fetch" error on phone?**
- Check that `.env` has the correct ngrok backend URL
- Make sure all 4 services are running (backend, frontend, 2 ngrok tunnels)

**Different ngrok URLs each time?**
- Free ngrok creates new URLs on restart
- Always update `.env` with the new backend URL

**Want permanent ngrok URLs?**
- Sign up for paid ngrok account (allows reserved domains)
