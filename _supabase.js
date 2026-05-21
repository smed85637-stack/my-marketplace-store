
const { createClient } = require('@supabase/supabase-js');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-token',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body)
  };
}

function supabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in Netlify Environment Variables');
  }
  return createClient(url, key);
}

function readBody(event) {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch (e) {
    return {};
  }
}

function adminOk(event) {
  const expected = process.env.ADMIN_TOKEN;
  const received = event.headers['x-admin-token'] || event.headers['X-Admin-Token'];
  return Boolean(expected && received && expected === received);
}

function normalizePhone(phone) {
  return String(phone || '').replace(/[^\d]/g, '');
}

async function validateSeller(sb, sellerId, token) {
  if (!sellerId || !token) return null;
  const { data, error } = await sb
    .from('sellers')
    .select('*')
    .eq('id', sellerId)
    .eq('token', token)
    .single();
  if (error || !data || data.status !== 'active') return null;
  return data;
}

module.exports = { corsHeaders, json, supabase, readBody, adminOk, normalizePhone, validateSeller };
