# Multiplayer Server Deployment Guide

## Option 1: Deploy to Render.com (Free)

1. **Create account** at [render.com](https://render.com)

2. **Create New Web Service**:
   - Connect your GitHub repo
   - Root Directory: `server`
   - Build Command: `npm install`
   - Start Command: `node index.js`
   - Instance Type: Free

3. **After deployment**, copy the URL (e.g., `https://clash-of-minds-server.onrender.com`)

4. **Update your frontend** `.env` file:
   ```
   VITE_SOCKET_SERVER_URL=https://clash-of-minds-server.onrender.com
   ```

---

## Option 2: Quick Test with ngrok (Temporary)

1. Install ngrok: `npm install -g ngrok`

2. Start your local server: `node server/index.js`

3. Expose it: `ngrok http 3001`

4. Copy the ngrok URL and share it with friends!

---

## After Deployment

Update your `.env` file:
```
VITE_SOCKET_SERVER_URL=https://your-deployed-url.onrender.com
```

Then rebuild: `npm run build`
