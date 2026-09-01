# GA4 後台流量設定

儀表板與「品牌分析」會透過 Supabase Edge Function `ga4-report` 讀取 GA4 彙總報表。Google Service Account 私鑰只可存放在 Supabase Secrets，不可放進網站 JavaScript、資料表或 GitHub。

## 1. 準備 Google Analytics 權限

1. 在 Google Cloud 啟用 **Google Analytics Data API**。
2. 建立 Service Account，下載 JSON 金鑰。
3. 到 GA4「管理 → 資源存取權管理」，把 Service Account 的 email 加為「檢視者」。
4. 到 GA4「管理 → 資源詳細資料」取得純數字的 Property ID；這不是 `G-XXXXXXXXXX` Measurement ID。

## 2. 設定 Supabase Secrets

在 Supabase 專案 `jvunqgrpoavywwtyrfey` 設定：

- `GA4_PROPERTY_ID`：GA4 數字型 Property ID
- `GA4_SERVICE_ACCOUNT_EMAIL`：Service Account 的 `client_email`
- `GA4_PRIVATE_KEY`：JSON 金鑰內完整的 `private_key`

請使用 Supabase Dashboard 的 Edge Functions Secrets 介面貼入，避免私鑰出現在終端歷史或 Git 紀錄。

## 3. 部署 Function

部署 `supabase/functions/ga4-report/index.ts`。Function 保持 JWT 驗證開啟，程式內還會再次向 Supabase Auth 驗證使用者，並要求 `app_metadata.role` 必須是 `admin`。

## 4. 驗證

1. 使用管理員帳號登入 `/admin/`。
2. 儀表板「網站流量」應顯示近 30 天有效訪客、與前 30 天的增減、真實每日趨勢、每位訪客造訪次數、每次造訪瀏覽頁數及首次訪客占比。
3. 到「品牌分析」切換 7、30、90、365 天，確認流量卡、趨勢、來源與熱門頁面一起更新。
4. 未設定完成時，畫面應顯示設定提示；訂單與商品資料仍應正常載入。

## 隱私與資料範圍

後台只接收 GA4 彙總結果，不把單一訪客識別資料寫入 Supabase。選擇「全部期間」時，銷售資料維持全部期間，GA4 流量限制為近 1 年並在畫面標示。
