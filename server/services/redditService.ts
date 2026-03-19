import Snoowrap from 'snoowrap';

// Initialize Reddit API client with credentials from environment
const reddit = new Snoowrap({
  userAgent: process.env.REDDIT_USER_AGENT || 'backpack-map-demo/1.0',
  clientId: process.env.REDDIT_CLIENT_ID || '',
  clientSecret: process.env.REDDIT_CLIENT_SECRET || '',
  refreshToken: process.env.REDDIT_REFRESH_TOKEN || '',
});

interface RedditSearchResult {
  title: string;
  author: string;
  score: number;
  url: string;
  subreddit: string;
  created: number;
  selftext?: string;
  permalink: string;
}

interface RedditSearchOptions {
  query: string;
  subreddit?: string;
  limit?: number;
  timeFilter?: 'all' | 'year' | 'month' | 'week' | 'day' | 'hour';
}

/**
 * Search Reddit posts across subreddits or within a specific subreddit
 */
export async function searchReddit(
  options: RedditSearchOptions
): Promise<RedditSearchResult[]> {
  try {
    const { query, subreddit, limit = 25, timeFilter = 'all' } = options;

    // Search within a specific subreddit or all
    const searchTarget = subreddit ? reddit.getSubreddit(subreddit) : reddit;

    const results = await searchTarget
      .search({
        query,
        sort: 'relevance',
        time: timeFilter,
        limit,
      });

    // Transform results to a clean format
    return results.map((post: any) => ({
      title: post.title,
      author: post.author?.name || '[deleted]',
      score: post.score,
      url: post.url,
      subreddit: post.subreddit.display_name,
      created: post.created_utc,
      selftext: post.selftext, // For text posts
      permalink: `https://reddit.com${post.permalink}`,
    }));
  } catch (error) {
    console.error('Reddit search error:', error);
    throw new Error(`Failed to search Reddit: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get top posts from a specific subreddit
 */
export async function getTopPosts(
  subreddit: string,
  timeFilter: 'all' | 'year' | 'month' | 'week' | 'day' | 'hour' = 'month',
  limit: number = 25
): Promise<RedditSearchResult[]> {
  try {
    const sub = reddit.getSubreddit(subreddit);
    const posts = await sub.getTop({ time: timeFilter, limit });

    return posts.map((post: any) => ({
      title: post.title,
      author: post.author?.name || '[deleted]',
      score: post.score,
      url: post.url,
      subreddit: post.subreddit.display_name,
      created: post.created_utc,
      selftext: post.selftext,
      permalink: `https://reddit.com${post.permalink}`,
    }));
  } catch (error) {
    console.error('Reddit getTop error:', error);
    throw new Error(`Failed to fetch top posts from r/${subreddit}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get hot posts from a specific subreddit
 */
export async function getHotPosts(
  subreddit: string,
  limit: number = 25
): Promise<RedditSearchResult[]> {
  try {
    const sub = reddit.getSubreddit(subreddit);
    const posts = await sub.getHot({ limit });

    return posts.map((post: any) => ({
      title: post.title,
      author: post.author?.name || '[deleted]',
      score: post.score,
      url: post.url,
      subreddit: post.subreddit.display_name,
      created: post.created_utc,
      selftext: post.selftext,
      permalink: `https://reddit.com${post.permalink}`,
    }));
  } catch (error) {
    console.error('Reddit getHot error:', error);
    throw new Error(`Failed to fetch hot posts from r/${subreddit}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
