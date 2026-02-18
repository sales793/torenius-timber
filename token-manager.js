const https = require('https');
const { getTokens, saveTokens } = require('./storage');

async function ensureValidToken() {
    const tokens = await getTokens();
    
    if (!tokens) {
        throw new Error('No tokens stored - admin setup required');
    }
    
    // Check if token needs refresh (refresh if expires in < 5 minutes)
    const needsRefresh = !tokens.expires_at || Date.now() > (tokens.expires_at - 300000);
    
    if (needsRefresh) {
        console.log('Token expired or expiring soon, refreshing...');
        return await refreshAccessToken(tokens.refresh_token);
    }
    
    return tokens.access_token;
}

async function refreshAccessToken(refreshToken) {
    const tokenData = await performTokenRefresh(refreshToken);
    
    // Save new tokens
    await saveTokens({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: Date.now() + (tokenData.expires_in * 1000),
        token_type: tokenData.token_type
    });
    
    console.log('Token refreshed successfully');
    return tokenData.access_token;
}

function performTokenRefresh(refreshToken) {
    return new Promise((resolve, reject) => {
        const clientId = process.env.XERO_CLIENT_ID;
        const clientSecret = process.env.XERO_CLIENT_SECRET;
        const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        
        const postData = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken
        }).toString();
        
        const options = {
            hostname: 'identity.xero.com',
            path: '/connect/token',
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (result.error) {
                        reject(new Error(result.error_description || result.error));
                    } else {
                        resolve(result);
                    }
                } catch (e) {
                    reject(new Error('Failed to parse token response'));
                }
            });
        });
        
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

module.exports = {
    ensureValidToken,
    refreshAccessToken
};
