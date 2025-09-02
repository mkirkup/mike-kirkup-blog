const https = require('https');
const fs = require('fs').promises;
const path = require('path');
const { parseStringPromise } = require('xml2js');

// Configuration from environment variables with defaults
const CONFIG = {
  RSS_URL: process.env.RSS_FEED_URL || 'https://mikekirkup.com/rss.xml',
  BUTTONDOWN_API_KEY: process.env.BUTTONDOWN_API_KEY,
  SENT_POSTS_FILE: path.join(__dirname, 'sent-posts.json'),
  RECENT_POST_WINDOW_HOURS: parseInt(process.env.RECENT_POST_WINDOW_HOURS || '2', 10),
  EMAIL_DELAY_MS: parseInt(process.env.EMAIL_DELAY_MS || '2000', 10),
  MAX_RETRIES: 3,
  RETRY_BASE_DELAY_MS: 1000
};

// Structured logging helper
function log(level, message, context = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...context
  };
  
  if (level === 'error') {
    console.error(JSON.stringify(logEntry));
  } else {
    console.log(JSON.stringify(logEntry));
  }
}

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
  log('info', 'Fetching RSS feed', { url: CONFIG.RSS_URL });
  const url = new URL(CONFIG.RSS_URL);
  
  const response = await httpsRequest({
    hostname: url.hostname,
    path: url.pathname,
    method: 'GET',
    headers: {
      'User-Agent': 'GitHub-Action-Newsletter-Bot'
    }
  });
  
  log('info', 'RSS feed fetched successfully', { 
    size: response.body.length 
  });
  return response.body;
}

// Sanitize HTML content for safe email use
function sanitizeContent(content) {
  if (!content) return '';
  // Remove script tags and their contents
  content = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  // Remove all HTML tags (basic sanitization)
  content = content.replace(/<[^>]*>/g, '');
  // Decode HTML entities
  content = content.replace(/&amp;/g, '&')
                   .replace(/&lt;/g, '<')
                   .replace(/&gt;/g, '>')
                   .replace(/&quot;/g, '"')
                   .replace(/&#039;/g, "'");
  return content.trim();
}

// Parse RSS XML using xml2js
async function parseRSSFeed(rssContent) {
  try {
    const result = await parseStringPromise(rssContent, {
      explicitArray: false,
      ignoreAttrs: true,
      trim: true
    });
    
    if (!result.rss || !result.rss.channel || !result.rss.channel.item) {
      log('warning', 'No items found in RSS feed');
      return [];
    }
    
    // Ensure items is always an array
    let items = result.rss.channel.item;
    if (!Array.isArray(items)) {
      items = [items];
    }
    
    const parsedItems = items.map(item => {
      // Extract content from CDATA if present
      const extractContent = (field) => {
        if (!field) return '';
        if (typeof field === 'string') return field;
        if (field._ !== undefined) return field._;
        return String(field);
      };
      
      return {
        title: sanitizeContent(extractContent(item.title)),
        link: extractContent(item.link).trim(),
        description: sanitizeContent(extractContent(item.description)),
        pubDate: new Date(extractContent(item.pubDate)),
        guid: extractContent(item.guid || item.link).trim()
      };
    }).sort((a, b) => b.pubDate - a.pubDate);
    
    log('info', 'RSS feed parsed successfully', { 
      itemCount: parsedItems.length 
    });
    return parsedItems;
    
  } catch (error) {
    log('error', 'Error parsing RSS XML', { 
      error: error.message 
    });
    throw new Error('Failed to parse RSS feed: ' + error.message);
  }
}

// Load previously sent posts
async function loadSentPosts() {
  try {
    const data = await fs.readFile(CONFIG.SENT_POSTS_FILE, 'utf8');
    const sentData = JSON.parse(data);
    log('info', 'Loaded sent posts', { 
      count: sentData.sentPosts.length 
    });
    return sentData;
  } catch (error) {
    log('info', 'No previous sent posts file found, starting fresh');
    return { sentPosts: [] };
  }
}

// Save sent posts
async function saveSentPosts(sentData) {
  await fs.writeFile(CONFIG.SENT_POSTS_FILE, JSON.stringify(sentData, null, 2));
  log('info', 'Saved sent posts record', { 
    count: sentData.sentPosts.length 
  });
}

// Send email via Buttondown API with retry logic
async function sendButtondownEmail(post, retryCount = 0) {
  log('info', 'Attempting to send email', { 
    title: post.title, 
    retryCount 
  });
  
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
  
  try {
    const response = await httpsRequest({
      hostname: 'api.buttondown.email',
      path: '/v1/emails',
      method: 'POST',
      headers: {
        'Authorization': `Token ${CONFIG.BUTTONDOWN_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(emailData)
      }
    }, emailData);
    
    log('info', 'Email sent successfully', { 
      title: post.title 
    });
    return JSON.parse(response.body);
    
  } catch (error) {
    // Check if it's a rate limit error (429) or server error (5xx)
    const statusCode = error.message.match(/HTTP (\d{3})/)?.[1];
    const shouldRetry = statusCode && (statusCode === '429' || statusCode.startsWith('5'));
    
    if (shouldRetry && retryCount < CONFIG.MAX_RETRIES) {
      const delay = CONFIG.RETRY_BASE_DELAY_MS * Math.pow(2, retryCount);
      log('warning', 'Request failed, retrying', { 
        title: post.title,
        statusCode,
        retryCount,
        retryDelay: delay 
      });
      await new Promise(resolve => setTimeout(resolve, delay));
      return sendButtondownEmail(post, retryCount + 1);
    }
    
    log('error', 'Failed to send email after retries', { 
      title: post.title,
      error: error.message,
      retryCount 
    });
    throw error;
  }
}

// Main function
async function main() {
  try {
    // Check if API key is set
    if (!CONFIG.BUTTONDOWN_API_KEY) {
      throw new Error('BUTTONDOWN_API_KEY is not set in GitHub secrets');
    }
    
    log('info', 'Starting newsletter automation', { 
      rssUrl: CONFIG.RSS_URL 
    });
    
    // Fetch RSS feed
    const rssContent = await fetchRSSFeed();
    const posts = await parseRSSFeed(rssContent);
    
    if (posts.length === 0) {
      log('info', 'No posts found in RSS feed');
      return;
    }
    
    // Load sent posts
    const sentData = await loadSentPosts();
    
    // Get current time and window for recent posts
    const now = new Date();
    const windowHours = CONFIG.RECENT_POST_WINDOW_HOURS;
    const recentPostWindow = new Date(now.getTime() - windowHours * 60 * 60 * 1000);
    
    log('info', 'Checking for new posts', { 
      windowHours,
      checkingFrom: recentPostWindow.toISOString(),
      currentTime: now.toISOString() 
    });
    
    // Check for new posts that are:
    // 1. Actually published (pubDate <= now)
    // 2. Published recently (within window)
    // 3. Not already sent
    const newPosts = posts.filter(post => {
      const isPublished = post.pubDate <= now;
      const isRecent = post.pubDate > recentPostWindow;
      const notSent = !sentData.sentPosts.includes(post.guid);
      
      if (!isPublished && post.pubDate > now) {
        log('info', 'Skipping scheduled post', { 
          title: post.title,
          scheduledFor: post.pubDate.toISOString() 
        });
      }
      
      return isPublished && isRecent && notSent;
    });
    
    if (newPosts.length === 0) {
      log('info', 'No new published posts to send', {
        latestPost: posts[0]?.title,
        latestPostDate: posts[0]?.pubDate.toISOString()
      });
      return;
    }
    
    log('info', 'Found new posts to send', { 
      count: newPosts.length,
      titles: newPosts.map(p => p.title) 
    });
    
    // Send emails for new posts
    let successCount = 0;
    let failCount = 0;
    
    for (const post of newPosts) {
      try {
        await sendButtondownEmail(post);
        sentData.sentPosts.push(post.guid);
        successCount++;
        log('info', 'Email sent', { 
          title: post.title,
          successCount 
        });
        
        // Add delay between emails to avoid rate limits
        if (newPosts.indexOf(post) < newPosts.length - 1) {
          log('info', 'Waiting before next email', { 
            delayMs: CONFIG.EMAIL_DELAY_MS 
          });
          await new Promise(resolve => setTimeout(resolve, CONFIG.EMAIL_DELAY_MS));
        }
      } catch (error) {
        failCount++;
        log('error', 'Failed to send email', { 
          title: post.title,
          error: error.message,
          failCount 
        });
        // Continue with other posts even if one fails
      }
    }
    
    // Save updated sent posts
    await saveSentPosts(sentData);
    
    log('info', 'Newsletter automation completed', { 
      attempted: newPosts.length,
      successful: successCount,
      failed: failCount 
    });
    
  } catch (error) {
    log('error', 'Fatal error in newsletter automation', { 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    process.exit(1);
  }
}

// Run the script
main();