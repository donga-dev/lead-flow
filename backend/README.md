# WhatsApp Backend Server

Backend server for receiving WhatsApp Business API webhooks and providing API endpoints for the frontend.

## Installation

```bash
cd backend
npm install
```

## Configuration

Create a `.env` file (optional):

```env
PORT=3001
WEBHOOK_VERIFY_TOKEN=your_secret_token_here
```

**Note:** Backend runs on port 3001 by default (React dev server uses port 3000)

## Running

```bash
# Start server
npm start

# Or run with auto-reload (development)
npm run dev
```

## API Endpoints

### Webhook Endpoints

- `GET /webhook` - Webhook verification
- `POST /webhook` - Receive incoming messages

### Frontend API

- `GET /api/messages/:phoneNumber` - Get messages for a contact
- `GET /api/messages/new/:phoneNumber` - Get new messages (polling)
- `GET /api/contacts` - Get all contacts with messages
- `POST /api/messages` - Store a sent message
- `GET /health` - Health check

## Webhook Setup

1. Deploy server to a publicly accessible URL
2. Configure webhook in Meta Business Manager:
   - Webhook URL: `https://your-domain.com/webhook`
   - Verify Token: `your_secret_token_here` (or set in .env)
3. Subscribe to events: `messages`, `message_status`

## Message Storage

Messages are stored in `messages.json` file. Each contact has up to 1000 messages.

## Testing Locally

1. **Expose your local server** using a tunneling service (e.g., ngrok, localtunnel):
   - Webhook URL: `https://your-tunnel-url.com/webhook`
   - Verify Token: `my_verify_token` (or your custom token)

2. **Test webhook**:
   - Send a message to your WhatsApp Business number
   - Check server logs for incoming message
   - Check frontend - message should appear

## Frontend Configuration

Update frontend `.env` file:

```bash
REACT_APP_BACKEND_URL=http://localhost:3001
```

## Production Deployment

1. **Deploy backend** to a server (Heroku, AWS, DigitalOcean, etc.)
2. **Set environment variables**:
   - `PORT`: Server port
   - `WEBHOOK_VERIFY_TOKEN`: Secure random token
3. **Update frontend** `.env`:
   - `REACT_APP_BACKEND_URL`: Your backend URL
4. **Configure webhook** in Meta Business Manager with production URL
