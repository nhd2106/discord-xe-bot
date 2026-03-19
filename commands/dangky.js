const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const sheets = require('../sheets');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dangky-xe')
    .setDescription('Đăng ký sử dụng xe công ty')
    .addStringOption(opt =>
      opt.setName('ngay').setDescription('Ngày đi (VD: 20/03/2026)').setRequired(true))
    .addStringOption(opt =>
      opt.setName('gio').setDescription('Giờ đi (VD: 08:00)').setRequired(true))
    .addStringOption(opt =>
      opt.setName('diem_den').setDescription('Điểm đến').setRequired(true))
    .addStringOption(opt =>
      opt.setName('muc_dich').setDescription('Mục đích chuyến đi').setRequired(true))
    .addIntegerOption(opt =>
      opt.setName('so_nguoi').setDescription('Số người đi (kể cả tài xế)').setRequired(true).setMinValue(1).setMaxValue(10)),

  async execute(interaction) {
    const date = interaction.options.getString('ngay');
    const time = interaction.options.getString('gio');
    const destination = interaction.options.getString('diem_den');
    const purpose = interaction.options.getString('muc_dich');
    const passengers = interaction.options.getInteger('so_nguoi');

    await interaction.deferReply({ ephemeral: true });

    try {
      const bookingId = await sheets.addBooking({
        userName: interaction.user.username,
        userId: interaction.user.id,
        date,
        time,
        destination,
        purpose,
        passengers,
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
            { name: '📅 Ngày đi', value: date, inline: true },
            { name: '🕐 Giờ đi', value: time, inline: true },
            { name: '📍 Điểm đến', value: destination, inline: true },
            { name: '👥 Số người', value: passengers.toString(), inline: true },
            { name: '🎯 Mục đích', value: purpose },
          )
          .setFooter({ text: 'Hành chính vui lòng duyệt hoặc từ chối bên dưới' })
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`approve_${bookingId}`)
            .setLabel('✅ Duyệt')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`reject_${bookingId}`)
            .setLabel('❌ Từ chối')
            .setStyle(ButtonStyle.Danger),
        );

        await bookingChannel.send({ embeds: [embed], components: [row] });
      }

      await interaction.editReply({
        content: `✅ Đã gửi đăng ký xe thành công!\n📋 Mã đơn: **${bookingId}**\nHành chính sẽ xác nhận sớm nhất có thể.`,
      });

    } catch (err) {
      console.error(err);
      await interaction.editReply({ content: '❌ Có lỗi xảy ra, vui lòng thử lại.' });
    }
  },
};
