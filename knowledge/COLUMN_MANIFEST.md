# Column Manifest (GENERATED — do not hand-edit)

Exact column names for the tables that agents query most. Regenerate with
`npm run kb:columns`. Hand edits are overwritten and, worse, silently rot —
a stale column list is more dangerous than a missing one.

This file answers ONE question: *what are this table's real column names?*
For what the columns MEAN, which database is authoritative, and the join
invariants, read `DICTIONARY.md` — that is still the source of truth for
semantics. Nothing here overrides it.

> Generated from the live schema. If a column here disagrees with live, live
> wins and this file is stale — rerun the generator.

## laravel_live

#### laravel_live.branding_records

**Columns (10):** id, digital_branding, physical_branding, merchandise, physical_branding_approval, digital_branding_approval, merchandise_approval, print_render_status, created_at, updated_at

<details><summary>with types</summary>

id bigint unsigned · digital_branding json · physical_branding json · merchandise json · physical_branding_approval tinyint unsigned · digital_branding_approval tinyint unsigned · merchandise_approval tinyint unsigned · print_render_status varchar(32) · created_at timestamp · updated_at timestamp

</details>

#### laravel_live.buyer_products

**Columns (48):** id, odoo_id, sku, type, category, name, reports_name, subtitle, description, pdp_description, price, price2016, dd_charge, number_of_candies, weight, fee_to_can, fee_to_intl, imageurl, sort_key, disabled, product_type, cover_image, receiver_size, subtitle_html, created_at, updated_at, deleted_at, wine, receiver_confirm_image, us_standard_shipping_fee, us_expedited_shipping_fee, ca_shipping_fee, default_kit, item_multiplier, product_configuration_id, size_name_id, select_image_url, seasonal_kit, seasonal_image, wishlinks_enabled, is_stacked, gift_card_fee, sw_fulfill, template_name, pdp_special_label, accessory_id, location_id, custom_location_id

<details><summary>with types</summary>

id int · odoo_id int · sku varchar(255) · type varchar(150) · category varchar(150) · name varchar(150) · reports_name varchar(255) · subtitle varchar(150) · description text · pdp_description longtext · price float(7,2) · price2016 float(7,2) · dd_charge float(5,2) · number_of_candies int · weight float(7,2) · fee_to_can float(7,2) · fee_to_intl int · imageurl varchar(255) · sort_key int · disabled tinyint · product_type int · cover_image varchar(255) · receiver_size json · subtitle_html varchar(255) · created_at timestamp · updated_at timestamp · deleted_at datetime · wine tinyint(1) · receiver_confirm_image varchar(255) · us_standard_shipping_fee double(8,2) · us_expedited_shipping_fee double(8,2) · ca_shipping_fee double(8,2) · default_kit bigint · item_multiplier int unsigned · product_configuration_id bigint unsigned · size_name_id bigint unsigned · select_image_url varchar(255) · seasonal_kit bigint · seasonal_image varchar(255) · wishlinks_enabled tinyint(1) · is_stacked tinyint(1) · gift_card_fee decimal(10,2) · sw_fulfill tinyint(1) · template_name varchar(255) · pdp_special_label varchar(255) · accessory_id bigint unsigned · location_id bigint unsigned · custom_location_id bigint unsigned

</details>

#### laravel_live.company_users_pivot

**Columns (18):** id, company_id, user_id, status, access_level, activation_code, active_date, created_at, updated_at, revenue, l30d_rev, l90d_rev, ytd_rev, lytd_rev, lastyear_rev, f7d_rev, f30d_rev, first_order_date

<details><summary>with types</summary>

id int · company_id int · user_id int · status enum('invited','active','inactive','deleted') · access_level enum('admin','user') · activation_code text · active_date datetime · created_at timestamp · updated_at timestamp · revenue double(8,2) · l30d_rev double(8,2) · l90d_rev double(8,2) · ytd_rev double(8,2) · lytd_rev double(8,2) · lastyear_rev double(8,2) · f7d_rev double(8,2) · f30d_rev double(8,2) · first_order_date date

</details>

#### laravel_live.component_kits

**Columns (6):** id, kit_id, component_id, quantity, created_at, updated_at

<details><summary>with types</summary>

id bigint unsigned · kit_id int · component_id bigint unsigned · quantity int · created_at timestamp · updated_at timestamp

</details>

#### laravel_live.component_orders

**Columns (12):** id, order_id, component_id, quantity, created_at, updated_at, order_type, component_sku, component_name, inventory_source, accessory_images_id, location_id

<details><summary>with types</summary>

id bigint unsigned · order_id int · component_id bigint unsigned · quantity int · created_at timestamp · updated_at timestamp · order_type varchar(255) · component_sku varchar(50) · component_name varchar(50) · inventory_source enum('odoo','serp') · accessory_images_id bigint unsigned · location_id bigint unsigned

</details>

#### laravel_live.components

**Columns (25):** id, odoo_id, inventory_source, sku, prod_slip_sku, name, company_id, description, inventory_quantity(deleted), status(deleted), sort_key, drop_level(deleted), number_of_picks, start_date, end_date, hide, created_at, updated_at, tax_code_id, tax_description, mi_inventory_qty(deleted), location_override, location_2_status(deleted), shelf_id, image_url

<details><summary>with types</summary>

id bigint unsigned · odoo_id varchar(255) · inventory_source enum('odoo','serp') · sku varchar(50) · prod_slip_sku varchar(255) · name varchar(50) · company_id int unsigned · description varchar(255) · inventory_quantity(deleted) int · status(deleted) tinyint · sort_key int · drop_level(deleted) int · number_of_picks int · start_date date · end_date date · hide tinyint · created_at timestamp · updated_at timestamp · tax_code_id bigint unsigned · tax_description mediumtext · mi_inventory_qty(deleted) int · location_override varchar(255) · location_2_status(deleted) tinyint(1) · shelf_id int · image_url varchar(255)

</details>

#### laravel_live.csv_exports

**Columns (10):** id, file_name, description, owner, sql, postgresql, hours, active, created_at, updated_at

<details><summary>with types</summary>

id int · file_name varchar(255) · description text · owner varchar(255) · sql text · postgresql text · hours varchar(255) · active tinyint(1) · created_at timestamp · updated_at timestamp

</details>

#### laravel_live.ec_order

**Columns (74):** id, order_id, increment_id, company_id, user_id, giftcards_card_id, status, store_id, customer_email, customer_firstname, customer_lastname, remote_ip, total_item_count, sendergiftmsg, gift_code, telephone, postcode, shipping_firstname, shipping_lastname, shipping_name, shipping_company, shipping_address, shipping_address2, shipping_city, shipping_state, shipping_country, shipping_created_at, carrier, service, tracking_number, ship_date, shipping_cost, notes, love_letters, created_at, updated_at, created_at_shipping, product_type, browser_information, size, is_imported, expedited_shipping, platform_fee, taxable_total, gift_total, gift_total_picks, pick_value, avatax_status, sales_tax, delivery_status, delivery_date, curated, delivery_mail_sent, tracking_mail_sent, fedex_checked_at, oddo_synchronized, co_ship_tax, shipping_label_url, component_imported, test_order, is_stacked, address_validation, ship_date_odoo_synchronized, vendor_imported, vendor_order_number, expected_delivery_date, label_created_at, sw_fulfill, expected_delivery_mail_sent, recipient_survey_sent, recipient_survey_sent_at, delivery_note, source, merchandise_selections

<details><summary>with types</summary>

id bigint unsigned · order_id bigint · increment_id bigint · company_id int · user_id int · giftcards_card_id int · status varchar(255) · store_id int · customer_email varchar(255) · customer_firstname varchar(255) · customer_lastname varchar(255) · remote_ip text · total_item_count int · sendergiftmsg blob · gift_code varchar(255) · telephone varchar(255) · postcode varchar(255) · shipping_firstname varchar(255) · shipping_lastname varchar(255) · shipping_name varchar(255) · shipping_company varchar(255) · shipping_address varchar(255) · shipping_address2 varchar(255) · shipping_city varchar(255) · shipping_state varchar(255) · shipping_country varchar(255) · shipping_created_at datetime · carrier varchar(255) · service varchar(255) · tracking_number varchar(255) · ship_date date · shipping_cost decimal(10,5) · notes text · love_letters tinyint · created_at timestamp · updated_at timestamp · created_at_shipping datetime · product_type int unsigned · browser_information varchar(255) · size int · is_imported tinyint · expedited_shipping enum('Standard Shipping','2-Day','Overnight') · platform_fee double(8,2) · taxable_total double(8,2) · gift_total double(8,2) · gift_total_picks int unsigned · pick_value double(8,2) · avatax_status enum('not-processed','processed','sent','skipped','adjusted','voided','cancelled','locked') · sales_tax double(8,2) · delivery_status varchar(255) · delivery_date varchar(255) · curated tinyint(1) · delivery_mail_sent tinyint(1) · tracking_mail_sent tinyint(1) · fedex_checked_at datetime · oddo_synchronized tinyint(1) · co_ship_tax double(8,2) · shipping_label_url varchar(255) · component_imported tinyint · test_order tinyint(1) · is_stacked tinyint(1) · address_validation tinyint · ship_date_odoo_synchronized tinyint · vendor_imported tinyint(1) · vendor_order_number varchar(255) · expected_delivery_date date · label_created_at timestamp · sw_fulfill tinyint(1) · expected_delivery_mail_sent timestamp · recipient_survey_sent tinyint(1) · recipient_survey_sent_at timestamp · delivery_note text · source tinyint · merchandise_selections json

</details>

#### laravel_live.giftcards_card

**Columns (106):** card_id, user_id, company_id, favorites_id, proposal_id, branding_record_id, discount_percent, discount_amount, discount_per_item, initial_true_amount, current_true_amount, final_amount, digital_branding_price, physical_branding_price, merchandise_price, paid, card_code, card_amount, card_balance, card_status, card_type, mail_from, mail_to, mail_to_email, mail_message, order_id, created_time, updated_time, canceled_time, product_id, product_sku, mail_delivery_date, send_time_requested, card_currency, is_mail_sent, mail_sent_date_time, sw_sku, mail_from_email, notes, first_follow_up, second_follow_up, third_follow_up, shipping_paid_for, consumer_card, invoice_by_user, delivery_method, updated_at, deleted_at, product_type, image_type, image_path, type, use_count, used_count, privacy_restricted, no_follow_up, referal_discount, whitelist_on, delivery_status, wishlink, expiration_date, credit_discount, reason, opens, clicks, expedited_shipping, ordered_as_guest, expedited_shipping_price, ecard_upload_id, custom_image_price, autodonation, insert_price, first_follow_up_at, second_follow_up_at, third_follow_up_at, canadian_shipping_amount, fourth_follow_up, fourth_follow_up_at, coupon_discount, coupon_code_applied, product_selections, expiration_warning_one, expiration_warning_one_at, expiration_warning_two, expiration_warning_two_at, sender_confirmation_at, 30_day_sent_at, seasonal_kit, product_configuration_id, redeem_only, customer_sms_number, message_id, wishlink_ecard_option, survey_id, test_card, skip_ecard, seasonal_kit_until, stacked_size, product_selections_gift2, gift1_price, gift2_price, contact_id, hold_until_date, maw_autodonate_date, sub_scheduled, recipient_id

<details><summary>with types</summary>

card_id bigint unsigned · user_id int · company_id int · favorites_id int · proposal_id bigint unsigned · branding_record_id bigint unsigned · discount_percent decimal(12,4) · discount_amount decimal(12,2) · discount_per_item decimal(12,2) · initial_true_amount decimal(12,2) · current_true_amount decimal(12,2) · final_amount decimal(12,2) · digital_branding_price decimal(15,2) · physical_branding_price decimal(15,2) · merchandise_price decimal(15,2) · paid tinyint · card_code varchar(64) · card_amount decimal(12,2) · card_balance decimal(12,2) · card_status tinyint unsigned · card_type enum('print','email','offline','sms') · mail_from varchar(255) · mail_to varchar(255) · mail_to_email varchar(255) · mail_message blob · order_id bigint · created_time datetime · updated_time datetime · canceled_time datetime · product_id int · product_sku varchar(255) · mail_delivery_date date · send_time_requested varchar(255) · card_currency varchar(50) · is_mail_sent tinyint(1) · mail_sent_date_time datetime · sw_sku varchar(255) · mail_from_email varchar(255) · notes text · first_follow_up tinyint · second_follow_up tinyint · third_follow_up tinyint · shipping_paid_for varchar(120) · consumer_card tinyint · invoice_by_user tinyint · delivery_method enum('email','message','print','wishlink','sms') · updated_at timestamp · deleted_at datetime · product_type int · image_type varchar(50) · image_path text · type varchar(50) · use_count int · used_count int · privacy_restricted tinyint(1) · no_follow_up tinyint(1) · referal_discount double(10,2) · whitelist_on tinyint(1) · delivery_status int · wishlink tinyint(1) · expiration_date date · credit_discount float(10,2) · reason varchar(50) · opens tinyint · clicks tinyint · expedited_shipping enum('Standard Shipping','2-Day','Overnight') · ordered_as_guest tinyint(1) · expedited_shipping_price double(15,4) · ecard_upload_id int · custom_image_price double(8,2) · autodonation tinyint(1) · insert_price double(8,2) · first_follow_up_at datetime · second_follow_up_at datetime · third_follow_up_at datetime · canadian_shipping_amount decimal(8,2) · fourth_follow_up tinyint(1) · fourth_follow_up_at datetime · coupon_discount decimal(8,2) · coupon_code_applied tinyint(1) · product_selections varchar(255) · expiration_warning_one tinyint(1) · expiration_warning_one_at datetime · expiration_warning_two tinyint(1) · expiration_warning_two_at datetime · sender_confirmation_at datetime · 30_day_sent_at timestamp · seasonal_kit bigint · product_configuration_id bigint unsigned · redeem_only tinyint(1) · customer_sms_number varchar(255) · message_id varchar(255) · wishlink_ecard_option varchar(255) · survey_id bigint unsigned · test_card tinyint(1) · skip_ecard tinyint(1) · seasonal_kit_until date · stacked_size smallint unsigned · product_selections_gift2 varchar(255) · gift1_price decimal(12,4) · gift2_price decimal(12,4) · contact_id bigint unsigned · hold_until_date date · maw_autodonate_date date · sub_scheduled tinyint(1) · recipient_id varchar(255)

</details>

#### laravel_live.invoice_adjustments

**Columns (17):** id, invoice_id, company_id, user_id, invoiced, description, amount, type, prepay, order_id, invoice_by_user, created_at, updated_at, for_purchase_credit, category, card_id, wishlink_purchase

<details><summary>with types</summary>

id int · invoice_id int · company_id int · user_id int unsigned · invoiced tinyint(1) · description text · amount decimal(15,2) · type enum('normal','prior-balance','credit') · prepay tinyint(1) · order_id bigint · invoice_by_user tinyint · created_at timestamp · updated_at timestamp · for_purchase_credit tinyint · category enum('','legacy','promo','bonus','purchase','cancel','service','transfer','charge','apm') · card_id int · wishlink_purchase tinyint(1)

</details>

#### laravel_live.kits

**Columns (8):** id, name, description, buyer_product_id, created_at, updated_at, company_id, deleted_at

<details><summary>with types</summary>

id bigint unsigned · name varchar(255) · description varchar(255) · buyer_product_id int · created_at timestamp · updated_at timestamp · company_id int unsigned · deleted_at timestamp

</details>

#### laravel_live.locations

**Columns (13):** id, name, column, created_at, updated_at, address1, address2, city, state, zip, country, status_column, location_code

<details><summary>with types</summary>

id bigint unsigned · name varchar(255) · column varchar(255) · created_at timestamp · updated_at timestamp · address1 varchar(255) · address2 varchar(255) · city varchar(255) · state varchar(255) · zip varchar(255) · country varchar(255) · status_column varchar(255) · location_code varchar(255)

</details>

#### laravel_live.product_type

**Columns (42):** id, name, url_key, sort_key, select_text, order_link, default_theme, custom_image_sku, receiver_type_icon_url, exclude_canada, image_url, created_at, updated_at, wishlinks_enabled, turn_time, shipping_carrier, locations, wine, select, confirmation_page_image, tracking_hero_image_url, product_line, type_description, type_page_image_url, type_icon_url, excludes_us, excludes_international, primary_prepick_locations, prepick_confirm_image_url, cocktails, edible, get_labels, choose_use_name, disclaimer, bypass_odoo, use_vendor_order_number, exclude_avatax, send_wine_delivery_notice, exclude_prepick, survey_skips_items, default_awning, default_location_id

<details><summary>with types</summary>

id int unsigned · name varchar(255) · url_key varchar(255) · sort_key int · select_text text · order_link varchar(200) · default_theme int · custom_image_sku varchar(200) · receiver_type_icon_url varchar(255) · exclude_canada tinyint · image_url varchar(200) · created_at timestamp · updated_at timestamp · wishlinks_enabled tinyint(1) · turn_time varchar(255) · shipping_carrier varchar(255) · locations varchar(255) · wine tinyint(1) · select tinyint(1) · confirmation_page_image varchar(255) · tracking_hero_image_url varchar(255) · product_line int unsigned · type_description text · type_page_image_url varchar(255) · type_icon_url varchar(255) · excludes_us tinyint(1) · excludes_international tinyint(1) · primary_prepick_locations varchar(255) · prepick_confirm_image_url varchar(255) · cocktails tinyint(1) · edible tinyint(1) · get_labels tinyint(1) · choose_use_name tinyint(1) · disclaimer mediumtext · bypass_odoo tinyint · use_vendor_order_number tinyint(1) · exclude_avatax tinyint(1) · send_wine_delivery_notice tinyint(1) · exclude_prepick tinyint(1) · survey_skips_items tinyint(1) · default_awning varchar(255) · default_location_id bigint unsigned

</details>

#### laravel_live.receiver_production_slips

**Columns (14):** id, order_id, insert_id, seasonal_box, theme_id, internal_notes, is_pdf_generated, batch_date, production_slip_batch, hold_until_date, is_printed, physical_branding_printed, created_at, updated_at

<details><summary>with types</summary>

id bigint unsigned · order_id bigint unsigned · insert_id bigint unsigned · seasonal_box tinyint(1) · theme_id bigint unsigned · internal_notes text · is_pdf_generated tinyint(1) · batch_date datetime · production_slip_batch bigint unsigned · hold_until_date date · is_printed tinyint(1) · physical_branding_printed tinyint · created_at timestamp · updated_at timestamp

</details>

#### laravel_live.receiver_products

**Columns (44):** product_id, sku, prod_slip_sku, name, image_name, full_image, description, short_description, ingredients, category, status, sort_key, inventory_qty, mi_inventory_qty, start_date, end_date, premium, sweet_shoppe, product_type, created_at, updated_at, deleted_at, archive, inventory_link, notes, tax_code_id, purchase_url, tax_description, purchase_button_label_text, drop_level, shipcompliant_id, location_2_status, vendor_id, inventory_updated_at, sw_inventory_updated_at, odoo_inventory, prelist_qty, tango_utid, show_on_flavors, vendor_cost, location_id, is_core, sku_type, exclude_international

<details><summary>with types</summary>

product_id int · sku varchar(255) · prod_slip_sku varchar(255) · name text · image_name varchar(255) · full_image varchar(255) · description text · short_description text · ingredients text · category int · status varchar(50) · sort_key float · inventory_qty int · mi_inventory_qty int · start_date date · end_date date · premium tinyint · sweet_shoppe tinyint · product_type int · created_at timestamp · updated_at timestamp · deleted_at datetime · archive tinyint(1) · inventory_link int · notes text · tax_code_id bigint unsigned · purchase_url varchar(255) · tax_description mediumtext · purchase_button_label_text varchar(255) · drop_level int · shipcompliant_id bigint · location_2_status tinyint(1) · vendor_id bigint unsigned · inventory_updated_at datetime · sw_inventory_updated_at datetime · odoo_inventory int · prelist_qty int · tango_utid varchar(255) · show_on_flavors tinyint(1) · vendor_cost decimal(8,2) · location_id bigint unsigned · is_core tinyint(1) · sku_type varchar(16) · exclude_international tinyint(1)

</details>

#### laravel_live.users

**Columns (60):** id, name, first_name, last_name, email, remember_token, created_at, updated_at, deleted_at, status, is_developer, for_company, cc_on_file, love_letters, phone, popup_shown_company, company_orders, referal_code, referal_code_usage, sms, sales_rep, client_level, client_status, contact_type, email_domain, training_date, training_status, industry, num_of_employees, mobile_phone, api_access_token, gclid, reset_password_time, otp_expire, reset_password_otp_attempt, otp_code, mail_token, test_account, ip_address, oddo_api_access_token, api_access, insightly_contact_id, user_responsible, validated, signup_source, account_type, last_credit_purchase, logout, klaviyo_id, user_created_from, increased_security, reset_ip, force_reset, phone_status, first_call, email_status, textable, calledwithin24hours, google_id, send_confirm

<details><summary>with types</summary>

id int unsigned · name varchar(255) · first_name varchar(255) · last_name varchar(255) · email varchar(255) · remember_token varchar(100) · created_at timestamp · updated_at timestamp · deleted_at timestamp · status tinyint · is_developer enum('Y','N') · for_company enum('yes','no') · cc_on_file tinyint · love_letters tinyint · phone varchar(50) · popup_shown_company tinyint · company_orders int · referal_code varchar(100) · referal_code_usage bigint · sms tinyint(1) · sales_rep varchar(255) · client_level varchar(255) · client_status varchar(255) · contact_type varchar(255) · email_domain varchar(255) · training_date varchar(255) · training_status varchar(255) · industry varchar(255) · num_of_employees varchar(255) · mobile_phone varchar(255) · api_access_token varchar(255) · gclid varchar(255) · reset_password_time datetime · otp_expire datetime · reset_password_otp_attempt int · otp_code varchar(255) · mail_token varchar(255) · test_account tinyint · ip_address varchar(255) · oddo_api_access_token varchar(255) · api_access tinyint · insightly_contact_id bigint unsigned · user_responsible varchar(255) · validated tinyint(1) · signup_source varchar(255) · account_type enum('','Guest','Onboarding','Personal','Company','Both') · last_credit_purchase datetime · logout tinyint(1) · klaviyo_id varchar(255) · user_created_from varchar(255) · increased_security tinyint(1) · reset_ip varchar(255) · force_reset tinyint(1) · phone_status varchar(255) · first_call datetime · email_status varchar(255) · textable tinyint(1) · calledwithin24hours tinyint(1) · google_id varchar(255) · send_confirm tinyint

</details>

## serp_test

#### serp_test._migrations

**Columns (3):** version, filename, applied_at

<details><summary>with types</summary>

version varchar(50) · filename varchar(255) · applied_at datetime

</details>

#### serp_test.odoo_sync_queue

**Columns (20):** id, entity_type, entity_id, operation, payload, status, attempts, max_attempts, last_attempt_at, next_attempt_at, error_message, error_details, odoo_id, odoo_response, created_at, updated_at, synced_at, priority, idempotency_key, sync_target

<details><summary>with types</summary>

id bigint · entity_type varchar(50) · entity_id bigint · operation varchar(20) · payload json · status varchar(20) · attempts int · max_attempts int · last_attempt_at datetime · next_attempt_at datetime · error_message text · error_details json · odoo_id bigint · odoo_response json · created_at datetime · updated_at datetime · synced_at datetime · priority int · idempotency_key varchar(255) · sync_target varchar(20)

</details>

#### serp_test.serp_account_move_line

**Columns (42):** id, move_id, name, sequence, quantity, price_unit, price_subtotal, price_total, discount, product_id, account_id, debit, credit, balance, amount_currency, currency_id, journal_id, date, tax_line_id, purchase_line_id, is_landed_costs_line, display_type, parent_state, move_name, ref, amount_residual, amount_residual_currency, full_reconcile_id, exclude_from_invoice_tab, reconciled, partner_id, product_uom_id, company_id, create_uid, write_uid, create_date, write_date, odoo_id, date_maturity, matching_number, tax_base_amount, is_anglo_saxon_line

<details><summary>with types</summary>

id bigint unsigned · move_id bigint unsigned · name varchar(255) · sequence int · quantity decimal(16,4) · price_unit decimal(16,5) · price_subtotal decimal(16,4) · price_total decimal(16,4) · discount decimal(8,4) · product_id bigint unsigned · account_id bigint · debit decimal(16,4) · credit decimal(16,4) · balance decimal(16,4) · amount_currency decimal(16,4) · currency_id int · journal_id bigint · date date · tax_line_id bigint · purchase_line_id bigint · is_landed_costs_line tinyint(1) · display_type enum('product','tax','payment_term','line_section','line_note','rounding') · parent_state varchar(20) · move_name varchar(100) · ref varchar(255) · amount_residual decimal(16,4) · amount_residual_currency decimal(16,4) · full_reconcile_id bigint · exclude_from_invoice_tab tinyint(1) · reconciled tinyint(1) · partner_id bigint · product_uom_id bigint · company_id int · create_uid bigint unsigned · write_uid bigint unsigned · create_date timestamp · write_date timestamp · odoo_id bigint · date_maturity date · matching_number varchar(16) · tax_base_amount decimal(12,4) · is_anglo_saxon_line tinyint

</details>

#### serp_test.serp_mrp_bom

**Columns (18):** id, code, product_id, product_tmpl_id, product_qty, type, active, company_id, sequence, product_uom_id, create_uid, write_uid, create_date, write_date, odoo_id, ready_to_produce, consumption, picking_type_id

<details><summary>with types</summary>

id bigint unsigned · code varchar(50) · product_id bigint unsigned · product_tmpl_id bigint unsigned · product_qty decimal(16,4) · type enum('normal','phantom') · active tinyint(1) · company_id int · sequence int · product_uom_id bigint · create_uid bigint unsigned · write_uid bigint unsigned · create_date timestamp · write_date timestamp · odoo_id bigint · ready_to_produce varchar(20) · consumption varchar(16) · picking_type_id bigint

</details>

#### serp_test.serp_mrp_bom_line

**Columns (14):** id, bom_id, product_id, product_tmpl_id, product_qty, product_uom_id, sequence, company_id, create_uid, write_uid, create_date, write_date, odoo_id, operation_id

<details><summary>with types</summary>

id bigint unsigned · bom_id bigint · product_id bigint unsigned · product_tmpl_id bigint unsigned · product_qty decimal(16,4) · product_uom_id bigint · sequence int · company_id int · create_uid bigint unsigned · write_uid bigint unsigned · create_date timestamp · write_date timestamp · odoo_id bigint · operation_id bigint

</details>

#### serp_test.serp_product_product

**Columns (13):** id, product_tmpl_id, active, component_id, receiver_product_id, buyer_product_id, recipe_key, default_code, create_uid, write_uid, create_date, write_date, odoo_id

<details><summary>with types</summary>

id bigint unsigned · product_tmpl_id bigint unsigned · active tinyint(1) · component_id bigint unsigned · receiver_product_id int · buyer_product_id bigint unsigned · recipe_key varchar(100) · default_code varchar(64) · create_uid bigint unsigned · write_uid bigint unsigned · create_date timestamp · write_date timestamp · odoo_id bigint

</details>

#### serp_test.serp_product_template

**Columns (21):** id, uom_id, active, name, purchase_ok, categ_id, uom_po_id, description, type, sequence, company_id, create_uid, write_uid, create_date, write_date, odoo_id, detailed_type, sale_ok, list_price, purchase_method, produce_delay

<details><summary>with types</summary>

id bigint unsigned · uom_id bigint · active tinyint(1) · name varchar(255) · purchase_ok tinyint(1) · categ_id int · uom_po_id bigint · description text · type varchar(20) · sequence int · company_id int · create_uid bigint unsigned · write_uid bigint unsigned · create_date timestamp · write_date timestamp · odoo_id bigint · detailed_type varchar(16) · sale_ok tinyint · list_price decimal(12,4) · purchase_method varchar(16) · produce_delay double

</details>

#### serp_test.serp_purchase_order

**Columns (34):** id, name, odoo_id, date_order, date_approve, effective_date, state, invoice_status, receipt_status, amount_tax, amount_total, amount_untaxed, partner_ref, date_planned, currency_id, currency_rate, picking_type_id, priority, user_id, date_calendar_start, invoice_count, partner_id, origin, company_id, notes, group_id, message_main_attachment_id, create_uid, write_uid, create_date, write_date, dest_address_id, incoterm_id, payment_term_id

<details><summary>with types</summary>

id bigint unsigned · name varchar(50) · odoo_id bigint · date_order datetime · date_approve datetime · effective_date datetime · state enum('draft','sent','to approve','purchase','done','cancel') · invoice_status enum('no','to invoice','invoiced') · receipt_status varchar(16) · amount_tax decimal(12,2) · amount_total decimal(12,2) · amount_untaxed decimal(12,2) · partner_ref varchar(255) · date_planned datetime · currency_id int · currency_rate decimal(12,6) · picking_type_id bigint · priority varchar(1) · user_id bigint · date_calendar_start datetime · invoice_count int · partner_id bigint unsigned · origin varchar(100) · company_id int · notes text · group_id bigint · message_main_attachment_id bigint · create_uid bigint unsigned · write_uid bigint unsigned · create_date timestamp · write_date timestamp · dest_address_id bigint · incoterm_id bigint · payment_term_id bigint

</details>

#### serp_test.serp_res_partner

**Columns (28):** id, name, email, weeks_on_hand, phone, mobile, contact_name, vat, website, street, street2, city, state_id, country_id, zip, company_id, active, supplier_rank, customer_rank, is_company, parent_id, created_at, updated_at, odoo_id, ref, type, commercial_partner_id, commercial_company_name

<details><summary>with types</summary>

id bigint unsigned · name varchar(255) · email varchar(255) · weeks_on_hand bigint unsigned · phone varchar(50) · mobile varchar(50) · contact_name varchar(255) · vat varchar(50) · website varchar(255) · street varchar(255) · street2 varchar(255) · city varchar(100) · state_id int · country_id int · zip varchar(20) · company_id int · active tinyint(1) · supplier_rank int · customer_rank int · is_company tinyint(1) · parent_id bigint unsigned · created_at timestamp · updated_at timestamp · odoo_id bigint · ref varchar(64) · type varchar(16) · commercial_partner_id bigint · commercial_company_name varchar(128)

</details>

#### serp_test.serp_res_users

**Columns (14):** id, login, password, active, partner_id, company_id, share, notification_type, slack_user_id, create_uid, write_uid, create_date, write_date, odoo_id

<details><summary>with types</summary>

id bigint unsigned · login varchar(255) · password varchar(255) · active tinyint(1) · partner_id bigint unsigned · company_id int · share tinyint(1) · notification_type varchar(20) · slack_user_id varchar(20) · create_uid bigint unsigned · write_uid bigint unsigned · create_date timestamp · write_date timestamp · odoo_id bigint

</details>

#### serp_test.serp_sale_order

**Columns (42):** id, name, ec_order_id, preselect_order_id, order_type, sw_id, sw_datetime, client_order_ref, origin, reference, state, invoice_status, date_order, validity_date, commitment_date, effective_date, signed_by, signed_on, partner_id, partner_invoice_id, partner_shipping_id, currency_id, warehouse_id, picking_type_id, message_main_attachment_id, user_id, amount_untaxed, amount_tax, amount_total, currency_rate, picking_policy, require_signature, require_payment, show_update_pricelist, note, access_token, company_id, odoo_id, create_uid, write_uid, create_date, write_date

<details><summary>with types</summary>

id bigint unsigned · name varchar(64) · ec_order_id bigint · preselect_order_id bigint · order_type enum('receiver-order','preselect-order') · sw_id bigint · sw_datetime datetime · client_order_ref varchar(255) · origin varchar(255) · reference varchar(255) · state enum('draft','sent','sale','done','cancel') · invoice_status enum('upselling','invoiced','to invoice','no') · date_order datetime · validity_date date · commitment_date datetime · effective_date datetime · signed_by varchar(255) · signed_on datetime · partner_id bigint · partner_invoice_id bigint · partner_shipping_id bigint · currency_id bigint · warehouse_id bigint · picking_type_id bigint · message_main_attachment_id bigint · user_id bigint · amount_untaxed decimal(16,4) · amount_tax decimal(16,4) · amount_total decimal(16,4) · currency_rate decimal(16,6) · picking_policy enum('direct','one') · require_signature tinyint(1) · require_payment tinyint(1) · show_update_pricelist tinyint(1) · note text · access_token varchar(255) · company_id int · odoo_id bigint · create_uid bigint unsigned · write_uid bigint unsigned · create_date timestamp · write_date timestamp

</details>

#### serp_test.serp_sale_order_line

**Columns (29):** id, order_id, item_id, component_order_id, name, sequence, product_id, product_uom_qty, product_uom, qty_delivered, qty_invoiced, customer_lead, price_unit, price_subtotal, price_total, price_tax, price_reduce, discount, state, invoice_status, order_partner_id, salesman_id, currency_id, company_id, odoo_id, create_uid, write_uid, create_date, write_date

<details><summary>with types</summary>

id bigint unsigned · order_id bigint · item_id bigint · component_order_id bigint · name text · sequence int · product_id bigint · product_uom_qty decimal(16,4) · product_uom bigint · qty_delivered decimal(16,4) · qty_invoiced decimal(16,4) · customer_lead double · price_unit decimal(16,4) · price_subtotal decimal(16,4) · price_total decimal(16,4) · price_tax double · price_reduce decimal(16,4) · discount decimal(5,2) · state enum('draft','sent','sale','done','cancel') · invoice_status enum('upselling','invoiced','to invoice','no') · order_partner_id bigint · salesman_id bigint · currency_id bigint · company_id int · odoo_id bigint · create_uid bigint unsigned · write_uid bigint unsigned · create_date timestamp · write_date timestamp

</details>

#### serp_test.serp_stock_move

**Columns (49):** id, name, reference, origin, product_id, product_uom_qty, product_qty, sequence, location_id, location_dest_id, state, price_unit, product_uom, picking_id, picking_type_id, purchase_line_id, sale_line_id, bom_line_id, production_id, raw_material_production_id, unbuild_id, consume_unbuild_id, component_order_id, group_id, is_done, partner_id, procure_method, propagate_cancel, unit_factor, is_inventory, scrapped, warehouse_id, date, date_deadline, origin_returned_move_id, to_refund, created_production_id, created_purchase_line_id, additional, company_id, create_uid, write_uid, create_date, write_date, odoo_id, cost_share, byproduct_id, reservation_date, priority

<details><summary>with types</summary>

id bigint unsigned · name varchar(255) · reference varchar(255) · origin varchar(100) · product_id bigint unsigned · product_uom_qty decimal(16,4) · product_qty decimal(16,4) · sequence int · location_id bigint · location_dest_id bigint · state enum('draft','waiting','confirmed','partially_available','assigned','done','cancel') · price_unit decimal(16,5) · product_uom bigint · picking_id bigint · picking_type_id bigint · purchase_line_id bigint · sale_line_id bigint · bom_line_id bigint · production_id bigint · raw_material_production_id bigint · unbuild_id bigint · consume_unbuild_id bigint · component_order_id bigint · group_id bigint · is_done tinyint(1) · partner_id bigint · procure_method varchar(20) · propagate_cancel tinyint(1) · unit_factor double · is_inventory tinyint(1) · scrapped tinyint(1) · warehouse_id bigint · date datetime · date_deadline datetime · origin_returned_move_id bigint · to_refund tinyint · created_production_id bigint · created_purchase_line_id bigint · additional tinyint(1) · company_id int · create_uid bigint unsigned · write_uid bigint unsigned · create_date timestamp · write_date timestamp · odoo_id bigint · cost_share decimal(12,4) · byproduct_id bigint · reservation_date date · priority varchar(1)

</details>

#### serp_test.serp_stock_move_line

**Columns (21):** id, move_id, picking_id, product_id, product_uom_qty, product_qty, qty_done, location_id, location_dest_id, state, date, reference, product_categ_id, production_id, product_uom_id, company_id, create_uid, write_uid, create_date, write_date, odoo_id

<details><summary>with types</summary>

id bigint unsigned · move_id bigint · picking_id bigint · product_id bigint unsigned · product_uom_qty decimal(16,4) · product_qty decimal(16,4) · qty_done decimal(16,4) · location_id bigint · location_dest_id bigint · state enum('draft','waiting','confirmed','assigned','done','cancel') · date datetime · reference varchar(255) · product_categ_id int · production_id bigint · product_uom_id bigint · company_id int · create_uid bigint unsigned · write_uid bigint unsigned · create_date timestamp · write_date timestamp · odoo_id bigint

</details>

#### serp_test.serp_stock_picking

**Columns (30):** id, name, origin, location_id, location_dest_id, picking_type_id, state, move_type, scheduled_date, date, partner_id, sale_id, group_id, date_deadline, priority, backorder_id, is_locked, immediate_transfer, date_done, note, company_id, message_main_attachment_id, has_deadline_issue, user_id, create_uid, write_uid, create_date, write_date, odoo_id, printed

<details><summary>with types</summary>

id bigint unsigned · name varchar(50) · origin varchar(100) · location_id bigint · location_dest_id bigint · picking_type_id bigint · state enum('draft','waiting','confirmed','assigned','done','cancel') · move_type enum('direct','one') · scheduled_date datetime · date datetime · partner_id bigint · sale_id bigint · group_id bigint · date_deadline datetime · priority varchar(1) · backorder_id bigint · is_locked tinyint(1) · immediate_transfer tinyint · date_done datetime · note text · company_id int · message_main_attachment_id bigint · has_deadline_issue tinyint(1) · user_id bigint · create_uid bigint unsigned · write_uid bigint unsigned · create_date timestamp · write_date timestamp · odoo_id bigint · printed tinyint

</details>

#### serp_test.serp_stock_quant

**Columns (17):** id, product_id, location_id, quantity, reserved_quantity, in_date, company_id, create_uid, write_uid, create_date, write_date, odoo_id, inventory_quantity, inventory_diff_quantity, inventory_date, accounting_date, user_id

<details><summary>with types</summary>

id bigint unsigned · product_id bigint unsigned · location_id bigint · quantity decimal(16,4) · reserved_quantity decimal(16,4) · in_date datetime · company_id int · create_uid bigint unsigned · write_uid bigint unsigned · create_date timestamp · write_date timestamp · odoo_id bigint · inventory_quantity decimal(12,4) · inventory_diff_quantity decimal(12,4) · inventory_date date · accounting_date date · user_id int

</details>

#### serp_test.serp_stock_valuation_layer

**Columns (19):** id, product_id, quantity, unit_cost, value, remaining_qty, remaining_value, stock_move_id, stock_landed_cost_id, account_move_id, stock_valuation_layer_id, description, categ_id, company_id, create_uid, write_uid, create_date, write_date, odoo_id

<details><summary>with types</summary>

id bigint unsigned · product_id bigint unsigned · quantity decimal(16,4) · unit_cost decimal(12,4) · value decimal(16,4) · remaining_qty decimal(16,4) · remaining_value decimal(16,4) · stock_move_id bigint · stock_landed_cost_id bigint · account_move_id bigint · stock_valuation_layer_id bigint · description varchar(255) · categ_id int · company_id int · create_uid bigint unsigned · write_uid bigint unsigned · create_date timestamp · write_date timestamp · odoo_id bigint

</details>

#### serp_test.serp_worker_run_history

**Columns (15):** id, worker, env, kind, started_at, finished_at, duration_ms, status, items_processed, attempt, error, error_class, host, trigger_reason, created_at

<details><summary>with types</summary>

id bigint · worker varchar(128) · env varchar(64) · kind enum('poller','cron') · started_at datetime(3) · finished_at datetime(3) · duration_ms int · status enum('ok','error','timeout','skipped_locked') · items_processed int · attempt smallint · error text · error_class varchar(128) · host varchar(64) · trigger_reason varchar(32) · created_at datetime(3)

</details>

## serp_app

#### serp_app._migrations

**Columns (3):** version, filename, applied_at

<details><summary>with types</summary>

version varchar(50) · filename varchar(255) · applied_at datetime

</details>

#### serp_app.serp_draft_operations_live

**Columns (20):** id, user_id, operation_type, title, data, notes, status, submitted_at, approved_by, approved_at, rejection_reason, created_at, updated_at, slack_channel_id, slack_message_ts, sync_target, sync_targets, last_assistant_seq, classified_types, image_descriptions

<details><summary>with types</summary>

id bigint · user_id bigint · operation_type varchar(50) · title varchar(512) · data json · notes text · status varchar(20) · submitted_at datetime · approved_by bigint · approved_at datetime · rejection_reason text · created_at datetime · updated_at datetime · slack_channel_id varchar(50) · slack_message_ts varchar(50) · sync_target varchar(20) · sync_targets text · last_assistant_seq int · classified_types json · image_descriptions json

</details>

#### serp_app.serp_worker_run_history

**Columns (15):** id, worker, env, kind, started_at, finished_at, duration_ms, status, items_processed, attempt, error, error_class, host, trigger_reason, created_at

<details><summary>with types</summary>

id bigint · worker varchar(128) · env varchar(64) · kind enum('poller','cron') · started_at datetime(3) · finished_at datetime(3) · duration_ms int · status enum('ok','error','timeout','skipped_locked') · items_processed int · attempt smallint · error text · error_class varchar(128) · host varchar(64) · trigger_reason varchar(32) · created_at datetime(3)

</details>

#### serp_app.serpy_op_rules

**Columns (14):** chunk_id, tier, body, op_types, embed_text, priority, requires_chunks, tool_refs, active, created_by, updated_by, created_at, updated_at, content_hash

<details><summary>with types</summary>

chunk_id varchar(128) · tier enum('op_core','op_detail') · body text · op_types json · embed_text text · priority int · requires_chunks json · tool_refs json · active tinyint(1) · created_by varchar(255) · updated_by varchar(255) · created_at datetime · updated_at datetime · content_hash varchar(16)

</details>

## odoo

#### odoo.mrp_bom

**Columns (18):** id, message_main_attachment_id, code, active, type, product_tmpl_id, product_id, product_qty, product_uom_id, sequence, ready_to_produce, picking_type_id, company_id, consumption, create_uid, create_date, write_uid, write_date

<details><summary>with types</summary>

id integer · message_main_attachment_id integer · code character varying · active boolean · type character varying · product_tmpl_id integer · product_id integer · product_qty numeric · product_uom_id integer · sequence integer · ready_to_produce character varying · picking_type_id integer · company_id integer · consumption character varying · create_uid integer · create_date timestamp without time zone · write_uid integer · write_date timestamp without time zone

</details>

#### odoo.mrp_bom_line

**Columns (13):** id, product_id, product_tmpl_id, company_id, product_qty, product_uom_id, sequence, bom_id, operation_id, create_uid, create_date, write_uid, write_date

<details><summary>with types</summary>

id integer · product_id integer · product_tmpl_id integer · company_id integer · product_qty numeric · product_uom_id integer · sequence integer · bom_id integer · operation_id integer · create_uid integer · create_date timestamp without time zone · write_uid integer · write_date timestamp without time zone

</details>

#### odoo.mrp_production

**Columns (39):** id, message_main_attachment_id, name, priority, backorder_sequence, origin, product_id, product_qty, product_uom_id, lot_producing_id, qty_producing, product_uom_qty, picking_type_id, location_src_id, location_dest_id, date_planned_start, date_planned_finished, date_deadline, date_start, date_finished, bom_id, state, reservation_state, user_id, company_id, procurement_group_id, product_description_variants, orderpoint_id, propagate_cancel, is_locked, is_planned, production_location_id, consumption, create_uid, create_date, write_uid, write_date, extra_cost, analytic_account_id

<details><summary>with types</summary>

id integer · message_main_attachment_id integer · name character varying · priority character varying · backorder_sequence integer · origin character varying · product_id integer · product_qty numeric · product_uom_id integer · lot_producing_id integer · qty_producing numeric · product_uom_qty double precision · picking_type_id integer · location_src_id integer · location_dest_id integer · date_planned_start timestamp without time zone · date_planned_finished timestamp without time zone · date_deadline timestamp without time zone · date_start timestamp without time zone · date_finished timestamp without time zone · bom_id integer · state character varying · reservation_state character varying · user_id integer · company_id integer · procurement_group_id integer · product_description_variants character varying · orderpoint_id integer · propagate_cancel boolean · is_locked boolean · is_planned boolean · production_location_id integer · consumption character varying · create_uid integer · create_date timestamp without time zone · write_uid integer · write_date timestamp without time zone · extra_cost double precision · analytic_account_id integer

</details>

#### odoo.product_product

**Columns (14):** id, message_main_attachment_id, default_code, active, product_tmpl_id, barcode, combination_indices, volume, weight, can_image_variant_1024_be_zoomed, create_uid, create_date, write_uid, write_date

<details><summary>with types</summary>

id integer · message_main_attachment_id integer · default_code character varying · active boolean · product_tmpl_id integer · barcode character varying · combination_indices character varying · volume numeric · weight numeric · can_image_variant_1024_be_zoomed boolean · create_uid integer · create_date timestamp without time zone · write_uid integer · write_date timestamp without time zone

</details>

#### odoo.product_template

**Columns (48):** id, message_main_attachment_id, name, sequence, description, description_purchase, description_sale, detailed_type, type, categ_id, list_price, volume, weight, sale_ok, purchase_ok, uom_id, uom_po_id, company_id, active, color, default_code, can_image_1024_be_zoomed, has_configurable_attributes, priority, create_uid, create_date, write_uid, write_date, service_type, sale_line_warn, sale_line_warn_msg, expense_policy, invoice_policy, sale_delay, tracking, description_picking, description_pickingout, description_pickingin, produce_delay, purchase_method, purchase_line_warn, purchase_line_warn_msg, service_to_purchase, tic_category_id, sku, sugarwish_id, landed_cost_ok, split_method_landed_cost

<details><summary>with types</summary>

id integer · message_main_attachment_id integer · name character varying · sequence integer · description text · description_purchase text · description_sale text · detailed_type character varying · type character varying · categ_id integer · list_price numeric · volume numeric · weight numeric · sale_ok boolean · purchase_ok boolean · uom_id integer · uom_po_id integer · company_id integer · active boolean · color integer · default_code character varying · can_image_1024_be_zoomed boolean · has_configurable_attributes boolean · priority character varying · create_uid integer · create_date timestamp without time zone · write_uid integer · write_date timestamp without time zone · service_type character varying · sale_line_warn character varying · sale_line_warn_msg text · expense_policy character varying · invoice_policy character varying · sale_delay double precision · tracking character varying · description_picking text · description_pickingout text · description_pickingin text · produce_delay double precision · purchase_method character varying · purchase_line_warn character varying · purchase_line_warn_msg text · service_to_purchase boolean · tic_category_id integer · sku character varying · sugarwish_id integer · landed_cost_ok boolean · split_method_landed_cost character varying

</details>

#### odoo.purchase_order

**Columns (38):** id, message_main_attachment_id, access_token, name, priority, origin, partner_ref, date_order, date_approve, partner_id, dest_address_id, currency_id, state, notes, invoice_count, invoice_status, date_planned, date_calendar_start, amount_untaxed, amount_tax, amount_total, fiscal_position_id, payment_term_id, incoterm_id, user_id, company_id, currency_rate, mail_reminder_confirmed, mail_reception_confirmed, create_uid, create_date, write_uid, write_date, picking_type_id, group_id, effective_date, show_partner_products, receipt_status

<details><summary>with types</summary>

id integer · message_main_attachment_id integer · access_token character varying · name character varying · priority character varying · origin character varying · partner_ref character varying · date_order timestamp without time zone · date_approve timestamp without time zone · partner_id integer · dest_address_id integer · currency_id integer · state character varying · notes text · invoice_count integer · invoice_status character varying · date_planned timestamp without time zone · date_calendar_start timestamp without time zone · amount_untaxed numeric · amount_tax numeric · amount_total numeric · fiscal_position_id integer · payment_term_id integer · incoterm_id integer · user_id integer · company_id integer · currency_rate double precision · mail_reminder_confirmed boolean · mail_reception_confirmed boolean · create_uid integer · create_date timestamp without time zone · write_uid integer · write_date timestamp without time zone · picking_type_id integer · group_id integer · effective_date timestamp without time zone · show_partner_products boolean · receipt_status character varying

</details>

#### odoo.purchase_order_line

**Columns (36):** id, name, sequence, product_qty, product_uom_qty, date_planned, product_uom, product_id, price_unit, price_subtotal, price_total, price_tax, order_id, account_analytic_id, company_id, state, qty_invoiced, qty_received_method, qty_received, qty_received_manual, qty_to_invoice, partner_id, currency_id, product_packaging_id, product_packaging_qty, display_type, create_uid, create_date, write_uid, write_date, orderpoint_id, product_description_variants, propagate_cancel, sale_order_id, sale_line_id, product_code

<details><summary>with types</summary>

id integer · name text · sequence integer · product_qty numeric · product_uom_qty double precision · date_planned timestamp without time zone · product_uom integer · product_id integer · price_unit numeric · price_subtotal numeric · price_total numeric · price_tax double precision · order_id integer · account_analytic_id integer · company_id integer · state character varying · qty_invoiced numeric · qty_received_method character varying · qty_received numeric · qty_received_manual numeric · qty_to_invoice numeric · partner_id integer · currency_id integer · product_packaging_id integer · product_packaging_qty double precision · display_type character varying · create_uid integer · create_date timestamp without time zone · write_uid integer · write_date timestamp without time zone · orderpoint_id integer · product_description_variants character varying · propagate_cancel boolean · sale_order_id integer · sale_line_id integer · product_code character varying

</details>

#### odoo.res_partner

**Columns (67):** id, name, company_id, create_date, display_name, date, title, parent_id, ref, lang, tz, user_id, vat, website, comment, credit_limit, active, employee, function, type, street, street2, zip, city, state_id, country_id, partner_latitude, partner_longitude, email, phone, mobile, is_company, industry_id, color, partner_share, commercial_partner_id, commercial_company_name, company_name, create_uid, write_uid, write_date, message_main_attachment_id, email_normalized, message_bounce, contact_address_complete, signup_token, signup_type, signup_expiration, team_id, ocn_token, partner_gid, additional_info, phone_sanitized, debit_limit, last_time_entries_checked, invoice_warn, invoice_warn_msg, supplier_rank, customer_rank, sale_warn, sale_warn_msg, picking_warn, picking_warn_msg, online_partner_information, purchase_warn, purchase_warn_msg, box_1099_id

<details><summary>with types</summary>

id integer · name character varying · company_id integer · create_date timestamp without time zone · display_name character varying · date date · title integer · parent_id integer · ref character varying · lang character varying · tz character varying · user_id integer · vat character varying · website character varying · comment text · credit_limit double precision · active boolean · employee boolean · function character varying · type character varying · street character varying · street2 character varying · zip character varying · city character varying · state_id integer · country_id integer · partner_latitude numeric · partner_longitude numeric · email character varying · phone character varying · mobile character varying · is_company boolean · industry_id integer · color integer · partner_share boolean · commercial_partner_id integer · commercial_company_name character varying · company_name character varying · create_uid integer · write_uid integer · write_date timestamp without time zone · message_main_attachment_id integer · email_normalized character varying · message_bounce integer · contact_address_complete character varying · signup_token character varying · signup_type character varying · signup_expiration timestamp without time zone · team_id integer · ocn_token character varying · partner_gid integer · additional_info character varying · phone_sanitized character varying · debit_limit numeric · last_time_entries_checked timestamp without time zone · invoice_warn character varying · invoice_warn_msg text · supplier_rank integer · customer_rank integer · sale_warn character varying · sale_warn_msg text · picking_warn character varying · picking_warn_msg text · online_partner_information character varying · purchase_warn character varying · purchase_warn_msg text · box_1099_id integer

</details>

#### odoo.res_users

**Columns (18):** id, active, login, password, company_id, partner_id, create_date, signature, action_id, share, create_uid, write_uid, write_date, totp_secret, notification_type, odoobot_state, odoobot_failed, sale_team_id

<details><summary>with types</summary>

id integer · active boolean · login character varying · password character varying · company_id integer · partner_id integer · create_date timestamp without time zone · signature text · action_id integer · share boolean · create_uid integer · write_uid integer · write_date timestamp without time zone · totp_secret character varying · notification_type character varying · odoobot_state character varying · odoobot_failed boolean · sale_team_id integer

</details>

#### odoo.sale_order

**Columns (55):** id, campaign_id, source_id, medium_id, message_main_attachment_id, access_token, name, origin, client_order_ref, reference, state, date_order, validity_date, require_signature, require_payment, create_date, user_id, partner_id, partner_invoice_id, partner_shipping_id, pricelist_id, currency_id, analytic_account_id, invoice_status, note, amount_untaxed, amount_tax, amount_total, currency_rate, payment_term_id, fiscal_position_id, company_id, team_id, signed_by, signed_on, commitment_date, show_update_pricelist, create_uid, write_uid, write_date, sale_order_template_id, incoterm, picking_policy, warehouse_id, procurement_group_id, effective_date, picking_type_id, sw_id, sw_datetime, x_studio_reupdated_stock, is_undelivered_notified, x_is_cancel_replenished, update_shipping_date, is_googlesheet_synced, x_studio_has_duplicate

<details><summary>with types</summary>

id integer · campaign_id integer · source_id integer · medium_id integer · message_main_attachment_id integer · access_token character varying · name character varying · origin character varying · client_order_ref character varying · reference character varying · state character varying · date_order timestamp without time zone · validity_date date · require_signature boolean · require_payment boolean · create_date timestamp without time zone · user_id integer · partner_id integer · partner_invoice_id integer · partner_shipping_id integer · pricelist_id integer · currency_id integer · analytic_account_id integer · invoice_status character varying · note text · amount_untaxed numeric · amount_tax numeric · amount_total numeric · currency_rate numeric · payment_term_id integer · fiscal_position_id integer · company_id integer · team_id integer · signed_by character varying · signed_on timestamp without time zone · commitment_date timestamp without time zone · show_update_pricelist boolean · create_uid integer · write_uid integer · write_date timestamp without time zone · sale_order_template_id integer · incoterm integer · picking_policy character varying · warehouse_id integer · procurement_group_id integer · effective_date timestamp without time zone · picking_type_id integer · sw_id integer · sw_datetime timestamp without time zone · x_studio_reupdated_stock boolean · is_undelivered_notified boolean · x_is_cancel_replenished boolean · update_shipping_date boolean · is_googlesheet_synced boolean · x_studio_has_duplicate boolean

</details>

#### odoo.sale_order_line

**Columns (39):** id, order_id, name, sequence, invoice_status, price_unit, price_subtotal, price_tax, price_total, price_reduce, price_reduce_taxinc, price_reduce_taxexcl, discount, product_id, product_uom_qty, product_uom, qty_delivered_method, qty_delivered, qty_delivered_manual, qty_to_invoice, qty_invoiced, untaxed_amount_invoiced, untaxed_amount_to_invoice, salesman_id, currency_id, company_id, order_partner_id, is_expense, is_downpayment, state, customer_lead, display_type, product_packaging_id, product_packaging_qty, create_uid, create_date, write_uid, write_date, route_id

<details><summary>with types</summary>

id integer · order_id integer · name text · sequence integer · invoice_status character varying · price_unit numeric · price_subtotal numeric · price_tax double precision · price_total numeric · price_reduce numeric · price_reduce_taxinc numeric · price_reduce_taxexcl numeric · discount numeric · product_id integer · product_uom_qty numeric · product_uom integer · qty_delivered_method character varying · qty_delivered numeric · qty_delivered_manual numeric · qty_to_invoice numeric · qty_invoiced numeric · untaxed_amount_invoiced numeric · untaxed_amount_to_invoice numeric · salesman_id integer · currency_id integer · company_id integer · order_partner_id integer · is_expense boolean · is_downpayment boolean · state character varying · customer_lead double precision · display_type character varying · product_packaging_id integer · product_packaging_qty double precision · create_uid integer · create_date timestamp without time zone · write_uid integer · write_date timestamp without time zone · route_id integer

</details>

#### odoo.stock_location

**Columns (28):** id, name, complete_name, active, usage, location_id, comment, posx, posy, posz, parent_path, company_id, scrap_location, return_location, removal_strategy_id, barcode, cyclic_inventory_frequency, last_inventory_date, next_inventory_date, storage_category_id, create_uid, create_date, write_uid, write_date, valuation_in_account_id, valuation_out_account_id, sugarwish_id, sugarwish_code

<details><summary>with types</summary>

id integer · name character varying · complete_name character varying · active boolean · usage character varying · location_id integer · comment text · posx integer · posy integer · posz integer · parent_path character varying · company_id integer · scrap_location boolean · return_location boolean · removal_strategy_id integer · barcode character varying · cyclic_inventory_frequency integer · last_inventory_date date · next_inventory_date date · storage_category_id integer · create_uid integer · create_date timestamp without time zone · write_uid integer · write_date timestamp without time zone · valuation_in_account_id integer · valuation_out_account_id integer · sugarwish_id integer · sugarwish_code character varying

</details>

#### odoo.stock_move

**Columns (59):** id, name, sequence, priority, date, date_deadline, company_id, product_id, description_picking, product_qty, product_uom_qty, product_uom, location_id, location_dest_id, partner_id, picking_id, state, price_unit, origin, procure_method, scrapped, group_id, rule_id, propagate_cancel, delay_alert_date, picking_type_id, is_inventory, origin_returned_move_id, restrict_partner_id, warehouse_id, additional, reference, package_level_id, next_serial, next_serial_count, orderpoint_id, reservation_date, product_packaging_id, create_uid, create_date, write_uid, write_date, is_done, unit_factor, created_production_id, production_id, raw_material_production_id, unbuild_id, consume_unbuild_id, operation_id, workorder_id, bom_line_id, byproduct_id, cost_share, to_refund, analytic_account_line_id, sale_line_id, purchase_line_id, created_purchase_line_id

<details><summary>with types</summary>

id integer · name character varying · sequence integer · priority character varying · date timestamp without time zone · date_deadline timestamp without time zone · company_id integer · product_id integer · description_picking text · product_qty numeric · product_uom_qty numeric · product_uom integer · location_id integer · location_dest_id integer · partner_id integer · picking_id integer · state character varying · price_unit double precision · origin character varying · procure_method character varying · scrapped boolean · group_id integer · rule_id integer · propagate_cancel boolean · delay_alert_date timestamp without time zone · picking_type_id integer · is_inventory boolean · origin_returned_move_id integer · restrict_partner_id integer · warehouse_id integer · additional boolean · reference character varying · package_level_id integer · next_serial character varying · next_serial_count integer · orderpoint_id integer · reservation_date date · product_packaging_id integer · create_uid integer · create_date timestamp without time zone · write_uid integer · write_date timestamp without time zone · is_done boolean · unit_factor double precision · created_production_id integer · production_id integer · raw_material_production_id integer · unbuild_id integer · consume_unbuild_id integer · operation_id integer · workorder_id integer · bom_line_id integer · byproduct_id integer · cost_share numeric · to_refund boolean · analytic_account_line_id integer · sale_line_id integer · purchase_line_id integer · created_purchase_line_id integer

</details>

#### odoo.stock_move_line

**Columns (34):** id, picking_id, move_id, company_id, product_id, product_uom_id, product_qty, product_uom_qty, qty_done, package_id, package_level_id, lot_id, lot_name, result_package_id, date, owner_id, location_id, location_dest_id, state, reference, description_picking, create_uid, create_date, write_uid, write_date, workorder_id, production_id, x_studio_float_field_Ax9xF, unit_cost, total_value, updated_values, product_categ_id, reupdated_zerocost, update_api

<details><summary>with types</summary>

id integer · picking_id integer · move_id integer · company_id integer · product_id integer · product_uom_id integer · product_qty numeric · product_uom_qty numeric · qty_done numeric · package_id integer · package_level_id integer · lot_id integer · lot_name character varying · result_package_id integer · date timestamp without time zone · owner_id integer · location_id integer · location_dest_id integer · state character varying · reference character varying · description_picking text · create_uid integer · create_date timestamp without time zone · write_uid integer · write_date timestamp without time zone · workorder_id integer · production_id integer · x_studio_float_field_Ax9xF double precision · unit_cost double precision · total_value double precision · updated_values boolean · product_categ_id integer · reupdated_zerocost boolean · update_api boolean

</details>

#### odoo.stock_picking

**Columns (30):** id, message_main_attachment_id, name, origin, note, backorder_id, move_type, state, group_id, priority, scheduled_date, date_deadline, has_deadline_issue, date, date_done, location_id, location_dest_id, picking_type_id, partner_id, company_id, user_id, owner_id, printed, is_locked, immediate_transfer, create_uid, create_date, write_uid, write_date, sale_id

<details><summary>with types</summary>

id integer · message_main_attachment_id integer · name character varying · origin character varying · note text · backorder_id integer · move_type character varying · state character varying · group_id integer · priority character varying · scheduled_date timestamp without time zone · date_deadline timestamp without time zone · has_deadline_issue boolean · date timestamp without time zone · date_done timestamp without time zone · location_id integer · location_dest_id integer · picking_type_id integer · partner_id integer · company_id integer · user_id integer · owner_id integer · printed boolean · is_locked boolean · immediate_transfer boolean · create_uid integer · create_date timestamp without time zone · write_uid integer · write_date timestamp without time zone · sale_id integer

</details>

#### odoo.stock_picking_type

**Columns (28):** id, name, color, sequence, sequence_id, sequence_code, default_location_src_id, default_location_dest_id, code, return_picking_type_id, show_entire_packs, warehouse_id, active, use_create_lots, use_existing_lots, print_label, show_operations, show_reserved, reservation_method, reservation_days_before, reservation_days_before_priority, barcode, company_id, create_uid, create_date, write_uid, write_date, use_create_components_lots

<details><summary>with types</summary>

id integer · name character varying · color integer · sequence integer · sequence_id integer · sequence_code character varying · default_location_src_id integer · default_location_dest_id integer · code character varying · return_picking_type_id integer · show_entire_packs boolean · warehouse_id integer · active boolean · use_create_lots boolean · use_existing_lots boolean · print_label boolean · show_operations boolean · show_reserved boolean · reservation_method character varying · reservation_days_before integer · reservation_days_before_priority integer · barcode character varying · company_id integer · create_uid integer · create_date timestamp without time zone · write_uid integer · write_date timestamp without time zone · use_create_components_lots boolean

</details>

#### odoo.stock_quant

**Columns (20):** id, product_id, company_id, location_id, lot_id, package_id, owner_id, quantity, reserved_quantity, in_date, inventory_quantity, inventory_diff_quantity, inventory_date, inventory_quantity_set, user_id, create_uid, create_date, write_uid, write_date, accounting_date

<details><summary>with types</summary>

id integer · product_id integer · company_id integer · location_id integer · lot_id integer · package_id integer · owner_id integer · quantity numeric · reserved_quantity numeric · in_date timestamp without time zone · inventory_quantity numeric · inventory_diff_quantity numeric · inventory_date date · inventory_quantity_set boolean · user_id integer · create_uid integer · create_date timestamp without time zone · write_uid integer · write_date timestamp without time zone · accounting_date date

</details>

#### odoo.stock_valuation_layer

**Columns (18):** id, company_id, product_id, quantity, unit_cost, value, remaining_qty, remaining_value, description, stock_valuation_layer_id, stock_move_id, account_move_id, create_uid, create_date, write_uid, write_date, stock_landed_cost_id, categ_id

<details><summary>with types</summary>

id integer · company_id integer · product_id integer · quantity numeric · unit_cost numeric · value numeric · remaining_qty numeric · remaining_value numeric · description character varying · stock_valuation_layer_id integer · stock_move_id integer · account_move_id integer · create_uid integer · create_date timestamp without time zone · write_uid integer · write_date timestamp without time zone · stock_landed_cost_id integer · categ_id integer

</details>

## wishdesk

#### wishdesk.orders_tickets

**Columns (20):** id, ticket_id, created_at, updated_at, requester_name, requester_email, subject, status, assignee_name, assignee_email, priority, type, due_date, company_id, company_name, gift_concierge, cc, proposal_id, is_read, merged_into_ticket_id

<details><summary>with types</summary>

id int · ticket_id varchar(20) · created_at datetime · updated_at datetime · requester_name varchar(255) · requester_email varchar(255) · subject varchar(500) · status varchar(20) · assignee_name varchar(255) · assignee_email varchar(255) · priority varchar(20) · type varchar(50) · due_date date · company_id int · company_name varchar(255) · gift_concierge varchar(50) · cc json · proposal_id int · is_read tinyint · merged_into_ticket_id varchar(20)

</details>

#### wishdesk.proposals

**Columns (31):** id, company_id, user_id, rep_id, created_by, proposal_name, status, quantity, total_budget, recipient_list_status, proposal_url_path, occasion, content, details_json, recipient_json, recipient_file, metadata, created_at, updated_at, deleted_at, approved_at, user_last_access, send_date, size_name_id, parent_proposal_id, sender_email, email_sent, digital_branding, physical_branding, merchandise, is_pinned

<details><summary>with types</summary>

id int · company_id int · user_id int · rep_id int · created_by int · proposal_name varchar(255) · status varchar(50) · quantity int · total_budget decimal(10,2) · recipient_list_status enum('has_list','no_list') · proposal_url_path varchar(255) · occasion varchar(255) · content json · details_json json · recipient_json json · recipient_file varchar(255) · metadata json · created_at datetime · updated_at datetime · deleted_at datetime · approved_at datetime · user_last_access datetime · send_date date · size_name_id int · parent_proposal_id int · sender_email varchar(255) · email_sent datetime · digital_branding json · physical_branding json · merchandise json · is_pinned tinyint(1)

</details>

#### wishdesk.sw_billing_tickets

**Columns (38):** id, ticket_number, category, request_type, subject, description, sw_company_id, sw_user_id, order_ids, ecard_ids, wishlink_ids, status, priority, assigned_to, due_date, follow_up_date, resolution, resolved_at, resolved_by, form_data, attachments, pdf_attachments, metadata, billing_leadership, slack_channel_id, slack_message_ts, slack_thread_ts, slack_requester_id, slack_requester_name, slack_workflow_type, slack_workflow_bot_id, slack_workflow_app_id, requested_by, created_by, updated_by, created_at, updated_at, deleted_at

<details><summary>with types</summary>

id int · ticket_number varchar(20) · category varchar(100) · request_type varchar(100) · subject varchar(255) · description text · sw_company_id int · sw_user_id int · order_ids json · ecard_ids json · wishlink_ids json · status enum('open','in_progress','pending','on_hold','resolved','closed') · priority enum('low','normal','high','urgent') · assigned_to int · due_date date · follow_up_date date · resolution text · resolved_at datetime · resolved_by int · form_data json · attachments json · pdf_attachments json · metadata json · billing_leadership tinyint(1) · slack_channel_id varchar(20) · slack_message_ts varchar(50) · slack_thread_ts varchar(50) · slack_requester_id varchar(20) · slack_requester_name varchar(100) · slack_workflow_type varchar(50) · slack_workflow_bot_id varchar(20) · slack_workflow_app_id varchar(20) · requested_by int · created_by int · updated_by int · created_at datetime · updated_at datetime · deleted_at datetime

</details>

#### wishdesk.swcrm_actions

**Columns (54):** id, title, category_name, due_date, completed_date, completed, details, status, priority, percent_complete, start_date, publicly_visible, responsible_user_id, owner_user_id, assigned_by_user_id, created_user_id, assigned_team_id, assigned_date, email_id, opportunity_id, stage_name, parent_task_id, reminder_date, expiration_date, reminder_sent, owner_visible, recurrence, recurrence_type, recurrence_interval, recurrence_days_of_week, recurrence_end_date, recurrence_parent_id, created_at, updated_at, record_id, sales_rep, user_responsible, responsible_user_name, owner_user_name, created_user_name, assigned_by_user_name, pipeline_name, completed_due_date_diff, assigned_team_name, linked_contact_name, linked_lead_name, opportunity_name, linked_organization_name, category_id, stage_id, metadata, created_by_type, insightly_task_id_gen, source_event_id

<details><summary>with types</summary>

id bigint · title varchar(255) · category_name varchar(255) · due_date datetime · completed_date datetime · completed tinyint(1) · details text · status varchar(50) · priority int · percent_complete int · start_date datetime · publicly_visible tinyint(1) · responsible_user_id int · owner_user_id bigint · assigned_by_user_id bigint · created_user_id bigint · assigned_team_id bigint · assigned_date datetime · email_id bigint · opportunity_id bigint · stage_name varchar(255) · parent_task_id bigint · reminder_date datetime · expiration_date datetime · reminder_sent tinyint(1) · owner_visible tinyint(1) · recurrence varchar(255) · recurrence_type enum('none','daily','weekly','monthly','yearly','workday') · recurrence_interval int · recurrence_days_of_week varchar(20) · recurrence_end_date date · recurrence_parent_id bigint · created_at datetime · updated_at datetime · record_id bigint unsigned · sales_rep varchar(255) · user_responsible bigint unsigned · responsible_user_name varchar(255) · owner_user_name varchar(255) · created_user_name varchar(255) · assigned_by_user_name varchar(255) · pipeline_name varchar(255) · completed_due_date_diff varchar(255) · assigned_team_name varchar(255) · linked_contact_name varchar(255) · linked_lead_name varchar(255) · opportunity_name varchar(255) · linked_organization_name varchar(255) · category_id bigint · stage_id bigint · metadata json · created_by_type enum('user','api','repeat','workflow','import') · insightly_task_id_gen varchar(64) · source_event_id varchar(128)

</details>
