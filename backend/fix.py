import pymysql

db = pymysql.connect(host='localhost', user='root', password='root', database='food')
c = db.cursor()

queries = [
    """
    ALTER TABLE banners
    ADD COLUMN start_date DATETIME NULL,
    ADD COLUMN end_date DATETIME NULL,
    ADD COLUMN target_audience ENUM('all', 'new_user', 'inactive_30_days') DEFAULT 'all',
    ADD COLUMN placement_zone ENUM('hero_carousel', 'mid_feed', 'cart_upsell', 'top_bar') DEFAULT 'hero_carousel',
    ADD COLUMN display_style ENUM('cinematic_21_9', 'square_1_1', 'pill_text', 'story_circle', 'popup_modal') DEFAULT 'cinematic_21_9',
    ADD COLUMN has_countdown BOOLEAN DEFAULT FALSE,
    ADD COLUMN countdown_end_time DATETIME NULL,
    ADD COLUMN linked_product_id INT NULL,
    ADD COLUMN linked_coupon_code VARCHAR(50) NULL,
    ADD COLUMN impressions INT DEFAULT 0,
    ADD COLUMN clicks INT DEFAULT 0;
    """,
    "ALTER TABLE banners ADD CONSTRAINT fk_banner_product FOREIGN KEY (linked_product_id) REFERENCES menu_items(id) ON DELETE SET NULL;"
]

for q in queries:
    try:
        c.execute(q)
        print("Success:", q.strip()[:50])
    except Exception as e:
        print('Error:', e)
        
db.commit()
print('Done!')
