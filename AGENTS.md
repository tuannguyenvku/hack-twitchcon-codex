# AGENTS.md — Codex x TwitchCon Hackathon

Hướng dẫn cho OpenAI Codex CLI (`codex`) của AgentAppStudio làm việc trên repo này.

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

- Issues #2–3 đã có backend + React dashboard/Canvas overlay; unit/integration/E2E và benchmark Chromium 500 agent pass. AC-1 vẫn thiếu live Twitch smoke, AC-5 thiếu capture OBS thật; AC-8 có storyboard theo nhánh "video plan/link", nhưng brief nộp Devpost vẫn cần video công khai. VALIDATION.md ghi status chính xác; CTO review là self-review, chưa phải chứng nhận độc lập.
- Live smoke cần OAuth và kênh Twitch thật; Demo không cần secret. Agent memory chỉ tồn tại trong phiên, không bền qua restart.
- coverage:check không có --report chỉ xác nhận parser tiêu chí, không chứng minh test/product coverage.

## Structure aliases (SPEC ↔ code)

- `SPEC.md` → Đặc tả hệ thống & danh sách `- AC-1: ...`
- `DESIGN.md` → Hệ thống thiết kế UI/UX
- `VALIDATION.md` → Báo cáo nghiệm thu theo chuẩn Studio Harness
- `SUBMISSION.md` → Bài thuyết trình nộp Devpost

## Architecture contract — Issue #1 (2026-10-30)

- Đọc DESIGN.md và SPEC.md trước khi build. Nguồn duyệt: HACKATHON_BRIEF.md; tài liệu này thay thế mô tả Extension cũ.
- Node.js/TypeScript, tmi.js, EventSub WebSocket, Helix; React/Vite + HTML5 Canvas; ws. Frontend/production cổng 3000, backend dev 3001 qua proxy.
- Server là nguồn state duy nhất; mỗi channel/viewer một agent; Live/Demo tách namespace; Director chỉ đề xuất theo schema, có rules fallback; không tăng quyền vote bằng Bits/sub.
- Chỉ lưu state trong RAM cho MVP; reset/restart tạo epoch/session mới. Không tự thêm database, Twitch Extension hay quyền điều khiển external game.
- Các thay đổi UI phải tuân thủ palette, typography, accessibility và responsive trong DESIGN.md; kiểm tra UI trước khi merge.
- Unit plans trong specs/twitchhive/units/; Issue #2 backend, #3 experience, #4 QA/release. Test phải ghi AC ID và VALIDATION.md phải dẫn bằng chứng thật, không tự đánh dấu pass.
- Giữ các log Codex CLI có sẵn ở máy cục bộ ngoài commit.

## Backend contract — Issue #2 (2026-10-30)

- Chạy `npm ci` rồi `npm run check` (format lint → strict typecheck → unit/integration → build). CI tại .github/workflows/backend.yml. Test fixtures dùng cổng tạm, không gọi Twitch/model trả phí.
- `shared/protocol.ts` là schema/wire contract; server/arena giữ state; server/twitch quản lý tmi.js, Helix và EventSub; server/director dùng OpenRouter theo CONVENTIONS-AI, không dùng trực tiếp OpenAI API. Model slug lấy từ OPENROUTER_MODEL; rules là mặc định.
- `/api/demo` cấp session riêng một giờ + CSRF + overlay capability. Socket read-only, mutations đi HTTP. Cookie SameSite=Lax là lựa chọn có chủ đích để OAuth GET callback xuyên site hoạt động; Origin/CSRF/state vẫn bắt buộc đúng nơi.
- WS v1 delta mang toàn bộ absolute public state; frontend thay state, không cộng dồn; resync bằng snapshot khi gap/epoch/session đổi. Payload chưa tối ưu sparse delta để giữ contract đơn giản cho Issue #3.
- Hosted Demo không cần credential; hosted Live bắt buộc HTTPS, channel owner cấu hình và STREAMER_CONTROL_TOKEN. Không log query OAuth/overlay token, không commit .env. Session và tokens chỉ ở RAM.
- Test tải dùng đồng hồ giả lập, không thay thế benchmark thực thời gian 5 phút hoặc OBS/browser render. Scope/evidence chi tiết tại docs/ISSUE_2_BACKEND.md; không đánh AC-1 pass khi chưa có real-channel evidence.
- Giữ nguyên các log/session files untracked có trước Issue #2; không thêm chúng vào commit.

## Frontend and release contract — Issues #3–4 (2026-10-30)

- `npm run dev` chạy Vite 3000 và backend 3001 qua proxy; `npm run build && npm start` phục vụ frontend + HTTP/ws cùng cổng 3000. localhost là alias chỉ cho loopback cùng protocol/port; hosted kiểm tra Origin nghiêm ngặt.
- `/dashboard` dùng session/CSRF thật; `/overlay#token=...` dùng scoped read-only capability. POST /api/demo tái dùng session cookie hợp lệ để reload không mất agent; không lưu Twitch/model/owner secret vào browser storage.
- React UI trong client/, Canvas requestAnimationFrame độc lập ở client/Arena.tsx; raw events không được client tự quyết state. Freeze khi paused/reconnecting; reduced-motion tắt chuyển động trang trí. Token trong fragment tránh HTML request logging; WS query vẫn cần proxy redaction.
- HTML assets self-hosted với COOP same-origin / COEP require-corp; benchmark đo high-resolution timing. Playwright pin 1.56.1 vì bản 1.64.1 được thử gặp lỗi protocol test runner trong môi trường này; dùng `npx playwright install chromium` sau npm ci.
- `npm run check` chạy lint + backend/client typecheck + unit/integration + build + 4 E2E thực backend. `npm run test:performance` đo 300 giây thực, 500 agent và producer 50 events/s, 1920×1080; bản rút gọn chỉ là preflight.
- `/api/simulator/load` Demo-only, giới hạn 500 agents / 50 events/s / 300 giây; chỉ một producer/session, reset/replay/expiry/shutdown huỷ producer. Không gọi Twitch hoặc model trả phí từ Demo load.
- Issues #3–4 evidence: VALIDATION.md, docs/CTO_REVIEW.md, docs/evidence/. Source revision 19e943f được kiểm tra lại bằng npm ci và bản export Git sạch. Các commit release sau chỉ thay tài liệu/evidence, phải ghi rõ thay vì gán lại log cũ thành kiểm tra mới.
- README có Mermaid và setup; SUBMISSION.md ghi Codex Session ID chính xác từ CODEX_SESSION_ID.txt cùng vai trò thực của Codex. Chưa có video upload/Devpost submission, không bịa link. AC-8 cho phép video plan/link nên đánh giá nhánh plan riêng; không suy ra đã đủ video thật để nộp Devpost.
- Session-end ritual: giữ mọi log/session artifact và .DS_Store có sẵn ở máy cục bộ ngoài commit. Chỉ CODEX_SESSION_ID.txt gốc được thêm theo yêu cầu nộp bài rõ ràng của Issue #4.
