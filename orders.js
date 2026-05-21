
const { corsHeaders, json, supabase, readBody, validateSeller } = require('./_supabase');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' };

  try {
    const sb = supabase();

    if (event.httpMethod === 'POST') {
      const body = readBody(event);
      const product_id = body.product_id;
      const buyer_name = String(body.buyer_name || '').trim();
      const buyer_phone = String(body.buyer_phone || '').trim();
      const quantity = Math.max(1, parseInt(body.quantity || 1, 10));
      const notes = String(body.notes || '').trim();

      if (!product_id || !buyer_name || !buyer_phone) {
        return json(400, { error: 'المنتج، اسم الزبون، ورقم الهاتف مطلوبة' });
      }

      const { data: product, error: productError } = await sb
        .from('products')
        .select('*, sellers(store_name, phone, city)')
        .eq('id', product_id)
        .eq('status', 'active')
        .single();

      if (productError || !product) return json(404, { error: 'المنتج غير موجود' });

      const total_amount = Number(product.price || 0) * quantity;
      const commission_rate = 0.02;
      const commission_amount = Number((total_amount * commission_rate).toFixed(2));

      const { data: order, error } = await sb
        .from('orders')
        .insert({
          product_id,
          seller_id: product.seller_id,
          buyer_name,
          buyer_phone,
          quantity,
          total_amount,
          commission_rate,
          commission_amount,
          notes
        })
        .select()
        .single();

      if (error) return json(500, { error: error.message });

      return json(200, { order, product });
    }

    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {};
      const seller = await validateSeller(sb, params.seller_id, params.seller_token);
      if (!seller) return json(401, { error: 'بيانات البائع غير صحيحة' });

      const { data, error } = await sb
        .from('orders')
        .select('*, products(name, image_url, currency)')
        .eq('seller_id', seller.id)
        .order('created_at', { ascending: false });

      if (error) return json(500, { error: error.message });
      return json(200, { orders: data || [] });
    }

    if (event.httpMethod === 'PUT') {
      const body = readBody(event);
      const seller = await validateSeller(sb, body.seller_id, body.seller_token);
      if (!seller) return json(401, { error: 'بيانات البائع غير صحيحة' });

      const allowed = ['pending', 'completed', 'cancelled'];
      const status = String(body.status || '').trim();
      if (!allowed.includes(status)) return json(400, { error: 'حالة الطلب غير صحيحة' });

      const { data, error } = await sb
        .from('orders')
        .update({ status })
        .eq('id', body.order_id)
        .eq('seller_id', seller.id)
        .select()
        .single();

      if (error) return json(500, { error: error.message });
      return json(200, { order: data });
    }

    return json(405, { error: 'Method not allowed' });
  } catch (e) {
    return json(500, { error: e.message });
  }
};
