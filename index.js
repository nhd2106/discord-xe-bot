require('dotenv').config();
const {
  Client, GatewayIntentBits, Collection, Events,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, EmbedBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const sheets = require('./sheets');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

// Lưu tạm thông tin đăng ký chờ chọn xe
const pendingBookings = new Map();

// Load commands
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
}

client.on(Events.InteractionCreate, async interaction => {

  // Slash command
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction, pendingBookings);
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

  // Select menu — chọn xe khi đăng ký
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('select_car_')) {
    const tempId = interaction.customId.replace('select_car_', '');
    const booking = pendingBookings.get(tempId);

    if (!booking) {
      return await interaction.reply({ content: '❌ Phiên đăng ký đã hết hạn. Vui lòng dùng /dangky-xe lại.', ephemeral: true });
    }

    pendingBookings.delete(tempId);

    const [carName, carPlate] = interaction.values[0].split('||');
    const carLabel = carPlate ? `${carName} (${carPlate})` : carName;
    const { date, time, destination, purpose, passengers } = booking;

    await interaction.deferUpdate();

    try {
      // Kiểm tra xe đã được đặt chưa
      const available = await sheets.checkCarAvailability(carName, date);
      if (!available) {
        return await interaction.editReply({
          content: `⚠️ *${carName}* đã có đơn đặt vào ngày *${date}*. Vui lòng chọn xe khác hoặc liên hệ Hành chính.`,
          components: [],
        });
      }

      const bookingId = await sheets.addBooking({
        userName: interaction.user.username,
        userId: interaction.user.id,
        date, time, destination, purpose, passengers,
        car: carLabel,
      });

      // Gửi thông báo vào channel hành chính
      const bookingChannel = interaction.guild.channels.cache.get(process.env.BOOKING_CHANNEL_ID);
      if (bookingChannel) {
        const embed = new EmbedBuilder()
          .setTitle('🚗 Đăng ký xe mới')
          .setColor(0xF59E0B)
          .addFields(
            { name: '📋 Mã đơn', value: bookingId, inline: true },
            { name: '👤 Người đăng ký', value: `<@${interaction.user.id}>`, inline: true },
            { name: '🚙 Xe', value: carLabel, inline: true },
            { name: '📅 Ngày đi', value: date, inline: true },
            { name: '🕐 Giờ đi', value: time, inline: true },
            { name: '👥 Số người', value: passengers.toString(), inline: true },
            { name: '📍 Điểm đến', value: destination, inline: true },
            { name: '🎯 Mục đích', value: purpose, inline: true },
          )
          .setFooter({ text: 'Hành chính vui lòng duyệt hoặc từ chối bên dưới' })
          .setTimestamp();

        // Dropdown đổi xe khi duyệt
        const cars = await sheets.getCarList(date);
        const changeCarMenu = new StringSelectMenuBuilder()
          .setCustomId(`change_car_${bookingId}`)
          .setPlaceholder('Đổi xe (nếu cần)...')
          .addOptions(
            cars.map(car => ({
              label: car.name,
              description: car.plate || 'Không có biển số',
              value: `${car.name}|${car.plate}`,
            }))
          );

        const btnRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`approve_${bookingId}`)
            .setLabel('✅ Duyệt')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`reject_${bookingId}`)
            .setLabel('❌ Từ chối')
            .setStyle(ButtonStyle.Danger),
        );

        const selectRow = new ActionRowBuilder().addComponents(changeCarMenu);

        await bookingChannel.send({ embeds: [embed], components: [selectRow, btnRow] });
      }

      await interaction.editReply({
        content: `✅ Đăng ký thành công!\n📋 Mã đơn: *${bookingId}*\n🚙 Xe: ${carLabel}\nHành chính sẽ xác nhận sớm nhất có thể.`,
        components: [],
      });

    } catch (err) {
      console.error(err);
      await interaction.editReply({ content: '❌ Có lỗi xảy ra, vui lòng thử lại.', components: [] });
    }
    return;
  }

  // Select menu — hành chính đổi xe khi duyệt
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('change_car_')) {
    if (!interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
      return await interaction.reply({ content: '❌ Chỉ Hành chính mới có quyền đổi xe.', ephemeral: true });
    }

    const bookingId = interaction.customId.replace('change_car_', '');
    const [carName, carPlate] = interaction.values[0].split('|');
    const carLabel = carPlate ? `${carName} (${carPlate})` : carName;

    await sheets.updateBookingCar(bookingId, carLabel);
    await interaction.reply({ content: `🚙 Đã đổi xe đơn **${bookingId}** sang: ${carLabel}`, ephemeral: true });
    return;
  }

  // Button — duyệt / từ chối
  if (interaction.isButton()) {
    const parts = interaction.customId.split('_');
    const action = parts[0];
    const bookingId = parts.slice(1).join('_');

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

        // Cập nhật trạng thái xe trong Danh sách xe
        const carName = booking.car.split(' (')[0];
        await sheets.updateCarStatus(carName, `Đã đặt - ${booking.date}`);

        const user = await client.users.fetch(booking.userId);
        await user.send(
          `✅ Đơn đăng ký xe **${bookingId}** của bạn đã được *duyệt*!\n` +
          `🚙 Xe: ${booking.car}\n📅 Ngày: ${booking.date} | 🕐 Giờ: ${booking.time}\n` +
          `📍 Điểm đến: ${booking.destination}\n` +
          `_Nhớ nhận chìa khóa từ Hành chính trước khi đi nhé!_`
        );

        await interaction.update({ content: `✅ Đã duyệt bởi <@${interaction.user.id}>`, components: [] });

      } else if (action === 'reject') {
        await sheets.updateBookingStatus(bookingId, 'Từ chối', `Từ chối bởi ${interaction.user.username}`);

        // Trả trạng thái xe về Sẵn sàng
        const carName = booking.car.split(' (')[0];
        await sheets.updateCarStatus(carName, 'Sẵn sàng');

        const user = await client.users.fetch(booking.userId);
        await user.send(
          `❌ Đơn đăng ký xe **${bookingId}** của bạn đã bị *từ chối*.\n` +
          `📅 Ngày: ${booking.date} | 📍 ${booking.destination}\n` +
          `_Vui lòng liên hệ Hành chính để biết thêm chi tiết._`
        );

        await interaction.update({ content: `❌ Đã từ chối bởi <@${interaction.user.id}>`, components: [] });
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
    msg += `${i + 1}. **[${b[0]}]** ${b[4]} — <@${b[2]}> → ${b[5]} | 🚙 ${b[8]} | 👥 ${b[7]} người\n`;
  });

  await channel.send(msg);
}, { timezone: 'Asia/Ho_Chi_Minh' });

client.once(Events.ClientReady, async () => {
  console.log(`✅ Bot đã online: ${client.user.tag}`);
  await sheets.initSheet();
});

client.login(process.env.DISCORD_TOKEN);
