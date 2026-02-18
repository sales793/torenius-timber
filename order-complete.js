const https = require('https');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    
    try {
        const { orderNumber, customer, worker, items, mill } = JSON.parse(event.body || '{}');
        
        if (!orderNumber || !customer) {
            throw new Error('Missing required fields');
        }
        
        // Send email notification
        await sendCompletionEmail({
            orderNumber,
            customer,
            worker,
            items,
            mill,
            completedAt: new Date()
        });
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true })
        };
        
    } catch (error) {
        console.error('Completion webhook error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};

async function sendCompletionEmail(data) {
    // Using Resend API (free tier: 3000 emails/month)
    const resendApiKey = process.env.RESEND_API_KEY;
    
    if (!resendApiKey) {
        console.log('No Resend API key - skipping email');
        return;
    }
    
    const itemsList = data.items.map(item => 
        `  • ${item.spec} - ${item.quantity}`
    ).join('\n');
    
    const emailBody = {
        from: 'Torenius Timber <noreply@toreniustimber.com.au>',
        to: ['sales@toreniustimber.com.au'],
        subject: `✅ Order ${data.orderNumber} Complete - ${data.customer}`,
        text: `Order Completed

Customer: ${data.customer}
Order Number: ${data.orderNumber}
Mill: ${data.mill}
Completed by: ${data.worker}
Completed at: ${data.completedAt.toLocaleString('en-AU')}

Items:
${itemsList}

This order is now ready for pickup at the front desk.

---
Torenius Timber Mill System
Forcett, Tasmania`,
        html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2c5f2d; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { background: #f8f9fa; padding: 20px; }
        .info-grid { background: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
        .info-row { display: flex; padding: 8px 0; border-bottom: 1px solid #e9ecef; }
        .info-row:last-child { border-bottom: none; }
        .info-label { font-weight: 600; width: 140px; color: #666; }
        .info-value { flex: 1; }
        .items { background: white; padding: 15px; border-radius: 8px; }
        .items h3 { margin-top: 0; color: #2c5f2d; }
        .item { padding: 8px 0; border-bottom: 1px solid #e9ecef; }
        .item:last-child { border-bottom: none; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ Order Complete</h1>
        </div>
        <div class="content">
            <div class="info-grid">
                <div class="info-row">
                    <div class="info-label">Customer:</div>
                    <div class="info-value"><strong>${data.customer}</strong></div>
                </div>
                <div class="info-row">
                    <div class="info-label">Order Number:</div>
                    <div class="info-value"><strong>${data.orderNumber}</strong></div>
                </div>
                <div class="info-row">
                    <div class="info-label">Mill:</div>
                    <div class="info-value">${data.mill}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Completed by:</div>
                    <div class="info-value">${data.worker}</div>
                </div>
                <div class="info-row">
                    <div class="info-label">Completed at:</div>
                    <div class="info-value">${data.completedAt.toLocaleString('en-AU')}</div>
                </div>
            </div>
            
            <div class="items">
                <h3>Items Picked</h3>
                ${data.items.map(item => `
                    <div class="item">
                        <strong>${item.spec}</strong><br>
                        <span style="color: #666;">${item.quantity}</span>
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="footer">
            This order is now ready for pickup at the front desk.<br>
            <strong>Torenius Timber Mill</strong> · Forcett, Tasmania
        </div>
    </div>
</body>
</html>
        `
    };
    
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(emailBody);
        
        const options = {
            hostname: 'api.resend.com',
            path: '/emails',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log('Completion email sent successfully');
                    resolve(true);
                } else {
                    console.error('Email send failed:', data);
                    reject(new Error('Failed to send email'));
                }
            });
        });
        
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}
