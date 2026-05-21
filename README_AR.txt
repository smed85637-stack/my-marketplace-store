متجر إلكتروني متعدد البائعين - Netlify + API + Supabase

ما الموجود في المشروع؟
1) واجهة الزبون:
   /index.html
   يعرض المنتجات، والزبون يطلب المنتج ويتواصل مع البائع عبر واتساب.

2) لوحة البائع:
   /seller.html
   البائع يسجل متجره، يضيف منتجات، يضع السعر ورقم الهاتف، ويرى الطلبات.

3) لوحة المدير:
   /admin.html
   أنت تتحكم في المتجر، ترى البائعين والمنتجات والطلبات والعمولة 2%.

4) API:
   /.netlify/functions/sellers
   /.netlify/functions/products
   /.netlify/functions/orders
   /.netlify/functions/admin

طريقة التشغيل على Netlify:
1) أنشئ مشروع Supabase.
2) افتح Supabase SQL Editor ونفذ ملف database.sql.
3) ارفع هذا المشروع إلى Netlify.
4) في Netlify أضف Environment Variables:
   SUPABASE_URL
   SUPABASE_SERVICE_ROLE_KEY
   ADMIN_TOKEN

مثال:
ADMIN_TOKEN=ضع_كلمة_سر_قوية_للمدير

5) افتح:
   https://your-site.netlify.app
   https://your-site.netlify.app/seller.html
   https://your-site.netlify.app/admin.html

كيف تعمل عمولة 2%؟
- عند إنشاء الطلب، API يحسب:
  commission_amount = total_amount * 0.02
- المدير يرى العمولة من لوحة التحكم.
- البائع يضع الطلب "مكتمل" بعد البيع.

ملاحظة مهمة:
إذا كان الزبون يتواصل مع البائع عبر واتساب فقط، لا يمكن إجبار البائع تقنيًا على دفع 2% بشكل مضمون.
لإجبار العمولة فعليًا يجب أن تمر عملية الدفع داخل المنصة عبر Payment API مثل Stripe / PayPal / بوابة دفع محلية / تحويل بنكي مؤكد.
بعد اختيار بوابة الدفع، يتم ربط الدفع داخل API ثم خصم 2% تلقائيًا.
