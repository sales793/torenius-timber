# HANDOFF GUIDE - For Developer or New Claude Session

## What's Done vs. What's Needed

### ✅ 100% Complete - Backend
All server-side code is finished and working:
- Token storage (Netlify Blobs)
- Auto-refresh mechanism  
- Xero API integration
- Email notifications
- Scheduled functions

### ⚠️ Needs Work - Frontend
The 3 worker apps need updating to use the new server-side API.

---

## Exact Changes Needed

### File: `green-mill.html` (and dry-mill.html, front-desk.html)

#### 1. Remove These Sections:
```html
<!-- DELETE: Xero Auth Screen -->
<div class="auth-screen" id="authScreen">
  ...entire auth screen...
</div>
```

#### 2. Update JavaScript - Remove OAuth:
```javascript
// DELETE these variables:
const CLIENT_ID = '...';
const REDIRECT_URI = '...';
let accessToken = null;
let refreshToken = null;
let tenantId = null;

// DELETE these functions:
function loginWithXero() { ... }
function logout() { ... }
function showAuthScreen() { ... }
function refreshAccessToken() { ... }
```

#### 3. Update loadOrders() Function:
```javascript
// REPLACE THIS:
async function loadOrders() {
    const response = await fetch('/api/invoices', {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'xero-tenant-id': tenantId
        }
    });
    // ...
}

// WITH THIS:
async function loadOrders() {
    document.getElementById('ordersList').innerHTML = '<div class="loading">⏳ Loading...</div>';
    
    try {
        const response = await fetch('/api/get-invoices');
        const data = await response.json();
        
        // Check if setup required
        if (data.error && data.setupUrl) {
            document.getElementById('ordersList').innerHTML = `
                <div class="empty-state">
                    <h3>⚠️ Setup Required</h3>
                    <p>Admin needs to connect to Xero first.</p>
                    <a href="${data.setupUrl}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#2c5f2d;color:white;text-decoration:none;border-radius:8px;">Go to Admin Setup</a>
                </div>
            `;
            return;
        }
        
        // Filter for green mill only
        orders = data.filter(order => order.greenItems && order.greenItems.length > 0)
            .map(order => ({
                ...order,
                items: order.greenItems
            }));
        
        // Apply saved state
        orders.forEach(order => {
            if (completedOrders[order.id]) {
                order.status = 'completed';
                order.completedAt = completedOrders[order.id];
            }
            order.items.forEach((item, idx) => {
                item.picked = pickedItems[`${order.id}-${idx}`] || false;
                item.id = idx;
            });
        });
        
        document.getElementById('lastUpdated').textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
        renderOrders();
        
    } catch (error) {
        document.getElementById('ordersList').innerHTML = `
            <div class="empty-state">
                <p>❌ Error: ${error.message}</p>
                <button onclick="loadOrders()" style="margin-top:16px;padding:10px 20px;background:#2c5f2d;color:white;border:none;border-radius:8px;cursor:pointer;">Try Again</button>
            </div>
        `;
    }
}
```

#### 4. Update completeOrder() Function:
```javascript
// ADD THIS to the end of completeOrder():
async function completeOrder(orderId) {
    const order = orders.find(o => o.id === orderId);
    const allPicked = order.items.every(item => item.picked);
    
    if (!allPicked) {
        alert('Please pick all items first!');
        return;
    }
    
    // Mark complete locally
    const now = new Date().toISOString();
    order.status = 'completed';
    order.completedAt = now;
    completedOrders[orderId] = now;
    savePickState();
    
    // Send notification to server
    try {
        await fetch('/api/order-complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orderNumber: order.orderNumber,
                customer: order.customer,
                worker: currentWorker,
                items: order.items.map(i => ({ spec: i.spec, quantity: i.quantity })),
                mill: 'Green Mill'
            })
        });
    } catch (error) {
        console.error('Failed to send completion notification:', error);
        // Still mark as complete locally even if notification fails
    }
    
    renderOrders();
    alert(`✅ Order ${order.orderNumber} for ${order.customer} marked complete!`);
}
```

#### 5. Update init() Function:
```javascript
// REPLACE init() with this simpler version:
function init() {
    // Check for saved worker
    const savedWorker = localStorage.getItem('greenMillWorker');
    if (savedWorker) {
        currentWorker = savedWorker;
        showMainApp();
    } else {
        showWorkerScreen();
    }
    
    // Load saved state
    const saved = localStorage.getItem('greenMillPickState');
    if (saved) {
        try {
            const state = JSON.parse(saved);
            completedOrders = state.completedOrders || {};
            pickedItems = state.pickedItems || {};
        } catch(e) {}
    }
}
```

---

## For Dry Mill App

Same changes as Green Mill, but replace:
```javascript
// Filter for DRY items instead:
orders = data.filter(order => order.dryItems && order.dryItems.length > 0)
    .map(order => ({
        ...order,
        items: order.dryItems
    }));

// And in notification:
mill: 'Dry Mill'
```

---

## For Front Desk App

Simpler - just update loadOrders():
```javascript
async function loadOrders() {
    document.getElementById('readyOrders').innerHTML = '<div class="loading">⏳ Loading...</div>';
    
    try {
        const response = await fetch('/api/get-invoices');
        const data = await response.json();
        
        if (data.error && data.setupUrl) {
            document.getElementById('readyOrders').innerHTML = `
                <div class="empty-state">
                    <h3>⚠️ Setup Required</h3>
                    <p><a href="${data.setupUrl}">Admin Setup</a></p>
                </div>
            `;
            return;
        }
        
        orders = data;
        
        // Apply collected state
        orders.forEach(order => {
            if (collectedOrders[order.id]) {
                order.collected = true;
                order.collectedAt = collectedOrders[order.id];
            }
        });
        
        renderOrders();
    } catch(error) {
        document.getElementById('readyOrders').innerHTML = `<div class="empty-state">❌ ${error.message}</div>`;
    }
}
```

---

## Testing Steps

1. Deploy to Netlify
2. Add all environment variables
3. Go to `/admin` 
4. Connect to Xero
5. Verify token saved (check Netlify Blobs in dashboard)
6. Open green-mill.html
7. Enter worker name
8. Orders should load
9. Mark one complete
10. Check email arrives at sales@toreniustimber.com.au

---

## Common Issues

**"No tokens stored"**
→ Go to /admin and connect

**Orders not loading**
→ Check Netlify function logs
→ Verify XERO_CLIENT_ID/SECRET are set

**Email not sending**
→ Verify RESEND_API_KEY is set
→ Check domain verified in Resend

---

## Time Estimate

For experienced developer: **2-4 hours**
- Update 3 HTML files: 2 hours
- Test and debug: 1-2 hours

For new Claude session: **1 hour conversation**
- Upload files
- Say "Update the 3 worker apps per HANDOFF_GUIDE.md"
- Done!

---

Good luck! The hard part (backend) is done. 💪
