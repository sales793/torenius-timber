const { getTokens, getConfig } = require('./storage');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
    };
    
    try {
        const tokens = await getTokens();
        const config = await getConfig();
        
        if (!tokens || !config) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ connected: false })
            };
        }
        
        // Check if token is expired
        const isExpired = tokens.expires_at && Date.now() > tokens.expires_at;
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                connected: true,
                organization: config.tenant_name,
                connectedAt: config.connected_at,
                expiresAt: new Date(tokens.expires_at).toISOString(),
                needsRefresh: isExpired
            })
        };
        
    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                connected: false,
                error: error.message 
            })
        };
    }
};
