
const API = '/.netlify/functions';
const $ = (id) => document.getElementById(id);

function esc(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function imgFallback(){return "data:image/svg+xml;charset=UTF-8,"+encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'><rect width='100%' height='100%' fill='#eef2ff'/><text x='50%' y='50%' text-anchor='middle' dominant-baseline='middle' fill='#64748b' font-size='30' font-family='Arial'>صورة المنتج</text></svg>`)}
function toast(msg){const t=$('toast'); if(!t) return alert(msg); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2200)}
async function req(path, opts={}){
  const res = await fetch(API+path, {
    ...opts,
    headers: {'Content-Type':'application/json', ...(opts.headers||{})}
  });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error || 'حدث خطأ في الاتصال');
  return data;
}
function money(v,c='MRU'){return `${Number(v||0).toLocaleString('ar')} ${c||''}`}

// الصفحة الرئيسية
let productsCache = [];
async function loadProducts(){
  try{
    $('productsGrid').innerHTML = `<div class="empty">جاري تحميل المنتجات...</div>`;
    const data = await req('/products');
    productsCache = data.products || [];
    renderProducts();
  }catch(e){
    $('productsGrid').innerHTML = `<div class="empty">خطأ: ${esc(e.message)}</div>`;
  }
}
function renderProducts(){
  const q = ($('searchInput')?.value || '').trim().toLowerCase();
  const items = productsCache.filter(p => [p.name,p.category,p.description,p.sellers?.store_name].join(' ').toLowerCase().includes(q));
  if(!items.length){
    $('productsGrid').innerHTML = `<div class="empty">لا توجد منتجات الآن.</div>`;
    return;
  }
  $('productsGrid').innerHTML = items.map(p=>`
    <article class="product">
      <div class="img"><img src="${esc(p.image_url||imgFallback())}" onerror="this.src='${imgFallback()}'"><span class="tag">${esc(p.category||'منتج')}</span></div>
      <div class="body">
        <h3>${esc(p.name)}</h3>
        <div class="seller">البائع: ${esc(p.sellers?.store_name||'متجر')}</div>
        <div class="desc">${esc(p.description||'')}</div>
        <div class="price">${money(p.price,p.currency)}</div>
        <button class="btn primary" onclick="openOrder('${p.id}')">طلب المنتج</button>
        <button class="btn outline" onclick="contactSeller('${p.id}')">تواصل مع البائع</button>
      </div>
    </article>
  `).join('');
}
function contactSeller(id){
  const p = productsCache.find(x=>x.id===id);
  const phone = String(p?.sellers?.phone||'').replace(/[^\d]/g,'');
  if(!phone) return toast('رقم البائع غير موجود');
  const text = `السلام عليكم، أريد الاستفسار عن المنتج: ${p.name}`;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`,'_blank');
}
function openOrder(id){
  const p = productsCache.find(x=>x.id===id);
  if(!p) return;
  $('orderProductId').value = p.id;
  $('orderProductName').textContent = p.name + ' - ' + money(p.price,p.currency);
  $('orderModal').classList.add('open');
}
function closeOrder(){ $('orderModal').classList.remove('open') }
async function submitOrder(e){
  e.preventDefault();
  try{
    const data = await req('/orders', {
      method:'POST',
      body: JSON.stringify({
        product_id: $('orderProductId').value,
        buyer_name: $('buyerName').value,
        buyer_phone: $('buyerPhone').value,
        quantity: $('buyerQty').value,
        notes: $('buyerNotes').value
      })
    });
    toast('تم تسجيل الطلب');
    closeOrder();
    const sellerPhone = String(data.product?.sellers?.phone||'').replace(/[^\d]/g,'');
    const msg = `طلب جديد\nالمنتج: ${data.product.name}\nالكمية: ${data.order.quantity}\nالإجمالي: ${money(data.order.total_amount, data.product.currency)}\nاسم الزبون: ${data.order.buyer_name}\nرقم الزبون: ${data.order.buyer_phone}`;
    if(sellerPhone) window.open(`https://wa.me/${sellerPhone}?text=${encodeURIComponent(msg)}`,'_blank');
  }catch(e){toast(e.message)}
}

// لوحة البائع
function sellerCreds(){
  return { seller_id: localStorage.getItem('seller_id'), seller_token: localStorage.getItem('seller_token') };
}
function saveSellerCreds(id, token){
  localStorage.setItem('seller_id', id);
  localStorage.setItem('seller_token', token);
}
function logoutSeller(){
  localStorage.removeItem('seller_id'); localStorage.removeItem('seller_token'); location.reload();
}
async function registerSeller(e){
  e.preventDefault();
  try{
    const data = await req('/sellers', {
      method:'POST',
      body: JSON.stringify({
        store_name:$('storeName').value,
        owner_name:$('ownerName').value,
        phone:$('sellerPhone').value,
        city:$('sellerCity').value
      })
    });
    saveSellerCreds(data.seller_id, data.seller_token);
    $('sellerIdBox').value = data.seller_id;
    $('sellerTokenBox').value = data.seller_token;
    toast('تم إنشاء حساب البائع');
    loadSellerDashboard();
  }catch(e){toast(e.message)}
}
function loginSeller(e){
  e.preventDefault();
  saveSellerCreds($('loginSellerId').value.trim(), $('loginSellerToken').value.trim());
  toast('تم حفظ بيانات الدخول');
  loadSellerDashboard();
}
async function loadSellerDashboard(){
  const c = sellerCreds();
  if(!c.seller_id || !c.seller_token) return;
  $('sellerPanel').style.display='block';
  $('sellerHint').style.display='none';
  await Promise.all([loadSellerProducts(), loadSellerOrders()]);
}
async function loadSellerProducts(){
  const c = sellerCreds();
  try{
    const data = await req(`/products?seller_id=${encodeURIComponent(c.seller_id)}&seller_token=${encodeURIComponent(c.seller_token)}`);
    const items = data.products||[];
    $('sellerProducts').innerHTML = items.length ? items.map(p=>`
      <tr>
        <td>${esc(p.name)}</td><td>${money(p.price,p.currency)}</td><td><span class="status ${esc(p.status)}">${esc(p.status)}</span></td>
        <td>
          <button class="btn soft" onclick='editProduct(${JSON.stringify(p).replaceAll("'","&#039;")})'>تعديل</button>
          <button class="btn danger" onclick="deleteProduct('${p.id}')">حذف</button>
        </td>
      </tr>`).join('') : `<tr><td colspan="4">لا توجد منتجات</td></tr>`;
  }catch(e){toast(e.message)}
}
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
function editProduct(p){
  $('productId').value=p.id; $('productName').value=p.name||''; $('productPrice').value=p.price||0; $('productCurrency').value=p.currency||'MRU';
  $('productCategory').value=p.category||''; $('productImage').value=p.image_url||''; $('productDesc').value=p.description||''; $('productStatus').value=p.status||'active';
  window.scrollTo({top:0,behavior:'smooth'});
}
async function deleteProduct(id){
  if(!confirm('حذف المنتج؟')) return;
  const c = sellerCreds();
  try{
    await req('/products', {method:'DELETE', body:JSON.stringify({id, seller_id:c.seller_id, seller_token:c.seller_token})});
    toast('تم حذف المنتج'); loadSellerProducts();
  }catch(e){toast(e.message)}
}
async function loadSellerOrders(){
  const c = sellerCreds();
  try{
    const data = await req(`/orders?seller_id=${encodeURIComponent(c.seller_id)}&seller_token=${encodeURIComponent(c.seller_token)}`);
    const items = data.orders||[];
    $('sellerOrders').innerHTML = items.length ? items.map(o=>`
      <tr>
        <td>${esc(o.products?.name||'')}</td><td>${esc(o.buyer_name)}<br><small>${esc(o.buyer_phone)}</small></td>
        <td>${money(o.total_amount,o.products?.currency)}<br><small>عمولة 2%: ${money(o.commission_amount,o.products?.currency)}</small></td>
        <td><span class="status ${esc(o.status)}">${esc(o.status)}</span></td>
        <td>
          <button class="btn green" onclick="updateOrder('${o.id}','completed')">مكتمل</button>
          <button class="btn danger" onclick="updateOrder('${o.id}','cancelled')">إلغاء</button>
        </td>
      </tr>`).join('') : `<tr><td colspan="5">لا توجد طلبات</td></tr>`;
  }catch(e){toast(e.message)}
}
async function updateOrder(order_id,status){
  const c = sellerCreds();
  try{
    await req('/orders',{method:'PUT', body:JSON.stringify({order_id,status,seller_id:c.seller_id,seller_token:c.seller_token})});
    toast('تم تحديث الطلب'); loadSellerOrders();
  }catch(e){toast(e.message)}
}

// لوحة المدير
function adminToken(){ return localStorage.getItem('admin_token') || '' }
function saveAdminToken(){ localStorage.setItem('admin_token',$('adminToken').value.trim()); loadAdmin() }
async function loadAdmin(){
  if(!$('adminContent')) return;
  const token = adminToken();
  if(!token){$('adminContent').innerHTML='<div class="empty">أدخل رمز المدير أولاً.</div>';return}
  try{
    const data = await req('/admin',{headers:{'x-admin-token':token}});
    const s=data.stats||{};
    $('adminContent').innerHTML = `
      <div class="stats">
        <div class="stat"><b>${s.sellers_count||0}</b><span>بائعين</span></div>
        <div class="stat"><b>${s.products_count||0}</b><span>منتجات</span></div>
        <div class="stat"><b>${s.orders_count||0}</b><span>طلبات</span></div>
        <div class="stat"><b>${money(s.total_commission,'')}</b><span>عمولتك من المكتمل</span></div>
      </div>
      <div class="card"><h2>الطلبات</h2><table class="table"><thead><tr><th>المنتج</th><th>البائع</th><th>الزبون</th><th>المبلغ</th><th>العمولة</th><th>الحالة</th></tr></thead><tbody>
      ${(data.orders||[]).map(o=>`<tr><td>${esc(o.products?.name||'')}</td><td>${esc(o.sellers?.store_name||'')}</td><td>${esc(o.buyer_name)}<br><small>${esc(o.buyer_phone)}</small></td><td>${money(o.total_amount,o.products?.currency)}</td><td>${money(o.commission_amount,o.products?.currency)}</td><td><span class="status ${esc(o.status)}">${esc(o.status)}</span></td></tr>`).join('')||'<tr><td colspan="6">لا توجد طلبات</td></tr>'}
      </tbody></table></div>
      <div class="card" style="margin-top:16px"><h2>البائعون</h2><table class="table"><thead><tr><th>المتجر</th><th>الهاتف</th><th>المدينة</th><th>الحالة</th><th>تحكم</th></tr></thead><tbody>
      ${(data.sellers||[]).map(s=>`<tr><td>${esc(s.store_name)}</td><td>${esc(s.phone)}</td><td>${esc(s.city||'')}</td><td><span class="status ${esc(s.status)}">${esc(s.status)}</span></td><td><button class="btn ${s.status==='blocked'?'green':'danger'}" onclick="sellerStatus('${s.id}','${s.status==='blocked'?'active':'blocked'}')">${s.status==='blocked'?'تفعيل':'حظر'}</button></td></tr>`).join('')||'<tr><td colspan="5">لا يوجد بائعون</td></tr>'}
      </tbody></table></div>
      <div class="card" style="margin-top:16px"><h2>المنتجات</h2><table class="table"><thead><tr><th>المنتج</th><th>البائع</th><th>السعر</th><th>الحالة</th><th>تحكم</th></tr></thead><tbody>
      ${(data.products||[]).map(p=>`<tr><td>${esc(p.name)}</td><td>${esc(p.sellers?.store_name||'')}</td><td>${money(p.price,p.currency)}</td><td><span class="status ${esc(p.status)}">${esc(p.status)}</span></td><td><button class="btn soft" onclick="productStatus('${p.id}','${p.status==='active'?'hidden':'active'}')">${p.status==='active'?'إخفاء':'إظهار'}</button></td></tr>`).join('')||'<tr><td colspan="5">لا توجد منتجات</td></tr>'}
      </tbody></table></div>`;
  }catch(e){$('adminContent').innerHTML=`<div class="empty">خطأ: ${esc(e.message)}</div>`}
}
async function sellerStatus(id,status){
  try{await req('/admin',{method:'PUT',headers:{'x-admin-token':adminToken()},body:JSON.stringify({type:'seller_status',id,status})});loadAdmin()}catch(e){toast(e.message)}
}
async function productStatus(id,status){
  try{await req('/admin',{method:'PUT',headers:{'x-admin-token':adminToken()},body:JSON.stringify({type:'product_status',id,status})});loadAdmin()}catch(e){toast(e.message)}
}
