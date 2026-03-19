# Discord Xe Bot 🚗

Bot quản lý xe công ty cho Discord.

## Tính năng

- `/dangky-xe` — Đăng ký sử dụng xe (ngày, giờ, điểm đến, mục đích, số người)
- `/lich-xe` — Xem lịch xe đã được duyệt theo ngày
- `/huy-xe` — Hủy đơn đăng ký xe
- `/cho-duyet` — [Admin] Xem danh sách đơn chờ duyệt
- Nút ✅ Duyệt / ❌ Từ chối trực tiếp trên Discord
- Tự động nhắn DM kết quả cho người đăng ký
- Nhắc lịch xe lúc 7:00 sáng mỗi ngày
- Lưu toàn bộ dữ liệu vào Google Sheets

## Cài đặt

### 1. Tạo Discord Bot
1. Vào https://discord.com/developers/applications
2. Tạo New Application → Bot → Copy Token
3. Bật `applications.commands` và `bot` scope
4. Bật Permissions: Send Messages, Use Slash Commands, Read Message History
5. Invite bot vào server

### 2. Cài đặt môi trường
```bash
cp .env.example .env
# Điền đầy đủ thông tin vào .env
npm install
```

### 3. Cấu hình .env
```
DISCORD_TOKEN=        # Token bot Discord
CLIENT_ID=            # Application ID
GUILD_ID=             # ID server Discord
BOOKING_CHANNEL_ID=   # ID channel #xe-cong-ty
ADMIN_ROLE_ID=        # ID role Hành chính
SHEET_ID=             # ID Google Sheet (chia sẻ sau)
GOOGLE_SERVICE_ACCOUNT_EMAIL=clara-780@agent-454716.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY=   # Private key service account
```

### 4. Google Sheets
- Tạo Google Sheet mới
- Tạo tab tên: `Lịch xe`
- Share sheet với: `clara-780@agent-454716.iam.gserviceaccount.com` (Editor)
- Copy Sheet ID vào .env

### 5. Chạy bot
```bash
# Đăng ký slash commands (chạy 1 lần)
npm run deploy

# Chạy bot
npm start
```

### 6. Chạy trên VPS (với PM2)
```bash
npm install -g pm2
pm2 start index.js --name discord-xe-bot
pm2 save
pm2 startup
```

## Cấu trúc thư mục
```
discord-xe-bot/
├── index.js              # Bot chính
├── sheets.js             # Google Sheets integration
├── deploy-commands.js    # Đăng ký slash commands
├── commands/
│   ├── dangky.js         # /dangky-xe
│   ├── lich.js           # /lich-xe
│   ├── huy.js            # /huy-xe
│   └── admin.js          # /cho-duyet
├── .env.example
└── package.json
```
