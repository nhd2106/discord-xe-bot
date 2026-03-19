require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const sheets = require('./sheets');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

// Load commands
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
}

// Xử lý slash commands
client.on(Events.InteractionCreate, async interaction => {
  // Slash command
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(err);
      const msg = { content: '❌ Có lỗi xảy ra khi thực hiện lệnh.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg);
      } else {
        await interaction.reply(msg);
      }
    }
    return;
  }

  // Button interaction (duyệt / từ chối)
  if (interaction.isButton()) {
    const [action, bookingId] = interaction.customId.split('_');

    // Kiểm tra quyền admin
    if (!interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
      return await interaction.reply({ content: '❌ Chỉ Hành chính mới có quyền duyệt.', ephemeral: true });
    }

    try {
      const booking = await sheets.getBookingById(bookingId);
      if (!booking) {
        return await interaction.reply({ content: `❌ Không tìm thấy đơn ${bookingId}.`, ephemeral: true });
      }

      if (booking.status !== 'Chờ duyệt') {
        return await interaction.reply({
          content: `⚠️ Đơn này đã được xử lý rồi (Trạng thái: ${booking.status}).`,
          ephemeral: true,
        });
      }

      if (action === 'approve') {
        await sheets.updateBookingStatus(bookingId, 'Đã duyệt', `Duyệt bởi ${interaction.user.username}`);

        // Thông báo cho người đăng ký
        const user = await client.users.fetch(booking.userId);
        await user.send(
          `✅ Đơn đăng ký xe **${bookingId}** của bạn đã được *duyệt*!\n` +
          `📅 Ngày: ${booking.date} | 🕐 Giờ: ${booking.time}\n` +
          `📍 Điểm đến: ${booking.destination}\n` +
          `_Nhớ nhận chìa khóa từ Hành chính trước khi đi nhé!_`
        );

        // Cập nhật embed
        await interaction.update({
          content: `✅ Đã duyệt bởi <@${interaction.user.id}>`,
          components: [],
        });

      } else if (action === 'reject') {
        await sheets.updateBookingStatus(bookingId, 'Từ chối', `Từ chối bởi ${interaction.user.username}`);

        // Thông báo cho người đăng ký
        const user = await client.users.fetch(booking.userId);
        await user.send(
          `❌ Đơn đăng ký xe **${bookingId}** của bạn đã bị *từ chối*.\n` +
          `📅 Ngày: ${booking.date} | 📍 ${booking.destination}\n` +
          `_Vui lòng liên hệ Hành chính để biết thêm chi tiết._`
        );

        await interaction.update({
          content: `❌ Đã từ chối bởi <@${interaction.user.id}>`,
          components: [],
        });
      }

    } catch (err) {
      console.error(err);
      await interaction.reply({ content: '❌ Có lỗi xảy ra.', ephemeral: true });
    }
  }
});

// Nhắc nhở tự động lúc 7:00 sáng mỗi ngày
cron.schedule('0 7 * * *', async () => {
  const today = new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const bookings = await sheets.getBookingsByDate(today);

  if (bookings.length === 0) return;

  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  const channel = guild?.channels.cache.get(process.env.BOOKING_CHANNEL_ID);
  if (!channel) return;

  let msg = `📅 *Lịch xe hôm nay (${today}):*\n\n`;
  bookings.forEach((b, i) => {
    msg += `${i + 1}. **[${b[0]}]** ${b[4]} — <@${b[2]}> → ${b[5]} (${b[7]} người)\n`;
  });

  await channel.send(msg);
}, { timezone: 'Asia/Ho_Chi_Minh' });

client.once(Events.ClientReady, async () => {
  console.log(`✅ Bot đã online: ${client.user.tag}`);
  await sheets.initSheet();
});

client.login(process.env.DISCORD_TOKEN);
