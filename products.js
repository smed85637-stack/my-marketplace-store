
const { corsHeaders, json, supabase, readBody, validateSeller } = require('./_supabase');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' };

  try {
    const sb = supabase();

    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {};
      const seller_id = params.seller_id;
      const seller_token = params.seller_token;

      if (seller_id && seller_token) {
        const seller = await validateSeller(sb, seller_id, seller_token);
        if (!seller) return json(401, { error: 'بيانات البائع غير صحيحة' });

        const { data, error } = await sb
          .from('products')
          .select('*')
          .eq('seller_id', seller_id)
          .neq('status', 'deleted')
          .order('created_at', { ascending: false });

        if (error) return json(500, { error: error.message });
        return json(200, { products: data || [] });
      }

      const { data, error } = await sb
        .from('products')
        .select('*, sellers(store_name, phone, city)')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) return json(500, { error: error.message });
      return json(200, { products: data || [] });
    }

    if (event.httpMethod === 'POST') {
      const body = readBody(event);
      const seller = await validateSeller(sb, body.seller_id, body.seller_token);
      if (!seller) return json(401, { error: 'بيانات البائع غير صحيحة' });

      const payload = {
        seller_id: seller.id,
        name: String(body.name || '').trim(),
        description: String(body.description || '').trim(),
        price: Number(body.price || 0),
        currency: String(body.currency || 'MRU').trim(),
        image_url: String(body.image_url || '').trim(),
        category: String(body.category || '').trim(),
        status: String(body.status || 'active')
      };

      if (!payload.name) return json(400, { error: 'اسم المنتج مطلوب' });
      if (payload.price < 0) return json(400, { error: 'السعر غير صحيح' });

      let query;
      if (body.id) {
        query = sb.from('products')
          .update(payload)
          .eq('id', body.id)
          .eq('seller_id', seller.id)
          .select()
          .single();
      } else {
        query = sb.from('products')
          .insert(payload)
          .select()
          .single();
      }

      const { data, error } = await query;
      if (error) return json(500, { error: error.message });
      return json(200, { product: data });
    }

    if (event.httpMethod === 'DELETE') {
      const body = readBody(event);
      const seller = await validateSeller(sb, body.seller_id, body.seller_token);
      if (!seller) return json(401, { error: 'بيانات البائع غير صحيحة' });

      const { data, error } = await sb
        .from('products')
        .update({ status: 'deleted' })
        .eq('id', body.id)
        .eq('seller_id', seller.id)
        .select()
        .single();

      if (error) return json(500, { error: error.message });
      return json(200, { product: data });
    }

    return json(405, { error: 'Method not allowed' });
  } catch (e) {
    return json(500, { error: e.message });
  }
};
