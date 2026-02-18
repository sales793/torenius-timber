const { clearTokens } = require('./storage');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    
    try {
        await clearTokens();
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true })
        };
        
    } catch (error) {
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
