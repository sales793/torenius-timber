const { getStore } = require('@netlify/blobs');

// Storage keys
const TOKENS_KEY = 'xero_tokens';
const CONFIG_KEY = 'xero_config';

async function getTokens() {
    try {
        const store = getStore('xero-auth');
        const data = await store.get(TOKENS_KEY);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('Error getting tokens:', error);
        return null;
    }
}

async function saveTokens(tokens) {
    try {
        const store = getStore('xero-auth');
        await store.set(TOKENS_KEY, JSON.stringify({
            ...tokens,
            savedAt: new Date().toISOString()
        }));
        return true;
    } catch (error) {
        console.error('Error saving tokens:', error);
        return false;
    }
}

async function getConfig() {
    try {
        const store = getStore('xero-auth');
        const data = await store.get(CONFIG_KEY);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('Error getting config:', error);
        return null;
    }
}

async function saveConfig(config) {
    try {
        const store = getStore('xero-auth');
        await store.set(CONFIG_KEY, JSON.stringify({
            ...config,
            updatedAt: new Date().toISOString()
        }));
        return true;
    } catch (error) {
        console.error('Error saving config:', error);
        return false;
    }
}

async function clearTokens() {
    try {
        const store = getStore('xero-auth');
        await store.delete(TOKENS_KEY);
        await store.delete(CONFIG_KEY);
        return true;
    } catch (error) {
        console.error('Error clearing tokens:', error);
        return false;
    }
}

module.exports = {
    getTokens,
    saveTokens,
    getConfig,
    saveConfig,
    clearTokens
};
