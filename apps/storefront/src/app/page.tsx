"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

const products = [
  {
    id: 1,
    name: "Casque sans fil Studio Pro",
    category: "Audio",
    price: 129.9,
    oldPrice: 179.9,
    rating: "4,9",
    reviews: 128,
    seller: "Atelier Sonore",
    image: "photo-1505740420928-5e560c06d30e",
    badge: "−28 %",
    tone: "sand",
  },
  {
    id: 2,
    name: "Montre connectée Horizon",
    category: "Tech",
    price: 89.9,
    oldPrice: 119.9,
    rating: "4,8",
    reviews: 86,
    seller: "Maison Pixel",
    image: "photo-1523275335684-37898b6baf30",
    badge: "Best-seller",
    tone: "lilac",
  },
  {
    id: 3,
    name: "Appareil photo instantané",
    category: "Photo",
    price: 74.5,
    oldPrice: null,
    rating: "4,7",
    reviews: 54,
    seller: "La Petite Fabrique",
    image: "photo-1516035069371-29a1b244cc32",
    badge: null,
    tone: "blue",
  },
  {
    id: 4,
    name: "Enceinte nomade en lin",
    category: "Audio",
    price: 59.9,
    oldPrice: 79.9,
    rating: "4,8",
    reviews: 73,
    seller: "Atelier Sonore",
    image: "photo-1608043152269-423dbba4e7e1",
    badge: "−25 %",
    tone: "peach",
  },
  {
    id: 5,
    name: "Clavier mécanique compact",
    category: "Tech",
    price: 94,
    oldPrice: null,
    rating: "4,6",
    reviews: 39,
    seller: "Maison Pixel",
    image: "photo-1587829741301-dc798b83add3",
    badge: null,
    tone: "green",
  },
  {
    id: 6,
    name: "Appareil photo argentique",
    category: "Photo",
    price: 112,
    oldPrice: 139,
    rating: "4,9",
    reviews: 61,
    seller: "La Petite Fabrique",
    image: "photo-1510127034890-ba27508e9f1c",
    badge: "−19 %",
    tone: "cream",
  },
  {
    id: 7,
    name: "Lampe de bureau sculpturale",
    category: "Maison",
    price: 68,
    oldPrice: null,
    rating: "4,8",
    reviews: 31,
    seller: "La Petite Fabrique",
    image: "photo-1507473885765-e6ed057f782c",
    badge: "Nouveau",
    tone: "yellow",
  },
];

const categories = [
  { name: "Tout voir", icon: "✳", tone: "category-peach" },
  { name: "Tech", icon: "⌘", tone: "category-lilac" },
  { name: "Audio", icon: "♫", tone: "category-blue" },
  { name: "Photo", icon: "◎", tone: "category-green" },
  { name: "Maison", icon: "⌂", tone: "category-yellow" },
];

const formatPrice = (price: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(price);

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="m16 16 4.2 4.2" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 8h14l1 13H4L5 8Z" />
      <path d="M9 9V6a3 3 0 0 1 6 0v3" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3.5 10h12m-5-5 5 5-5 5" />
    </svg>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Tout voir");
  const [cart, setCart] = useState<Record<number, number>>({});
  const [favorites, setFavorites] = useState<number[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [sort, setSort] = useState("popular");
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [newsletterMessage, setNewsletterMessage] = useState("");

  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("fr");
    const filteredProducts = products.filter((product) => {
      const matchesCategory = category === "Tout voir" || product.category === category;
      const matchesQuery =
        !normalizedQuery ||
        `${product.name} ${product.category} ${product.seller}`
          .toLocaleLowerCase("fr")
          .includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
    if (sort === "price") return filteredProducts.sort((a, b) => a.price - b.price);
    if (sort === "rating") {
      return filteredProducts.sort(
        (a, b) => Number(b.rating.replace(",", ".")) - Number(a.rating.replace(",", ".")),
      );
    }
    return filteredProducts;
  }, [category, query, sort]);

  const cartItems = products.filter((product) => cart[product.id]);
  const cartCount = Object.values(cart).reduce((total, quantity) => total + quantity, 0);
  const cartTotal = cartItems.reduce((total, product) => total + product.price * cart[product.id], 0);

  function addToCart(productId: number) {
    setCart((current) => ({ ...current, [productId]: (current[productId] ?? 0) + 1 }));
    setCartOpen(true);
  }

  function updateQuantity(productId: number, change: number) {
    setCart((current) => {
      const quantity = (current[productId] ?? 0) + change;
      if (quantity <= 0) {
        const next = { ...current };
        delete next[productId];
        return next;
      }
      return { ...current, [productId]: quantity };
    });
  }

  function toggleFavorite(productId: number) {
    setFavorites((current) =>
      current.includes(productId)
        ? current.filter((favorite) => favorite !== productId)
        : [...current, productId],
    );
  }

  return (
    <main>
      <div className="announcement">
        <span className="announcement-sparkle" aria-hidden="true">✳</span>
        Livraison offerte dès 50 € <span className="announcement-divider">·</span> Retours gratuits
        <span className="announcement-detail"> pendant 30 jours</span>
      </div>

      <header className="site-header">
        <a className="brand" href="#" aria-label="Magnitech, accueil">
          magnitech<span>.</span>
        </a>
        <form className="search-form" role="search" onSubmit={(event) => event.preventDefault()}>
          <SearchIcon />
          <input
            aria-label="Rechercher un produit ou une boutique"
            placeholder="Un produit, une envie..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <kbd>⌘ K</kbd>
        </form>
        <div className="header-actions">
          <a className="sell-link" href="#sell">Vendre sur Magnitech</a>
          <button
            className="cart-button"
            type="button"
            onClick={() => setCartOpen(true)}
            aria-label={`Ouvrir le panier, ${cartCount} article${cartCount > 1 ? "s" : ""}`}
          >
            <BagIcon />
            <span>Panier</span>
            <span className="cart-count">{cartCount}</span>
          </button>
        </div>
      </header>

      <nav className="category-nav" aria-label="Navigation principale">
        <a href="#products" onClick={() => setCategory("Tout voir")}>Tout le shop</a>
        <a href="#categories" onClick={() => setCategory("Tech")}>High-tech</a>
        <a href="#categories" onClick={() => setCategory("Audio")}>Audio & son</a>
        <a href="#categories" onClick={() => setCategory("Photo")}>Photo</a>
        <a href="#sell">Maison & lifestyle</a>
        <a className="nav-highlight" href="#products">Les pépites du moment <span>↗</span></a>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow"><span /> LA SÉLECTION QUI FAIT DU BIEN</p>
          <h1>De belles trouvailles.<br />Des gens <em>passionnés.</em></h1>
          <p className="hero-description">
            Le meilleur de la tech et du quotidien, déniché chez des commerçants indépendants.
            C’est plus simple, plus humain, plus Magnitech.
          </p>
          <a className="primary-button" href="#products">
            Explorer la sélection <ArrowIcon />
          </a>
          <div className="hero-proof">
            <div className="proof-avatars" aria-hidden="true">
              <span>👩🏽</span><span>👨🏻</span><span>👩🏼</span>
            </div>
            <p><strong>4,9/5</strong> par plus de 2 000 clients ravis</p>
          </div>
        </div>
        <div className="hero-art" aria-label="Sélection de produits du moment">
          <div className="hero-shape hero-shape-one" />
          <div className="hero-shape hero-shape-two" />
          <div className="hero-image">
            <Image
              src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=85"
              alt="Montre au design minimaliste"
              fill
              priority
              sizes="(max-width: 760px) 90vw, 48vw"
            />
          </div>
          <div className="hero-note">
            <span className="note-icon">✦</span>
            <span><strong>La pièce du moment</strong><small>Montre Horizon · Maison Pixel</small></span>
          </div>
          <div className="hero-price"><span>À partir de</span><strong>89,90 €</strong></div>
          <div className="hero-sticker">CHOISI<br />AVEC SOIN</div>
        </div>
      </section>

      <section className="benefits" aria-label="Les engagements Magnitech">
        <div><span className="benefit-icon">✳</span><p><strong>Des boutiques indépendantes</strong><small>Le talent près de chez vous</small></p></div>
        <div><span className="benefit-icon">↗</span><p><strong>Envoi suivi & soigné</strong><small>Votre commande, en confiance</small></p></div>
        <div><span className="benefit-icon">♡</span><p><strong>Retours faciles</strong><small>30 jours pour changer d’avis</small></p></div>
        <div><span className="benefit-icon">♧</span><p><strong>Paiement sécurisé</strong><small>Vos achats protégés</small></p></div>
      </section>

      <section className="categories-section" id="categories">
        <div className="section-heading">
          <div>
            <p className="eyebrow">FAITES À VOTRE FAÇON</p>
            <h2>Qu’est-ce qui vous ferait plaisir ?</h2>
          </div>
          <a className="text-link" href="#products">Toutes les catégories <ArrowIcon /></a>
        </div>
        <div className="category-list">
          {categories.map((item) => (
            <button
              className={`category-card ${category === item.name ? "selected" : ""}`}
              key={item.name}
              type="button"
              onClick={() => {
                setCategory(item.name);
                document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
              }}
              aria-pressed={category === item.name}
            >
              <span className={`category-icon ${item.tone}`}>{item.icon}</span>
              <span>{item.name}</span>
              <span className="category-arrow">↗</span>
            </button>
          ))}
        </div>
      </section>

      <section className="products-section" id="products">
        <div className="section-heading products-heading">
          <div>
            <p className="eyebrow">NOS COUPS DE CŒUR</p>
            <h2>Les pépites du moment<span>.</span></h2>
          </div>
          <label className="sort-control">
            <span>Trier par</span>
            <select aria-label="Trier les produits" value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="popular">Nos favoris</option>
              <option value="price">Prix croissant</option>
              <option value="rating">Mieux notés</option>
            </select>
          </label>
        </div>

        {visibleProducts.length ? (
          <div className="product-grid">
            {visibleProducts.map((product) => (
              <article className="product-card" key={product.id}>
                <div className={`product-image ${product.tone}`}>
                  <Image
                    src={`https://images.unsplash.com/${product.image}?auto=format&fit=crop&w=700&q=80`}
                    alt={product.name}
                    fill
                    sizes="(max-width: 600px) 90vw, (max-width: 1000px) 45vw, 23vw"
                  />
                  {product.badge && <span className="product-badge">{product.badge}</span>}
                  <button
                    className={`favorite-button ${favorites.includes(product.id) ? "is-favorite" : ""}`}
                    type="button"
                    aria-label={`${favorites.includes(product.id) ? "Retirer des" : "Ajouter aux"} favoris : ${product.name}`}
                    aria-pressed={favorites.includes(product.id)}
                    onClick={() => toggleFavorite(product.id)}
                  >
                    {favorites.includes(product.id) ? "♥" : "♡"}
                  </button>
                  <button className="quick-add" type="button" onClick={() => addToCart(product.id)}>
                    Ajouter au panier <span>+</span>
                  </button>
                </div>
                <div className="product-meta">
                  <div className="product-title-row">
                    <h3>{product.name}</h3>
                    <span className="rating">★ {product.rating}</span>
                  </div>
                  <p className="seller-name">par {product.seller} <span>· {product.reviews} avis</span></p>
                  <div className="price-row">
                    <strong>{formatPrice(product.price)}</strong>
                    {product.oldPrice && <del>{formatPrice(product.oldPrice)}</del>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-results">
            <span>⌕</span>
            <h3>Aucune pépite trouvée</h3>
            <p>Essayez un autre mot-clé ou explorez toutes nos catégories.</p>
            <button type="button" onClick={() => { setQuery(""); setCategory("Tout voir"); }}>
              Voir tous les produits
            </button>
          </div>
        )}
        <a className="all-products-button" href="#categories">
          Continuer à explorer <ArrowIcon />
        </a>
      </section>

      <section className="seller-banner" id="sell">
        <div className="seller-art" aria-hidden="true">
          <span>✦</span><span>♡</span><span>✳</span>
        </div>
        <div>
          <p className="eyebrow">VOUS AVEZ UNE BELLE HISTOIRE ?</p>
          <h2>Votre boutique mérite<br />d’être découverte.</h2>
          <p>Rejoignez une communauté de commerçants indépendants et faites grandir votre activité.</p>
          <a className="seller-button" href="mailto:bonjour@maghitech.fr">Découvrir Magnitech Pro <ArrowIcon /></a>
        </div>
        <div className="seller-stat"><strong>+120</strong><span>boutiques indépendantes<br />nous font déjà confiance</span></div>
      </section>

      <footer className="site-footer">
        <div className="footer-main">
          <div className="footer-brand">
            <a className="brand" href="#">magnitech<span>.</span></a>
            <p>Le commerce qui a du cœur.<br />Des boutiques indépendantes, une même envie de bien faire.</p>
          </div>
          <div><strong>À découvrir</strong><a href="#products">Nos pépites</a><a href="#categories">Les catégories</a><a href="#sell">Vendre sur Magnitech</a></div>
          <div><strong>Besoin d’aide ?</strong><a href="mailto:bonjour@maghitech.fr">Nous contacter</a><a href="#footer">Livraison & retours</a><a href="#footer">Questions fréquentes</a></div>
          <div className="newsletter">
            <strong>Une bonne trouvaille dans votre boîte mail.</strong>
            <p>Une dose d’inspiration, jamais de spam.</p>
            <form onSubmit={(event) => {
              event.preventDefault();
              setNewsletterMessage("L’inscription à la newsletter sera bientôt disponible.");
            }}>
              <label className="visually-hidden" htmlFor="newsletter-email">Votre adresse e-mail</label>
              <input id="newsletter-email" type="email" placeholder="votre@email.fr" required />
              <button type="submit" aria-label="S’inscrire à la newsletter">↗</button>
            </form>
            {newsletterMessage && <small className="newsletter-message" role="status">{newsletterMessage}</small>}
          </div>
        </div>
        <div className="footer-bottom" id="footer">
          <span>© 2026 Magnitech. Fait avec soin en France.</span>
          <div><a href="#footer">Confidentialité</a><a href="#footer">Conditions générales</a><span>🇫🇷 France · EUR €</span></div>
        </div>
      </footer>

      {cartOpen && (
        <div className="cart-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setCartOpen(false);
        }}>
          <section className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title">
            <div className="cart-header">
              <div><p className="eyebrow">VOTRE SÉLECTION</p><h2 id="cart-title">Votre panier <span>({cartCount})</span></h2></div>
              <button type="button" className="close-cart" onClick={() => setCartOpen(false)} aria-label="Fermer le panier">×</button>
            </div>
            {cartItems.length ? (
              <>
                <div className="cart-items">
                  {cartItems.map((product) => (
                    <div className="cart-item" key={product.id}>
                      <div className={`cart-thumb ${product.tone}`}>
                        <Image src={`https://images.unsplash.com/${product.image}?auto=format&fit=crop&w=180&q=70`} alt="" fill sizes="72px" />
                      </div>
                      <div className="cart-item-info">
                        <strong>{product.name}</strong><small>{product.seller}</small>
                        <div className="quantity-control">
                          <button type="button" onClick={() => updateQuantity(product.id, -1)} aria-label={`Retirer un ${product.name}`}>−</button>
                          <span>{cart[product.id]}</span>
                          <button type="button" onClick={() => updateQuantity(product.id, 1)} aria-label={`Ajouter un ${product.name}`}>+</button>
                        </div>
                      </div>
                      <strong className="cart-item-price">{formatPrice(product.price * cart[product.id])}</strong>
                    </div>
                  ))}
                </div>
                <div className="cart-summary">
                  <p><span>Sous-total</span><strong>{formatPrice(cartTotal)}</strong></p>
                  <small>Livraison calculée à l’étape suivante.</small>
                  <button type="button" className="checkout-button" onClick={() => setCheckoutMessage("Le paiement en ligne sera bientôt disponible. Votre panier est conservé.")}>
                    Continuer ma commande <ArrowIcon />
                  </button>
                  {checkoutMessage && <p className="checkout-message" role="status">{checkoutMessage}</p>}
                  <button type="button" className="continue-shopping" onClick={() => setCartOpen(false)}>Continuer mes achats</button>
                </div>
              </>
            ) : (
              <div className="empty-cart">
                <span>♡</span>
                <h3>Votre panier est tout léger</h3>
                <p>Quelques belles trouvailles pourraient changer ça.</p>
                <button type="button" className="primary-button" onClick={() => setCartOpen(false)}>Découvrir la sélection <ArrowIcon /></button>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
