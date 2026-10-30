# AGENTS.md — Codex x TwitchCon Hackathon

Hướng dẫn cho AI agents (Antigravity `agy` & Studio Harness) làm việc trên repo này.

## Project

Sản phẩm dự thi Hackathon **Codex x TwitchCon Hackathon** (Đã được người dùng phê duyệt ý tưởng):
- **Tên sản phẩm**: TwitchHive: One-Agent-Per-Viewer Interactive Arena
- **Mô tả**: TwitchHive: One-Agent-Per-Viewer Interactive Arena: Mỗi khán giả trên Twitch sở hữu một micro AI Agent đại diện cá nhân hóa trên Extension, tự động phân tích diễn biến stream và phối hợp cùng hàng ngàn agent khác để điều khiển sự kiện, buff/debuff streamer trực tiếp trong game. Biến khán giả thụ động thành cộng đồng đồng sáng tạo nội dung thời gian thực.
- **Góc độ thắng giải**: Hiện thực hóa trọn vẹn triết lý One-Agent-Per-User và '2035 test', mở ra kỷ nguyên Massive Autonomous Co-play giúp Twitch gia tăng đột biến chỉ số tương tác, viewer retention và doanh thu bits/subs.
- **Quy trình kỹ thuật**: **SDD → VSDD → CoDD** của `/Volumes/AllySSD/Projects/AgentAppStudio/studio-harness`.

## Architectural decisions (đọc trước khi sửa)

| Quyết định | Lý do | Ngày |
|---|---|---|
| Chốt ý tưởng `TwitchHive: One-Agent-Per-Viewer Interactive Arena` | Đã qua bước Human Approval Gate trước khi build | 2026-10 |
| Áp dụng Studio Harness (`SDD → VSDD → CoDD`) | Đảm bảo mọi tính năng đều có `DESIGN.md`, `SPEC.md` (`AC-1..N`), test tự động và `VALIDATION.md` | 2026-10 |

## Known gaps (đừng "sửa nhầm")

- Chưa có (cập nhật trong quá trình chạy `/build` và `/validate`).

## Structure aliases (SPEC ↔ code)

- `SPEC.md` → Đặc tả hệ thống & danh sách `- AC-1: ...`
- `DESIGN.md` → Hệ thống thiết kế UI/UX
- `VALIDATION.md` → Báo cáo nghiệm thu theo chuẩn Studio Harness
- `SUBMISSION.md` → Bài thuyết trình nộp Devpost
