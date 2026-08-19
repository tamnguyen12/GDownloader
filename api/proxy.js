/**
 * Vercel Serverless Function - Free CORS Proxy
 * Path: api/proxy.js
 */

const https = require('https');
const http = require('http');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing target url' });
  }

  try {
    const parsedUrl = new URL(targetUrl);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    client.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*'
      }
    }, (proxyRes) => {
      res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'text/plain');
      proxyRes.pipe(res);
    }).on('error', (err) => {
      res.status(500).json({ error: err.message });
    });
  } catch (e) {
    res.status(400).json({ error: 'Invalid URL' });
  }
};
