-- Partial Day Sales Query - Today/Yesterday/LastWeek/YearAgo comparison
-- Uses verified consumer/corporate split logic from rev_by_company_by_date_detailed view
-- Matches main dashboard query exactly
--
-- CHANGE (per Jason, 2026-07-30): eCard Value w/ Sleeves and w/ Merchandise now use the
-- TOTAL gift value = card_amount + physical_branding_price (sleeve) + merchandise_price (merch),
-- in BOTH the numerator and the denominator. Previously these summed card_amount only
-- (ecard base), which excluded the sleeve/mug dollars.

SET @today = CURDATE();
SET @yesterday = DATE_SUB(@today, INTERVAL 1 DAY);
SET @last_week = DATE_SUB(@today, INTERVAL 7 DAY);
SET @same_date_ly = DATE_SUB(@today, INTERVAL 1 YEAR);
SET @wd_diff = WEEKDAY(@today) - WEEKDAY(@same_date_ly);
SET @year_ago = DATE_ADD(@same_date_ly, INTERVAL IF(@wd_diff > 3, @wd_diff - 7, IF(@wd_diff < -3, @wd_diff + 7, @wd_diff)) DAY);
SET @now_time = CURTIME();

SET @today_start = @today;
SET @today_end = TIMESTAMP(@today, @now_time);
SET @yesterday_start = @yesterday;
SET @yesterday_end = TIMESTAMP(@yesterday, @now_time);
SET @last_week_start = @last_week;
SET @last_week_end = TIMESTAMP(@last_week, @now_time);
SET @year_ago_start = @year_ago;
SET @year_ago_end = TIMESTAMP(@year_ago, @now_time);

WITH consumer_buyer_sales AS (
    SELECT DATE(bo.created_at) AS dt, SUM(bod.grand_total) AS amt
    FROM buyer_orders bo
    JOIN buyer_order_billing_details bod ON bod.order_id = bo.order_id
    LEFT JOIN company c ON bo.company_id = c.id
    WHERE (
        (bo.created_at >= @today_start AND bo.created_at <= @today_end)
        OR (bo.created_at >= @yesterday_start AND bo.created_at <= @yesterday_end)
        OR (bo.created_at >= @last_week_start AND bo.created_at <= @last_week_end)
        OR (bo.created_at >= @year_ago_start AND bo.created_at <= @year_ago_end)
    )
    AND (
        DATE(c.created_at) > DATE(bo.created_at)
        OR bo.company_id = 24
        OR bo.company_id IS NULL
        OR bo.company_id = 0
    )
    GROUP BY DATE(bo.created_at)
),
consumer_preselect_sales AS (
    SELECT DATE(created_at) AS dt, IFNULL(SUM(total), 0) AS amt
    FROM preselect_orders
    WHERE (
        (created_at >= @today_start AND created_at <= @today_end)
        OR (created_at >= @yesterday_start AND created_at <= @yesterday_end)
        OR (created_at >= @last_week_start AND created_at <= @last_week_end)
        OR (created_at >= @year_ago_start AND created_at <= @year_ago_end)
    )
    AND (company_id IS NULL OR company_id = 0)
    GROUP BY DATE(created_at)
),
consumer_canadian AS (
    SELECT DATE(eo.created_at) AS dt, SUM(gc.canadian_shipping_amount) AS amt
    FROM giftcards_card gc
    LEFT JOIN ec_order eo ON gc.card_code = eo.gift_code
    WHERE (
        (eo.created_at >= @today_start AND eo.created_at <= @today_end)
        OR (eo.created_at >= @yesterday_start AND eo.created_at <= @yesterday_end)
        OR (eo.created_at >= @last_week_start AND eo.created_at <= @last_week_end)
        OR (eo.created_at >= @year_ago_start AND eo.created_at <= @year_ago_end)
    )
    AND gc.canadian_shipping_amount IS NOT NULL
    AND gc.canadian_shipping_amount <> 0
    AND gc.company_id = 24
    GROUP BY DATE(eo.created_at)
),
receiver_orders_received AS (
    SELECT DATE(created_at) AS dt, COUNT(id) AS cnt
    FROM ec_order
    WHERE (
        (created_at >= @today_start AND created_at <= @today_end)
        OR (created_at >= @yesterday_start AND created_at <= @yesterday_end)
        OR (created_at >= @last_week_start AND created_at <= @last_week_end)
        OR (created_at >= @year_ago_start AND created_at <= @year_ago_end)
    )
    AND LEFT(increment_id, 1) = '2'
    GROUP BY DATE(created_at)
),
preselect_orders_received AS (
    SELECT DATE(created_at) AS dt, COUNT(id) AS cnt
    FROM preselect_orders
    WHERE (
        (created_at >= @today_start AND created_at <= @today_end)
        OR (created_at >= @yesterday_start AND created_at <= @yesterday_end)
        OR (created_at >= @last_week_start AND created_at <= @last_week_end)
        OR (created_at >= @year_ago_start AND created_at <= @year_ago_end)
    )
    GROUP BY DATE(created_at)
),
orders_received AS (
    SELECT
        COALESCE(ror.dt, por.dt) AS dt,
        IFNULL(ror.cnt, 0) + IFNULL(por.cnt, 0) AS cnt
    FROM receiver_orders_received ror
    LEFT JOIN preselect_orders_received por ON ror.dt = por.dt
    UNION
    SELECT
        COALESCE(ror.dt, por.dt) AS dt,
        IFNULL(ror.cnt, 0) + IFNULL(por.cnt, 0) AS cnt
    FROM receiver_orders_received ror
    RIGHT JOIN preselect_orders_received por ON ror.dt = por.dt
),
receiver_orders_shipped AS (
    SELECT DATE(ship_date) AS dt, COUNT(id) AS cnt
    FROM ec_order
    WHERE (
        (ship_date >= @today_start AND ship_date <= @today_end)
        OR (ship_date >= @yesterday_start AND ship_date <= @yesterday_end)
        OR (ship_date >= @last_week_start AND ship_date <= @last_week_end)
        OR (ship_date >= @year_ago_start AND ship_date <= @year_ago_end)
    )
    AND LEFT(increment_id, 1) = '2'
    GROUP BY DATE(ship_date)
),
preselect_orders_shipped AS (
    SELECT DATE(shipped_date) AS dt, COUNT(id) AS cnt
    FROM preselect_orders
    WHERE (
        (shipped_date >= @today_start AND shipped_date <= @today_end)
        OR (shipped_date >= @yesterday_start AND shipped_date <= @yesterday_end)
        OR (shipped_date >= @last_week_start AND shipped_date <= @last_week_end)
        OR (shipped_date >= @year_ago_start AND shipped_date <= @year_ago_end)
    )
    GROUP BY DATE(shipped_date)
),
orders_shipped AS (
    SELECT
        COALESCE(ros.dt, pos.dt) AS dt,
        IFNULL(ros.cnt, 0) + IFNULL(pos.cnt, 0) AS cnt
    FROM receiver_orders_shipped ros
    LEFT JOIN preselect_orders_shipped pos ON ros.dt = pos.dt
    UNION
    SELECT
        COALESCE(ros.dt, pos.dt) AS dt,
        IFNULL(ros.cnt, 0) + IFNULL(pos.cnt, 0) AS cnt
    FROM receiver_orders_shipped ros
    RIGHT JOIN preselect_orders_shipped pos ON ros.dt = pos.dt
),
ecards_sent AS (
    SELECT DATE(mail_delivery_date) AS dt, COUNT(*) AS cnt
    FROM giftcards_card
    WHERE (
        (mail_delivery_date >= @today_start AND mail_delivery_date <= @today_end)
        OR (mail_delivery_date >= @yesterday_start AND mail_delivery_date <= @yesterday_end)
        OR (mail_delivery_date >= @last_week_start AND mail_delivery_date <= @last_week_end)
        OR (mail_delivery_date >= @year_ago_start AND mail_delivery_date <= @year_ago_end)
    )
    GROUP BY DATE(mail_delivery_date)
),
ecards_ordered AS (
    SELECT DATE(created_time) AS dt, COUNT(*) AS cnt
    FROM giftcards_card
    WHERE (
        (created_time >= @today_start AND created_time <= @today_end)
        OR (created_time >= @yesterday_start AND created_time <= @yesterday_end)
        OR (created_time >= @last_week_start AND created_time <= @last_week_end)
        OR (created_time >= @year_ago_start AND created_time <= @year_ago_end)
    )
    GROUP BY DATE(created_time)
),
new_corp AS (
    SELECT DATE(created_at) AS dt, COUNT(*) AS cnt
    FROM company
    WHERE active != 0 AND test_account != 1 AND IFNULL(referred_by,'') != 'Conference/trade show'
      AND (
        (created_at >= @today_start AND created_at <= @today_end)
        OR (created_at >= @yesterday_start AND created_at <= @yesterday_end)
        OR (created_at >= @last_week_start AND created_at <= @last_week_end)
        OR (created_at >= @year_ago_start AND created_at <= @year_ago_end)
    )
    GROUP BY DATE(created_at)
),
personal AS (
    SELECT DATE(u.created_at) AS dt, COUNT(*) AS cnt
    FROM users u
    JOIN role_user ru ON u.id = ru.user_id AND ru.role_id = 4
    JOIN passwords p ON u.id = p.user_id AND p.password <> ''
    WHERE u.status <> 0 AND u.for_company = 'no'
      AND (
        (u.created_at >= @today_start AND u.created_at <= @today_end)
        OR (u.created_at >= @yesterday_start AND u.created_at <= @yesterday_end)
        OR (u.created_at >= @last_week_start AND u.created_at <= @last_week_end)
        OR (u.created_at >= @year_ago_start AND u.created_at <= @year_ago_end)
    )
    GROUP BY DATE(u.created_at)
),
gift_card_amt AS (
    SELECT DATE(gc.created_time) AS dt, SUM(card_amount) AS amt
    FROM giftcards_card gc
    JOIN company c ON gc.company_id = c.id AND c.name NOT LIKE '%test%'
    WHERE gc.created_time > '2024-07-02'
      AND (product_selections_gift2 IN (915,916,917,918,919,920,921,922,923,924,925,926,927,928,929,930)
           OR (product_configuration_id = 73 AND card_status <> 0))
      AND (
        (gc.created_time >= @today_start AND gc.created_time <= @today_end)
        OR (gc.created_time >= @yesterday_start AND gc.created_time <= @yesterday_end)
        OR (gc.created_time >= @last_week_start AND gc.created_time <= @last_week_end)
        OR (gc.created_time >= @year_ago_start AND gc.created_time <= @year_ago_end)
    )
    GROUP BY DATE(gc.created_time)
),
-- Total ecard value = full gift value (ecard + sleeve + merch). Denominator for the two % rows.
total_ecard_amt AS (
    SELECT DATE(gc.created_time) AS dt,
           SUM(gc.card_amount + gc.physical_branding_price + gc.merchandise_price) AS amt
    FROM giftcards_card gc
    JOIN company c ON gc.company_id = c.id AND c.name NOT LIKE '%test%'
    WHERE (
        (gc.created_time >= @today_start AND gc.created_time <= @today_end)
        OR (gc.created_time >= @yesterday_start AND gc.created_time <= @yesterday_end)
        OR (gc.created_time >= @last_week_start AND gc.created_time <= @last_week_end)
        OR (gc.created_time >= @year_ago_start AND gc.created_time <= @year_ago_end)
    )
    GROUP BY DATE(gc.created_time)
),
-- Full gift value (ecard + sleeve + merch) of cards that carry a SLEEVE.
sleeve_amt AS (
    SELECT DATE(gc.created_time) AS dt,
           SUM(gc.card_amount + gc.physical_branding_price + gc.merchandise_price) AS amt
    FROM giftcards_card gc
    JOIN company c ON gc.company_id = c.id AND c.name NOT LIKE '%test%'
    WHERE gc.physical_branding_price > 0
      AND (
        (gc.created_time >= @today_start AND gc.created_time <= @today_end)
        OR (gc.created_time >= @yesterday_start AND gc.created_time <= @yesterday_end)
        OR (gc.created_time >= @last_week_start AND gc.created_time <= @last_week_end)
        OR (gc.created_time >= @year_ago_start AND gc.created_time <= @year_ago_end)
      )
    GROUP BY DATE(gc.created_time)
),
-- Full gift value (ecard + sleeve + merch) of cards that carry MERCHANDISE.
merchandise_amt AS (
    SELECT DATE(gc.created_time) AS dt,
           SUM(gc.card_amount + gc.physical_branding_price + gc.merchandise_price) AS amt
    FROM giftcards_card gc
    JOIN company c ON gc.company_id = c.id AND c.name NOT LIKE '%test%'
    WHERE gc.merchandise_price > 0
      AND (
        (gc.created_time >= @today_start AND gc.created_time <= @today_end)
        OR (gc.created_time >= @yesterday_start AND gc.created_time <= @yesterday_end)
        OR (gc.created_time >= @last_week_start AND gc.created_time <= @last_week_end)
        OR (gc.created_time >= @year_ago_start AND gc.created_time <= @year_ago_end)
      )
    GROUP BY DATE(gc.created_time)
),
-- Corporate buyer orders (CorporateSiteSales)
corp_bo AS (
    SELECT DATE(bo.created_at) AS dt, bo.company_id, SUM(bod.grand_total) AS sales
    FROM buyer_orders bo
    JOIN buyer_order_billing_details bod ON bod.order_id = bo.order_id
    JOIN company c ON bo.company_id = c.id
    WHERE (
        (bo.created_at >= @today_start AND bo.created_at <= @today_end)
        OR (bo.created_at >= @yesterday_start AND bo.created_at <= @yesterday_end)
        OR (bo.created_at >= @last_week_start AND bo.created_at <= @last_week_end)
        OR (bo.created_at >= @year_ago_start AND bo.created_at <= @year_ago_end)
    )
    AND DATE(c.created_at) <= DATE(bo.created_at)
    AND bo.company_id <> 24
    AND bo.company_id IS NOT NULL
    AND bo.company_id <> ''
    AND bo.company_id <> 115278
    AND c.discount_percent <= 99
    AND c.test_account <> 1
    AND c.active <> 0
    AND bod.second_payment_method <> 'checkmo'
    GROUP BY DATE(bo.created_at), bo.company_id
),
-- Corporate canadian shipping (NetAdjustment3)
corp_gc AS (
    SELECT DATE(eo.created_at) AS dt, gc.company_id, SUM(gc.canadian_shipping_amount) AS sales
    FROM giftcards_card gc
    LEFT JOIN ec_order eo ON gc.card_code = eo.gift_code
    JOIN company c ON gc.company_id = c.id
    WHERE (
        (eo.created_at >= @today_start AND eo.created_at <= @today_end)
        OR (eo.created_at >= @yesterday_start AND eo.created_at <= @yesterday_end)
        OR (eo.created_at >= @last_week_start AND eo.created_at <= @last_week_end)
        OR (eo.created_at >= @year_ago_start AND eo.created_at <= @year_ago_end)
    )
    AND gc.canadian_shipping_amount IS NOT NULL
    AND gc.canadian_shipping_amount <> 0
    AND gc.company_id <> 24
    AND gc.company_id <> 115278
    AND c.discount_percent <= 99
    AND c.test_account <> 1
    AND c.active <> 0
    GROUP BY DATE(eo.created_at), gc.company_id
),
-- Corporate invoice adjustments for charge_month_end=1 BEFORE 2023-11-01 (NetAdjustment1)
corp_ia_cme1_old AS (
    SELECT DATE(ia.created_at) AS dt, ia.company_id, SUM(ia.amount) AS sales
    FROM invoice_adjustments ia
    JOIN company c ON ia.company_id = c.id
    WHERE (
        (ia.created_at >= @today_start AND ia.created_at <= @today_end)
        OR (ia.created_at >= @yesterday_start AND ia.created_at <= @yesterday_end)
        OR (ia.created_at >= @last_week_start AND ia.created_at <= @last_week_end)
        OR (ia.created_at >= @year_ago_start AND ia.created_at <= @year_ago_end)
    )
    AND DATE(ia.created_at) < '2023-11-01'
    AND c.discount_percent <= 99
    AND c.test_account <> 1
    AND c.active <> 0
    AND ia.prepay = 0
    AND ia.type = 'normal'
    AND ia.description NOT LIKE '%Wishlinks%'
    AND ia.description NOT LIKE '%Purchase Credit'
    AND ia.company_id <> 115278
    AND c.charge_month_end = 1
    GROUP BY DATE(ia.created_at), ia.company_id
),
-- Corporate invoice adjustments for charge_month_end=1 FROM 2023-11-01 (cme_new_part)
corp_ia_cme1_new AS (
    SELECT DATE(ia.created_at) AS dt, ia.company_id, SUM(ia.amount) AS sales
    FROM invoice_adjustments ia
    JOIN company c ON ia.company_id = c.id
    WHERE (
        (ia.created_at >= @today_start AND ia.created_at <= @today_end)
        OR (ia.created_at >= @yesterday_start AND ia.created_at <= @yesterday_end)
        OR (ia.created_at >= @last_week_start AND ia.created_at <= @last_week_end)
        OR (ia.created_at >= @year_ago_start AND ia.created_at <= @year_ago_end)
    )
    AND DATE(ia.created_at) >= '2023-11-01'
    AND c.discount_percent <= 99
    AND c.test_account <> 1
    AND c.active <> 0
    AND ia.prepay = 0
    AND ia.type = 'normal'
    AND ia.company_id <> 115278
    AND c.charge_month_end = 1
    GROUP BY DATE(ia.created_at), ia.company_id
),
-- Corporate invoice adjustments for charge_month_end=0 (NetAdjustment)
corp_ia_cme0 AS (
    SELECT DATE(ia.created_at) AS dt, ia.company_id, SUM(ia.amount) AS sales
    FROM invoice_adjustments ia
    JOIN company c ON ia.company_id = c.id
    LEFT JOIN giftcards_card gc ON ia.card_id = gc.card_id
    WHERE (
        (ia.created_at >= @today_start AND ia.created_at <= @today_end)
        OR (ia.created_at >= @yesterday_start AND ia.created_at <= @yesterday_end)
        OR (ia.created_at >= @last_week_start AND ia.created_at <= @last_week_end)
        OR (ia.created_at >= @year_ago_start AND ia.created_at <= @year_ago_end)
    )
    AND c.discount_percent <= 99
    AND c.test_account <> 1
    AND c.active <> 0
    AND ia.prepay = 0
    AND c.charge_month_end = 0
    AND ia.type = 'normal'
    AND ia.description NOT LIKE '%Wishlinks%'
    AND ia.company_id <> 115278
    AND (
        (DATE(gc.created_time) >= '2023-11-01' AND DATE(gc.mail_delivery_date) >= '2023-11-01' AND gc.redeem_only = 0)
        OR gc.redeem_only = 1
        OR gc.created_time IS NULL
    )
    AND (
        (c.charge_month_end <> 1 AND DATE(ia.created_at) <= '2023-10-31')
        OR DATE(ia.created_at) >= '2023-11-01'
    )
    GROUP BY DATE(ia.created_at), ia.company_id
),
-- Corporate redeem only amount (RedeemOnlyAmount) - before 2023-11-01
corp_redeem_only AS (
    SELECT DATE(eo.created_at) AS dt, gc.company_id,
           SUM(CASE WHEN eo.is_stacked = 1 THEN gc.gift1_price
                    WHEN eo.is_stacked = 2 THEN gc.gift2_price
                    ELSE gc.final_amount END) AS sales
    FROM giftcards_card gc
    LEFT JOIN ec_order eo ON gc.card_code = eo.gift_code
    JOIN company c ON gc.company_id = c.id
    WHERE (
        (eo.created_at >= @today_start AND eo.created_at <= @today_end)
        OR (eo.created_at >= @yesterday_start AND eo.created_at <= @yesterday_end)
        OR (eo.created_at >= @last_week_start AND eo.created_at <= @last_week_end)
        OR (eo.created_at >= @year_ago_start AND eo.created_at <= @year_ago_end)
    )
    AND DATE(eo.created_at) < '2023-11-01'
    AND gc.redeem_only = 1
    AND gc.card_status = 2
    AND gc.delivery_method <> 'wishlink'
    AND gc.company_id <> 115278
    AND c.discount_percent <= 99
    AND c.test_account <> 1
    AND c.active <> 0
    GROUP BY DATE(eo.created_at), gc.company_id
),
-- Corporate preselect orders (PreselectCCSales)
corp_po AS (
    SELECT DATE(po.created_at) AS dt, po.company_id, SUM(po.total + po.intl_shipping) AS sales
    FROM preselect_orders po
    JOIN company c ON po.company_id = c.id
    WHERE (
        (po.created_at >= @today_start AND po.created_at <= @today_end)
        OR (po.created_at >= @yesterday_start AND po.created_at <= @yesterday_end)
        OR (po.created_at >= @last_week_start AND po.created_at <= @last_week_end)
        OR (po.created_at >= @year_ago_start AND po.created_at <= @year_ago_end)
    )
    AND po.company_id IS NOT NULL
    AND po.company_id <> 24
    AND po.company_id <> 0
    AND po.company_id <> 115278
    AND po.payment_method <> ''
    AND po.payment_method <> 'checkmo'
    AND c.discount_percent <= 99
    AND c.test_account <> 1
    AND c.active <> 0
    GROUP BY DATE(po.created_at), po.company_id
),
corp_combined AS (
    SELECT dt, company_id, SUM(sales) AS sales
    FROM (
        SELECT * FROM corp_bo
        UNION ALL SELECT * FROM corp_ia_cme1_old
        UNION ALL SELECT * FROM corp_ia_cme1_new
        UNION ALL SELECT * FROM corp_ia_cme0
        UNION ALL SELECT * FROM corp_gc
        UNION ALL SELECT * FROM corp_redeem_only
        UNION ALL SELECT * FROM corp_po
    ) all_sales
    GROUP BY dt, company_id
),
corp_ent AS (
    SELECT cc.dt,
           SUM(CASE WHEN ABS(cc.sales) >= 5000 THEN cc.sales END) AS enterprise,
           SUM(CASE WHEN ABS(cc.sales) < 5000 THEN cc.sales END) AS corporate
    FROM corp_combined cc
    GROUP BY cc.dt
),
consumer_totals AS (
    SELECT
        COALESCE(cbs.dt, cps.dt, cc.dt) AS dt,
        IFNULL(cbs.amt, 0) + IFNULL(cps.amt, 0) + IFNULL(cc.amt, 0) AS consumer_total
    FROM consumer_buyer_sales cbs
    LEFT JOIN consumer_preselect_sales cps ON cbs.dt = cps.dt
    LEFT JOIN consumer_canadian cc ON cbs.dt = cc.dt
)

SELECT
    CASE ct.dt WHEN @today THEN 'Today' WHEN @yesterday THEN 'Yesterday'
               WHEN @last_week THEN 'Last Week' ELSE 'A Year Ago' END AS period,
    CONCAT('$', FORMAT(ROUND(ct.consumer_total), 0)) AS `Consumer Sales`,
    CONCAT('$', FORMAT(ROUND(IFNULL(ce.corporate, 0)), 0)) AS `Non Ent Corporate Sales`,
    CONCAT('$', FORMAT(ROUND(IFNULL(ce.enterprise, 0)), 0)) AS `Enterprise Sales`,
    FORMAT(IFNULL(es.cnt, 0), 0) AS `Ecards Sent`,
    FORMAT(IFNULL(eo.cnt, 0), 0) AS `Ecards Ordered`,
    FORMAT(IFNULL(orec.cnt, 0), 0) AS `Receiver Orders`,
    FORMAT(IFNULL(os.cnt, 0), 0) AS `Orders Shipped`,
    FORMAT(IFNULL(nc.cnt, 0), 0) AS `New Corp Accounts`,
    FORMAT(IFNULL(pa.cnt, 0), 0) AS `New Personal Accounts`,
    CONCAT('$', FORMAT(ROUND(IFNULL(ga.amt, 0)), 0)) AS `Sales w/ Gift Cards (incl stacked)`,
    CASE WHEN IFNULL(tea.amt, 0) > 0
         THEN CONCAT(FORMAT(IFNULL(sl.amt, 0) / tea.amt * 100, 1), '%')
         ELSE '0.0%'
    END AS `eCard Value w/ Sleeves`,
    CASE WHEN IFNULL(tea.amt, 0) > 0
         THEN CONCAT(FORMAT(IFNULL(me.amt, 0) / tea.amt * 100, 1), '%')
         ELSE '0.0%'
    END AS `eCard Value w/ Merchandise`
FROM consumer_totals ct
LEFT JOIN orders_received orec ON ct.dt = orec.dt
LEFT JOIN orders_shipped os ON ct.dt = os.dt
LEFT JOIN ecards_sent es ON ct.dt = es.dt
LEFT JOIN ecards_ordered eo ON ct.dt = eo.dt
LEFT JOIN new_corp nc ON ct.dt = nc.dt
LEFT JOIN personal pa ON ct.dt = pa.dt
LEFT JOIN gift_card_amt ga ON ct.dt = ga.dt
LEFT JOIN total_ecard_amt tea ON ct.dt = tea.dt
LEFT JOIN corp_ent ce ON ct.dt = ce.dt
LEFT JOIN sleeve_amt sl ON ct.dt = sl.dt
LEFT JOIN merchandise_amt me ON ct.dt = me.dt
ORDER BY FIELD(period, 'Today', 'Yesterday', 'Last Week', 'A Year Ago');
