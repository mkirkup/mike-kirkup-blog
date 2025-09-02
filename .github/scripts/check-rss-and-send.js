const https = require('https');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const RSS_URL = process.env.RSS_FEED_URL || 'https://mikekirkup.com/rss.xml';
const BUTTONDOWN_API_KEY = process.env.BUTTONDOWN_API_KEY;
const SENT_POSTS_FILE = path.join(__dirname, 'sent-posts.json');

// Helper function to make HTTPS requests
function httpsRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, body });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// Fetch and parse RSS feed
async function fetchRSSFeed() {
  console.log('Fetching RSS feed...');
  const url = new URL(RSS_URL);
  
  const response = await httpsRequest({
    hostname: url.hostname,
    path: url.pathname,
    method: 'GET',
    headers: {
      'User-Agent': 'GitHub-Action-Newsletter-Bot'
    }
  });
  
  return response.body;
}

// Parse RSS XML (simple regex parsing for basic RSS elements)
function parseRSSItem(rssContent) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  
  while ((match = itemRegex.exec(rssContent)) !== null) {
    const itemContent = match[1];
    
    const title = (itemContent.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || 
                  itemContent.match(/<title>(.*?)<\/title>/))?.[1] || '';
    
    const link = (itemContent.match(/<link>(.*?)<\/link>/))?.[1] || '';
    
    const description = (itemContent.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) ||
                        itemContent.match(/<description>(.*?)<\/description>/))?.[1] || '';
    
    const pubDate = (itemContent.match(/<pubDate>(.*?)<\/pubDate>/))?.[1] || '';
    
    const guid = (itemContent.match(/<guid.*?>(.*?)<\/guid>/))?.[1] || link;
    
    items.push({
      title: title.trim(),
      link: link.trim(),
      description: description.trim(),
      pubDate: new Date(pubDate),
      guid: guid.trim()
    });
  }
  
  return items.sort((a, b) => b.pubDate - a.pubDate);
}

// Load previously sent posts
async function loadSentPosts() {
  try {
    const data = await fs.readFile(SENT_POSTS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.log('No previous sent posts file found, starting fresh');
    return { sentPosts: [] };
  }
}

// Save sent posts
async function saveSentPosts(sentData) {
  await fs.writeFile(SENT_POSTS_FILE, JSON.stringify(sentData, null, 2));
  console.log('Saved sent posts record');
}

// Send email via Buttondown API
async function sendButtondownEmail(post) {
  console.log(`Sending email for post: ${post.title}`);
  
  const emailBody = `
${post.description}

[Read the full post →](${post.link})

---
*You're receiving this because you subscribed to Mike Kirkup's blog updates.*
  `.trim();
  
  const emailData = JSON.stringify({
    subject: `New post: ${post.title}`,
    body: emailBody,
    status: 'about_to_send'
  });
  
  const response = await httpsRequest({
    hostname: 'api.buttondown.email',
    path: '/v1/emails',
    method: 'POST',
    headers: {
      'Authorization': `Token ${BUTTONDOWN_API_KEY}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(emailData)
    }
  }, emailData);
  
  console.log('Email sent successfully!');
  return JSON.parse(response.body);
}

// Main function
async function main() {
  try {
    // Check if API key is set
    if (!BUTTONDOWN_API_KEY) {
      throw new Error('BUTTONDOWN_API_KEY is not set in GitHub secrets');
    }
    
    // Fetch RSS feed
    const rssContent = await fetchRSSFeed();
    const posts = parseRSSItem(rssContent);
    
    if (posts.length === 0) {
      console.log('No posts found in RSS feed');
      return;
    }
    
    // Load sent posts
    const sentData = await loadSentPosts();
    
    // Get current time
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    
    // Check for new posts that are:
    // 1. Actually published (pubDate <= now)
    // 2. Published recently (within last 2 hours)
    // 3. Not already sent
    const newPosts = posts.filter(post => {
      const isPublished = post.pubDate <= now; // Only posts with dates in the past
      const isRecent = post.pubDate > twoHoursAgo;
      const notSent = !sentData.sentPosts.includes(post.guid);
      
      if (!isPublished && post.pubDate > now) {
        console.log(`Skipping scheduled post: ${post.title} (scheduled for ${post.pubDate.toISOString()})`);
      }
      
      return isPublished && isRecent && notSent;
    });
    
    if (newPosts.length === 0) {
      console.log('No new published posts to send');
      console.log(`Latest post: ${posts[0].title} (${posts[0].pubDate.toISOString()})`);
      console.log(`Current time: ${now.toISOString()}`);
      return;
    }
    
    // Send emails for new posts
    for (const post of newPosts) {
      try {
        await sendButtondownEmail(post);
        sentData.sentPosts.push(post.guid);
        console.log(`✓ Sent: ${post.title}`);
        
        // Add a small delay between emails to avoid rate limits
        if (newPosts.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`Failed to send email for "${post.title}":`, error.message);
        // Continue with other posts even if one fails
      }
    }
    
    // Save updated sent posts
    await saveSentPosts(sentData);
    console.log(`Successfully processed ${newPosts.length} new post(s)`);
    
  } catch (error) {
    console.error('Error in newsletter automation:', error);
    process.exit(1);
  }
}

// Run the script
main();