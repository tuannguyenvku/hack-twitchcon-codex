# AGENTS.md — Codex x TwitchCon Hackathon

Hướng dẫn cho AI agents (Antigravity `agy` & Studio Harness) làm việc trên repo này.

## Project

Sản phẩm dự thi Hackathon **Codex x TwitchCon Hackathon** (Đã được người dùng phê duyệt ý tưởng):
- **Tên sản phẩm**: TwitchHive: One-Agent-Per-Viewer Interactive Stream Arena & OBS Overlay
- **Mô tả**: Mỗi viewer có micro-agent trên OBS Browser Overlay và Web Companion; Twitch Chat IRC/EventSub điều khiển swarm consensus, minigame và buff/debuff trong arena. Không dùng Twitch Extension hoặc điều khiển game bên ngoài.
- **Góc độ thắng giải**: Hiện thực hóa trọn vẹn triết lý One-Agent-Per-User và '2035 test', mở ra kỷ nguyên Massive Autonomous Co-play giúp Twitch gia tăng đột biến chỉ số tương tác, viewer retention và doanh thu bits/subs.
- **Quy trình kỹ thuật**: **SDD → VSDD → CoDD** của `/Volumes/AllySSD/Projects/AgentAppStudio/studio-harness`.

## Architectural decisions (đọc trước khi sửa)

| Quyết định | Lý do | Ngày |
|---|---|---|
| Chốt ý tưởng `TwitchHive: One-Agent-Per-Viewer Interactive Stream Arena & OBS Overlay` | Đã qua bước Human Approval Gate trước khi build | 2026-10 |
| Áp dụng Studio Harness (`SDD → VSDD → CoDD`) | Đảm bảo mọi tính năng đều có `DESIGN.md`, `SPEC.md` (`AC-1..N`), test tự động và `VALIDATION.md` | 2026-10 |

## Known gaps (đừng "sửa nhầm")

- Issue #2 đã triển khai backend, Twitch adapters, Director, HTTP/ws và simulator; test cục bộ pass. AC-1 vẫn thiếu live Twitch smoke; AC-4/5/6 cần frontend/OBS và AC-8 cần release artifacts. Chưa có nghiệm thu độc lập toàn sản phẩm.
- Live smoke cần OAuth và kênh Twitch thật; Demo không cần secret. Agent memory chỉ tồn tại trong phiên, không bền qua restart.
- coverage:check không có --report chỉ xác nhận parser tiêu chí, không chứng minh test/product coverage.

## Structure aliases (SPEC ↔ code)

- `SPEC.md` → Đặc tả hệ thống & danh sách `- AC-1: ...`
- `DESIGN.md` → Hệ thống thiết kế UI/UX
- `VALIDATION.md` → Báo cáo nghiệm thu theo chuẩn Studio Harness
- `SUBMISSION.md` → Bài thuyết trình nộp Devpost

## Architecture contract — Issue #1 (2026-10-30)

- Đọc DESIGN.md và SPEC.md trước khi build. Nguồn duyệt: HACKATHON_BRIEF.md và .antigravity/IDEA_APPROVAL.json; chúng thay thế mô tả Extension cũ.
- Node.js/TypeScript, tmi.js, EventSub WebSocket, Helix; React/Vite + HTML5 Canvas; ws. Frontend/production cổng 3000, backend dev 3001 qua proxy.
- Server là nguồn state duy nhất; mỗi channel/viewer một agent; Live/Demo tách namespace; Director chỉ đề xuất theo schema, có rules fallback; không tăng quyền vote bằng Bits/sub.
- Chỉ lưu state trong RAM cho MVP; reset/restart tạo epoch/session mới. Không tự thêm database, Twitch Extension hay quyền điều khiển external game.
- Các thay đổi UI phải tuân thủ palette, typography, accessibility và responsive trong DESIGN.md; kiểm tra UI trước khi merge.
- Unit plans trong specs/twitchhive/units/; Issue #2 backend, #3 experience, #4 QA/release. Test phải ghi AC ID và VALIDATION.md phải dẫn bằng chứng thật, không tự đánh dấu pass.
- Giữ log .antigravity/codex_issue_1.log ngoài commit Issue #1 vì là artifact runtime có sẵn.

## Backend contract — Issue #2 (2026-10-30)

- Chạy `npm ci` rồi `npm run check` (format lint → strict typecheck → unit/integration → build). CI tại .github/workflows/backend.yml. Test fixtures dùng cổng tạm, không gọi Twitch/model trả phí.
- `shared/protocol.ts` là schema/wire contract; server/arena giữ state; server/twitch quản lý tmi.js, Helix và EventSub; server/director dùng OpenRouter theo CONVENTIONS-AI, không dùng trực tiếp OpenAI API. Model slug lấy từ OPENROUTER_MODEL; rules là mặc định.
- `/api/demo` cấp session riêng một giờ + CSRF + overlay capability. Socket read-only, mutations đi HTTP. Cookie SameSite=Lax là lựa chọn có chủ đích để OAuth GET callback xuyên site hoạt động; Origin/CSRF/state vẫn bắt buộc đúng nơi.
- WS v1 delta mang toàn bộ absolute public state; frontend thay state, không cộng dồn; resync bằng snapshot khi gap/epoch/session đổi. Payload chưa tối ưu sparse delta để giữ contract đơn giản cho Issue #3.
- Hosted Demo không cần credential; hosted Live bắt buộc HTTPS, channel owner cấu hình và STREAMER_CONTROL_TOKEN. Không log query OAuth/overlay token, không commit .env. Session và tokens chỉ ở RAM.
- Test tải dùng đồng hồ giả lập, không thay thế benchmark thực thời gian 5 phút hoặc OBS/browser render. Scope/evidence chi tiết tại docs/ISSUE_2_BACKEND.md; không đánh AC-1 pass khi chưa có real-channel evidence.
- Giữ nguyên các log/session files untracked có trước Issue #2; không thêm chúng vào commit.
