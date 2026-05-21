const { corsHeaders, json, supabase, readBody, validateSeller } = require('./_supabase');

function dataUrlToBuffer(dataUrl) {
  const match = String(dataUrl || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new Error('صيغة الصورة غير صحيحة');

  const contentType = match[1];
  const base64 = match[2];
  const buffer = Buffer.from(base64, 'base64');

  let ext = 'jpg';
  if (contentType.includes('png')) ext = 'png';
  if (contentType.includes('webp')) ext = 'webp';
  if (contentType.includes('gif')) ext = 'gif';
  if (contentType.includes('jpeg')) ext = 'jpg';

  return { buffer, contentType, ext };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  try {
    const sb = supabase();
    const body = readBody(event);

    const seller = await validateSeller(sb, body.seller_id, body.seller_token);
    if (!seller) return json(401, { error: 'بيانات البائع غير صحيحة' });

    const files = Array.isArray(body.files) ? body.files : [];
    if (!files.length) return json(400, { error: 'لم يتم اختيار صور' });

    const urls = [];

    for (const file of files) {
      const { buffer, contentType, ext } = dataUrlToBuffer(file.data);

      if (!contentType.startsWith('image/')) {
        return json(400, { error: 'الملف يجب أن يكون صورة' });
      }

      if (buffer.length > 5 * 1024 * 1024) {
        return json(400, { error: 'حجم الصورة كبير، الحد الأقصى 5MB' });
      }

      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const filePath = `products/${seller.id}/${fileName}`;

      const { data, error } = await sb.storage
        .from('product-images')
        .upload(filePath, buffer, {
          contentType,
          upsert: false
        });

      if (error) return json(500, { error: error.message });

      const { data: publicUrlData } = sb.storage
        .from('product-images')
        .getPublicUrl(data.path);

      urls.push(publicUrlData.publicUrl);
    }

    return json(200, { urls });
  } catch (e) {
    return json(500, { error: e.message });
  }
};
