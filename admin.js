const { corsHeaders, json, supabase, adminOk, readBody } = require('./_supabase');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  try {
    if (!adminOk(event)) {
      return json(401, { error: 'رمز المدير غير صحيح' });
    }

    const sb = supabase();

    if (event.httpMethod === 'GET') {
      const [sellersRes, productsRes, ordersRes] = await Promise.all([
        sb.from('sellers')
          .select('*')
          .order('created_at', { ascending: false }),

        sb.from('products')
          .select('*, sellers(store_name, phone)')
          .neq('status', 'deleted')
          .order('created_at', { ascending: false }),

        sb.from('orders')
          .select('*, products(name, currency), sellers(store_name, phone)')
          .order('created_at', { ascending: false })
      ]);

      if (sellersRes.error) return json(500, { error: sellersRes.error.message });
      if (productsRes.error) return json(500, { error: productsRes.error.message });
      if (ordersRes.error) return json(500, { error: ordersRes.error.message });

      const orders = ordersRes.data || [];
      const completed = orders.filter(o => o.status === 'completed');

      const totalSales = completed.reduce((s, o) => {
        return s + Number(o.total_amount || 0);
      }, 0);

      const totalCommission = completed.reduce((s, o) => {
        return s + Number(o.commission_amount || 0);
      }, 0);

      return json(200, {
        sellers: sellersRes.data || [],
        products: productsRes.data || [],
        orders,
        stats: {
          sellers_count: (sellersRes.data || []).length,
          products_count: (productsRes.data || []).length,
          orders_count: orders.length,
          completed_orders_count: completed.length,
          total_sales: Number(totalSales.toFixed(2)),
          total_commission: Number(totalCommission.toFixed(2))
        }
      });
    }

    if (event.httpMethod === 'PUT') {
      const body = readBody(event);

      if (body.type === 'seller_status') {
        const status = body.status === 'blocked' ? 'blocked' : 'active';

        const { data, error } = await sb.from('sellers')
          .update({ status })
          .eq('id', body.id)
          .select()
          .single();

        if (error) return json(500, { error: error.message });

        return json(200, { seller: data });
      }

      if (body.type === 'product_status') {
        const allowed = ['active', 'hidden', 'blocked', 'deleted'];
        const status = allowed.includes(body.status) ? body.status : 'active';

        const { data, error } = await sb.from('products')
          .update({ status })
          .eq('id', body.id)
          .select()
          .single();

        if (error) return json(500, { error: error.message });

        return json(200, { product: data });
      }

      return json(400, { error: 'نوع التحديث غير صحيح' });
    }

    return json(405, { error: 'Method not allowed' });

  } catch (e) {
    return json(500, { error: e.message });
  }
};
