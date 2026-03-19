import { useState } from 'react';

interface RedditPost {
  title: string;
  author: string;
  score: number;
  url: string;
  subreddit: string;
  created: number;
  selftext?: string;
  permalink: string;
}

export function RedditSearch() {
  const [query, setQuery] = useState('');
  const [subreddit, setSubreddit] = useState('travel');
  const [results, setResults] = useState<RedditPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:3000/api/reddit/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          subreddit: subreddit || undefined,
          limit: 15,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to search Reddit');
      }

      const data = await response.json();
      setResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="reddit-search">
      <h2>Reddit Search</h2>

      <form onSubmit={handleSearch}>
        <div>
          <input
            type="text"
            placeholder="Search query (e.g., 'best hiking trails')"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            required
          />
        </div>

        <div>
          <input
            type="text"
            placeholder="Subreddit (optional, e.g., 'backpacking')"
            value={subreddit}
            onChange={(e) => setSubreddit(e.target.value)}
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && <div className="error">{error}</div>}

      <div className="results">
        {results.map((post, idx) => (
          <div key={idx} className="post-card">
            <h3>{post.title}</h3>
            <div className="meta">
              <span>r/{post.subreddit}</span>
              <span>👤 {post.author}</span>
              <span>⭐ {post.score.toLocaleString()}</span>
            </div>
            {post.selftext && <p>{post.selftext.substring(0, 200)}...</p>}
            <a href={post.permalink} target="_blank" rel="noopener noreferrer">
              View on Reddit →
            </a>
          </div>
        ))}
      </div>

      <style>{`
        .reddit-search {
          padding: 20px;
          max-width: 800px;
        }

        form {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 20px;
        }

        input {
          padding: 10px;
          border: 1px solid #ccc;
          border-radius: 4px;
          font-size: 14px;
        }

        button {
          padding: 10px 20px;
          background: #ff4500;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .error {
          color: #d32f2f;
          margin-bottom: 20px;
          padding: 10px;
          background: #ffebee;
          border-radius: 4px;
        }

        .results {
          display: grid;
          gap: 15px;
        }

        .post-card {
          border: 1px solid #e0e0e0;
          padding: 15px;
          border-radius: 8px;
          background: #fafafa;
        }

        .post-card h3 {
          margin: 0 0 10px 0;
          font-size: 16px;
        }

        .meta {
          display: flex;
          gap: 15px;
          font-size: 12px;
          color: #666;
          margin-bottom: 10px;
        }

        .post-card p {
          margin: 10px 0;
          font-size: 14px;
          color: #555;
          line-height: 1.5;
        }

        .post-card a {
          color: #ff4500;
          text-decoration: none;
          font-weight: 500;
        }

        .post-card a:hover {
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
