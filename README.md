# Torenius Timber - Xero Direct Integration (In Progress)

## 🎯 Project Status

### ✅ COMPLETED (Backend - 80% Done)

**Core Infrastructure:**
- ✅ Netlify Blobs storage system for tokens
- ✅ Admin setup page (`/admin.html`)
- ✅ Token auto-refresh mechanism
- ✅ Xero OAuth callback handler
- ✅ Auth status checker
- ✅ Disconnect function
- ✅ Invoice fetching with auto-refresh tokens
- ✅ Order completion webhook
- ✅ Email notifications (Resend integration)
- ✅ Morning summary scheduled function

**What This Means:**
The entire backend is built and ready. Token management, Xero API integration, and email notifications are complete.

---

### ⚠️ NEEDS COMPLETION (Frontend - 20% Remaining)

**Worker Apps:**
- ⚠️ Green Mill app (needs update to use server-side API)
- ⚠️ Dry Mill app (needs update to use server-side API)
- ⚠️ Front Desk app (needs update to use server-side API)
- ⚠️ Delivery calculator (already done, just needs copying)

**What's Needed:**
Update the 3 mill apps to call `/api/get-invoices` instead of direct Xero authentication.

---

## 📁 File Structure

```
/netlify
  /functions
    - storage.js              ✅ Token storage helper
    - token-manager.js        ✅ Auto-refresh logic
    - admin-callback.js       ✅ OAuth callback
    - auth-status.js          ✅ Check connection status
    - disconnect.js           ✅ Disconnect Xero
    - get-invoices.js         ✅ Fetch invoices from Xero
    - order-complete.js       ✅ Completion webhook + email
    - morning-summary.js      ✅ Scheduled 6:30am email

/public
  - admin.html               ✅ Admin setup page
  - index.html               ⚠️ Needs creation (home screen)
  - green-mill.html          ⚠️ Needs update
  - dry-mill.html            ⚠️ Needs update  
  - front-desk.html          ⚠️ Needs update
  - delivery.html            ✅ Copy from old version
```

---

## 🚀 How It Works

### Initial Setup (One Time):
1. Admin visits `/admin`
2. Clicks "Connect to Xero"
3. Logs into Xero
4. Token saved to Netlify Blobs
5. Done! Workers can now use the system

### Daily Use:
1. Worker opens app
2. Enters their name
3. Orders load from Xero (via server-side token)
4. Pick items, mark complete
5. Email sent to sales@toreniustimber.com.au

### Automatic:
- Token auto-refreshes (no re-login needed)
- Morning summary at 6:30am AEST
- Completion notifications

---

## 🔧 Deployment Steps

### 1. Environment Variables in Netlify

Add these in Netlify → Site Settings → Environment Variables:

```
XERO_CLIENT_ID=DD25283B5B4C4950A8FC459ABF55E21E
XERO_CLIENT_SECRET=1ELNA-hR-vBDr4-rN_mmxv2z9akDijmcUzwvI5E4D5Ps7AsY
NETLIFY_URL=https://your-site.netlify.app
RESEND_API_KEY=re_xxxxxxxxx (get from resend.com - free tier)
```

### 2. Update Xero Redirect URIs

In Xero Developer Portal, add:
```
https://your-site.netlify.app/admin
```

### 3. Deploy to Netlify

Drag the entire folder to Netlify Drop or connect to GitHub.

### 4. Configure Scheduled Function

In Netlify, enable scheduled functions:
- Function: `morning-summary`
- Schedule: `30 20 * * *` (6:30am AEST = 8:30pm UTC prev day)

Note: Scheduled functions cost $19/month OR you can manually trigger them.

---

## 📝 What Needs Finishing

### Green Mill App Updates:

**Current flow (broken):**
```javascript
// OLD - direct Xero auth
fetch Xero with accessToken
```

**New flow (needed):**
```javascript
// NEW - server-side token
async function loadOrders() {
    const response = await fetch('/api/get-invoices');
    const data = await response.json();
    
    if (data.error && data.setupUrl) {
        // Show "Admin setup required" message
        showSetupRequired();
        return;
    }
    
    // Filter for green mill items
    orders = data.filter(o => o.greenItems.length > 0)
        .map(o => ({ ...o, items: o.greenItems }));
    
    renderOrders();
}
```

**Changes needed:**
1. Remove all Xero OAuth code
2. Remove auth screen HTML
3. Change `loadOrders()` to call `/api/get-invoices`
4. Add error handling for setup required
5. Update `completeOrder()` to call `/api/order-complete`

### Completion Webhook Integration:

```javascript
async function completeOrder(orderId) {
    const order = orders.find(o => o.id === orderId);
    
    // Mark locally
    order.status = 'completed';
    order.completedAt = new Date().toISOString();
    savePickState();
    
    // Notify server (sends email)
    await fetch('/api/order-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            orderNumber: order.orderNumber,
            customer: order.customer,
            worker: currentWorker,
            items: order.items,
            mill: 'Green Mill'
        })
    });
    
    renderOrders();
}
```

---

## 📧 Email Setup

### Get Resend API Key:
1. Go to https://resend.com
2. Sign up (free)
3. Verify domain: toreniustimber.com.au
4. Create API key
5. Add to Netlify env vars as `RESEND_API_KEY`

### Email Templates:
- ✅ Order completion notification (built)
- ✅ Morning summary (built)

---

## 🔍 Testing Checklist

Once complete:

- [ ] Admin can connect to Xero at `/admin`
- [ ] Token persists across sessions
- [ ] Workers see orders without Xero login
- [ ] Orders load from Xero instantly
- [ ] Mark complete sends email
- [ ] Morning summary runs at 6:30am
- [ ] Token auto-refreshes after 30 mins
- [ ] All 3 apps work (green, dry, front desk)

---

## 🆘 If You Get Stuck

### Error: "No tokens stored"
- Go to `/admin` and connect to Xero

### Error: "Setup required"
- Admin hasn't connected yet
- Go to `/admin`

### Orders not loading
- Check Netlify function logs
- Verify env variables are set
- Check Xero API hasn't changed

### Emails not sending
- Verify RESEND_API_KEY is set
- Check domain is verified in Resend
- Check Netlify function logs

---

## 💰 Costs

| Service | Cost |
|---------|------|
| Netlify (hosting + functions) | Free |
| Netlify Blobs | Free (< 1GB) |
| Scheduled Functions | $19/mo OR manual trigger |
| Resend (emails) | Free (< 3k/month) |
| Xero API | Free |
| **TOTAL** | **$0-19/month** |

---

## 🎯 Next Steps

### Option 1: Hire Developer
Estimated: 4-6 hours to complete frontend apps

### Option 2: New Claude Conversation
1. Start fresh conversation
2. Upload these files
3. Say "Continue building Torenius Timber app - update the 3 worker apps to use server-side API"

### Option 3: Use Zapier Instead
If this seems too complex, the Zapier + Google Sheets approach works well and is simpler.

---

## 📞 Support

Questions about the backend code?
- All functions have comments
- Token flow is in `token-manager.js`
- Email templates in `order-complete.js` and `morning-summary.js`

---

**Built with ❤️ for Torenius Timber**
*Matthew - you're 80% there! The hard part (backend) is done.*
