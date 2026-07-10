花生一生後台商品管理頁｜正確架構版

這包已依照目前專案既有結構建立，不再使用錯誤的 admin/css、admin/js 或 admin-products.html。

請放入/覆蓋的位置：

admin/pages/products.html
admin/pages/product-editor.html
admin/assets/js/services/supabase-config.js
admin/assets/js/pages/products.js
admin/assets/js/pages/product-editor.js
admin/assets/css/pages/products.css
admin/assets/css/pages/product-editor.css

注意：
1. 覆蓋前建議先備份原本同名檔案。
2. admin/assets/js/services/supabase-config.js 需要填入 Supabase Project URL 與 anon public key。
3. 不要使用 service_role key。
4. 此版本會讀取 Supabase products 表。
5. 對應資料表欄位：sku, name, slug, category, subtitle, description, ingredients, weight, price, cost, stock, safety_stock, cover_image, status, is_featured, is_visible。

目前付款流程與訂單流程未在本包內處理，這包只處理商品列表與商品新增/編輯。
