# Hackathon Brief: Codex x TwitchCon Hackathon

- Devpost URL: https://twitchcon-codex.devpost.com/
- Prize Pool: $<span data-currency-value>25,000</span>
- Deadline: 4 days left
- Approval Status: ✅ APPROVED BY USER
- Approved Product Name: TwitchHive: One-Agent-Per-Viewer Interactive Arena
- Approved Pitch: Mỗi khán giả trên Twitch sở hữu một micro AI Agent đại diện cá nhân hóa trên Extension, tự động phân tích diễn biến stream và phối hợp cùng hàng ngàn agent khác để điều khiển sự kiện, buff/debuff streamer trực tiếp trong game. Biến khán giả thụ động thành cộng đồng đồng sáng tạo nội dung thời gian thực.
- Winning Angle: Hiện thực hóa trọn vẹn triết lý One-Agent-Per-User và '2035 test', mở ra kỷ nguyên Massive Autonomous Co-play giúp Twitch gia tăng đột biến chỉ số tương tác, viewer retention và doanh thu bits/subs.
- Required Stack: Twitch Extension SDK, OpenAI Codex / Gemini API, Node.js / WebSocket, Phaser.js
- Studio Harness Root: `/Volumes/AllySSD/Projects/AgentAppStudio/studio-harness`

## Studio Harness Engineering Rules (SDD → VSDD → CoDD)

1. **Product & Architecture (`studio.design.init` + `studio.product.specification`)**:
   - Đọc `.claude/commands/design-init.md` và `.claude/commands/spec.md`.
   - Tạo `DESIGN.md` và `SPEC.md` (theo mẫu `/Volumes/AllySSD/Projects/AgentAppStudio/studio-harness/templates/SPEC.md`) bám sát ý tưởng đã được duyệt (`TwitchHive: One-Agent-Per-Viewer Interactive Arena`), với các tiêu chí nghiệm thu định dạng `- AC-1: <hành vi kiểm chứng được>`, `- AC-2: ...`.
   - Chạy `npm --prefix /Volumes/AllySSD/Projects/AgentAppStudio/studio-harness run coverage:check -- --spec ./SPEC.md` đảm bảo trả về danh sách tiêu chí hợp lệ (exit code 0).
2. **Engineering (`studio.build.implement`)**:
   - Đọc `.claude/commands/build.md`, xây dựng ứng dụng hoàn chỉnh chạy thực tế ở cổng 3000 (hoặc 8000), không dùng mock data cứng.
   - Viết test kiểm chứng cho từng tiêu chí `AC-*` và đảm bảo build + test pass 100%.
3. **Review, QA & Release (`studio.validate.gate` + `studio.validate.cto-review`)**:
   - Đọc `.claude/commands/validate.md` và `.claude/commands/cto.md`.
   - Tạo `VALIDATION.md` (theo mẫu `/Volumes/AllySSD/Projects/AgentAppStudio/studio-harness/templates/VALIDATION.md`) ánh xạ từng `AC-*` tới bằng chứng test/build thực tế.
   - Tạo `SUBMISSION.md` theo đúng chuẩn Devpost (gồm các mục: `## Elevator Pitch`, `## Inspiration`, `## What it does`, `## How we built it`, `## Challenges we ran into`, `## Accomplishments that we're proud of`, `## What's next`) và vẽ sơ đồ Mermaid.js trong `README.md`.
