const https = require('https');
const { saveTokens, saveConfig } = require('./storage');

exports.handler = async (event) => {
    const headers = {
        'Content-Type': 'application/json'
    };
    
    const { code } = event.queryStringParameters || {};
    
    if (!code) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ success: false, error: 'No authorization code' })
        };
    }
    
    try {
        // Exchange code for tokens
        const tokenData = await exchangeCodeForToken(code);
        
        // Get tenant/organization info
        const connections = await getConnections(tokenData.access_token);
        
        if (!connections || connections.length === 0) {
            throw new Error('No Xero organizations found');
        }
        
        const tenant = connections[0];
        
        // Save tokens to Netlify Blobs
        await saveTokens({
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: Date.now() + (tokenData.expires_in * 1000),
            token_type: tokenData.token_type
        });
        
        // Save organization config
        await saveConfig({
            tenant_id: tenant.tenantId,
            tenant_name: tenant.tenantName,
            tenant_type: tenant.tenantType,
            connected_at: new Date().toISOString()
        });
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true,
                organization: tenant.tenantName
            })
        };
        
    } catch (error) {
        console.error('Admin callback error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                success: false, 
                error: error.message 
            })
        };
    }
};

function exchangeCodeForToken(code) {
    return new Promise((resolve, reject) => {
        const clientId = process.env.XERO_CLIENT_ID;
        const clientSecret = process.env.XERO_CLIENT_SECRET;
        const redirectUri = process.env.NETLIFY_URL + '/admin';
        
        const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        
        const postData = new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: redirectUri
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

function getConnections(accessToken) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.xero.com',
            path: '/connections',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error('Failed to get connections'));
                }
            });
        });
        
        req.on('error', reject);
        req.end();
    });
}
