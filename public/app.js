/* 
  ضع هنا بيانات Supabase فقط إذا تريد جلب المنتجات من قاعدة البيانات.
  مهم: لا تضع secret key هنا. ضع anon public key فقط.
*/

const SUPABASE_URL = "";
const SUPABASE_ANON_KEY = "";

let db = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase) {
  db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

const categoryNames = {
  all: "الكل",
  electronics: "إلكترونيات",
  clothes: "ملابس",
  home: "منزل",
  food: "طعام",
  cars: "سيارات",
  other: "أخرى"
};

const demoProducts = [
  {
    id: "demo-1",
    name: "سماعة رأس بلوتوث",
    description: "صوت قوي وبطارية ممتازة",
    price: 990,
    category: "electronics",
    image_url: ""
  },
  {
    id: "demo-2",
    name: "هاتف ذكي 128GB",
    description: "شاشة واضحة وأداء سريع",
    price: 8500,
    category: "electronics",
    image_url: ""
  },
  {
    id: "demo-3",
    name: "قميص رجالي",
    description: "قطن مريح للاستعمال اليومي",
    price: 350,
    category: "clothes",
    image_url: ""
  },
  {
    id: "demo-4",
    name: "ساعة يد أنيقة",
    description: "تصميم جميل ومناسب للهدايا",
    price: 650,
    category: "clothes",
    image_url: ""
  },
  {
    id: "demo-5",
    name: "مصباح منزلي",
    description: "إضاءة جميلة للغرفة",
    price: 280,
    category: "home",
    image_url: ""
  },
  {
    id: "demo-6",
    name: "إكسسوارات سيارة",
    description: "منتج عملي للسيارة",
    price: 420,
    category: "cars",
    image_url: ""
  }
];

let products = [];
let currentCategory = "all";
let searchText = "";
let cart = JSON.parse(localStorage.getItem("market_cart") || "[]");

const productsGrid = document.getElementById("productsGrid");
const loadingBox = document.getElementById("loadingBox");
const emptyBox = document.getElementById("emptyBox");
const searchInput = document.getElementById("searchInput");
const cartCount = document.getElementById("cartCount");
const cartDrawer = document.getElementById("cartDrawer");
const overlay = document.getElementById("overlay");
const cartItems = document.getElementById("cartItems");
const cartTotal = document.getElementById("cartTotal");

function money(value) {
  const number = Number(value || 0);
  return `${number.toLocaleString("ar-MR")} MRU`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fallbackImage(text) {
  const label = escapeHtml(text || "منتج");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="700" height="500">
      <rect width="100%" height="100%" rx="30" fill="#eef2f7"/>
      <circle cx="350" cy="190" r="80" fill="#06172b"/>
      <text x="350" y="210" text-anchor="middle" font-size="52" fill="#d6b46b">🛍️</text>
      <text x="350" y="330" text-anchor="middle" font-size="34" font-family="Arial" fill="#06172b">${label}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function normalizeProduct(p) {
  return {
    id: p.id || crypto.randomUUID(),
    name: p.name || p.title || p.product_name || "منتج بدون اسم",
    description: p.description || p.desc || "",
    price: Number(p.price || 0),
    category: p.category || "other",
    image_url: p.image_url || p.image || p.photo || "",
    active: p.active !== false
  };
}

async function loadProducts() {
  loadingBox.classList.remove("hidden");
  emptyBox.classList.add("hidden");

  try {
    if (!db) {
      products = demoProducts;
    } else {
      const { data, error } = await db
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      products = data && data.length ? data.map(normalizeProduct) : demoProducts;
    }
  } catch (error) {
    console.error("خطأ في تحميل المنتجات:", error);
    products = demoProducts;
  }

  loadingBox.classList.add("hidden");
  renderProducts();
  renderCart();
}

function filteredProducts() {
  return products.filter((product) => {
    if (product.active === false) return false;

    const matchCategory =
      currentCategory === "all" || product.category === currentCategory;

    const text = `${product.name} ${product.description} ${categoryNames[product.category] || ""}`.toLowerCase();
    const matchSearch = text.includes(searchText.toLowerCase());

    return matchCategory && matchSearch;
  });
}

function renderProducts() {
  const list = filteredProducts();

  if (!list.length) {
    productsGrid.innerHTML = "";
    emptyBox.classList.remove("hidden");
    return;
  }

  emptyBox.classList.add("hidden");

  productsGrid.innerHTML = list
    .map((product) => {
      const image = product.image_url || fallbackImage(product.name);
      const categoryLabel = categoryNames[product.category] || "أخرى";

      return `
        <article class="product-card">
          <button class="favorite-btn" type="button" title="إضافة للمفضلة">♡</button>
          <img class="product-image" src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}"
               onerror="this.src='${fallbackImage("منتج")}'" />

          <div class="product-content">
            <div class="product-category">${escapeHtml(categoryLabel)}</div>
            <h3 class="product-title">${escapeHtml(product.name)}</h3>
            <p class="product-desc">${escapeHtml(product.description)}</p>

            <div class="product-bottom">
              <div class="product-price">${money(product.price)}</div>
              <button class="add-cart-btn" type="button" data-add="${escapeHtml(product.id)}">
                أضف للسلة 🛒
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function setCategory(category) {
  currentCategory = category;

  document.querySelectorAll("[data-category]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.category === category);
  });

  renderProducts();

  document.getElementById("latestProducts").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function saveCart() {
  localStorage.setItem("market_cart", JSON.stringify(cart));
  renderCart();
}

function addToCart(productId) {
  const product = products.find((item) => String(item.id) === String(productId));
  if (!product) return;

  const existing = cart.find((item) => String(item.id) === String(productId));

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image_url: product.image_url,
      qty: 1
    });
  }

  saveCart();
  openCart();
}

function changeQty(productId, amount) {
  const item = cart.find((x) => String(x.id) === String(productId));
  if (!item) return;

  item.qty += amount;

  if (item.qty <= 0) {
    cart = cart.filter((x) => String(x.id) !== String(productId));
  }

  saveCart();
}

function cartSum() {
  return cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 1), 0);
}

function renderCart() {
  cartCount.textContent = cart.reduce((sum, item) => sum + Number(item.qty || 1), 0);
  cartTotal.textContent = money(cartSum());

  if (!cart.length) {
    cartItems.innerHTML = `<div class="empty-box">السلة فارغة الآن</div>`;
    return;
  }

  cartItems.innerHTML = cart
    .map((item) => {
      const image = item.image_url || fallbackImage(item.name);

      return `
        <div class="cart-item">
          <img src="${escapeHtml(image)}" alt="${escapeHtml(item.name)}" />
          <div>
            <h4>${escapeHtml(item.name)}</h4>
            <p>${money(item.price)}</p>
          </div>
          <div class="qty-actions">
            <button type="button" data-qty-plus="${escapeHtml(item.id)}">+</button>
            <strong>${item.qty}</strong>
            <button type="button" data-qty-minus="${escapeHtml(item.id)}">-</button>
          </div>
        </div>
      `;
    })
    .join("");
}

function openCart() {
  cartDrawer.classList.remove("hidden");
  overlay.classList.remove("hidden");
}

function closeCart() {
  cartDrawer.classList.add("hidden");
  overlay.classList.add("hidden");
}

async function submitOrder(event) {
  event.preventDefault();

  if (!cart.length) {
    alert("السلة فارغة");
    return;
  }

  const customerName = document.getElementById("customerName").value.trim();
  const customerPhone = document.getElementById("customerPhone").value.trim();
  const customerAddress = document.getElementById("customerAddress").value.trim();

  const order = {
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_address: customerAddress,
    items: cart,
    total: cartSum(),
    status: "new",
    created_at: new Date().toISOString()
  };

  try {
    if (db) {
      const { error } = await db.from("orders").insert([order]);
      if (error) throw error;
    } else {
      const oldOrders = JSON.parse(localStorage.getItem("market_orders") || "[]");
      oldOrders.push(order);
      localStorage.setItem("market_orders", JSON.stringify(oldOrders));
    }

    alert("تم إرسال الطلب بنجاح");
    cart = [];
    saveCart();
    event.target.reset();
    closeCart();
  } catch (error) {
    console.error("خطأ في إرسال الطلب:", error);
    alert("لم يتم حفظ الطلب في قاعدة البيانات. تأكد من جدول orders في Supabase.");
  }
}

document.addEventListener("click", (event) => {
  const addBtn = event.target.closest("[data-add]");
  if (addBtn) {
    addToCart(addBtn.dataset.add);
    return;
  }

  const categoryBtn = event.target.closest("[data-category]");
  if (categoryBtn) {
    setCategory(categoryBtn.dataset.category);
    return;
  }

  const plusBtn = event.target.closest("[data-qty-plus]");
  if (plusBtn) {
    changeQty(plusBtn.dataset.qtyPlus, 1);
    return;
  }

  const minusBtn = event.target.closest("[data-qty-minus]");
  if (minusBtn) {
    changeQty(minusBtn.dataset.qtyMinus, -1);
  }
});

searchInput.addEventListener("input", (event) => {
  searchText = event.target.value.trim();
  renderProducts();
});

document.getElementById("showAllBtn").addEventListener("click", () => {
  setCategory("all");
});

document.getElementById("startShoppingBtn").addEventListener("click", () => {
  document.getElementById("latestProducts").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
});

document.getElementById("openCartBtn").addEventListener("click", openCart);
document.getElementById("closeCartBtn").addEventListener("click", closeCart);
document.getElementById("overlay").addEventListener("click", closeCart);
document.getElementById("orderForm").addEventListener("submit", submitOrder);

loadProducts();
