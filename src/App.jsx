import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, getToken, money } from './lib/api'
import './App.css'

const categories = ['shirt', 'tshirt', 'pant', 'trackpants', 'trousers']

function Icon({ name, size = 20 }) {
  const paths = {
    bag: <><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></>,
    user: <><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.5-3.3 2.8-5 7-5s6.5 1.7 7 5"/></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    search: <><circle cx="10.8" cy="10.8" r="6.5"/><path d="m16 16 4 4"/></>,
    chevron: <path d="m7 10 5 5 5-5"/>,
    plus: <path d="M12 5v14M5 12h14"/>,
    minus: <path d="M5 12h14"/>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    package: <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="M3 8v9l9 5 9-5V8M12 13v9"/></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"/></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function useRoute() {
  const [path, setPath] = useState(`${window.location.pathname}${window.location.search}`)
  useEffect(() => {
    const update = () => setPath(`${window.location.pathname}${window.location.search}`)
    window.addEventListener('popstate', update)
    return () => window.removeEventListener('popstate', update)
  }, [])
  const navigate = useCallback((to) => {
    window.history.pushState({}, '', to)
    setPath(to)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])
  return [path, navigate]
}

function App() {
  const [path, navigate] = useRoute()
  const routePath = path.split('?')[0]
  const [user, setUser] = useState(null)
  const [cartCount, setCartCount] = useState(0)
  const [toast, setToast] = useState('')
  const [authChecked, setAuthChecked] = useState(() => !getToken())
  const go = useCallback((to) => navigate(to), [navigate])

  const refreshCartCount = useCallback(async () => {
    if (!getToken()) { setCartCount(0); return }
    try {
      const { cart } = await api('/api/cart')
      setCartCount((cart.items || []).reduce((sum, item) => sum + item.quantity, 0))
    } catch { setCartCount(0) }
  }, [])

  useEffect(() => {
    let active = true
    if (!getToken()) return undefined
    api('/api/auth/profile')
      .then(({ user: current }) => { if (active) setUser(current) })
      .catch(() => { localStorage.removeItem('cheapkart_token'); if (active) setUser(null) })
      .finally(() => { if (active) setAuthChecked(true) })
    api('/api/cart').then(({ cart }) => { if (active) setCartCount((cart.items || []).reduce((sum, item) => sum + item.quantity, 0)) }).catch(() => { if (active) setCartCount(0) })
    return () => { active = false }
  }, [path, refreshCartCount])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 3000)
    return () => window.clearTimeout(timer)
  }, [toast])

  const signOut = () => {
    localStorage.removeItem('cheapkart_token')
    setUser(null); setCartCount(0); setAuthChecked(true); setToast('You’ve been signed out.')
    go('/')
  }
  const onSignedIn = (nextUser) => {
    setUser(nextUser); refreshCartCount()
    const requested = new URLSearchParams(window.location.search).get('returnTo')
    const safeReturn = requested?.startsWith('/') && !requested.startsWith('//') ? requested : ''
    go(nextUser.isAdmin ? '/admin' : safeReturn || '/')
  }

  let page
  if (!authChecked && getToken()) {
    page = <main className="page-shell"><div className="loading-state">Getting your account ready…</div></main>
  } else if (routePath === '/login' || routePath === '/signup') {
    page = <AuthPage mode={routePath.slice(1)} go={go} onSignedIn={onSignedIn} />
  } else if (user?.isAdmin) {
    page = <AdminPage />
  } else if (routePath.startsWith('/product/')) {
    page = <ProductPage id={decodeURIComponent(routePath.split('/')[2])} go={go} setToast={setToast} refreshCartCount={refreshCartCount} />
  } else if (routePath === '/cart') {
    page = <CartPage user={user} go={go} setToast={setToast} refreshCartCount={refreshCartCount} />
  } else if (routePath === '/profile') {
    page = <ProfilePage user={user} go={go} setToast={setToast} />
  } else if (routePath === '/orders') {
    page = <OrdersPage user={user} go={go} />
  } else if (routePath === '/admin') {
    page = user?.isAdmin ? <AdminPage /> : <AccessPage go={go} />
  } else {
    page = <HomePage search={path.includes('?q=') ? new URLSearchParams(path.split('?')[1]).get('q') : ''} go={go} />
  }

  return <>
    <Header user={user} cartCount={cartCount} go={go} signOut={signOut} />
    {page}
    <Footer />
    {toast && <div className="toast" role="status">{toast}</div>}
  </>
}

function Header({ user, cartCount, go, signOut }) {
  const [search, setSearch] = useState('')
  const submit = (event) => { event.preventDefault(); go(search.trim() ? `/?q=${encodeURIComponent(search.trim())}` : '/') }
  return <header className="site-header">
    <div className="header-inner">
      <button className="brand" onClick={() => go(user?.isAdmin ? '/admin' : '/')} aria-label="Cheapkart home"><span className="brand-mark">c</span><span>cheapkart<span className="brand-period">.</span></span></button>
      {!user?.isAdmin && <form className="search-box" onSubmit={submit}><Icon name="search" size={18} /><input aria-label="Search products" placeholder="Search for everyday style" value={search} onChange={(e) => setSearch(e.target.value)} /><button type="submit" className="search-submit">Search</button></form>}
      <nav className="header-nav" aria-label="Main navigation">
        {!user?.isAdmin && <button className="nav-link shop-link" onClick={() => go('/')}><span className="nav-word">Shop</span></button>}
        {user && !user.isAdmin && <button className="nav-link order-nav-link" onClick={() => go('/orders')}>Orders</button>}
        {user?.isAdmin && <button className="nav-link dashboard-nav-link" onClick={() => go('/admin')}>Dashboard</button>}
        {user && !user.isAdmin ? <button className="icon-link" aria-label="Profile" onClick={() => go('/profile')}><Icon name="user" /></button> : null}
        {!user?.isAdmin && <button className="icon-link cart-link" aria-label={`Cart, ${cartCount} items`} onClick={() => go('/cart')}><Icon name="bag" />{cartCount > 0 && <span className="cart-badge">{cartCount}</span>}</button>}
        {user ? <button className="account-link" onClick={signOut}><Icon name="logout" size={17} /><span>Sign out</span></button> : <button className="login-link" onClick={() => go('/login')}>Sign in <Icon name="arrow" size={16} /></button>}
      </nav>
    </div>
  </header>
}

function HomePage({ search, go }) {
  const [gender, setGender] = useState('women')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState('')
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    const query = new URLSearchParams({ gender })
    if (category) query.set('category', category)
    if (sort) query.set('sort', sort)
    api(`/api/products?${query}`).then(({ products: result }) => { if (active) setProducts(result || []) })
      .catch((err) => { if (active) setError(err.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [gender, category, sort])
  const visibleProducts = useMemo(() => search ? products.filter((product) => `${product.name} ${product.category} ${product.seller?.name}`.toLowerCase().includes(search.toLowerCase())) : products, [products, search])
  return <main>
    <section className="hero-wrap"><div className="hero-copy"><span className="eyebrow"><span className="eyebrow-dot" /> STYLE FOR EVERY DAY</span><h1>Good things.<br /><em>Better prices.</em></h1><p>Everyday favourites, thoughtfully picked and priced to make room for more.</p><button className="button button-dark" onClick={() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })}>Explore the collection <Icon name="arrow" size={17} /></button><div className="hero-note"><span className="hero-note-line" />A little more style, a little less spend.</div></div><div className="hero-art"><img src="https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1000&q=85" alt="Friends browsing a clothing collection" /><div className="hero-stamp"><span>good style</span><span>goes a long way</span></div><div className="hero-caption">THE EVERYDAY EDIT <span>— 01 / 25</span></div></div></section>
    <section className="catalog-section" id="catalog"><div className="section-heading"><div><span className="eyebrow">THE CHEAPKART COLLECTION</span><h2>Find your <em>everyday.</em></h2></div><span className="product-count">{loading ? '—' : `${visibleProducts.length} pieces`}</span></div>
      <div className="catalog-controls"><div className="gender-tabs"><button className={gender === 'women' ? 'active' : ''} onClick={() => setGender('women')}>Women</button><button className={gender === 'men' ? 'active' : ''} onClick={() => setGender('men')}>Men</button></div><div className="category-scroll"><button className={`filter-pill ${!category ? 'selected' : ''}`} onClick={() => setCategory('')}>All pieces</button>{categories.map((item) => <button key={item} className={`filter-pill ${category === item ? 'selected' : ''}`} onClick={() => setCategory(category === item ? '' : item)}>{item === 'tshirt' ? 'T-shirts' : item === 'trackpants' ? 'Track pants' : item[0].toUpperCase() + item.slice(1)}</button>)}</div><label className="sort-label">Sort by <select value={sort} onChange={(e) => setSort(e.target.value)}><option value="">Recommended</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option></select><Icon name="chevron" size={14} /></label></div>
      {error ? <ErrorState message={error} /> : loading ? <div className="product-grid">{Array.from({ length: 8 }, (_, i) => <div className="skeleton-card" key={i}><div /><span /><span /></div>)}</div> : visibleProducts.length ? <div className="product-grid">{visibleProducts.map((product, index) => <ProductCard key={product._id || product.productId} product={product} index={index} go={go} />)}</div> : <div className="empty-state"><span className="empty-symbol">✳</span><h3>No pieces found just yet.</h3><p>Try another category or search term.</p><button className="text-action" onClick={() => { setCategory(''); go('/') }}>See all pieces <Icon name="arrow" size={16} /></button></div>}
    </section>
    <section className="small-promise"><span>GOOD STYLE SHOULDN’T COST MORE.</span><span>That’s the Cheapkart way. <span className="promise-star">✳</span></span></section>
  </main>
}

function ProductCard({ product, index, go }) {
  const fallback = `https://images.unsplash.com/photo-${index % 2 ? '1521572163474-6864f9cf17ab' : '1598033129183-c4f50c736f10'}?auto=format&fit=crop&w=700&q=80`
  return <button className="product-card" onClick={() => go(`/product/${encodeURIComponent(product.productId || product._id)}`)}>
    <span className="product-image-wrap"><img src={product.image || fallback} alt={product.name} loading="lazy" onError={(e) => { e.currentTarget.src = fallback }} /><span className="image-index">{String(index + 1).padStart(2, '0')}</span><span className="quick-view">View piece <Icon name="arrow" size={15} /></span></span>
    <span className="product-meta"><span className="product-category">{product.category}</span><span className="product-price">{money(product.price)}</span></span>
    <span className="product-name">{product.name}</span><span className="product-seller">By {product.seller?.name || 'Cheapkart seller'}</span>
  </button>
}

function ProductPage({ id, go, setToast, refreshCartCount }) {
  const [product, setProduct] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [subscribing, setSubscribing] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  useEffect(() => { let active = true; api(`/api/products/${encodeURIComponent(id)}`).then(({ product: item }) => { if (active) setProduct(item) }).catch((err) => { if (active) setError(err.message) }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [id])
  const add = async () => {
    if (!getToken()) { go(`/login?returnTo=${encodeURIComponent(`/product/${id}`)}`); return }
    setAdding(true)
    try { await api('/api/cart', { method: 'POST', body: JSON.stringify({ productId: product.productId || product._id, quantity }) }); await refreshCartCount(); setToast('Added to your bag.'); }
    catch (err) { setToast(err.message) } finally { setAdding(false) }
  }
  const notifyMe = async () => {
    if (!getToken()) { go(`/login?returnTo=${encodeURIComponent(`/product/${id}`)}`); return }
    setSubscribing(true)
    try {
      const result = await api(`/api/products/${encodeURIComponent(id)}/notify`, { method: 'POST', body: JSON.stringify({}) })
      setSubscribed(true)
      setToast(result.message)
    } catch (err) { setToast(err.message) } finally { setSubscribing(false) }
  }
  if (loading) return <main className="page-shell"><div className="loading-state">Finding this piece…</div></main>
  if (error || !product) return <main className="page-shell"><ErrorState message={error || 'Product not found'} /><button className="text-action" onClick={() => go('/')}>Back to the collection <Icon name="arrow" size={16} /></button></main>
  return <main className="page-shell detail-page"><button className="back-link" onClick={() => go('/')}><span>←</span> Back to collection</button><div className="detail-layout"><div className="detail-image"><img src={product.image || 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=1100&q=85'} alt={product.name} /></div><div className="detail-info"><span className="eyebrow">{product.gender} · {product.category}</span><h1>{product.name}</h1><div className="detail-price">{money(product.price)}</div><p className="detail-description">{product.description || 'A comfortable everyday essential, chosen for the way it feels as much as the way it looks.'}</p><div className="detail-rule"/><div className="detail-facts"><div><span>SELLER</span><strong>{product.seller?.name || 'Cheapkart seller'}</strong></div><div><span>AVAILABILITY</span><strong className={product.stock > 0 ? 'in-stock' : 'out-stock'}>{product.stock > 0 ? `${product.stock} in stock` : 'Sold out'}</strong></div></div>{product.stock > 0 ? <div className="buy-row"><div className="quantity-stepper"><button aria-label="Decrease quantity" disabled={quantity <= 1} onClick={() => setQuantity((n) => n - 1)}><Icon name="minus" size={15} /></button><span>{quantity}</span><button aria-label="Increase quantity" disabled={quantity >= product.stock} onClick={() => setQuantity((n) => n + 1)}><Icon name="plus" size={15} /></button></div><button className="button button-dark add-button" disabled={adding} onClick={add}>{adding ? 'Adding…' : 'Add to bag'} <Icon name="arrow" size={17} /></button></div> : <button className="button button-dark notify-button" disabled={subscribing || subscribed} onClick={notifyMe}>{subscribed ? 'You’re on the restock list' : subscribing ? 'Adding you to the list…' : 'Notify me when available'} {!subscribed && <Icon name="arrow" size={17} />}</button>}<p className="delivery-note">{product.stock > 0 ? 'A good choice, delivered to your door.' : 'We’ll send you an email as soon as it’s back.'}</p><div className="detail-rule"/><div className="reviews-heading"><span>NOTES FROM CUSTOMERS</span><span>{(product.reviews || []).length} reviews</span></div>{product.reviews?.length ? <div className="reviews-list">{product.reviews.slice(0, 2).map((review, index) => <div className="review" key={`${review.user}-${index}`}><div><strong>{review.user}</strong><span>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span></div><p>{review.comment}</p></div>)}</div> : <p className="no-reviews">Be the first to leave a note about this piece.</p>}</div></div></main>
}

function AuthPage({ mode, go, onSignedIn }) {
  const isSignup = mode === 'signup'
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const adminLogin = !isSignup && form.email.trim() === 'admin'
      const result = await api(isSignup ? '/api/auth/signup' : '/api/auth/login', { method: 'POST', body: JSON.stringify(isSignup ? form : adminLogin ? { username: 'admin', password: form.password } : { email: form.email, password: form.password }) })
      localStorage.setItem('cheapkart_token', result.token)
      onSignedIn(result.user)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return <main className="auth-shell"><div className="auth-aside"><div className="auth-aside-mark">ck.</div><span className="eyebrow">A WELCOME THAT FITS</span><h1>Find a little<br />more <em>everyday.</em></h1><p>Good style, fair prices, and the things you’ll reach for again.</p><span className="auth-aside-foot">CHEAPKART — EVERYDAY, MADE BETTER</span></div><section className="auth-panel"><span className="eyebrow">{isSignup ? 'START SOMETHING GOOD' : 'WELCOME BACK'}</span><h2>{isSignup ? 'Create your account' : 'Sign in to Cheapkart'}</h2><p className="auth-sub">{isSignup ? 'Join us for the good finds.' : 'Your next favourite is just a sign in away.'}</p><form className="auth-form" onSubmit={submit}>{isSignup && <Field label="Your name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} autoComplete="name" required />}<Field label={isSignup ? 'Email address' : 'Email or admin username'} type={isSignup ? 'email' : 'text'} value={form.email} onChange={(value) => setForm({ ...form, email: value })} autoComplete="username" required /><Field label="Password" type="password" value={form.password} onChange={(value) => setForm({ ...form, password: value })} autoComplete={isSignup ? 'new-password' : 'current-password'} required minLength={isSignup ? 8 : undefined} />{error && <p className="form-error" role="alert">{error}{isSignup && error.toLowerCase().includes('already exists') && <> <button className="inline-form-link" type="button" onClick={() => go('/login')}>Sign in instead.</button></>}</p>}<button className="button button-dark auth-submit" disabled={busy}>{busy ? 'One moment…' : isSignup ? 'Create account' : 'Sign in'} <Icon name="arrow" size={17} /></button></form><p className="auth-switch">{isSignup ? 'Already have an account?' : 'New around here?'} <button onClick={() => go(isSignup ? '/login' : '/signup')}>{isSignup ? 'Sign in' : 'Create an account'}</button></p><button className="auth-back" onClick={() => go('/')}>← Back to Cheapkart</button></section></main>
}

function Field({ label, value, onChange, className = '', ...props }) {
  return <label className={`field ${className}`}><span>{label}</span><input value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...props} /></label>
}

function CartPage({ user, go, setToast, refreshCartCount }) {
  const [cart, setCart] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [placing, setPlacing] = useState(false)
  const load = useCallback(() => api('/api/cart').then(({ cart: result }) => setCart(result)), [])
  useEffect(() => { if (user) load().catch((err) => setError(err.message)).finally(() => setLoading(false)) }, [user, load])
  const lines = cart?.items || []
  const total = lines.reduce((sum, item) => sum + Number(item.productId?.price || 0) * item.quantity, 0)
  const setQuantity = async (item, quantity) => {
    try { await api('/api/cart', { method: 'POST', body: JSON.stringify({ productId: item.productId.productId || item.productId._id, quantity }) }); await load(); await refreshCartCount() }
    catch (err) { setToast(err.message) }
  }
  const checkout = async () => {
    setPlacing(true)
    try { const { order } = await api('/api/orders', { method: 'POST', body: JSON.stringify({}) }); await load(); await refreshCartCount(); setToast(`Order ${String(order._id).slice(-7)} placed — thank you!`); go('/orders') }
    catch (err) { setToast(err.message) } finally { setPlacing(false) }
  }
  if (!user) return <AccessPage go={go} message="Sign in to see your saved bag." />
  if (loading) return <main className="page-shell"><div className="loading-state">Opening your bag…</div></main>
  return <main className="page-shell"><PageTitle eyebrow="YOUR CHEAPKART BAG" title="Good finds, gathered." />{error && <ErrorState message={error} />}{lines.length ? <div className="cart-layout"><section className="cart-lines">{lines.map((item) => { const product = item.productId || {}; return <article className="cart-line" key={product._id}><button className="cart-thumb" onClick={() => go(`/product/${product.productId || product._id}`)}><img src={product.image || 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=320&q=75'} alt={product.name} /></button><div className="cart-line-copy"><span className="product-category">{product.category}</span><button className="cart-product-name" onClick={() => go(`/product/${product.productId || product._id}`)}>{product.name}</button><span className="product-seller">By {product.seller?.name || 'Cheapkart seller'}</span><div className="quantity-stepper compact"><button aria-label="Decrease quantity" onClick={() => setQuantity(item, Math.max(0, item.quantity - 1))}><Icon name="minus" size={14} /></button><span>{item.quantity}</span><button aria-label="Increase quantity" disabled={item.quantity >= product.stock} onClick={() => setQuantity(item, item.quantity + 1)}><Icon name="plus" size={14} /></button></div></div><strong className="cart-line-price">{money(product.price * item.quantity)}</strong></article> })}<button className="text-action continue-link" onClick={() => go('/')}>← Keep looking around</button></section><aside className="order-summary"><span className="eyebrow">THE DETAILS</span><h3>Your order</h3><div className="summary-row"><span>Items ({lines.reduce((n, item) => n + item.quantity, 0)})</span><span>{money(total)}</span></div><div className="summary-row"><span>Delivery</span><span className="free-label">On us</span></div><div className="summary-total"><span>Total</span><strong>{money(total)}</strong></div><p className="summary-address">Delivering to {user.address?.street ? `${user.address.street}, ${user.address.city || ''}` : 'your saved address'}{!user.address?.street && <button onClick={() => go('/profile')}>Add address</button>}</p><button className="button button-dark checkout-button" disabled={placing || !user.address?.street} onClick={checkout}>{placing ? 'Placing order…' : 'Place order'} <Icon name="arrow" size={17} /></button>{!user.address?.street && <span className="address-hint">Add your address in Profile to continue.</span>}<p className="secure-note">A little care goes into every order.</p></aside></div> : <div className="empty-state bag-empty"><span className="empty-symbol"><Icon name="bag" size={31} /></span><h3>Your bag has room for something good.</h3><p>Find a favourite in the collection and it’ll be waiting here.</p><button className="button button-dark" onClick={() => go('/')}>Explore the collection <Icon name="arrow" size={16} /></button></div>}</main>
}

function ProfilePage({ user, go, setToast }) {
  const [form, setForm] = useState(() => ({ name: user?.name || '', street: user?.address?.street || '', city: user?.address?.city || '', pincode: user?.address?.pincode || '', phone: user?.address?.phone || '' })); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  if (!user) return <AccessPage go={go} message="Sign in to manage your profile." />
  const submit = async (e) => { e.preventDefault(); setBusy(true); setError(''); try { const { user: updated } = await api('/api/auth/profile', { method: 'PUT', body: JSON.stringify({ name: form.name, address: { street: form.street, city: form.city, pincode: form.pincode, phone: form.phone } }) }); setToast('Your details are saved.'); window.dispatchEvent(new CustomEvent('cheapkart-profile-updated', { detail: updated })) } catch (err) { setError(err.message) } finally { setBusy(false) } }
  return <main className="page-shell"><PageTitle eyebrow="YOUR ACCOUNT" title="The details." /><div className="profile-layout"><aside className="profile-aside"><div className="profile-avatar">{(user.name || 'C').charAt(0).toUpperCase()}</div><h3>{user.name}</h3><p>{user.email}</p><button className="text-action" onClick={() => go('/orders')}>Your order history <Icon name="arrow" size={16} /></button></aside><form className="profile-form" onSubmit={submit}><div className="form-section-title"><div><span className="eyebrow">DELIVERY DETAILS</span><h2>Where should we send the good stuff?</h2></div></div><div className="form-grid"><Field label="Full name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required /><Field label="Phone number" type="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} required /><Field label="Street address" value={form.street} onChange={(v) => setForm({ ...form, street: v })} className="wide-field" required /><Field label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} required /><Field label="PIN code" value={form.pincode} onChange={(v) => setForm({ ...form, pincode: v })} required /></div>{error && <p className="form-error">{error}</p>}<button className="button button-dark" disabled={busy}>{busy ? 'Saving…' : 'Save details'} <Icon name="arrow" size={16} /></button></form></div></main>
}

function OrdersPage({ user, go }) {
  const [orders, setOrders] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  useEffect(() => { if (user) api('/api/orders').then(({ orders: result }) => setOrders(result || [])).catch((err) => setError(err.message)).finally(() => setLoading(false)) }, [user])
  if (!user) return <AccessPage go={go} message="Sign in to see your order history." />
  return <main className="page-shell"><PageTitle eyebrow="A RECORD OF THE GOOD FINDS" title="Your orders." /><div className="orders-list">{loading ? <div className="loading-state">Looking up your orders…</div> : error ? <ErrorState message={error} /> : orders.length ? orders.map((order) => <OrderCard key={order._id} order={order} />) : <div className="empty-state"><span className="empty-symbol"><Icon name="package" size={30} /></span><h3>Your story starts with a good find.</h3><p>Your orders will show up here after your first checkout.</p><button className="text-action" onClick={() => go('/')}>Browse the collection <Icon name="arrow" size={16} /></button></div>}</div></main>
}

function OrderCard({ order, admin = false, onStatusChange }) {
  return <article className="order-card"><div className="order-card-top"><div><span className="eyebrow">ORDER {String(order._id).slice(-8).toUpperCase()}</span><span className="order-date">{new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>{admin ? <select aria-label={`Order status for ${String(order._id).slice(-8)}`} className={`status-select status-${order.status}`} value={order.status} onChange={(event) => onStatusChange(order, event.target.value)}><option value="placed">Placed</option><option value="processing">Processing</option><option value="shipped">Shipped</option><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option></select> : <span className={`status-pill status-${order.status}`}>{order.status}</span>}</div>{admin && <div className="order-customer"><span className="eyebrow">CUSTOMER</span><strong>{order.userId?.name || 'Customer'}</strong><span>{order.userId?.email || '—'}</span></div>}<div className="order-items">{order.orderItems?.map((item, index) => <div className="order-item" key={`${item.productId}-${index}`}><span>{item.name} <small>× {item.quantity}</small></span><strong>{money(item.price * item.quantity)}</strong></div>)}</div><div className="order-card-bottom"><div className="shipping-address"><span className="eyebrow">DELIVERING TO</span><span>{[order.shippingAddress?.street, order.shippingAddress?.city, order.shippingAddress?.pincode, order.shippingAddress?.phone].filter(Boolean).join(', ') || 'Address not available'}</span></div><div className="order-total"><span>TOTAL</span><strong>{money(order.totalAmount)}</strong></div></div></article>
}

function AdminPage() {
  const [tab, setTab] = useState('inventory'); const [products, setProducts] = useState([]); const [orders, setOrders] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [stockInputs, setStockInputs] = useState({}); const [message, setMessage] = useState('')
  const [stockFilter, setStockFilter] = useState('all'); const [stockSort, setStockSort] = useState('low')
  const load = useCallback(() => Promise.all([api('/api/admin/inventory'), api('/api/admin/orders')]).then(([inventoryData, orderData]) => { setProducts(inventoryData.products || []); setOrders(orderData.orders || []); setError('') }).catch((err) => setError(err.message)).finally(() => setLoading(false)), [])
  useEffect(() => { load() }, [load])
  const refresh = () => { setLoading(true); load() }
  const visibleProducts = useMemo(() => products
    .filter((product) => stockFilter === 'all' || (stockFilter === 'out' ? product.stock === 0 : product.stock <= 2))
    .sort((a, b) => stockSort === 'low' ? a.stock - b.stock || a.name.localeCompare(b.name) : b.stock - a.stock || a.name.localeCompare(b.name)), [products, stockFilter, stockSort])
  const saveStock = async (product) => { const next = Number(stockInputs[product._id] ?? product.stock); if (!Number.isInteger(next) || next < 0) { setMessage('Stock must be a whole number of 0 or more.'); return } try { await api(`/api/admin/products/${encodeURIComponent(product.productId || product._id)}/stock`, { method: 'PATCH', body: JSON.stringify({ stock: next }) }); setProducts((all) => all.map((item) => item._id === product._id ? { ...item, stock: next } : item)); setMessage(`${product.name} stock updated.`) } catch (err) { setMessage(err.message) } }
  const updateStatus = async (order, status) => { try { const { order: updated } = await api(`/api/admin/orders/${order._id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); setOrders((all) => all.map((item) => item._id === order._id ? { ...item, status: updated.status } : item)); setMessage(`Order ${String(order._id).slice(-8)} marked ${status}.`) } catch (err) { setMessage(err.message) } }
  return <main className="page-shell admin-page">
    <PageTitle eyebrow="CHEAPKART CONTROL ROOM" title="The overview." />
    <div className="admin-metrics">
      <div><span>PRODUCTS</span><strong>{products.length}</strong></div>
      <div><span>ORDERS</span><strong>{orders.length}</strong></div>
      <div><span>LOW STOCK ≤ 2</span><strong>{products.filter((product) => product.stock <= 2).length}</strong></div>
    </div>
    <div className="admin-tabs">
      <button className={tab === 'inventory' ? 'active' : ''} onClick={() => setTab('inventory')}>Inventory <span>{products.length}</span></button>
      <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>All orders <span>{orders.length}</span></button>
      <button className="admin-refresh" onClick={refresh}>↻ <span>Refresh</span></button>
    </div>
    {message && <p className="admin-message">{message}</p>}
    {error ? <ErrorState message={error} /> : loading ? <div className="loading-state">Loading store details…</div> : tab === 'inventory' ? <>
      <div className="inventory-tools">
        <label>Show <select value={stockFilter} onChange={(event) => setStockFilter(event.target.value)}><option value="all">All inventory</option><option value="low">Low stock (0–2)</option><option value="out">Out of stock</option></select></label>
        <label>Sort by <select value={stockSort} onChange={(event) => setStockSort(event.target.value)}><option value="low">Stock: low to high</option><option value="high">Stock: high to low</option></select></label>
        <span>{visibleProducts.length} of {products.length} products</span>
      </div>
      <div className="inventory-wrap"><table className="inventory-table"><thead><tr><th>PRODUCT</th><th>CATEGORY</th><th>SELLER</th><th>STOCK</th><th>UPDATE</th></tr></thead><tbody>{visibleProducts.map((product) => <tr key={product._id}><td><div className="inventory-product"><img src={product.image || 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=160&q=70'} alt="" /><span>{product.name}<small>{product.productId || String(product._id).slice(-7)}</small></span></div></td><td className="table-category">{product.category}</td><td>{product.seller?.name || '—'}</td><td><span className={`stock-value ${product.stock <= 2 ? 'low-stock' : ''}`}>{product.stock}{product.stock === 0 && <small className="stock-alert">Out of stock</small>}</span></td><td><div className="stock-edit"><input aria-label={`Stock for ${product.name}`} type="number" min="0" value={stockInputs[product._id] ?? product.stock} onChange={(event) => setStockInputs({ ...stockInputs, [product._id]: event.target.value })} /><button onClick={() => saveStock(product)}>Save</button></div></td></tr>)}</tbody></table></div>
    </> : orders.length ? <div className="orders-list admin-orders">{orders.map((order) => <OrderCard key={order._id} order={order} admin onStatusChange={updateStatus} />)}</div> : <div className="empty-state compact-empty"><span className="empty-symbol"><Icon name="package" size={29} /></span><h3>No orders yet.</h3><p>Customer orders will appear here.</p></div>}
  </main>
}

function PageTitle({ eyebrow, title }) { return <div className="page-title"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1></div> }
function AccessPage({ go, message = 'Sign in to continue.' }) { return <main className="page-shell"><div className="empty-state access-state"><span className="empty-symbol"><Icon name="user" size={29} /></span><h3>{message}</h3><p>Your Cheapkart account keeps your cart and orders together.</p><button className="button button-dark" onClick={() => go('/login')}>Sign in <Icon name="arrow" size={16} /></button></div></main> }
function ErrorState({ message }) { return <div className="error-state"><strong>We couldn’t load that.</strong><span>{message}</span><small>Make sure the Cheapkart API is running at localhost:5000.</small></div> }
function Footer() { return <footer className="site-footer"><div className="footer-top"><button className="brand footer-brand" onClick={() => { window.history.pushState({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); window.scrollTo(0, 0) }}><span className="brand-mark">c</span><span>cheapkart<span className="brand-period">.</span></span></button><span>Good style. Fair prices. Everyday.</span><span>MADE FOR THE EVERYDAY <span className="promise-star">✳</span></span></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Cheapkart</span><span>More joy in the little things.</span></div></footer> }

export default App
