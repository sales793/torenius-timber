const https = require('https');
const { ensureValidToken } = require('./token-manager');
const { getConfig } = require('./storage');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    
    try {
        // Get valid access token (auto-refreshes if needed)
        const accessToken = await ensureValidToken();
        const config = await getConfig();
        
        if (!config || !config.tenant_id) {
            throw new Error('No tenant configured');
        }
        
        // Fetch invoices from Xero
        const invoices = await getInvoices(accessToken, config.tenant_id);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(invoices)
        };
        
    } catch (error) {
        console.error('Invoices error:', error);
        
        // Check if it's an auth error
        if (error.message.includes('setup required')) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ 
                    error: 'Setup required',
                    message: 'Admin needs to connect to Xero in /admin',
                    setupUrl: '/admin'
                })
            };
        }
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};

function getInvoices(accessToken, tenantId) {
    return new Promise((resolve, reject) => {
        // Get invoices from last 30 days, only AUTHORISED
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const dateFilter = thirtyDaysAgo.toISOString().split('T')[0];
        
        const path = `/api.xro/2.0/Invoices?where=Type%3D%3D%22ACCREC%22%26%26Status%3D%3D%22AUTHORISED%22%26%26Date%3E%3DDateTime(${dateFilter.replace(/-/g, ',')})&order=Date DESC`;
        
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
                    
                    if (!result.Invoices) {
                        resolve([]);
                        return;
                    }
                    
                    // Process invoices
                    const orders = [];
                    
                    result.Invoices.forEach(invoice => {
                        const greenItems = [];
                        const dryItems = [];
                        
                        invoice.LineItems?.forEach(item => {
                            const itemCode = item.ItemCode || '';
                            const lineItem = {
                                spec: itemCode,
                                quantity: item.Description || '',
                                unitPrice: item.UnitAmount || 0,
                                lineTotal: item.LineAmount || 0
                            };
                            
                            if (itemCode.toLowerCase().includes('green')) {
                                greenItems.push(lineItem);
                            } else if (itemCode.toLowerCase().includes('dry')) {
                                dryItems.push(lineItem);
                            }
                        });
                        
                        const order = {
                            id: invoice.InvoiceID,
                            orderNumber: invoice.InvoiceNumber,
                            customer: invoice.Contact?.Name || 'Unknown',
                            customerEmail: invoice.Contact?.EmailAddress || '',
                            customerPhone: invoice.Contact?.Phones?.find(p => p.PhoneType === 'DEFAULT')?.PhoneNumber || '',
                            date: invoice.DateString?.split('T')[0] || '',
                            dueDate: invoice.DueDateString?.split('T')[0] || '',
                            notes: invoice.Reference || '',
                            status: 'pending',
                            totalPrice: invoice.Total || 0,
                            amountDue: invoice.AmountDue || 0,
                            paymentStatus: invoice.AmountDue === 0 ? 'PAID' : 'UNPAID',
                            greenItems,
                            dryItems,
                            allItems: [...greenItems, ...dryItems]
                        };
                        
                        orders.push(order);
                    });
                    
                    resolve(orders);
                } catch (e) {
                    reject(new Error('Failed to parse invoices: ' + e.message));
                }
            });
        });
        
        req.on('error', reject);
        req.end();
    });
}
