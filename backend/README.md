# WhatsApp & Instagram Backend Server

Backend server for receiving WhatsApp Business API and Instagram webhooks and providing API endpoints for the frontend.

## Installation

```bash
cd backend
npm install
```

## Configuration

Create a `.env` file in the `backend` directory:

```env
# Server Configuration
PORT=3001
NODE_ENV=development
WEBHOOK_VERIFY_TOKEN=your_secret_token_here

# MongoDB Connection
# For local MongoDB: mongodb://localhost:27017/leadflow
# For MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/leadflow?retryWrites=true&w=majority
MONGODB_URI=mongodb://localhost:27017/leadflow

# JWT Configuration (for authentication)
JWT_SECRET=your-secret-key-here-change-this-in-production
JWT_EXPIRES_IN=7d
```

**Note:** 
- Backend runs on port 3001 by default (React dev server uses port 3000)
- MongoDB connection is required. If `MONGODB_URI` is not set, it defaults to `mongodb://localhost:27017/leadflow`
- Make sure MongoDB is running locally or provide a valid MongoDB Atlas connection string
- JWT_SECRET is required for authentication. Use a strong, random secret in production

## Running

```bash
# Start server
npm start

# Or run with auto-reload (development)
npm run dev
```

## API Endpoints

### Authentication Endpoints

#### Register User
- `POST /api/auth/register` - Register a new user
  - **Body:**
    ```json
    {
      "name": "John Doe",
      "email": "john@example.com",
      "password": "password123"
    }
    ```
  - **Response:**
    ```json
    {
      "success": true,
      "message": "User registered successfully",
      "data": {
        "user": {
          "id": "user_id",
          "name": "John Doe",
          "email": "john@example.com"
        },
        "token": "jwt_token_here"
      }
    }
    ```

#### Login User
- `POST /api/auth/login` - Login user
  - **Body:**
    ```json
    {
      "email": "john@example.com",
      "password": "password123"
    }
    ```
  - **Response:**
    ```json
    {
      "success": true,
      "message": "Login successful",
      "data": {
        "user": {
          "id": "user_id",
          "name": "John Doe",
          "email": "john@example.com"
        },
        "token": "jwt_token_here"
      }
    }
    ```

#### Get Current User
- `GET /api/auth/me` - Get current authenticated user
  - **Headers:** `Authorization: Bearer <token>`
  - **Response:**
    ```json
    {
      "success": true,
      "data": {
        "user": {
          "id": "user_id",
          "name": "John Doe",
          "email": "john@example.com",
          "createdAt": "2025-01-01T00:00:00.000Z"
        }
      }
    }
    ```

#### Update Profile
- `PUT /api/auth/profile` - Update user profile
  - **Headers:** `Authorization: Bearer <token>`
  - **Body:**
    ```json
    {
      "name": "Jane Doe",
      "email": "jane@example.com"
    }
    ```

#### Change Password
- `PUT /api/auth/change-password` - Change user password
  - **Headers:** `Authorization: Bearer <token>`
  - **Body:**
    ```json
    {
      "currentPassword": "oldpassword",
      "newPassword": "newpassword123"
    }
    ```

### Webhook Endpoints

#### WhatsApp Webhooks
- `GET /webhook` - WhatsApp webhook verification
- `POST /webhook` - Receive incoming WhatsApp messages

#### Instagram Webhooks
- `GET /webhook/instagram` - Instagram webhook verification
- `POST /webhook/instagram` - Receive incoming Instagram messages

### Frontend API

#### WhatsApp Endpoints
- `GET /api/messages/:phoneNumber` - Get messages for a WhatsApp contact
- `GET /api/messages/new/:phoneNumber` - Get new WhatsApp messages (polling)
- `GET /api/contacts` - Get all WhatsApp contacts with messages
- `POST /api/messages` - Store a sent WhatsApp message

#### Instagram Endpoints
- `GET /api/instagram/messages/:userId` - Get messages for an Instagram user
- `GET /api/instagram/messages/new/:userId` - Get new Instagram messages (polling)
- `GET /api/instagram/contacts` - Get all Instagram contacts with messages
- `POST /api/instagram/messages` - Store a sent Instagram message

#### General Endpoints
- `GET /health` - Health check

## Webhook Setup

### WhatsApp Webhook Setup

1. Deploy server to a publicly accessible URL
2. Configure webhook in Meta Business Manager:
   - Webhook URL: `https://your-domain.com/webhook`
   - Verify Token: `your_secret_token_here` (or set in .env)
3. Subscribe to events: `messages`, `message_status`

### Instagram Webhook Setup

1. Deploy server to a publicly accessible URL
2. Configure webhook in Meta Business Manager:
   - **Webhook URL**: `https://your-domain.com/webhook/instagram`
   - **Verify Token**: `your_secret_token_here` (same token as WhatsApp or set `WEBHOOK_VERIFY_TOKEN` in .env)
3. Subscribe to Instagram events:
   - For Instagram Business accounts: Subscribe to `messages` and `messaging` fields
   - The webhook will automatically handle both `instagram` and `page` object types
4. Ensure your Instagram Business account is connected to a Facebook Page

## Database Setup

### MongoDB Installation

1. **Local MongoDB:**
   - Install MongoDB Community Edition from [mongodb.com](https://www.mongodb.com/try/download/community)
   - Start MongoDB service: `mongod` (or use your system's service manager)
   - Default connection: `mongodb://localhost:27017/leadflow`

2. **MongoDB Atlas (Cloud):**
   - Create a free account at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
   - Create a cluster and get your connection string
   - Update `MONGODB_URI` in `.env` with your Atlas connection string

### Connection

The server automatically connects to MongoDB on startup. You'll see a success message:
```
✅ MongoDB Connected: localhost
📊 Database: leadflow
```

## Message Storage

Messages are currently stored in JSON files (`messages.json`, `instagram_messages.json`, `facebook_messages.json`) for backward compatibility. You can migrate to MongoDB by creating models and updating the storage logic.

## Testing Locally

1. **Expose your local server** using a tunneling service (e.g., ngrok, localtunnel):
   - Webhook URL: `https://your-tunnel-url.com/webhook`
   - Verify Token: `my_verify_token` (or your custom token)

2. **Test webhook**:
   - **WhatsApp**: Send a message to your WhatsApp Business number
   - **Instagram**: Send a message to your Instagram Business account
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
