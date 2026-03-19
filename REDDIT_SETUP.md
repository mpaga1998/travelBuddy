# Reddit API Integration Setup

This guide explains how to set up Reddit API access for searching and fetching posts from Reddit.

## Step 1: Create a Reddit App

1. Go to [https://reddit.com/prefs/apps](https://reddit.com/prefs/apps)
2. Click **Create Another App**
3. Fill in the form:
   - **Name**: `backpack-map-demo` (or your app name)
   - **App type**: Select **script** (for personal use)
   - **Description**: Optional
   - **About URL**: Optional
   - **Redirect URI**: `http://localhost:3000` (not used for script apps, but required)
4. Click **Create app**
5. You'll see your credentials:
   - **client_id**: The ID shown under your app name
   - **client_secret**: The "secret" field

## Step 2: Get Refresh Token

For a script app, you need to generate a refresh token. Use this helper tool:

```bash
npx reddit-oauth-helper
```

Or manually:

1. Go to [https://github.com/not-an-aardvark/reddit-oauth-helper](https://github.com/not-an-aardvark/reddit-oauth-helper) for detailed instructions
2. The tool will guide you through the OAuth flow
3. You'll receive a `refresh_token`

## Step 3: Configure Environment

Create a `.env` file in the project root (copy from `.env.example`):

```env
REDDIT_CLIENT_ID=your_client_id_here
REDDIT_CLIENT_SECRET=your_client_secret_here
REDDIT_REFRESH_TOKEN=your_refresh_token_here
REDDIT_USER_AGENT=backpack-map-demo/1.0
```

Replace with your actual credentials from Reddit.

## API Endpoints

### Search Reddit

**POST** `/api/reddit/search`

Search for posts across Reddit or within a specific subreddit.

Request body:
```json
{
  "query": "best hiking trails",
  "subreddit": "backpacking",
  "limit": 25,
  "timeFilter": "month"
}
```

Response:
```json
{
  "success": true,
  "results": [
    {
      "title": "Post title",
      "author": "username",
      "score": 1234,
      "url": "https://example.com",
      "subreddit": "backpacking",
      "created": 1234567890,
      "selftext": "Post body text",
      "permalink": "https://reddit.com/r/backpacking/comments/..."
    }
  ]
}
```

**Query Parameters:**
- `query` (required): Search term
- `subreddit` (optional): Limit search to specific subreddit (e.g., "backpacking", "travel")
- `limit` (optional): Number of results (default: 25, max: 100)
- `timeFilter` (optional): `all`, `year`, `month`, `week`, `day`, `hour` (default: `all`)

### Get Top Posts

**GET** `/api/reddit/top/:subreddit`

Get top posts from a specific subreddit.

Example: `GET /api/reddit/top/backpacking?timeFilter=month&limit=10`

**Query Parameters:**
- `timeFilter` (optional): `all`, `year`, `month`, `week`, `day`, `hour` (default: `month`)
- `limit` (optional): Number of results (default: 25)

### Get Hot Posts

**GET** `/api/reddit/hot/:subreddit`

Get currently hot posts from a specific subreddit.

Example: `GET /api/reddit/hot/travel?limit=10`

**Query Parameters:**
- `limit` (optional): Number of results (default: 25)

## Usage Examples

### Frontend TypeScript

```typescript
// Search for travel recommendations
const response = await fetch('http://localhost:3000/api/reddit/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'travel to Japan',
    subreddit: 'travel',
    limit: 10,
  }),
});

const data = await response.json();
console.log(data.results);
```

### Relevant Subreddits for Travel

- `r/backpacking` - Budget travel and backpacking
- `r/travel` - General travel topics
- `r/solotravel` - Solo travel advice
- `r/digitalnomad` - Remote work and travel
- `r/hiking` - Hiking trails and outdoor activities
- `r/CouchSurfing` - Budget accommodation
- City subreddits: `r/Tokyo`, `r/Paris`, `r/NewYork`, etc.

## Rate Limiting

Reddit's API rate limit is **60 requests per minute** for authenticated requests. The library handles this automatically with exponential backoff.

If you exceed the limit, you'll receive a 429 error. Consider adding client-side caching for popular searches.

## Troubleshooting

- **Invalid credentials**: Double-check client_id, client_secret, and refresh_token in `.env`
- **401 Unauthorized**: Your credentials are likely invalid or expired
- **429 Too Many Requests**: You've hit the rate limit; wait and retry
- **403 Forbidden**: Your app permissions may be restricted; check Reddit app settings

## Security Notes

- Never commit `.env` file to git (it's in `.gitignore`)
- Credentials are sensitive—treat them like passwords
- The refresh token doesn't expire and can be used indefinitely
- Consider storing in a secrets manager for production
