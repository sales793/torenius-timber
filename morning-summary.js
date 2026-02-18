const https = require('https');
const { ensureValidToken } = require('./token-manager');
const { getConfig } = require('./storage');

// This runs every day at 6:30am AEST (20:30 UTC - accounting for daylight saving)
exports.handler = async (event) => {
    try {
        console.log('Running morning summary...');
        
        // Get valid token and fetch invoices
        const accessToken = await ensureValidToken();
        const config = await getConfig();
        
        if (!config || !config.tenant_id) {
            console.log('No tenant configured - skipping');
            return { statusCode: 200, body: 'Not configured' };
        }
        
        const invoices = await getInvoices(accessToken, config.tenant_id);
        
        // Process and send summary email
        await sendMorningSummary(invoices);
        
        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, invoiceCount: invoices.length })
        };
        
    } catch (error) {
        console.error('Morning summary error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};

async function getInvoices(accessToken, tenantId) {
    return new Promise((resolve, reject) => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const dateFilter = thirtyDaysAgo.toISOString().split('T')[0];
        
        const path = `/api.xro/2.0/Invoices?where=Type%3D%3D%22ACCREC%22%26%26Status%3D%3D%22AUTHORISED%22%26%26Date%3E%3DDateTime(${dateFilter.replace(/-/g, ',')})&order=DueDate ASC`;
        
        const options = {
            hostname: 'api.xero.com',
            path: path,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Xero-Tenant-Id': tenantId,
                'Accept': 'application/json'
            }
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    resolve(result.Invoices || []);
                } catch (e) {
                    reject(new Error('Failed to parse invoices'));
                }
            });
        });
        
        req.on('error', reject);
        req.end();
    });
}

async function sendMorningSummary(invoices) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    
    // Categorize orders
    const overdue = [];
    const dueToday = [];
    const thisWeek = [];
    let unpaidCount = 0;
    let unpaidTotal = 0;
    
    invoices.forEach(inv => {
        const dueDate = inv.DueDateString?.split('T')[0];
        const isPaid = inv.AmountDue === 0;
        
        if (!isPaid) {
            unpaidCount++;
            unpaidTotal += inv.AmountDue || 0;
        }
        
        if (dueDate < todayStr) {
            overdue.push(inv);
        } else if (dueDate === todayStr) {
            dueToday.push(inv);
        } else {
            const dueDateTime = new Date(dueDate);
            const weekFromNow = new Date(today);
            weekFromNow.setDate(weekFromNow.getDate() + 7);
            if (dueDateTime <= weekFromNow) {
                thisWeek.push(inv);
            }
        }
    });
    
    // Format email
    const resendApiKey = process.env.RESEND_API_KEY;
    
    if (!resendApiKey) {
        console.log('No Resend API key - skipping email');
        return;
    }
    
    const formatInvoice = (inv) => {
        const items = inv.LineItems?.map(item => item.ItemCode).join(', ') || 'No items';
        return `  • ${inv.InvoiceNumber} - ${inv.Contact?.Name}\n    ${items}`;
    };
    
    const textBody = `Good morning!

Here's your day ahead at Torenius Timber:

━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 TODAY'S ORDERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━

${overdue.length > 0 ? `🔴 OVERDUE (${overdue.length})
${overdue.slice(0, 5).map(formatInvoice).join('\n')}
${overdue.length > 5 ? `\n  ...and ${overdue.length - 5} more` : ''}

` : ''}${dueToday.length > 0 ? `🟡 DUE TODAY (${dueToday.length})
${dueToday.slice(0, 5).map(formatInvoice).join('\n')}
${dueToday.length > 5 ? `\n  ...and ${dueToday.length - 5} more` : ''}

` : ''}${thisWeek.length > 0 ? `📦 THIS WEEK (${thisWeek.length})
${thisWeek.slice(0, 3).map(formatInvoice).join('\n')}
${thisWeek.length > 3 ? `\n  ...and ${thisWeek.length - 3} more` : ''}

` : ''}━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 OUTSTANDING PAYMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
${unpaidCount} unpaid invoices
Total outstanding: $${unpaidTotal.toFixed(2)}

Have a great day!
Torenius Timber Mill System`;

    const emailBody = {
        from: 'Torenius Timber <noreply@toreniustimber.com.au>',
        to: ['sales@toreniustimber.com.au'],
        subject: `🪵 Daily Summary - ${today.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })}`,
        text: textBody
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
                    console.log('Morning summary sent successfully');
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
