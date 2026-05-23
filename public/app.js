const API = '/api';const $ = (id) => document.getElementById(id);

function esc(s){
  return String(s||'').replace(/[&<>"']/g,m=>({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#039;'
  }[m]));
}

function imgFallback(){
  return "data:image/svg+xml;charset=UTF-8,"+encodeURIComponent(`
    <svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'>
      <rect width='100%' height='100%' fill='#eef2ff'/>
      <text x='50%' y='50%' text-anchor='middle' dominant-baseline='middle' fill='#64748b' font-size='30' font-family='Arial'>صورة المنتج</text>
    </svg>
  `);
}

function toast(msg){
  const t=$('toast');
  if(!t) return alert(msg);
  t.textContent=msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),2200);
}

async function req(path, opts={}){
  const res = await fetch(API+path, {
    ...opts,
    headers: {'Content-Type':'application/json', ...(opts.headers||{})}
  });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error || 'حدث خطأ في الاتصال');
  return data;
}

function money(v,c='MRU'){
  return `${Number(v||0).toLocaleString('ar')} ${c||''}`;
}

function productMainImage(p){
  return p?.image_url || (Array.isArray(p?.images) ? p.images[0] : '') || imgFallback();
}

// الصفحة الرئيسية
let productsCache = [];
let selectedCategory = 'الكل';
function normalizeCategoryName(v){
  return String(v || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي');
}
async function loadProducts(){
  try{
    $('productsGrid').innerHTML = `<div class="empty">جاري تحميل المنتجات...</div>`;
    const data = await req('/products');

    productsCache = (data.products || []).filter(p => {
      return !p.status || p.status === 'active';
    });

    renderProducts();
  }catch(e){
    $('productsGrid').innerHTML = `<div class="empty">خطأ: ${esc(e.message)}</div>`;
  }
}

function renderProducts(){
  if (!$('productsGrid')) return;

  const q = ($('searchInput')?.value || '').trim().toLowerCase();

  let items = productsCache.filter(p =>
    [p.name, p.category, p.description, p.sellers?.store_name]
      .join(' ')
      .toLowerCase()
      .includes(q)
  );

if(selectedCategory !== 'الكل'){
  items = items.filter(p =>
    normalizeCategoryName(p.category || 'أخرى') === normalizeCategoryName(selectedCategory)
  );
}

  if(!items.length){
    $('productsGrid').innerHTML = `<div class="empty">لا توجد منتجات الآن.</div>`;
    return;
  }

  $('productsGrid').innerHTML = items.map(p=>`
    <article class="product">
      <div class="img">
        <img src="${esc(productMainImage(p))}" onerror="this.src='${imgFallback()}'">
        <span class="tag">${esc(p.category||'منتج')}</span>
      </div>
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

function filterCategory(category){
  selectedCategory = category;
  renderProducts();
}

function contactSeller(id){
  const p = productsCache.find(x=>x.id===id);
  const phone = String(p?.sellers?.phone||'').replace(/[^\d]/g,'');
  if(!phone) return toast('رقم البائع غير موجود');
  const text = `السلام عليكم، أريد الاستفسار عن المنتج: ${p.name}`;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`,'_blank');
}

function openOrder(id){
  const p = productsCache.find(x => String(x.id) === String(id));

  if(!p){
    return toast("لم يتم العثور على المنتج");
  }

  const buyerName = prompt("اكتب اسمك:");
  if(!buyerName) return;

  const buyerPhone = prompt("اكتب رقم هاتفك:");
  if(!buyerPhone) return;

  const buyerAddress = prompt("اكتب عنوان التوصيل:");
  if(!buyerAddress) return;

  const sellerPhone = String(
    p?.sellers?.phone ||
    p?.sellers?.whatsapp ||
    p?.seller_phone ||
    p?.phone ||
    ""
  ).replace(/\D/g, "");

  const productName = p.name || "منتج";
  const priceText = money(p.price, p.currency);

  const text =
    "طلب منتج جديد\n\n" +
    "المنتج: " + productName + "\n" +
    "السعر: " + priceText + "\n\n" +
    "اسم الزبون: " + buyerName + "\n" +
    "رقم الزبون: " + buyerPhone + "\n" +
    "عنوان التوصيل: " + buyerAddress;

  if(!sellerPhone){
    alert("رقم البائع غير موجود، لا يمكن إرسال الطلب عبر واتساب");
    return;
  }

  window.open(
    "https://wa.me/" + sellerPhone + "?text=" + encodeURIComponent(text),
    "_blank"
  );
}

function closeOrder(){
  $('orderModal').classList.remove('open');
}

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
  }catch(e){
    toast(e.message);
  }
}

// لوحة البائع
function sellerCreds(){
  return {
    seller_id: localStorage.getItem('seller_id'),
    seller_token: localStorage.getItem('seller_token')
  };
}

function saveSellerCreds(id, token){
  localStorage.setItem('seller_id', id);
  localStorage.setItem('seller_token', token);
}

function logoutSeller(){
  localStorage.removeItem('seller_id');
  localStorage.removeItem('seller_token');
  location.reload();
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
  }catch(e){
    toast(e.message);
  }
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
        <td>${esc(p.name)}</td>
        <td>${money(p.price,p.currency)}</td>
        <td><span class="status ${esc(p.status)}">${esc(p.status)}</span></td>
        <td>
          <button class="btn soft" onclick='editProduct(${JSON.stringify(p).replaceAll("'","&#039;")})'>تعديل</button>
          <button class="btn danger" onclick="deleteProduct('${p.id}')">حذف</button>
        </td>
      </tr>
    `).join('') : `<tr><td colspan="4">لا توجد منتجات</td></tr>`;
  }catch(e){
    toast(e.message);
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('فشل قراءة الصورة'));
    reader.readAsDataURL(file);
  });
}

async function uploadSelectedProductImages() {
  const input = $('productImages');
  const files = Array.from(input?.files || []);

  if (!files.length) return [];

  const c = sellerCreds();

  const payloadFiles = await Promise.all(files.map(async (file) => ({
    name: file.name,
    type: file.type,
    data: await fileToDataUrl(file)
  })));

  const data = await req('/upload', {
    method: 'POST',
    body: JSON.stringify({
      seller_id: c.seller_id,
      seller_token: c.seller_token,
      files: payloadFiles
    })
  });

  return data.urls || [];
}

function getOldImages() {
  try {
    return JSON.parse($('productImagesJson')?.value || '[]');
  } catch (e) {
    return [];
  }
}

async function saveProduct(e){
  e.preventDefault();
  const c = sellerCreds();

  try{
    const newImageUrls = await uploadSelectedProductImages();
    const oldImages = getOldImages();
    const finalImages = newImageUrls.length ? newImageUrls : oldImages;
    const mainImage = finalImages[0] || $('productImageUrl')?.value || '';

    await req('/products', {
      method:'POST',
      body: JSON.stringify({
        seller_id:c.seller_id,
        seller_token:c.seller_token,
        id:$('productId').value || undefined,
        name:$('productName').value,
        price:$('productPrice').value,
        currency:$('productCurrency').value || 'MRU',
        category:$('productCategory').value,
        image_url:mainImage,
        images:finalImages,
        description:$('productDesc').value,
        status:'active'
      })
    });

    e.target.reset();
    $('productId').value='';
    $('productImageUrl').value='';
    $('productImagesJson').value='';
    if ($('imagePreview')) $('imagePreview').innerHTML='';

    toast('تم حفظ المنتج مع الصور');
    loadSellerProducts();
  }catch(e){
    toast(e.message);
  }
}

function editProduct(p){
  $('productId').value=p.id;
  $('productName').value=p.name||'';
  $('productPrice').value=p.price||0;
  $('productCurrency').value=p.currency||'MRU';
  $('productCategory').value=p.category||'';
  $('productDesc').value=p.description||'';
  $('productImageUrl').value=p.image_url||'';
  $('productImagesJson').value=JSON.stringify(p.images||[]);

  if ($('imagePreview')) {
    const img = productMainImage(p);
    $('imagePreview').innerHTML = img ? `<img src="${esc(img)}" alt="صورة المنتج">` : '';
  }

  window.scrollTo({top:0,behavior:'smooth'});
}

async function deleteProduct(id){
  if(!confirm('حذف المنتج؟')) return;
  const c = sellerCreds();
  try{
    await req('/products', {
      method:'DELETE',
      body:JSON.stringify({
        id,
        seller_id:c.seller_id,
        seller_token:c.seller_token
      })
    });
    toast('تم حذف المنتج');
    loadSellerProducts();
  }catch(e){
    toast(e.message);
  }
}

async function loadSellerOrders(){
  const c = sellerCreds();
  try{
    const data = await req(`/orders?seller_id=${encodeURIComponent(c.seller_id)}&seller_token=${encodeURIComponent(c.seller_token)}`);
    const items = data.orders||[];

    $('sellerOrders').innerHTML = items.length ? items.map(o=>`
      <tr>
        <td>${esc(o.products?.name||'')}</td>
        <td>${esc(o.buyer_name)}<br><small>${esc(o.buyer_phone)}</small></td>
        <td>${money(o.total_amount,o.products?.currency)}<br><small>عمولة 2%: ${money(o.commission_amount,o.products?.currency)}</small></td>
        <td><span class="status ${esc(o.status)}">${esc(o.status)}</span></td>
        <td>
         <button class="btn green" onclick="updateOrder('${o.id}','completed')">تم البيع</button>
          <button class="btn danger" onclick="updateOrder('${o.id}','cancelled')">إلغاء</button>
        </td>
      </tr>
    `).join('') : `<tr><td colspan="5">لا توجد طلبات</td></tr>`;
  }catch(e){
    toast(e.message);
  }
}

async function updateOrder(order_id,status){
  const c = sellerCreds();
  try{
    await req('/orders',{
      method:'PUT',
      body:JSON.stringify({
        order_id,
        status,
        seller_id:c.seller_id,
        seller_token:c.seller_token
      })
    });
    toast('تم تحديث الطلب');
    loadSellerOrders();
  }catch(e){
    toast(e.message);
  }
}

// لوحة المدير
function adminToken(){
  return localStorage.getItem('admin_token') || '';
}

function saveAdminToken(){
  localStorage.setItem('admin_token',$('adminToken').value.trim());
  loadAdmin();
}

async function loadAdmin(){
  if(!$('adminContent')) return;

  const token = adminToken();
  if(!token){
    $('adminContent').innerHTML='<div class="empty">أدخل رمز المدير أولاً.</div>';
    return;
  }

  try{
    const data = await req('/admin',{headers:{'x-admin-token':token}});
    const s=data.stats||{};

    $('adminContent').innerHTML = `
      <div class="stats">
        <div class="stat"><b>${s.sellers_count||0}</b><span>بائعين</span></div>
        <div class="stat"><b>${s.products_count||0}</b><span>منتجات</span></div>
        <div class="stat"><b>${s.orders_count||0}</b><span>طلبات</span></div>
        <div class="stat"><b>${s.completed_orders_count||0}</b><span>طلبات مكتملة</span></div>
      </div>

      <div class="card">
        <h2>الطلبات</h2>
        <table class="table">
          <thead>
            <tr>
              <th>المنتج</th>
              <th>البائع</th>
              <th>الزبون</th>
              <th>المبلغ</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${(data.orders||[]).map(o=>`
              <tr>
                <td>${esc(o.products?.name||'')}</td>
                <td>${esc(o.sellers?.store_name||'')}</td>
                <td>${esc(o.buyer_name)}<br><small>${esc(o.buyer_phone)}</small></td>
                <td>${money(o.total_amount,o.products?.currency)}</td>
                <td><span class="status ${esc(o.status)}">${esc(o.status)}</span></td>
              </tr>
            `).join('')||'<tr><td colspan="5">لا توجد طلبات</td></tr>'}
          </tbody>
        </table>
      </div>

      <div class="card" style="margin-top:16px">
        <h2>البائعون</h2>
        <table class="table">
          <thead>
            <tr>
              <th>المتجر</th>
              <th>الهاتف</th>
              <th>المدينة</th>
              <th>الحالة</th>
              <th>تحكم</th>
            </tr>
          </thead>
          <tbody>
            ${(data.sellers||[]).map(s=>`
              <tr>
                <td>${esc(s.store_name)}</td>
                <td>${esc(s.phone)}</td>
                <td>${esc(s.city||'')}</td>
                <td><span class="status ${esc(s.status)}">${esc(s.status)}</span></td>
                <td>
                  <button class="btn danger" onclick="sellerStatus('${s.id}','deleted')">
  حذف
</button> </button>
                </td>
              </tr>
            `).join('')||'<tr><td colspan="5">لا يوجد بائعون</td></tr>'}
          </tbody>
        </table>
      </div>

      <div class="card" style="margin-top:16px">
        <h2>المنتجات</h2>
        <table class="table">
          <thead>
            <tr>
              <th>المنتج</th>
              <th>البائع</th>
              <th>السعر</th>
              <th>الحالة</th>
              <th>تحكم</th>
            </tr>
          </thead>
          <tbody>
            ${(data.products||[]).map(p=>`
              <tr>
                <td>${esc(p.name)}</td>
                <td>${esc(p.sellers?.store_name||'')}</td>
                <td>${money(p.price,p.currency)}</td>
                <td><span class="status ${esc(p.status || 'active')}">${esc(p.status || 'active')}</span></td>
                <td>
                  <div class="admin-actions">
                    ${p.status !== 'active' ? `
                      <button class="mini-btn mini-success" onclick="productStatus('${p.id}','active')">إظهار</button>
                    ` : ''}

                    ${p.status !== 'hidden' ? `
                      <button class="mini-btn mini-warning" onclick="productStatus('${p.id}','hidden')">إخفاء</button>
                    ` : ''}

                    ${p.status !== 'blocked' ? `
                      <button class="mini-btn mini-danger" onclick="productStatus('${p.id}','blocked')">حظر</button>
                    ` : ''}

                    <button class="mini-btn mini-danger" onclick="productStatus('${p.id}','deleted')">حذف</button>
                  </div>
                </td>
              </tr>
            `).join('')||'<tr><td colspan="5">لا توجد منتجات</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  }catch(e){
    $('adminContent').innerHTML=`<div class="empty">خطأ: ${esc(e.message)}</div>`;
  }
}

async function sellerStatus(id,status){
  try{
    if(status === 'deleted'){
      if(!confirm('هل تريد حذف هذا البائع نهائياً؟')) return;
    }

    await req('/admin',{
      method:'PUT',
      headers:{'x-admin-token':adminToken()},
      body:JSON.stringify({type:'seller_status',id,status})
    });

    toast(status === 'deleted' ? 'تم حذف البائع' : 'تم تحديث حالة البائع');
    loadAdmin();

  }catch(e){
    toast(e.message);
  }
}
/* نقل المنتجات الأكثر مبيعاً فوق الأقسام المميزة */
function moveBestSellersAboveCategories() {
  const titles = document.querySelectorAll("h1, h2, h3");

  let bestTitle = null;
  let categoriesTitle = null;

  titles.forEach((title) => {
    const text = title.textContent.trim();

    if (text.includes("المنتجات الأكثر مبيع")) {
      bestTitle = title;
    }

    if (text.includes("الأقسام المميزة")) {
      categoriesTitle = title;
    }
  });

  if (!bestTitle || !categoriesTitle) return;

  const bestSection = bestTitle.closest("section") || bestTitle.parentElement;
  const categoriesSection = categoriesTitle.closest("section") || categoriesTitle.parentElement;

  if (!bestSection || !categoriesSection) return;

  categoriesSection.parentNode.insertBefore(bestSection, categoriesSection);
}

window.addEventListener("DOMContentLoaded", () => {
  moveBestSellersAboveCategories();

  setTimeout(() => {
    moveBestSellersAboveCategories();
  }, 1000);
});
