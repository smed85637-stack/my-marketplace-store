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
       <div class="product-actions">
  <button class="btn primary" onclick="openOrder('${p.id}')">طلب المنتج</button>
  <button class="btn outline" onclick="contactSeller('${p.id}')">تواصل</button>
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
/* إصلاح قوي لشكل المنتجات الأكثر مبيعاً */
function makeProductsSmall() {
  const grid = document.getElementById("productsGrid");
  if (!grid) return;

  grid.style.display = "grid";
grid.style.setProperty("grid-template-columns", "repeat(3, 1fr)", "important");  grid.style.gap = "6px";
  grid.style.padding = "8px";
  grid.style.boxSizing = "border-box";
  grid.style.width = "100%";

  const cards = grid.children;

  Array.from(cards).forEach((card) => {
    card.style.width = "100%";
    card.style.padding = "6px";
    card.style.borderRadius = "14px";
    card.style.overflow = "hidden";
    card.style.boxSizing = "border-box";
    card.style.minHeight = "0";

    const img = card.querySelector("img");
    if (img) {
      img.style.width = "100%";
      img.style.height = "55px";
      img.style.objectFit = "cover";
      img.style.borderRadius = "10px";
      img.style.display = "block";
      img.style.marginBottom = "6px";
    }

    const titles = card.querySelectorAll("h3, h4");
    titles.forEach((title) => {
      title.style.fontSize = "10px";
      title.style.lineHeight = "1.3";
      title.style.height = "26px";
      title.style.overflow = "hidden";
      title.style.textAlign = "center";
      title.style.margin = "4px 0";
    });

    const paragraphs = card.querySelectorAll("p");

    paragraphs.forEach((p, index) => {
      p.style.fontSize = "8px";
      p.style.lineHeight = "1.2";
      p.style.margin = "3px 0";
      p.style.textAlign = "center";

      /* نخفي الوصف الطويل ونترك فقط البائع */
      if (index > 0) {
        p.style.display = "none";
      }
    });

    const buttons = card.querySelectorAll("button");
    buttons.forEach((btn) => {
      btn.style.width = "100%";
      btn.style.height = "25px";
      btn.style.fontSize = "7px";
      btn.style.padding = "2px";
      btn.style.borderRadius = "999px";
      btn.style.marginTop = "4px";
      btn.style.lineHeight = "1.1";
    });
  });
}

window.addEventListener("DOMContentLoaded", () => {
  makeProductsSmall();
  setTimeout(makeProductsSmall, 500);
  setTimeout(makeProductsSmall, 1500);
});

/* إخفاء وصف المنتجات الطويل حتى لا تصبح البطاقة طويلة */
function fixLongProductCards() {
  const grid = document.getElementById("productsGrid");
  if (!grid) return;

  grid.style.display = "grid";
grid.style.setProperty("grid-template-columns", "repeat(3, 1fr)", "important");  grid.style.gap = "6px";

  Array.from(grid.children).forEach((card) => {
    card.style.height = "230px";
    card.style.maxHeight = "230px";
    card.style.overflow = "hidden";

    const allTextElements = card.querySelectorAll("p, div, span");

    allTextElements.forEach((el) => {
      const text = el.textContent.trim();

      const hasImage = el.querySelector("img");
      const hasButton = el.querySelector("button");

      if (hasImage || hasButton) return;

      if (
        text.length > 25 &&
        !text.includes("البائع") &&
        !text.includes("MRU") &&
        !text.includes("طلب") &&
        !text.includes("تواصل")
      ) {
        el.style.display = "none";
      }
    });
  });
}

window.addEventListener("DOMContentLoaded", () => {
  fixLongProductCards();
 
});

// setInterval(fixLongProductCards, 2000);
/* === إجبار عرض 4 منتجات في نفس السطر === */
function //  forceFourProductsInRow() {
  const grid = document.getElementById("productsGrid");
  if (!grid) return;

  grid.style.setProperty("display", "grid", "important");
grid.style.setProperty("grid-template-columns", "repeat(3, 1fr)", "important");  grid.style.setProperty("gap", "6px", "important");
  grid.style.setProperty("padding", "8px", "important");
  grid.style.setProperty("width", "100%", "important");
  grid.style.setProperty("box-sizing", "border-box", "important");

  const cards = grid.querySelectorAll("article.product");

  cards.forEach((card) => {
    card.style.setProperty("width", "100%", "important");
    card.style.setProperty("min-width", "0", "important");
    card.style.setProperty("padding", "5px", "important");
    card.style.setProperty("border-radius", "14px", "important");
    card.style.setProperty("overflow", "hidden", "important");
    card.style.setProperty("min-height", "210px", "important");
    card.style.setProperty("max-height", "240px", "important");

    const imgBox = card.querySelector(".img");
    if (imgBox) {
      imgBox.style.setProperty("height", "60px", "important");
      imgBox.style.setProperty("min-height", "60px", "important");
      imgBox.style.setProperty("margin-bottom", "4px", "important");
      imgBox.style.setProperty("border-radius", "10px", "important");
    }

    const img = card.querySelector(".img img");
    if (img) {
      img.style.setProperty("height", "100%", "important");
      img.style.setProperty("width", "100%", "important");
      img.style.setProperty("object-fit", "cover", "important");
    }

    const title = card.querySelector("h3");
    if (title) {
      title.style.setProperty("font-size", "10px", "important");
      title.style.setProperty("height", "25px", "important");
      title.style.setProperty("line-height", "1.2", "important");
      title.style.setProperty("margin", "4px 0", "important");
      title.style.setProperty("overflow", "hidden", "important");
    }

    const seller = card.querySelector(".seller");
    if (seller) {
      seller.style.setProperty("font-size", "8px", "important");
      seller.style.setProperty("margin", "3px 0", "important");
    }

    const desc = card.querySelector(".desc");
    if (desc) {
      desc.style.setProperty("display", "none", "important");
    }

    const price = card.querySelector(".price");
    if (price) {
      price.style.setProperty("font-size", "12px", "important");
      price.style.setProperty("margin", "5px 0", "important");
    }

    const actions = card.querySelector(".product-actions");
    if (actions) {
      actions.style.setProperty("display", "grid", "important");
      actions.style.setProperty("grid-template-columns", "repeat(2, 1fr)", "important");
      actions.style.setProperty("gap", "4px", "important");
      actions.style.setProperty("width", "100%", "important");
    }

    const buttons = card.querySelectorAll("button, .btn");
    buttons.forEach((btn) => {
      btn.style.setProperty("width", "100%", "important");
      btn.style.setProperty("height", "24px", "important");
      btn.style.setProperty("min-height", "24px", "important");
      btn.style.setProperty("font-size", "7px", "important");
      btn.style.setProperty("padding", "2px", "important");
      btn.style.setProperty("margin", "0", "important");
      btn.style.setProperty("border-radius", "999px", "important");
      btn.style.setProperty("line-height", "1.1", "important");
    });

    const tag = card.querySelector(".tag");
    if (tag) {
      tag.style.setProperty("font-size", "8px", "important");
      tag.style.setProperty("padding", "3px 6px", "important");
    }
  });
}

window.addEventListener("DOMContentLoaded", () => {
  forceFourProductsInRow();
 // setTimeout(forceFourProductsInRow, 500);
 // setTimeout(forceFourProductsInRow, 1500);
 // setTimeout(forceFourProductsInRow, 3000);
});

// setInterval(forceFourProductsInRow, 1000);
/* === FINAL SHORT 4 PRODUCTS ROW === */
function forceFourProductsInRow() {
  const grid = document.getElementById("productsGrid");
  if (!grid) return;

  grid.style.setProperty("display", "grid", "important");
grid.style.setProperty("grid-template-columns", "repeat(3, 1fr)", "important");  grid.style.setProperty("gap", "5px", "important");
  grid.style.setProperty("padding", "8px", "important");
  grid.style.setProperty("align-items", "start", "important");

  const cards = grid.querySelectorAll("article.product");

  cards.forEach((card) => {
   card.style.setProperty("height", "190px", "important");
card.style.setProperty("min-height", "190px", "important");
card.style.setProperty("max-height", "190px", "important");
    card.style.setProperty("padding", "4px", "important");
    card.style.setProperty("border-radius", "12px", "important");
    card.style.setProperty("overflow", "hidden", "important");
    card.style.setProperty("box-sizing", "border-box", "important");

    const imgBox = card.querySelector(".img");
    if (imgBox) {
      imgBox.style.setProperty("height", "45px", "important");
      imgBox.style.setProperty("min-height", "45px", "important");
      imgBox.style.setProperty("margin-bottom", "3px", "important");
      imgBox.style.setProperty("border-radius", "8px", "important");
    }

    const img = card.querySelector(".img img");
    if (img) {
      img.style.setProperty("width", "100%", "important");
      img.style.setProperty("height", "100%", "important");
      img.style.setProperty("object-fit", "cover", "important");
    }

    const tag = card.querySelector(".tag");
    if (tag) {
      tag.style.setProperty("font-size", "7px", "important");
      tag.style.setProperty("padding", "2px 5px", "important");
    }

    const title = card.querySelector("h3");
    if (title) {
      title.style.setProperty("font-size", "9px", "important");
      title.style.setProperty("height", "22px", "important");
      title.style.setProperty("line-height", "1.2", "important");
      title.style.setProperty("margin", "3px 0", "important");
      title.style.setProperty("overflow", "hidden", "important");
    }

    const seller = card.querySelector(".seller");
    if (seller) {
      seller.style.setProperty("display", "none", "important");
    }

    const desc = card.querySelector(".desc");
    if (desc) {
      desc.style.setProperty("display", "none", "important");
    }

    const price = card.querySelector(".price");
    if (price) {
      price.style.setProperty("font-size", "11px", "important");
      price.style.setProperty("line-height", "1.1", "important");
      price.style.setProperty("margin", "4px 0", "important");
    }

    const actions = card.querySelector(".product-actions");
    if (actions) {
      actions.style.setProperty("display", "grid", "important");
      actions.style.setProperty("grid-template-columns", "repeat(2, 1fr)", "important");
      actions.style.setProperty("gap", "3px", "important");
      actions.style.setProperty("width", "100%", "important");
      actions.style.setProperty("margin-top", "3px", "important");
    }

    const buttons = card.querySelectorAll("button, .btn");

    if (buttons[0]) buttons[0].textContent = "طلب";
    if (buttons[1]) buttons[1].textContent = "تواصل";

    buttons.forEach((btn) => {
      btn.style.setProperty("width", "100%", "important");
     btn.style.setProperty("height", "20px", "important");
btn.style.setProperty("min-height", "20px", "important");
btn.style.setProperty("font-size", "6px", "important");
      btn.style.setProperty("padding", "1px", "important");
      btn.style.setProperty("margin", "0", "important");
      btn.style.setProperty("border-radius", "999px", "important");
      btn.style.setProperty("line-height", "1", "important");
    });
  });
}

window.addEventListener("DOMContentLoaded", () => {
  forceFourProductsInRow();
 // setTimeout(forceFourProductsInRow, 500);
//  setTimeout(forceFourProductsInRow, 1500);
});

// setInterval(forceFourProductsInRow, 1000);
/* === نفس حجم بطاقات الصورة المرجعية === */
function finalProductCardSizeLikeExample() {
  const grid = document.getElementById("productsGrid");
  if (!grid) return;

  grid.style.setProperty("display", "grid", "important");
grid.style.setProperty("grid-template-columns", "repeat(3, 1fr)", "important");  grid.style.setProperty("gap", "6px", "important");
  grid.style.setProperty("padding", "8px", "important");
  grid.style.setProperty("align-items", "start", "important");

  const cards = grid.querySelectorAll("article.product");

  cards.forEach((card) => {
    card.style.setProperty("height", "185px", "important");
    card.style.setProperty("min-height", "185px", "important");
    card.style.setProperty("max-height", "185px", "important");
    card.style.setProperty("padding", "6px", "important");
    card.style.setProperty("border-radius", "12px", "important");
    card.style.setProperty("overflow", "hidden", "important");
    card.style.setProperty("box-sizing", "border-box", "important");
    card.style.setProperty("background", "#fff", "important");

    const imgBox = card.querySelector(".img");
    if (imgBox) {
      imgBox.style.setProperty("height", "65px", "important");
      imgBox.style.setProperty("min-height", "65px", "important");
      imgBox.style.setProperty("margin-bottom", "6px", "important");
      imgBox.style.setProperty("border-radius", "10px", "important");
      imgBox.style.setProperty("overflow", "hidden", "important");
    }

    const img = card.querySelector(".img img");
    if (img) {
      img.style.setProperty("width", "100%", "important");
      img.style.setProperty("height", "100%", "important");
      img.style.setProperty("object-fit", "cover", "important");
    }

    const tag = card.querySelector(".tag");
    if (tag) {
      tag.style.setProperty("display", "none", "important");
    }

    const title = card.querySelector("h3");
    if (title) {
      title.style.setProperty("font-size", "9px", "important");
      title.style.setProperty("height", "24px", "important");
      title.style.setProperty("line-height", "1.25", "important");
      title.style.setProperty("margin", "4px 0", "important");
      title.style.setProperty("overflow", "hidden", "important");
      title.style.setProperty("text-align", "center", "important");
    }

    const seller = card.querySelector(".seller");
    if (seller) {
      seller.style.setProperty("display", "none", "important");
    }

    const desc = card.querySelector(".desc");
    if (desc) {
      desc.style.setProperty("display", "none", "important");
    }

    const price = card.querySelector(".price");
    if (price) {
      price.style.setProperty("font-size", "11px", "important");
      price.style.setProperty("font-weight", "800", "important");
      price.style.setProperty("line-height", "1.1", "important");
      price.style.setProperty("margin", "5px 0", "important");
      price.style.setProperty("text-align", "center", "important");
    }

    const body = card.querySelector(".body");
    if (body) {
      body.style.setProperty("display", "block", "important");
      body.style.setProperty("text-align", "center", "important");
    }

    const actions = card.querySelector(".product-actions");
    if (actions) {
      actions.style.setProperty("display", "grid", "important");
      actions.style.setProperty("grid-template-columns", "repeat(2, 1fr)", "important");
      actions.style.setProperty("gap", "3px", "important");
      actions.style.setProperty("width", "100%", "important");
      actions.style.setProperty("margin-top", "4px", "important");
    }

    const buttons = card.querySelectorAll("button, .btn");

    if (buttons[0]) buttons[0].textContent = "طلب";
    if (buttons[1]) buttons[1].textContent = "تواصل";

    buttons.forEach((btn) => {
      btn.style.setProperty("width", "100%", "important");
      btn.style.setProperty("height", "22px", "important");
      btn.style.setProperty("min-height", "22px", "important");
      btn.style.setProperty("font-size", "7px", "important");
      btn.style.setProperty("font-weight", "700", "important");
      btn.style.setProperty("padding", "1px", "important");
      btn.style.setProperty("margin", "0", "important");
      btn.style.setProperty("border-radius", "999px", "important");
      btn.style.setProperty("line-height", "1", "important");
    });
  });
}

window.addEventListener("DOMContentLoaded", () => {
  finalProductCardSizeLikeExample();
 // setTimeout(finalProductCardSizeLikeExample, 500);
//  setTimeout(finalProductCardSizeLikeExample, 1500);
 // setTimeout(finalProductCardSizeLikeExample, 3000);
});

// setInterval(finalProductCardSizeLikeExample, 1000);
/* === تقليل المسافة بين اسم المنتج والسعر === */
function removeSpaceBetweenTitleAndPrice() {
  const cards = document.querySelectorAll("#productsGrid article.product");

  cards.forEach((card) => {
    const body = card.querySelector(".body");
    const title = card.querySelector("h3");
    const seller = card.querySelector(".seller");
    const desc = card.querySelector(".desc");
    const price = card.querySelector(".price");
    const actions = card.querySelector(".product-actions");

    if (body) {
      body.style.setProperty("display", "flex", "important");
      body.style.setProperty("flex-direction", "column", "important");
      body.style.setProperty("align-items", "center", "important");
      body.style.setProperty("justify-content", "flex-start", "important");
      body.style.setProperty("gap", "3px", "important");
      body.style.setProperty("height", "auto", "important");
      body.style.setProperty("padding", "0", "important");
      body.style.setProperty("margin", "0", "important");
    }

    if (title) {
      title.style.setProperty("margin", "4px 0 2px", "important");
      title.style.setProperty("height", "24px", "important");
      title.style.setProperty("line-height", "1.2", "important");
      title.style.setProperty("font-size", "9px", "important");
      title.style.setProperty("overflow", "hidden", "important");
    }

    /* نخفي البائع والوصف حتى لا يتركوا فراغ */
    if (seller) {
      seller.style.setProperty("display", "none", "important");
      seller.style.setProperty("height", "0", "important");
      seller.style.setProperty("margin", "0", "important");
      seller.style.setProperty("padding", "0", "important");
    }

    if (desc) {
      desc.style.setProperty("display", "none", "important");
      desc.style.setProperty("height", "0", "important");
      desc.style.setProperty("margin", "0", "important");
      desc.style.setProperty("padding", "0", "important");
    }

    if (price) {
      price.style.setProperty("margin", "2px 0 4px", "important");
      price.style.setProperty("font-size", "11px", "important");
      price.style.setProperty("line-height", "1.1", "important");
    }

    if (actions) {
      actions.style.setProperty("margin-top", "2px", "important");
      actions.style.setProperty("display", "grid", "important");
      actions.style.setProperty("grid-template-columns", "repeat(2, 1fr)", "important");
      actions.style.setProperty("gap", "3px", "important");
      actions.style.setProperty("width", "100%", "important");
    }
  });
}

window.addEventListener("DOMContentLoaded", () => {
  removeSpaceBetweenTitleAndPrice();
//  setTimeout(removeSpaceBetweenTitleAndPrice, 500);
});
/* === تصغير نهائي للبطاقات وإزالة الفراغ === */
function compactProductCardsFinal() {
  const grid = document.getElementById("productsGrid");
  if (!grid) return;

  grid.style.setProperty("display", "grid", "important");
grid.style.setProperty("grid-template-columns", "repeat(3, 1fr)", "important");  grid.style.setProperty("gap", "6px", "important");
  grid.style.setProperty("padding", "8px", "important");

  const cards = grid.querySelectorAll("article.product");

  cards.forEach((card) => {
    card.style.setProperty("height", "150px", "important");
    card.style.setProperty("min-height", "150px", "important");
    card.style.setProperty("max-height", "150px", "important");
    card.style.setProperty("padding", "5px", "important");
    card.style.setProperty("border-radius", "12px", "important");
    card.style.setProperty("overflow", "hidden", "important");
    card.style.setProperty("position", "relative", "important");
    card.style.setProperty("box-sizing", "border-box", "important");

    const imgBox = card.querySelector(".img");
    if (imgBox) {
      imgBox.style.setProperty("height", "45px", "important");
      imgBox.style.setProperty("min-height", "45px", "important");
      imgBox.style.setProperty("margin", "0 0 4px 0", "important");
      imgBox.style.setProperty("border-radius", "8px", "important");
      imgBox.style.setProperty("overflow", "hidden", "important");
    }

    const img = card.querySelector(".img img");
    if (img) {
      img.style.setProperty("width", "100%", "important");
      img.style.setProperty("height", "100%", "important");
      img.style.setProperty("object-fit", "cover", "important");
    }

    const tag = card.querySelector(".tag");
    if (tag) {
      tag.style.setProperty("display", "none", "important");
    }

    const body = card.querySelector(".body");
    if (body) {
      body.style.setProperty("display", "block", "important");
      body.style.setProperty("padding", "0", "important");
      body.style.setProperty("margin", "0", "important");
      body.style.setProperty("height", "auto", "important");
      body.style.setProperty("text-align", "center", "important");
    }

    const title = card.querySelector("h3");
    if (title) {
      title.style.setProperty("font-size", "9px", "important");
      title.style.setProperty("height", "22px", "important");
      title.style.setProperty("line-height", "1.2", "important");
      title.style.setProperty("margin", "2px 0", "important");
      title.style.setProperty("overflow", "hidden", "important");
    }

    const seller = card.querySelector(".seller");
    if (seller) seller.style.setProperty("display", "none", "important");

    const desc = card.querySelector(".desc");
    if (desc) desc.style.setProperty("display", "none", "important");

    const price = card.querySelector(".price");
    if (price) {
      price.style.setProperty("font-size", "11px", "important");
      price.style.setProperty("font-weight", "800", "important");
      price.style.setProperty("line-height", "1.1", "important");
      price.style.setProperty("margin", "2px 0", "important");
      price.style.setProperty("position", "absolute", "important");
      price.style.setProperty("left", "0", "important");
      price.style.setProperty("right", "0", "important");
      price.style.setProperty("bottom", "31px", "important");
      price.style.setProperty("text-align", "center", "important");
    }

    const actions = card.querySelector(".product-actions");
    if (actions) {
      actions.style.setProperty("display", "grid", "important");
      actions.style.setProperty("grid-template-columns", "repeat(2, 1fr)", "important");
      actions.style.setProperty("gap", "3px", "important");
      actions.style.setProperty("position", "absolute", "important");
      actions.style.setProperty("left", "5px", "important");
      actions.style.setProperty("right", "5px", "important");
      actions.style.setProperty("bottom", "5px", "important");
      actions.style.setProperty("width", "auto", "important");
      actions.style.setProperty("margin", "0", "important");
    }

    const buttons = card.querySelectorAll("button, .btn");
    if (buttons[0]) buttons[0].textContent = "طلب";
    if (buttons[1]) buttons[1].textContent = "تواصل";

    buttons.forEach((btn) => {
      btn.style.setProperty("height", "21px", "important");
      btn.style.setProperty("min-height", "21px", "important");
      btn.style.setProperty("font-size", "6px", "important");
      btn.style.setProperty("padding", "1px", "important");
      btn.style.setProperty("margin", "0", "important");
      btn.style.setProperty("border-radius", "999px", "important");
      btn.style.setProperty("line-height", "1", "important");
      btn.style.setProperty("width", "100%", "important");
    });
  });
}

window.addEventListener("DOMContentLoaded", () => {
  compactProductCardsFinal();
//  setTimeout(compactProductCardsFinal, 800);
});
/* === 3 منتجات في كل سطر بشكل جميل وواضح === */
function makeProductsThreePerRowClear() {
  const grid = document.getElementById("productsGrid");
  if (!grid) return;

  /* الشبكة: 3 منتجات في كل سطر */
  grid.style.setProperty("display", "grid", "important");
  grid.style.setProperty("grid-template-columns", "repeat(3, 1fr)", "important");
  grid.style.setProperty("gap", "10px", "important");
  grid.style.setProperty("padding", "10px", "important");
  grid.style.setProperty("align-items", "start", "important");

  const cards = grid.querySelectorAll("article.product");

  cards.forEach((card) => {
    card.style.setProperty("height", "250px", "important");
    card.style.setProperty("min-height", "250px", "important");
    card.style.setProperty("max-height", "250px", "important");
    card.style.setProperty("padding", "8px", "important");
    card.style.setProperty("border-radius", "14px", "important");
    card.style.setProperty("overflow", "hidden", "important");
    card.style.setProperty("background", "#ffffff", "important");
    card.style.setProperty("border", "1px solid #e5e7eb", "important");
    card.style.setProperty("box-shadow", "0 2px 8px rgba(0,0,0,0.06)", "important");
    card.style.setProperty("position", "relative", "important");
    card.style.setProperty("box-sizing", "border-box", "important");

    const imgBox = card.querySelector(".img");
    if (imgBox) {
      imgBox.style.setProperty("height", "85px", "important");
      imgBox.style.setProperty("min-height", "85px", "important");
      imgBox.style.setProperty("margin", "0 0 8px 0", "important");
      imgBox.style.setProperty("border-radius", "10px", "important");
      imgBox.style.setProperty("overflow", "hidden", "important");
      imgBox.style.setProperty("background", "#f3f6fb", "important");
    }

    const img = card.querySelector(".img img");
    if (img) {
      img.style.setProperty("width", "100%", "important");
      img.style.setProperty("height", "100%", "important");
      img.style.setProperty("object-fit", "cover", "important");
      img.style.setProperty("display", "block", "important");
    }

    /* إخفاء الشارة الصغيرة فوق الصورة */
    const tag = card.querySelector(".tag");
    if (tag) {
      tag.style.setProperty("display", "none", "important");
    }

    const body = card.querySelector(".body");
    if (body) {
      body.style.setProperty("display", "flex", "important");
      body.style.setProperty("flex-direction", "column", "important");
      body.style.setProperty("align-items", "center", "important");
      body.style.setProperty("justify-content", "flex-start", "important");
      body.style.setProperty("text-align", "center", "important");
      body.style.setProperty("gap", "4px", "important");
      body.style.setProperty("padding", "0", "important");
      body.style.setProperty("margin", "0", "important");
    }

    const title = card.querySelector("h3");
    if (title) {
      title.style.setProperty("font-size", "13px", "important");
      title.style.setProperty("font-weight", "800", "important");
      title.style.setProperty("line-height", "1.3", "important");
      title.style.setProperty("height", "36px", "important");
      title.style.setProperty("margin", "2px 0", "important");
      title.style.setProperty("overflow", "hidden", "important");
      title.style.setProperty("color", "#0f172a", "important");
    }

    /* إخفاء البائع والوصف حتى تبقى البطاقة نظيفة */
    const seller = card.querySelector(".seller");
    if (seller) seller.style.setProperty("display", "none", "important");

    const desc = card.querySelector(".desc");
    if (desc) desc.style.setProperty("display", "none", "important");

    const price = card.querySelector(".price");
    if (price) {
      price.style.setProperty("font-size", "16px", "important");
      price.style.setProperty("font-weight", "900", "important");
      price.style.setProperty("line-height", "1.2", "important");
      price.style.setProperty("margin", "4px 0 6px", "important");
      price.style.setProperty("color", "#0f172a", "important");
      price.style.setProperty("text-align", "center", "important");
    }

    const actions = card.querySelector(".product-actions");
    if (actions) {
      actions.style.setProperty("display", "grid", "important");
      actions.style.setProperty("grid-template-columns", "repeat(2, 1fr)", "important");
      actions.style.setProperty("gap", "6px", "important");
      actions.style.setProperty("width", "100%", "important");
      actions.style.setProperty("margin-top", "4px", "important");
    }

    const buttons = card.querySelectorAll("button, .btn");
    if (buttons[0]) buttons[0].textContent = "طلب المنتج";
    if (buttons[1]) buttons[1].textContent = "تواصل";

    buttons.forEach((btn) => {
      btn.style.setProperty("height", "30px", "important");
      btn.style.setProperty("min-height", "30px", "important");
      btn.style.setProperty("font-size", "10px", "important");
      btn.style.setProperty("font-weight", "800", "important");
      btn.style.setProperty("padding", "4px 6px", "important");
      btn.style.setProperty("margin", "0", "important");
      btn.style.setProperty("border-radius", "999px", "important");
      btn.style.setProperty("line-height", "1", "important");
      btn.style.setProperty("width", "100%", "important");
    });
  });
}

window.addEventListener("DOMContentLoaded", () => {
  makeProductsThreePerRowClear();
 // setTimeout(makeProductsThreePerRowClear, 500);
});
/* === 3 منتجات في السطر + صورة واضحة وكبيرة === */
function makeThreeProductsBeautiful() {
  const grid = document.getElementById("productsGrid");
  if (!grid) return;

  grid.style.setProperty("display", "grid", "important");
  grid.style.setProperty("grid-template-columns", "repeat(3, 1fr)", "important");
  grid.style.setProperty("gap", "10px", "important");
  grid.style.setProperty("padding", "10px", "important");
  grid.style.setProperty("align-items", "start", "important");

  const cards = grid.querySelectorAll("article.product");

  cards.forEach((card) => {
    card.style.setProperty("height", "265px", "important");
    card.style.setProperty("min-height", "265px", "important");
    card.style.setProperty("max-height", "265px", "important");
    card.style.setProperty("padding", "8px", "important");
    card.style.setProperty("border-radius", "16px", "important");
    card.style.setProperty("overflow", "hidden", "important");
    card.style.setProperty("background", "#fff", "important");
    card.style.setProperty("border", "1px solid #e5e7eb", "important");
    card.style.setProperty("box-shadow", "0 3px 10px rgba(0,0,0,0.06)", "important");
    card.style.setProperty("box-sizing", "border-box", "important");
    card.style.setProperty("position", "relative", "important");

    const imgBox = card.querySelector(".img");
    if (imgBox) {
      imgBox.style.setProperty("height", "115px", "important");
      imgBox.style.setProperty("min-height", "115px", "important");
      imgBox.style.setProperty("margin", "0 0 8px 0", "important");
      imgBox.style.setProperty("border-radius", "12px", "important");
      imgBox.style.setProperty("overflow", "hidden", "important");
      imgBox.style.setProperty("background", "#f3f6fb", "important");
    }

    const img = card.querySelector(".img img");
    if (img) {
      img.style.setProperty("width", "100%", "important");
      img.style.setProperty("height", "100%", "important");
      img.style.setProperty("object-fit", "contain", "important");
      img.style.setProperty("display", "block", "important");
    }

    const tag = card.querySelector(".tag");
    if (tag) {
      tag.style.setProperty("display", "none", "important");
    }

    const body = card.querySelector(".body");
    if (body) {
      body.style.setProperty("display", "flex", "important");
      body.style.setProperty("flex-direction", "column", "important");
      body.style.setProperty("align-items", "center", "important");
      body.style.setProperty("gap", "4px", "important");
      body.style.setProperty("padding", "0", "important");
      body.style.setProperty("margin", "0", "important");
      body.style.setProperty("text-align", "center", "important");
    }

    const title = card.querySelector("h3");
    if (title) {
      title.style.setProperty("font-size", "13px", "important");
      title.style.setProperty("font-weight", "800", "important");
      title.style.setProperty("line-height", "1.3", "important");
      title.style.setProperty("height", "36px", "important");
      title.style.setProperty("margin", "2px 0", "important");
      title.style.setProperty("overflow", "hidden", "important");
      title.style.setProperty("color", "#0f172a", "important");
    }

    const seller = card.querySelector(".seller");
    if (seller) seller.style.setProperty("display", "none", "important");

    const desc = card.querySelector(".desc");
    if (desc) desc.style.setProperty("display", "none", "important");

    const price = card.querySelector(".price");
    if (price) {
      price.style.setProperty("font-size", "16px", "important");
      price.style.setProperty("font-weight", "900", "important");
      price.style.setProperty("line-height", "1.2", "important");
      price.style.setProperty("margin", "4px 0 6px", "important");
      price.style.setProperty("color", "#0f172a", "important");
      price.style.setProperty("text-align", "center", "important");
    }

    const actions = card.querySelector(".product-actions");
    if (actions) {
      actions.style.setProperty("display", "grid", "important");
      actions.style.setProperty("grid-template-columns", "repeat(2, 1fr)", "important");
      actions.style.setProperty("gap", "5px", "important");
      actions.style.setProperty("width", "100%", "important");
      actions.style.setProperty("margin-top", "4px", "important");
    }

    const buttons = card.querySelectorAll("button, .btn");
    if (buttons[0]) buttons[0].textContent = "طلب";
    if (buttons[1]) buttons[1].textContent = "تواصل";

    buttons.forEach((btn) => {
      btn.style.setProperty("height", "28px", "important");
      btn.style.setProperty("min-height", "28px", "important");
      btn.style.setProperty("font-size", "9px", "important");
      btn.style.setProperty("font-weight", "800", "important");
      btn.style.setProperty("padding", "3px", "important");
      btn.style.setProperty("margin", "0", "important");
      btn.style.setProperty("border-radius", "999px", "important");
      btn.style.setProperty("line-height", "1", "important");
      btn.style.setProperty("width", "100%", "important");
    });
  });
}

window.addEventListener("DOMContentLoaded", () => {
  makeThreeProductsBeautiful();
  setTimeout(makeThreeProductsBeautiful, 600);
});
/* === إرجاع المنتجات الأكثر مبيعاً فوق الأقسام المميزة بدون حركة === */
function moveProductsSectionAboveCategoriesFinal() {
  const productsSection = document.getElementById("products-section");
  const categoriesTitle = Array.from(document.querySelectorAll("h1, h2, h3"))
    .find(el => el.textContent.includes("الأقسام المميزة"));

  if (!productsSection || !categoriesTitle) return;

  const categoriesSection =
    categoriesTitle.closest("section") ||
    categoriesTitle.parentElement;

  if (!categoriesSection || !categoriesSection.parentNode) return;

  categoriesSection.parentNode.insertBefore(productsSection, categoriesSection);
}

window.addEventListener("DOMContentLoaded", () => {
  moveProductsSectionAboveCategoriesFinal();
});
/* === إظهار قسم المنتجات وإرجاعه فوق الأقسام === */
function showProductsSectionFinal() {
  const grid = document.getElementById("productsGrid");
  if (!grid) return;

  const productsSection =
    document.getElementById("products-section") ||
    grid.closest("section") ||
    grid.parentElement;

  if (!productsSection) return;

  /* إظهار القسم */
  productsSection.style.setProperty("display", "block", "important");
  productsSection.style.setProperty("visibility", "visible", "important");
  productsSection.style.setProperty("opacity", "1", "important");
  productsSection.style.setProperty("height", "auto", "important");
  productsSection.style.setProperty("overflow", "visible", "important");

  grid.style.setProperty("display", "grid", "important");
  grid.style.setProperty("visibility", "visible", "important");
  grid.style.setProperty("opacity", "1", "important");

  /* نقل المنتجات فوق الأقسام المميزة */
  const categoriesTitle = Array.from(document.querySelectorAll("h1, h2, h3"))
    .find(el => el.textContent.includes("الأقسام المميزة"));

  if (categoriesTitle) {
    const categoriesSection =
      categoriesTitle.closest("section") ||
      categoriesTitle.parentElement;

    if (
      categoriesSection &&
      categoriesSection.parentNode &&
      productsSection !== categoriesSection
    ) {
      categoriesSection.parentNode.insertBefore(productsSection, categoriesSection);
    }
  }

  /* إعادة تحميل المنتجات إذا كانت الشبكة فارغة */
  if (grid.children.length === 0 && typeof loadProducts === "function") {
    loadProducts();
  }
}

window.addEventListener("DOMContentLoaded", () => {
  showProductsSectionFinal();
});

window.addEventListener("load", () => {
  showProductsSectionFinal();
});
