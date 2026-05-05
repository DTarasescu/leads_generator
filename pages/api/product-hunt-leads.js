import { createRequestClient } from '../../lib/supabase';
import { getAccessToken } from '../../lib/api-utils';

// Product Hunt leads — discover recently launched startups and companies
// These are companies with fresh funding/traction that may need services
// Requires: PRODUCTHUNT_API_TOKEN (Developer Token from producthunt.com/v2/oauth/applications)
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = getAccessToken(req);
    const supabase = createRequestClient(token);

    const {
      topics = [],        // e.g. ['saas', 'marketing', 'productivity']
      days_ago = 7,       // launched within last N days
      min_votes = 50,     // filter by upvotes (popularity signal)
      limit = 20,
    } = req.body;

    const apiToken = process.env.PRODUCTHUNT_API_TOKEN;
    if (!apiToken) return res.status(500).json({ error: 'PRODUCTHUNT_API_TOKEN not configured' });

    const postedAfter = new Date(Date.now() - days_ago * 24 * 60 * 60 * 1000).toISOString();

    const query = `
      query {
        posts(first: ${Math.min(limit, 50)}, postedAfter: "${postedAfter}", ${topics.length ? `topic: "${topics[0]}"` : ''}) {
          edges {
            node {
              id
              name
              tagline
              description
              votesCount
              website
              reviewsCount
              makers {
                name
                twitterUsername
                websiteUrl
              }
              topics {
                edges {
                  node { name }
                }
              }
            }
          }
        }
      }
    `;

    const phRes = await fetch('https://api.producthunt.com/v2/api/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({ query }),
    });

    const phData = await phRes.json();

    if (phData.errors) {
      return res.status(502).json({ error: 'Product Hunt API error', detail: phData.errors });
    }

    const posts = (phData.data?.posts?.edges || [])
      .map(e => e.node)
      .filter(p => p.votesCount >= min_votes);

    if (posts.length === 0) {
      return res.status(200).json({ success: true, found: 0, imported: 0 });
    }

    const leads = [];

    for (const post of posts) {
      const maker = post.makers?.[0];
      const makerName = maker?.name || post.name;
      const websiteUrl = maker?.websiteUrl || post.website;

      leads.push({
        name: makerName,
        email: null, // Product Hunt doesn't expose emails
        phone: null,
        business_type: post.topics?.edges?.[0]?.node?.name || 'Startup',
        website: websiteUrl || null,
        city: null,
        state: null,
        country: null,
        status: 'new',
        source: 'product_hunt',
        score: Math.min(100, Math.round(post.votesCount / 5)), // 500 votes = score 100
        google_place_id: null,
        tags: [
          'product-hunt',
          'fresh-launch',
          `votes-${post.votesCount}`,
          ...(post.topics?.edges?.map(e => e.node.name.toLowerCase().replace(/\s+/g, '-')) || []).slice(0, 3),
        ],
        notes: `Product: ${post.name} — "${post.tagline}". Launched on Product Hunt with ${post.votesCount} votes.`,
        created_at: new Date().toISOString(),
      });
    }

    // Upsert by website
    const { data, error } = await supabase
      .from('leads')
      .upsert(leads.filter(l => l.website), { onConflict: 'website', ignoreDuplicates: true })
      .select();

    // Insert those without website
    const noWebsite = leads.filter(l => !l.website);
    if (noWebsite.length > 0) {
      await supabase.from('leads').insert(noWebsite).select().catch(() => {});
    }

    if (error && !error.message.includes('duplicate')) throw error;

    return res.status(200).json({
      success: true,
      posts_found: posts.length,
      imported: data?.length || 0,
    });
  } catch (err) {
    console.error('[product-hunt-leads]', err);
    return res.status(500).json({ error: err.message });
  }
}
