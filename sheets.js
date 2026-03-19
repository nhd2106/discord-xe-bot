const { google } = require('googleapis');

const SHEET_NAME = 'Lịch xe';
const CAR_SHEET = 'Danh sách xe';
const HEADERS = [
  'ID', 'Người đăng ký', 'Discord ID', 'Ngày', 'Giờ đi', 'Điểm đến',
  'Mục đích', 'Số người', 'Xe', 'Trạng thái', 'Ghi chú', 'Thời gian tạo'
];

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

async function getSheets() {
  const auth = getAuth();
  return google.sheets({ version: 'v4', auth });
}

// Khởi tạo sheet nếu chưa có header
async function initSheet() {
  const sheets = await getSheets();
  const sheetId = process.env.SHEET_ID;

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${SHEET_NAME}!A1:L1`,
    });

    if (!res.data.values || res.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${SHEET_NAME}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [HEADERS] },
      });
      console.log('✅ Đã tạo header cho sheet');
    }
  } catch (err) {
    console.error('❌ Lỗi khởi tạo sheet:', err.message);
  }
}

// Lấy danh sách xe từ sheet
async function getCarList() {
  const sheets = await getSheets();
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: `${CAR_SHEET}!A2:C100`,
    });
    const rows = res.data.values || [];
    return rows
      .filter(r => r[2] === 'Hoạt động' || !r[2])
      .map(r => ({ name: r[0], plate: r[1] || '' }));
  } catch (err) {
    console.error('❌ Lỗi lấy danh sách xe:', err.message);
    return [];
  }
}

// Tạo ID đơn giản
function generateId() {
  return 'XE' + Date.now().toString().slice(-6);
}

// Thêm đăng ký mới
async function addBooking(data) {
  const sheets = await getSheets();
  const id = generateId();
  const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

  const row = [
    id,
    data.userName,
    data.userId,
    data.date,
    data.time,
    data.destination,
    data.purpose,
    data.passengers,
    data.car || '',
    'Chờ duyệt',
    '',
    now,
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SHEET_ID,
    range: `${SHEET_NAME}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [row] },
  });

  return id;
}

// Cập nhật trạng thái đơn
async function updateBookingStatus(bookingId, status, note = '') {
  const sheets = await getSheets();
  const sheetId = process.env.SHEET_ID;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${SHEET_NAME}!A:K`,
  });

  const rows = res.data.values || [];
  const rowIndex = rows.findIndex(r => r[0] === bookingId);
  if (rowIndex === -1) return false;

  const updateRange = `${SHEET_NAME}!J${rowIndex + 1}:K${rowIndex + 1}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: updateRange,
    valueInputOption: 'RAW',
    requestBody: { values: [[status, note]] },
  });

  return true;
}

// Lấy danh sách đặt xe theo ngày
async function getBookingsByDate(date) {
  const sheets = await getSheets();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID,
    range: `${SHEET_NAME}!A:K`,
  });

  const rows = res.data.values || [];
  return rows.slice(1).filter(r => r[3] === date && r[9] === 'Đã duyệt');
}

// Lấy đơn theo booking ID
async function getBookingById(bookingId) {
  const sheets = await getSheets();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID,
    range: `${SHEET_NAME}!A:K`,
  });

  const rows = res.data.values || [];
  const row = rows.find(r => r[0] === bookingId);
  if (!row) return null;

  return {
    id: row[0],
    userName: row[1],
    userId: row[2],
    date: row[3],
    time: row[4],
    destination: row[5],
    purpose: row[6],
    passengers: row[7],
    car: row[8] || '',
    status: row[9],
    note: row[10],
  };
}

// Lấy danh sách đơn chờ duyệt
async function getPendingBookings() {
  const sheets = await getSheets();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID,
    range: `${SHEET_NAME}!A:K`,
  });

  const rows = res.data.values || [];
  return rows.slice(1)
    .filter(r => r[9] === 'Chờ duyệt')
    .map(r => ({
      id: r[0], userName: r[1], userId: r[2],
      date: r[3], time: r[4], destination: r[5],
      purpose: r[6], passengers: r[7], car: r[8] || '',
      status: r[9],
    }));
}

// Cập nhật xe khi duyệt
async function updateBookingCar(bookingId, car) {
  const sheets = await getSheets();
  const sheetId = process.env.SHEET_ID;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${SHEET_NAME}!A:L`,
  });

  const rows = res.data.values || [];
  const rowIndex = rows.findIndex(r => r[0] === bookingId);
  if (rowIndex === -1) return false;

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${SHEET_NAME}!I${rowIndex + 1}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[car]] },
  });

  return true;
}

module.exports = {
  initSheet,
  addBooking,
  updateBookingStatus,
  updateBookingCar,
  getCarList,
  getBookingsByDate,
  getBookingById,
  getPendingBookings,
};
