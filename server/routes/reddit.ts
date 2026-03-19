import { Router, Request, Response } from 'express';
import {
  searchReddit,
  getTopPosts,
  getHotPosts,
} from '../services/redditService.js';

const router = Router();

/**
 * POST /api/reddit/search
 * Search for posts across Reddit or within a specific subreddit
 * Body: { query: string, subreddit?: string, limit?: number, timeFilter?: string }
 */
router.post('/search', async (req: Request, res: Response) => {
  try {
    const { query, subreddit, limit, timeFilter } = req.body;

    if (!query) {
      res.status(400).json({ error: 'Search query is required' });
      return;
    }

    const results = await searchReddit({
      query,
      subreddit,
      limit: limit || 25,
      timeFilter: timeFilter || 'all',
    });

    res.json({ success: true, results });
  } catch (error) {
    console.error('Search endpoint error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/reddit/top/:subreddit
 * Get top posts from a specific subreddit
 * Query: ?timeFilter=month&limit=25
 */
router.get('/top/:subreddit', async (req: Request, res: Response) => {
  try {
    const { subreddit } = req.params;
    const { timeFilter = 'month', limit = '25' } = req.query;

    const results = await getTopPosts(
      subreddit,
      (timeFilter as string) as any,
      parseInt(limit as string)
    );

    res.json({ success: true, subreddit, results });
  } catch (error) {
    console.error('Top posts endpoint error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/reddit/hot/:subreddit
 * Get hot posts from a specific subreddit
 * Query: ?limit=25
 */
router.get('/hot/:subreddit', async (req: Request, res: Response) => {
  try {
    const { subreddit } = req.params;
    const { limit = '25' } = req.query;

    const results = await getHotPosts(subreddit, parseInt(limit as string));

    res.json({ success: true, subreddit, results });
  } catch (error) {
    console.error('Hot posts endpoint error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
