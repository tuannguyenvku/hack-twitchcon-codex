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

- Issue #1 chỉ hoàn tất thiết kế/đặc tả; AC-1..AC-8 chưa được triển khai hoặc nghiệm thu.
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
