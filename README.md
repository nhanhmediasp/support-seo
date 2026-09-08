# Air & Sea SEO Command Center

Web app quản trị SEO cho `airandseaglobal.vn`, chuẩn bị để deploy lên Vercel.

## Chạy local

```bash
npm.cmd install
npm.cmd run dev
```

Mở `http://localhost:3000`.

## Chức năng hiện tại

App đã có CRUD đầy đủ cho task, content plan, lịch đăng, nhân sự, On-page, audit, index, backlink, entity, seeding, keyword ranking và worklog. Mỗi module hỗ trợ tìm kiếm, lọc trạng thái, nhập/xuất CSV, sửa và xóa. Hệ thống có tự động hóa tạo task từ audit/index, báo cáo in PDF, backup/restore JSON và lưu bền trên trình duyệt.

Hệ thống hiện hỗ trợ nhiều website/project. Mỗi project có tên, domain, timezone và bộ dữ liệu SEO riêng. Màn hình `/auth` đã có đăng nhập/đăng ký Supabase; khi có biến môi trường Supabase, người dùng chưa đăng nhập sẽ được chuyển tới màn hình này.

Các trang có URL riêng để tải lại không mất vị trí:

`/` · `/tasks` · `/content` · `/calendar` · `/personnel` · `/onpage` · `/audits` · `/indexing` · `/backlinks` · `/entities` · `/seeding` · `/rankings` · `/worklogs` · `/reports` · `/changes` · `/settings`

## Cấu hình Supabase production

1. Tạo Supabase project mới.
2. Trong SQL Editor chạy `supabase/schema.sql` trước, sau đó chạy `supabase/multi-project.sql`.
3. Trong Authentication → URL Configuration, đặt Site URL là domain Vercel và thêm cả URL local vào Redirect URLs nếu cần dùng local.
4. Điền `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_ANON_KEY` cho local và Vercel.
5. Đặt `NEXT_PUBLIC_ALLOW_LOCAL_MODE=false` trên Vercel để bắt buộc đăng nhập.

Lần đăng nhập cloud đầu tiên, nếu tài khoản chưa có project trên Supabase, app sẽ tạo project cloud và chuyển dữ liệu local hiện có lên. Bảng `site_workspaces` đã được bật Realtime để local và Vercel nhận thay đổi của nhau.

## Google Search Console

1. Trong Google Cloud bật Search Console API và tạo OAuth Client kiểu Web application.
2. Thêm chính xác redirect URI `https://TEN-DOMAIN-VERCEL/api/search-console/callback`.
3. Điền `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` và `GOOGLE_SEARCH_CONSOLE_SITE_URL` trên Vercel.
4. Tài khoản Google kết nối phải có quyền đọc property Search Console.

Các integration keys không được hard-code trong frontend; dùng environment variables trên Vercel.

## Deploy Vercel

Có thể import repository vào Vercel hoặc chạy `npx vercel` ngay tại thư mục này. Chọn framework `Next.js`, giữ build command `next build`, rồi thêm các biến trong `.env.example` cho cả Preview và Production. Endpoint `/api/health` dùng để kiểm tra trạng thái integration sau deploy.

Trước khi deploy chạy:

```bash
npm.cmd run check
```
