CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  supplier_price INTEGER NOT NULL,
  price INTEGER NOT NULL,
  in_stock INTEGER NOT NULL DEFAULT 1,
  featured INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 1,
  specs TEXT NOT NULL DEFAULT '{}'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug ON products(slug);

CREATE TABLE IF NOT EXISTS product_images (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  image_url TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

INSERT OR REPLACE INTO products (id,name,slug,description,category,supplier_price,price,in_stock,featured,published,specs) VALUES
('mn-01','Arc Wireless Headphones','arc-wireless-headphones','Immersive, detailed sound in a lightweight design. Adaptive noise cancellation and all-day comfort make every listen feel considered.','Audio',42,89,1,1,1,'{"Battery life":"40 hours","Connectivity":"Bluetooth 5.3","Finish":"Graphite"}'),
('mn-02','Studio Mechanical Keyboard','studio-mechanical-keyboard','A compact mechanical keyboard engineered for a quiet, precise and satisfying typing experience.','Computing',38,79,1,1,1,'{"Layout":"75% compact","Connection":"USB-C / Bluetooth","Switches":"Tactile"}'),
('mn-03','Orbit Smart Watch','orbit-smart-watch','A clear, bright display meets thoughtfully designed health and activity tracking in a refined everyday companion.','Smart devices',51,119,1,1,1,'{"Display":"AMOLED","Battery":"Up to 7 days","Water resistance":"5 ATM"}'),
('mn-04','Studio Desk Speaker','studio-desk-speaker','Room-filling sound from a beautifully compact speaker, tuned for desk setups and small spaces.','Audio',29,64,1,1,1,'{"Output":"20 W","Connection":"Bluetooth / AUX","Finish":"Stone"}'),
('mn-05','Lumen Portable Projector','lumen-portable-projector','Bring a big-screen moment anywhere with a portable projector designed for easy setup and vivid viewing.','Smart devices',99,189,1,0,1,'{"Resolution":"Full HD","Projection":"Up to 120 inch","Inputs":"HDMI / USB-C"}'),
('mn-06','Precision Wireless Mouse','precision-wireless-mouse','A comfortable, precise wireless mouse with a quiet click and dependable battery life for work or play.','Computing',17,39,1,0,1,'{"DPI":"Adjustable to 4000","Connection":"Bluetooth / 2.4 GHz","Battery":"USB-C rechargeable"}'),
('mn-07','Magnetic Charging Stand','magnetic-charging-stand','Keep your phone visible and charged with a stable, thoughtfully weighted magnetic stand.','Accessories',14,34,1,0,1,'{"Output":"15 W","Compatibility":"Qi enabled devices","Finish":"Aluminium"}'),
('mn-08','Arc Gaming Controller','arc-gaming-controller','Responsive controls and an ergonomic shape for longer sessions across your favourite platforms.','Gaming',32,69,0,0,1,'{"Connection":"Bluetooth / USB-C","Compatibility":"PC / Android","Battery":"18 hours"}');

INSERT OR REPLACE INTO product_images (id,product_id,image_url,position) VALUES
('mn-01-image','mn-01','https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1000&q=85',0),
('mn-02-image','mn-02','https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=1000&q=85',0),
('mn-03-image','mn-03','https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=85',0),
('mn-04-image','mn-04','https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=1000&q=85',0),
('mn-05-image','mn-05','https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=1000&q=85',0),
('mn-06-image','mn-06','https://images.unsplash.com/photo-1527814050087-3793815479db?auto=format&fit=crop&w=1000&q=85',0),
('mn-07-image','mn-07','https://images.unsplash.com/photo-1601972599720-36938d4ecd31?auto=format&fit=crop&w=1000&q=85',0),
('mn-08-image','mn-08','https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=1000&q=85',0);
