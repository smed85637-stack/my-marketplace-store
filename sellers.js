
const crypto = require('crypto');
const { corsHeaders, json, supabase, readBody } = require('./_supabase');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' };

  try {
    const sb = supabase();

    if (event.httpMethod === 'POST') {
      const body = readBody(event);
      const store_name = String(body.store_name || '').trim();
      const phone = String(body.phone || '').trim();
      const owner_name = String(body.owner_name || '').trim();
      const city = String(body.city || '').trim();

      if (!store_name || !phone) {
        return json(400, { error: 'اسم المتجر ورقم الهاتف مطلوبان' });
      }

      const token = crypto.randomBytes(18).toString('hex');
      const { data, error } = await sb
        .from('sellers')
        .insert({ store_name, owner_name, phone, city, token })
        .select()
        .single();

      if (error) return json(500, { error: error.message });

      return json(200, { seller: data, seller_id: data.id, seller_token: token });
    }

    return json(405, { error: 'Method not allowed' });
  } catch (e) {
    return json(500, { error: e.message });
  }
};
