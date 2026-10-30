# Hackathon Brief: Codex x TwitchCon Hackathon

- Devpost URL: https://twitchcon-codex.devpost.com/
- Prize Pool: $25,000 ($10K 1st, $6K 2nd, $4K 3rd, 2x $2.5K Runner-up + Stage time at TwitchCon San Diego)
- Deadline: Nov 2, 2026 @ 2:00 PM PST (04:00 AM Nov 3, 2026 giờ Việt Nam)
- Approval Status: ✅ APPROVED BY USER
- Approved Product Name: **TwitchHive: One-Agent-Per-Viewer Interactive Stream Arena & OBS Overlay**
- Approved Pitch: Mỗi khán giả trên kênh chat Twitch được cấp một micro AI Agent đại diện cá nhân hóa ngay trên OBS Browser Overlay & Web Companion, tự động phân tích luồng chat/EventSub (cheer, sub, raid, lệnh `!hive`) và phối hợp cùng hàng trăm agent khác để kích hoạt sự kiện, minigame tương tác và buff/debuff streamer theo thời gian thực.
- Required Stack: Node.js / TypeScript, Twitch Chat IRC (`tmi.js`) & EventSub, Twitch Helix API, React + HTML5 Canvas (OBS Browser Overlay + Streamer Control Dashboard), WebSockets (`ws`).
- Studio Harness Root: `/Volumes/AllySSD/Projects/AgentAppStudio/studio-harness`

## Official Hackathon Requirements & Constraints (from Devpost Rules & Resources)

1. **Tích hợp Twitch thực tế (KHÔNG dùng Twitch Extension cần duyệt 5–14 ngày)**:
   - Ban Tổ Chức lưu ý rõ trong mục *Resources*: *"It can take 5–14 days for an Extension to be reviewed and judges can't install an unreviewed Extension. Chat, overlays, the Twitch API and EventSub are faster paths."*
   - Do đó, kiến trúc sản phẩm phải gồm:
     - **Twitch Chat Bot & EventSub Listener**: Kết nối kênh Twitch thực tế (qua `tmi.js` / Twitch EventSub / Twitch API) VÀ có chế độ **Live Twitch Simulator (Replay/Live Chat & EventSub Trigger)** ngay trên giao diện để Ban Giám Khảo test tức thì mọi luồng (`!join`, `!action`, `!vote`, Sub, Raid, Cheer Bits) mà không cần cấu hình phức tạp.
     - **Interactive OBS Browser Source Overlay (`/overlay`)**: Màn hình đồ họa trực quan ("fun to watch") hiển thị đàn micro-agents của từng viewer, thanh trạng thái Swarm Consensus, hiệu ứng Boss/Chaos Event và bảng xếp hạng cộng đồng thời gian thực.
     - **Streamer Command Deck (`/dashboard`)**: Bảng điều khiển cho streamer quản lý kết nối kênh Twitch, cấu hình luật chơi AI Director, kích hoạt câu hỏi/thử thách cho chat và xem thống kê tương tác.
2. **4 Tiêu chí chấm giải (Trọng số 25% mỗi tiêu chí)**:
   - **Innovation / Idea (25%)**: Mô hình *One-Agent-Per-Viewer Swarm* thay cho bình chọn văn bản nhàm chán.
   - **Potential Impact (25%)**: Tăng mạnh chỉ số tương tác chat, thời gian xem và tỷ lệ donate/sub cho streamer.
   - **Technological Implementation (25%)**: Xử lý đồng thời luồng sự kiện Twitch IRC/EventSub qua WebSockets độ trễ thấp + AI Director điều phối kịch bản + tài liệu hóa rõ cách sử dụng Codex.
   - **Design (25%)**: Dễ dùng cho streamer (`/dashboard`) và cực kỳ bắt mắt khi hiển thị trên sóng stream (`/overlay`).
3. **4 Hạng mục nộp bài bắt buộc**:
   - **GitHub Repository**: Đầy đủ mã nguồn, `.env.example`, hướng dẫn cài đặt & chạy chi tiết trong `README.md`.
   - **Demo Video (< 3 phút trên YouTube)**: Trình diễn sản phẩm hoạt động trên Twitch + cách sử dụng Codex.
   - **Project Description (`SUBMISSION.md`)**: Mô tả chi tiết tính năng, kiến trúc và cách dùng Codex.
   - **Codex Session ID**: Lấy bằng lệnh `/status` trong phiên Codex và điền vào form nộp bài.

## Studio Harness Engineering Rules (SDD → VSDD → CoDD)

1. **Issue #1 — Product & Architecture (`studio.design.init` + `studio.product.specification`)**:
   - Tạo `DESIGN.md` và `SPEC.md` (theo mẫu `/Volumes/AllySSD/Projects/AgentAppStudio/studio-harness/templates/SPEC.md`) với danh sách `- AC-1: ...` đến `- AC-8: ...`.
   - Kiểm tra bằng `npm --prefix /Volumes/AllySSD/Projects/AgentAppStudio/studio-harness run coverage:check -- --spec ./SPEC.md`.
2. **Issue #2 — Engineering Backend (`/build`)**:
   - Xây dựng Backend Node.js/TypeScript + WebSocket Server + Twitch Chat IRC (`tmi.js`) + Twitch EventSub handler + AI Swarm Director + Unit/Integration tests chứng minh các `AC-*` backend.
3. **Issue #3 — Engineering Frontend & Live OBS Overlay (`/build`)**:
   - Xây dựng giao diện `/dashboard` (Streamer Deck + Live Twitch Event Simulator) và `/overlay` (Interactive 60fps Canvas Arena cho OBS) chạy ở cổng `3000`, kiểm thử E2E không lỗi console.
4. **Issue #4 — QA, CTO Review & Submission Packaging (`/validate`)**:
   - Xuất `VALIDATION.md`, cập nhật `AGENTS.md`, vẽ sơ đồ kiến trúc Mermaid.js trong `README.md` và viết `SUBMISSION.md` chuẩn Devpost.
