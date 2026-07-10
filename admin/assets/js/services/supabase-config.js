// admin/assets/js/services/supabase-config.js
// 請到 Supabase Project Settings > API 複製 Project URL 與 anon public key。
// 注意：不要把 service_role key 放到前端。

const SUPABASE_URL = "https://jvunqgrpoavywwtyrfey.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_nnRcEkYXTWDniHhnMgCG7Q_1EgRPJcJ";

window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
